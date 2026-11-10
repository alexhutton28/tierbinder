'use client';

import type Konva from 'konva';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { flushSync } from 'react-dom';
import { Layer, Rect, Stage } from 'react-konva';
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
import { currentGraphic, newDoc, parseSaved, type TierBinderDoc } from './document';
import { GRAPHIC_TYPES, typeOf, type Graphic, type GraphicKind } from './graphics';
import { DEFAULT_TIERS } from './graphics/tier-list/model';
import { DEFAULT_TOOL, type Placed, type Point } from './graphics/types';
import { parseImport } from './importText';
import { DEFAULT_SEARCH, sortDirection as sortLabel, type SearchOptions } from './searchOptions';
import Button from './ui/Button';
import Dropdown from './ui/Dropdown';
import RadioBar from './ui/RadioBar';
import SearchFilters from './ui/SearchFilters';
import SidebarHandle from './ui/SidebarHandle';
import styles from './Editor.module.css';

// The editor: the board, drawn by the document's graphic type (see graphics/types.ts), plus
// the top bar and sidebar shared by every graphic.

const STORAGE_KEY = 'tierbinder-doc';

// The selection outline, drawn just outside the card (canvas values; see Exceptions in
// design/hutton-design-system.md)
const OUTLINE = { width: 3, radius: 8, color: '#ffffff' };

// The card menu's narrowest width; it opens left of the pointer when this wouldn't fit
// inside the board's right edge
const MENU_WIDTH = 160;

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
// Image URLs are copied from the cards' Limitless pages (their numbers aren't predictable).
type Pool = { name: string; cards: CardResult[] };
// Placeholders shown while a search is under way: about three rows at most widths
const SKELETON_TILES = 18;

