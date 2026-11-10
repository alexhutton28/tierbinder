// Regenerates src/app/api/tcgdex-sets.json: every English TCGdex set's official code
// (TWM, PRE, MEG) and release date, which TCGdex only gives one set at a time. Search
// sorts by the date, and imports and saved boards use the codes. Sets released after
// the last run still work: the API looks up any set missing here (see tcgdex.ts).
// Run with `npm run tcgdex:sets` and commit the result.
import { writeFile } from 'node:fs/promises';

const API = 'https://api.tcgdex.net/v2/en';
// TCG Pocket is a separate game with its own cards
const SKIP_SERIES = new Set(['tcgp']);

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const list = await get('/sets');
const sets = {};
for (let i = 0; i < list.length; i += 8) {
  const details = await Promise.all(list.slice(i, i + 8).map((s) => get(`/sets/${s.id}`)));
  for (const s of details) {
    if (SKIP_SERIES.has(s.serie?.id)) continue;
    sets[s.id] = {
      // Subsets (SIT:TG, CRZ:GG) share their main set's code, as on the cards
      code: (s.abbreviation?.official ?? s.tcgOnline ?? s.id.toUpperCase()).split(':')[0],
      date: s.releaseDate ?? '',
    };
  }
}

const sorted = Object.fromEntries(Object.entries(sets).sort(([a], [b]) => a.localeCompare(b)));
const out = new URL('../src/app/api/tcgdex-sets.json', import.meta.url);
await writeFile(out, JSON.stringify(sorted, null, 2) + '\n');
console.log(`Wrote ${Object.keys(sorted).length} sets.`);
