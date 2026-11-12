import type React from 'react';
import type { CardItem } from '../cards';
import type { ResolvedGroup } from '../importText';

// The interface every graphic type implements. The editor (Editor.tsx) owns everything
// graphics share: the stage and its scaling, export, autosave, card search and dragging,
// the card menu, selection, bulk import lookups, Clear board and Change board type, and
// which tool is active. A graphic type owns its document, how it draws, its settings, its
// tools, and where cards go.

// A point in the board's design pixels
export type Point = { x: number; y: number };

// A card, its top-left corner and the box it takes (see cardBox in canvas/CardNode), in
// drawing order (later cards on top)
export type CardPlacement = { item: CardItem; x: number; y: number; width: number; height: number };

// A card placed by the editor: the changed graphic, or why it couldn't go there
export type Placed<G> = G | { error: string };

export type CanvasProps<G> = {
  graphic: G;
  // Inter Black once it's loaded, for canvas text
  fontFamily: string;
  onChange: (graphic: G) => void;
  onSelect: (id: string | null) => void;
  // A card was clicked without dragging; x, y are in the stage's on-screen pixels
  onCardMenu: (id: string, x: number, y: number) => void;
  // A card was dragged and dropped with its top-left corner at x, y (design pixels). True
  // if the editor took it (dropped in the card tray, under the board), in which case the
  // graphic leaves it be; otherwise the graphic moves it.
  onCardDrop: (id: string, x: number, y: number) => boolean;
  // The width a dragged card shows at with its center at `center`: the board's, or over
  // the card tray, the tray's (for CardNode's dragWidth)
  cardDragWidth: (center: Point) => number;
  // One of `targets` was clicked, making it where the next search result goes
  onPickTarget: (index: number) => void;
  // Opens the Customize tab and focuses one of the graphic's settings (its own key)
  onEditSetting: (key: string) => void;
  // The active tool, one of the graphic's own (see Toolbar); DEFAULT_TOOL moves cards
  tool: string;
};

// The tool every board starts with: moving and clicking cards
export const DEFAULT_TOOL = 'move';

export type ToolbarProps<G> = {
  graphic: G;
  onChange: (change: (graphic: G) => G) => void;
  tool: string;
  onTool: (tool: string) => void;
};

export type SettingsProps<G> = {
  graphic: G;
  onChange: (change: (graphic: G) => G) => void;
  // The setting asked for through onEditSetting; `n` changes with every request
  focus: { key: string; n: number } | null;
};

export type GraphicType<G extends { kind: string }> = {
  kind: G['kind'];
  // In Change board type
  label: string;
  // What cards are added to, as in "Add to tier"
  targetNoun: string;
  create: () => G;
  // A saved graphic of this kind, with settings added later filled in; null if it doesn't
  // have the shape this version expects
  parse: (value: unknown) => G | null;
  // Konva layers, drawn inside the editor's stage. Cards should use canvas/CardNode.
  Canvas: React.ComponentType<CanvasProps<G>>;
  // The graphic's part of the Customize tab
  Settings: React.ComponentType<SettingsProps<G>>;
  // Tools beyond moving cards (e.g. a pen), shown under the board; the Canvas gets the
  // active one as `tool`
  Toolbar?: React.ComponentType<ToolbarProps<G>>;
  // The width cards are drawn at on the board, if not CARD_WIDTH (a card dragged out of
  // the card tray grows to it)
  cardWidth?: (graphic: G) => number;
  // Every card and where it's drawn
  layout: (graphic: G) => CardPlacement[];
  // Changes cards, or removes them (null)
  mapCards: (graphic: G, change: (item: CardItem) => CardItem | null) => G;
  // Where a search result can be added (the Add to choices), e.g. the tiers, each with
  // a color for its swatch in the picker if it has one
  targets: (graphic: G) => { name: string; color?: string }[];
  addCard: (graphic: G, item: CardItem, target: number) => Placed<G>;
  // Adds a card dropped with the pointer at `point`
  dropCard: (graphic: G, item: CardItem, point: Point) => Placed<G>;
  // Adds bulk-imported cards, given the import's `#` groups
  // Where import's cards before the first `#` go: the card tray (a tier list, where groups
  // are tiers), or the board as one more group in front (the blank canvas, where groups
  // mean nothing)
  ungroupedImport: 'tray' | 'board';
  importCards: (graphic: G, groups: ResolvedGroup[]) => { graphic: G; errors: string[] };
};
