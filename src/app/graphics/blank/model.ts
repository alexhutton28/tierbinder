// The blank canvas graphic: cards placed anywhere on a plain background.

import { newId, parseCardItem, type CardItem } from '../../cards';
import { parseColor } from '../../color';
import { cardBox } from '../../canvas/CardNode';
import {
  BOARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_SHAPE,
  boardWidth,
  parseShape,
  type ShapeId,
} from '../../canvas/size';
import { defaultTray, parseTray, type Tray } from '../../canvas/tray';
import type { CardPlacement, Point } from '../types';

export type BlankCanvas = {
  kind: 'blank';
  // The board's shape (canvas/size.ts), which sets its width
  shape: ShapeId;
  background: string;
  // Split cards' divider and border
  border: string;
  // Every card's width in design pixels (height follows the card's shape)
  cardWidth: number;
  // Cards show only their top half (split cards still show both halves)
  topHalf: boolean;
  // Each card with its top-left corner, in drawing order (later cards on top)
  items: (CardItem & Point)[];
  // Ink drawn over the cards, in order; eraser strokes remove the ink under them
  strokes: Stroke[];
  // Pen and eraser settings, kept with the board
  penColor: string;
  penWidth: number;
  eraserWidth: number;
  // The card tray under the board (canvas/tray.ts)
  tray: Tray;
};

export type Stroke = {
  id: string;
  tool: 'pen' | 'eraser';
  // Pen only
  color: string;
  width: number;
  // x, y pairs in design pixels, as Konva's Line takes them
  points: number[];
};

export const MIN_CARD_WIDTH = 40;
export const MAX_CARD_WIDTH = 400;
export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 200;

const DEFAULT_DRAWING = {
  strokes: [],
  penColor: '#1b1b1b',
  penWidth: 12,
  eraserWidth: 24,
} satisfies Partial<BlankCanvas>;

// A step darker than the white background: Petrel 100 (design/theme.css; canvas colors
// can't read the CSS variables)
const DEFAULT_TRAY_COLOR = '#e3e8eb';
const DEFAULT_BACKGROUND = '#ffffff';
const DEFAULT_BORDER = '#16303c';

export function defaultBlankCanvas(): BlankCanvas {
  return {
    kind: 'blank',
    shape: DEFAULT_SHAPE,
    background: DEFAULT_BACKGROUND,
    border: DEFAULT_BORDER,
    cardWidth: CARD_WIDTH,
    topHalf: false,
    items: [],
    ...DEFAULT_DRAWING,
    tray: defaultTray(DEFAULT_TRAY_COLOR),
  };
}

const boxOf = (canvas: BlankCanvas, item: CardItem) =>
  cardBox(item, canvas.cardWidth, canvas.topHalf);

// Keeps a card's top-left corner where the whole card is on the board
function clamp(canvas: BlankCanvas, item: CardItem, x: number, y: number): Point {
  const box = boxOf(canvas, item);
  return {
    x: Math.round(Math.max(0, Math.min(boardWidth(canvas.shape) - box.width, x))),
    y: Math.round(Math.max(0, Math.min(BOARD_HEIGHT - box.height, y))),
  };
}

// Cards added from search or import fill a grid of as many spots as fit at the card
// size, left to right and top to bottom by how many cards there are, starting over once
// it's full. At the default size that's 10 × 4.
const GRID_LEFT = 25;
const GRID_TOP = 23;
const GAP_X = 17;
const GAP_Y = 23;
function nextSpot(canvas: BlankCanvas, item: CardItem): Point {
  const box = boxOf(canvas, item);
  const columns = Math.max(
    1,
    Math.floor((boardWidth(canvas.shape) - GRID_LEFT - 20 + GAP_X) / (box.width + GAP_X))
  );
  const rows = Math.max(
    1,
    Math.floor((BOARD_HEIGHT - GRID_TOP - 20 + GAP_Y) / (box.height + GAP_Y))
  );
  const count = canvas.items.length;
  const column = count % columns;
  const row = Math.floor(count / columns) % rows;
  return clamp(
    canvas,
    item,
    GRID_LEFT + column * (box.width + GAP_X),
    GRID_TOP + row * (box.height + GAP_Y)
  );
}

export function layoutCards(canvas: BlankCanvas): CardPlacement[] {
  return canvas.items.map(({ x, y, ...item }) => ({ item, x, y, ...boxOf(canvas, item) }));
}

export function mapCards(canvas: BlankCanvas, change: (item: CardItem) => CardItem | null) {
  return {
    ...canvas,
    items: canvas.items.flatMap(({ x, y, ...item }) => {
      const next = change(item);
      return next ? [{ ...next, x, y }] : [];
    }),
  };
}

