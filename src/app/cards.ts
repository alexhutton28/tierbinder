// Cards, shared by every graphic: the card types saved in documents, and the client side
// of card sourcing (lookups and search through our API routes, and image loading through
// the same-origin proxy so canvas export works).

import type { ImportCard, ImportLine } from './importText';
import { DEFAULT_SEARCH, toParams, type SearchOptions } from './searchOptions';

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

// Ids for cards and the other parts of a document
export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export type CardResult = {
  set: string;
  number: string;
  image: string;
  thumb: string;
  name: string;
};

export function toFace(card: CardResult): CardFace {
  return { name: card.name, set: card.set, number: card.number, image: card.image };
}

export function toItem(card: CardResult): CardItem {
  return { id: newId(), kind: 'card', ...toFace(card) };
}

async function resolveFace(card: ImportCard): Promise<CardFace | null> {
  if (card.set && card.number) {
    const found = await fetchCard(card.set, card.number);
    if (found) return toFace(found);
  }
  // A failed search reports the card as not found, as an empty one does
  const pick = defaultPrint(await searchCards(card.name).catch(() => []));
  return pick ? toFace(pick) : null;
}

// Looks up a bulk import line. A split card needs both halves found.
export async function resolveCard(line: ImportLine): Promise<CardItem | null> {
  const [top, bottom] = await Promise.all([
    resolveFace(line),
    line.split ? resolveFace(line.split) : null,
  ]);
  if (!top || (line.split && !bottom)) return null;
  return { id: newId(), kind: 'card', ...top, ...(bottom ? { split: bottom } : {}) };
}

// Special sets of reprints, released alongside regular sets
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

export async function fetchCard(set: string, number: string): Promise<CardResult | null> {
  const params = new URLSearchParams({ set, number });
  const res = await fetch(`/api/card?${params}`);
  return res.ok ? res.json() : null;
}

export async function searchCards(
  query: string,
  options: SearchOptions = DEFAULT_SEARCH,
  signal?: AbortSignal
): Promise<CardResult[]> {
  // The browser's own network errors ("Failed to fetch") aren't for people; a cancelled
  // search still throws its AbortError
  const res = await fetch(`/api/search?${toParams(query, options)}`, { signal }).catch((e) => {
    if (signal?.aborted) throw e;
    throw new Error("Couldn't Reach the Server");
  });
  // A failed search is an error, not "no cards": the route says what went wrong
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Search Failed');
  return (await res.json()).results;
}

export function proxied(url: string) {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

// One load per image URL for the whole session
const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string) {
  let image = images.get(url);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(url); // let a later render retry
        reject(new Error(`Image failed: ${url}`));
      };
      img.src = proxied(url);
    });
    images.set(url, image);
  }
  return image;
}

// Runs tasks a few at a time so a big import doesn't hit TCGdex all at once
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
