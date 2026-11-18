// Sizes shared by every graphic. Graphics draw at the board's design size; the editor
// scales the stage to fit the window, and exports are the board's shape's size.

export const BOARD_HEIGHT = 675;

// The shapes a board can have, for where it's posted. Every board is BOARD_HEIGHT tall in
// design pixels, so rows and cards keep their size: a shape only sets how wide it is, and
// so how many cards fit across. The image is exported at the shape's own size.
export const SHAPES = [
  { id: '16:9', label: 'Wide (16:9)', exportWidth: 2400, exportHeight: 1350 },
  { id: '1:1', label: 'Square (1:1)', exportWidth: 1080, exportHeight: 1080 },
  { id: '4:5', label: 'Portrait (4:5)', exportWidth: 1080, exportHeight: 1350 },
  { id: '3:4', label: 'Tall (3:4)', exportWidth: 1080, exportHeight: 1440 },
  { id: '9:16', label: 'Story (9:16)', exportWidth: 1080, exportHeight: 1920 },
] as const;

export type ShapeId = (typeof SHAPES)[number]['id'];
export const DEFAULT_SHAPE: ShapeId = '16:9';

const shapeOf = (id: ShapeId) => SHAPES.find((s) => s.id === id) ?? SHAPES[0];

// A shape's name, as the Shape dropdown shows it ("Story (9:16)")
export const shapeLabel = (id: ShapeId) => shapeOf(id).label;

// A saved shape, or the default for a board saved before shapes
export function parseShape(value: unknown): ShapeId {
  return SHAPES.find((s) => s.id === value)?.id ?? DEFAULT_SHAPE;
}

// A board's width in design pixels: 1200 at 16:9, 675 square, down to about 380 at 9:16
export function boardWidth(shape: ShapeId) {
  const { exportWidth, exportHeight } = shapeOf(shape);
  return (BOARD_HEIGHT * exportWidth) / exportHeight;
}

// How many image pixels a design pixel is in the export
export function exportScale(shape: ShapeId) {
  return shapeOf(shape).exportHeight / BOARD_HEIGHT;
}

// Takes a size a float's width short of a whole pixel as that pixel
const EXPORT_ROUNDING = 1e-6;

// The exported image's size in pixels when it shows `height` design pixels (the board,
// and the card tray under it when it's included): whole pixels, the last part of one
// left off
export function exportSize(shape: ShapeId, height = BOARD_HEIGHT) {
  return {
    width: shapeOf(shape).exportWidth,
    height: Math.floor(height * exportScale(shape) + EXPORT_ROUNDING),
  };
}

export const CARD_WIDTH = 100;
export const CARD_HEIGHT = 140;
// Card border (tier-colored, or the board's border color on split cards), drawn inside
// the card's edge; also the width of a split card's divider
export const CARD_BORDER_WIDTH = 3;
// Card images have rounded corners: about 21px on the 460px-wide originals
export const CARD_CORNER_RADIUS = 4.5;
