// Regenerates src/app/api/tcgdex-sets.json: every English TCGdex set's official code
// (TWM, PRE, MEG), name and release date, which TCGdex only gives one set at a time.
// Search sorts by the date, its set filter lists the names, and imports and saved boards
// use the codes. Sets released after the last run still work: the API looks up any set
// missing here (see tcgdex.ts), though the set filter won't list them until the next run.
// It also writes src/app/api/extra-images.json (read only by the API, so it stays out of
// the page's code): images for the cards the API gives none, by TCGdex set id and card id.
// First TCGdex's own, when the asset host has one anyway, in the set's folder (some
// promos) or, for a subset, its main set's (the galleries and Shiny Vault, filed there);
// then pokemon-tcg-data's (the JSON behind pokemontcg.io, on GitHub, images hosted by
// Scrydex and pokemontcg.io), matched by set code, number and name. Every image is checked
// to load. Codes with no cards to show are marked `empty` and left out of the set filter:
// no card with an image anywhere, or a code the search can't take (EX5.5).
// Run with `npm run tcgdex:sets` and commit both files.
import { writeFile } from 'node:fs/promises';

const API = 'https://api.tcgdex.net/v2/en';
const ASSETS = 'https://assets.tcgdex.net/en';
const FILL_DATA = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
// pokemon-tcg-data's promo codes, where they differ from TCGdex's
const FILL_CODES = { SMP: 'PR-SM', SVP: 'PR-SV', SWSHP: 'PR-SW', BWP: 'PR-BLW', XYP: 'PR-XY' };
// As in tcgdex.ts
const SET_CODE = /^[A-Za-z0-9-]{2,8}$/;
// TCG Pocket is a separate game with its own cards
const SKIP_SERIES = new Set(['tcgp']);

async function get(path, base = API) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// As in tcgdex.ts: sets left out, so their images aren't looked for
const MISNUMBERED = new Set(['30th-c']);

// Whether both of a card's images (the board's and the thumbnail) load. Only a 404 means
// no image; anything else failing stops the run, so an outage or rate limit isn't written
// down as cards without images.
async function loads(urls) {
  for (const url of urls) {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    if (!res.headers.get('Content-Type')?.startsWith('image/')) return false;
  }
  return true;
}

// Of these cards' [board image, thumbnail] pairs (by card id), the ones that load, eight
// checked at a time
async function loading(pairs) {
  const ok = {};
  for (let i = 0; i < pairs.length; i += 8) {
    const batch = pairs.slice(i, i + 8);
    const has = await Promise.all(batch.map(([, urls]) => loads(urls)));
    batch.forEach(([id, urls], j) => has[j] && (ok[id] = urls));
  }
  return ok;
}

// TCGdex's own images for the cards of a set the API gives none, by card id: in the set's
// folder (series/set), then for a subset in its main set's (`main`)
async function onAssetHost(s, main, missing) {
  const found = {};
  for (const id of [s.id, main].filter(Boolean)) {
    const base = `${ASSETS}/${s.serie.id}/${id}`;
    const left = missing.filter((card) => !found[card]);
    Object.assign(
      found,
      await loading(
        left.map((card) => [card, ['high', 'low'].map((q) => `${base}/${card}/${q}.webp`)])
      )
    );
  }
  return found;
}

// For matching across sources: numbers without padding (073, SV001 and TG01 as 73, SV1
// and TG1), and names in lower case letters and digits only (Zoroark GX, Zoroark-GX),
// without a leading "Basic" (Basic Grass Energy, Grass Energy)
const numberKey = (n) => n.replace(/^([A-Za-z]*)0+(?=\d)/, '$1').toUpperCase();
const nameKey = (n) =>
  n
    .toLowerCase()
    .replace(/^basic /, '')
    .replace(/[^a-z0-9]/g, '');

