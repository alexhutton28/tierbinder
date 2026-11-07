'use client';

import type Konva from 'konva';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { flushSync } from 'react-dom';
import { Layer, Rect, Stage } from 'react-konva';
import { BOARD_HEIGHT, BOARD_WIDTH, EXPORT_SCALE } from './canvas/size';
import {
  faceOf,
  loadImage,
  mapLimit,
  proxied,
  resolveCard,
  searchCards,
  toFace,
  toItem,
  type CardItem,
  type CardResult,
} from './cards';
import { currentGraphic, newDoc, parseSaved, type TierBinderDoc } from './document';
import { GRAPHIC_TYPES, typeOf, type Graphic, type GraphicKind } from './graphics';
import { DEFAULT_TOOL, type Placed, type Point } from './graphics/types';
import { parseImport } from './importText';
import Button from './ui/Button';
import Dropdown from './ui/Dropdown';
import RadioBar from './ui/RadioBar';

// The editor: the board, drawn by the document's graphic type (see graphics/types.ts), plus
// the top bar and sidebar shared by every graphic.

const STORAGE_KEY = 'tierbinder-doc';

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
  const [results, setResults] = React.useState<CardResult[]>([]);
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
  const targets = type.targets(graphic);
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

  // Board scales down to fit narrow windows; exports are always full size
  React.useEffect(() => {
    const fit = () => {
      const width = boardBoxRef.current?.clientWidth ?? BOARD_WIDTH;
      setScale(Math.min(1, width / BOARD_WIDTH));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
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

  async function search(text: string) {
    // A blank search clears the results
    if (!text.trim()) {
      setResults([]);
      setStatus('');
      return;
    }
    setBusy(true);
    const found = await searchCards(text.trim());
    setResults(found);
    setStatus(found.length ? '' : 'No cards found.');
    setBusy(false);
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

  // A search result as one half of a card, named after the search
  const resultFace = (card: CardResult) =>
    toFace(card, query.trim() || `${card.set} ${card.number}`);

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
      ? ['Remove card', 'Replace top half', 'Replace bottom half', 'Swap halves', 'Unsplit']
      : ['Remove card', 'Replace card', 'Make split card'];
  };

  function runCardMenuItem({ id, dropped }: CardMenu, label: string) {
    // A dropped result replaces a half, becomes the bottom half, or is added where it was
    // dropped
    if (dropped) {
      const face = resultFace(dropped.card);
      if (label === 'Replace top half') updateCard(id, (i) => ({ ...i, ...face }));
      if (label === 'Replace bottom half' || label === 'Add as split card') {
        updateCard(id, (i) => ({ ...i, split: face }));
      }
      if (label === addToTarget) {
        applyPlaced(type.dropCard(graphic, toItem(dropped.card, query.trim()), dropped.point));
      }
      return;
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
      const face = resultFace(card);
      updateCard(picking.id, (i) =>
        picking.part === 'top' ? { ...i, ...face } : { ...i, split: face }
      );
      setPicking(null);
      return;
    }
    applyPlaced(type.addCard(graphic, toItem(card, query.trim()), targetIndex));
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
    applyPlaced(type.dropCard(graphic, toItem(card, query.trim()), point));
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
    // The board, with the sidebar on its left (below it on narrow screens). On wide
    // screens each scrolls on its own, so the search results stay beside the board.
    <div className="tierbinder-page w-full md:h-full flex flex-col text-body">
      <header className="tierbinder-top">
        <Link href="/" className="tierbinder-brand">
          <Image src="/tierbinder-combined-dark.svg" alt="TierBinder" width={114} height={25} />
        </Link>
      </header>
      <div className="flex-1 min-h-0 flex flex-col md:flex-row-reverse">
        <div className="tierbinder-canvas flex-1 min-w-0 md:overflow-y-auto p-4 flex flex-col">
          <div className="tierbinder-board flex flex-col gap-4">
            <div className="flex">
              <Dropdown
                hideLabel
                label="Board type"
                value={doc.kind}
                options={GRAPHIC_TYPES.map((t) => ({ value: t.kind, label: t.label }))}
                onChange={(kind) => {
                  if (kind !== doc.kind) showBoard(kind);
                }}
              />
            </div>
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
                        x={p.x - 3}
                        y={p.y - 3}
                        width={p.width + 6}
                        height={p.height + 6}
                        stroke="#ffffff"
                        strokeWidth={3}
                        cornerRadius={8}
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
                  className={`tierbinder-menu absolute z-10 tierbinder-popup flex flex-col min-w-[160px] ${menuClosing ? 'closing pointer-events-none' : ''}`}
                  // Kept inside the board's right edge
                  style={{
                    left: Math.min(shownMenu.x, BOARD_WIDTH * scale - 160),
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

        <aside className="tierbinder-side md:w-[352px] md:flex-none flex flex-col min-w-0 md:min-h-0">
          <div className="tierbinder-side-head">
            <RadioBar label="Editor sections" options={TABS} value={tab} onChange={setTab} />
          </div>

          {/* The panels stay mounted, so tabbing away keeps a search or import text. min-w-0
            so the results scroll instead of widening the sidebar; on wide screens they
            fill the sidebar's height */}
          <section
            role="tabpanel"
            hidden={tab !== 'add'}
            className="tierbinder-panel flex flex-col gap-3 min-w-0 md:flex-1 md:min-h-0"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search(query);
              }}
              className="flex gap-3"
            >
              <input
                ref={searchInputRef}
                className="tierbinder-field flex-1 min-w-0"
                // Card names aren't real words: don't let phones "fix" them
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Card name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button variant="primary" disabled={busy}>
                Search
              </Button>
            </form>
            {picking && pickingCard ? (
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
            ) : (
              // Only when there's a choice (a blank canvas has one place for cards)
              targets.length > 1 && (
                <Dropdown
                  label="Add to"
                  value={targetIndex}
                  options={targets.map((name, i) => ({
                    value: i,
                    label: name.replaceAll('\n', ' '),
                  }))}
                  onChange={setTarget}
                />
              )
            )}
            <Button className="self-start" onClick={() => setImporting((on) => !on)}>
              {importing ? 'Back to search' : 'Bulk import'}
            </Button>
            {importing && (
              <>
                <textarea
                  rows={10}
                  aria-label="Cards to import"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="tierbinder-field font-mono"
                  placeholder={'# Goated\nMew ex MEW 151\nAlakazam\n# Solid\nDragapult ex TWM 130'}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <Button variant="primary" onClick={runImport} disabled={busy || !importText.trim()}>
                  Import (adds to the board)
                </Button>
              </>
            )}
            {/* Fixed-size tiles (80x111 card + 16px caption), as many per row as fit; the
              box is 3 rows tall (3 x 127 + 2 x 4), or the rest of the sidebar on wide
              screens, and scrolls down */}
            <div
              hidden={importing}
              className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] auto-rows-[127px] gap-2 max-h-[389px] md:max-h-none md:flex-1 md:min-h-0 overflow-y-auto overflow-x-hidden empty:hidden"
            >
              {results.map((card) => (
                <div
                  key={`${card.set}-${card.number}`}
                  role="button"
                  tabIndex={0}
                  title={`${card.set} ${card.number}`}
                  className="cursor-grab select-none flex flex-col items-center text-caption text-(--tb-muted)"
                  // Mouse and pen only: on touch, a press-and-move scrolls the results
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch' || e.button !== 0) return;
                    e.preventDefault();
                    resultPress.current = { card, x: e.clientX, y: e.clientY, dragging: false };
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
                    className="w-[80px] h-[111px] object-contain"
                    loading="lazy"
                    draggable={false}
                    // The CDN occasionally fails a load; retry once through the image proxy
                    onError={(e) => {
                      const proxy = proxied(card.thumb);
                      if (!e.currentTarget.src.endsWith(proxy)) e.currentTarget.src = proxy;
                    }}
                  />
                  <span className="w-full truncate text-center">
                    {card.set} {card.number}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section
            role="tabpanel"
            hidden={tab !== 'customize'}
            className="tierbinder-panel flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-y-auto"
          >
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
            className="tierbinder-panel flex flex-col gap-3 md:flex-1 md:min-h-0"
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

      {dragGhost && (
        // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail, as in the results
        <img
          src={dragGhost.card.thumb}
          alt=""
          className="fixed z-20 w-[80px] h-[111px] object-contain pointer-events-none opacity-80"
          style={{ left: dragGhost.x - 40, top: dragGhost.y - 55 }}
        />
      )}
    </div>
  );
}
