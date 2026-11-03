'use client';

import type Konva from 'konva';
import React from 'react';
import Board from './Board';
import ColorField from './ColorField';
import { fetchCard, loadImage, mapLimit, proxied, searchCards, type CardResult } from './cards';
import { parseImport, type ImportCard, type ImportLine } from './importText';
import {
  BOARD_WIDTH,
  CARD_HEIGHT,
  CARD_WIDTH,
  EXPORT_SCALE,
  MAX_CARDS_PER_TIER,
  defaultDoc,
  dropTarget,
  faceOf,
  insertCard,
  layoutCards,
  newId,
  parseDoc,
  type CardFace,
  type CardItem,
  type TierListDoc,
} from './tierList';

// The tier list editor: the board plus a plain control panel. Kept deliberately
// unstyled; it's a tool for making images, not a page people visit.

const STORAGE_KEY = 'tcg-tier-stack-doc';

function loadSaved() {
  try {
    return parseDoc(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? defaultDoc();
  } catch {
    return defaultDoc();
  }
}

async function resolveFace(card: ImportCard): Promise<CardFace | null> {
  if (card.set && card.number) {
    const found = await fetchCard(card.set, card.number);
    if (found) return toFace(found, found.name ?? card.name);
  }
  const pick = defaultPrint(await searchCards(card.name));
  return pick ? toFace(pick, card.name) : null;
}

// A split card needs both halves found
async function resolveCard(line: ImportLine): Promise<CardItem | null> {
  const [top, bottom] = await Promise.all([
    resolveFace(line),
    line.split ? resolveFace(line.split) : null,
  ]);
  if (!top || (line.split && !bottom)) return null;
  return { id: newId(), kind: 'card', ...top, ...(bottom ? { split: bottom } : {}) };
}

// Special sets of reprints, listed before regular sets in Limitless search results
const SPECIAL_SETS = new Set(['30C', 'CEL']);

// Search results come newest set first. Within a set, alt arts are numbered after the
// regular card, so the lowest number in the newest set is its usual print. Special
// sets and subset numbers (CC21, TG05, SV103) are skipped while a regular print exists.
function defaultPrint(all: CardResult[]) {
  const regular = all.filter((r) => !SPECIAL_SETS.has(r.set) && /^\d+$/.test(r.number));
  const results = regular.length ? regular : all;
  const newest = results.filter((r) => r.set === results[0]?.set);
  const number = (r: CardResult) => parseInt(r.number, 10) || Infinity;
  return newest.sort((a, b) => number(a) - number(b))[0];
}

function toFace(card: CardResult, name: string): CardFace {
  return { name, set: card.set, number: card.number, image: card.image };
}

function toItem(card: CardResult, name: string): CardItem {
  return { id: newId(), kind: 'card', ...toFace(card, name) };
}

const button = 'border border-black px-[8px] py-[2px] bg-white disabled:opacity-50';

export default function TierStack() {
  const [doc, setDoc] = React.useState<TierListDoc>(loadSaved);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);
  const [fontFamily, setFontFamily] = React.useState('sans-serif');
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<CardResult[]>([]);
  const [targetTier, setTargetTier] = React.useState(0);
  const [confirmingNew, setConfirmingNew] = React.useState(false);
  // Menu for a clicked card, or for a search result dropped on a card (`dropped`: the
  // result, and where it goes if added to the tier), positioned in the board's on-screen
  // pixels
  const [cardMenu, setCardMenu] = React.useState<{
    id: string;
    x: number;
    y: number;
    dropped?: { card: CardResult; tierIndex: number; index: number };
  } | null>(null);
  const cardMenuRef = React.useRef<HTMLDivElement>(null);
  // Card face being picked from search: the next result clicked replaces the card (or a
  // split card's top half), or becomes its bottom half, making it a split card
  const [picking, setPicking] = React.useState<{ id: string; part: 'top' | 'bottom' } | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const stageRef = React.useRef<Konva.Stage | null>(null);
  const boardBoxRef = React.useRef<HTMLDivElement>(null);
  const tierNameRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const tiersPanelRef = React.useRef<HTMLDetailsElement>(null);
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

  const removeCard = React.useCallback((id: string) => {
    setDoc((d) => ({
      ...d,
      tiers: d.tiers.map((t) => ({ ...t, items: t.items.filter((i) => i.id !== id) })),
    }));
    setSelectedId((selected) => (selected === id ? null : selected));
  }, []);

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

  const updateTier = (index: number, change: Partial<TierListDoc['tiers'][number]>) =>
    setDoc((d) => ({
      ...d,
      tiers: d.tiers.map((t, i) => (i === index ? { ...t, ...change } : t)),
    }));

  async function runImport() {
    const { tiers, errors } = parseImport(importText);
    setBusy(true);
    setStatus('Importing…');
    const lines = tiers.flatMap((t) => t.cards);
    const resolved = await mapLimit(lines, 4, resolveCard);
    const found = new Map(lines.map((line, i) => [line, resolved[i]]));
    for (const line of lines) {
      if (!found.get(line)) {
        const name = line.split ? `${line.name} / ${line.split.name}` : line.name;
        errors.push(`Line ${line.line}: couldn't find "${name}".`);
      }
    }
    // Imported cards go after the ones already in each tier. Pure, so it can run on the
    // latest board (it may have changed while cards were looking up)
    const addImported = (d: TierListDoc) => {
      const overflow: string[] = [];
      const next = {
        ...d,
        tiers: d.tiers.map((tier, i) => {
          const imported = tiers[i];
          const items = [
            ...tier.items,
            ...(imported?.cards ?? []).flatMap((line) => found.get(line) ?? []),
          ];
          const name = imported?.name ?? tier.name;
          if (items.length > MAX_CARDS_PER_TIER) {
            overflow.push(
              `${name}: ${items.length - MAX_CARDS_PER_TIER} cards didn't fit (${MAX_CARDS_PER_TIER} per tier).`
            );
          }
          return { ...tier, name, items: items.slice(0, MAX_CARDS_PER_TIER) };
        }),
      };
      return { next, overflow };
    };
    setDoc((d) => addImported(d).next);
    setBusy(false);
    errors.push(...addImported(doc).overflow);
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

  const findCard = (id: string | undefined) =>
    doc.tiers.flatMap((t) => t.items).find((i) => i.id === id);

  const updateCard = (id: string, change: (item: CardItem) => CardItem) =>
    setDoc((d) => ({
      ...d,
      tiers: d.tiers.map((t) => ({
        ...t,
        items: t.items.map((i) => (i.id === id ? change(i) : i)),
      })),
    }));

  // Puts the search in picking mode for a card's top or bottom face. Replacing searches
  // that face's name (its other prints); a new split card starts with an empty search.
  function startPicking(id: string, part: 'top' | 'bottom') {
    const item = findCard(id);
    if (!item) return;
    const name = part === 'top' ? item.name : (item.split?.name ?? '');
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

  // The card menu's items: for a clicked card, or for a search result dropped on it
  const cardMenuItems = ({ id, dropped }: CardMenu) => {
    const split = findCard(id)?.split;
    if (dropped) {
      return split
        ? (['Replace top half', 'Replace bottom half', 'Add to tier'] as const)
        : (['Add as split card', 'Add to tier'] as const);
    }
    return split
      ? ([
          'Remove card',
          'Replace top half',
          'Replace bottom half',
          'Swap halves',
          'Unsplit',
        ] as const)
      : (['Remove card', 'Replace card', 'Make split card'] as const);
  };

  function runCardMenuItem(
    { id, dropped }: CardMenu,
    label: ReturnType<typeof cardMenuItems>[number]
  ) {
    // A dropped result replaces a half, becomes the bottom half, or is added to the tier
    if (dropped) {
      const face = resultFace(dropped.card);
      if (label === 'Replace top half') updateCard(id, (i) => ({ ...i, ...face }));
      if (label === 'Replace bottom half' || label === 'Add as split card') {
        updateCard(id, (i) => ({ ...i, split: face }));
      }
      if (label === 'Add to tier') addResult(dropped.card, dropped.tierIndex, dropped.index);
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

  function addResult(card: CardResult, tierIndex: number, index: number) {
    const next = insertCard(doc, toItem(card, query.trim()), tierIndex, index);
    if (!next) {
      setStatus(`That tier is full (${MAX_CARDS_PER_TIER} cards).`);
      return;
    }
    setDoc(next);
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
    if (doc.tiers[targetTier].items.length >= MAX_CARDS_PER_TIER) {
      setStatus(`That tier is full (${MAX_CARDS_PER_TIER} cards).`);
      return;
    }
    const item = toItem(card, query.trim());
    updateTier(targetTier, { items: [...doc.tiers[targetTier].items, item] });
  }

  // A search result dropped on the board lands in the tier and position under the
  // pointer. Dropped on a card, it opens the card menu to choose between making a split
  // card and adding it to the tier.
  const dropResult = React.useEffectEvent((card: CardResult, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.container().getBoundingClientRect();
    if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) {
      return;
    }
    const x = (clientX - box.left) / scale;
    const y = (clientY - box.top) / scale;
    const target = dropTarget(doc, '', x, y);
    // Later cards overlap earlier ones, so the last card under the pointer is the top one
    const under = layoutCards(doc).findLast(
      (p) => x >= p.x && x <= p.x + CARD_WIDTH && y >= p.y && y <= p.y + CARD_HEIGHT
    );
    if (under) {
      setSelectedId(under.item.id);
      setCardMenu({
        id: under.item.id,
        x: clientX - box.left,
        y: clientY - box.top,
        dropped: { card, ...target },
      });
      return;
    }
    addResult(card, target.tierIndex, target.index);
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
      doc.tiers.flatMap((t) =>
        t.items.flatMap((i) => [i.image, ...(i.split ? [i.split.image] : [])]).map(loadImage)
      )
    );
    await document.fonts.ready;
    // Let React draw the cards whose images just finished loading
    await new Promise((resolve) => setTimeout(resolve, 100));
    const editor = stage.findOne('.editor');
    editor?.hide();
    try {
      return (await stage.toBlob({ pixelRatio: EXPORT_SCALE / scale })) as Blob;
    } finally {
      editor?.show();
    }
  }

  async function exportPng() {
    const blob = await renderBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tier-list.png';
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
    <div className="tier-stack-page w-full max-w-[1240px] p-[20px] flex flex-col gap-[16px] text-[14px] text-black">
      <div ref={boardBoxRef} className="w-full relative">
        <Board
          doc={doc}
          scale={scale}
          fontFamily={fontFamily}
          selectedId={selectedId}
          onChange={setDoc}
          onSelect={setSelectedId}
          onCardMenu={(id, x, y) => setCardMenu({ id, x, y })}
          onEditTier={(i) => {
            if (tiersPanelRef.current) tiersPanelRef.current.open = true;
            tierNameRefs.current[i]?.focus();
          }}
          onPickTier={setTargetTier}
          onStage={(stage) => {
            stageRef.current = stage;
          }}
        />
        {cardMenu && doc.tiers.some((t) => t.items.some((i) => i.id === cardMenu.id)) && (
          <div
            ref={cardMenuRef}
            role="menu"
            onContextMenu={(e) => e.preventDefault()}
            className="absolute z-10 flex flex-col min-w-[160px] border border-black bg-white shadow-md"
            // Kept inside the board's right edge
            style={{
              left: Math.min(cardMenu.x, BOARD_WIDTH * scale - 160),
              top: cardMenu.y,
            }}
          >
            {cardMenuItems(cardMenu).map((label) => (
              <button
                key={label}
                role="menuitem"
                className="px-[8px] py-[4px] text-left hover:bg-black/10"
                onClick={() => {
                  runCardMenuItem(cardMenu, label);
                  setCardMenu(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-[8px] items-center">
        <button className={button} onClick={exportPng} disabled={busy}>
          Export PNG ({BOARD_WIDTH * EXPORT_SCALE}px)
        </button>
        <button className={button} onClick={copyPng} disabled={busy}>
          Copy PNG
        </button>
        <button className={button} onClick={removeSelected} disabled={!selectedId}>
          Remove selected card
        </button>
        {/* Confirmed on the page: some browsers (the in-app one) never show confirm() */}
        {confirmingNew ? (
          <span className="flex items-center gap-[8px]">
            Clear the board?
            <button
              className={button}
              onClick={() => {
                setDoc(defaultDoc());
                setSelectedId(null);
                setConfirmingNew(false);
              }}
            >
              Yes
            </button>
            <button className={button} onClick={() => setConfirmingNew(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button className={button} onClick={() => setConfirmingNew(true)}>
            New board
          </button>
        )}
      </div>

      {status && <p className="whitespace-pre-line">{status}</p>}

      <div className="grid gap-[16px] md:grid-cols-3">
        {/* min-w-0 so the results scroll instead of widening the column */}
        <section className="flex flex-col gap-[8px] min-w-0">
          <h2 className="font-bold">Add a card</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
            className="flex gap-[8px]"
          >
            <input
              ref={searchInputRef}
              className="border border-black px-[4px] flex-1"
              placeholder="Card name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className={button} disabled={busy}>
              Search
            </button>
          </form>
          {picking && pickingCard ? (
            <p className="flex gap-[8px] items-center">
              {picking.part === 'top'
                ? pickingCard.split
                  ? `Replacing the top half (${pickingCard.name})`
                  : `Replacing ${pickingCard.name}`
                : pickingCard.split
                  ? `Replacing the bottom half (${pickingCard.split.name})`
                  : `Splitting ${pickingCard.name}: pick the bottom card`}
              <button className={button} onClick={() => setPicking(null)}>
                Cancel
              </button>
            </p>
          ) : (
            <label className="flex gap-[8px] items-center">
              Add to
              <select
                className="border border-black"
                value={targetTier}
                onChange={(e) => setTargetTier(Number(e.target.value))}
              >
                {doc.tiers.map((t, i) => (
                  <option key={t.id} value={i}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Fixed-size tiles (80x111 card + 14px caption), as many per row as fit; the
              box is 3 rows tall (3 x 125 + 2 x 4) and scrolls down */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] auto-rows-[125px] gap-[4px] max-h-[383px] overflow-y-auto overflow-x-hidden empty:hidden">
            {results.map((card) => (
              <div
                key={`${card.set}-${card.number}`}
                role="button"
                tabIndex={0}
                title={`${card.set} ${card.number}`}
                className="cursor-grab select-none flex flex-col items-center text-[11px] leading-[14px]"
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

        {/* Collapsed by default; the content is wrapped since <details> doesn't lay out as flex everywhere */}
        <details ref={tiersPanelRef}>
          <summary className="font-bold cursor-pointer">Customize Board</summary>
          <div className="flex flex-col gap-[8px] mt-[8px]">
            <h3 className="font-bold">Tiers</h3>
            {doc.tiers.map((tier, i) => (
              <div key={tier.id} className="flex gap-[8px] items-center">
                <ColorField
                  label={`${tier.name} color`}
                  value={tier.color}
                  onChange={(color) => updateTier(i, { color })}
                />
                {/* One line, so line breaks are typed as \n (as in bulk import) */}
                <input
                  ref={(el) => {
                    tierNameRefs.current[i] = el;
                  }}
                  aria-label={`Tier ${i + 1} name`}
                  className="border border-black px-[4px] flex-1"
                  value={tier.name.replaceAll('\n', '\\n')}
                  onChange={(e) => updateTier(i, { name: e.target.value.replaceAll('\\n', '\n') })}
                />
              </div>
            ))}
            <label className="flex gap-[8px] items-center">
              <input
                type="checkbox"
                checked={doc.tierCardBorders}
                onChange={(e) => setDoc((d) => ({ ...d, tierCardBorders: e.target.checked }))}
              />
              Add tier colored border to cards
            </label>
            <h3 className="font-bold">Background</h3>
            <ColorField
              label="Background color"
              value={doc.background}
              onChange={(background) => setDoc((d) => ({ ...d, background }))}
            />
            <h3 className="font-bold">Border</h3>
            <ColorField
              label="Border color"
              value={doc.border}
              onChange={(border) => setDoc((d) => ({ ...d, border }))}
            />
          </div>
        </details>

        <details>
          <summary className="font-bold cursor-pointer">Bulk import</summary>
          <div className="flex flex-col gap-[8px] mt-[8px]">
            <textarea
              rows={10}
              className="border border-black px-[4px] font-mono text-[12px]"
              placeholder={'# Goated\nMew ex MEW 151\nAlakazam\n# Solid\nDragapult ex TWM 130'}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <button className={button} onClick={runImport} disabled={busy || !importText.trim()}>
              Import (adds to the board)
            </button>
          </div>
        </details>
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
