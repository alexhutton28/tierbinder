// The fallback card source, read from limitlesstcg.com pages (it has no public card
// API), for cards TCGdex has no image for (see cardSource.ts). Card image numbers
// aren't predictable (MEG pads to three digits, TWM doesn't), so image URLs always
// come from Limitless's own pages. Lists (search results, sets) are read in its list
// view, which names each card.

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

// Limitless's images come in sizes: _XS (list view), _SM (thumbnails) and _LG (460x640,
// card pages)
function sizes(url: string) {
  return {
    image: url.replace(/_(XS|SM)\.png$/, '_LG.png'),
    thumb: url.replace(/_(XS|LG)\.png$/, '_SM.png'),
  };
}

async function getPage(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TierBinder' },
    next: { revalidate: 86400 },
  });
  if (res.status === 404) return null;
  // An outage or rate limit is an error, not "nothing there", so it isn't cached as no cards
  if (!res.ok) throw new Error(`Limitless ${url}: ${res.status}`);
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

// Every card whose name contains the query, newest set first
export async function searchCards(query: string): Promise<CardResult[]> {
  // show=all: every match on one page (otherwise 50 per page), same order
  const page = await getPage(`${SITE}/cards?q=${encodeURIComponent(query)}&show=all&display=list`);
  if (!page) return [];

  // A search with exactly one match redirects to that card's page
  const single = page.url.pathname.match(CARD_PATH);
  if (single) {
    const card = cardFromPage(page.html, single[1], single[2]);
    return card ? [card] : [];
  }

  return listCards(page.html);
}

// Every card in a set, in number order, from its set page
export async function setCards(code: string): Promise<CardResult[]> {
  const page = await getPage(`${SITE}/cards/${encodeURIComponent(code)}?display=list`);
  return page ? listCards(page.html) : [];
}

// The cards in a list view's table (search results, a set): each row has the card's
// image, then links to the card with its number and with its name. Rows whose images
// aren't on Limitless's CDN are skipped.
function listCards(html: string) {
  const results: CardResult[] = [];
  const row =
    /<tr data-hover="([^"]+_XS\.png)">[\s\S]*?<a href="\/cards\/([A-Z0-9-]+)\/([0-9A-Za-z-]+)">[^<]*<\/a>[\s\S]*?<a href="\/cards\/\2\/\3">([^<]*)<\/a>/g;
  for (const [, src, set, number, name] of html.matchAll(row)) {
    if (src.startsWith(IMAGE_HOST)) {
      results.push({ set, number, ...sizes(src), name: decodeEntities(name.trim()) });
    }
  }
  return results;
}

function decodeEntities(text: string) {
  return text
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}