export function addCard(canvas: BlankCanvas, item: CardItem): BlankCanvas {
  return { ...canvas, items: [...canvas.items, { ...item, ...nextSpot(canvas, item) }] };
}

// Centered on the pointer
export function dropCard(canvas: BlankCanvas, item: CardItem, point: Point): BlankCanvas {
  const box = boxOf(canvas, item);
  const spot = clamp(canvas, item, point.x - box.width / 2, point.y - box.height / 2);
  return { ...canvas, items: [...canvas.items, { ...item, ...spot }] };
}

// A moved card goes on top of the others
export function moveCard(canvas: BlankCanvas, id: string, x: number, y: number): BlankCanvas {
  const item = canvas.items.find((i) => i.id === id);
  if (!item) return canvas;
  return {
    ...canvas,
    items: [...canvas.items.filter((i) => i.id !== id), { ...item, ...clamp(canvas, item, x, y) }],
  };
}

// Changes the card size, the top-half setting or the board's shape, moving cards that
// would now hang off the board back onto it, and keeping them no wider than it
export function setCardShape(
  canvas: BlankCanvas,
  change: Partial<Pick<BlankCanvas, 'cardWidth' | 'topHalf' | 'shape'>>
): BlankCanvas {
  const merged = { ...canvas, ...change };
  // No wider than the board: a narrow shape's is less than the largest card size
  const next = {
    ...merged,
    cardWidth: Math.min(merged.cardWidth, Math.floor(boardWidth(merged.shape))),
  };
  return { ...next, items: next.items.map((i) => ({ ...i, ...clamp(next, i, i.x, i.y) })) };
}

// A pen or eraser width from a saved or shared board, in range
const parseWidth = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(MIN_STROKE_WIDTH, Math.min(MAX_STROKE_WIDTH, value))
    : fallback;

// A stroke from a saved or shared board, or none: a tool, and an even run of numbers
function parseStroke(value: unknown): Stroke[] {
  const stroke = value as Partial<Stroke> | null | undefined;
  if (
    (stroke?.tool !== 'pen' && stroke?.tool !== 'eraser') ||
    !Array.isArray(stroke.points) ||
    stroke.points.length % 2 !== 0 ||
    !stroke.points.every(Number.isFinite)
  )
    return [];
  return [
    {
      id: typeof stroke.id === 'string' && stroke.id ? stroke.id : newId(),
      tool: stroke.tool,
      color: parseColor(stroke.color, DEFAULT_DRAWING.penColor),
      width: parseWidth(stroke.width, DEFAULT_DRAWING.penWidth),
      points: stroke.points,
    },
  ];
}

export function parseBlankCanvas(value: unknown): BlankCanvas | null {
  const canvas = value as BlankCanvas | null;
  if (canvas?.kind !== 'blank' || !Array.isArray(canvas.items)) {
    return null;
  }
  // Settings added after blank canvases first shipped take their defaults. Only what a
  // canvas holds is kept, each card and stroke checked (a shared board comes from anywhere),
  // and its cards moved onto the board and their size capped to it, as a new shape does.
  return setCardShape(
    {
      kind: 'blank',
      shape: parseShape(canvas.shape),
      background: parseColor(canvas.background, DEFAULT_BACKGROUND),
      border: parseColor(canvas.border, DEFAULT_BORDER),
      items: canvas.items.flatMap((value) => {
        const item = parseCardItem(value);
        const { x, y } = value as Partial<Point>;
        return item && Number.isFinite(x) && Number.isFinite(y) ? [{ ...item, x: x!, y: y! }] : [];
      }),
      cardWidth:
        typeof canvas.cardWidth === 'number'
          ? Math.max(MIN_CARD_WIDTH, Math.min(MAX_CARD_WIDTH, canvas.cardWidth))
          : CARD_WIDTH,
      topHalf: canvas.topHalf === true,
      strokes: Array.isArray(canvas.strokes)
        ? canvas.strokes.flatMap(parseStroke)
        : DEFAULT_DRAWING.strokes,
      penColor: parseColor(canvas.penColor, DEFAULT_DRAWING.penColor),
      penWidth: parseWidth(canvas.penWidth, DEFAULT_DRAWING.penWidth),
      eraserWidth: parseWidth(canvas.eraserWidth, DEFAULT_DRAWING.eraserWidth),
      tray: parseTray(canvas.tray, DEFAULT_TRAY_COLOR),
    },
    {}
  );
}
