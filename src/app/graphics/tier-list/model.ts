// The tier list graphic: its document, layout and edits. Plain JSON, separate from
// rendering (TierListCanvas.tsx).

import { newId, type CardItem } from '../../cards';
import type { ResolvedGroup } from '../../importText';
import { BOARD_HEIGHT, BOARD_WIDTH, CARD_HEIGHT, CARD_WIDTH } from '../../canvas/size';
import { defaultTray, importTrayCards, parseTray, type Tray } from '../../canvas/tray';
import type { CardPlacement } from '../types';

export type Tier = {
  id: string;
  name: string;
  color: string;
  items: CardItem[];
};

export type TierList = {
  kind: 'tier-list';
  background: string;
  // Lines between tiers
  border: string;
  // Each card gets an inside stroke in its tier's color
  tierCardBorders: boolean;
  tiers: Tier[];
  // The card tray under the board (canvas/tray.ts)
  tray: Tray;
};

// A tier list has 1 to 8 tiers. The board keeps its size, so its tiers share its height:
// up to FULL_SIZE_TIERS of them hold full-size cards, and past that the cards shrink with
// the rows.
export const MIN_TIERS = 1;
export const MAX_TIERS = 8;
const FULL_SIZE_TIERS = 4;

export const DEFAULT_GAP = 25;

export const LABEL_WIDTH = 170;
// Between the label and the first card, and between a full row's last card and the
// board's edge
const CARDS_PADDING = 20;
const CARDS_LEFT = LABEL_WIDTH + CARDS_PADDING;
const CARDS_AREA_WIDTH = BOARD_WIDTH - CARDS_LEFT - CARDS_PADDING;
// How much of its width a card under the next still shows, at least: what sets how many
// cards a tier holds
const MIN_CARD_SHOWING = 0.8;
export const SEPARATOR_WIDTH = 3;

// A new tier list's tiers, top to bottom: name and color
export const DEFAULT_TIERS: [string, string][] = [
  ['Goated', '#f0392b'],
  ['Solid', '#f78c1e'],
  ['Mid', '#ffcb2e'],
  ['Fraud', '#3cc65a'],
];
// The colors of tiers added after those: blue, purple, pink, gray
const ADDED_TIER_COLORS = ['#2e9df7', '#8b5cf6', '#f25fa5', '#8a9aa5'];
const TIER_COLORS = [...DEFAULT_TIERS.map(([, color]) => color), ...ADDED_TIER_COLORS];

// What a list with more tiers than a new one's is named, top to bottom: the words only
// go so far, so it switches to letters
const LETTER_TIERS = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

// The name and color a tier has until it's given others, by its place in a list of
// `count` tiers: a new tier list's words, or letters once there are more tiers than those
export function defaultTierStyle(index: number, count: number) {
  const name = count > DEFAULT_TIERS.length ? LETTER_TIERS[index] : DEFAULT_TIERS[index][0];
  return { name, color: TIER_COLORS[index] };
}

// Whether no tier has been named: each still has its place's word or letter
const unnamed = (tiers: Tier[]) =>
  tiers.every((t, i) => t.name === DEFAULT_TIERS[i]?.[0] || t.name === LETTER_TIERS[i]);

// The height each tier takes: the board's, shared evenly
export function tierHeight(list: TierList) {
  return BOARD_HEIGHT / list.tiers.length;
}

// How wide cards are drawn with `count` tiers: full size up to FULL_SIZE_TIERS, then
// shrinking with the rows
export function tierCardWidth(count: number) {
  return CARD_WIDTH * Math.min(1, FULL_SIZE_TIERS / count);
}

// A new tier list's board, in brand colors (design/theme.css; canvas colors can't read
// the CSS variables): Storm 800, with the tray a step darker in Petrel 850 and the lines
// between tiers darker still in Petrel 900
const DEFAULT_BACKGROUND = '#2a4352';
const DEFAULT_TRAY_COLOR = '#232b30';
const DEFAULT_BORDER = '#1b2125';

