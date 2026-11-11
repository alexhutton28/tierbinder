// Regenerates src/app/api/tcgdex-sets.json: every English TCGdex set's official code
// (TWM, PRE, MEG), name and release date, which TCGdex only gives one set at a time.
// Search sorts by the date, its set filter lists the names, and imports and saved boards
// use the codes. Sets released after the last run still work: the API looks up any set
// missing here (see tcgdex.ts), though the set filter won't list them until the next run.
// Cards the API gives no image, but whose image is on TCGdex's asset host anyway (some
// promos), are listed as `unlisted`, with the series id their image URLs need. Codes with
// no cards to show are marked `empty` and left out of the set filter: no card with an
// image either way, or a code the search can't take (EX5.5).
// Run with `npm run tcgdex:sets` and commit the result.
import { writeFile } from 'node:fs/promises';

const API = 'https://api.tcgdex.net/v2/en';
const ASSETS = 'https://assets.tcgdex.net/en';
// As in tcgdex.ts
const SET_CODE = /^[A-Za-z0-9-]{2,8}$/;
// TCG Pocket is a separate game with its own cards
const SKIP_SERIES = new Set(['tcgp']);

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// As in tcgdex.ts: sets left out, so their images aren't looked for
const MISNUMBERED = new Set(['30th-c']);

// Whether the asset host has both of a card's images (the board's and the thumbnail). Only
// a 404 means no image; anything else failing stops the run, so an outage or rate limit
// isn't written down as cards without images.
async function hasImage(base) {
  for (const quality of ['high', 'low']) {
    const res = await fetch(`${base}/${quality}.webp`, { method: 'HEAD' });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`${base}/${quality}.webp: ${res.status}`);
    if (!res.headers.get('Content-Type')?.startsWith('image/')) return false;
  }
  return true;
}

// The cards of a set the API gives no image, but the asset host has one for
async function unlisted(s) {
  const ids = [];
  if (MISNUMBERED.has(s.id)) return ids;
  const missing = s.cards?.filter((card) => !card.image).map((card) => card.localId) ?? [];
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    const found = await Promise.all(
      batch.map((id) => hasImage(`${ASSETS}/${s.serie.id}/${s.id}/${id}`))
    );
    ids.push(...batch.filter((_, j) => found[j]));
  }
  return ids;
}

const list = await get('/sets');
const sets = {};
// Codes with a card that has an image on TCGdex
const withImages = new Set();
for (let i = 0; i < list.length; i += 8) {
  const details = await Promise.all(list.slice(i, i + 8).map((s) => get(`/sets/${s.id}`)));
  for (const s of details) {
    if (SKIP_SERIES.has(s.serie?.id)) continue;
    // Subsets (SIT:TG, CRZ:GG) share their main set's code, as on the cards
    const code = (s.abbreviation?.official ?? s.tcgOnline ?? s.id.toUpperCase()).split(':')[0];
    sets[s.id] = { code, name: s.name, date: s.releaseDate ?? '' };
    const ids = await unlisted(s);
    if (ids.length) sets[s.id].unlisted = { serie: s.serie.id, ids };
    if (ids.length || s.cards?.some((card) => card.image)) withImages.add(code);
  }
}

const codes = [...new Set(Object.values(sets).map((s) => s.code))];
const empty = new Set(codes.filter((code) => !withImages.has(code) || !SET_CODE.test(code)));
for (const set of Object.values(sets)) if (empty.has(set.code)) set.empty = true;

const sorted = Object.fromEntries(Object.entries(sets).sort(([a], [b]) => a.localeCompare(b)));
const out = new URL('../src/app/api/tcgdex-sets.json', import.meta.url);
await writeFile(out, JSON.stringify(sorted, null, 2) + '\n');
console.log(`Wrote ${Object.keys(sorted).length} sets (${empty.size} codes empty).`);
