'use client';

import type Konva from 'konva';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { flushSync } from 'react-dom';
import { Group, Layer, Rect, Stage } from 'react-konva';
import {
  BOARD_HEIGHT,
  SHAPES,
  boardWidth,
  exportScale,
  exportSize,
  CARD_CORNER_RADIUS,
  CARD_HEIGHT,
  CARD_WIDTH,
} from './canvas/size';
import {
  faceOf,
  loadImage,
  mapLimit,
  proxied,
  resolveCard,
  searchCards,
  toFace,
  toItem,
  type CardFace,
  type CardItem,
  type CardResult,
} from './cards';
import CardTray from './canvas/CardTray';
import {
  MAX_TRAY_CARDS,
  TRAY_GAP,
  importTrayCards,
  insertTrayCard,
  layoutTray,
  trayRowWidth,
  rowCardWidthFor,
  mapTray,
  TRAY_WIDTH,
  trayCardWidth,
  trayHeight,
  moveTrayCard,
  trayDropIndex,
  type Tray,
} from './canvas/tray';
import { currentGraphic, newDoc, parseSaved, type TierBinderDoc } from './document';
import { GRAPHIC_TYPES, typeOf, type Graphic, type GraphicKind } from './graphics';
import { DEFAULT_TIERS } from './graphics/tier-list/model';
import { DEFAULT_TOOL, selectedLast, type Placed, type Point } from './graphics/types';
import { parseImport } from './importText';
import { MAX_SHARED_CARDS, isShareHash, readShareHash, shareLink, sharedCards } from './share';
import { DEFAULT_SEARCH, sortDirection as sortLabel, type SearchOptions } from './searchOptions';
import Button from './ui/Button';
import Segmented from './ui/Segmented';
import ClearButton, { type ClearChoice } from './ui/ClearButton';
import { TOUCH_SLOP } from './ui/pointer';
import { followOpen, revealBelow } from './ui/reveal';
import { useReveal } from './ui/useReveal';
import Toggle from './ui/Toggle';
import ColorField from './ui/ColorField';
import Dropdown, { Swatch } from './ui/Dropdown';
import RadioBar from './ui/RadioBar';
import SearchFilters from './ui/SearchFilters';
import Credits from './ui/Credits';
import SidebarHandle from './ui/SidebarHandle';
import styles from './Editor.module.css';
import { FOLD_CLEARANCE, readDuration } from './ui/motion';
import { launchFlights, onScreen, wholeOnScreen, type Flight } from './ui/flights';
import { titleCase, cardCount } from './text';

// The editor: the board, drawn by the document's graphic type (see graphics/types.ts), plus
// the top bar and sidebar shared by every graphic.

const STORAGE_KEY = 'tierbinder-doc';
// The most characters a Discord message holds: a longer share link gets a note that it won't
// fit in one
const DISCORD_MESSAGE_LIMIT = 2000;

// The Add to picker's swatch while a split card is being made: a white card
const SPLIT_SWATCH = '#ffffff';

// How long a toast stays before it fades (ms), and how much longer for each line past the
// first (an import's list of cards it couldn't find), so there's time to read them
const TOAST_DURATION = 5000;
const TOAST_LINE_DURATION = 1500;
// An import's toast lists at most this many problems, then how many more there were
const MAX_TOAST_PROBLEMS = 4;

// sessionStorage: the card tray's hint has done its job (a card has been in a tray)
const TRAY_HINT_KEY = 'tierbinder-tray-hint-seen';

// The selection outline, drawn just outside the card (canvas values; see Exceptions in
// design/hutton-design-system.md)
const OUTLINE = { width: 3, radius: 8, color: '#ffffff' };
// Added to the image's size in pixels when asking Konva for it, which cuts the size to a
// whole number: half a pixel, so a float just under the size still gives it
const EXPORT_MARGIN = 0.5;

// Changes every card on a graphic, on the board and in the card tray (null removes it)
function mapEveryCard(g: Graphic, change: (item: CardItem) => CardItem | null): Graphic {
  return { ...typeOf(g.kind).mapCards(g, change), tray: mapTray(g.tray, change) } as Graphic;
}

// A graphic with a changed tray, or why the tray couldn't take the card. A card added to
// the tray turns it on, if it was off.
function withTray(g: Graphic, tray: Tray | { error: string }): Placed<Graphic> {
  return 'error' in tray ? tray : ({ ...g, tray: { ...tray, enabled: true } } as Graphic);
}

// What clicking a featured pool does, as its label (with its icon, by `data-action` in
// Editor.module.css) and its accessible name says: list its set, add its cards to the tray, or take them back out
const POOL_ACTIONS = {
  filter: { label: 'Filter', aria: 'filter search to this set' },
  add: { label: 'Add to Card Tray', aria: 'add to card tray' },
  remove: { label: 'Remove From Card Tray', aria: 'remove from card tray' },
} as const;

// The toast for cards taken out of the card tray (Clear Card Tray, or a pool clicked again)
const removedMessage = (n: number) => `Removed ${cardCount(n)} From the Card Tray`;

// Presentation mode's card menu row that moves the card (shown as "Move to Tier", or "Add
// to Tier" for a tray card: moveLabel), opening a flyout of the places it can go
const MOVE_TO = 'Move to';
// The card menu's id while it's the card tray's own menu (Clear Card Tray), not a card's
const TRAY_MENU = 'tray';

// The card menu's narrowest width; it opens left of the pointer when this wouldn't fit
// inside the board's right edge
const MENU_WIDTH = 160;

// A touch press held this long (ms) opens a search result's menu, unless it moves more
// than TOUCH_SLOP (px, ui/pointer.ts) first, as long presses go on phones
const LONG_PRESS = 500;

// Under b8 the board and the card tray stay on screen above the sidebar, which scrolls on
// its own: they take at most this share of the page's height (top bar included), leaving
// the rest to the sidebar, so a tall shape (9:16) or a landscape phone still has room for it
const BOARD_SHARE = 0.6;

// The search's sort button (newest or oldest first), hidden for now to keep the search row
// clear on phones; results stay newest first
const SORT_BUTTON = false;

// How far popups stay inside the window's edges (space-3, as ui/anchored.ts's --edge)
const EDGE = 8;

// A search result's menu: which card, where it opened, and the result's tile
type ResultMenu = {
  card: CardResult;
  x: number;
  y: number;
  tile: HTMLElement;
  // The results it was opened on
  of: CardResult[];
};

// The light binder mark shown where the top bar's logo was while the sidebar is hidden
// (cut from tierbinder-combined-light.svg, drawn at 137×28), at the top bar logo's height
// (25px), so it lands where the top bar's mark was; shown when it has this room around it
// beside the board (space-3)
const LOGO_HEIGHT = 25;
// Under b8, with the sidebar folded, the one-row card tray's cards are this many times
// full size (the board gives up a little height for them)
const FOLDED_TRAY_SCALE = 1.3;
// ...and bigger still where the board can't use the height (a Wide board, limited by the
// page's width): filling what's left under it, but never so big that fewer than this many
// show across the tray
const FOLDED_TRAY_VISIBLE = 3;
// ...and never wider than this on screen (CSS pixels)
const FOLDED_TRAY_MAX = 100;
const LIGHT_LOGO_WIDTH = (137 * LOGO_HEIGHT) / 28;
const LOGO_MARK_WIDTH = (32 * LOGO_HEIGHT) / 28;
const LOGO_CLEARANCE = 8;

// A motion token (e.g. --duration-move) in ms
function durationOf(token: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token);
  return parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000) || 0;
}

// The sidebar shortcut as the keyboard shows it, for the toggle's tooltip
const SIDEBAR_SHORTCUT = () =>
  /Mac|iPhone|iPad/.test(navigator.platform) ? '\u2318\\' : 'Ctrl+\\';

// How many steps each board keeps to undo
const HISTORY_LIMIT = 100;
// Changes this close together are one step to undo: a color dragged in the picker (once a
// frame), a name typed
const HISTORY_MERGE = 400;
type History = { past: Graphic[]; future: Graphic[] };
const NO_HISTORY: History = { past: [], future: [] };

// Every card id on a board and in its card tray
function cardIds(g: Graphic) {
  return new Set([
    ...typeOf(g.kind)
      .layout(g)
      .map((p) => p.item.id),
    ...g.tray.items.map((i) => i.id),
  ]);
}

// Where every card is and how much ink there is: a change to any of it (a card added,
// moved or removed, a stroke) is always a step of its own, never merged
function cardsAndInk(g: Graphic) {
  return JSON.stringify([
    typeOf(g.kind)
      .layout(g)
      .map((p) => [p.item.id, p.x, p.y]),
    g.tray.items.map((i) => i.id),
    'strokes' in g ? g.strokes.length : 0,
    // A tier added or removed, even an empty one
    'tiers' in g ? g.tiers.map((t) => t.id) : 0,
  ]);
}

// The tools' settings on a board (the pen's color), which undo leaves as they are
function toolSettings(g: Graphic): Partial<Graphic> {
  const keys = (typeOf(g.kind).toolSettings ?? []) as (keyof Graphic)[];
  return Object.fromEntries(keys.map((k) => [k, g[k]]));
}

// Whether a change only touched the tools' settings
function toolsOnly(before: Graphic, now: Graphic) {
  const tools = new Set<string>((typeOf(now.kind).toolSettings ?? []) as string[]);
  return Object.keys(now).every(
    (k) => tools.has(k) || now[k as keyof Graphic] === before[k as keyof Graphic]
  );
}

// Undo's shortcut, as screen readers hear it with a toast that offers Undo
const UNDO_KEY = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? 'Command+Z' : 'Ctrl+Z');

// The key a keydown is for, by its letter, or by its place on a layout without Latin
// letters (a Russian layout's ⌘Z gives "я")
function shortcutKey(e: KeyboardEvent) {
  const key = e.key.toLowerCase();
  return /^[a-z]$/.test(key) ? key : e.code.replace(/^Key/, '').toLowerCase();
}

// From b8 up, where the board has the room beside the sidebar
function wideQuery() {
  const b8 = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-b8');
  return matchMedia(`(width >= ${b8.trim()})`);
}

