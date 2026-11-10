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

// Newest set first unless reversed, only from the sets asked for. Newest first is what
// import's default print (defaultPrint in cards.ts) relies on.
export async function searchCards(
  query: string,
  options: SearchOptions = DEFAULT_SEARCH
): Promise<CardResult[]> {
  const inSets = (card: { set: string }) => !options.sets.length || options.sets.includes(card.set);
  let found: tcgdex.Search | null = null;
  try {
    found = await tcgdex.searchCards(query);
    if (!found.results.length && !found.missing.size) {
      // Nothing at all, perhaps a set too new for TCGdex: every Limitless result
      found = null;
    } else {
      found = {
        results: found.results.filter(inSets),
        // Keyed by cardKey: the set code, a space, the number
        missing: new Map([...found.missing].filter(([key]) => inSets({ set: key.split(' ')[0] }))),
      };
      if (!found.missing.size) return arranged(found.results, options);
    }
  } catch (e) {
    console.error('TCGdex search failed, trying Limitless:', e);
  }

  const fallback = found;
  const extra = await limitless.searchCards(query).catch((e) => {
    // TCGdex's results are still worth showing
    if (!fallback) throw e;
    console.error('Limitless search failed:', e);
    return [];
  });
  if (!found) {
    // Limitless search results have no names; the search is the best guess. They're
    // already newest first.
    const named = extra.filter(inSets).map((card) => ({ ...card, name: query }));
    return options.reverse ? named.toReversed() : named;
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

type Found = CardResult & CardInfo;

// By release date (newest first, or oldest when reversed), then by set code and number
function arranged(results: Found[], options: SearchOptions): CardResult[] {
  const dir = options.reverse ? -1 : 1;
  return results
    .toSorted(
      (a, b) =>
        dir * b.date.localeCompare(a.date) ||
        a.set.localeCompare(b.set) ||
        byNumber(a.number) - byNumber(b.number) ||
        a.number.localeCompare(b.number)
    )
    .map(({ set, number, image, thumb, name }) => ({ set, number, image, thumb, name }));
}
