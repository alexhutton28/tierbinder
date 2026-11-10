// The fallback card source, read from limitlesstcg.com pages (it has no public card
// API), for cards TCGdex has no image for (see cardSource.ts). Card image numbers
// aren't predictable (MEG pads to three digits, TWM doesn't), so image URLs always
// come from Limitless's own pages. Search results have no names.

import type { SearchOptions } from '../searchOptions';

export type CardResult = {
  set: string;
  number: string;
  image: string;
  thumb: string;
  name?: string;
};

const SITE = 'https://limitlesstcg.com';
const IMAGE_HOST = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/';
const CARD_PATH = /^\/cards\/([A-Z0-9-]+)\/([0-9A-Za-z-]+)\/?$/;

// Limitless serves _SM thumbnails in lists and _LG (460x640) on card pages
function sizes(url: string) {
  return { image: url.replace(/_SM\.png$/, '_LG.png'), thumb: url.replace(/_LG\.png$/, '_SM.png') };
}

async function getPage(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TierBinder' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return { html: await res.text(), url: new URL(res.url) };
}

function cardFromPage(html: string, set: string, number: string): CardResult | null {
  const escaped = IMAGE_HOST.replace(/[.]/g, '\\.');
  const match = html.match(new RegExp(`${escaped}tpci/[^"' ]+_LG\\.png`));
  return match ? { set, number, ...sizes(match[0]) } : null;
}

export async function lookupCard(set: string, number: string) {
  const page = await getPage(`${SITE}/cards/${set.toUpperCase()}/${number}`);
  if (!page) return null;
  const name = page.html.match(/<title>([^<]*?) - /)?.[1]?.trim();
  const card = cardFromPage(page.html, set.toUpperCase(), number);
  return card && { ...card, name: name ? decodeEntities(name) : undefined };
}

// Limitless's own search terms for the filters and sort orders
// (limitlesstcg.com/cards/syntax). Its default order is newest set first.
function searchTerms(options: SearchOptions) {
  return [
    options.type !== 'all' && `t:${options.type}`,
    options.format !== 'all' && `f:${options.format}`,
    options.sort !== 'newest' && `o:${options.sort}`,
    options.newestOnly && 'u:cards',
  ].filter(Boolean);
}

export async function searchCards(query: string, options: SearchOptions): Promise<CardResult[]> {
  const q = [query, ...searchTerms(options)].join(' ');
  // show=all: every match on one page (otherwise 50 per page), same order
  const page = await getPage(`${SITE}/cards?q=${encodeURIComponent(q)}&show=all`);
  if (!page) return [];

  // A search with exactly one match redirects to that card's page
  const single = page.url.pathname.match(CARD_PATH);
  if (single) {
    const card = cardFromPage(page.html, single[1], single[2]);
    return card ? [card] : [];
  }

  const results: CardResult[] = [];
  const grid = /<a href="\/cards\/([A-Z0-9-]+)\/([0-9A-Za-z-]+)"><img[^>]*?src="([^"]+_SM\.png)"/g;
  for (const [, set, number, src] of page.html.matchAll(grid)) {
    if (src.startsWith(IMAGE_HOST)) results.push({ set, number, ...sizes(src) });
  }
  return results;
}

function decodeEntities(text: string) {
  return text
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}
