// Where card lookups and searches come from: TCGdex first, and limitlesstcg.com for
// the cards TCGdex lists but has no image for (the newest set for a while after
// release, some promo, energy and gallery sets), or for everything if TCGdex is down.
// Limitless is only asked when TCGdex comes up short. Both use the official set codes.
import * as limitless from './limitless';
import * as tcgdex from './tcgdex';
import { cardKey, type CardResult } from './tcgdex';

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

// Newest set first, then by number, which import's default print (defaultPrint in
// cards.ts) relies on
export async function searchCards(query: string): Promise<CardResult[]> {
  let found: tcgdex.Search | null = null;
  try {
    found = await tcgdex.searchCards(query);
    if (!found.results.length && !found.missing.size) {
      // Nothing at all, perhaps a set too new for TCGdex: every Limitless result
      found = null;
    } else if (!found.missing.size) {
      return sorted(found.results);
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
    // already newest set first.
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
  return sorted([...found.results, ...filled]);
}

function sorted(results: (CardResult & { date: string })[]): CardResult[] {
  const number = (n: string) => parseInt(n, 10) || Infinity;
  return results
    .toSorted(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.set.localeCompare(b.set) ||
        number(a.number) - number(b.number) ||
        a.number.localeCompare(b.number)
    )
    .map(({ set, number, image, thumb, name }) => ({ set, number, image, thumb, name }));
}
