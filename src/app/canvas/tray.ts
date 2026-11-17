// The card tray: a holding area under the board, shared by every graphic and saved with
// each one (`tray` in its document). It takes cards like a tier does, up to MAX_TRAY_CARDS:
// one row at full size, then a little smaller, then a second row; it's as tall as its cards
// and its padding (trayHeight). Plain
// JSON, separate from rendering (CardTray.tsx); the editor draws it and moves cards in
// and out.

import { parseCardItem, type CardItem } from '../cards';
import type { CardPlacement, Point } from '../graphics/types';
import { CARD_HEIGHT, CARD_WIDTH } from './size';
import { parseColor } from '../color';

export type Tray = {
  // Shown under the board; cards stay in it while it's off
  enabled: boolean;
  color: string;
  items: CardItem[];
};

export const MAX_TRAY_CARDS = 48;

// Around the cards, in design pixels: a row of full-size cards makes it about as tall as
// a tier
const TRAY_PADDING = 15;
// Between cards, as a share of a card's width
const GAP_SHARE = 0.1;
// How far cards shrink to stay in one row, as a share of full size, before a second row
// starts at that size
const MIN_ROW_SHARE = 0.75;
const MAX_ROWS = 2;
// The tray's width in design pixels: a 16:9 board's, whatever the board's shape, which
// is centered over it. Only in the image, when it's included under a narrower board, is
// it the board's width, its cards smaller to fit the same two rows.
export const TRAY_WIDTH = 1200;
// On-screen pixels, whatever the board's scale: the gap above it (the board's space-4)
// and its corners (radius-medium). In exports it sits flush under the board, square.
export const TRAY_GAP = 16;
export const TRAY_RADIUS = 8;
// The empty tray's hint, in on-screen pixels: text-body
export const TRAY_HINT_SIZE = 14;
export const TRAY_HINT = 'Send Cards to Card Tray to Hold Them';

export function defaultTray(color: string): Tray {
  return { enabled: false, color, items: [] };
}

// A saved tray, or a new one in `color` for a graphic saved before trays
export function parseTray(value: unknown, color: string): Tray {
  const tray = value as Tray | null | undefined;
  if (!tray || !Array.isArray(tray.items)) return defaultTray(color);
  return {
    enabled: tray.enabled === true,
    color: parseColor(tray.color, color),
    items: tray.items
      .map(parseCardItem)
      .filter((item) => item !== null)
      .slice(0, MAX_TRAY_CARDS),
  };
}

// A tray on phones and tablets is one row of cards this wide (design pixels), scrolling
// sideways; false, it's the grid of up to two rows
export type OneRow = false | number;

// The widest cards that fit `columns` to a row `inner` wide
const widthFor = (columns: number, inner: number) =>
  Math.min(CARD_WIDTH, inner / (columns + (columns - 1) * GAP_SHARE));
// How many cards of a width fit in that row
const columnsAt = (width: number, inner: number) =>
  Math.max(1, Math.floor((inner + width * GAP_SHARE) / (width * (1 + GAP_SHARE))));

// The grid for `count` cards, filling each row left to right before the next: up to 10 at
// full size in one row; then shrinking to fit it, down to MIN_ROW_SHARE (14 cards); then a
// second row at that size (up to 28); then both rows shrinking to fit (48 are two rows of
// 24, about 45% of full size).
// That's at TRAY_WIDTH; a narrower tray (`trayWidth`, in the image) holds fewer to a row,
// so its cards shrink sooner. `oneRow` (phones and tablets, on screen only): every card in
// one row at that width, however long, the tray scrolling sideways (trayRowWidth).
function grid(count: number, trayWidth: number, oneRow: OneRow = false) {
  if (oneRow) {
    const width = oneRow;
    return {
      columns: Math.max(1, count),
      rows: 1,
      width,
      height: (width * CARD_HEIGHT) / CARD_WIDTH,
      gap: width * GAP_SHARE,
    };
  }
  const inner = trayWidth - 2 * TRAY_PADDING;
  const minWidth = CARD_WIDTH * MIN_ROW_SHARE;
  let columns = Math.max(1, count);
  let width = widthFor(columns, inner);
  if (width < minWidth) {
    columns = columnsAt(minWidth, inner);
    width = minWidth;
    if (count > MAX_ROWS * columns) {
      columns = Math.ceil(count / MAX_ROWS);
      width = widthFor(columns, inner);
    }
  }
  const rows = Math.max(1, Math.ceil(count / columns));
  const height = (width * CARD_HEIGHT) / CARD_WIDTH;
  const gap = width * GAP_SHARE;
  return { columns, rows, width, height, gap };
}

