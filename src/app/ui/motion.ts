// How long a closing popup (the card menu, dropdowns, the Sets popup, View) stays on screen:
// just past its fold (--duration-fold, 180ms). Timed rather than waiting for animationend,
// which doesn't fire in a tab that isn't painting.
export const FOLD_CLEARANCE = 220;
