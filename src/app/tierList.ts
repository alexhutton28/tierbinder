// The tier list document and its layout. The document is plain JSON (saved to
// localStorage), separate from rendering, so new kinds of boards and
// elements can be added without touching how existing ones are stored.

// One printed card
export type CardFace = {
  name: string;
  set?: string;
  number?: string;
  // Full-size image on its source host; loaded through the image proxy
  image: string;
};

export type CardItem = CardFace & {
  id: string;
  kind: 'card';
  // A split card: the top halves of this card (top) and `split` (bottom)
  split?: CardFace;
};

export function faceOf({ name, set, number, image }: CardFace): CardFace {
  return { name, set, number, image };
}

export type Tier = {
  id: string;
  name: string;
  color: string;
  items: CardItem[];
};

export type TierListDoc = {
  version: 1;
  kind: 'tier-list';
  background: string;
  // Lines between tiers
  border: string;
  // Each card gets an inside stroke in its tier's color
  tierCardBorders: boolean;
  tiers: Tier[];
};

// Design size; exports are EXPORT_SCALE times this
export const BOARD_WIDTH = 1200;
export const BOARD_HEIGHT = 675;
export const EXPORT_SCALE = 2;

export const TIER_COUNT = 4;
export const MAX_CARDS_PER_TIER = 12;

export const CARD_WIDTH = 100;
export const CARD_HEIGHT = 140;
export const DEFAULT_GAP = 25;

export const LABEL_WIDTH = 170;
const CARDS_LEFT = LABEL_WIDTH + 20;
const CARDS_RIGHT_PADDING = 35;
const CARDS_AREA_WIDTH = BOARD_WIDTH - CARDS_LEFT - CARDS_RIGHT_PADDING;
export const TIER_HEIGHT = BOARD_HEIGHT / TIER_COUNT;
export const SEPARATOR_WIDTH = 3;
// Card border (tier-colored, or the board's border color on split cards), drawn inside
// the card's edge; also the width of a split card's divider
export const CARD_BORDER_WIDTH = 3;
// Card images have rounded corners: about 21px on the 460px-wide originals
export const CARD_CORNER_RADIUS = 4.5;

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultDoc(): TierListDoc {
  const tiers: [string, string][] = [
    ['Goated', '#d9532b'],
    ['Solid', '#f0912f'],
    ['Mid', '#f5c95b'],
    ['Fraud', '#7cc05a'],
  ];
  return {
    version: 1,
    kind: 'tier-list',
    background: '#1f3d4b',
    border: '#16303c',
    tierCardBorders: false,
    tiers: tiers.map(([name, color]) => ({ id: newId(), name, color, items: [] })),
  };
}

// Gap between cards in a tier: the default, shrinking (negative overlaps) once the
// cards no longer fit
export function tierGap(count: number) {
  if (count < 2) return DEFAULT_GAP;
  return Math.min(DEFAULT_GAP, (CARDS_AREA_WIDTH - CARD_WIDTH * count) / (count - 1));
}

export type CardPlacement = { item: CardItem; tierIndex: number; x: number; y: number };

export function layoutCards(doc: TierListDoc): CardPlacement[] {
  return doc.tiers.flatMap((tier, tierIndex) => {
    const gap = tierGap(tier.items.length);
    const y = tierIndex * TIER_HEIGHT + (TIER_HEIGHT - CARD_HEIGHT) / 2;
    return tier.items.map((item, i) => ({
      item,
      tierIndex,
      x: CARDS_LEFT + i * (CARD_WIDTH + gap),
      y,
    }));
  });
}

// Where a card dropped with its center at (x, y) lands: the tier under it, before the
// first other card whose center is to its right
export function dropTarget(doc: TierListDoc, draggedId: string, x: number, y: number) {
  const tierIndex = Math.max(0, Math.min(TIER_COUNT - 1, Math.floor(y / TIER_HEIGHT)));
  const others = layoutCards(doc).filter(
    (p) => p.tierIndex === tierIndex && p.item.id !== draggedId
  );
  const index = others.filter((p) => p.x + CARD_WIDTH / 2 < x).length;
  return { tierIndex, index };
}

export function moveCard(doc: TierListDoc, id: string, tierIndex: number, index: number) {
  const item = doc.tiers.flatMap((t) => t.items).find((i) => i.id === id);
  if (!item) return doc;
  const target = doc.tiers[tierIndex];
  if (!target.items.some((i) => i.id === id) && target.items.length >= MAX_CARDS_PER_TIER) {
    return doc;
  }
  const tiers = doc.tiers.map((t) => ({ ...t, items: t.items.filter((i) => i.id !== id) }));
  tiers[tierIndex].items.splice(index, 0, item);
  return { ...doc, tiers };
}

// Adds a new card at a position, or returns null if that tier is full
export function insertCard(doc: TierListDoc, item: CardItem, tierIndex: number, index: number) {
  if (doc.tiers[tierIndex].items.length >= MAX_CARDS_PER_TIER) return null;
  const tiers = doc.tiers.map((t, i) => {
    if (i !== tierIndex) return t;
    const items = [...t.items];
    items.splice(index, 0, item);
    return { ...t, items };
  });
  return { ...doc, tiers };
}

// Accepts a saved document if it has the shape this version expects
export function parseDoc(value: unknown): TierListDoc | null {
  const doc = value as TierListDoc | null;
  if (
    doc?.version !== 1 ||
    doc.kind !== 'tier-list' ||
    !Array.isArray(doc.tiers) ||
    doc.tiers.length !== TIER_COUNT ||
    !doc.tiers.every((t) => typeof t.name === 'string' && Array.isArray(t.items))
  ) {
    return null;
  }
  // Settings added after version 1 shipped take their defaults
  return {
    ...doc,
    border: typeof doc.border === 'string' ? doc.border : defaultDoc().border,
    tierCardBorders: doc.tierCardBorders === true,
  };
}
