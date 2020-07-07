/*
Copyright (c) 2018-2020 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

// @flow

import * as React from 'react';
import {styled, useStyletron} from '../styles/index.js';
import {Button, KIND} from '../button/index.js';

// TODO(tabs-motion): Use unique ids for when there are multiple Tabs on the page.

// Constants

export const ORIENTATION = {
  vertical: 'vertical',
  horizontal: 'horizontal',
};

export const FILL = {
  fixed: 'fixed',
  intrinsic: 'intrinsic',
};

export const KEYBOARD_ACTIVATION = {
  automatic: 'automatic',
  manual: 'manual',
};

// Utilities

export const getTabId = key => `tab_${key}`;
export const getTabPanelId = key => `tabpanel_${key}`;

// Styled Components

export const StyledRoot = styled('div', ({$theme, $helper}) => {
  return {
    display: 'flex',
    flexDirection: $helper({h: 'column', v: 'row'}),
  };
});

export const StyledTabList = styled('div', ({$theme, $fill, $helper}) => {
  return {
    position: 'relative',
    display: 'flex',
    flexWrap: 'nowrap',
    flexDirection: $helper({h: 'row', v: 'column'}),
    // The track for the StyledTabAccent
    boxShadow: $helper({
      h: `inset 0 -5px ${$theme.colors.borderOpaque}`,
      vltr: `inset -5px 0 ${$theme.colors.borderOpaque}`,
      vrtl: `inset 5px 0 ${$theme.colors.borderOpaque}`,
    }),
    paddingLeft: $helper({
      vrtl: '5px',
    }),
    paddingRight: $helper({
      vltr: '5px',
    }),
    paddingBottom: $helper({
      h: '5px',
    }),
    ...($fill === FILL.intrinsic
      ? {
          overflowX: $helper({h: 'scroll'}),
          overflowY: $helper({v: 'scroll'}),
          // The following properties hide the scroll bar on various browsers:
          // Chrome, Safari, etc
          '::-webkit-scrollbar': {
            display: 'none',
          },
          // IE, Edge
          '-ms-overflow-style': 'none',
          // Firefox
          scrollbarWidth: 'none',
        }
      : {}),
  };
});

export const StyledTabAccent = styled(
  'div',
  ({$theme, $orientation, $helper, $length = 0, $distance = 0}) => {
    return {
      position: 'absolute',
      bottom: $helper({h: '0'}),
      right: $helper({hrtl: '0', vltr: '0'}),
      left: $helper({hltr: '0', vrtl: '0'}),
      height: $helper({h: '5px', v: `${$length}px`}),
      width: $helper({v: '5px', h: `${$length}px`}),
      transform: $helper({
        h: `translateX(${$distance}px)`,
        v: `translateY(${$distance}px)`,
      }),
      backgroundColor: $theme.colors.primary,
      transitionProperty: 'all',
      transitionDuration: $theme.animation.timing400,
      transitionTimingFunction: $theme.animation.easeInOutQuinticCurve,
    };
  },
);

export const StyledTabPanel = styled('div', () => {});

// Components

export function Tabs({
  activeTabKey = '0',
  disabled = false,
  keyboardActivation = KEYBOARD_ACTIVATION.automatic,
  onSelect = () => {},
  orientation = ORIENTATION.horizontal,
  fill = FILL.intrinsic,
  children,
}) {
  const [, theme] = useStyletron();

  // Positioning the TabAccent
  const activeTabRef = React.useRef();
  const [accentLayout, setAccentLayout] = React.useState({
    length: 0,
    distance: 0,
  });
  React.useEffect(() => {
    if (activeTabRef.current) {
      setAccentLayout({
        length:
          orientation === ORIENTATION.horizontal
            ? activeTabRef.current.clientWidth
            : activeTabRef.current.clientHeight,
        distance:
          orientation === ORIENTATION.horizontal
            ? theme.direction !== 'rtl'
              ? activeTabRef.current.offsetLeft
              : -1 *
                (activeTabRef.current.parentElement.scrollWidth -
                  activeTabRef.current.offsetLeft -
                  activeTabRef.current.clientWidth)
            : activeTabRef.current.offsetTop,
      });
    }
  }, [activeTabKey]);

  // Scroll active Tab into view.
  // We have to split up the scrollIntoView for mount and key change.
  // On first mount:
  React.useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        block: 'start',
        inline: 'center',
      });
    }
  }, []);
  // On key change:
  React.useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeTabKey]);

  // A helper for styling all the various states (RTL/Orientation)
  const helper = React.useCallback(
    results => {
      if (orientation === ORIENTATION.horizontal && theme.direction !== 'rtl') {
        return results.hltr || results.h || results.ltr || null;
      }
      if (orientation === ORIENTATION.vertical && theme.direction !== 'rtl') {
        return results.vltr || results.v || results.ltr || null;
      }
      if (orientation === ORIENTATION.horizontal && theme.direction === 'rtl') {
        return results.hrtl || results.h || results.rtl || null;
      }
      if (orientation === ORIENTATION.vertical && theme.direction === 'rtl') {
        return results.vrtl || results.v || results.rtl || null;
      }
      return null;
    },
    [orientation, theme.direction],
  );

  // Collect shared styling props
  const shared$Props = {
    $orientation: orientation,
    $fill: fill,
    $helper: helper,
  };

  // We do a first pass to collect what each Tab's [key] will be.
  // We will use them when building keyDown handlers for focus management-
  // at which point we won't have access to other Tab component's keys.
  const tabKeys = React.Children.map(children, (child, index) => {
    return child ? child.key || String(index) : null;
  });

  return (
    <StyledRoot {...shared$Props}>
      <StyledTabList role="tablist" {...shared$Props}>
        {React.Children.map(children, (child, index) => {
          if (!child) return;
          const key = tabKeys[index];
          const isActive = key === activeTabKey;
          return (
            <Button
              key={key}
              id={getTabId(key)}
              role="tab"
              onClick={() => onSelect({selectedTabKey: key})}
              onKeyDown={event => {
                // TODO(tabs-motion): Add alternate keyCode conditions (RTL, orientation)

                // WAI-ARIA 1.1
                // https://www.w3.org/TR/wai-aria-practices-1.1/#tabpanel
                // We use directional keys to iterate focus through Tabs.

                if (event.keyCode === 37 || event.keyCode === 39) {
                  let nextActiveIndex;
                  if (
                    // Previous
                    // ⬆️ if Vertical
                    // ➡️ if RTL
                    // ⬅️
                    event.keyCode === 37
                  ) {
                    if (event.target.previousSibling) {
                      nextActiveIndex = index - 1;
                    } else {
                      nextActiveIndex = children.length - 1;
                    }
                  } else if (
                    // Next
                    // ⬇️ if Vertical
                    // ⬅️ if RTL
                    // ➡️
                    event.keyCode === 39
                  ) {
                    if (
                      event.target.nextSibling &&
                      event.target.nextSibling !==
                        event.target.parentNode.lastElementChild
                    ) {
                      nextActiveIndex = index + 1;
                    } else {
                      nextActiveIndex = 0;
                    }
                  }
                  // Focus the Tab first...
                  event.target.parentNode.childNodes[nextActiveIndex].focus();
                  // And then optionally activate the Tab.
                  if (keyboardActivation === KEYBOARD_ACTIVATION.automatic) {
                    onSelect({selectedTabKey: tabKeys[nextActiveIndex]});
                  }
                }
              }}
              aria-selected={isActive}
              aria-controls={getTabPanelId(key)}
              tabIndex={isActive ? '0' : '-1'}
              ref={isActive ? activeTabRef : null}
              kind={KIND.tertiary}
            >
              {child.props.title}
            </Button>
          );
        })}
        <StyledTabAccent
          $length={accentLayout.length}
          $distance={accentLayout.distance}
          aria-hidden="true"
          role="presentation"
          {...shared$Props}
        />
      </StyledTabList>

      {React.Children.map(children, (child, index) => {
        if (!child) return;
        const key = child.key || String(index);
        const isActive = key === activeTabKey;
        return (
          <StyledTabPanel
            key={key}
            id={getTabPanelId(key)}
            role="tabpanel"
            aria-expanded={isActive}
            hidden={!isActive}
          >
            {child.props.children}
          </StyledTabPanel>
        );
      })}
    </StyledRoot>
  );
}

export function Tab({id}) {}
