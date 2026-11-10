// Where card lookups and searches come from: TCGdex first, and limitlesstcg.com for
// the cards TCGdex lists but has no image for (the newest set for a while after
// release, some promo, energy and gallery sets), or for everything if TCGdex is down.
// Limitless is only asked when TCGdex comes up short. Both use the official set codes.
import { DEFAULT_SEARCH, type SearchOptions } from '../searchOptions';
import * as limitless from './limitless';
import * as tcgdex from './tcgdex';
import { cardKey, type CardInfo, type CardResult } from './tcgdex';

export { isCardRef, type CardResult } from './tcgdex';

export async function lookupCard(set: string, number: string): Promise<CardResult | null> {
  try {
    const card = await tcgdex.lookupCard(set, number);
    if (card) return card;
  } catch (e) {
    console.error('TCGdex lookup failed, trying Limitless:', e);
  }
  const card = await limitless.lookupCard(set, number);
  return card && { ...card, name: card.name ?? `${card.set} ${card.number}` };
}

// Filtered and sorted as asked. The default order (newest set first, then by number) is
// what import's default print (defaultPrint in cards.ts) relies on.
export async function searchCards(
  query: string,
  options: SearchOptions = DEFAULT_SEARCH
): Promise<CardResult[]> {
  let found: tcgdex.Search | null = null;
  try {
    found = await tcgdex.searchCards(query, options);
    if (!found.results.length && !found.missing.size) {
      // Nothing at all, perhaps a set too new for TCGdex: every Limitless result
      found = null;
    } else if (!found.missing.size) {
      return arranged(found.results, options);
    }
  } catch (e) {
    console.error('TCGdex search failed, trying Limitless:', e);
  }

  const fallback = found;
  // Filling in TCGdex's missing images needs every print that passes the filters, in
  // any order; on its own, Limitless filters, sorts and keeps one print per card itself
  const limitlessOptions: SearchOptions = found
    ? { ...options, sort: 'newest', newestOnly: false }
    : options;
  const extra = await limitless.searchCards(query, limitlessOptions).catch((e) => {
    // TCGdex's results are still worth showing
    if (!fallback) throw e;
    console.error('Limitless search failed:', e);
    return [];
  });
  if (!found) {
    // Limitless search results have no names; the search is the best guess. They're
    // already in the order asked for.
    return extra.map((card) => ({ ...card, name: query }));
  }
  // Only the cards TCGdex lists without an image: a few older sets have other codes on
  // Limitless (UD for Undaunted, UND on TCGdex), so anything else could be a duplicate
  const missing = found.missing;
  const filled = extra.flatMap((card) => {
    const info = missing.get(cardKey(card));
    if (!info) return [];
    missing.delete(cardKey(card));
    return [{ ...card, ...info }];
  });
  return arranged([...found.results, ...filled], options);
}

const byNumber = (n: string) => parseInt(n, 10) || Infinity;

// Newest set first, then by set code and number
function newestFirst(a: CardResult & CardInfo, b: CardResult & CardInfo) {
  return (
    b.date.localeCompare(a.date) ||
    a.set.localeCompare(b.set) ||
    byNumber(a.number) - byNumber(b.number) ||
    a.number.localeCompare(b.number)
  );
}

const ORDERS = {
  newest: newestFirst,
  name: (a, b) => a.name.localeCompare(b.name) || newestFirst(a, b),
  // TCGdex's order when asked for Pokédex order (Trainers and Energy after Pokémon)
  pokedex: (a, b) => a.rank - b.rank || newestFirst(a, b),
} satisfies Record<
  SearchOptions['sort'],
  (a: CardResult & CardInfo, b: CardResult & CardInfo) => number
>;

// Keeps the newest print of each name if asked, then sorts
function arranged(results: (CardResult & CardInfo)[], options: SearchOptions): CardResult[] {
  let cards = results;
  if (options.newestOnly) {
    const newest = new Map<string, CardResult & CardInfo>();
    for (const card of results.toSorted(newestFirst)) {
      const key = card.name.toLowerCase();
      if (!newest.has(key)) newest.set(key, card);
    }
    cards = [...newest.values()];
  }
  return cards
    .toSorted(ORDERS[options.sort])
    .map(({ set, number, image, thumb, name }) => ({ set, number, image, thumb, name }));
}