export function defaultTierList(): TierList {
  return {
    kind: 'tier-list',
    background: DEFAULT_BACKGROUND,
    border: DEFAULT_BORDER,
    tierCardBorders: false,
    tiers: DEFAULT_TIERS.map(([name, color]) => ({ id: newId(), name, color, items: [] })),
    tray: defaultTray(DEFAULT_TRAY_COLOR),
  };
}

// How many cards a tier holds with `count` tiers: as many as fit its row overlapping, each
// still showing MIN_CARD_SHOWING of its width under the next. 12 at full size, more as the
// cards shrink (15 at 5 tiers, 24 at 8).
export function tierCapacity(count: number) {
  const width = tierCardWidth(count);
  return Math.floor((CARDS_AREA_WIDTH - width) / (width * MIN_CARD_SHOWING)) + 1;
}

const fullMessage = (capacity: number) => `That Tier Is Full (${capacity} Cards)`;

// Gap between `count` cards of a width in a tier: the default (in step with the cards'
// size), shrinking (negative overlaps) once the cards no longer fit
export function tierGap(count: number, width = CARD_WIDTH) {
  const gap = (DEFAULT_GAP * width) / CARD_WIDTH;
  if (count < 2) return gap;
  return Math.min(gap, (CARDS_AREA_WIDTH - width * count) / (count - 1));
}

export type TierPlacement = CardPlacement & { tierIndex: number };

export function layoutCards(list: TierList): TierPlacement[] {
  const rowHeight = tierHeight(list);
  const width = tierCardWidth(list.tiers.length);
  const height = (width * CARD_HEIGHT) / CARD_WIDTH;
  return list.tiers.flatMap((tier, tierIndex) => {
    const gap = tierGap(tier.items.length, width);
    const y = tierIndex * rowHeight + (rowHeight - height) / 2;
    return tier.items.map((item, i) => ({
      item,
      tierIndex,
      x: CARDS_LEFT + i * (width + gap),
      y,
      width,
      height,
    }));
  });
}

// The tier at a height on the board
export function tierAt(list: TierList, y: number) {
  return Math.max(0, Math.min(list.tiers.length - 1, Math.floor(y / tierHeight(list))));
}

// Where a card dropped with its center at (x, y) lands: the tier under it, before the
// first other card whose center is to its right
export function dropTarget(list: TierList, draggedId: string, x: number, y: number) {
  const tierIndex = tierAt(list, y);
  const others = layoutCards(list).filter(
    (p) => p.tierIndex === tierIndex && p.item.id !== draggedId
  );
  const index = others.filter((p) => p.x + p.width / 2 < x).length;
  return { tierIndex, index };
}

// Moves a card to a place in a tier, or says that tier is full
export function moveCard(
  list: TierList,
  id: string,
  tierIndex: number,
  index: number
): TierList | { error: string } {
  const item = list.tiers.flatMap((t) => t.items).find((i) => i.id === id);
  if (!item) return list;
  const target = list.tiers[tierIndex];
  const capacity = tierCapacity(list.tiers.length);
  if (!target.items.some((i) => i.id === id) && target.items.length >= capacity) {
    return { error: fullMessage(capacity) };
  }
  const tiers = list.tiers.map((t) => ({ ...t, items: t.items.filter((i) => i.id !== id) }));
  tiers[tierIndex].items.splice(index, 0, item);
  return { ...list, tiers };
}

// Adds a new card at a position, or says the tier is full
export function insertCard(list: TierList, item: CardItem, tierIndex: number, index: number) {
  const capacity = tierCapacity(list.tiers.length);
  if (list.tiers[tierIndex].items.length >= capacity) return { error: fullMessage(capacity) };
  const tiers = list.tiers.map((t, i) => {
    if (i !== tierIndex) return t;
    const items = [...t.items];
    items.splice(index, 0, item);
    return { ...t, items };
  });
  return { ...list, tiers };
}