const list = await get('/sets');
const details = [];
for (let i = 0; i < list.length; i += 8) {
  details.push(...(await Promise.all(list.slice(i, i + 8).map((s) => get(`/sets/${s.id}`)))));
}
const official = (s) => s.abbreviation?.official ?? s.tcgOnline ?? s.id.toUpperCase();
// A subset's main set: the set with its code and no subset part (CRZ:GG's is CRZ)
const mains = new Map(
  details.filter((s) => !official(s).includes(':')).map((s) => [official(s), s.id])
);

const sets = {};
// Images for cards the API gives none, by set id and card id; codes with a card that has
// an image; and the cards still without one, by set
const extra = {};
const withImages = new Set();
const stillMissing = [];
let fromTcgdex = 0;
for (const s of details) {
  if (SKIP_SERIES.has(s.serie?.id)) continue;
  // Subsets (SIT:TG, CRZ:GG) share their main set's code, as on the cards
  const [code, part] = official(s).split(':');
  sets[s.id] = { code, name: s.name, date: s.releaseDate ?? '' };
  if (s.cards?.some((card) => card.image)) withImages.add(code);
  if (MISNUMBERED.has(s.id)) continue;
  const missing = s.cards?.filter((card) => !card.image) ?? [];
  const found = await onAssetHost(
    s,
    part ? mains.get(code) : undefined,
    missing.map((c) => c.localId)
  );
  if (Object.keys(found).length) {
    extra[s.id] = found;
    withImages.add(code);
    fromTcgdex += Object.keys(found).length;
  }
  const left = missing.filter((card) => !found[card.localId]);
  if (left.length) stillMissing.push({ s, code, missing: left });
}

// The rest from pokemon-tcg-data: its sets by code (or by name, for the few without one).
// Sets that share a code can share numbers (Celebrations and its Classic Collection), so
// each number keeps every card, and only one with the same name is used.
const fillSets = await get('/sets/en.json', FILL_DATA);
let fromFill = 0;
for (const { s, code, missing } of stillMissing) {
  const matches = fillSets.filter((f) =>
    f.ptcgoCode ? f.ptcgoCode === (FILL_CODES[code] ?? code) : f.name === s.name
  );
  const cards = new Map();
  for (const f of matches) {
    for (const card of await get(`/cards/en/${f.id}.json`, FILL_DATA)) {
      if (!card.images?.large || !card.images?.small) continue;
      const key = numberKey(card.number);
      cards.set(key, [...(cards.get(key) ?? []), card]);
    }
  }
  const pairs = missing.flatMap((card) => {
    // A different name means a different card under that number: left out
    const match = cards
      .get(numberKey(card.localId))
      ?.find((c) => nameKey(c.name) === nameKey(card.name));
    return match ? [[card.localId, [match.images.large, match.images.small]]] : [];
  });
  const found = await loading(pairs);
  if (Object.keys(found).length) {
    extra[s.id] = { ...extra[s.id], ...found };
    withImages.add(code);
    fromFill += Object.keys(found).length;
  }
}

const codes = [...new Set(Object.values(sets).map((s) => s.code))];
const empty = new Set(codes.filter((code) => !withImages.has(code) || !SET_CODE.test(code)));
for (const set of Object.values(sets)) if (empty.has(set.code)) set.empty = true;

const sortedKeys = (o) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const sorted = sortedKeys(sets);
const out = new URL('../src/app/api/tcgdex-sets.json', import.meta.url);
await writeFile(out, JSON.stringify(sorted, null, 2) + '\n');
const extraOut = new URL('../src/app/api/extra-images.json', import.meta.url);
const extraSorted = sortedKeys(
  Object.fromEntries(Object.entries(extra).map(([id, cards]) => [id, sortedKeys(cards)]))
);
await writeFile(extraOut, JSON.stringify(extraSorted, null, 2) + '\n');
const left = stillMissing.reduce((n, m) => n + m.missing.length, 0) - fromFill;
console.log(
  `Wrote ${Object.keys(sorted).length} sets (${empty.size} codes empty), and images for ${fromTcgdex} cards from TCGdex's asset host and ${fromFill} from pokemon-tcg-data (${left} cards still without one).`
);
