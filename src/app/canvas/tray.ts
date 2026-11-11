// The card tray: a holding area under the board, shared by every graphic and saved with
// each one (`tray` in its document). It takes cards like a tier does, up to MAX_TRAY_CARDS:
// one row at full size, then smaller cards, then two rows, so it never gets taller. Plain
// JSON, separate from rendering (CardTray.tsx); the editor draws it and moves cards in
// and out.

import type { CardItem } from '../cards';
import type { CardPlacement, Point } from '../graphics/types';
import { BOARD_WIDTH, CARD_HEIGHT, CARD_WIDTH } from './size';

export type Tray = {
  // Shown under the board (from b8 up); cards stay in it while it's off
  enabled: boolean;
  color: string;
  items: CardItem[];
};

export const MAX_TRAY_CARDS = 48;

// Its height in design pixels, as tall as a tier with full-size cards
export const TRAY_PADDING = 15;
export const TRAY_HEIGHT = CARD_HEIGHT + 2 * TRAY_PADDING;
// Between cards, as a share of a card's width
const GAP_SHARE = 0.1;
// On-screen pixels, whatever the board's scale: the gap above it (the board's space-4)
// and its corners (radius-medium). In exports it sits flush under the board, square.
export const TRAY_GAP = 16;
export const TRAY_RADIUS = 8;

export function defaultTray(color: string): Tray {
  return { enabled: false, color, items: [] };
}

// A saved tray, or a new one in `color` for a graphic saved before trays
export function parseTray(value: unknown, color: string): Tray {
  const tray = value as Tray | null | undefined;
  if (!tray || !Array.isArray(tray.items)) return defaultTray(color);
  return {
    enabled: tray.enabled === true,
    color: typeof tray.color === 'string' ? tray.color : color,
    items: tray.items.slice(0, MAX_TRAY_CARDS),
  };
}

// The grid for `count` cards: as many rows as give the biggest cards, each row as full as
// the others. Up to 10 cards are full size in one row; past that they shrink to fit it,
// until 2 rows hold bigger ones (past 22); 48 are 2 rows of 24, about 45% of full size.
const ROW_CHOICES = [1, 2, 3];
function grid(count: number) {
  const ratio = CARD_WIDTH / CARD_HEIGHT;
  const inner = TRAY_HEIGHT - 2 * TRAY_PADDING;
  const sizes = ROW_CHOICES.map((rows) => {
    const columns = Math.max(1, Math.ceil(count / rows));
    // rows × height + (rows - 1) gaps fill the height, with gap = width × GAP_SHARE; the
    // same across the width
    const byHeight = (inner / (rows + (rows - 1) * GAP_SHARE * ratio)) * ratio;
    const byWidth = (BOARD_WIDTH - 2 * TRAY_PADDING) / (columns + (columns - 1) * GAP_SHARE);
    return { rows, columns, width: Math.min(CARD_WIDTH, byHeight, byWidth) };
  });
  const best = sizes.reduce((a, b) => (b.width > a.width ? b : a));
  const height = best.width / ratio;
  const gap = best.width * GAP_SHARE;
  const rows = Math.max(1, Math.ceil(count / best.columns));
  // Centered top to bottom when the cards don't fill the height
  const top = (TRAY_HEIGHT - rows * height - (rows - 1) * gap) / 2;
  return { ...best, height, gap, top };
}

// Every card in the tray, its top-left corner measured from the tray's
export function layoutTray(tray: Tray): CardPlacement[] {
  const { columns, width, height, gap, top } = grid(tray.items.length);
  return tray.items.map((item, i) => ({
    item,
    x: TRAY_PADDING + (i % columns) * (width + gap),
    y: top + Math.floor(i / columns) * (height + gap),
    width,
    height,
  }));
}

// Where a card dropped with its center at `point` (from the tray's corner) goes: in the row
// it's nearest, before the first other card whose center is to its right
export function trayDropIndex(tray: Tray, draggedId: string, point: Point) {
  const placements = layoutTray(tray);
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
    return { error: `The card tray is full (${MAX_TRAY_CARDS} cards).` };
  }
  const items = [...tray.items];
  items.splice(index, 0, item);
  return { ...tray, items };
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
