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
import ColorField from './ui/ColorField';
import Dropdown from './ui/Dropdown';
import RadioBar from './ui/RadioBar';
import SearchFilters from './ui/SearchFilters';
import Credits from './ui/Credits';
import SidebarHandle from './ui/SidebarHandle';
import styles from './Editor.module.css';
import { FOLD_CLEARANCE } from './ui/motion';

// The editor: the board, drawn by the document's graphic type (see graphics/types.ts), plus
// the top bar and sidebar shared by every graphic.

const STORAGE_KEY = 'tierbinder-doc';

// The selection outline, drawn just outside the card (canvas values; see Exceptions in
// design/hutton-design-system.md)
const OUTLINE = { width: 3, radius: 8, color: '#ffffff' };

// Changes every card on a graphic, on the board and in the card tray (null removes it)
function mapEveryCard(g: Graphic, change: (item: CardItem) => CardItem | null): Graphic {
  return { ...typeOf(g.kind).mapCards(g, change), tray: mapTray(g.tray, change) } as Graphic;
}

// A graphic with a changed tray, or why the tray couldn't take the card
function withTray(g: Graphic, tray: Tray | { error: string }): Placed<Graphic> {
  return 'error' in tray ? tray : ({ ...g, tray } as Graphic);
}

// The card menu's narrowest width; it opens left of the pointer when this wouldn't fit
// inside the board's right edge
const MENU_WIDTH = 160;