const FEATURED_POOLS: Pool[] = [
  {
    name: 'Best Decks of All Time',
    cards: [
      {
        set: 'SLG',
        number: '53',
        name: 'Zoroark-GX',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SLG/SLG_053_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SLG/SLG_053_R_EN_SM.png',
      },
      {
        set: 'SVI',
        number: '86',
        name: 'Gardevoir ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVI/SVI_086_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVI/SVI_086_R_EN_SM.png',
      },
      {
        set: 'CEC',
        number: '156',
        name: 'Arceus & Dialga & Palkia-GX',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/CEC/CEC_156_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/CEC/CEC_156_R_EN_SM.png',
      },
      {
        set: 'FST',
        number: '114',
        name: 'Mew VMAX',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/FST/FST_114_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/FST/FST_114_R_EN_SM.png',
      },
      {
        set: 'SIT',
        number: '139',
        name: 'Lugia VSTAR',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SIT/SIT_139_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SIT/SIT_139_R_EN_SM.png',
      },
      {
        set: 'TWM',
        number: '130',
        name: 'Dragapult ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/TWM/TWM_130_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/TWM/TWM_130_R_EN_SM.png',
      },
    ],
  },
  {
    name: 'Delta Reign',
    cards: [
      {
        set: 'DLR',
        number: '84',
        name: 'Mega Rayquaza ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_084_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_084_R_EN_SM.png',
      },
      {
        set: 'DLR',
        number: '88',
        name: 'Talonflame ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_088_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_088_R_EN_SM.png',
      },
      {
        set: 'DLR',
        number: '11',
        name: 'Mega Golisopod ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_011_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_011_R_EN_SM.png',
      },
      {
        set: 'DLR',
        number: '69',
        name: 'Mega Malamar ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_069_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_069_R_EN_SM.png',
      },
      {
        set: 'DLR',
        number: '47',
        name: 'Mega Golurk ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_047_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_047_R_EN_SM.png',
      },
      {
        set: 'DLR',
        number: '33',
        name: 'Raikou ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_033_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/DLR/DLR_033_R_EN_SM.png',
      },
    ],
  },
  {
    name: 'Mega Evolution Cards',
    cards: [
      {
        set: 'MEG',
        number: '104',
        name: 'Mega Kangaskhan ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEG/MEG_104_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEG/MEG_104_R_EN_SM.png',
      },
      {
        set: 'PFL',
        number: '13',
        name: 'Mega Charizard X ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/PFL/PFL_013_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/PFL/PFL_013_R_EN_SM.png',
      },
      {
        set: 'MEG',
        number: '77',
        name: 'Mega Lucario ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEG/MEG_077_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEG/MEG_077_R_EN_SM.png',
      },
      {
        set: 'MEG',
        number: '86',
        name: 'Mega Absol ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEG/MEG_086_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEG/MEG_086_R_EN_SM.png',
      },
      {
        set: 'PBL',
        number: '65',
        name: 'Mega Excadrill ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/PBL/PBL_065_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/PBL/PBL_065_R_EN_SM.png',
      },
      {
        set: 'CRI',
        number: '22',
        name: 'Mega Greninja ex',
        image: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/CRI/CRI_022_R_EN_LG.png',
        thumb: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/CRI/CRI_022_R_EN_SM.png',
      },
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
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [query, setQuery] = React.useState('');
  // The search the results are for, rerun when the filters or sort order change
  const [searched, setSearched] = React.useState('');
  const [searchOptions, setSearchOptions] = React.useState<SearchOptions>(DEFAULT_SEARCH);
  // Each search's number, so a slower earlier one can't replace a later one's results
  const searchCount = React.useRef(0);
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
  // The last search found nothing: what it was for, shown under the search
  const [noResults, setNoResults] = React.useState<{ query: string; sets: string[] } | null>(null);
  // A search is under way: its results show as shimmering placeholders until it's back
  const [searching, setSearching] = React.useState(false);
  const showingSkeleton = searching && !importing;
  const showingResults = results.length > 0 && !importing && !searching;
  // Results, placeholders or the no-results message, which hide the pools and Advanced
  const searchShown = !importing && (results.length > 0 || noResults !== null || searching);
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
    const timer = setTimeout(() => setShownMenu(null), 220);
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
    outlineRef.current?.position({ x: card.x() - 3, y: card.y() - 3 });
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

  const placements = type.layout(graphic);

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
    const timer = setTimeout(() => setShownView(null), 220);
    return () => clearTimeout(timer);
  }, [viewClosing]);
  React.useEffect(() => {
    if (!viewing) return;
    const close = () => setViewing(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Kept from the page's own Escape handling
      e.stopImmediatePropagation();
      close();
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
  }, [viewedPlace, viewClosing, scale]);
  const targets = type.targets(graphic);
  // The set filter's ticks: the board's tier colors, or a new tier list's on a board
  // without them
  const targetColors = targets.flatMap((t) => (t.color ? [t.color] : []));
  const tickColors = targetColors.length ? targetColors : DEFAULT_TIERS.map(([, color]) => color);
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
    setDoc((d) => ({
      ...d,
      kind,
      graphics:
        clear || !d.graphics[kind] ? { ...d.graphics, [kind]: typeOf(kind).create() } : d.graphics,
    }));
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
    const b8 = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-b8');
    const wide = matchMedia(`(width >= ${b8.trim()})`);
    const fit = () => {
      const style = getComputedStyle(workspace);
      const width =
        workspace.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      let next = width / BOARD_WIDTH;
      if (wide.matches) {
        const height =
          workspace.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const around = board.offsetHeight - box.offsetHeight;
        next = Math.min(next, (height - around) / BOARD_HEIGHT);
      }
      // Rounded down, so a fractional pixel never overflows the workspace into a scrollbar
      setScale(Math.max(0, Math.floor(next * 1000) / 1000));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(workspace);
    observer.observe(board);
    wide.addEventListener('change', fit);
    return () => {
      observer.disconnect();
      wide.removeEventListener('change', fit);
    };
  }, []);

  // Canvas text needs the font loaded first; next/font gives it a generated family name,
  // set on this route's layout
  React.useEffect(() => {
    const box = boardBoxRef.current;
    const family = box && getComputedStyle(box).getPropertyValue('--font-inter').trim();
    if (!family) return;
    document.fonts.load(`900 30px ${family}`).then(() => setFontFamily(family));
  }, []);

  const removeCard = React.useCallback(
    (id: string) => {
      setGraphic((g) => typeOf(g.kind).mapCards(g, (i) => (i.id === id ? null : i)));
      setSelectedId((selected) => (selected === id ? null : selected));
    },
    [setGraphic]
  );

  const removeSelected = React.useCallback(() => {
    if (!selectedId) return;
    removeCard(selectedId);
  }, [selectedId, removeCard]);

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

  function clearSearch() {
    searchCount.current++;
    setSearched('');
    setResults([]);
    setNoResults(null);
    setStatus('');
    setBusy(false);
    setSearching(false);
  }

  // A blank search lists the filter's sets whole, or clears the results if there are none
  async function search(text: string, options = searchOptions) {
    if (!text.trim() && !options.sets.length) {
      clearSearch();
      return;
    }
    const count = ++searchCount.current;
    setSearched(text.trim());
    setBusy(true);
    setSearching(true);
    const found = await searchCards(text.trim(), options).finally(() => {
      if (count === searchCount.current) {
        setBusy(false);
        setSearching(false);
      }
    });
    if (count !== searchCount.current) return;
    setResults(found);
    setNoResults(found.length ? null : { query: text.trim(), sets: options.sets });
  }

  // New filters or a new sort order apply to the next search, and rerun the current one
  // (with no search, ticking sets lists them)
  function changeSearchOptions(options: SearchOptions) {
    setSearchOptions(options);
    search(searched, options);
  }

  const findCard = (id: string | undefined) => placements.find((p) => p.item.id === id)?.item;

  const updateCard = (id: string, change: (item: CardItem) => CardItem) =>
    setGraphic((g) => typeOf(g.kind).mapCards(g, (i) => (i.id === id ? change(i) : i)));

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
    });
    setPicking({ id, part });
    setQuery(name);
    setResults([]);
    searchInputRef.current?.scrollIntoView({ block: 'center' });
    searchInputRef.current?.focus();
    search(name);
  }

  const pickingCard = findCard(picking?.id);

  type CardMenu = NonNullable<typeof cardMenu>;
  const addToTarget = `Add to ${type.targetNoun}`;

  // The card menu's items: for a clicked card, or for a search result dropped on it
  const cardMenuItems = ({ id, dropped }: CardMenu) => {
    const split = findCard(id)?.split;
    if (dropped) {
      return split
        ? ['Replace top half', 'Replace bottom half', addToTarget]
        : ['Add as split card', addToTarget];
    }
    return split
      ? ['View', 'Remove card', 'Replace top half', 'Replace bottom half', 'Swap halves', 'Unsplit']
      : ['View', 'Remove card', 'Replace card', 'Make split card'];
  };

  function runCardMenuItem({ id, dropped }: CardMenu, label: string) {
    // A dropped result replaces a half, becomes the bottom half, or is added where it was
    // dropped
    if (dropped) {
      const face = toFace(dropped.card);
      if (label === 'Replace top half') updateCard(id, (i) => ({ ...i, ...face }));
      if (label === 'Replace bottom half' || label === 'Add as split card') {
        updateCard(id, (i) => ({ ...i, split: face }));
      }
      if (label === addToTarget) {
        applyPlaced(type.dropCard(graphic, toItem(dropped.card), dropped.point));
      }
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
    applyPlaced(type.addCard(graphic, toItem(card), targetIndex));
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
    applyPlaced(type.dropCard(graphic, toItem(card), point));
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
      placements
        .flatMap(({ item }) => [item.image, ...(item.split ? [item.split.image] : [])])
        .map(loadImage)
    );
    await document.fonts.ready;
    // Let React draw the cards whose images just finished loading
    await new Promise((resolve) => setTimeout(resolve, 100));
    // The editor's own layer, and any a graphic adds (e.g. the eraser's circle)
    const editorOnly = stage.find('.editor');
    editorOnly.forEach((node) => node.hide());
    try {
      return (await stage.toBlob({ pixelRatio: EXPORT_SCALE / scale })) as Blob;
    } finally {
      editorOnly.forEach((node) => node.show());
    }
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
      <div ref={sideColumnRef} className={styles.sideColumn}>
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
                <Button variant="primary" disabled={busy}>
                  Search
                </Button>
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
              {(showingResults || showingSkeleton) && (
                <div className={`${styles.resultsBox} b8:flex-1 b8:min-h-0`}>
                  <div
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
                      : shownResults.map((card) => (
                          <div
                            key={`${card.set}-${card.number}`}
                            role="button"
                            tabIndex={0}
                            title={`${card.set} ${card.number}`}
                            className="cursor-grab select-none flex flex-col items-center"
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
                              alt={`${card.set} ${card.number}`}
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
                      {pool.cards.length
                        ? pool.cards.slice(0, POOL_PREVIEW_CARDS).map((card) => (
                            // eslint-disable-next-line @next/next/no-img-element -- remote thumbnails, as in the results
                            <img
                              key={`${card.set}-${card.number}`}
                              src={card.thumb}
                              alt={`${card.name} (${card.set} ${card.number})`}
                              title={`${card.name} (${card.set} ${card.number})`}
                              className={styles.poolCard}
                              loading="lazy"
                              draggable={false}
                              // The CDN occasionally fails a load; retry once through the proxy
                              onError={(e) => {
                                const proxy = proxied(card.thumb);
                                if (!e.currentTarget.src.endsWith(proxy))
                                  e.currentTarget.src = proxy;
                              }}
                            />
                          ))
                        : Array.from({ length: POOL_PREVIEW_CARDS }, (_, i) => (
                            <span key={i} className={styles.poolCard} aria-hidden />
                          ))}
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
            {/* Confirmed on the page: some browsers (the in-app one) never show confirm() */}
            {confirmingClear ? (
              <div className="flex flex-wrap gap-3 items-center">
                Clear the board?
                <Button onClick={() => showBoard(doc.kind, true)}>Yes</Button>
                <Button onClick={() => setConfirmingClear(false)}>Cancel</Button>
              </div>
            ) : (
              <Button className="self-start" onClick={() => setConfirmingClear(true)}>
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
                {BOARD_WIDTH * EXPORT_SCALE} × {BOARD_HEIGHT * EXPORT_SCALE}
              </span>
            </div>
            <div className="tierbinder-prop">
              Format
              <span className="text-(--tb-text)">PNG</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={exportPng} disabled={busy}>
                Export PNG
              </Button>
              <Button onClick={copyPng} disabled={busy}>
                Copy PNG
              </Button>
            </div>
          </section>
        </aside>
      </div>

      <div
        ref={workspaceRef}
        className={`${styles.canvas} flex-1 min-w-0 b8:overflow-y-auto p-4 flex flex-col`}
      >
        <div ref={boardRef} className="flex flex-col gap-4" style={{ width: BOARD_WIDTH * scale }}>
          <div ref={boardBoxRef} className="w-full relative">
            <Stage
              ref={(stage) => {
                stageRef.current = stage;
              }}
              width={BOARD_WIDTH * scale}
              height={BOARD_HEIGHT * scale}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage() || e.target.name() === 'background') {
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
                onPickTarget={setTarget}
                onEditSetting={(key) => {
                  setTab('customize');
                  setSettingsFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }));
                }}
                tool={tool}
              />
              {/* Editor-only layer: hidden while exporting */}
              <Layer name="editor" listening={false}>
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
                  top: shownMenu.y,
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
          role="dialog"
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