// The tray's height in design pixels with `count` cards: its rows and padding, rounded
// to whole pixels so exports are (the padding below the cards takes the difference).
// Empty, it's as tall as a row of full-size cards.
export function trayHeight(count: number, trayWidth = TRAY_WIDTH, oneRow: OneRow = false) {
  const { rows, height, gap } = grid(count, trayWidth, oneRow);
  return Math.round(2 * TRAY_PADDING + rows * height + (rows - 1) * gap);
}

// The width the tray's cards are drawn at when it holds `count`
export function trayCardWidth(count: number, trayWidth = TRAY_WIDTH, oneRow: OneRow = false) {
  return grid(count, trayWidth, oneRow).width;
}

// How far a one-row tray's cards reach, padding included: wider than the tray once they
// don't fit, when it scrolls sideways by the difference
export function trayRowWidth(count: number, cardWidth: number) {
  const { width, gap } = grid(count, TRAY_WIDTH, cardWidth);
  return 2 * TRAY_PADDING + count * width + Math.max(0, count - 1) * gap;
}

// Every card in the tray, its top-left corner measured from the tray's
export function layoutTray(
  tray: Tray,
  trayWidth = TRAY_WIDTH,
  oneRow: OneRow = false
): CardPlacement[] {
  const { columns, width, height, gap } = grid(tray.items.length, trayWidth, oneRow);
  return tray.items.map((item, i) => ({
    item,
    x: TRAY_PADDING + (i % columns) * (width + gap),
    y: TRAY_PADDING + Math.floor(i / columns) * (height + gap),
    width,
    height,
  }));
}

// Where a card dropped with its center at `point` (from the tray's corner) goes: in the row
// it's nearest, before the first other card whose center is to its right
export function trayDropIndex(
  tray: Tray,
  draggedId: string,
  point: Point,
  trayWidth = TRAY_WIDTH,
  oneRow: OneRow = false
) {
  const placements = layoutTray(tray, trayWidth, oneRow);
  if (!placements.length) return 0;
  // Above the first row or below the last counts as in it, so only x decides there
  const first = placements[0];
  const last = placements[placements.length - 1];
  const y = Math.max(first.y, Math.min(last.y + last.height, point.y));
  return placements
    .filter((p) => p.item.id !== draggedId)
    .filter((p) => p.y + p.height < y || (p.y <= y && p.x + p.width / 2 < point.x)).length;
}

// Adds a card at a position (the end by default), or says the tray is full
export function insertTrayCard(tray: Tray, item: CardItem, index = tray.items.length) {
  if (tray.items.length >= MAX_TRAY_CARDS) {
    return { error: `The Card Tray Is Full (${MAX_TRAY_CARDS} Cards)` };
  }
  const items = [...tray.items];
  items.splice(index, 0, item);
  return { ...tray, items };
}

// Bulk import: every group's cards at the end, in order, as many as fit. Adding any turns the
// tray on.
export function importTrayCards(tray: Tray, items: CardItem[]) {
  const room = Math.max(MAX_TRAY_CARDS - tray.items.length, 0);
  const left = items.length - room;
  const errors =
    left > 0
      ? [`${left} ${left === 1 ? 'Card' : 'Cards'} Didn't Fit (${MAX_TRAY_CARDS} in the Card Tray)`]
      : [];
  const added = items.slice(0, room);
  return {
    tray: added.length ? { ...tray, enabled: true, items: [...tray.items, ...added] } : tray,
    errors,
  };
}

export function moveTrayCard(tray: Tray, id: string, index: number): Tray {
  const item = tray.items.find((i) => i.id === id);
  if (!item) return tray;
  const items = tray.items.filter((i) => i.id !== id);
  items.splice(index, 0, item);
  return { ...tray, items };
}

export function mapTray(tray: Tray, change: (item: CardItem) => CardItem | null): Tray {
  return { ...tray, items: tray.items.flatMap((i) => change(i) ?? []) };
}