// The light logo shown where the top bar's was while the sidebar is hidden
// (tierbinder-combined-light.svg, drawn at 137×28), at the top bar logo's height (25px), so
// its mark lands where the top bar's did; cut to the mark alone when the full logo won't
// fit beside the board, with the room either needs around it to show (space-3)
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
  const graphic = currentGraphic(doc);
  const type = typeOf(graphic.kind);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);
  const [fontFamily, setFontFamily] = React.useState('sans-serif');
  // The interface's font (Figtree), for canvas text that belongs to the editor (the empty
  // card tray's hint)
  const [interfaceFont, setInterfaceFont] = React.useState('sans-serif');
  const [status, setStatus] = React.useState('');
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

  // From b8 up, where the board has the room beside the sidebar; the card tray only
  // shows there
  // Known from the first render (the editor only renders in the browser), so the board's
  // first fit already uses the wide layout
  const [wide, setWide] = React.useState(() => wideQuery().matches);
  // The sidebar column hidden with Ctrl+\ (Cmd+\ on a Mac, as in Notion and Figma) or the
  // button at the sidebar's foot, sliding out to leave the window to the board; from b8 up
  // only, where it's beside the board. Not saved: a reload, or a narrower window, shows it.
  const [sidebarHidden, setSidebarHidden] = React.useState(false);
  const showSidebarRef = React.useRef<HTMLButtonElement>(null);
  const sidebarCollapsed = wide && sidebarHidden;
  // While the sidebar is hidden, the light logo fades in where the top bar's was (the colored
  // one goes with the sidebar), once the slide is over (`data-settled`), as a button that
  // brings the sidebar back: the full logo if the board leaves room for it, else the mark
  // alone, else neither (`data-size`, measured as the board moves). Showing the sidebar fades
  // it out (`logoLeaving`) as the top bar comes back.
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
  const trayShown = wide && graphic.tray.enabled;
  const trayTop = BOARD_HEIGHT + TRAY_GAP / (scale || 1);
  // Exported under the board when ticked in Save & Share
  const [includeTray, setIncludeTray] = React.useState(false);
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
  const [viewing, setViewing] = React.useState<{ id: string; faces: CardFace[] } | null>(null);
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
    const board = boardBoxRef.current;
    viewerRef.current?.focus({ preventScroll: true });
    return () => board?.focus({ preventScroll: true });
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
  // Where the cards grow from and shrink back to: the card on the board, as a transform
  // of the cards' place in the middle (--from), measured without that transform
  const viewRef = React.useRef<HTMLDivElement>(null);
  const viewedPlace = placements.find((p) => p.item.id === shownView?.id);
  React.useLayoutEffect(() => {
    const cards = viewRef.current;
    const stage = stageRef.current;
    if (!cards || !stage || !viewedPlace) return;
    const board = stage.container().getBoundingClientRect();
    const x = board.left + (viewedPlace.x + viewedPlace.width / 2) * scale;
    const y = board.top + (viewedPlace.y + viewedPlace.height / 2) * scale;
    const dx = x - (cards.offsetLeft + cards.offsetWidth / 2);
    const dy = y - (cards.offsetTop + cards.offsetHeight / 2);
    const shrink = (viewedPlace.height * scale) / cards.offsetHeight;
    cards.style.setProperty('--from', `translate(${dx}px, ${dy}px) scale(${shrink})`);
    // The card's place by value: placements are new objects every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedPlace?.x, viewedPlace?.y, viewedPlace?.width, viewedPlace?.height, viewClosing, scale]);
  // The graphic's targets, then the card tray while it shows
  const boardTargets = type.targets(graphic);
  const targets = trayShown
    ? [...boardTargets, { name: 'Card tray', color: graphic.tray.color, outlined: true }]
    : boardTargets;
  // The set filter's ticks: the board's tier colors, or a new tier list's on a board
  // without them
  const targetColors = boardTargets.flatMap((t) => (t.color ? [t.color] : []));
  const tickColors = targetColors.length ? targetColors : DEFAULT_TIERS.map(([, color]) => color);
  const targetIndex = Math.min(target, targets.length - 1);
  const trayTargeted = trayShown && targetIndex === boardTargets.length;

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
      // tray (turned off, or a narrow window) keeps its cards, as it promises
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
      setStatus(placed.error);
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
  // and from b8 up as much as fits, leaving room for the toolbar and status
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

  // The floating logo's size: the biggest that clears the board (and its toolbar and
  // status) by LOGO_CLEARANCE. Measured whenever the workspace or the board changes size:
  // as the sidebar slides, the board moves to stay centered even once its scale settles.
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
      const size = clears(LIGHT_LOGO_WIDTH) ? 'full' : clears(LOGO_MARK_WIDTH) ? 'mark' : null;
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

  // Only a card that shows: not one in a card tray hidden on a narrow screen
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

  async function runImport() {
    const groups = parseImport(importText);
    setBusy(true);
    setStatus('Importing…');
    const lines = groups.flatMap((g) => g.cards);
    const resolved = await mapLimit(lines, 4, resolveCard);
    const found = new Map(lines.map((line, i) => [line, resolved[i]]));
    const errors: string[] = [];
    for (const line of lines) {
      if (!found.get(line)) {
        const name = line.split ? `${line.name} / ${line.split.name}` : line.name;
        errors.push(`Line ${line.line}: couldn't find "${name}".`);
      }
    }
    const resolvedGroups = groups.map((g) => ({
      name: g.name,
      items: g.cards.flatMap((line) => found.get(line) ?? []),
    }));
    // Pure, so it runs on the latest board (it may have changed while cards were looking
    // up); the messages come from the board as it was
    setGraphic((g) => typeOf(g.kind).importCards(g, resolvedGroups).graphic);
    setBusy(false);
    errors.push(...type.importCards(graphic, resolvedGroups).errors);
    const added = resolved.filter(Boolean).length;
    setStatus(
      errors.length ? errors.join('\n') : `Added ${added} ${added === 1 ? 'card' : 'cards'}.`
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
      setSearchError(e instanceof Error ? e.message : 'Search failed.');
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

  function pickResult(card: CardResult) {
    if (picking && pickingCard) {
      const face = toFace(card);
      updateCard(picking.id, (i) =>
        picking.part === 'top' ? { ...i, ...face } : { ...i, split: face }
      );
      setPicking(null);
      return;
    }
    applyPlaced(
      trayTargeted
        ? withTray(graphic, insertTrayCard(graphic.tray, toItem(card)))
        : type.addCard(graphic, toItem(card), targetIndex)
    );
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
      setStatus('Copied to clipboard.');
    } catch {
      setStatus("Couldn't copy; use Export PNG.");
    }
  }

  return (
    // The sidebar column (the logo header, then the sidebar) on the left of the board. On
    // narrow screens the column dissolves (Editor.module.css): the header stays at the top,
    // then the board, then the sidebar. On wide screens each side scrolls on its own, so
    // the search results stay beside the board.
    <div className="tierbinder-page w-full b8:h-full flex flex-col b8:flex-row text-body">
      {logoMounted && (
        <button
          ref={floatingLogoRef}
          type="button"
          className={`${styles.floatingBrand} ${logoLeaving ? styles.floatingBrandLeaving : ''}`}
          style={
            {
              '--logo-mark-width': `${LOGO_MARK_WIDTH}px`,
              '--logo-full-width': `${LIGHT_LOGO_WIDTH}px`,
            } as React.CSSProperties
          }
          aria-label="Show sidebar"
          title={`Show sidebar (${SIDEBAR_SHORTCUT()})`}
          aria-keyshortcuts="Control+\ Meta+\"
          aria-controls="sidebar-column"
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
        <header className={styles.top}>
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
              onChange={setTab}
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
                      className={styles.clearSearch}
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
                {!picking && targets.length > 1 && (
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
                    onChange={setTarget}
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
                    <p className="font-semibold">No cards found</p>
                    {(noResults.query || noResults.sets.length > 0) && (
                      <p className="text-(--tb-muted)">
                        {noResults.query && `for “${noResults.query}”`}
                        {noResults.query && noResults.sets.length > 0 && ' '}
                        {noResults.sets.length > 0 &&
                          `in ${new Intl.ListFormat('en').format(noResults.sets)}`}
                      </p>
                    )}
                  </div>
                  {noResults.sets.length > 0 && (
                    <Button
                      type="button"
                      className="self-start"
                      onClick={() => changeSearchOptions({ ...searchOptions, sets: [] })}
                    >
                      {noResults.query ? 'Search all sets' : 'Clear sets'}
                    </Button>
                  )}
                </div>
              )}
              {picking && pickingCard && (
                <p className="flex gap-3 items-center">
                  {picking.part === 'top'
                    ? pickingCard.split
                      ? `Replacing the top half (${pickingCard.name})`
                      : `Replacing ${pickingCard.name}`
                    : pickingCard.split
                      ? `Replacing the bottom half (${pickingCard.split.name})`
                      : `Splitting ${pickingCard.name}: pick the bottom card`}
                  <Button onClick={() => setPicking(null)}>Cancel</Button>
                </p>
              )}
              {/* Tiles as many per row as fit (Editor.module.css): placeholders while a
                search is under way, then the results. A shade over the top shows when
                they're scrolled. */}
              {/* The skeleton and results are visual; this says what they show */}
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
                              if (e.pointerType === 'touch' || e.button !== 0) return;
                              e.preventDefault();
                              resultPress.current = {
                                card,
                                x: e.clientX,
                                y: e.clientY,
                                dragging: false,
                              };
                            }}
                            onClick={() => {
                              if (!justDragged.current) pickResult(card);
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
                  <span aria-hidden className={styles.resultsShade} data-shown={resultsScrolled} />
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
                    Bulk import
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
                            '# Goated\nMew ex MEW 151\nAlakazam\n# Solid\nDragapult ex TWM 130'
                          }
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                        />
                        <Button
                          variant="primary"
                          onClick={runImport}
                          disabled={busy || !importText.trim()}
                        >
                          Import (adds to the board)
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
              label="Board type"
              value={doc.kind}
              options={GRAPHIC_TYPES.map((t) => ({ value: t.kind, label: t.label }))}
              onChange={(kind) => {
                if (kind !== doc.kind) showBoard(kind);
              }}
            />
            <type.Settings graphic={graphic} onChange={setGraphic} focus={settingsFocus} />
            {/* Not on narrow screens, where the board is under the top bar */}
            {wide && (
              <>
                <h3 className="tierbinder-heading">Card Tray</h3>
                <label className="flex gap-3 items-center">
                  <input
                    type="checkbox"
                    checked={graphic.tray.enabled}
                    onChange={(e) =>
                      setGraphic((g) => ({ ...g, tray: { ...g.tray, enabled: e.target.checked } }))
                    }
                  />
                  Show card tray under the board
                </label>
                {graphic.tray.enabled && (
                  <div className="tierbinder-prop">
                    Tray color
                    <ColorField
                      label="Card tray color"
                      value={graphic.tray.color}
                      onChange={(color) =>
                        setGraphic((g) => ({ ...g, tray: { ...g.tray, color } }))
                      }
                    />
                  </div>
                )}
              </>
            )}
            {/* Confirmed on the page: some browsers (the in-app one) never show confirm().
              16px above it, as between sections, so it doesn't read as part of the last one */}
            {confirmingClear ? (
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                {trayShown && graphic.tray.items.length
                  ? 'Clear the board and card tray?'
                  : 'Clear the board?'}
                <Button onClick={() => showBoard(doc.kind, true)}>Yes</Button>
                <Button onClick={() => setConfirmingClear(false)}>Cancel</Button>
              </div>
            ) : (
              <Button className="mt-3 self-start" onClick={() => setConfirmingClear(true)}>
                Clear board
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
              <label className="flex gap-3 items-center">
                <input
                  type="checkbox"
                  checked={includeTray}
                  onChange={(e) => setIncludeTray(e.target.checked)}
                />
                Include card tray in export
              </label>
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
        className={`${styles.canvas} flex-1 min-w-0 b8:overflow-y-auto p-4 flex flex-col`}
        inert={viewing !== null}
      >
        <div ref={boardRef} className="flex flex-col gap-4" style={{ width: BOARD_WIDTH * scale }}>
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
                  // Ignores presses while drawing (pen, eraser), as the board does
                  listening={tool === DEFAULT_TOOL}
                />
              )}
              {/* Editor-only layer: hidden while exporting */}
              <Layer name="editor" listening={false}>
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
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {type.Toolbar && (
            <type.Toolbar graphic={graphic} onChange={setGraphic} tool={tool} onTool={setTool} />
          )}

          {status && <p className="whitespace-pre-line">{status}</p>}
        </div>
      </div>

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
  );
}
