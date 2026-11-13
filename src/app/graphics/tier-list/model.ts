// The tier list graphic: its document, layout and edits. Plain JSON, separate from
// rendering (TierListCanvas.tsx).

import { newId, type CardItem } from '../../cards';
import type { ResolvedGroup } from '../../importText';
import { BOARD_HEIGHT, BOARD_WIDTH, CARD_HEIGHT, CARD_WIDTH } from '../../canvas/size';
import { defaultTray, parseTray, type Tray } from '../../canvas/tray';
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

export const TIER_COUNT = 4;
export const MAX_CARDS_PER_TIER = 12;

export const DEFAULT_GAP = 25;

export const LABEL_WIDTH = 170;
const CARDS_LEFT = LABEL_WIDTH + 20;
const CARDS_RIGHT_PADDING = 35;
const CARDS_AREA_WIDTH = BOARD_WIDTH - CARDS_LEFT - CARDS_RIGHT_PADDING;
export const TIER_HEIGHT = BOARD_HEIGHT / TIER_COUNT;
export const SEPARATOR_WIDTH = 3;

// A new tier list's tiers, top to bottom: name and color
export const DEFAULT_TIERS: [string, string][] = [
  ['Goated', '#f0392b'],
  ['Solid', '#f78c1e'],
  ['Mid', '#ffcb2e'],
  ['Fraud', '#3cc65a'],
];

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

// Gap between cards in a tier: the default, shrinking (negative overlaps) once the
// cards no longer fit
export function tierGap(count: number) {
  if (count < 2) return DEFAULT_GAP;
  return Math.min(DEFAULT_GAP, (CARDS_AREA_WIDTH - CARD_WIDTH * count) / (count - 1));
}

export type TierPlacement = CardPlacement & { tierIndex: number };

export function layoutCards(list: TierList): TierPlacement[] {
  return list.tiers.flatMap((tier, tierIndex) => {
    const gap = tierGap(tier.items.length);
    const y = tierIndex * TIER_HEIGHT + (TIER_HEIGHT - CARD_HEIGHT) / 2;
    return tier.items.map((item, i) => ({
      item,
      tierIndex,
      x: CARDS_LEFT + i * (CARD_WIDTH + gap),
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    }));
  });
}

// The tier at a height on the board
export function tierAt(y: number) {
  return Math.max(0, Math.min(TIER_COUNT - 1, Math.floor(y / TIER_HEIGHT)));
}

// Where a card dropped with its center at (x, y) lands: the tier under it, before the
// first other card whose center is to its right
export function dropTarget(list: TierList, draggedId: string, x: number, y: number) {
  const tierIndex = tierAt(y);
  const others = layoutCards(list).filter(
    (p) => p.tierIndex === tierIndex && p.item.id !== draggedId
  );
  const index = others.filter((p) => p.x + CARD_WIDTH / 2 < x).length;
  return { tierIndex, index };
}

export function moveCard(list: TierList, id: string, tierIndex: number, index: number) {
  const item = list.tiers.flatMap((t) => t.items).find((i) => i.id === id);
  if (!item) return list;
  const target = list.tiers[tierIndex];
  if (!target.items.some((i) => i.id === id) && target.items.length >= MAX_CARDS_PER_TIER) {
    return list;
  }
  const tiers = list.tiers.map((t) => ({ ...t, items: t.items.filter((i) => i.id !== id) }));
  tiers[tierIndex].items.splice(index, 0, item);
  return { ...list, tiers };
}

// Adds a new card at a position, or says the tier is full
export function insertCard(list: TierList, item: CardItem, tierIndex: number, index: number) {
  if (list.tiers[tierIndex].items.length >= MAX_CARDS_PER_TIER) {
    return { error: `That Tier Is Full (${MAX_CARDS_PER_TIER} Cards)` };
  }
  const tiers = list.tiers.map((t, i) => {
    if (i !== tierIndex) return t;
    const items = [...t.items];
    items.splice(index, 0, item);
    return { ...t, items };
  });
  return { ...list, tiers };
}

// Each import group fills the next tier, after the cards already in it, and renames it
// if the group has a name. Cards past a tier's limit, and groups past the last tier, are
// left out.
export function importCards(list: TierList, groups: ResolvedGroup[]) {
  const errors: string[] = [];
  if (groups.length > TIER_COUNT) {
    errors.push(`Only ${TIER_COUNT} Tiers: The Extra Tiers Were Left Out`);
  }
  const tiers = list.tiers.map((tier, i) => {
    const imported = groups[i];
    const items = [...tier.items, ...(imported?.items ?? [])];
    const name = imported?.name ?? tier.name;
    const left = items.length - MAX_CARDS_PER_TIER;
    if (left > 0) {
      errors.push(
        `${name}: ${left} ${left === 1 ? 'Card' : 'Cards'} Didn't Fit (${MAX_CARDS_PER_TIER} per Tier)`
      );
    }
    return { ...tier, name, items: items.slice(0, MAX_CARDS_PER_TIER) };
  });
  return { graphic: { ...list, tiers }, errors };
}

// Accepts a saved tier list if it has the shape this version expects
export function parseTierList(value: unknown): TierList | null {
  const list = value as TierList | null;
  if (
    list?.kind !== 'tier-list' ||
    !Array.isArray(list.tiers) ||
    list.tiers.length !== TIER_COUNT ||
    !list.tiers.every((t) => typeof t.name === 'string' && Array.isArray(t.items))
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
