'use client';

import type Konva from 'konva';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { flushSync } from 'react-dom';
import { Group, Layer, Rect, Stage } from 'react-konva';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CARD_CORNER_RADIUS,
  CARD_HEIGHT,
  CARD_WIDTH,
  EXPORT_SCALE,
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
  mapTray,
  trayCardWidth,
  trayHeight,
  moveTrayCard,
  trayDropIndex,
  type Tray,
} from './canvas/tray';
import { currentGraphic, newDoc, parseSaved, type TierBinderDoc } from './document';
import { GRAPHIC_TYPES, typeOf, type Graphic, type GraphicKind } from './graphics';
import { DEFAULT_TIERS } from './graphics/tier-list/model';
import { DEFAULT_TOOL, type Placed, type Point } from './graphics/types';
import { parseImport } from './importText';
import { DEFAULT_SEARCH, sortDirection as sortLabel, type SearchOptions } from './searchOptions';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import ColorField, { BoardColors, boardColors } from './ui/ColorField';
import Dropdown, { Swatch } from './ui/Dropdown';
import RadioBar from './ui/RadioBar';
import SearchFilters from './ui/SearchFilters';
import Credits from './ui/Credits';
import SidebarHandle from './ui/SidebarHandle';
import styles from './Editor.module.css';
import { FOLD_CLEARANCE } from './ui/motion';
import { titleCase } from './text';

// The editor: the board, drawn by the document's graphic type (see graphics/types.ts), plus
// the top bar and sidebar shared by every graphic.

const STORAGE_KEY = 'tierbinder-doc';

// The Add to picker's swatch while a split card is being made: a white card
const SPLIT_SWATCH = '#ffffff';

// How long a toast stays before it fades (ms), and how much longer for each line past the
// first (an import's list of cards it couldn't find), so there's time to read them
const TOAST_DURATION = 3000;
const TOAST_LINE_DURATION = 1500;
// An import's toast lists at most this many problems, then how many more there were
const MAX_TOAST_PROBLEMS = 4;

// sessionStorage: the card tray's hint has done its job (a card has been in a tray)
const TRAY_HINT_KEY = 'tierbinder-tray-hint-seen';

// The selection outline, drawn just outside the card (canvas values; see Exceptions in
// design/hutton-design-system.md)
const OUTLINE = { width: 3, radius: 8, color: '#ffffff' };

// Changes every card on a graphic, on the board and in the card tray (null removes it)
function mapEveryCard(g: Graphic, change: (item: CardItem) => CardItem | null): Graphic {
  return { ...typeOf(g.kind).mapCards(g, change), tray: mapTray(g.tray, change) } as Graphic;
}

// A graphic with a changed tray, or why the tray couldn't take the card. A card added to
// the tray turns it on, if it was off.
function withTray(g: Graphic, tray: Tray | { error: string }): Placed<Graphic> {
  return 'error' in tray ? tray : ({ ...g, tray: { ...tray, enabled: true } } as Graphic);
}

// The card menu's narrowest width; it opens left of the pointer when this wouldn't fit
// inside the board's right edge
const MENU_WIDTH = 160;

// A touch press held this long (ms) opens a search result's menu, unless it moves more
// than TOUCH_SLOP (px) first, as long presses go on phones
const LONG_PRESS = 500;
const TOUCH_SLOP = 8;

// Under b8 the top bar slides away as the page scrolls down and back as it scrolls up,
// once the scroll has gone this far (px) one way, so small jitters don't toggle it
const TOP_BAR_SCROLL = 8;

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
  { value: 'add', label: 'Add Cards', icon: 'plus', color: 'var(--color-tier-fraud)' },
  { value: 'customize', label: 'Customize', icon: 'sliders', color: 'var(--color-tier-mid)' },
  { value: 'save', label: 'Save & Share', icon: 'share', color: 'var(--color-tier-solid)' },
] as const;
type Tab = (typeof TABS)[number]['value'];

