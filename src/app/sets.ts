// The sets the card search can filter by: one per official set code, newest first. A
// code can cover several TCGdex sets (a set and its Trainer Gallery), so it takes the
// shortest of their names, the main set's. Codes with no cards to show (marked `empty`
// by npm run tcgdex:sets) are left out, and sets newer than tcgdex-sets.json aren't
// listed until it's regenerated.
import SETS from './api/tcgdex-sets.json';

export type CardSet = { code: string; name: string; date: string };

const byCode = new Map<string, CardSet>();
for (const set of Object.values(SETS)) {
  if ('empty' in set) continue;
  const known = byCode.get(set.code);
  // The latest date of the code's sets, and the shortest name
  const date = known && known.date > set.date ? known.date : set.date;
  const name = known && known.name.length <= set.name.length ? known.name : set.name;
  byCode.set(set.code, { code: set.code, name, date });
}

export const CARD_SETS: CardSet[] = [...byCode.values()].sort(
  (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)
);
