// The blank canvas graphic: cards placed anywhere on a plain background.

import type { CardItem } from '../../cards';
import { cardBox } from '../../canvas/CardNode';
import { BOARD_HEIGHT, BOARD_WIDTH, CARD_WIDTH } from '../../canvas/size';
import type { CardPlacement, Point } from '../types';

export type BlankCanvas = {
  kind: 'blank';
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

export function defaultBlankCanvas(): BlankCanvas {
  return {
    kind: 'blank',
    background: '#ffffff',
    border: '#16303c',
    cardWidth: CARD_WIDTH,
    topHalf: false,
    items: [],
    ...DEFAULT_DRAWING,
  };
}

const boxOf = (canvas: BlankCanvas, item: CardItem) =>
  cardBox(item, canvas.cardWidth, canvas.topHalf);

// Keeps a card's top-left corner where the whole card is on the board
function clamp(canvas: BlankCanvas, item: CardItem, x: number, y: number): Point {
  const box = boxOf(canvas, item);
  return {
    x: Math.round(Math.max(0, Math.min(BOARD_WIDTH - box.width, x))),
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
    Math.floor((BOARD_WIDTH - GRID_LEFT - 20 + GAP_X) / (box.width + GAP_X))
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

// Changes the card size or top-half setting, moving cards that would now hang off the
// board back onto it
export function setCardShape(
  canvas: BlankCanvas,
  change: Partial<Pick<BlankCanvas, 'cardWidth' | 'topHalf'>>
): BlankCanvas {
  const next = { ...canvas, ...change };
  return { ...next, items: next.items.map((i) => ({ ...i, ...clamp(next, i, i.x, i.y) })) };
}

export function parseBlankCanvas(value: unknown): BlankCanvas | null {
  const canvas = value as BlankCanvas | null;
  if (
    canvas?.kind !== 'blank' ||
    typeof canvas.background !== 'string' ||
    typeof canvas.border !== 'string' ||
    !Array.isArray(canvas.items) ||
    !canvas.items.every((i) => typeof i.x === 'number' && typeof i.y === 'number')
  ) {
    return null;
  }
  // Settings added after blank canvases first shipped take their defaults
  return {
    ...canvas,
    cardWidth:
      typeof canvas.cardWidth === 'number'
        ? Math.max(MIN_CARD_WIDTH, Math.min(MAX_CARD_WIDTH, canvas.cardWidth))
        : CARD_WIDTH,
    topHalf: canvas.topHalf === true,
    strokes: Array.isArray(canvas.strokes)
      ? canvas.strokes.filter((s) => Array.isArray(s?.points))
      : DEFAULT_DRAWING.strokes,
    penColor: typeof canvas.penColor === 'string' ? canvas.penColor : DEFAULT_DRAWING.penColor,
    penWidth: typeof canvas.penWidth === 'number' ? canvas.penWidth : DEFAULT_DRAWING.penWidth,
    eraserWidth:
      typeof canvas.eraserWidth === 'number' ? canvas.eraserWidth : DEFAULT_DRAWING.eraserWidth,
  };
}
