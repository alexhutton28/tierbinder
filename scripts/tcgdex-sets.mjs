// Regenerates src/app/api/tcgdex-sets.json: every English TCGdex set's official code
// (TWM, PRE, MEG), name and release date, which TCGdex only gives one set at a time.
// Search sorts by the date, its set filter lists the names, and imports and saved boards
// use the codes. Sets released after the last run still work: the API looks up any set
// missing here (see tcgdex.ts), though the set filter won't list them until the next run.
// Codes with no cards to show are marked `empty` and left out of the set filter: no card
// with an image on TCGdex, and none for Limitless to fill in (as the search does, it's only
// asked when TCGdex lists cards without images; some codes are other sets there, like SP),
// or a code the search can't take (EX5.5).
// Run with `npm run tcgdex:sets` and commit the result.
import { writeFile } from 'node:fs/promises';

const API = 'https://api.tcgdex.net/v2/en';
const LIMITLESS = 'https://limitlesstcg.com';
const LIMITLESS_IMAGES = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/';
// As in tcgdex.ts
const SET_CODE = /^[A-Za-z0-9-]{2,8}$/;
// TCG Pocket is a separate game with its own cards
const SKIP_SERIES = new Set(['tcgp']);

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Whether Limitless's set page lists any card with an image on its CDN (as limitless.ts
// reads it)
async function onLimitless(code) {
  const res = await fetch(`${LIMITLESS}/cards/${encodeURIComponent(code)}`, {
    headers: { 'User-Agent': 'TierBinder' },
  });
  if (!res.ok) return false;
  const grid = /<a href="\/cards\/[A-Z0-9-]+\/[0-9A-Za-z-]+"><img[^>]*?src="([^"]+_SM\.png)"/g;
  return [...(await res.text()).matchAll(grid)].some(([, src]) => src.startsWith(LIMITLESS_IMAGES));
}

const list = await get('/sets');
const sets = {};
// Codes with a card that has an image on TCGdex, and with one that has none
const withImages = new Set();
const withoutImages = new Set();
for (let i = 0; i < list.length; i += 8) {
  const details = await Promise.all(list.slice(i, i + 8).map((s) => get(`/sets/${s.id}`)));
  for (const s of details) {
    if (SKIP_SERIES.has(s.serie?.id)) continue;
    // Subsets (SIT:TG, CRZ:GG) share their main set's code, as on the cards
    const code = (s.abbreviation?.official ?? s.tcgOnline ?? s.id.toUpperCase()).split(':')[0];
    sets[s.id] = { code, name: s.name, date: s.releaseDate ?? '' };
    if (s.cards?.some((card) => card.image)) withImages.add(code);
    if (s.cards?.some((card) => !card.image)) withoutImages.add(code);
  }
}

const codes = [...new Set(Object.values(sets).map((s) => s.code))];
const empty = new Set();
for (const code of codes.filter((c) => !withImages.has(c))) {
  if (!SET_CODE.test(code) || !withoutImages.has(code) || !(await onLimitless(code))) {
    empty.add(code);
  }
}
for (const set of Object.values(sets)) if (empty.has(set.code)) set.empty = true;

const sorted = Object.fromEntries(Object.entries(sets).sort(([a], [b]) => a.localeCompare(b)));
const out = new URL('../src/app/api/tcgdex-sets.json', import.meta.url);
await writeFile(out, JSON.stringify(sorted, null, 2) + '\n');
console.log(`Wrote ${Object.keys(sorted).length} sets (${empty.size} codes empty).`);
