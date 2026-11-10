import React from 'react';

// Shows a popup (an element with `popover`, styled .tierbinder-anchored in globals.css) in
// the top layer under its button, so it floats over the board instead of being clipped
// by, or widening, the sidebar. It opens above the button instead when it doesn't fit
// below and there's more room above (a button low on a phone's screen; data-side).
// Gives the CSS the button's edges and width and the popup's own width (--anchor-*),
// following them while the page or sidebar scrolls or the window resizes; the CSS keeps
// it inside the window.
export function useAnchored(
  shown: boolean,
  buttonRef: React.RefObject<HTMLElement | null>,
  popupRef: React.RefObject<HTMLElement | null>
) {
  React.useLayoutEffect(() => {
    const popup = popupRef.current;
    const button = buttonRef.current;
    if (!shown || !popup || !button) return;
    const place = () => {
      const box = button.getBoundingClientRect();
      const below = window.innerHeight - box.bottom;
      const above = box.top;
      popup.dataset.side = popup.scrollHeight > below && above > below ? 'above' : 'below';
      popup.style.setProperty('--anchor-top', `${box.bottom}px`);
      popup.style.setProperty('--anchor-bottom', `${window.innerHeight - box.top}px`);
      popup.style.setProperty('--anchor-left', `${box.left}px`);
      popup.style.setProperty('--anchor-width', `${box.width}px`);
      popup.style.setProperty('--anchor-popup-width', `${popup.offsetWidth}px`);
    };
    if (!popup.matches(':popover-open')) popup.showPopover?.();
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [shown, buttonRef, popupRef]);
}