// A new tier at the foot of the list, in the first of the tiers' colors not in use (or
// its place's, once they all are). While no tier has been named, they all take the names
// of a list that long, so a fifth tier turns Goated, Solid, Mid, Fraud into S, A, B, C, D;
// otherwise the others keep theirs and it's named for its place ("Tier 5", or the next
// number no tier is named for), or takes the first letter not in use if they're all
// letters. A tier given a `name` (an import's) leaves the others be. Null when the list
// is full.
export function addTier(list: TierList, name?: string): TierList | null {
  const count = list.tiers.length + 1;
  if (count > MAX_TIERS) return null;
  const used = new Set(list.tiers.map((t) => t.color.toLowerCase()));
  const color = TIER_COLORS.find((c) => !used.has(c)) ?? TIER_COLORS[count - 1];
  const tier = { id: newId(), color, items: [] };
  if (name === undefined && unnamed(list.tiers)) {
    return {
      ...list,
      tiers: [...list.tiers, { ...tier, name: '' }].map((t, i) => ({
        ...t,
        name: defaultTierStyle(i, count).name,
      })),
    };
  }
  const names = new Set(list.tiers.map((t) => t.name.trim()));
  // Among letters (one was removed), the first letter not in use
  const letter = [...names].every((n) => LETTER_TIERS.includes(n))
    ? LETTER_TIERS.find((l) => !names.has(l))
    : undefined;
  let n = count;
  while (names.has(`Tier ${n}`)) n++;
  return {
    ...list,
    tiers: [...list.tiers, { ...tier, name: name ?? letter ?? `Tier ${n}` }],
  };
}

// Takes a tier away, its cards going to the end of the card tray, as many as fit (which
// turns the tray on): the new list, how many cards moved, and how many were left out.
// Null when it's the only tier.
export function removeTier(list: TierList, index: number) {
  const tier = list.tiers[index];
  if (!tier || list.tiers.length <= MIN_TIERS) return null;
  const { tray } = importTrayCards(list.tray, tier.items);
  const moved = tray.items.length - list.tray.items.length;
  return {
    list: { ...list, tiers: list.tiers.filter((_, i) => i !== index), tray },
    moved,
    left: tier.items.length - moved,
  };
}

// Each import group fills the next tier, after the cards already in it, and renames it
// if the group has a name; groups past the last tier add tiers, up to MAX_TIERS. Cards
// past a tier's limit, and groups past the last tier there's room for, are left out.
export function importCards(list: TierList, groups: ResolvedGroup[]) {
  const errors: string[] = [];
  if (groups.length > MAX_TIERS) {
    errors.push(`Only ${MAX_TIERS} Tiers: The Extra Tiers Were Left Out`);
  }
  for (const group of groups.slice(list.tiers.length)) {
    list = addTier(list, group.name) ?? list;
  }
  const capacity = tierCapacity(list.tiers.length);
  const tiers = list.tiers.map((tier, i) => {
    const imported = groups[i];
    const items = [...tier.items, ...(imported?.items ?? [])];
    const name = imported?.name ?? tier.name;
    // A tier already over (tiers were removed, so its cards grew) keeps what it has
    const room = Math.max(capacity, tier.items.length);
    const left = items.length - room;
    if (left > 0) {
      errors.push(
        `${name}: ${left} ${left === 1 ? 'Card' : 'Cards'} Didn't Fit (${capacity} per Tier)`
      );
    }
    return { ...tier, name, items: items.slice(0, room) };
  });
  return { graphic: { ...list, tiers }, errors };
}

// Accepts a saved tier list if it has the shape this version expects
export function parseTierList(value: unknown): TierList | null {
  const list = value as TierList | null;
  if (
    list?.kind !== 'tier-list' ||
    !Array.isArray(list.tiers) ||
    list.tiers.length < MIN_TIERS ||
    list.tiers.length > MAX_TIERS ||
    !list.tiers.every((t) => typeof t?.name === 'string' && Array.isArray(t.items))
  ) {
    return null;
  }
  // Settings added after tier lists first shipped take their defaults
  return {
    kind: 'tier-list',
    background: list.background,
    border: typeof list.border === 'string' ? list.border : DEFAULT_BORDER,
    tierCardBorders: list.tierCardBorders === true,
    tiers: list.tiers,
    tray: parseTray(list.tray, DEFAULT_TRAY_COLOR),
  };
}
