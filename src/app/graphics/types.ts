import type React from 'react';
import type { CardItem } from '../cards';
import type { ShapeId } from '../canvas/size';
import type { ResolvedGroup } from '../importText';
import type { Direction } from '../canvas/keyboard';

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
  // Cards not drawn yet: copies of them are flying in from the sidebar (CardNode's `hidden`)
  arriving: ReadonlySet<string>;
  // One of `targets` was clicked, making it where the next search result goes (and moving
  // the selected card there, through `moveCardTo`)
  // `emptySpace`: pressed on nothing but the board (a tier's empty space), not a label,
  // which only picks the target
  onPickTarget: (index: number, emptySpace: boolean) => void;
  // The selected card, drawn last (over the others: `selectedLast`)
  selectedId: string | null;
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
  // Shows a toast. `undo` (it ends in an Undo button) only together with the change to
  // the graphic it reports, in the same handler.
  onNotify: (message: string, options?: { undo?: boolean }) => void;
};

export type GraphicType<G extends { kind: string }> = {
  kind: G['kind'];
  // In the board type dropdown, with its icon (a 16px SVG in public/, drawn in the text
  // color)
  label: string;
  icon: string;
  // What cards are added to, as in "Add to tier"
  targetNoun: string;
  create: () => G;
  // A saved graphic of this kind, with settings added later filled in; null if it doesn't
  // have the shape this version expects
  parse: (value: unknown) => G | null;
  // Konva layers, drawn inside the editor's stage. Cards should use canvas/CardNode.
  Canvas: React.ComponentType<CanvasProps<G>>;
  // The graphic's rows in the Customize tab's Style section, after its own sections: how
  // the board looks (its sizes, colors and borders)
  BoardSettings: React.ComponentType<SettingsProps<G>>;
  // The graphic's own sections of the Customize tab, after Board: each a
  // `flex flex-col gap-3` div with its heading first, controls before toggles
  Settings: React.ComponentType<SettingsProps<G>>;
  // Tools beyond moving cards (e.g. a pen), shown under the board; the Canvas gets the
  // active one as `tool`
  Toolbar?: React.ComponentType<ToolbarProps<G>>;
  // The tools' own settings saved with the board (the pen's color), which undo leaves be
  toolSettings?: (keyof G)[];
  // The width cards are drawn at on the board, if not CARD_WIDTH (a card dragged out of
  // the card tray grows to it)
  cardWidth?: (graphic: G) => number;
  // Every card and where it's drawn
  layout: (graphic: G) => CardPlacement[];
  // What's on the board for screen readers (the canvas is one image to them): its places
  // in order, each with its cards, and `note` for anything else there (ink)
  describe: (graphic: G) => { name: string; items: CardItem[]; note?: string }[];
  // Changes cards, or removes them (null)
  mapCards: (graphic: G, change: (item: CardItem) => CardItem | null) => G;
  // Whether anything's on the board (cards, ink), and the board with all of it gone, its
  // styles (names, colors, card size) kept: Clear Board
  hasContents: (graphic: G) => boolean;
  clear: (graphic: G) => G;
  // The board with a new one's styles (names, colors, card size, the card tray's color),
  // everything on it, its tools and the card tray's cards kept: Reset Board Styles
  restyle: (graphic: G) => G;
  // The board in another shape (its `shape`, which sets its width: canvas/size.ts),
  // everything on it kept and still on the board
  reshape: (graphic: G, shape: ShapeId) => G;
  // Where a search result can be added (the Add to choices), e.g. the tiers, each with
  // a color for its swatch in the picker if it has one, and an `id` if targets can come
  // and go (a tier list's tiers), so the chosen one stays chosen as the others change
  targets: (graphic: G) => { id?: string; name: string; color?: string }[];
  addCard: (graphic: G, item: CardItem, target: number) => Placed<G>;
  // Moves a card on the board to the end of a target: a tier clicked while the card is
  // selected. Without it (the blank canvas, whose targets have no place), clicking does
  // nothing more than pick the target.
  moveCardTo?: (graphic: G, id: string, target: number) => G;
  // Moves a card on the board a step from the keyboard (Alt+arrows; `small` with Shift, for
  // a finer step where cards are placed freely), the graphic as it was where it can't go
  // further, or null for down past the board's foot, where the editor takes it into the
  // card tray
  nudgeCard: (graphic: G, id: string, direction: Direction, small: boolean) => G | null;
  // Adds a card dropped with the pointer at `point`
  dropCard: (graphic: G, item: CardItem, point: Point) => Placed<G>;
  // Where import's cards before the first `#` go: the card tray (a tier list, where groups
  // are tiers), or the board as one more group in front (the blank canvas, where groups
  // mean nothing)
  ungroupedImport: 'tray' | 'board';
  // Adds bulk-imported cards, given the import's `#` groups
  importCards: (graphic: G, groups: ResolvedGroup[]) => { graphic: G; errors: string[] };
};

// Cards in drawing order with the selected one moved last, so it's drawn over cards that
// overlap it (a crowded tier). Only the drawing order: the graphic's own order is kept.
export function selectedLast<T extends { item: { id: string } }>(cards: T[], id: string | null) {
  const at = id === null ? -1 : cards.findIndex((c) => c.item.id === id);
  return at < 0 ? cards : [...cards.slice(0, at), ...cards.slice(at + 1), cards[at]];
}
