// Card lookups and searches, from TCGdex (tcgdex.ts), with the search's set filter and
// order applied. Cards are by their official set codes.
import { DEFAULT_SEARCH, type SearchOptions } from '../searchOptions';
import * as tcgdex from './tcgdex';
import type { CardResult, Found } from './tcgdex';

export { isCardRef, lookupCard, type CardResult } from './tcgdex';

// Newest set first unless reversed, only from the sets asked for. Newest first is what
// import's default print (defaultPrint in cards.ts) relies on. With no name, every card in
// the sets asked for.
export async function searchCards(
  query: string,
  options: SearchOptions = DEFAULT_SEARCH
): Promise<CardResult[]> {
  if (!query) return arranged(await tcgdex.setCards(options.sets), options);
  const found = await tcgdex.searchCards(query);
  const inSets = (card: Found) => !options.sets.length || options.sets.includes(card.set);
  return arranged(found.filter(inSets), options);
}

// Newest set first, then by set code and lowest number first. Reversed, all of it flips:
// oldest set first, each from its highest number down.
function arranged(results: Found[], options: SearchOptions): CardResult[] {
  const dir = options.reverse ? -1 : 1;
  return results
    .toSorted(
      (a, b) =>
        dir *
        (b.date.localeCompare(a.date) ||
          a.set.localeCompare(b.set) ||
          // Numbers in order, with letters after: 2 before 10, CC2 before CC10, and
          // 230 before TG01
          a.number.localeCompare(b.number, 'en', { numeric: true }))
    )
    .map(({ set, number, image, thumb, name }) => ({ set, number, image, thumb, name }));
}