// Card pools shown in Add Cards before a search: each previews up to POOL_PREVIEW_CARDS
// cards in a row, or card-shaped placeholders while it has none. They don't open yet.
type Pool = { name: string; cards: CardResult[] };
// How long the search options must stay unchanged before they rerun the search
const SEARCH_DELAY = 300;

// Placeholders shown while a search is under way: about three rows at most widths
const SKELETON_TILES = 18;

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

// One TCGdex has no image for, from pokemon-tcg-data's image hosts (as extra-images.json
// has it): Scrydex's by card id (me6-84), or pokemontcg.io's by path (sm35/53). Switch it
// to poolCard once TCGdex has the image.
const scrydexCard = (set: string, number: string, name: string, id: string): CardResult => ({
  set,
  number,
  name,
  image: `https://images.scrydex.com/pokemon/${id}/large`,
  thumb: `https://images.scrydex.com/pokemon/${id}/small`,
});
const pokemontcgCard = (set: string, number: string, name: string, path: string): CardResult => ({
  set,
  number,
  name,
  image: `https://images.pokemontcg.io/${path}_hires.png`,
  thumb: `https://images.pokemontcg.io/${path}.png`,
});

const FEATURED_POOLS: Pool[] = [
  {
    name: 'Best Decks of All Time',
    cards: [
      pokemontcgCard('SLG', '53', 'Zoroark-GX', 'sm35/53'),
      poolCard('SVI', '86', 'Gardevoir ex', 'sv/sv01/086'),
      poolCard('CEC', '156', 'Arceus & Dialga & Palkia-GX', 'sm/sm12/156'),
      poolCard('FST', '114', 'Mew VMAX', 'swsh/swsh8/114'),
      poolCard('SIT', '139', 'Lugia VSTAR', 'swsh/swsh12/139'),
      poolCard('TWM', '130', 'Dragapult ex', 'sv/sv06/130'),
    ],
  },
  {
    name: 'Delta Reign',
    cards: [
      scrydexCard('DLR', '84', 'Mega Rayquaza ex', 'me6-84'),
      scrydexCard('DLR', '88', 'Talonflame ex', 'me6-88'),
      scrydexCard('DLR', '11', 'Mega Golisopod ex', 'me6-11'),
      scrydexCard('DLR', '69', 'Mega Malamar ex', 'me6-69'),
      scrydexCard('DLR', '47', 'Mega Golurk ex', 'me6-47'),
      scrydexCard('DLR', '33', 'Raikou ex', 'me6-33'),
    ],
  },
  {
    name: 'Mega Evolution Cards',
    cards: [
      poolCard('MEG', '104', 'Mega Kangaskhan ex', 'me/me01/104'),
      poolCard('PFL', '13', 'Mega Charizard X ex', 'me/me02/013'),
      poolCard('MEG', '77', 'Mega Lucario ex', 'me/me01/077'),
      poolCard('MEG', '86', 'Mega Absol ex', 'me/me01/086'),
      poolCard('PBL', '65', 'Mega Excadrill ex', 'me/me05/065'),
      poolCard('CRI', '22', 'Mega Greninja ex', 'me/me04/022'),
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
  // Every message (a tier or the card tray is full, import results, copying) is a toast at
  // the top of the window, never on the board. It fades after TOAST_DURATION, plus
  // TOAST_LINE_DURATION for each line past the first; `stay` keeps work under way
  // ("Importing…") up until the next message replaces it (another message during an
  // import replaces it too, and the import's result follows). Only one shows: another
  // message replaces it, and the same one again keeps it up longer without replaying its entrance, so repeated clicks can't
  // pile them up. `id` changes with the message (replaying the entrance), `n` with every
  // showing (restarting the timer); `closing` while it fades, like the card menu.
  const [toast, setToast] = React.useState<{
    message: string;
    id: number;
    n: number;
    closing: boolean;
    stay: boolean;
  } | null>(null);
  const showToast = (message: string, { stay = false } = {}) =>
    setToast((t) => ({
      message,
      id: t && t.message === message && !t.closing ? t.id : (t?.id ?? 0) + 1,
      n: (t?.n ?? 0) + 1,
      closing: false,
      stay,
    }));
  React.useEffect(() => {
    if (!toast || toast.closing || toast.stay) return;
    const lines = toast.message.split('\n').length;
    const timer = setTimeout(
      () => setToast((t) => (t ? { ...t, closing: true } : t)),
      TOAST_DURATION + (lines - 1) * TOAST_LINE_DURATION
    );
    return () => clearTimeout(timer);
    // Restarts with each showing (`n`), not on closing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.n]);
  React.useEffect(() => {
    if (!toast?.closing) return;
    const timer = setTimeout(() => setToast(null), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [toast?.closing]);
  // Featured pool cards whose thumbnail failed both ways, by set and number, and the cards
  // each pool shows without them
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
  // Where the next search result goes: one of the graphic's targets
  const [target, setTarget] = React.useState(0);
  // The active tool: moving cards, or one from the graphic's toolbar
  const [tool, setTool] = React.useState(DEFAULT_TOOL);
  // Board button whose choices are showing: confirming Clear board, or picking a type
  const [confirmingClear, setConfirmingClear] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>('add');
  // Menu for a clicked card, or for a search result dropped on a card (`dropped`: the
  // result, and the point it was dropped at), positioned in the board's on-screen pixels
  const [cardMenu, setCardMenu] = React.useState<{
    id: string;
    x: number;
    y: number;
    dropped?: { card: CardResult; point: Point };
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
  const showSidebarRef = React.useRef<HTMLButtonElement>(null);
  const sidebarCollapsed = wide && sidebarHidden;
  // Under b8, the top bar slides up out of the way while the page scrolls down, and back
  // when it scrolls up or reaches the top (the page's scroll container is <main>, in
  // layout.tsx)
  const topRef = React.useRef<HTMLElement>(null);
  const [topTucked, setTopTucked] = React.useState(false);
  React.useEffect(() => {
    const page = topRef.current?.closest('main');
    if (wide || !page) {
      setTopTucked(false);
      return;
    }
    let last = page.scrollTop;
    const onScroll = () => {
      // Clamped to the page, so a bounce past either end (or the page getting shorter)
      // doesn't read as scrolling back
      const y = Math.min(Math.max(page.scrollTop, 0), page.scrollHeight - page.clientHeight);
      const height = topRef.current?.offsetHeight ?? 0;
      if (y <= height) {
        setTopTucked(false);
        last = y;
      } else if (Math.abs(y - last) >= TOP_BAR_SCROLL) {
        setTopTucked(y > last);
        last = y;
      }
    };
    page.addEventListener('scroll', onScroll, { passive: true });
    return () => page.removeEventListener('scroll', onScroll);
  }, [wide]);
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
  React.useEffect(() => {
    const query = wideQuery();
    const update = () => {
      setWide(query.matches);
      if (!query.matches) setSidebarHidden(false);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const hideSidebarRef = React.useRef<HTMLButtonElement>(null);
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
  // The tray's height follows its cards
  const shownTrayHeight = trayShown ? trayHeight(graphic.tray.items.length) : 0;
  const exportHeight = BOARD_HEIGHT + (exportTray ? shownTrayHeight : 0);

  // A dragged card shows at the board's card size over the board, and the tray's over
  // the card tray (as a new card there would be)
  const boardCardWidth = type.cardWidth?.(graphic) ?? CARD_WIDTH;
  // (a full tray won't take it, so it keeps the board's size)
  const cardDragWidth = (center: Point) =>
    trayShown && center.y > BOARD_HEIGHT && graphic.tray.items.length < MAX_TRAY_CARDS
      ? trayCardWidth(graphic.tray.items.length + 1)
      : boardCardWidth;

  // Every card and where it's drawn: the board's, then the tray's
  const boardPlacements = type.layout(graphic);
  const trayPlacements = trayShown
    ? layoutTray(graphic.tray).map((p) => ({ ...p, y: p.y + trayTop }))
    : [];
  const placements = [...boardPlacements, ...trayPlacements];

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
        x: board.left + (viewedPlace.x + viewedPlace.width / 2) * scale,
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
  // Every color field's Board Colors: the tiers', then the board's own, and white
  const colorChoices = boardColors([
    // Named after their tiers, on one line, or "Tier 2" for a tier with no name
    ...boardTargets.flatMap((t, i) =>
      t.color
        ? [{ name: t.name.replace(/\s+/g, ' ').trim() || `Tier ${i + 1}`, color: t.color }]
        : []
    ),
    { name: 'Background', color: graphic.background },
    { name: 'Border', color: graphic.border },
    { name: 'Card tray', color: graphic.tray.color },
    { name: 'White', color: '#ffffff' },
  ]);
  const targetIndex = Math.min(target, targets.length - 1);

  // Changes the board showing
  const setGraphic = React.useCallback(
    (change: (graphic: Graphic) => Graphic) =>
      setDoc((d) => ({ ...d, graphics: { ...d.graphics, [d.kind]: change(currentGraphic(d)) } })),
    []
  );

  // Shows another board type's board (kept from when it was last used, or new), or
  // replaces the board showing with a new one
  function showBoard(kind: GraphicKind, clear = false) {
    setDoc((d) => {
      const old = d.graphics[kind];
      if (old && !clear) return { ...d, kind };
      // Clearing empties the card tray if it shows, keeping it on in its color; a hidden
      // tray (turned off) keeps its cards, as it promises
      const fresh = typeOf(kind).create();
      const keepTray = kind !== d.kind || !trayShown;
      const next = old
        ? { ...fresh, tray: { ...old.tray, items: keepTray ? old.tray.items : [] } }
        : fresh;
      return { ...d, kind, graphics: { ...d.graphics, [kind]: next } };
    });
    setSelectedId(null);
    setCardMenu(null);
    setPicking(null);
    // A cleared board starts Add Cards over too
    if (clear) {
      setQuery('');
      clearSearch();
    }
    if (kind !== doc.kind) {
      setTarget(0);
      setTool(DEFAULT_TOOL);
    }
    setConfirmingClear(false);
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

  // The board fills the workspace: its width on narrow screens (where the page scrolls),
  // and from b8 up as much as fits, leaving room for the toolbar
  // around it. Exports are always full size.
  React.useEffect(() => {
    const workspace = workspaceRef.current;
    const board = boardRef.current;
    const box = boardBoxRef.current;
    if (!workspace || !board || !box) return;
    const fit = () => {
      const style = getComputedStyle(workspace);
      const width =
        workspace.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      let next = width / BOARD_WIDTH;
      if (wide) {
        const height =
          workspace.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const around = board.offsetHeight - box.offsetHeight;
        // The card tray and the gap above it, when it shows
        const tray = trayShown ? TRAY_GAP : 0;
        const designHeight = BOARD_HEIGHT + shownTrayHeight;
        next = Math.min(next, (height - around - tray) / designHeight);
      }
      // Rounded down, so a fractional pixel never overflows the workspace into a scrollbar
      setScale(Math.max(0, Math.floor(next * 1000) / 1000));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(workspace);
    observer.observe(board);
    return () => {
      observer.disconnect();
    };
  }, [wide, trayShown, shownTrayHeight]);

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
    const count = (n: number) => `${n} ${n === 1 ? 'Card' : 'Cards'}`;
    if (trayItems.length) {
      const placed = importTrayCards(next.tray, trayItems);
      const n = placed.tray.items.length - next.tray.items.length;
      if (n) added.push(`Added ${count(n)} to the Card Tray`);
      next = { ...next, tray: placed.tray };
      errors.push(...placed.errors);
    }
    if (resolvedGroups.length) {
      const placed = currentType.importCards(next, resolvedGroups);
      const n = currentType.layout(placed.graphic).length - currentType.layout(next).length;
      if (n) added.push(`Added ${count(n)} to the Board`);
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
      ].join('\n') || 'No Cards Found'
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

  // Adds a card where it was dropped: in the card tray (or the gap above it) by position,
  // or where the graphic puts it
  const dropAt = (item: CardItem, point: Point): Placed<Graphic> =>
    trayShown && point.y > BOARD_HEIGHT
      ? withTray(
          graphic,
          insertTrayCard(
            graphic.tray,
            item,
            trayDropIndex(graphic.tray, '', { x: point.x, y: point.y - trayTop })
          )
        )
      : type.dropCard(graphic, item, point);

  // A board card dropped in the card tray moves there; the graphic moves it otherwise
  const boardCardDrop = (id: string, x: number, y: number) => {
    const place = boardPlacements.find((p) => p.item.id === id);
    if (!trayShown || !place || y + place.height / 2 <= BOARD_HEIGHT) return false;
    const point = { x: x + place.width / 2, y: y + place.height / 2 - trayTop };
    const placed = withTray(
      typeOf(graphic.kind).mapCards(graphic, (i) => (i.id === id ? null : i)),
      insertTrayCard(graphic.tray, place.item, trayDropIndex(graphic.tray, '', point))
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
      const point = { x: center.x, y: center.y - trayTop };
      setGraphic((g) => ({
        ...g,
        tray: moveTrayCard(g.tray, id, trayDropIndex(g.tray, id, point)),
      }));
      return;
    }
    const without = { ...graphic, tray: mapTray(graphic.tray, (i) => (i.id === id ? null : i)) };
    applyPlaced(type.dropCard(without, place.item, center));
  };

  // The card menu's items: for a clicked card, or for a search result dropped on it
  const cardMenuItems = (menu: CardMenu) => {
    const { id, dropped } = menu;
    const split = findCard(id)?.split;
    if (dropped) {
      return split
        ? ['Replace top half', 'Replace bottom half', addToTarget(menu)]
        : ['Add as split card', addToTarget(menu)];
    }
    return split
      ? ['View', 'Remove card', 'Replace top half', 'Replace bottom half', 'Swap halves', 'Unsplit']
      : ['View', 'Remove card', 'Replace card', 'Make split card'];
  };

  function runCardMenuItem(menu: CardMenu, label: string) {
    const { id, dropped } = menu;
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
    if (label === 'Replace card' || label === 'Replace top half') startPicking(id, 'top');
    if (label === 'Make split card' || label === 'Replace bottom half') startPicking(id, 'bottom');
    if (label === 'Swap halves') {
      updateCard(id, (i) => (i.split ? { ...i, ...i.split, split: faceOf(i) } : i));
    }
    // Keeps the top card
    if (label === 'Unsplit') updateCard(id, (i) => ({ ...i, split: undefined }));
  }

  // Adds a search result to one of the Add to choices: the graphic's, or the card tray
  function addResultTo(card: CardResult, index: number) {
    applyPlaced(
      index === boardTargets.length
        ? withTray(graphic, insertTrayCard(graphic.tray, toItem(card)))
        : type.addCard(graphic, toItem(card), index)
    );
  }

  function pickResult(card: CardResult) {
    if (picking && pickingCard) {
      const face = toFace(card);
      updateCard(picking.id, (i) =>
        picking.part === 'top' ? { ...i, ...face } : { ...i, split: face }
      );
      setPicking(null);
      return;
    }
    addResultTo(card, targetIndex);
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
    const point = { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale };
    // Later cards overlap earlier ones, so the last card under the pointer is the top one
    const under = placements.findLast(
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
    // An exported card tray sits flush and square under the board
    const tray = stage.findOne('.tray');
    const trayBox = stage.findOne<Konva.Rect>('.trayBox');
    // Put back as they are now
    const trayY = tray?.y();
    const trayRadius = trayBox?.cornerRadius();
    const stageScale = stage.scaleX();
    if (exportTray) {
      tray?.y(BOARD_HEIGHT);
      trayBox?.cornerRadius(0);
    }
    // Drawn at design size times EXPORT_SCALE, not from the on-screen scale, so the image
    // is always whole pixels (2400 wide). Konva draws it as toBlob is called, so the board
    // is put back before the screen next draws.
    stage.scale({ x: 1, y: 1 });
    let blob: Promise<Blob>;
    try {
      blob = stage.toBlob({
        pixelRatio: EXPORT_SCALE,
        x: 0,
        y: 0,
        width: BOARD_WIDTH,
        height: exportHeight,
      }) as Promise<Blob>;
    } finally {
      stage.scale({ x: stageScale, y: stageScale });
      editorOnly.forEach((node) => node.show());
      if (trayY !== undefined) tray?.y(trayY);
      if (trayRadius !== undefined) trayBox?.cornerRadius(trayRadius);
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
    <BoardColors value={colorChoices}>
      <div className="tierbinder-page w-full b8:h-full flex flex-col b8:flex-row text-body">
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
          {toast && !toast.closing && <p key={toast.n}>{toast.message}</p>}
        </div>
        {toast && (
          <div
            // A new element for each new message, so it plays its entrance
            key={toast.id}
            aria-hidden
            className={`${styles.toast} tierbinder-popup ${toast.closing ? styles.toastClosing : ''}`}
          >
            {toast.message}
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
            ref={topRef}
            className={`${styles.top} ${!wide && topTucked ? styles.topTucked : ''}`}
          >
            <Link href="/" className={styles.brand}>
              <Image src="/tierbinder-combined-dark.svg" alt="TierBinder" width={114} height={25} />
            </Link>
          </header>
          <SidebarHandle />
          <aside className={`${styles.side} flex flex-col min-w-0 b8:flex-1 b8:min-h-0`}>
            <div className={styles.sideHead}>
              <RadioBar
                label="Editor sections"
                options={TABS}
                value={tab}
                onChange={(next) => {
                  // Add Cards clicked while it's showing: straight to the search
                  // (not on touch screens, where it would bring up the keyboard over the page)
                  if (next === 'add' && tab === 'add' && !matchMedia('(pointer: coarse)').matches) {
                    searchInputRef.current?.focus();
                  }
                  setTab(next);
                }}
                onFullWidth={fitSidebarToNav}
              />
            </div>

            {/* The panels stay mounted, so tabbing away keeps a search or import text. min-w-0
            so the results scroll instead of widening the sidebar; on wide screens they
            fill the sidebar's height and scroll on their own, and the panel scrolls when
            the pools and Advanced don't fit */}
            <section
              role="tabpanel"
              hidden={tab !== 'add'}
              className="tierbinder-panel flex flex-col gap-4 min-w-0 b8:flex-1 b8:min-h-0 b8:overflow-y-auto"
            >
              {/* Grows to fill the sidebar while it shows search results */}
              <div
                className={`flex flex-col gap-3 min-w-0 ${showingResults ? 'b8:flex-1 b8:min-h-0' : ''}`}
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
                      // Card names aren't real words: don't let phones "fix" them
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
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
                  {/* Flips the order: newest or oldest set first, and each set's numbers */}
                  {searchShown && (
                    <Button
                      type="button"
                      variant="icon"
                      className="ml-auto"
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
                  <div className={`${styles.resultsBox} b8:flex-1 b8:min-h-0`}>
                    <div
                      ref={resultsRef}
                      className={`${styles.results} overflow-y-auto overflow-x-hidden`}
                      style={
                        { '--card-ratio': `${CARD_WIDTH} / ${CARD_HEIGHT}` } as React.CSSProperties
                      }
                      onScroll={(e) => setResultsScrolled(e.currentTarget.scrollTop > 0)}
                    >
                      {showingSkeleton
                        ? Array.from({ length: SKELETON_TILES }, (_, i) => (
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
                              onClick={() => {
                                // The tap that ends a long press doesn't also add the card
                                if (longPressOpened.current) {
                                  longPressOpened.current = false;
                                  return;
                                }
                                if (!justDragged.current) pickResult(card);
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
                                  pickResult(card);
                                }
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnails, no optimization needed */}
                              <img
                                src={card.thumb}
                                alt={`${card.name} (${card.set} ${card.number})`}
                                className={`${styles.resultThumb} object-contain`}
                                // Shimmers until it's loaded (Editor.module.css)
                                onLoad={(e) => {
                                  e.currentTarget.dataset.loaded = '';
                                }}
                                loading="lazy"
                                draggable={false}
                                // The CDN occasionally fails a load; retry once through the image
                                // proxy, and hide the result if that fails too
                                onError={(e) => {
                                  const proxy = proxied(card.thumb);
                                  if (!e.currentTarget.src.endsWith(proxy)) {
                                    e.currentTarget.src = proxy;
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

              {/* Card pools to browse and Advanced, until a search shows results or finds none; they come
              back when the search is emptied or the board is cleared. The pools are
              placeholders for now: they don't open yet. */}
              {!searchShown && (
                <div className="flex flex-col gap-3">
                  <h3 className="tierbinder-heading">Featured Card Pools</h3>
                  {FEATURED_POOLS.map((pool) => (
                    <div key={pool.name} className={styles.pool}>
                      <span className={`${styles.poolName} text-caption font-semibold`}>
                        {pool.name}
                        <span className={styles.poolChevron} aria-hidden />
                      </span>
                      {/* A fixed number of columns, so every pool's cards are the same size */}
                      <div
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
                              if (!e.currentTarget.src.endsWith(proxy)) e.currentTarget.src = proxy;
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
                      </div>
                    </div>
                  ))}
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
                      onClick={() => setImporting((on) => !on)}
                    >
                      Bulk Import
                      <span aria-hidden className={styles.disclosureChevron} />
                    </Button>
                    <div
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
              className="tierbinder-panel flex flex-col gap-3 b8:flex-1 b8:min-h-0 b8:overflow-y-auto"
            >
              <Dropdown
                label="Board Type"
                value={doc.kind}
                options={GRAPHIC_TYPES.map((t) => ({ value: t.kind, label: t.label }))}
                onChange={(kind) => {
                  if (kind !== doc.kind) showBoard(kind);
                }}
              />
              <type.Settings graphic={graphic} onChange={setGraphic} focus={settingsFocus} />
              <h3 className="tierbinder-heading">Card Tray</h3>
              <Checkbox
                checked={graphic.tray.enabled}
                onChange={(enabled) => {
                  setGraphic((g) => ({ ...g, tray: { ...g.tray, enabled } }));
                  // Turned off while it's the Add to choice: back to the first tier, so the
                  // next card doesn't quietly turn it on again
                  if (!enabled && targetIndex === boardTargets.length) setTarget(0);
                }}
              >
                Show card tray under the board
              </Checkbox>
              {graphic.tray.enabled && (
                <div className="tierbinder-prop">
                  Tray Color
                  <ColorField
                    label="Card tray color"
                    value={graphic.tray.color}
                    onChange={(color) => setGraphic((g) => ({ ...g, tray: { ...g.tray, color } }))}
                  />
                </div>
              )}
              {/* Confirmed on the page: some browsers (the in-app one) never show confirm().
              16px above it, as between sections, so it doesn't read as part of the last one */}
              {confirmingClear ? (
                <div className="mt-3 flex flex-wrap gap-3 items-center">
                  {trayShown && graphic.tray.items.length
                    ? 'Clear the Board and Card Tray?'
                    : 'Clear the Board?'}
                  <Button onClick={() => showBoard(doc.kind, true)}>Yes</Button>
                  <Button onClick={() => setConfirmingClear(false)}>Cancel</Button>
                </div>
              ) : (
                <Button className="mt-3 self-start" onClick={() => setConfirmingClear(true)}>
                  Clear Board
                </Button>
              )}
            </section>

            <section
              role="tabpanel"
              hidden={tab !== 'save'}
              className="tierbinder-panel flex flex-col gap-3 b8:flex-1 b8:min-h-0"
            >
              <h3 className="tierbinder-heading">Image</h3>
              <div className="tierbinder-prop">
                Size
                <span className="text-(--tb-text)">
                  {BOARD_WIDTH * EXPORT_SCALE} × {exportHeight * EXPORT_SCALE}
                </span>
              </div>
              <div className="tierbinder-prop">
                Format
                <span className="text-(--tb-text)">PNG</span>
              </div>
              {trayShown && (
                <Checkbox checked={includeTray} onChange={setIncludeTray}>
                  Include card tray in export
                </Checkbox>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={exportPng} disabled={busy}>
                  Export PNG
                </Button>
                <Button onClick={copyPng} disabled={busy}>
                  Copy PNG
                </Button>
              </div>
            </section>

            {/* At the sidebar's foot under every tab, until the credits find a better home */}
            {/* The credits, and from b8 up the button that hides the sidebar at its other end */}
            <footer className={styles.foot}>
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
          className={`${styles.canvas} ${sidebarCollapsed ? styles.canvasCollapsed : ''} flex-1 min-w-0 b8:overflow-y-auto p-4 flex flex-col`}
          inert={viewing !== null}
        >
          <div
            ref={boardRef}
            className="flex flex-col gap-4"
            style={{ width: BOARD_WIDTH * scale }}
          >
            <div ref={boardBoxRef} tabIndex={-1} className={`${styles.boardBox} w-full relative`}>
              <Stage
                ref={(stage) => {
                  stageRef.current = stage;
                }}
                width={BOARD_WIDTH * scale}
                height={BOARD_HEIGHT * scale + (trayShown ? TRAY_GAP + shownTrayHeight * scale : 0)}
                scaleX={scale}
                scaleY={scale}
                onMouseDown={(e) => {
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
                  onPickTarget={setTarget}
                  onEditSetting={(key) => {
                    setTab('customize');
                    setSidebarHidden(false);
                    setSettingsFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }));
                  }}
                  tool={tool}
                />
                {trayShown && (
                  <CardTray
                    tray={graphic.tray}
                    top={trayTop}
                    scale={scale}
                    border={graphic.border}
                    fontFamily={fontFamily}
                    onSelect={setSelectedId}
                    onCardMenu={(id, x, y) => setCardMenu({ id, x, y })}
                    onCardDrop={trayCardDrop}
                    onPick={() => setTarget(boardTargets.length)}
                    boardCardWidth={boardCardWidth}
                    hintFont={interfaceFont}
                    showHint={!trayHintSeen}
                    // Ignores presses while drawing (pen, eraser), as the board does
                    listening={tool === DEFAULT_TOOL}
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
              {shownMenu && (menuClosing || findCard(shownMenu.id)) && (
                <div
                  // A new element for each menu, so each one plays the opening animation
                  key={`${shownMenu.id} ${shownMenu.x} ${shownMenu.y}`}
                  ref={cardMenuRef}
                  role="menu"
                  onContextMenu={(e) => e.preventDefault()}
                  className={`tierbinder-menu absolute z-10 tierbinder-popup tierbinder-list flex flex-col ${menuClosing ? 'closing pointer-events-none' : ''}`}
                  // Kept inside the board's right edge
                  style={{
                    minWidth: MENU_WIDTH,
                    left: Math.min(shownMenu.x, BOARD_WIDTH * scale - MENU_WIDTH),
                    // In the card tray, at the board's foot, it opens upward from the pointer
                    ...(trayShown && shownMenu.y > BOARD_HEIGHT * scale
                      ? { bottom: `calc(100% - ${shownMenu.y}px)` }
                      : { top: shownMenu.y }),
                  }}
                >
                  {cardMenuItems(shownMenu).map((label) => (
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
                  ))}
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
            // At the pointer; moved inside the window once measured (above)
            style={{ minWidth: MENU_WIDTH, left: shownResultMenu.x, top: shownResultMenu.y }}
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
                        addResultTo(shownResultMenu.card, i);
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
    </BoardColors>
  );
}
