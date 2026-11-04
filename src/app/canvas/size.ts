// Sizes shared by every graphic. Graphics draw at the board's design size; the editor
// scales the stage down to fit narrow windows, and exports are EXPORT_SCALE times this.

export const BOARD_WIDTH = 1200;
export const BOARD_HEIGHT = 675;
export const EXPORT_SCALE = 2;

export const CARD_WIDTH = 100;
export const CARD_HEIGHT = 140;
// Card border (tier-colored, or the board's border color on split cards), drawn inside
// the card's edge; also the width of a split card's divider
export const CARD_BORDER_WIDTH = 3;
// Card images have rounded corners: about 21px on the 460px-wide originals
export const CARD_CORNER_RADIUS = 4.5;