function loadSaved() {
  try {
    return parseSaved(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? newDoc();
  } catch {
    return newDoc();
  }
}

// The sidebar's main nav, in the tier list's default colors
const TABS = [
  { value: 'add', label: 'Add Cards', icon: 'add-card', color: 'var(--color-tier-fraud)' },
  { value: 'customize', label: 'Customize', icon: 'sliders', color: 'var(--color-tier-mid)' },
  { value: 'save', label: 'Save & Share', icon: 'share', color: 'var(--color-tier-solid)' },
] as const;
type Tab = (typeof TABS)[number]['value'];

// Card pools shown in Add Cards before a search: each previews its first POOL_PREVIEW_CARDS
// cards in a row, or card-shaped placeholders while it has none. Clicking one adds all its
// cards to the card tray, flying in from the preview (addPool); a pool with a `filter` (a
// set code) instead lists that set in the search, its cards being the preview alone.
type Pool = { name: string; cards: CardResult[]; filter?: string };
// How long the search options must stay unchanged before they rerun the search
const SEARCH_DELAY = 300;

// The longest a pool's cards wait (ms) for the page to scroll the card tray into view before
// they fly, where the browser doesn't say when the scroll is over
const SCROLL_WAIT = 800;

// The search results' thumbnail sizes (Small, Medium, Large: --tb-thumb-small, -width and
// -large), saved per device; Medium is the size they always were
type ResultSize = 'small' | 'medium' | 'large';
const RESULT_SIZES = [
  { value: 'small', short: 'S', label: 'Small thumbnails' },
  { value: 'medium', short: 'M', label: 'Medium thumbnails' },
  { value: 'large', short: 'L', label: 'Large thumbnails' },
] as const satisfies readonly { value: ResultSize; short: string; label: string }[];
const RESULT_SIZE_KEY = 'tierbinder-result-size';

// Placeholders shown while a search is under way: enough to fill the results at most
// sidebar heights at each size
const SKELETON_TILES: Record<ResultSize, number> = { small: 30, medium: 18, large: 12 };

// Results drawn at a time (about 20 rows), and how far below the list's visible end the
// next page starts drawing
const RESULTS_PAGE = 120;
const RESULTS_LOOKAHEAD = 400;

// A pool's card, from its TCGdex image path (series/set id/number as TCGdex pads it)
const poolCard = (set: string, number: string, name: string, path: string): CardResult => ({
  set,
  number,
  name,
  image: `https://assets.tcgdex.net/en/${path}/high.webp`,
  thumb: `https://assets.tcgdex.net/en/${path}/low.webp`,
});

// One TCGdex has no image for, from pokemontcg.io (as extra-images.json has it), by path
// (sm35/53). Switch it to poolCard once TCGdex has the image.
const pokemontcgCard = (set: string, number: string, name: string, path: string): CardResult => ({
  set,
  number,
  name,
  image: `https://images.pokemontcg.io/${path}_hires.png`,
  thumb: `https://images.pokemontcg.io/${path}.png`,
});

const FEATURED_POOLS: Pool[] = [
  {
    // The first six as previewed, then the rest in the order Alex listed them
    name: 'Best Decks of All Time',
    cards: [
      pokemontcgCard('SLG', '53', 'Zoroark-GX', 'sm35/53'),
      poolCard('SVI', '86', 'Gardevoir ex', 'sv/sv01/086'),
      poolCard('CEC', '156', 'Arceus & Dialga & Palkia-GX', 'sm/sm12/156'),
      poolCard('FST', '114', 'Mew VMAX', 'swsh/swsh8/114'),
      poolCard('SIT', '139', 'Lugia VSTAR', 'swsh/swsh12/139'),
      poolCard('TWM', '130', 'Dragapult ex', 'sv/sv06/130'),
      poolCard('BRS', '123', 'Arceus VSTAR', 'swsh/swsh9/123'),
      poolCard('GRI', '51', 'Garbodor', 'sm/sm2/51'),
      poolCard('OBF', '125', 'Charizard ex', 'sv/sv03/125'),
      poolCard('LOR', '79', 'Comfey', 'swsh/swsh11/079'),
      poolCard('TEU', '33', 'Pikachu & Zekrom GX', 'sm/sm9/33'),
      poolCard('BUS', '93', 'Gardevoir GX', 'sm/sm3/93'),
      poolCard('STS', '26', 'Volcanion EX', 'xy/xy11/26'),
      poolCard('BST', '88', 'Rapid Strike Urshifu VMAX', 'swsh/swsh5/88'),
    ],
  },
  {
    // Lists the whole set in the search instead of adding cards
    name: 'Delta Reign',
    filter: 'DLR',
    cards: [
      poolCard('DLR', '84', 'Mega Rayquaza ex', 'me/me06/084'),
      poolCard('DLR', '88', 'Talonflame ex', 'me/me06/088'),
      poolCard('DLR', '11', 'Mega Golisopod ex', 'me/me06/011'),
      poolCard('DLR', '69', 'Mega Malamar ex', 'me/me06/069'),
      poolCard('DLR', '47', 'Mega Golurk ex', 'me/me06/047'),
      poolCard('DLR', '33', 'Raikou ex', 'me/me06/033'),
    ],
  },
  {
    // Every Mega Pokémon ex of the Mega Evolution era's sets (not promos), each in its
    // first print, its lowest number in the first set it came out in: the six previewed,
    // then the rest by release
    name: 'Mega Evolution Cards',
    cards: [
      poolCard('MEG', '104', 'Mega Kangaskhan ex', 'me/me01/104'),
      poolCard('PFL', '13', 'Mega Charizard X ex', 'me/me02/013'),
      poolCard('MEG', '77', 'Mega Lucario ex', 'me/me01/077'),
      poolCard('MEG', '86', 'Mega Absol ex', 'me/me01/086'),
      poolCard('PBL', '65', 'Mega Excadrill ex', 'me/me05/065'),
      poolCard('CRI', '22', 'Mega Greninja ex', 'me/me04/022'),
      poolCard('MEG', '3', 'Mega Venusaur ex', 'me/me01/003'),
      poolCard('MEG', '22', 'Mega Camerupt ex', 'me/me01/022'),
      poolCard('MEG', '36', 'Mega Abomasnow ex', 'me/me01/036'),
      poolCard('MEG', '50', 'Mega Manectric ex', 'me/me01/050'),
      poolCard('MEG', '60', 'Mega Gardevoir ex', 'me/me01/060'),
      poolCard('MEG', '94', 'Mega Mawile ex', 'me/me01/094'),
      poolCard('MEG', '100', 'Mega Latias ex', 'me/me01/100'),
      poolCard('PFL', '4', 'Mega Heracross ex', 'me/me02/004'),
      poolCard('PFL', '41', 'Mega Diancie ex', 'me/me02/041'),
      poolCard('PFL', '56', 'Mega Gengar ex', 'me/me02/056'),
      poolCard('PFL', '61', 'Mega Sharpedo ex', 'me/me02/061'),
      poolCard('PFL', '84', 'Mega Lopunny ex', 'me/me02/084'),
      poolCard('ASC', '10', 'Mega Meganium ex', 'me/me02.5/010'),
      poolCard('ASC', '22', 'Mega Charizard Y ex', 'me/me02.5/022'),
      poolCard('ASC', '31', 'Mega Emboar ex', 'me/me02.5/031'),
      poolCard('ASC', '43', 'Mega Feraligatr ex', 'me/me02.5/043'),
      poolCard('ASC', '47', 'Mega Froslass ex', 'me/me02.5/047'),
      poolCard('ASC', '61', 'Mega Eelektross ex', 'me/me02.5/061'),
      poolCard('ASC', '116', 'Mega Hawlucha ex', 'me/me02.5/116'),
      poolCard('ASC', '135', 'Mega Scrafty ex', 'me/me02.5/135'),
      poolCard('ASC', '152', 'Mega Dragonite ex', 'me/me02.5/152'),
      poolCard('ASC', '172', 'Mega Audino ex', 'me/me02.5/172'),
      poolCard('POR', '21', 'Mega Starmie ex', 'me/me03/021'),
      poolCard('POR', '31', 'Mega Clefable ex', 'me/me03/031'),
      poolCard('POR', '47', 'Mega Zygarde ex', 'me/me03/047'),
      poolCard('POR', '55', 'Mega Skarmory ex', 'me/me03/055'),
      poolCard('CRI', '15', 'Mega Pyroar ex', 'me/me04/015'),
      poolCard('CRI', '35', 'Mega Floette ex', 'me/me04/035'),
      poolCard('CRI', '48', 'Mega Gallade ex', 'me/me04/048'),
      poolCard('CRI', '65', 'Mega Dragalge ex', 'me/me04/065'),
      poolCard('PBL', '8', 'Mega Delphox ex', 'me/me05/008'),
      poolCard('PBL', '27', 'Mega Zeraora ex', 'me/me05/027'),
      poolCard('PBL', '31', 'Mega Slowbro ex', 'me/me05/031'),
      poolCard('PBL', '38', 'Mega Chandelure ex', 'me/me05/038'),
      poolCard('PBL', '48', 'Mega Darkrai ex', 'me/me05/048'),
      poolCard('DLR', '11', 'Mega Golisopod ex', 'me/me06/011'),
      poolCard('DLR', '47', 'Mega Golurk ex', 'me/me06/047'),
      poolCard('DLR', '69', 'Mega Malamar ex', 'me/me06/069'),
      poolCard('DLR', '84', 'Mega Rayquaza ex', 'me/me06/084'),
    ],
  },
];
const POOL_PREVIEW_CARDS = 6;

export default function Editor() {
  const [doc, setDoc] = React.useState<TierBinderDoc>(loadSaved);
  // The latest document, for work that finishes after an await (bulk import)
  const docRef = React.useRef(doc);
  React.useEffect(() => {
    docRef.current = doc;
  });
  const graphic = currentGraphic(doc);
  const type = typeOf(graphic.kind);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);
  const [fontFamily, setFontFamily] = React.useState('sans-serif');
  // The interface's font (Figtree), for canvas text that belongs to the editor (the empty
  // card tray's hint)
  const [interfaceFont, setInterfaceFont] = React.useState('sans-serif');
  // Every message (the card tray is full, import results, copying) is a toast at
  // the top of the window, never on the board. It fades after TOAST_DURATION, plus
  // TOAST_LINE_DURATION for each line past the first; `stay` keeps work under way
  // ("Importing…") up until the next message replaces it (another message during an
  // import replaces it too, and the import's result follows). Only one shows: another
  // message replaces it, and the same one again keeps it up longer without replaying its entrance, so repeated clicks can't
  // pile them up. `id` changes with the message (replaying the entrance), `n` with every
  // showing (restarting the timer); `closing` while it fades, like the card menu.
  // `undo`: the message is for a change to the board (a clear, cards added or removed), and
  // it offers Undo until the board changes again ('waiting' for that change to be
  // recorded, then 'armed'; history's effect moves it on). Hovering or focusing it holds
  // it up (`held`).
  const [toast, setToast] = React.useState<{
    message: string;
    id: number;
    n: number;
    closing: boolean;
    stay: boolean;
    undo?: 'waiting' | 'armed';
  } | null>(null);
  // When the board's history last took a settings change (undo's merging, below); a toast
  // that offers Undo starts a new step
  const lastChange = React.useRef(0);
  // The toast the pointer or focus is on, by id: it holds up only that toast, and only
  // while it offers Undo, so a toast that goes away under the pointer can't hold the next
  const [heldToast, setHeldToast] = React.useState<number | null>(null);
  const toastHeld =
    toast !== null && heldToast === toast.id && toast.undo === 'armed' && !toast.closing;
  // `undo` must come with a change to the board showing, in the same update: that change
  // arms its Undo, and starts a step of its own, so Undo takes back only what it reports
  const showToast = (message: string, { stay = false, undo = false } = {}) => {
    if (undo) lastChange.current = 0;
    setToast((t) => ({
      message,
      id: t && t.message === message && !t.closing ? t.id : (t?.id ?? 0) + 1,
      n: (t?.n ?? 0) + 1,
      closing: false,
      stay,
      undo: undo ? 'waiting' : undefined,
    }));
  };
  React.useEffect(() => {
    if (!toast || toast.closing || toast.stay || toastHeld) return;
    const lines = toast.message.split('\n').length;
    const timer = setTimeout(
      () => setToast((t) => (t ? { ...t, closing: true } : t)),
      TOAST_DURATION + (lines - 1) * TOAST_LINE_DURATION
    );
    return () => clearTimeout(timer);
    // Restarts with each showing (`n`) and when it's let go, not on closing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.n, toastHeld]);
  React.useEffect(() => {
    if (!toast?.closing) return;
    const timer = setTimeout(() => setToast(null), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [toast?.closing]);
  // Featured pool cards whose thumbnail failed both ways, by set and number, and the cards
  // each pool shows without them. Only the preview is loaded in the sidebar, so a card past
  // it is never known to have failed: it goes in the tray, as a placeholder if it can't load.
  const [failedPoolCards, setFailedPoolCards] = React.useState<Set<string>>(new Set());
  const poolPreview = (pool: Pool) =>
    pool.cards
      .filter((card) => !failedPoolCards.has(`${card.set} ${card.number}`))
      .slice(0, POOL_PREVIEW_CARDS);
  const [busy, setBusy] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [query, setQuery] = React.useState('');
  // The search the results are for, rerun when the filters or sort order change
  const [searched, setSearched] = React.useState('');
  const [searchOptions, setSearchOptions] = React.useState<SearchOptions>(DEFAULT_SEARCH);
  // Each search's number, so a slower earlier one can't replace a later one's results
  const searchCount = React.useRef(0);
  // The search under way, and one waiting for the options to settle (changeSearchOptions)
  const searchAbort = React.useRef<AbortController | null>(null);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  // The last search failed: why, shown under the search
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<CardResult[]>([]);
  // Results whose thumbnail wouldn't load even through the proxy (a source listing an
  // image it doesn't have): hidden, since there's no picture to show. Each set of results
  // starts afresh.
  const [unshown, setUnshown] = React.useState<{ of: CardResult[]; keys: Set<string> }>({
    of: [],
    keys: new Set(),
  });
  const brokenKeys = unshown.of === results ? unshown.keys : null;
  const shownResults = brokenKeys
    ? results.filter((card) => !brokenKeys.has(`${card.set} ${card.number}`))
    : results;
  // How many results are drawn: a page at first, and another each time the list is
  // scrolled near its end, so listing many whole sets can't put thousands of cards on the
  // page at once. Each set of results starts again at one page.
  const [resultsLimit, setResultsLimit] = React.useState({ of: results, count: RESULTS_PAGE });
  const resultsCount = resultsLimit.of === results ? resultsLimit.count : RESULTS_PAGE;
  const visibleResults = shownResults.slice(0, resultsCount);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const moreResultsRef = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const more = moreResultsRef.current;
    if (!more) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting)
          setResultsLimit({ of: results, count: resultsCount + RESULTS_PAGE });
      },
      // Starts drawing the next page a little before the end comes into view
      { root: resultsRef.current, rootMargin: `0px 0px ${RESULTS_LOOKAHEAD}px` }
    );
    observer.observe(more);
    return () => observer.disconnect();
  }, [results, resultsCount, visibleResults.length]);
  // What the last search was for; when nothing it found can be shown (none found, or every
  // thumbnail failed), that's said under the search
  const [searchedFor, setSearchedFor] = React.useState<{ query: string; sets: string[] } | null>(
    null
  );
  const noResults = searchedFor && shownResults.length === 0 ? searchedFor : null;
  // A search is under way: its results show as shimmering placeholders until it's back
  const [searching, setSearching] = React.useState(false);
  const showingSkeleton = searching && !importing;
  const showingResults = shownResults.length > 0 && !importing && !searching;
  // Results, placeholders or the no-results message, which hide the pools and Advanced
  const searchShown =
    !importing &&
    (shownResults.length > 0 || noResults !== null || searching || searchError !== null);
  // The results are scrolled, so a shade shows they go on under the controls above
  const [resultsScrolled, setResultsScrolled] = React.useState(false);
  const sortDirection = sortLabel(searchOptions);
  // How big the results' thumbnails are, remembered on this device
  const [resultSize, setResultSize] = React.useState<ResultSize>(() => {
    try {
      const saved = localStorage.getItem(RESULT_SIZE_KEY);
      return RESULT_SIZES.find((s) => s.value === saved)?.value ?? 'medium';
    } catch {
      return 'medium';
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(RESULT_SIZE_KEY, resultSize);
    } catch {}
  }, [resultSize]);
  // Large thumbnails load the board's image (TCGdex's high.webp), which stays sharp at that
  // size; the others the small one
  const resultSrc = (card: CardResult) => (resultSize === 'large' ? card.image : card.thumb);
  // Where the next search result goes: one of the graphic's targets
  const [target, setTarget] = React.useState(0);
  // The active tool: moving cards, or one from the graphic's toolbar
  const [tool, setTool] = React.useState(DEFAULT_TOOL);
  // Card Tray's section and Bulk Import's, scrolled into view as they open (revealBelow)
  const traySectionRef = React.useRef<HTMLDivElement>(null);
  const importRef = React.useRef<HTMLDivElement>(null);
  // Pools whose cards are still flying in: they don't offer to take them back out yet, so a
  // double click doesn't send them straight back
  const [flyingPools, setFlyingPools] = React.useState<ReadonlySet<string>>(new Set());
  // The tray cards each pool added last, by pool name (for this visit; a reload forgets),
  // so clicking it again takes back exactly those
  const [poolAdds, setPoolAdds] = React.useState<Record<string, string[]>>({});
  // Keyed by board type and pool, since each board has its own tray
  const poolAddsKey = (pool: Pool) => `${graphic.kind} ${pool.name}`;
  const [tab, setTab] = React.useState<Tab>('add');
  // Menu for a clicked card, or for a search result dropped on a card (`dropped`: the
  // result, and the point it was dropped at), positioned in the board's on-screen pixels
  // The card tray's own menu shares it, with `id` TRAY_MENU (opened on the tray's space:
  // Hide Card Tray, and Clear Card Tray, which a tray card's menu has last too);
  // `flyout`, while Clear Card Tray's flyout is open, is how many cards it clears (kept, so
  // the label holds while it folds closed)
  const [cardMenu, setCardMenu] = React.useState<{
    id: string;
    x: number;
    y: number;
    dropped?: { card: CardResult; point: Point };
    flyout?: number;
  } | null>(null);
  const cardMenuRef = React.useRef<HTMLDivElement>(null);
  // Menu for a search result, from a right-click (or the menu key): View, and Add to with
  // a flyout of every Add to choice. At the pointer, in the window's pixels; `tile` is the
  // result, for View's start and for focus to go back to. Like the card menu, it stays on
  // screen while it folds closed.
  const [resultMenu, setResultMenu] = React.useState<ResultMenu | null>(null);
  // A new set of results replaces the one the menu was opened on: it closes
  if (resultMenu && resultMenu.of !== results) setResultMenu(null);
  const [shownResultMenu, setShownResultMenu] = React.useState(resultMenu);
  if (resultMenu && resultMenu !== shownResultMenu) setShownResultMenu(resultMenu);
  const resultMenuClosing = !resultMenu && shownResultMenu !== null;
  React.useEffect(() => {
    if (!resultMenuClosing) return;
    const timer = setTimeout(() => setShownResultMenu(null), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [resultMenuClosing]);
  const resultMenuRef = React.useRef<HTMLDivElement>(null);
  const resultAddToRef = React.useRef<HTMLButtonElement>(null);
  const [resultFlyout, setResultFlyout] = React.useState(false);
  // The flyout stays on screen while it folds closed, as the menus do
  const [shownFlyout, setShownFlyout] = React.useState(false);
  if (resultFlyout && !shownFlyout) setShownFlyout(true);
  const flyoutClosing = shownFlyout && !resultFlyout;
  React.useEffect(() => {
    if (!flyoutClosing) return;
    const timer = setTimeout(() => setShownFlyout(false), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [flyoutClosing]);
  // Kept inside the window, EDGE in: the menu opens upward from the pointer when it won't
  // fit below, and the flyout opens to the left (and moves up) when it won't fit. Measured
  // from layout sizes (offsetWidth and the like), since they open stretching from a scale.
  React.useLayoutEffect(() => {
    const menu = resultMenuRef.current;
    if (!menu || !shownResultMenu) return;
    const left = Math.min(shownResultMenu.x, window.innerWidth - EDGE - menu.offsetWidth);
    const top =
      shownResultMenu.y + menu.offsetHeight > window.innerHeight - EDGE
        ? shownResultMenu.y - menu.offsetHeight
        : shownResultMenu.y;
    menu.style.left = `${Math.max(EDGE, left)}px`;
    menu.style.top = `${Math.max(EDGE, top)}px`;
  }, [shownResultMenu]);
  React.useLayoutEffect(() => {
    const menu = resultMenuRef.current;
    const flyout = menu?.querySelector<HTMLElement>('[data-flyout]');
    const row = flyout?.parentElement;
    if (!menu || !flyout || !row || !resultFlyout) return;
    const menuLeft = parseFloat(menu.style.left) || 0;
    const menuTop = parseFloat(menu.style.top) || 0;
    // Where it would sit to the right, by its own CSS (its offsets within its row)
    const right =
      menuLeft + menu.clientLeft + row.offsetLeft + flyout.offsetLeft + flyout.offsetWidth;
    if (right > window.innerWidth - EDGE) flyout.dataset.side = 'left';
    const bottom =
      menuTop + menu.clientTop + row.offsetTop + flyout.offsetTop + flyout.offsetHeight;
    const over = bottom - (window.innerHeight - EDGE);
    if (over > 0) flyout.style.translate = `0 ${-over}px`;
  }, [resultFlyout]);
  // Opening focuses its first item; a press outside, Escape (back to the result) or
  // scrolling closes it
  React.useEffect(() => {
    if (!resultMenu) return;
    resultMenuRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const close = () => setResultMenu(null);
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && resultMenuRef.current?.contains(e.target))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      // The page's Delete and Backspace (removing the selected card) don't reach the board
      // from here
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.stopImmediatePropagation();
        return;
      }
      if (e.key !== 'Escape' && e.key !== 'Tab') return;
      e.stopImmediatePropagation();
      // Escape in the flyout closes just the flyout, back to its "Add to" row
      if (e.key === 'Escape' && document.activeElement?.closest('[data-flyout]')) {
        setResultFlyout(false);
        resultAddToRef.current?.focus();
        return;
      }
      // Escape, or Tab (a menu isn't a stop in the page's tab order): closed, back to the
      // result
      e.preventDefault();
      close();
      resultMenu.tile.focus();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', close, true);
    };
  }, [resultMenu]);
  // The menu on screen: the open one, or the last one while it folds closed
  const [shownMenu, setShownMenu] = React.useState(cardMenu);
  if (cardMenu && cardMenu !== shownMenu) setShownMenu(cardMenu);
  const menuClosing = !cardMenu && shownMenu !== null;
  // Clear Card Tray's flyout: on screen while it folds closed, as the search result menu's
  // is, but only in the menu it opened in (`menu`, the menu's key): a new menu starts
  // without it
  const menuKey = (m: { id: string; x: number; y: number }) => `${m.id} ${m.x} ${m.y}`;
  const trayFlyout = cardMenu?.flyout ?? null;
  const [shownTrayFlyoutState, setShownTrayFlyout] = React.useState<{
    menu: string;
    n: number;
  } | null>(null);
  if (
    cardMenu &&
    trayFlyout !== null &&
    (trayFlyout !== shownTrayFlyoutState?.n || shownTrayFlyoutState.menu !== menuKey(cardMenu))
  ) {
    setShownTrayFlyout({ menu: menuKey(cardMenu), n: trayFlyout });
  }
  const shownTrayFlyout =
    shownTrayFlyoutState && shownMenu && shownTrayFlyoutState.menu === menuKey(shownMenu)
      ? shownTrayFlyoutState.n
      : null;
  const trayFlyoutClosing = shownTrayFlyout !== null && trayFlyout === null;
  React.useEffect(() => {
    if (!trayFlyoutClosing) return;
    const timer = setTimeout(() => setShownTrayFlyout(null), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [trayFlyoutClosing]);
  const trayFlyoutRowRef = React.useRef<HTMLButtonElement>(null);
  // It opens to the row's right, or its left when that wouldn't fit in the window, EDGE in
  // (measured from layout sizes, from the board's box, since the menu opens stretching from
  // a scale; the flyout's own offset includes its gap).
  React.useLayoutEffect(() => {
    const menu = cardMenuRef.current;
    const row = trayFlyoutRowRef.current;
    const flyout = row?.parentElement?.querySelector<HTMLElement>('[data-flyout]');
    const box = boardBoxRef.current;
    if (!menu || !row || !flyout || !box || trayFlyout === null) return;
    const right =
      box.getBoundingClientRect().left +
      menu.offsetLeft +
      menu.clientLeft +
      row.offsetLeft +
      flyout.offsetLeft +
      flyout.offsetWidth;
    if (right > window.innerWidth - EDGE) flyout.dataset.side = 'left';
    // Presentation mode's Add to flyout is a list of every place, from a row that isn't the
    // menu's last: it moves up to end EDGE above the window's foot when it would pass it,
    // as the result menu's does
    const bottom =
      box.getBoundingClientRect().top +
      menu.offsetTop +
      menu.clientTop +
      row.offsetTop +
      flyout.offsetTop +
      flyout.offsetHeight;
    const over = bottom - (window.innerHeight - EDGE);
    if (over > 0) flyout.style.translate = `0 ${-over}px`;
  }, [trayFlyout]);
  // A menu that would run past the window's foot moves up just enough to end EDGE above it
  // (by its key), but no higher than EDGE under the window's top: under b8 the board's foot
  // can be near the middle of the window, and a menu reaching past the page would scroll
  // it. Measured from layout sizes, since it opens stretching from a scale.
  const [raisedMenu, setRaisedMenu] = React.useState<{ key: string; top: number } | null>(null);
  React.useLayoutEffect(() => {
    const menu = cardMenuRef.current;
    const box = boardBoxRef.current;
    if (!menu || !box || !shownMenu || menu.style.bottom) return;
    const boxTop = box.getBoundingClientRect().top;
    const over = boxTop + shownMenu.y + menu.offsetHeight - (window.innerHeight - EDGE);
    if (over <= 0) return;
    const top = Math.max(EDGE - boxTop, shownMenu.y - over);
    setRaisedMenu({ key: menuKey(shownMenu), top });
  }, [shownMenu]);
  // Removed on a timer just after its 180ms fold (globals.css) rather than on
  // animationend, which doesn't fire in a tab that isn't painting
  React.useEffect(() => {
    if (!menuClosing) return;
    const timer = setTimeout(() => setShownMenu(null), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [menuClosing]);
  // Card face being picked from search: the next result clicked replaces the card (or a
  // split card's top half), or becomes its bottom half, making it a split card
  const [picking, setPicking] = React.useState<{ id: string; part: 'top' | 'bottom' } | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  // A setting the board asked the Customize tab to focus (e.g. a tier name)
  const [settingsFocus, setSettingsFocus] = React.useState<{ key: string; n: number } | null>(null);

  const stageRef = React.useRef<Konva.Stage | null>(null);
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  // The whole page: under b8, the board's height is a share of it (BOARD_SHARE)
  const pageRef = React.useRef<HTMLDivElement>(null);
  // The sidebar's default width fits the main nav with every label showing and the same
  // 8px (.sideHead) on both sides, plus the sidebar's edge line. It's measured from the
  // nav, so it follows the labels and the font; a width the user dragged still wins.
  const sideColumnRef = React.useRef<HTMLDivElement>(null);
  const fitSidebarToNav = React.useCallback((navWidth: number) => {
    sideColumnRef.current?.style.setProperty(
      '--tb-sidebar-default',
      `calc(${navWidth}px + 2 * var(--spacing-3) + var(--tb-line-width))`
    );
  }, []);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const boardBoxRef = React.useRef<HTMLDivElement>(null);
  // The selection outline. Konva moves a dragged card itself, without React, so the
  // outline is moved the same way to stay on it (cards carry their item's id).
  const outlineRef = React.useRef<Konva.Rect>(null);
  const moveOutline = (e: Konva.KonvaEventObject<DragEvent>) => {
    const card = e.target;
    if (card.name() !== 'card' || card.id() !== selectedId) return;
    // On the stage, not in its parent (the card tray's cards are in a group under the
    // board), and at the card's size, which changes as it's dragged between the tray and
    // the board
    const stage = card.getStage();
    if (!stage) return;
    const box = card.getClientRect({ relativeTo: stage, skipStroke: true });
    outlineRef.current?.setAttrs({
      x: box.x - OUTLINE.width,
      y: box.y - OUTLINE.width,
      width: box.width + 2 * OUTLINE.width,
      height: box.height + 2 * OUTLINE.width,
    });
  };
  // Search result pressed with a mouse or pen: where the press started, and whether it
  // has moved far enough to be a drag. A drag shows the card under the pointer
  // (dragGhost) and drops it on the board when released.
  const resultPress = React.useRef<{
    card: CardResult;
    x: number;
    y: number;
    dragging: boolean;
  } | null>(null);
  const [dragGhost, setDragGhost] = React.useState<{
    card: CardResult;
    x: number;
    y: number;
  } | null>(null);
  // Set from a drag's release until the click that follows it, so the drag doesn't also add the card
  const justDragged = React.useRef(false);

  // From b8 up, where the board has the room beside the sidebar
  // Known from the first render (the editor only renders in the browser), so the board's
  // first fit already uses the wide layout
  const [wide, setWide] = React.useState(() => wideQuery().matches);
  // The sidebar column hidden with Ctrl+\ (Cmd+\ on a Mac, as in Notion and Figma) or the
  // button at the sidebar's foot, sliding out to leave the window to the board; from b8 up
  // only, where it's beside the board. Not saved: a reload, or a narrower window, shows it.
  const [sidebarHidden, setSidebarHidden] = React.useState(false);
  // Under b8, the sidebar collapsed under a bigger board (and the top bar hidden), by the
  // button at the sidebar's top; a tab picked (by any means) opens it again. Not saved.
  const [sidebarFolded, setSidebarFolded] = React.useState(false);
  // The sidebar, whose height (folded, just its bar) the board leaves room for
  const sideRef = React.useRef<HTMLElement>(null);
  const sideHeadRef = React.useRef<HTMLDivElement>(null);
  // Folding slides (useReveal, 0 open to 1 folded): the top bar rises away, the sidebar
  // shrinks from its open height to its bar's (measured as it starts folding), and the board
  // grows into the room, centered; only once it's all the way down does the bar swap the
  // nav for the logo (`folded`), and opening swaps them back first
  const foldReveal = useReveal(sidebarFolded && !wide, wide);
  const fold = wide ? 0 : foldReveal.value;
  const folded = fold === 1;
  // Presentation mode: the sidebar folded on a phone, the board taking the page. The card
  // menu keeps only what doesn't need the sidebar (View, Add to, Remove Card).
  const presenting = sidebarFolded && !wide;
  // Entering or leaving it changes a card's menu (and which flyout its open one is), so an
  // open menu closes
  const [wasPresenting, setWasPresenting] = React.useState(presenting);
  if (wasPresenting !== presenting) {
    setWasPresenting(presenting);
    if (cardMenu) setCardMenu(null);
  }
  const [foldHeights, setFoldHeights] = React.useState({ open: 0, bar: 0, shift: 0 });
  const foldSidebar = () => {
    const side = sideRef.current;
    const head = sideHeadRef.current;
    // (measured only from fully open: a reverse mid-slide keeps the last measure, not the
    // height it's passing through)
    if (!sidebarFolded && fold === 0 && side && head) {
      const style = getComputedStyle(head);
      // The folded bar's row: the light logo and the button, not the nav it replaces, which
      // is taller, so the slide ends at the bar's own height instead of popping down to it
      const button = head.querySelector<HTMLElement>(`.${styles.foldButton}`);
      const row = Math.max(LOGO_HEIGHT, button?.offsetHeight ?? 0);
      // The nav's row, taller than the bar's: the button, centered on it, rises by half the
      // difference as it folds, so it's already where the bar's row centers it at the end
      const navRow =
        head.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setFoldHeights({
        shift: Math.max(0, (navRow - row) / 2),
        open: side.offsetHeight,
        // The row with its padding above, and the bar's below (kept as its
        // scroll-margin-bottom, which resolves the safe area's inset to pixels)
        bar:
          parseFloat(style.paddingTop) +
          row +
          parseFloat(style.scrollMarginBottom) +
          (side.offsetHeight - side.clientHeight),
      });
    }
    setSidebarFolded((f) => !f);
  };
  // The sidebar's height while it folds or opens
  const foldingSideHeight =
    fold > 0 && !folded ? foldHeights.open + (foldHeights.bar - foldHeights.open) * fold : null;
  // The header's line shows only while the tab panel under it is scrolled from its top
  // (each tab keeping its own scroll, so its own flag)
  const [scrolledTabs, setScrolledTabs] = React.useState<Partial<Record<Tab, boolean>>>({});
  const panelScrolled = !!scrolledTabs[tab];
  const onPanelScroll = (panelTab: Tab) => (e: React.UIEvent<HTMLElement>) => {
    const scrolled = e.currentTarget.scrollTop > 0;
    setScrolledTabs((t) => (t[panelTab] === scrolled ? t : { ...t, [panelTab]: scrolled }));
  };
  const [foldedTab, setFoldedTab] = React.useState(tab);
  if (foldedTab !== tab) {
    setFoldedTab(tab);
    setSidebarFolded(false);
  }
  const showSidebarRef = React.useRef<HTMLButtonElement>(null);
  const sidebarCollapsed = wide && sidebarHidden;
  // While the sidebar is hidden, the light binder mark fades in where the top bar's logo
  // was (the colored one goes with the sidebar), once the slide is over (`data-settled`),
  // as a button that brings the sidebar back; only when it clears the board (`data-size`,
  // measured as the board moves). Showing the sidebar fades it out (`logoLeaving`) as the
  // top bar comes back.
  const floatingLogoRef = React.useRef<HTMLButtonElement>(null);
  const [logoMounted, setLogoMounted] = React.useState(false);
  if (sidebarCollapsed && !logoMounted) setLogoMounted(true);
  const logoLeaving = logoMounted && !sidebarCollapsed;
  React.useEffect(() => {
    if (!logoLeaving) return;
    const timer = setTimeout(() => setLogoMounted(false), durationOf('--duration-fade'));
    return () => clearTimeout(timer);
  }, [logoLeaving]);
  React.useEffect(() => {
    const logo = floatingLogoRef.current;
    if (!sidebarCollapsed || !logo) return;
    // The slide's length (none under reduced motion, where the sidebar goes at once)
    const slide = matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : durationOf('--duration-move');
    const timer = setTimeout(() => logo.toggleAttribute('data-settled', true), slide);
    return () => {
      clearTimeout(timer);
      logo.toggleAttribute('data-settled', false);
    };
  }, [sidebarCollapsed]);
  // html and body don't scroll, but iOS Safari scrolls the window anyway to show a field
  // under its keyboard, and can leave it scrolled once the keyboard closes: the page
  // shifted up, with an empty strip under it. Put it back once no field has focus.
  React.useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const field = document.activeElement?.matches(
          'input:not([type=checkbox], [type=radio]), textarea, [contenteditable]:not([contenteditable=false])'
        );
        // Only once the keyboard has closed (the visual viewport is the window's height
        // again, give or take the pixel its fractional height rounds off), and never
        // while zoomed in, where panning moves the window too
        const keyboard = viewport && window.innerHeight - viewport.height > 1;
        const zoomed = viewport && viewport.scale > 1;
        if (field || keyboard || zoomed || !(window.scrollX || window.scrollY)) return;
        window.scrollTo(0, 0);
      });
    };
    window.addEventListener('focusout', settle);
    viewport?.addEventListener('resize', settle);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('focusout', settle);
      viewport?.removeEventListener('resize', settle);
    };
  }, []);
  React.useEffect(() => {
    const query = wideQuery();
    const update = () => {
      setWide(query.matches);
      if (!query.matches) setSidebarHidden(false);
      else setSidebarFolded(false);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const hideSidebarRef = React.useRef<HTMLButtonElement>(null);
  // The sidebar's foot (the credits) shows under every tab from b8 up, and below it only
  // under Save & Share. Hiding it with focus inside (the window narrowed, or a tab switched
  // from the keyboard) would drop focus to the page, so it goes to the main nav's tab.
  const footRef = React.useRef<HTMLElement>(null);
  const footHidden = !wide && tab !== 'save';
  React.useLayoutEffect(() => {
    const foot = footRef.current;
    if (!footHidden || !foot?.contains(document.activeElement)) return;
    foot.closest('aside')?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus();
  }, [footHidden]);
  const toggleSidebar = React.useCallback(() => {
    if (sidebarHidden) {
      // The show button goes as the sidebar comes back: focus on it moves to the hide button
      const fromShowButton = document.activeElement === showSidebarRef.current;
      flushSync(() => setSidebarHidden(false));
      if (fromShowButton) hideSidebarRef.current?.focus({ preventScroll: true });
    } else {
      // Focus in the sidebar would be lost with it: the board takes it
      if (sideColumnRef.current?.contains(document.activeElement)) {
        boardBoxRef.current?.focus({ preventScroll: true });
      }
      // Open dropdowns and popups close as the sidebar goes, as they do on a press outside
      // them; the press is on the board, so the selected card stays selected
      boardBoxRef.current?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      setSidebarHidden(true);
    }
  }, [sidebarHidden]);
  React.useEffect(() => {
    if (!wide) return;
    const onKey = (e: KeyboardEvent) => {
      // By the key's place, so it works on keyboards where \ takes another key
      if (e.code !== 'Backslash' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      // Holding the keys toggles it once
      if (!e.repeat) toggleSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, toggleSidebar]);
  // The card tray, under the board: its top edge in design pixels sits TRAY_GAP on-screen
  // pixels below the board, whatever the scale
  const trayShown = graphic.tray.enabled;
  // The board's width in design pixels, from its shape
  const width = boardWidth(graphic.shape);
  // The card tray keeps its own width whatever the board's shape, the board centered over
  // it. What the stage shows across, and how far in the board starts (the stage is shifted
  // by it, so the board's own left edge stays x = 0 for everything laid out on it)
  // Turning the tray on or off slides it in or out under the board (useReveal): the stage
  // grows to the tray's width and height as it fades in, and back. Drawn while it's on or
  // still leaving; a leaving tray takes no presses and isn't in `placements`.
  const trayReveal = useReveal(trayShown, graphic.kind);
  const trayOpen = trayReveal.value;
  const trayDrawn = trayShown || trayOpen > 0;
  // Its contents fade over --duration-fade, the first or last part of the slide
  const [fadeShare] = React.useState(
    () => readDuration('--duration-fade') / (readDuration('--duration-move') || 1)
  );
  const trayOpacity = Math.min(1, trayOpen / (fadeShare || 1));
  // The tray on screen: a 16:9 board's width beside the sidebar; on phones and tablets the
  // workspace's whole width at the board's scale, its one row scrolling sideways, so a
  // narrow board isn't drawn smaller to fit a wider tray under it, and the tray still spans
  // the page (the image's tray is always the board's width)
  const [trayRoom, setTrayRoom] = React.useState(0);
  const shownTrayWidth = wide ? TRAY_WIDTH : Math.max(width, scale > 0 ? trayRoom / scale : 0);
  const stageWidth = width + (Math.max(shownTrayWidth, width) - width) * trayOpen;
  const boardLeft = (stageWidth - width) / 2;
  // The tray's left edge from the board's: centered on the stage, also while the stage
  // widens to it as it slides in (so it opens from the middle, not wiped in from the left)
  const trayLeft = -boardLeft - (Math.max(shownTrayWidth, width) - stageWidth) / 2;
  const trayTop = BOARD_HEIGHT + TRAY_GAP / (scale || 1);
  // Exported under the board when ticked in Save & Share
  const [includeTray, setIncludeTray] = React.useState(false);
  // The empty tray's hint shows until a card has been in a tray, then not again for the
  // tab's session (sessionStorage, so a reload keeps it hidden)
  const [trayHintSeen, setTrayHintSeen] = React.useState(() => {
    try {
      return sessionStorage.getItem(TRAY_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!trayHintSeen && graphic.tray.items.length > 0) setTrayHintSeen(true);
  React.useEffect(() => {
    if (!trayHintSeen) return;
    try {
      sessionStorage.setItem(TRAY_HINT_KEY, '1');
    } catch {}
  }, [trayHintSeen]);
  const exportTray = trayShown && includeTray;
  // Under b8 the tray on screen is one row of full-size cards, scrolled sideways (trayPan,
  // design pixels, kept within what the row overhangs); the image keeps its two rows
  // (its cards FOLDED_TRAY_SCALE times full size while the sidebar is folded, growing with
  // the fold's slide, so they're easier to see and pick up)
  // (trayFill: the folded tray's cards filling the height the board leaves, from the fit)
  const [trayFill, setTrayFill] = React.useState(0);
  const foldedTrayCard = Math.max(
    CARD_WIDTH,
    Math.min(Math.max(CARD_WIDTH * FOLDED_TRAY_SCALE, trayFill), FOLDED_TRAY_MAX / (scale || 1))
  );
  const oneRowTray = wide ? false : CARD_WIDTH + (foldedTrayCard - CARD_WIDTH) * fold;
  const trayCount = graphic.tray.items.length;
  const maxTrayPan = oneRowTray
    ? Math.max(0, trayRowWidth(trayCount, oneRowTray) - shownTrayWidth)
    : 0;
  const [trayPanAsked, setTrayPan] = React.useState(0);
  const trayPan = Math.min(trayPanAsked, maxTrayPan);
  // A card added at the end scrolls the row to it, so it lands where it can be seen
  const lastTrayId = graphic.tray.items.at(-1)?.id;
  // (on the same board: switching boards starts at the row's start)
  const [trayEnd, setTrayEnd] = React.useState({
    kind: graphic.kind,
    count: trayCount,
    last: lastTrayId,
  });
  if (trayEnd.kind !== graphic.kind || trayEnd.count !== trayCount || trayEnd.last !== lastTrayId) {
    setTrayEnd({ kind: graphic.kind, count: trayCount, last: lastTrayId });
    if (trayEnd.kind !== graphic.kind) setTrayPan(0);
    else if (trayCount > trayEnd.count && lastTrayId !== trayEnd.last) setTrayPan(maxTrayPan);
  }
  // Kept within the row, so a pan asked past its end (or a row that shrank) doesn't snap a
  // later insert to the end
  if (trayPanAsked > maxTrayPan) setTrayPan(maxTrayPan);
  // The tray's height follows its cards; while it slides in or out, the share of it shown
  const shownTrayHeight = trayDrawn
    ? trayHeight(trayCount, shownTrayWidth, oneRowTray) * trayOpen
    : 0;
  // The image's size in its own pixels. An included card tray goes under the board at the
  // board's width, its cards laid out again to fit, so the image is one rectangle.
  const exported = exportSize(
    graphic.shape,
    BOARD_HEIGHT + (exportTray ? trayHeight(graphic.tray.items.length, width) : 0)
  );

  // A dragged card shows at the board's card size over the board, and the tray's over
  // the card tray (as a new card there would be)
  const boardCardWidth = type.cardWidth?.(graphic) ?? CARD_WIDTH;
  // (a full tray won't take it, so it keeps the board's size)
  const cardDragWidth = (center: Point) =>
    trayShown && center.y > BOARD_HEIGHT && graphic.tray.items.length < MAX_TRAY_CARDS
      ? trayCardWidth(graphic.tray.items.length + 1, shownTrayWidth, oneRowTray)
      : boardCardWidth;

  // Every card and where it's drawn: the board's, then the tray's
  const boardPlacements = type.layout(graphic);
  const trayPlacements = trayShown
    ? layoutTray(graphic.tray, shownTrayWidth, oneRowTray).map((p) => ({
        ...p,
        x: p.x + trayLeft - trayPan,
        y: p.y + trayTop,
      }))
    : [];

  const placements = [...boardPlacements, ...trayPlacements];

  // Cards not drawn yet while copies of them fly in from the sidebar (flyIn), and where
  // each lands: its spot on the board or in the tray on screen, read every frame (from the latest render)
  // so it follows the board as it rescales or the page scrolls
  const [arriving, setArriving] = React.useState<ReadonlySet<string>>(new Set());
  const landingRef = React.useRef({ placements, scale, boardLeft });
  // Whether the tray is still sliding in (the board's scale and the tray's spots not yet
  // where they settle)
  const trayRevealingRef = React.useRef(false);
  // Before the browser's next frame, so the flights' first frame sees the cards just added
  React.useLayoutEffect(() => {
    landingRef.current = { placements, scale, boardLeft };
    trayRevealingRef.current = trayShown && trayOpen < 1;
  });
  const stopFlights = React.useRef(new Set<() => void>());
  React.useEffect(() => {
    const stops = stopFlights.current;
    return () => stops.forEach((stop) => stop());
  }, []);
  // Measured once a frame: the board's place on screen, then each card's spot from it
  const landing = () => {
    const board = stageRef.current?.container().getBoundingClientRect();
    const { placements: places, scale: s, boardLeft: left } = landingRef.current;
    return (id: string) => {
      const place = places.find((p) => p.item.id === id);
      if (!board || !place) return null;
      return {
        left: board.left + (left + place.x) * s,
        top: board.top + place.y * s,
        width: place.width * s,
        height: place.height * s,
        radius: ((CARD_CORNER_RADIUS * place.width) / CARD_WIDTH) * s,
      };
    };
  };

  // A card shown large in the middle of the window (View, in the card menu; a split card
  // shows both its cards), grown from its place on the board and shrunk back to it when
  // anything is pressed or Escape. Like the card menu, it stays on screen while it closes.
  // A board card's `id`, or for a search result (View in its menu) where it grows from
  // (`from`: its thumbnail's center and height on screen) and where focus goes back to
  const [viewing, setViewing] = React.useState<{
    id?: string;
    faces: CardFace[];
    from?: { x: number; y: number; height: number };
    returnTo?: HTMLElement | null;
  } | null>(null);
  const [shownView, setShownView] = React.useState(viewing);
  if (viewing && viewing !== shownView) setShownView(viewing);
  const viewClosing = !viewing && shownView !== null;
  React.useEffect(() => {
    if (!viewClosing) return;
    // Just after the 180ms shrink (Editor.module.css), as the card menu's timer does
    const timer = setTimeout(() => setShownView(null), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [viewClosing]);
  // Opening moves focus to the view, so it's announced; closing puts focus back on the
  // board, where the viewed card stays selected (the menu it was opened from has closed)
  const viewerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!viewing) return;
    const back = viewing.returnTo ?? boardBoxRef.current;
    viewerRef.current?.focus({ preventScroll: true });
    return () => back?.focus({ preventScroll: true });
  }, [viewing]);
  React.useEffect(() => {
    if (!viewing) return;
    const close = () => setViewing(null);
    // It's modal: keys stop here, so the page's shortcuts (Delete removing the viewed card)
    // don't reach the board behind it, and Tab stays on it (the page behind is inert)
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === 'Tab') e.preventDefault();
      if (e.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [viewing]);
  // Where the cards grow from and shrink back to: the card on the board (or a search
  // result's thumbnail), as a transform of the cards' place in the middle (--from),
  // measured without that transform
  const viewRef = React.useRef<HTMLDivElement>(null);
  const viewedPlace = placements.find((p) => p.item.id === shownView?.id);
  const viewedFrom = shownView?.from;
  React.useLayoutEffect(() => {
    const cards = viewRef.current;
    const stage = stageRef.current;
    if (!cards || !stage) return;
    let origin = viewedFrom;
    if (viewedPlace) {
      const board = stage.container().getBoundingClientRect();
      origin = {
        x: board.left + (boardLeft + viewedPlace.x + viewedPlace.width / 2) * scale,
        y: board.top + (viewedPlace.y + viewedPlace.height / 2) * scale,
        height: viewedPlace.height * scale,
      };
    }
    if (!origin) return;
    const dx = origin.x - (cards.offsetLeft + cards.offsetWidth / 2);
    const dy = origin.y - (cards.offsetTop + cards.offsetHeight / 2);
    const shrink = origin.height / cards.offsetHeight;
    cards.style.setProperty('--from', `translate(${dx}px, ${dy}px) scale(${shrink})`);
    // The card's place by value: placements are new objects every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewedPlace?.x,
    viewedPlace?.y,
    viewedPlace?.width,
    viewedPlace?.height,
    viewedFrom,
    viewClosing,
    scale,
  ]);
  // The graphic's targets, then the card tray while it shows
  const boardTargets = type.targets(graphic);
  // The card tray is always a choice, even while it's off: adding a card turns it on
  const targets = [
    ...boardTargets,
    { name: 'Card Tray', color: graphic.tray.color, outlined: true },
  ];
  // The set filter's ticks: the board's tier colors, or a new tier list's on a board
  // without them
  const targetColors = boardTargets.flatMap((t) => (t.color ? [t.color] : []));
  const tickColors = targetColors.length ? targetColors : DEFAULT_TIERS.map(([, color]) => color);
  const targetIndex = Math.min(target, targets.length - 1);
  // The Add to choice stays on its target as the others come and go (a tier added or
  // removed, or put back by undo): it follows its target's id to its new place, takes the
  // one now in its place if it's gone, and the card tray stays the card tray
  const targetIds = boardTargets.map((t) => t.id ?? '');
  const targetIdsKey = targetIds.join(' ');
  const lastTargetIds = React.useRef(targetIds);
  React.useEffect(() => {
    const before = lastTargetIds.current;
    lastTargetIds.current = targetIds;
    if (target >= before.length) {
      setTarget(targetIds.length);
      return;
    }
    const at = before[target] ? targetIds.indexOf(before[target]) : -1;
    setTarget(at >= 0 ? at : Math.min(target, targetIds.length - 1));
    // Only when the targets themselves change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIdsKey]);

  // Changes the board showing
  const setGraphic = React.useCallback(
    (change: (graphic: Graphic) => Graphic) =>
      setDoc((d) => ({ ...d, graphics: { ...d.graphics, [d.kind]: change(currentGraphic(d)) } })),
    []
  );

  // Undo and redo. Each board type keeps its own history of its board (switching types
  // isn't a step), taken from every change to it, so nothing has to remember to record:
  // changes to settings (colors, names) within HISTORY_MERGE of each other are one step,
  // but cards and ink changing always start one. Kept for the visit only. Keys only: buttons
  // would take room under the board.
  const historyRef = React.useRef<Partial<Record<GraphicKind, History>>>({});
  const lastDoc = React.useRef(doc);
  // The change undo or redo itself makes, which isn't recorded
  const restoring = React.useRef<Graphic | null>(null);
  React.useEffect(() => {
    const before = lastDoc.current.graphics[doc.kind];
    const now = doc.graphics[doc.kind];
    const sameKind = lastDoc.current.kind === doc.kind;
    lastDoc.current = doc;
    if (!sameKind) {
      // A change on the board switched to is a step of its own, and a toast's Undo was
      // for the other board
      lastChange.current = 0;
      setToast((t) => (t?.undo ? { ...t, undo: undefined } : t));
      return;
    }
    // The pen's and eraser's settings aren't steps
    if (!before || !now || before === now || toolsOnly(before, now)) return;
    // A card that went without the editor taking it (a removed tier's that didn't fit in
    // the card tray) takes its selection and a replacement being picked with it
    const ids = cardIds(now);
    setSelectedId((id) => (id && ids.has(id) ? id : null));
    setPicking((p) => (p && ids.has(p.id) ? p : null));
    // A toast's Undo is for the change it reports: the first change after it's shown;
    // any later one (or an undo or redo) takes the button away
    setToast((t) =>
      t?.undo === 'waiting' && restoring.current !== now
        ? { ...t, undo: 'armed' }
        : t?.undo
          ? { ...t, undo: undefined }
          : t
    );
    if (restoring.current === now) {
      restoring.current = null;
      return;
    }
    // Only settings changes merge, and only into a step of settings changes
    const at = performance.now();
    const settingsOnly = cardsAndInk(before) === cardsAndInk(now);
    const merge = settingsOnly && at - lastChange.current < HISTORY_MERGE;
    lastChange.current = settingsOnly ? at : 0;
    const h = historyRef.current[doc.kind] ?? NO_HISTORY;
    // Still the same step (undo and redo always start a new one, so nothing to redo)
    if (merge && h.past.length) return;
    const past = [...h.past, before].slice(-HISTORY_LIMIT);
    historyRef.current = { ...historyRef.current, [doc.kind]: { past, future: [] } };
  }, [doc]);

  // Puts back the board from one step back (undo) or forward (redo). The card menu closes
  // (its card may have moved); a card that's no longer there takes its selection and
  // replacement being picked with it.
  const stepHistory = React.useCallback((back: boolean) => {
    const d = lastDoc.current;
    const h = historyRef.current[d.kind] ?? NO_HISTORY;
    const now = currentGraphic(d);
    const step = back ? h.past.at(-1) : h.future[0];
    if (!step) return;
    // The tools stay as they are now
    const next = { ...step, ...toolSettings(now) } as Graphic;
    historyRef.current = {
      ...historyRef.current,
      [d.kind]: back
        ? { past: h.past.slice(0, -1), future: [now, ...h.future] }
        : { past: [...h.past, now], future: h.future.slice(1) },
    };
    // The next change is a step of its own
    lastChange.current = 0;
    restoring.current = next;
    setDoc((doc) => ({ ...doc, graphics: { ...doc.graphics, [doc.kind]: next } }));
    const ids = cardIds(next);
    setSelectedId((id) => (id && ids.has(id) ? id : null));
    setCardMenu(null);
    setPicking((p) => (p && ids.has(p.id) ? p : null));
  }, []);

  // ⌘Z (Ctrl+Z) undoes and ⇧⌘Z (Ctrl+Shift+Z, Ctrl+Y) redoes, except in a text field,
  // which keeps its own. Viewing a card stops them, as it does every key.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      const key = shortcutKey(e);
      // Y only with Ctrl (⌘Y is the browser's History on a Mac)
      if (key !== 'z' && !(key === 'y' && e.ctrlKey)) return;
      e.preventDefault();
      stepHistory(key === 'z' && !e.shiftKey);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepHistory]);

  // Shows another board type's board (kept from when it was last used, or new)
  function showBoard(kind: GraphicKind) {
    setDoc((d) =>
      d.graphics[kind]
        ? { ...d, kind }
        : { ...d, kind, graphics: { ...d.graphics, [kind]: typeOf(kind).create() } }
    );
    setSelectedId(null);
    setCardMenu(null);
    setPicking(null);
    setTarget(0);
    setTool(DEFAULT_TOOL);
  }

  // Shows a shared board in place of this device's board of its type, which it replaces,
  // with a toast offering Undo (⌘Z too, while the visit lasts). Switching types isn't a
  // step, so it switches first, on its own, and then replaces the board: a step undo can
  // take back.
  function openShared(shared: Graphic) {
    // (making that type's board if it's never been used here, as showBoard does)
    if (docRef.current.kind !== shared.kind)
      flushSync(() =>
        setDoc((d) => ({
          ...d,
          kind: shared.kind,
          graphics: {
            ...d.graphics,
            [shared.kind]: d.graphics[shared.kind] ?? typeOf(shared.kind).create(),
          },
        }))
      );
    setDoc((d) => ({ ...d, graphics: { ...d.graphics, [shared.kind]: shared } }));
    setSelectedId(null);
    setCardMenu(null);
    setPicking(null);
    setTarget(0);
    setTool(DEFAULT_TOOL);
    showToast('Shared Board Opened', { undo: true });
  }

  // A share link opened, waiting on whether to replace this device's board of its type
  // with it (the dialog), until it's answered
  const [sharedBoard, setSharedBoard] = React.useState<Graphic | null>(null);
  const sharedDialogRef = React.useRef<HTMLDialogElement>(null);
  // The link's done with once it's answered (or opened, or unreadable): a reload doesn't
  // ask again
  const clearShareHash = () => {
    if (isShareHash(window.location.hash))
      history.replaceState(null, '', window.location.pathname + window.location.search);
  };
  // A share link opens on load, or when one is pasted into this tab (only its hash changes).
  // It opens at once when this device's board of its type has nothing on it; otherwise it
  // asks first.
  React.useEffect(() => {
    let current = true;
    // Each read's number: a slower earlier one (two links pasted quickly) is dropped
    let reads = 0;
    const check = async () => {
      if (!isShareHash(window.location.hash)) return;
      const read = ++reads;
      const shared = await readShareHash(window.location.hash);
      if (!current || read !== reads) return;
      if (!shared) {
        clearShareHash();
        showToast("Couldn't Open This Link");
        return;
      }
      const mine = docRef.current.graphics[shared.kind];
      if (!mine || (!typeOf(mine.kind).hasContents(mine) && !mine.tray.items.length)) {
        clearShareHash();
        openShared(shared);
      } else {
        // The dialog's modal, and View would keep its keys
        setViewing(null);
        setSharedBoard(shared);
      }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => {
      current = false;
      window.removeEventListener('hashchange', check);
    };
    // Once, on load; openShared and showToast only set state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    const dialog = sharedDialogRef.current;
    if (!sharedBoard || !dialog) return;
    if (!dialog.open) dialog.showModal();
    // It's modal: the page's shortcuts (Delete, ⌘Z, Ctrl+\) are on the window, so keys
    // stop here even when focus has fallen to the page's body, as View's do. Escape still
    // reaches the dialog itself (it's the dialog's own cancel).
    const onKey = (e: KeyboardEvent) => {
      if (!(e.target instanceof Node && dialog.contains(e.target))) e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [sharedBoard]);
  // Either way focus goes to the board, as it does when View closes
  const answerShared = (open: boolean) => {
    sharedDialogRef.current?.close();
    clearShareHash();
    if (open && sharedBoard) openShared(sharedBoard);
    setSharedBoard(null);
    boardBoxRef.current?.focus({ preventScroll: true });
  };

  // Copies a link to the board showing, card tray and all
  // (one too big for a link to open isn't made). The clipboard gets the link as a promise
  // inside the click, since Safari refuses a write made after an await.
  async function copyLink() {
    if (sharedCards(graphic) > MAX_SHARED_CARDS) {
      showToast(`Too Many Cards to Share (${MAX_SHARED_CARDS} at Most)`);
      return;
    }
    const link = shareLink(graphic);
    try {
      if (typeof ClipboardItem === 'undefined') await navigator.clipboard.writeText(await link);
      else
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': link.then((text) => new Blob([text], { type: 'text/plain' })),
          }),
        ]);
      showToast(
        (await link).length > DISCORD_MESSAGE_LIMIT
          ? 'Link Copied\nToo Long for a Discord Message'
          : 'Link Copied'
      );
    } catch {
      showToast("Couldn't Copy the Link");
    }
  }

  // Applies a placed card, or shows why it couldn't be placed
  const applyPlaced = (placed: Placed<Graphic>) => {
    if ('error' in placed) {
      showToast(placed.error);
      return;
    }
    setGraphic(() => placed);
  };

  // Autosave
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {}
  }, [doc]);

  // The board fills the workspace, leaving room for the toolbar around it: from b8 up as
  // much as fits beside the sidebar, and under b8 its width, as long as the workspace stays
  // within BOARD_SHARE of the page's height (measured from the page, never the workspace,
  // whose height follows the board's). Exports are always full size.
  // (before paint, so a frame of the tray's slide never paints at the last frame's scale)
  React.useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const board = boardRef.current;
    const box = boardBoxRef.current;
    const page = pageRef.current;
    if (!workspace || !board || !box || !page) return;
    const fit = () => {
      const style = getComputedStyle(workspace);
      const room =
        workspace.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const above = workspace.getBoundingClientRect().top - page.getBoundingClientRect().top;
      const outer = wide
        ? workspace.clientHeight
        : fold > 0
          ? // Folded, or on the way: everything but the sidebar as it is
            page.clientHeight - (sideRef.current?.offsetHeight ?? 0) - above
          : page.clientHeight * BOARD_SHARE - above;
      const height = outer - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const around = board.offsetHeight - box.offsetHeight;
      // The card tray and the gap above it, when it shows
      const tray = TRAY_GAP * trayOpen;
      const designHeight = BOARD_HEIGHT + shownTrayHeight;
      // (under b8 the tray takes whatever width the board leaves, so only the board's counts)
      const next = Math.min(
        room / (wide ? stageWidth : width),
        (height - around - tray) / designHeight
      );
      setTrayRoom(Math.floor(room));
      // Folded on a phone, a board limited by the width leaves height under it: the tray's
      // cards fill it (at the width-limited scale, which the tray doesn't change), as wide as
      // FOLDED_TRAY_VISIBLE of them across allows; rounded, so the fit settles
      const widthScale = room / (width || 1);
      const fillHeight = (height - around - TRAY_GAP) / widthScale - BOARD_HEIGHT;
      setTrayFill(
        wide ? 0 : Math.floor(rowCardWidthFor(fillHeight, room / widthScale, FOLDED_TRAY_VISIBLE))
      );
      // Rounded down, so a fractional pixel never overflows the workspace into a scrollbar
      setScale(Math.max(0, Math.floor(next * 1000) / 1000));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(workspace);
    observer.observe(board);
    observer.observe(page);
    return () => {
      observer.disconnect();
    };
  }, [wide, trayOpen, shownTrayHeight, stageWidth, width, fold]);

  // The floating logo's size: the biggest that clears the board (and its toolbar) by
  // LOGO_CLEARANCE. Measured whenever the workspace or the board changes size: as the
  // sidebar slides, the board moves to stay centered even once its scale settles.
  React.useEffect(() => {
    const logo = floatingLogoRef.current;
    const board = boardRef.current;
    const workspace = workspaceRef.current;
    if (!sidebarCollapsed || !logo || !board || !workspace) return;
    const measure = () => {
      const box = logo.getBoundingClientRect();
      const b = board.getBoundingClientRect();
      const left = box.left + parseFloat(getComputedStyle(logo).paddingLeft);
      const top =
        box.top +
        parseFloat(getComputedStyle(logo).paddingTop) +
        (box.height - parseFloat(getComputedStyle(logo).paddingTop) - LOGO_HEIGHT) / 2;
      const clears = (width: number) =>
        left + width + LOGO_CLEARANCE <= b.left ||
        top + LOGO_HEIGHT + LOGO_CLEARANCE <= b.top ||
        b.right + LOGO_CLEARANCE <= left ||
        b.bottom + LOGO_CLEARANCE <= top;
      // Only the binder mark, never the wordmark
      const size = clears(LOGO_MARK_WIDTH) ? 'mark' : null;
      if (size) logo.dataset.size = size;
      else delete logo.dataset.size;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    observer.observe(board);
    return () => observer.disconnect();
  }, [sidebarCollapsed]);

  // Canvas text needs the font loaded first; next/font gives it a generated family name,
  // set on this route's layout
  React.useEffect(() => {
    const box = boardBoxRef.current;
    const family = box && getComputedStyle(box).getPropertyValue('--font-inter').trim();
    if (!family) return;
    document.fonts.load(`900 30px ${family}`).then(() => setFontFamily(family));
    const figtree = box && getComputedStyle(box).getPropertyValue('--font-figtree').trim();
    if (figtree) document.fonts.load(`400 14px ${figtree}`).then(() => setInterfaceFont(figtree));
  }, []);

  const removeCard = React.useCallback(
    (id: string) => {
      setGraphic((g) => mapEveryCard(g, (i) => (i.id === id ? null : i)));
      setSelectedId((selected) => (selected === id ? null : selected));
    },
    [setGraphic]
  );

  // Only a card that shows: not one in a card tray that's turned off
  const selectedShown = placements.some((p) => p.item.id === selectedId);
  const removeSelected = React.useCallback(() => {
    if (!selectedId || !selectedShown) return;
    removeCard(selectedId);
  }, [selectedId, selectedShown, removeCard]);

  // Turns the card tray on or off (its cards stay saved). Turned off while it's the Add to
  // choice: back to the first tier, so the next card doesn't quietly turn it on again
  function showTray(enabled: boolean) {
    setGraphic((g) => ({ ...g, tray: { ...g.tray, enabled } }));
    if (!enabled && targetIndex === boardTargets.length) setTarget(0);
  }

  // Empties the board showing (its cards, and the blank canvas's ink), keeping its names
  // and colors. Its cards' menu, selection and a replacement being picked go with them.
  function clearBoard() {
    setGraphic((g) => typeOf(g.kind).clear(g));
    setSelectedId(null);
    setCardMenu(null);
    setPicking(null);
    showToast('Board Cleared', { undo: true });
  }

  // Empties the card tray, keeping it on; a selected tray card goes with it
  function clearTray() {
    const count = graphic.tray.items.length;
    const ids = new Set(graphic.tray.items.map((i) => i.id));
    setGraphic((g) => ({ ...g, tray: { ...g.tray, items: [] } }));
    setSelectedId((selected) => (selected && ids.has(selected) ? null : selected));
    setPicking((p) => (p && ids.has(p.id) ? null : p));
    if (count) showToast(removedMessage(count), { undo: true });
  }

  // Resets the board's styles (names, colors, card size, the card tray's color) to a new
  // board's, keeping everything on it
  function restyleBoard() {
    setGraphic((g) => typeOf(g.kind).restyle(g));
    showToast('Board Styles Reset', { undo: true });
  }

  // Clear All: the board as new, but for its tools; a showing card tray is emptied, kept
  // on, and a hidden one keeps its cards, as it promises. Add Cards starts over too.
  function clearAll() {
    setGraphic((g) => {
      const type = typeOf(g.kind);
      const next = type.restyle(type.clear(g));
      return trayShown ? { ...next, tray: { ...next.tray, items: [] } } : next;
    });
    setSelectedId(null);
    setCardMenu(null);
    setPicking(null);
    setQuery('');
    clearSearch();
    showToast('All Cleared', { undo: true });
  }

  // Clear Board's choices: only those that would change something, and none that would do
  // the same as another. The board's cards and ink, keeping its styles; a showing card
  // tray's cards; its styles reset; and Clear All, when that's more than one of them (it
  // stands in for clearing the board and the tray together, keeping the menu short).
  const hasContents = type.hasContents(graphic);
  const trayCards = trayShown ? graphic.tray.items.length : 0;
  const styled = JSON.stringify(type.restyle(graphic)) !== JSON.stringify(graphic);
  const boardClears: ClearChoice[] = [
    ...(hasContents ? [{ label: 'Clear Board', onSelect: clearBoard }] : []),
    ...(trayCards ? [{ label: 'Clear Card Tray', onSelect: clearTray }] : []),
    ...(styled ? [{ label: 'Reset Board Styles', onSelect: restyleBoard }] : []),
    ...([hasContents, trayCards, styled].filter(Boolean).length > 1
      ? [{ label: 'Clear All', onSelect: clearAll }]
      : []),
  ];

  // Pressing anywhere off the board (the sidebar, the toolbar) deselects, as pressing the
  // board's background does; the card menu is on the board, so using it keeps the card.
  // Not while picking a replacement (the outline shows which card it replaces) or viewing
  // (the press that closes the view keeps the card, as Escape does).
  const keepSelection = picking !== null || shownView !== null;
  React.useEffect(() => {
    if (!selectedId || keepSelection) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && boardBoxRef.current?.contains(e.target)) return;
      setSelectedId(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [selectedId, keepSelection]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, textarea, select');
      if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) removeSelected();
      if (e.key === 'Escape') {
        setCardMenu(null);
        setPicking(null);
      }
      if (!typing && e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSelected]);

  // The card menu closes on any press outside it (a press on a card reopens it on click)
  React.useEffect(() => {
    if (!cardMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && cardMenuRef.current?.contains(e.target))) setCardMenu(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [cardMenu]);

  // Cards before any # line go in the card tray (or the board: `ungroupedImport`); each #
  // group goes to the board, as the graphic places them (a tier list: the next tier)
  async function runImport() {
    const { tray, groups } = parseImport(importText);
    const lines = [...tray, ...groups.flatMap((g) => g.cards)];
    // `#` lines alone still rename tiers
    if (!lines.length && !groups.some((g) => g.name)) {
      showToast('No Cards to Import');
      return;
    }
    setBusy(true);
    showToast('Importing…', { stay: true });
    let resolved: Awaited<ReturnType<typeof resolveCard>>[];
    try {
      resolved = await mapLimit(lines, 4, resolveCard);
    } catch {
      // Offline, or a lookup failed outright: nothing was added
      showToast("Couldn't Import; Try Again");
      return;
    } finally {
      setBusy(false);
    }
    const found = new Map(lines.map((line, i) => [line, resolved[i]]));
    const errors: string[] = [];
    for (const line of lines) {
      if (!found.get(line)) {
        const name = line.split ? `${line.name} / ${line.split.name}` : line.name;
        errors.push(`Line ${line.line}: Couldn't Find “${name}”`);
      }
    }
    const ungrouped = tray.flatMap((line) => found.get(line) ?? []);
    // Placed on the board as it is now (it may have changed while cards were looking up),
    // so the counts and messages match what happened
    const current = currentGraphic(docRef.current);
    const currentType = typeOf(current.kind);
    // Cards before the first # go in the card tray, or on the board where the type says
    const toBoard = currentType.ungroupedImport === 'board';
    const trayItems = toBoard ? [] : ungrouped;
    const resolvedGroups = [
      ...(toBoard && ungrouped.length ? [{ items: ungrouped }] : []),
      ...groups.map((g) => ({
        name: g.name,
        items: g.cards.flatMap((line) => found.get(line) ?? []),
      })),
    ];
    let next = current;
    const added: string[] = [];
    if (trayItems.length) {
      const placed = importTrayCards(next.tray, trayItems);
      const n = placed.tray.items.length - next.tray.items.length;
      if (n) added.push(`Added ${cardCount(n)} to the Card Tray`);
      next = { ...next, tray: placed.tray };
      errors.push(...placed.errors);
    }
    if (resolvedGroups.length) {
      const placed = currentType.importCards(next, resolvedGroups);
      const n = currentType.layout(placed.graphic).length - currentType.layout(next).length;
      if (n) added.push(`Added ${cardCount(n)} to the Board`);
      next = placed.graphic;
      errors.push(...placed.errors);
    }
    setGraphic(() => next);
    // The first few problems, so a long list doesn't cover the board
    const more = errors.length - MAX_TOAST_PROBLEMS;
    showToast(
      [
        ...added,
        ...errors.slice(0, MAX_TOAST_PROBLEMS),
        ...(more > 0 ? [`And ${more} More ${more === 1 ? 'Problem' : 'Problems'}`] : []),
      ].join('\n') || 'No Cards Found',
      // Any change to the board: cards added, or only tiers named or added for its groups
      { undo: JSON.stringify(next) !== JSON.stringify(current) }
    );
  }

  // Stops the search under way and any waiting to start: a newer one replaces them
  function cancelSearch() {
    searchCount.current++;
    searchAbort.current?.abort();
    clearTimeout(searchTimer.current);
  }

  function clearSearch() {
    cancelSearch();
    setSearched('');
    setResults([]);
    setSearchedFor(null);
    setSearchError(null);
    setSearching(false);
  }

  // A blank search lists the filter's sets whole, or clears the results if there are none.
  // Starting one closes Bulk import, so its results show.
  async function search(text: string, options = searchOptions) {
    if (!text.trim() && !options.sets.length) {
      clearSearch();
      return;
    }
    cancelSearch();
    const count = searchCount.current;
    const abort = new AbortController();
    searchAbort.current = abort;
    setSearched(text.trim());
    setSearching(true);
    setImporting(false);
    try {
      const found = await searchCards(text.trim(), options, abort.signal);
      if (count !== searchCount.current) return;
      setResults(found);
      setSearchedFor({ query: text.trim(), sets: options.sets });
      setSearchError(null);
    } catch (e) {
      if (count !== searchCount.current) return;
      setResults([]);
      setSearchedFor(null);
      setSearchError(e instanceof Error ? e.message : 'Search Failed');
    } finally {
      if (count === searchCount.current) setSearching(false);
    }
  }

  // New filters or a new sort order apply to the next search, and rerun the current one
  // (with no search, ticking sets lists them) once they've stopped changing for a moment,
  // so ticking several sets in a row runs one search
  function changeSearchOptions(options: SearchOptions) {
    setSearchOptions(options);
    cancelSearch();
    searchTimer.current = setTimeout(() => search(searched, options), SEARCH_DELAY);
  }

  const findCard = (id: string | undefined) => placements.find((p) => p.item.id === id)?.item;

  const updateCard = (id: string, change: (item: CardItem) => CardItem) =>
    setGraphic((g) => mapEveryCard(g, (i) => (i.id === id ? change(i) : i)));

  // Puts the search in picking mode for a card's top or bottom face. Replacing searches
  // that face's name (its other prints); a new split card starts with an empty search.
  function startPicking(id: string, part: 'top' | 'bottom') {
    const item = findCard(id);
    if (!item) return;
    const name = part === 'top' ? item.name : (item.split?.name ?? '');
    // Shown now, so the search box can be focused
    flushSync(() => {
      setTab('add');
      setImporting(false);
      setSidebarHidden(false);
    });
    setPicking({ id, part });
    setQuery(name);
    searchInputRef.current?.scrollIntoView({ block: 'center' });
    searchInputRef.current?.focus();
    search(name);
  }

  const pickingCard = findCard(picking?.id);
  // Making a split card (picking the bottom half of a card that isn't split yet) shows in
  // the Add to picker, when there is one, instead of a message and Cancel
  const splitPicker =
    picking?.part === 'bottom' &&
    pickingCard !== undefined &&
    !pickingCard.split &&
    targets.length > 1;

  type CardMenu = NonNullable<typeof cardMenu>;
  // A result dropped on a card goes where it was dropped: the board, or the card tray
  const addToTarget = ({ dropped }: CardMenu) =>
    dropped && dropped.point.y > BOARD_HEIGHT ? 'Add to card tray' : `Add to ${type.targetNoun}`;

  // A point on the board (design pixels from its corner) measured from the tray's corner
  // (and the one-row tray's scroll: its cards' own terms)
  const inTray = (point: Point) => ({ x: point.x - trayLeft + trayPan, y: point.y - trayTop });
  const dropIndex = (tray: Tray, id: string, point: Point) =>
    trayDropIndex(tray, id, point, shownTrayWidth, oneRowTray);

  // Adds a card where it was dropped: in the card tray (or the gap above it) by position,
  // or where the graphic puts it
  const dropAt = (item: CardItem, point: Point): Placed<Graphic> =>
    trayShown && point.y > BOARD_HEIGHT
      ? withTray(
          graphic,
          insertTrayCard(graphic.tray, item, dropIndex(graphic.tray, '', inTray(point)))
        )
      : type.dropCard(graphic, item, point);

  // The selected card as a press on the board began (before the press deselected it)
  const pressSelection = React.useRef<string | null>(null);
  // Whether its menu was open then: a tap opens the menu, so a tap on another tier moves the
  // card, but one on its own tier (or the tray it's in) only closes the menu
  const pressMenuOpen = React.useRef(false);

  // A tier (or the card tray, the last target) clicked on the board: it's the Add to choice
  // from then on, and with a card selected, the card moves to its end and stays selected.
  // The blank canvas's cards have no place in a target, so they only move into the tray.
  function pickTargetOnBoard(index: number, emptySpace: boolean) {
    const id = emptySpace ? pressSelection.current : null;
    pressSelection.current = null;
    setTarget(index);
    const place = id ? placements.find((p) => p.item.id === id) : undefined;
    if (!id || !place) return;
    const inTrayNow = trayPlacements.some((p) => p.item.id === id);
    const toTray = index === boardTargets.length;
    const ownPlace = toTray
      ? inTrayNow
      : !inTrayNow && 'tierIndex' in place && place.tierIndex === index;
    if (pressMenuOpen.current && ownPlace) return;
    moveCardToTarget(id, index);
  }

  // Moves a card on the board or in the tray to the end of a target (the card tray last),
  // keeping it selected: a tier clicked with it selected, or presentation mode's Add to
  function moveCardToTarget(id: string, index: number) {
    const place = placements.find((p) => p.item.id === id);
    if (!place) return;
    const inTrayNow = trayPlacements.some((p) => p.item.id === id);
    const toTray = index === boardTargets.length;
    let placed: Placed<Graphic> | null = null;
    if (toTray && inTrayNow) {
      // Already last: nothing to move
      if (graphic.tray.items.at(-1)?.id === id) return;
      placed = { ...graphic, tray: moveTrayCard(graphic.tray, id, graphic.tray.items.length - 1) };
      // The one-row tray scrolls to its end, where the card now is
      setTrayPan(Infinity);
    } else if (toTray) {
      placed = withTray(
        type.mapCards(graphic, (i) => (i.id === id ? null : i)),
        insertTrayCard(graphic.tray, place.item)
      );
    } else if (inTrayNow) {
      const without = { ...graphic, tray: mapTray(graphic.tray, (i) => (i.id === id ? null : i)) };
      placed = type.addCard(without, place.item, index);
    } else if (type.moveCardTo) {
      placed = type.moveCardTo(graphic, id, index);
    }
    // (moveCardTo gives the graphic back as it was when the card's already last there)
    if (!placed || placed === graphic) return;
    setCardMenu(null);
    applyPlaced(placed);
    if (!('error' in placed)) setSelectedId(id);
  }

  // A board card dropped in the card tray moves there; the graphic moves it otherwise
  const boardCardDrop = (id: string, x: number, y: number) => {
    const place = boardPlacements.find((p) => p.item.id === id);
    if (!trayShown || !place || y + place.height / 2 <= BOARD_HEIGHT) return false;
    const point = inTray({ x: x + place.width / 2, y: y + place.height / 2 });
    const placed = withTray(
      typeOf(graphic.kind).mapCards(graphic, (i) => (i.id === id ? null : i)),
      insertTrayCard(graphic.tray, place.item, dropIndex(graphic.tray, '', point))
    );
    applyPlaced(placed);
    return true;
  };

  // A tray card dropped in the tray moves within it; dropped on the board, the graphic
  // places it at its center, as it would a search result
  const trayCardDrop = (id: string, x: number, y: number) => {
    const place = trayPlacements.find((p) => p.item.id === id);
    if (!place) return;
    const center = { x: x + place.width / 2, y: y + place.height / 2 };
    if (center.y > BOARD_HEIGHT) {
      const point = inTray(center);
      setGraphic((g) => ({
        ...g,
        tray: moveTrayCard(g.tray, id, dropIndex(g.tray, id, point)),
      }));
      return;
    }
    const without = { ...graphic, tray: mapTray(graphic.tray, (i) => (i.id === id ? null : i)) };
    applyPlaced(type.dropCard(without, place.item, center));
  };

  // The targets a card can move to from its menu (by index in `targets`): every one, but
  // not the tray it's already in, and not the board's own for a board card on a graphic
  // whose cards have no place in a target (the blank canvas)
  // (nor the tier it's already in)
  const moveChoices = (id: string) => {
    const inTrayNow = trayPlacements.some((p) => p.item.id === id);
    const place = placements.find((p) => p.item.id === id);
    const ownTier = !inTrayNow && place && 'tierIndex' in place ? place.tierIndex : -1;
    return targets
      .map((_, i) => i)
      .filter((i) =>
        i === boardTargets.length
          ? !inTrayNow
          : i !== ownTier && (inTrayNow || type.moveCardTo !== undefined)
      );
  };

  // Its row's name: a card already on the board moves ("Move to Tier"); one in the tray is
  // added, as a search result is ("Add to Tier")
  const moveLabel = (id: string) =>
    `${trayPlacements.some((p) => p.item.id === id) ? 'Add' : 'Move'} to ${type.targetNoun}`;

  // The card menu's items: the tray's own menu, a clicked card's (a tray card's ending with
  // Clear Card Tray, a row opening a flyout), or a search result's dropped on a card
  const cardMenuItems = (menu: CardMenu) => {
    const { id, dropped } = menu;
    // The tray's own menu: Hide Card Tray, then while it holds cards, Clear Card Tray
    if (id === TRAY_MENU) {
      return graphic.tray.items.length ? ['Hide card tray', 'Clear card tray'] : ['Hide card tray'];
    }
    const split = findCard(id)?.split;
    if (dropped) {
      return split
        ? ['Replace top half', 'Replace bottom half', addToTarget(menu)]
        : ['Add as split card', addToTarget(menu)];
    }
    // Presentation mode (the sidebar folded on a phone): only what doesn't need the
    // sidebar, moving the card through a flyout of the places it can go
    if (presenting) {
      return moveChoices(id).length ? ['View', MOVE_TO, 'Remove card'] : ['View', 'Remove card'];
    }
    const items = split
      ? ['View', 'Remove card', 'Replace top half', 'Replace bottom half', 'Swap halves', 'Unsplit']
      : // (Replace Card is out for now; a split card's halves can still be replaced)
        ['View', 'Remove card', 'Make split card'];
    // A card in the tray can clear the whole tray, last (not the tray's only card, where
    // Remove Card does the same)
    const inTray = trayPlacements.some((p) => p.item.id === id);
    return inTray && graphic.tray.items.length > 1 ? [...items, 'Clear card tray'] : items;
  };

  // Clear Card Tray's flyout says how many it clears, kept up to date if cards come or go
  // meanwhile (a pool's still flying in), and closes if its row goes (the tray emptied, or
  // down to the menu's own card)
  // (Presentation mode's Add to row opens the menu's other flyout, which closes as its row
  // goes, too)
  if (cardMenu?.flyout) {
    const n = graphic.tray.items.length;
    const items = cardMenuItems(cardMenu);
    if (items.includes(MOVE_TO)) {
      // (its flyout's `flyout` is just whether it's open)
    } else if (!items.includes('Clear card tray')) {
      setCardMenu({ ...cardMenu, flyout: undefined });
    } else if (cardMenu.flyout !== n) {
      setCardMenu({ ...cardMenu, flyout: n });
    }
  }

  // The card menu's keys, as the search result menu's: arrows and Home/End move through its
  // items (or the flyout's), right opens Clear Card Tray's flyout and left goes back from it;
  // Escape in the flyout is its own, and elsewhere the page's (closing the menu)
  const onCardMenuKey = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const flyout = target.closest<HTMLElement>('[data-flyout]');
    const scope = flyout ?? cardMenuRef.current;
    if (!scope || !cardMenu) return;
    const items = [...scope.querySelectorAll<HTMLElement>('[role=menuitem]')].filter(
      (el) => flyout || !el.closest('[data-flyout]')
    );
    const at = items.indexOf(target);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && target.hasAttribute('aria-haspopup') && !cardMenu.flyout) {
      e.preventDefault();
      toggleTrayFlyout(cardMenu, target.dataset.row === MOVE_TO);
    }
    if (e.key === 'ArrowLeft' && flyout) {
      e.preventDefault();
      setCardMenu((m) => m && { ...m, flyout: undefined });
      trayFlyoutRowRef.current?.focus();
    }
  };

  // Clear Card Tray's row opens its flyout ("Clear N Cards"), focusing that, or closes it,
  // as the search result menu's Add to row does: a second step, so a click (or Enter
  // twice) never clears the tray by itself
  // (Presentation mode's Add to row opens its own the same way: `move`)
  function toggleTrayFlyout(menu: CardMenu, move = false) {
    if (menu.flyout) {
      setCardMenu({ ...menu, flyout: undefined });
      return;
    }
    flushSync(() => setCardMenu({ ...menu, flyout: move ? 1 : graphic.tray.items.length }));
    cardMenuRef.current?.querySelector<HTMLElement>('[data-flyout] [role=menuitem]')?.focus();
  }

  // Presentation mode's Add to flyout: the card moves there, and focus goes to the board,
  // not lost with the menu
  function moveFromMenu(id: string, index: number) {
    // (gone at once, as Hide and Clear's are: the card it was on is moving away)
    setShownMenu(null);
    setCardMenu(null);
    moveCardToTarget(id, index);
    boardBoxRef.current?.focus({ preventScroll: true });
  }

  // Runs a menu item. Hiding or clearing the tray moves what the menu was anchored to, so it
  // goes at once rather than folding closed in the wrong place.
  function runCardMenuItem(menu: CardMenu, label: string) {
    const { id, dropped } = menu;
    if (label === 'Hide card tray') {
      showTray(false);
      setShownMenu(null);
      // Its menu is gone with it: focus goes to the board, as closing View's does
      boardBoxRef.current?.focus({ preventScroll: true });
      // Where it went, and how to get it back
      showToast('Card Tray Hidden; Show It Again in Customize', { undo: true });
      return;
    }
    // A dropped result replaces a half, becomes the bottom half, or is added where it was
    // dropped
    if (dropped) {
      const face = toFace(dropped.card);
      if (label === 'Replace top half') updateCard(id, (i) => ({ ...i, ...face }));
      if (label === 'Replace bottom half' || label === 'Add as split card') {
        updateCard(id, (i) => ({ ...i, split: face }));
      }
      if (label === addToTarget(menu)) applyPlaced(dropAt(toItem(dropped.card), dropped.point));
      return;
    }
    if (label === 'View') {
      const item = findCard(id);
      if (item) setViewing({ id, faces: item.split ? [faceOf(item), item.split] : [faceOf(item)] });
    }
    if (label === 'Remove card') removeCard(id);
    if (label === 'Replace top half') startPicking(id, 'top');
    if (label === 'Make split card' || label === 'Replace bottom half') startPicking(id, 'bottom');
    if (label === 'Swap halves') {
      updateCard(id, (i) => (i.split ? { ...i, ...i.split, split: faceOf(i) } : i));
    }
    // Keeps the top card
    if (label === 'Unsplit') updateCard(id, (i) => ({ ...i, split: undefined }));
  }

  // Cards just added fly in from the sidebar, unless motion is reduced: a copy of each
  // leaves `thumb` (its own thumbnail, or for a pool's card past the preview, the preview's
  // thumbnails again in turn, so a big pool goes out in waves across the row), showing
  // that thumbnail's picture when it's its own (`own`), else `src`, for its spot on the
  // board or in the card tray, where the card is hidden until it lands (`arriving`). A card whose spot is
  // off screen (beside the sidebar, the workspace scrolled away from it) appears there at
  // once; a pool's cards instead scroll the tray into view first, then fly up to it.
  function flyIn(
    cards: { id: string; thumb: HTMLImageElement | undefined; own: boolean; src: string }[],
    { pool = false, onDone = () => {} } = {}
  ) {
    if (!cards.length) {
      onDone();
      return;
    }
    const ids = cards.map((c) => c.id);
    // Whether the last new card's spot (in the tray's lowest row) is partly off screen, once
    // the cards are laid out (React has drawn them by the next task; not the next frame,
    // which never comes in a hidden tab)
    const trayHidden = () => {
      const spot = landing()(ids[ids.length - 1]);
      return spot !== null && !wholeOnScreen(spot);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // No flight, but a pool still shows where its cards went, at once
      if (pool) {
        setTimeout(() => {
          if (trayHidden()) boardBoxRef.current?.scrollIntoView({ block: 'end' });
        });
      }
      onDone();
      return;
    }
    setArriving((a) => new Set([...a, ...ids]));
    // Calls onDone once every card has landed
    const flying = new Set(ids);
    const land = (landed: string[]) => {
      setArriving((a) => new Set([...a].filter((id) => !landed.includes(id))));
      landed.forEach((id) => flying.delete(id));
      if (!flying.size) onDone();
    };
    // Until they leave (a pool waiting for the page to scroll), landing them (before an
    // export, or on leaving the page) shows them and stops the wait
    let cleanUp = () => {};
    const waiting = () => {
      stopFlights.current.delete(waiting);
      cleanUp();
      land(ids);
    };
    stopFlights.current.add(waiting);
    // Once React has drawn the new cards (the next task) and any tray they turned on has slid
    // in, so where they land, and whether it's on screen, is measured where it settles
    const afterTrayReveal = (then: () => void) => {
      const check = window.setTimeout(() => {
        if (!trayRevealingRef.current) {
          then();
          return;
        }
        const wait = window.setTimeout(then, readDuration('--duration-move'));
        cleanUp = () => clearTimeout(wait);
      });
      cleanUp = () => clearTimeout(check);
    };
    const launch = () => {
      if (!stopFlights.current.delete(waiting)) return;
      cleanUp();
      // A copy shows what its thumbnail loaded (the proxy, if the CDN failed it), or its own
      // image if the thumbnail hasn't loaded yet
      const flights: Flight[] = cards.flatMap(({ id, thumb, own, src }) => {
        if (!thumb?.isConnected) return [];
        const box = thumb.getBoundingClientRect();
        // In a hidden panel (another tab was opened meanwhile): nowhere to fly from
        if (!box.width) return [];
        const from = {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          radius: parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 0,
        };
        return [{ id, src: (own && thumb.complete && thumb.currentSrc) || src, from }];
      });
      // Cards whose thumbnail has gone (a search replaced the pools) just appear
      const stay = ids.filter((id) => !flights.some((f) => f.id === id));
      if (stay.length) land(stay);
      if (!flights.length) return;
      let flying = flights.length;
      const stop = launchFlights(
        flights,
        landing,
        (landed) => {
          land(landed);
          flying -= landed.length;
          if (flying === 0) stopFlights.current.delete(stop);
        },
        { onScreenOnly: !pool }
      );
      stopFlights.current.add(stop);
    };
    if (!pool) {
      afterTrayReveal(launch);
      return;
    }
    // Scrolls the board's foot, the tray, into view if any of it is off screen (beside the
    // sidebar, where the workspace scrolls), and flies them when the scroll is over
    afterTrayReveal(() => {
      if (!trayHidden()) {
        launch();
        return;
      }
      const workspace = workspaceRef.current;
      workspace?.addEventListener('scrollend', launch);
      // On phones only iOS's keyboard scrolls the window, the one way the tray is off screen
      window.addEventListener('scrollend', launch);
      // Where scrollend isn't fired (or the scroll is cut short)
      const timer = window.setTimeout(launch, SCROLL_WAIT);
      cleanUp = () => {
        clearTimeout(timer);
        workspace?.removeEventListener('scrollend', launch);
        window.removeEventListener('scrollend', launch);
      };
      boardBoxRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
  }

  // Adds a search result to one of the Add to choices (the graphic's, or the card tray),
  // flying in from its thumbnail (`tile`'s image) when there is one
  function addResultTo(card: CardResult, index: number, tile?: HTMLElement) {
    const item = toItem(card);
    const placed =
      index === boardTargets.length
        ? withTray(graphic, insertTrayCard(graphic.tray, item))
        : type.addCard(graphic, item, index);
    applyPlaced(placed);
    if ('error' in placed || !tile) return;
    const thumb = tile.querySelector('img') ?? undefined;
    flyIn([{ id: item.id, thumb, own: true, src: card.thumb }]);
  }

  // A featured pool's cards go in the card tray, at the end, as many as fit (turning it on),
  // leaving out any already on the board or in the tray. Each flies there from its
  // thumbnail in the pool (`button`), or the last one's for cards past the preview.
  function addPool(pool: Pool, button: HTMLElement) {
    // Adding ends a split being made, as the result menu's choices do
    if (splitPicker) setPicking(null);
    const cards = loadablePoolCards(pool);
    if (!cards.length) {
      showToast("Couldn't Load This Pool");
      return;
    }
    const key = (face: CardFace) => `${face.set} ${face.number}`;
    const have = new Set(
      [...boardPlacements.map((p) => p.item), ...graphic.tray.items].flatMap((item) =>
        [item, ...(item.split ? [item.split] : [])].map(key)
      )
    );
    // Each new card with its place in the preview
    const fresh = cards.flatMap((card, i) => (have.has(key(card)) ? [] : [{ card, i }]));
    const items = fresh.map(({ card }) => toItem(card));
    const placed = importTrayCards(graphic.tray, items);
    const added = items.slice(0, placed.tray.items.length - graphic.tray.items.length);
    // From this render's board, as applyPlaced is
    if (added.length) setGraphic(() => ({ ...graphic, tray: placed.tray }));
    // Nothing new, but some of its cards are in a hidden tray: show it, so the click shows
    // where they are
    else if (
      !graphic.tray.enabled &&
      graphic.tray.items.some((item) => cards.some((c) => key(c) === key(item)))
    ) {
      showTray(true);
    }
    const already = cards.length - fresh.length;
    const failed = pool.cards.length - cards.length;
    showToast(
      [
        ...(added.length ? [`Added ${cardCount(added.length)} to the Card Tray`] : []),
        ...(already ? [`${cardCount(already)} Already on the Board or in the Card Tray`] : []),
        ...(failed ? [`${cardCount(failed)} Couldn't Load`] : []),
        ...placed.errors,
      ].join('\n'),
      { undo: added.length > 0 }
    );
    if (!added.length) return;
    setPoolAdds((adds) => ({ ...adds, [poolAddsKey(pool)]: added.map((item) => item.id) }));
    const thumbs = [...button.querySelectorAll('img')];
    setFlyingPools((f) => new Set(f).add(pool.name));
    flyIn(
      added.map((item, n) => ({
        id: item.id,
        thumb: thumbs[fresh[n].i % thumbs.length],
        own: fresh[n].i < thumbs.length,
        src: fresh[n].card.thumb,
      })),
      {
        pool: true,
        onDone: () => setFlyingPools((f) => new Set([...f].filter((name) => name !== pool.name))),
      }
    );
  }

  // Starts loading a pool's thumbnails past its preview (once each; the browser caches them)
  const preloaded = React.useRef(new Set<string>());
  function preloadPool(pool: Pool) {
    if (pool.filter || preloaded.current.has(pool.name)) return;
    preloaded.current.add(pool.name);
    for (const card of pool.cards.slice(POOL_PREVIEW_CARDS)) new window.Image().src = card.thumb;
  }

  // A pool's cards that load
  const loadablePoolCards = (pool: Pool) =>
    pool.cards.filter((card) => !failedPoolCards.has(`${card.set} ${card.number}`));
  // The cards a pool added last, while every one of them is still in the showing tray (none
  // moved to the board or removed) and none is still flying in: clicking the pool again then
  // takes them back out (removePool)
  function poolInTray(pool: Pool) {
    const ids = poolAdds[poolAddsKey(pool)];
    if (pool.filter || !ids?.length || !trayShown || flyingPools.has(pool.name)) return null;
    const inTray = new Set(graphic.tray.items.map((i) => i.id));
    return ids.every((id) => inTray.has(id)) ? ids : null;
  }

  // Takes a pool's cards back out of the card tray, each flying from its spot back to its
  // thumbnail in the pool (`button`), the way it came, unless motion is reduced
  function removePool(pool: Pool, ids: string[], button: HTMLElement) {
    const spot = landing();
    // Only those on screen fly (beside the sidebar, the workspace may be scrolled away from
    // the tray)
    const from = ids.map((id) => {
      const box = spot(id);
      return box && onScreen(box) ? box : null;
    });
    const gone = new Set(ids);
    // Its entry in poolAdds stays: with its cards out of the tray it reads Add again, and
    // undoing the removal brings them back with the same ids, so it reads Remove again
    setPicking((p) => (p && gone.has(p.id) ? null : p));
    setGraphic(() => ({
      ...graphic,
      tray: mapTray(graphic.tray, (i) => (gone.has(i.id) ? null : i)),
    }));
    setSelectedId((selected) => (selected && gone.has(selected) ? null : selected));
    showToast(removedMessage(ids.length), { undo: true });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Each card's thumbnail: its place in the pool's preview (the pool may have added only
    // some of its cards), or past it, the preview's again in turn, as they flew in
    const thumbs = [...button.querySelectorAll('img')];
    const cards = loadablePoolCards(pool);
    const placeOf = (id: string) => {
      const item = graphic.tray.items.find((i) => i.id === id);
      return cards.findIndex((c) => c.set === item?.set && c.number === item?.number);
    };
    const thumbOf = (id: string) => {
      const at = placeOf(id);
      return at < 0 ? thumbs.at(-1) : thumbs[at % thumbs.length];
    };
    const flights: Flight[] = ids.flatMap((id, i) => {
      const thumb = thumbOf(id);
      const box = from[i];
      if (!thumb || !box) return [];
      // Its own picture: the preview's, or past the preview, its own thumbnail's
      const at = placeOf(id);
      const own = thumbs[at] && thumb.complete && thumb.currentSrc;
      return [{ id, src: own || cards[at]?.thumb || thumb.src, from: box }];
    });
    if (!flights.length) return;
    // Where each lands: its thumbnail as it is now (gone, if the pools closed meanwhile)
    const back = () => (id: string) => {
      const thumb = thumbOf(id);
      if (!thumb?.isConnected) return null;
      const box = thumb.getBoundingClientRect();
      if (!box.width) return null;
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        radius: parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 0,
      };
    };
    let flying = flights.length;
    const stop = launchFlights(
      flights,
      back,
      (landed) => {
        flying -= landed.length;
        if (flying === 0) stopFlights.current.delete(stop);
      },
      // They wait where they were in the tray, since the cards themselves are gone
      { showWaiting: true }
    );
    stopFlights.current.add(stop);
  }

  // A set's pool (Delta Reign) lists that set whole in the search, as ticking it alone in
  // Sets with the field empty does. The pools close with it, so focus goes to the search
  // field rather than being lost (not on touch screens, where it would bring up the
  // keyboard). A split being made keeps going: listing a set is a way to find its bottom card.
  function filterToSet(set: string) {
    const options = { ...searchOptions, sets: [set] };
    setQuery('');
    setSearchOptions(options);
    search('', options);
    if (!matchMedia('(pointer: coarse)').matches) {
      searchInputRef.current?.focus({ preventScroll: true });
    }
  }

  function pickResult(card: CardResult, tile?: HTMLElement) {
    if (picking && pickingCard) {
      const face = toFace(card);
      updateCard(picking.id, (i) =>
        picking.part === 'top' ? { ...i, ...face } : { ...i, split: face }
      );
      setPicking(null);
      return;
    }
    addResultTo(card, targetIndex, tile);
  }

  // The search result menu's View: the card large, grown from its thumbnail, with focus
  // going back to the result after
  function viewResult({ card, tile }: ResultMenu) {
    const thumb = (tile.querySelector('img') ?? tile).getBoundingClientRect();
    setViewing({
      faces: [toFace(card)],
      from: {
        x: thumb.left + thumb.width / 2,
        y: thumb.top + thumb.height / 2,
        height: thumb.height,
      },
      returnTo: tile,
    });
  }

  // The menu's keys: arrows move through its items (or the flyout's), right opens the
  // flyout and left goes back from it; Escape is handled with the outside press
  const onResultMenuKey = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const flyout = target.closest<HTMLElement>('[data-flyout]');
    const scope = flyout ?? resultMenuRef.current;
    if (!scope) return;
    const items = [...scope.querySelectorAll<HTMLElement>('[role=menuitem]')].filter(
      (el) => flyout || !el.closest('[data-flyout]')
    );
    const at = items.indexOf(target);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && target.hasAttribute('aria-haspopup')) {
      e.preventDefault();
      openResultFlyout(true);
    }
    if (e.key === 'ArrowLeft' && flyout) {
      e.preventDefault();
      setResultFlyout(false);
      resultAddToRef.current?.focus();
    }
  };

  function openResultMenu(card: CardResult, tile: HTMLElement, x: number, y: number) {
    setResultFlyout(false);
    setResultMenu({ card, tile, of: results, x, y });
  }

  // A touch press held LONG_PRESS still opens the result's menu where the finger is; moving
  // more than TOUCH_SLOP, lifting or the page scrolling cancels it
  const longPress = React.useRef<{ x: number; y: number; timer: number } | null>(null);
  // Set when a long press opened the menu, until the tap it ends with (and Android's own
  // contextmenu for it) is ignored
  const longPressOpened = React.useRef(false);
  function startLongPress(card: CardResult, tile: HTMLElement, x: number, y: number) {
    cancelLongPress();
    longPressOpened.current = false;
    const timer = window.setTimeout(() => {
      longPress.current = null;
      longPressOpened.current = true;
      openResultMenu(card, tile, x, y);
    }, LONG_PRESS);
    longPress.current = { x, y, timer };
  }
  function cancelLongPress() {
    if (longPress.current) clearTimeout(longPress.current.timer);
    longPress.current = null;
  }
  // New results replace the tile a long press was on
  React.useEffect(() => () => cancelLongPress(), [results]);

  // Opens the "Add to" flyout, focusing its first choice when asked
  function openResultFlyout(focus: boolean) {
    flushSync(() => setResultFlyout(true));
    if (focus) resultMenuRef.current?.querySelector<HTMLElement>('[data-flyout] button')?.focus();
  }

  // A search result dropped on the board goes where the graphic puts it. Dropped on a
  // card, it opens the card menu to choose between making a split card and adding it.
  const dropResult = React.useEffectEvent((card: CardResult, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.container().getBoundingClientRect();
    if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) {
      return;
    }
    const point = {
      x: (clientX - box.left) / scale - boardLeft,
      y: (clientY - box.top) / scale,
    };
    // Beside a narrower board, over nothing (the stage is as wide as the card tray)
    if (point.y <= BOARD_HEIGHT && (point.x < 0 || point.x > width)) return;
    // Later cards overlap earlier ones, and the selected card is drawn over them all, so
    // the last card under the pointer in that order is the top one
    const under = selectedLast(placements, selectedId).findLast(
      (p) =>
        point.x >= p.x && point.x <= p.x + p.width && point.y >= p.y && point.y <= p.y + p.height
    );
    if (under) {
      setSelectedId(under.item.id);
      setCardMenu({
        id: under.item.id,
        x: clientX - box.left,
        y: clientY - box.top,
        dropped: { card, point },
      });
      return;
    }
    applyPlaced(dropAt(toItem(card), point));
  });

  // Dragging a search result: follows the pointer once it has moved a few pixels;
  // Escape cancels
  React.useEffect(() => {
    const end = () => {
      resultPress.current = null;
      setDragGhost(null);
    };
    const onMove = (e: PointerEvent) => {
      const press = resultPress.current;
      if (!press) return;
      if (!press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
      press.dragging = true;
      setDragGhost({ card: press.card, x: e.clientX, y: e.clientY });
    };
    const onUp = (e: PointerEvent) => {
      const press = resultPress.current;
      if (!press) return;
      if (press.dragging) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false));
        dropResult(press.card, e.clientX, e.clientY);
      }
      end();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Waits for card images, then draws the board at export size without editor marks
  async function renderBlob() {
    const stage = stageRef.current;
    if (!stage) return null;
    setSelectedId(null);
    // A card tray sliding in or out finishes first, so none of it is half drawn
    flushSync(trayReveal.finish);
    // Cards still flying in from the sidebar land now, so they're in the image
    stopFlights.current.forEach((stop) => stop());
    await Promise.allSettled(
      [...boardPlacements, ...(exportTray ? trayPlacements : [])]
        .flatMap(({ item }) => [item.image, ...(item.split ? [item.split.image] : [])])
        .map(loadImage)
    );
    await document.fonts.ready;
    // Let React draw the cards whose images just finished loading
    await new Promise((resolve) => setTimeout(resolve, 100));
    // The editor's own layer, and any a graphic adds (e.g. the eraser's circle)
    const editorOnly = stage.find('.editor');
    editorOnly.forEach((node) => node.hide());
    // Whatever's moved for the image is put back as it is now
    const restore: (() => void)[] = [];
    const set = (node: Konva.Node | undefined, attrs: Record<string, unknown>) => {
      if (!node) return;
      const before = Object.fromEntries(Object.keys(attrs).map((k) => [k, node.getAttr(k)]));
      restore.push(() => node.setAttrs(before));
      node.setAttrs(attrs);
    };
    let blob: Promise<Blob>;
    try {
      // The board starts at the image's corner, not centered over a wider card tray
      set(stage, { x: 0, scaleX: 1, scaleY: 1 });
      // An exported card tray sits flush and square under the board, at the board's width,
      // its cards laid out again to fit it
      if (exportTray) {
        const tray = stage.findOne<Konva.Group>('.tray');
        set(tray, { x: 0, y: BOARD_HEIGHT });
        // Its cards unclipped and unscrolled (the one-row tray on phones), in its two rows
        set(stage.findOne('.trayClip'), {
          clipX: undefined,
          clipY: undefined,
          clipWidth: undefined,
          clipHeight: undefined,
        });
        set(stage.findOne('.trayCards'), { x: 0 });
        set(stage.findOne('.trayBox'), {
          width,
          height: trayHeight(graphic.tray.items.length, width),
          cornerRadius: 0,
        });
        for (const place of layoutTray(graphic.tray, width)) {
          const card = tray?.findOne(`#${place.item.id}`);
          const cardScale = place.width / CARD_WIDTH;
          set(card, { x: place.x, y: place.y, scaleX: cardScale, scaleY: cardScale });
        }
      }
      // Drawn at design size times the shape's export scale, not from the on-screen scale,
      // so the image is always its shape's size in whole pixels (2400 wide at 16:9, 1080 for
      // the others). Konva sizes its canvas as the design size times the scale, cut to a
      // whole number, so the design size asked for is half an image pixel over: a float just
      // short of 1080 is still 1080. Konva draws it as toBlob is called, so the board is put
      // back before the screen next draws.
      const pixelRatio = exportScale(graphic.shape);
      blob = stage.toBlob({
        pixelRatio,
        x: 0,
        y: 0,
        width: (exported.width + EXPORT_MARGIN) / pixelRatio,
        height: (exported.height + EXPORT_MARGIN) / pixelRatio,
      }) as Promise<Blob>;
    } finally {
      editorOnly.forEach((node) => node.show());
      restore.reverse().forEach((put) => put());
    }
    return blob;
  }

  async function exportPng() {
    const blob = await renderBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graphic.kind}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyPng() {
    const blob = await renderBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Copied to Clipboard');
    } catch {
      showToast("Couldn't Copy; Use Export PNG");
    }
  }

  return (
    // The sidebar column (the logo header, then the sidebar) on the left of the board. On
    // narrow screens the column dissolves (Editor.module.css): the header stays at the top,
    // then the board, then the sidebar. On wide screens each side scrolls on its own, so
    // the search results stay beside the board.
    <>
      <div
        ref={pageRef}
        className="tierbinder-page w-full h-full flex flex-col b8:flex-row text-body"
      >
        {logoMounted && (
          <button
            ref={floatingLogoRef}
            type="button"
            className={`${styles.floatingBrand} ${logoLeaving ? styles.floatingBrandLeaving : ''}`}
            style={
              {
                '--logo-mark-width': `${LOGO_MARK_WIDTH}px`,
              } as React.CSSProperties
            }
            // A pointer shortcut only: the show button at the bottom left is the one keyboards
            // and screen readers get, so the same control isn't met twice
            tabIndex={-1}
            aria-hidden
            title={`Show sidebar (${SIDEBAR_SHORTCUT()})`}
            inert={viewing !== null || logoLeaving}
            onClick={toggleSidebar}
          >
            <span className={styles.lightLogo}>
              <Image
                src="/tierbinder-combined-light.svg"
                alt=""
                width={LIGHT_LOGO_WIDTH}
                height={LOGO_HEIGHT}
              />
            </span>
          </button>
        )}
        {/* The toast's words for screen readers, in a live region that's always there (one
        that appears with its text in it is often not read out) */}
        <div role="status" className="sr-only">
          {/* A new element for each showing, so the same message again is read again */}
          {toast && !toast.closing && (
            <p key={toast.n}>
              {toast.message}
              {toast.undo && ` (${UNDO_KEY()} to undo)`}
            </p>
          )}
        </div>
        {toast && (
          <div
            // A new element for each new message, so it plays its entrance
            key={toast.id}
            className={`${styles.toast} tierbinder-popup ${toast.closing ? styles.toastClosing : ''}`}
            data-undo={(toast.undo === 'armed' && !toast.closing) || undefined}
            onPointerEnter={() => setHeldToast(toast.id)}
            onPointerLeave={() => setHeldToast(null)}
            onFocus={() => setHeldToast(toast.id)}
            onBlur={() => setHeldToast(null)}
          >
            {/* Read from the live region above */}
            <span aria-hidden>{toast.message}</span>
            {toast.undo === 'armed' && !toast.closing && (
              <Button
                variant="text"
                className={styles.toastUndo}
                aria-label={`Undo: ${toast.message.split('\n')[0]}`}
                onClick={() => {
                  // Focus goes to the board, not lost with the button
                  boardBoxRef.current?.focus({ preventScroll: true });
                  stepHistory(true);
                  setHeldToast(null);
                  setToast((t) => (t ? { ...t, closing: true, undo: undefined } : t));
                }}
              >
                Undo
              </Button>
            )}
          </div>
        )}
        {/* While the sidebar is hidden, the button that brings it back, where its foot was */}
        {sidebarCollapsed && (
          <button
            ref={showSidebarRef}
            type="button"
            className={`${styles.sidebarToggle} ${styles.showSidebar}`}
            // Behind a viewed card, as the rest of the page is
            inert={viewing !== null}
            aria-label="Show sidebar"
            title={`Show sidebar (${SIDEBAR_SHORTCUT()})`}
            aria-keyshortcuts="Control+\ Meta+\"
            aria-controls="sidebar-column"
            onClick={toggleSidebar}
          >
            <span aria-hidden className={styles.sidebarIcon} />
          </button>
        )}
        <div
          id="sidebar-column"
          ref={sideColumnRef}
          className={`${styles.sideColumn} ${sidebarCollapsed ? styles.sideColumnHidden : ''}`}
          inert={viewing !== null}
        >
          <header
            className={`${styles.top} ${folded ? styles.topFolded : ''}`}
            // Rising away as the sidebar folds
            style={
              fold > 0 && !folded
                ? {
                    marginTop: `calc((var(--tb-top-height) + env(safe-area-inset-top)) * ${-fold})`,
                  }
                : undefined
            }
          >
            <Link href="/" className={styles.brand}>
              <Image src="/tierbinder-combined-dark.svg" alt="TierBinder" width={114} height={25} />
            </Link>
          </header>
          <SidebarHandle />
          <aside
            id="sidebar"
            ref={sideRef}
            className={`${styles.side} ${folded ? styles.sideFolded : ''} flex flex-col flex-1 min-w-0 min-h-0`}
            style={
              foldingSideHeight !== null ? { flex: 'none', height: foldingSideHeight } : undefined
            }
          >
            <div
              ref={sideHeadRef}
              className={`${styles.sideHead} flex gap-2 items-center`}
              data-scrolled={panelScrolled || undefined}
              // Folded, a press anywhere on the bar opens it (a pointer shortcut: its button
              // is the one keyboards and screen readers get)
              onClick={(e) => {
                if (folded && !(e.target as Element).closest('button')) foldSidebar();
              }}
            >
              {/* Folded on a phone: a bar at the page's foot, the light logo at its left and
              the button to open it again at its right; the nav stays mounted, hidden */}
              {folded && (
                <div className={`${styles.foldedBrand} flex flex-1 min-w-0`}>
                  <Image
                    src="/tierbinder-combined-light.svg"
                    alt="TierBinder"
                    width={LIGHT_LOGO_WIDTH}
                    height={LOGO_HEIGHT}
                  />
                </div>
              )}
              <div
                className="flex-1 min-w-0"
                hidden={folded}
                // Folding, the nav fades out over the slide's last part, gone as it ends (then
                // the logo fades in); opening, it fades back in over the first
                style={
                  fold > 0 ? { opacity: Math.min(1, (1 - fold) / (fadeShare || 1)) } : undefined
                }
              >
                <RadioBar
                  label="Editor sections"
                  options={TABS}
                  value={tab}
                  onChange={(next, clicked) => {
                    // Picking a tab, even the one showing, opens a folded sidebar
                    setSidebarFolded(false);
                    // Add Cards clicked or tapped while it's already showing: straight to
                    // the search (in this click, so a phone brings up its keyboard).
                    // Switching to it doesn't, nor do the arrow keys.
                    if (next === 'add' && clicked && tab === 'add') {
                      searchInputRef.current?.focus();
                      return;
                    }
                    setTab(next);
                  }}
                  onFullWidth={fitSidebarToNav}
                />
              </div>
              {/* On phones and tablets: the sidebar folds down to its nav under a bigger
              board, and back */}
              {!wide && (
                <Button
                  type="button"
                  variant="quiet"
                  className={styles.foldButton}
                  // One name; aria-expanded says which way it is
                  aria-label="Sidebar"
                  aria-controls="sidebar"
                  title={sidebarFolded ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-expanded={!sidebarFolded}
                  onClick={foldSidebar}
                  // (rising with the slide to the folded bar's row, see foldHeights.shift; `translate`,
                  // which the button doesn't transition, unlike its pressed `transform`)
                  style={
                    fold > 0 && !folded
                      ? { translate: `0 ${-foldHeights.shift * fold}px` }
                      : undefined
                  }
                >
                  <span
                    aria-hidden
                    className={`${styles.foldIcon} ${sidebarFolded ? styles.foldIconUp : ''}`}
                  />
                </Button>
              )}
            </div>

            {/* The panels stay mounted, so tabbing away keeps a search or import text. min-w-0
            so the results scroll instead of widening the sidebar; on wide screens they
            fill the sidebar's height and scroll on their own, and the panel scrolls when
            the pools and Advanced don't fit */}
            <section
              role="tabpanel"
              hidden={tab !== 'add'}
              onScroll={onPanelScroll('add')}
              className="tierbinder-panel flex flex-col gap-4 flex-1 min-w-0 min-h-0 overflow-y-auto"
            >
              {/* Grows to fill the sidebar while it shows search results */}
              <div
                className={`flex flex-col gap-3 min-w-0 ${showingResults ? 'flex-1 min-h-0' : ''}`}
              >
                <h3 id="card-search-heading" className="tierbinder-heading">
                  Add a Card
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    search(query);
                  }}
                  className={`${styles.searchRow} flex gap-3`}
                >
                  <label className={styles.search}>
                    <span className={styles.searchIcon} aria-hidden />
                    <input
                      ref={searchInputRef}
                      className="tierbinder-field"
                      aria-labelledby="card-search-heading"
                      // Card names aren't real words: don't let phones "fix" them. Nor
                      // offer to fill them in: Safari reads "Card name" as a contact's
                      // name and ignores autoComplete="off", but not a field named search
                      autoCorrect="off"
                      autoCapitalize="off"
                      autoComplete="off"
                      name="search"
                      spellCheck={false}
                      enterKeyHint="search"
                      placeholder="Card name"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        // Emptying the field clears the results, bringing the other sections
                        // back, or goes back to listing the filter's sets
                        if (!e.target.value.trim()) search('');
                      }}
                    />
                    {query && (
                      <button
                        type="button"
                        className="tierbinder-clear"
                        aria-label="Clear search"
                        title="Clear search"
                        onClick={() => {
                          setQuery('');
                          search('');
                          searchInputRef.current?.focus();
                        }}
                      >
                        <span aria-hidden />
                      </button>
                    )}
                  </label>
                  <Button variant="primary">Search</Button>
                </form>
                {/* One row: Sets (with no search, it lists the sets ticked) and the Add to
                picker when there's a choice (a blank canvas has one place for cards),
                always; and while there are results (or none found), Sort, at the right */}
                <div className="flex flex-wrap gap-3 items-center">
                  {/* Sets and Add to stay on one line, their names cut short with an ellipsis
                      when they don't fit rather than wrapping */}
                  <div className="flex flex-1 min-w-0 gap-3 items-center">
                    <SearchFilters
                      options={searchOptions}
                      colors={tickColors}
                      onChange={changeSearchOptions}
                    />
                    {(!picking || splitPicker) && targets.length > 1 && (
                      <Dropdown
                        label="Add to"
                        hideLabel
                        chevron={false}
                        value={targetIndex}
                        options={targets.map((t, i) => ({
                          value: i,
                          label: t.name.replaceAll('\n', ' '),
                          color: t.color,
                          // The tray's color is a shade of the board, so it gets a stroke
                          outlined: 'outlined' in t && t.outlined,
                        }))}
                        // While a split card is being made, it says so, with a white card as its
                        // swatch; picking a target cancels the split
                        current={
                          splitPicker && pickingCard
                            ? {
                                label: `Splitting ${pickingCard.name}`,
                                color: SPLIT_SWATCH,
                                shape: 'card',
                              }
                            : undefined
                        }
                        onChange={(i) => {
                          setTarget(i);
                          if (splitPicker) setPicking(null);
                        }}
                      />
                    )}
                  </div>
                  {/* The thumbnails' size, while there are results to show */}
                  {searchShown && shownResults.length > 0 && (
                    <div className="ml-auto">
                      <Segmented
                        compact
                        label="Thumbnail size"
                        value={resultSize}
                        options={RESULT_SIZES}
                        onChange={setResultSize}
                      />
                    </div>
                  )}
                  {/* Flips the order: newest or oldest set first, and each set's numbers
                  (hidden for now: SORT_BUTTON) */}
                  {SORT_BUTTON && searchShown && (
                    <Button
                      type="button"
                      variant="icon"
                      className={shownResults.length > 0 ? undefined : 'ml-auto'}
                      aria-label={`Sort: ${sortDirection}`}
                      title={`Sort: ${sortDirection}`}
                      onClick={() =>
                        changeSearchOptions({ ...searchOptions, reverse: !searchOptions.reverse })
                      }
                    >
                      <span
                        aria-hidden
                        className={`${styles.sortIcon} ${searchOptions.reverse ? styles.reversed : ''}`}
                      />
                    </Button>
                  )}
                </div>
                {/* What the search was for, and with sets ticked, a way to search them all */}
                {searchError && !importing && !searching && (
                  <p role="alert" className="text-(--tb-muted)">
                    {searchError}
                  </p>
                )}
                {noResults && !importing && !searching && (
                  <div role="status" className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">No Cards Found</p>
                      {(noResults.query || noResults.sets.length > 0) && (
                        <p className="text-(--tb-muted)">
                          {noResults.query && `For “${noResults.query}”`}
                          {noResults.query && noResults.sets.length > 0 && ' '}
                          {noResults.sets.length > 0 &&
                            `${noResults.query ? 'in' : 'In'} ${new Intl.ListFormat('en').format(noResults.sets)}`}
                        </p>
                      )}
                    </div>
                    {noResults.sets.length > 0 && (
                      <Button
                        type="button"
                        className="self-start"
                        onClick={() => changeSearchOptions({ ...searchOptions, sets: [] })}
                      >
                        {noResults.query ? 'Search All Sets' : 'Clear Sets'}
                      </Button>
                    )}
                  </div>
                )}
                {picking && pickingCard && !splitPicker && (
                  <p className="flex gap-3 items-center">
                    {picking.part === 'top'
                      ? pickingCard.split
                        ? `Replacing the Top Half (${pickingCard.name})`
                        : `Replacing ${pickingCard.name}`
                      : pickingCard.split
                        ? `Replacing the Bottom Half (${pickingCard.split.name})`
                        : `Splitting ${pickingCard.name}: Pick the Bottom Card`}
                    <Button onClick={() => setPicking(null)}>Cancel</Button>
                  </p>
                )}
                {/* Tiles as many per row as fit (Editor.module.css): placeholders while a
                search is under way, then the results. A shade over the top shows when
                they're scrolled. */}
                {/* The skeleton and results are visual; this says what they show */}
                {/* Making a split card shows only on the Add to picker; this says it */}
                <p role="status" className="sr-only">
                  {splitPicker && pickingCard
                    ? `Splitting ${pickingCard.name}: pick the bottom card from the results, or a tier to cancel.`
                    : ''}
                </p>
                <p role="status" className="sr-only">
                  {showingSkeleton
                    ? 'Searching…'
                    : showingResults
                      ? `${shownResults.length} cards`
                      : ''}
                </p>
                {(showingResults || showingSkeleton) && (
                  <div className={`${styles.resultsBox} flex-1`} data-size={resultSize}>
                    <div
                      ref={resultsRef}
                      className={`${styles.results} overflow-y-auto overflow-x-hidden`}
                      style={
                        { '--card-ratio': `${CARD_WIDTH} / ${CARD_HEIGHT}` } as React.CSSProperties
                      }
                      onScroll={(e) => setResultsScrolled(e.currentTarget.scrollTop > 0)}
                    >
                      {showingSkeleton
                        ? Array.from({ length: SKELETON_TILES[resultSize] }, (_, i) => (
                            <span key={i} aria-hidden className={styles.resultThumb} />
                          ))
                        : visibleResults.map((card) => (
                            <div
                              key={`${card.set}-${card.number}`}
                              role="button"
                              tabIndex={0}
                              title={`${card.set} ${card.number}`}
                              className={`${styles.resultTile} cursor-grab select-none flex flex-col items-center`}
                              // Mouse and pen only: on touch, a press-and-move scrolls the results
                              onPointerDown={(e) => {
                                // A new press of any kind starts afresh (no click is fired
                                // after a long press on some phones)
                                longPressOpened.current = false;
                                // On touch, a long press opens the result's menu (a press and
                                // move scrolls the results instead)
                                if (e.pointerType === 'touch') {
                                  startLongPress(card, e.currentTarget, e.clientX, e.clientY);
                                  return;
                                }
                                if (e.button !== 0) return;
                                e.preventDefault();
                                resultPress.current = {
                                  card,
                                  x: e.clientX,
                                  y: e.clientY,
                                  dragging: false,
                                };
                              }}
                              onPointerMove={(e) => {
                                const press = longPress.current;
                                if (
                                  press &&
                                  Math.hypot(e.clientX - press.x, e.clientY - press.y) > TOUCH_SLOP
                                ) {
                                  cancelLongPress();
                                }
                              }}
                              onPointerUp={cancelLongPress}
                              onPointerCancel={cancelLongPress}
                              onClick={(e) => {
                                // The tap that ends a long press doesn't also add the card
                                if (longPressOpened.current) {
                                  longPressOpened.current = false;
                                  return;
                                }
                                if (!justDragged.current) pickResult(card, e.currentTarget);
                              }}
                              // Right-click (or the menu key) opens the result's own menu
                              onContextMenu={(e) => {
                                e.preventDefault();
                                // Android also fires this on a long press: that one's open
                                if (longPressOpened.current) return;
                                const tile = e.currentTarget;
                                const box = tile.getBoundingClientRect();
                                openResultMenu(
                                  card,
                                  tile,
                                  // The menu key reports no pointer: open at the result
                                  e.clientX || box.left + box.width / 2,
                                  e.clientY || box.top + box.height / 2
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  pickResult(card, e.currentTarget);
                                }
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnails, no optimization needed */}
                              <img
                                // A new size is a new image, shimmering until it loads
                                key={resultSize}
                                src={resultSrc(card)}
                                alt={`${card.name} (${card.set} ${card.number})`}
                                className={`${styles.resultThumb} object-contain`}
                                // Shimmers until it's loaded (Editor.module.css)
                                onLoad={(e) => {
                                  e.currentTarget.dataset.loaded = '';
                                }}
                                loading="lazy"
                                draggable={false}
                                // The CDN occasionally fails a load; retry once through the image
                                // proxy (then a Large one's small image, both ways), and hide
                                // the result if that fails too
                                onError={(e) => {
                                  const tries = [...new Set([resultSrc(card), card.thumb])].flatMap(
                                    (src) => [src, proxied(src)]
                                  );
                                  const now = tries.findLastIndex((src) =>
                                    e.currentTarget.src.endsWith(src)
                                  );
                                  if (now < tries.length - 1) {
                                    e.currentTarget.src = tries[now + 1];
                                    return;
                                  }
                                  const key = `${card.set} ${card.number}`;
                                  setUnshown((u) => ({
                                    of: results,
                                    keys: new Set([...(u.of === results ? u.keys : []), key]),
                                  }));
                                }}
                              />
                            </div>
                          ))}
                      {/* Reaching it draws the next page */}
                      {!showingSkeleton && visibleResults.length < shownResults.length && (
                        <span ref={moreResultsRef} aria-hidden className="col-span-full" />
                      )}
                    </div>
                    <span
                      aria-hidden
                      className={styles.resultsShade}
                      data-shown={resultsScrolled}
                    />
                  </div>
                )}
              </div>

              {/* Card pools and Advanced, until a search shows results or finds none; they come
              back when the search is emptied or the board is cleared. Each pool is a button
              that adds its cards to the card tray, or for a set's pool, lists the set. */}
              {!searchShown && (
                <div className="flex flex-col gap-3">
                  <h3 className="tierbinder-heading">Featured Card Pools</h3>
                  {FEATURED_POOLS.map((pool) => {
                    const inTray = poolInTray(pool);
                    // What clicking it does: list its set, add its cards, or take them back out
                    const action = pool.filter ? 'filter' : inTray ? 'remove' : 'add';
                    return (
                      <button
                        key={pool.name}
                        type="button"
                        className={styles.pool}
                        aria-label={`${pool.name}: ${POOL_ACTIONS[action].aria}`}
                        // Its cards past the preview load ahead of a click, so they fly showing
                        // their own picture rather than an empty one
                        onPointerEnter={() => preloadPool(pool)}
                        onFocus={() => preloadPool(pool)}
                        onClick={(e) => {
                          // A double click's second click would take straight back what
                          // its first added (under reduced motion nothing flies to wait for)
                          if (e.detail > 1 && !pool.filter) return;
                          if (pool.filter) filterToSet(pool.filter);
                          else if (inTray) removePool(pool, inTray, e.currentTarget);
                          else addPool(pool, e.currentTarget);
                        }}
                      >
                        {/* Its name, and what clicking it does */}
                        <span className={`${styles.poolName} text-caption`}>
                          <span className="font-semibold">{pool.name}</span>
                          <span className={styles.poolAction} aria-hidden>
                            <span className={styles.poolIcon} data-action={action} />
                            {POOL_ACTIONS[action].label}
                          </span>
                        </span>
                        {/* A fixed number of columns, so every pool's cards are the same size */}
                        <span
                          className={styles.poolCards}
                          style={
                            {
                              '--pool-columns': POOL_PREVIEW_CARDS,
                              '--card-ratio': `${CARD_WIDTH} / ${CARD_HEIGHT}`,
                            } as React.CSSProperties
                          }
                        >
                          {poolPreview(pool).map((card) => (
                            // eslint-disable-next-line @next/next/no-img-element -- remote thumbnails, as in the results
                            <img
                              key={`${card.set}-${card.number}`}
                              src={card.thumb}
                              alt={`${card.name} (${card.set} ${card.number})`}
                              title={`${card.name} (${card.set} ${card.number})`}
                              className={styles.poolCard}
                              // Shimmers until it's loaded, as search results do
                              onLoad={(e) => {
                                e.currentTarget.dataset.loaded = '';
                              }}
                              loading="lazy"
                              draggable={false}
                              // The CDN occasionally fails a load; retry once through the proxy, and
                              // if that fails too, a placeholder takes its place
                              onError={(e) => {
                                const proxy = proxied(card.thumb);
                                if (!e.currentTarget.src.endsWith(proxy))
                                  e.currentTarget.src = proxy;
                                else
                                  setFailedPoolCards((failed) =>
                                    new Set(failed).add(`${card.set} ${card.number}`)
                                  );
                              }}
                            />
                          ))}
                          {/* Card-shaped placeholders fill the rest of the row */}
                          {Array.from(
                            { length: POOL_PREVIEW_CARDS - poolPreview(pool).length },
                            (_, i) => (
                              <span key={`empty-${i}`} className={styles.poolCard} aria-hidden />
                            )
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!searchShown && (
                <div className="flex flex-col gap-3">
                  <h3 className="tierbinder-heading">Advanced</h3>
                  {/* A disclosure: the button names the import below it, which slides open */}
                  <div className="flex flex-col">
                    <Button
                      id="bulk-import-label"
                      variant="text"
                      className="self-start"
                      aria-expanded={importing}
                      aria-controls="bulk-import"
                      onClick={() => {
                        setImporting(!importing);
                        // The page follows it down as it slides open, so it isn't left
                        // opening off screen under a phone's board
                        if (!importing && importRef.current) followOpen(importRef.current);
                      }}
                    >
                      Bulk Import
                      <span aria-hidden className={styles.disclosureChevron} />
                    </Button>
                    <div
                      ref={importRef}
                      id="bulk-import"
                      className={`${styles.reveal} ${importing ? styles.revealed : ''}`}
                      inert={!importing}
                    >
                      <div>
                        <div className="flex flex-col gap-3 pt-3">
                          <textarea
                            rows={10}
                            aria-labelledby="bulk-import-label"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            className="tierbinder-field font-mono"
                            placeholder={
                              'Pikachu ex SSP 57\n# Goated\nMew ex MEW 151\nAlakazam\n# Solid\nDragapult ex TWM 130'
                            }
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                          />
                          <Button
                            variant="primary"
                            className="self-start"
                            onClick={runImport}
                            disabled={busy || !importText.trim()}
                          >
                            Import
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section
              role="tabpanel"
              hidden={tab !== 'customize'}
              onScroll={onPanelScroll('customize')}
              className="tierbinder-panel tierbinder-sections flex flex-col gap-4 flex-1 min-w-0 min-h-0 overflow-y-auto"
            >
              {/* Sections as in Add Cards: each a heading over its controls, 8px apart, with a
              hairline between sections (.tierbinder-sections), and every setting a row
              with its label muted at the left and its control at the right
              (.tierbinder-prop). Board first, what the board is: its type and shape (where
              it's posted: it sets the board's width and the image's size), with Clear at
              the end of its heading. Then the graphic's own sections (what's on it), then
              Style (how it looks), then the card tray. */}
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="tierbinder-heading">Board</h3>
                  {/* Asks first with a menu of only the clears that would change something */}
                  <ClearButton
                    quiet
                    label="Clear board"
                    choices={boardClears}
                    // Nothing left to clear: the button's disabled, so focus goes to the board
                    onEmptied={() => boardBoxRef.current?.focus({ preventScroll: true })}
                  >
                    Clear
                  </ClearButton>
                </div>
                <Dropdown
                  label="Type"
                  prop
                  value={doc.kind}
                  options={GRAPHIC_TYPES.map((t) => ({
                    value: t.kind,
                    label: t.label,
                    icon: t.icon,
                  }))}
                  onChange={(kind) => {
                    if (kind !== doc.kind) showBoard(kind);
                  }}
                />
                <Dropdown
                  label="Shape"
                  prop
                  value={graphic.shape}
                  options={SHAPES.map((s) => ({ value: s.id, label: s.label }))}
                  onChange={(shape) => {
                    if (shape !== graphic.shape)
                      setGraphic((g) => typeOf(g.kind).reshape(g, shape));
                  }}
                />
              </div>
              <type.Settings
                graphic={graphic}
                onChange={setGraphic}
                focus={settingsFocus}
                onNotify={showToast}
              />
              {/* How the board itself looks: its sizes, colors and borders (a tier's color is
                  with its name, the tray's with the tray) */}
              <div className="flex flex-col gap-3">
                <h3 className="tierbinder-heading">Style</h3>
                <type.BoardSettings
                  graphic={graphic}
                  onChange={setGraphic}
                  focus={settingsFocus}
                  onNotify={showToast}
                />
              </div>
              <div ref={traySectionRef} className="flex flex-col gap-3">
                {/* Its switch turns the whole section on or off, so the heading is the
                    switch: its name, then the switch at the row's end, as every toggle has
                    it; its other rows show only while the tray is on */}
                <h3 className="tierbinder-heading flex flex-col">
                  <Toggle
                    checked={graphic.tray.enabled}
                    onChange={(on) => {
                      showTray(on);
                      // Its rows come into view once they and the tray are laid out: on
                      // phones the tray growing under the board moves the sidebar down too,
                      // so once it has slid in
                      if (on)
                        setTimeout(
                          () => {
                            if (traySectionRef.current) revealBelow(traySectionRef.current);
                          },
                          matchMedia('(prefers-reduced-motion: reduce)').matches
                            ? 0
                            : readDuration('--duration-move')
                        );
                    }}
                    heading
                  >
                    Card Tray
                  </Toggle>
                </h3>
                {graphic.tray.enabled && (
                  <ColorField
                    name="Tray Color"
                    label="Card tray color"
                    value={graphic.tray.color}
                    onChange={(color) => setGraphic((g) => ({ ...g, tray: { ...g.tray, color } }))}
                  />
                )}
              </div>
            </section>

            <section
              role="tabpanel"
              hidden={tab !== 'save'}
              onScroll={onPanelScroll('save')}
              className="tierbinder-panel tierbinder-sections flex flex-col gap-4 flex-1 min-w-0 min-h-0 overflow-y-auto"
            >
              {/* Sections as in Customize, a hairline between them and each setting a row: the
              image (its size and format, whether the card tray goes in it, and exporting
              or copying it), then the share link. Each section's buttons act on it, so they
              sit in it, as Import does in Advanced. */}
              <div className="flex flex-col gap-3">
                <h3 className="tierbinder-heading">Image</h3>
                <div className="tierbinder-prop">
                  Size
                  <span className="text-(--tb-text)">
                    {exported.width} × {exported.height}
                  </span>
                </div>
                <div className="tierbinder-prop">
                  Format
                  <span className="text-(--tb-text)">PNG</span>
                </div>
                {trayShown && (
                  <Toggle checked={includeTray} onChange={setIncludeTray}>
                    Include Card Tray
                  </Toggle>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" onClick={exportPng} disabled={busy}>
                    Export PNG
                  </Button>
                  <Button onClick={copyPng} disabled={busy}>
                    Copy PNG
                  </Button>
                </div>
              </div>
              {/* A link that opens this board, card tray and all, on anyone's device */}
              <div className="flex flex-col gap-3">
                <h3 className="tierbinder-heading">Link</h3>
                <p className="text-(--tb-muted) text-pretty">
                  Opens this board and its card tray for anyone you send it to.
                </p>
                <div className="flex">
                  <Button onClick={copyLink} className="flex gap-2 items-center">
                    <span aria-hidden className={styles.linkIcon} />
                    Copy Link
                  </Button>
                </div>
              </div>
            </section>

            {/* The credits, and from b8 up the button that hides the sidebar at its other end:
            at the sidebar's foot under every tab beside the board, and under b8 only in
            Save & Share, where the sidebar's height is too short to spend on them */}
            <footer ref={footRef} className={styles.foot} hidden={footHidden}>
              <Credits />
              {wide && (
                <button
                  ref={hideSidebarRef}
                  type="button"
                  className={styles.sidebarToggle}
                  aria-label="Hide sidebar"
                  title={`Hide sidebar (${SIDEBAR_SHORTCUT()})`}
                  aria-keyshortcuts="Control+\ Meta+\"
                  aria-controls="sidebar-column"
                  onClick={toggleSidebar}
                >
                  <span aria-hidden className={styles.sidebarIcon} />
                </button>
              )}
            </footer>
          </aside>
        </div>

        <div
          ref={workspaceRef}
          // With the sidebar hidden, more room at the left, so the board stays clear of the show
          // button at the bottom left
          className={`${styles.canvas} ${sidebarCollapsed ? styles.canvasCollapsed : ''} ${fold > 0 ? styles.canvasFolded : ''} flex-none b8:flex-1 min-w-0 b8:overflow-y-auto p-4 flex flex-col`}
          // Folding, it takes over the status bar's inset from the rising top bar
          style={
            fold > 0
              ? { paddingTop: `calc(var(--spacing-4) + env(safe-area-inset-top) * ${fold})` }
              : undefined
          }
          inert={viewing !== null}
        >
          {/* Under b8 the toolbar takes the page's width, so a board narrowed to fit its height
          share doesn't wrap the toolbar (which would narrow the board further); beside the
          sidebar it's the board's width */}
          <div
            ref={boardRef}
            className="flex flex-col gap-4 self-stretch b8:self-auto"
            style={wide ? { width: stageWidth * scale } : undefined}
          >
            <div
              ref={boardBoxRef}
              tabIndex={-1}
              className={`${styles.boardBox} self-center relative`}
              style={{ width: stageWidth * scale }}
            >
              <Stage
                ref={(stage) => {
                  stageRef.current = stage;
                }}
                width={stageWidth * scale}
                // Shifted so the board, centered over a wider card tray, starts at x = 0
                x={boardLeft * scale}
                height={BOARD_HEIGHT * scale + TRAY_GAP * trayOpen + shownTrayHeight * scale}
                scaleX={scale}
                scaleY={scale}
                // Before the press below can deselect it: a tier or the tray clicked with a
                // card selected moves the card there (pickTargetOnBoard)
                // (not while a replacement is being picked, which keeps its card selected)
                onPointerDown={() => {
                  pressSelection.current = selectedShown && !picking ? selectedId : null;
                  pressMenuOpen.current = !!cardMenu;
                }}
                onMouseDown={(e) => {
                  // A double click's second press (a tier label opening its name) moves nothing
                  if (e.evt.detail > 1) pressSelection.current = null;
                  if (e.target === e.target.getStage() || e.target.hasName('background')) {
                    setSelectedId(null);
                  }
                }}
                onDragMove={moveOutline}
                // After the card's own dragend has put it back at its laid-out spot; React only
                // moves the outline when that spot changes
                onDragEnd={moveOutline}
              >
                <type.Canvas
                  graphic={graphic}
                  fontFamily={fontFamily}
                  onChange={(next) => setGraphic(() => next)}
                  onSelect={setSelectedId}
                  onCardMenu={(id, x, y) => setCardMenu({ id, x, y })}
                  onCardDrop={boardCardDrop}
                  cardDragWidth={cardDragWidth}
                  arriving={arriving}
                  onPickTarget={(i, emptySpace) => pickTargetOnBoard(i, emptySpace)}
                  selectedId={selectedId}
                  onEditSetting={(key) => {
                    setTab('customize');
                    setSidebarHidden(false);
                    setSettingsFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }));
                  }}
                  tool={tool}
                />
                {trayDrawn && (
                  <CardTray
                    tray={graphic.tray}
                    width={shownTrayWidth}
                    left={trayLeft}
                    top={trayTop}
                    scale={scale}
                    border={graphic.border}
                    fontFamily={fontFamily}
                    onSelect={setSelectedId}
                    onCardMenu={(id, x, y) => setCardMenu({ id, x, y })}
                    onCardDrop={trayCardDrop}
                    onPick={() => pickTargetOnBoard(boardTargets.length, true)}
                    selectedId={selectedId}
                    oneRow={oneRowTray}
                    pan={trayPan}
                    onPan={setTrayPan}
                    onTrayMenu={(x, y) => setCardMenu({ id: TRAY_MENU, x, y })}
                    boardCardWidth={boardCardWidth}
                    hintFont={interfaceFont}
                    showHint={!trayHintSeen}
                    arriving={arriving}
                    // Ignores presses while drawing (pen, eraser), as the board does, and while
                    // it slides away
                    listening={trayShown && tool === DEFAULT_TOOL}
                    opacity={trayOpacity}
                  />
                )}
                {/* Editor-only layer: hidden while exporting */}
                {/* Listening, so the dragged card's events (moved here) still reach the stage and
                move the outline with it; the outline itself takes no presses */}
                <Layer name="editor">
                  {/* The card being dragged, over the board and the tray and under the outline
                  (CardNode moves it here) */}
                  <Group name="drag" />
                  {placements
                    .filter((p) => p.item.id === selectedId)
                    .map((p) => (
                      <Rect
                        key={p.item.id}
                        ref={outlineRef}
                        x={p.x - OUTLINE.width}
                        y={p.y - OUTLINE.width}
                        width={p.width + 2 * OUTLINE.width}
                        height={p.height + 2 * OUTLINE.width}
                        stroke={OUTLINE.color}
                        strokeWidth={OUTLINE.width}
                        cornerRadius={OUTLINE.radius}
                        listening={false}
                      />
                    ))}
                </Layer>
              </Stage>
              {shownMenu &&
                (menuClosing ||
                  findCard(shownMenu.id) ||
                  (shownMenu.id === TRAY_MENU && trayShown)) && (
                  <div
                    // A new element for each menu, so each one plays the opening animation
                    key={`${shownMenu.id} ${shownMenu.x} ${shownMenu.y}`}
                    ref={cardMenuRef}
                    role="menu"
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={onCardMenuKey}
                    // Its flyout reaches past it (cardMenu in Editor.module.css)
                    className={`tierbinder-menu absolute z-10 tierbinder-popup tierbinder-list ${styles.cardMenu} flex flex-col ${menuClosing ? 'closing pointer-events-none' : ''}`}
                    // Kept inside the board's right edge
                    style={{
                      minWidth: MENU_WIDTH,
                      left: Math.max(0, Math.min(shownMenu.x, stageWidth * scale - MENU_WIDTH)),
                      // In the card tray, at the board's foot, it opens upward from the pointer;
                      // elsewhere down from it, raised where it wouldn't fit in the window
                      ...(trayShown && shownMenu.y > BOARD_HEIGHT * scale
                        ? { bottom: `calc(100% - ${shownMenu.y}px)` }
                        : {
                            top:
                              raisedMenu?.key === menuKey(shownMenu) ? raisedMenu.top : shownMenu.y,
                          }),
                    }}
                  >
                    {cardMenuItems(shownMenu).map((label) =>
                      label === 'Clear card tray' || label === MOVE_TO ? (
                        // Opens on a click (or Enter), not on hover; a second click closes it.
                        // Escape in it goes back to the row.
                        <div key={label} className={styles.flyoutAnchor}>
                          <button
                            ref={trayFlyoutRowRef}
                            role="menuitem"
                            aria-haspopup="menu"
                            aria-expanded={!!shownMenu.flyout}
                            data-row={label}
                            className={`tierbinder-option ${styles.flyoutItem}`}
                            onClick={() => toggleTrayFlyout(shownMenu, label === MOVE_TO)}
                          >
                            {titleCase(label === MOVE_TO ? moveLabel(shownMenu.id) : label)}
                            <span aria-hidden className={styles.menuChevron} />
                          </button>
                          {shownTrayFlyout !== null && (
                            <div
                              data-flyout
                              role="menu"
                              aria-label={
                                label === MOVE_TO ? moveLabel(shownMenu.id) : 'Clear card tray'
                              }
                              // Add to's choices, by their index in `targets` (one handler
                              // here rather than one per choice)
                              onClick={(e) => {
                                const choice = (e.target as HTMLElement).closest<HTMLElement>(
                                  '[data-target]'
                                );
                                if (choice)
                                  moveFromMenu(shownMenu.id, Number(choice.dataset.target));
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== 'Escape') return;
                                // Not the page's Escape, which would close the whole menu
                                e.stopPropagation();
                                // Not a menu already closing (it stays closed)
                                setCardMenu((m) => m && { ...m, flyout: undefined });
                                trayFlyoutRowRef.current?.focus();
                              }}
                              className={`tierbinder-menu tierbinder-popup tierbinder-list ${styles.flyout} flex flex-col ${trayFlyoutClosing ? 'closing pointer-events-none' : ''}`}
                            >
                              {label === MOVE_TO ? (
                                // Every place the card can go, with its swatch, as the
                                // result menu's Add to has
                                moveChoices(shownMenu.id).map((i) => (
                                  <button
                                    key={i}
                                    role="menuitem"
                                    className="tierbinder-option flex gap-2 items-center whitespace-nowrap"
                                    data-target={i}
                                  >
                                    <Swatch
                                      color={targets[i].color}
                                      outlined={'outlined' in targets[i] && targets[i].outlined}
                                    />
                                    {targets[i].name.replaceAll('\n', ' ')}
                                  </button>
                                ))
                              ) : (
                                <button
                                  role="menuitem"
                                  className="tierbinder-option whitespace-nowrap"
                                  onClick={() => {
                                    clearTray();
                                    setShownMenu(null);
                                    setCardMenu(null);
                                    // The menu is gone: focus goes to the board, not lost
                                    boardBoxRef.current?.focus({ preventScroll: true });
                                  }}
                                >
                                  {`Clear ${cardCount(shownTrayFlyout)}`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          key={label}
                          role="menuitem"
                          className="tierbinder-option"
                          onClick={() => {
                            runCardMenuItem(shownMenu, label);
                            setCardMenu(null);
                          }}
                        >
                          {titleCase(label)}
                        </button>
                      )
                    )}
                  </div>
                )}
            </div>

            {type.Toolbar && (
              <type.Toolbar graphic={graphic} onChange={setGraphic} tool={tool} onTool={setTool} />
            )}
          </div>
        </div>

        {shownResultMenu && (
          <div
            // A new element for each menu, so each one plays the opening animation
            key={`${shownResultMenu.x} ${shownResultMenu.y}`}
            ref={resultMenuRef}
            role="menu"
            aria-label={shownResultMenu.card.name}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={onResultMenuKey}
            className={`tierbinder-menu tierbinder-popup tierbinder-list ${styles.resultMenu} flex flex-col ${resultMenuClosing ? 'closing pointer-events-none' : ''}`}
            // At the pointer; moved inside the window once measured (above). As wide as its
            // rows, unlike the card menu
            style={{ left: shownResultMenu.x, top: shownResultMenu.y }}
          >
            <button
              role="menuitem"
              tabIndex={-1}
              className="tierbinder-option"
              onClick={() => {
                viewResult(shownResultMenu);
                setResultMenu(null);
              }}
            >
              View
            </button>
            {/* The flyout opens on a click (or Enter, or the right arrow), not on hover, and a
                second click closes it */}
            <div className={styles.flyoutAnchor}>
              <button
                ref={resultAddToRef}
                role="menuitem"
                tabIndex={-1}
                aria-haspopup="menu"
                aria-expanded={resultFlyout}
                className={`tierbinder-option ${styles.flyoutItem}`}
                onClick={() => (resultFlyout ? setResultFlyout(false) : openResultFlyout(true))}
              >
                {titleCase(`Add to ${type.targetNoun}`)}
                <span aria-hidden className={styles.menuChevron} />
              </button>
              {shownFlyout && (
                <div
                  data-flyout
                  role="menu"
                  aria-label={`Add to ${type.targetNoun}`}
                  className={`tierbinder-menu tierbinder-popup tierbinder-list ${styles.flyout} flex flex-col ${flyoutClosing ? 'closing pointer-events-none' : ''}`}
                >
                  {targets.map((t, i) => (
                    <button
                      key={i}
                      role="menuitem"
                      tabIndex={-1}
                      className="tierbinder-option flex gap-2 items-center whitespace-nowrap"
                      onClick={() => {
                        addResultTo(shownResultMenu.card, i, shownResultMenu.tile);
                        // Adding ends a split being made, as picking a target does
                        if (splitPicker) setPicking(null);
                        setResultMenu(null);
                        // Focus goes back to the result, not lost with the menu
                        shownResultMenu.tile.focus({ preventScroll: true });
                      }}
                    >
                      <Swatch color={t.color} outlined={'outlined' in t && t.outlined} />
                      {t.name.replaceAll('\n', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* A share link opened over a board with something on it: replace that board with
            the shared one, or keep it. A modal dialog (the page behind it is inert);
            Escape keeps theirs. Keys stop at it, so none reach the board. */}
        <dialog
          ref={sharedDialogRef}
          aria-labelledby="shared-title"
          aria-describedby="shared-description"
          className={`${styles.sharedDialog} tierbinder-popup`}
          onCancel={(e) => {
            e.preventDefault();
            answerShared(false);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          // However it closes, nothing's left waiting on it
          onClose={() => setSharedBoard(null)}
        >
          {sharedBoard && (
            <div className="flex flex-col gap-4">
              <h2 id="shared-title" className="tierbinder-heading">
                Open Shared {typeOf(sharedBoard.kind).label}?
              </h2>
              <p id="shared-description" className="text-(--tb-muted)">
                It replaces the {typeOf(sharedBoard.kind).label.toLowerCase()} on this device, card
                tray and all.
              </p>
              <div className="flex flex-wrap gap-3 justify-end">
                <Button onClick={() => answerShared(false)}>Keep Mine</Button>
                <Button variant="primary" onClick={() => answerShared(true)}>
                  Open Shared Board
                </Button>
              </div>
            </div>
          )}
        </dialog>

        {shownView && (
          <div
            ref={viewerRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-label={shownView.faces.map((f) => f.name).join(' / ')}
            className={`${styles.viewer} ${viewClosing ? styles.viewerClosing : ''}`}
          >
            <div
              ref={viewRef}
              className={styles.viewCards}
              style={
                {
                  '--card-ratio': `${CARD_WIDTH} / ${CARD_HEIGHT}`,
                  '--count': shownView.faces.length,
                } as React.CSSProperties
              }
            >
              {shownView.faces.map((face, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- the board's own image, already loaded through the proxy
                <img
                  key={i}
                  src={proxied(face.image)}
                  alt={face.name}
                  draggable={false}
                  className={styles.viewCard}
                  // The card images' rounded corners, as on the board
                  style={{
                    borderRadius: `${(CARD_CORNER_RADIUS / CARD_WIDTH) * 100}% / ${(CARD_CORNER_RADIUS / CARD_HEIGHT) * 100}%`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {dragGhost && (
          // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail, as in the results
          <img
            src={dragGhost.card.thumb}
            alt=""
            className={`${styles.thumb} fixed z-20 -translate-1/2 object-contain pointer-events-none opacity-80`}
            style={{ left: dragGhost.x, top: dragGhost.y }}
          />
        )}
      </div>
    </>
  );
}
