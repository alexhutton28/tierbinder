// The sets the card search can filter by: one per official set code, newest first. A
// code can cover several TCGdex sets (a set and its Trainer Gallery), so it takes the
// shortest of their names, the main set's. Sets newer than tcgdex-sets.json aren't listed
// until it's regenerated (npm run tcgdex:sets).
import SETS from './api/tcgdex-sets.json';

export type CardSet = { code: string; name: string; date: string };

const byCode = new Map<string, CardSet>();
for (const set of Object.values(SETS)) {
  const known = byCode.get(set.code);
  if (!known || set.name.length < known.name.length) {
    byCode.set(set.code, { ...set, date: known && known.date > set.date ? known.date : set.date });
  }
}

export const CARD_SETS: CardSet[] = [...byCode.values()].sort(
  (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)
);
