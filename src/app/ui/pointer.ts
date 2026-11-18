// How far (px) a touch moves before it counts as a move rather than a press held still: a
// search result's long press is cancelled past it, and a press in the one-row card tray
// decides there whether it pans the tray or drags a card
export const TOUCH_SLOP = 8;

// A touch press held this long (ms) without moving past TOUCH_SLOP opens a menu: a search
// result's, or a card's on the board or in the card tray, as long presses go on phones
export const LONG_PRESS = 500;
