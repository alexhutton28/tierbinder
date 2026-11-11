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
  if (!query) return setCards(options);
  const inSets = (card: { set: string }) => !options.sets.length || options.sets.includes(card.set);
  let found: tcgdex.Search | null = null;
  try {
    found = await tcgdex.searchCards(query);
    if (!found.results.length && !found.missing.size && !found.elsewhere.size) {
      // Nothing at all, perhaps a set too new for TCGdex: every Limitless result
      found = null;
    } else {
      found = {
        results: found.results.filter(inSets),
        // Keyed by cardKey: the set code, a space, the number
        missing: new Map([...found.missing].filter(([key]) => inSets({ set: key.split(' ')[0] }))),
        elsewhere: new Set([...found.elsewhere].filter((set) => inSets({ set }))),
      };
      if (!found.missing.size && !found.elsewhere.size) return arranged(found.results, options);
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
    // Already newest first
    const named = extra.filter(inSets).map((card) => ({ ...card, name: card.name ?? query }));
    return options.reverse ? named.toReversed() : named;
  }
  return arranged(merged(found, extra), options);
}

// Every card in the sets asked for (a search with no name): TCGdex's, with Limitless for
// the cards it has no image for, the codes whose cards come from it, and the sets TCGdex
// doesn't have yet
async function setCards(options: SearchOptions): Promise<CardResult[]> {
  const codes = options.sets;
  const found = await tcgdex.setCards(codes).catch((e) => {
    console.error('TCGdex set listing failed, trying Limitless:', e);
    return null;
  });
  const missingIn = new Set([...(found?.missing.keys() ?? [])].map((key) => key.split(' ')[0]));
  const fromLimitless = codes.filter(
    (code) => !found?.covered.has(code) || missingIn.has(code) || found.elsewhere.has(code)
  );
  let failed = 0;
  const extra = (
    await Promise.all(
      fromLimitless.map((code) =>
        limitless.setCards(code).catch((e) => {
          console.error(`Limitless set ${code} failed:`, e);
          failed++;
          return [];
        })
      )
    )
  ).flat();
  // With both sources down, an error (the route's 502) rather than an empty listing that
  // would be cached as "No cards found"
  if (!found && failed === fromLimitless.length) throw new Error('Card sources unavailable');
  if (!found) return arranged(extra.map(limitlessCard), options);
  // Sets TCGdex doesn't have yet come wholly from Limitless
  const uncovered = extra.filter((card) => !found.covered.has(card.set));
  const covered = extra.filter((card) => found.covered.has(card.set));
  return arranged([...merged(found, covered), ...uncovered.map(limitlessCard)], options);
}

// TCGdex's cards, plus from Limitless's: the cards TCGdex lists without an image, and
// those of the codes whose cards come from Limitless (tcgdex.ts's ELSEWHERE) that TCGdex
// doesn't have. Nothing else: a few older sets have other codes on Limitless (UD for
// Undaunted, UND on TCGdex), and some codes are other sets there (SP), so anything else
// could be a duplicate or the wrong card.
function merged(found: tcgdex.Search, extra: limitless.CardResult[]): Found[] {
  const cards: Found[] = [...found.results];
  const have = new Set(found.results.map(cardKey));
  for (const card of extra) {
    const key = cardKey(card);
    const info = found.missing.get(key);
    if (info) {
      found.missing.delete(key);
      cards.push({ ...card, ...info });
    } else if (found.elsewhere.has(card.set) && !have.has(key)) {
      have.add(key);
      cards.push(limitlessCard(card));
    }
  }
  return cards;
}

// A card from Limitless, named by it (or by its number if its page had no name) and
// dated by its set code
const limitlessCard = (card: limitless.CardResult): Found => ({
  ...card,
  name: card.name || cardKey(card),
  date: tcgdex.codeDate(card.set),
});

type Found = CardResult & CardInfo;

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
