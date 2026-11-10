// Card lookups for TierBinder, from the TCGdex API (tcgdex.dev: free, no key, open
// source). Cards are saved and imported by their official set code and number (TWM 130),
// as printed on the card, so this maps those to TCGdex's own set ids (sv06) through
// tcgdex-sets.json, and looks up any set released since that file was made.
import SETS from './tcgdex-sets.json';

export type CardResult = {
  set: string;
  number: string;
  image: string;
  thumb: string;
  name: string;
};

type SetInfo = { code: string; date: string };
type BriefCard = { id: string; localId: string; name: string; image?: string };
type FullCard = BriefCard & { set: { id: string } };

const API = 'https://api.tcgdex.net/v2/en';
// TCG Pocket is a separate game with its own cards
const SKIP_SERIES = new Set(['tcgp']);
// Card data changes rarely; new sets show up within a day
const REVALIDATE = 86400;

const SET_CODE = /^[A-Za-z0-9-]{2,8}$/;
const CARD_NUMBER = /^[A-Za-z0-9-]{1,8}$/;

export function isCardRef(set: unknown, number: unknown): set is string {
  return (
    typeof set === 'string' &&
    typeof number === 'string' &&
    SET_CODE.test(set) &&
    CARD_NUMBER.test(number)
  );
}

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { next: { revalidate: REVALIDATE } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TCGdex ${path}: ${res.status}`);
  return res.json();
}

const known: Record<string, SetInfo | null> = SETS;

// A set's code and date, fetched once for sets newer than tcgdex-sets.json
const fetched = new Map<string, Promise<SetInfo | null>>();
function setInfo(id: string): Promise<SetInfo | null> {
  if (id in known) return Promise.resolve(known[id]);
  let info = fetched.get(id);
  if (!info) {
    info = get<{
      releaseDate?: string;
      tcgOnline?: string;
      abbreviation?: { official?: string };
      serie?: { id: string };
    }>(`/sets/${encodeURIComponent(id)}`).then((s) =>
      !s || SKIP_SERIES.has(s.serie?.id ?? '')
        ? null
        : {
            code: (s.abbreviation?.official ?? s.tcgOnline ?? id.toUpperCase()).split(':')[0],
            date: s.releaseDate ?? '',
          }
    );
    info.catch(() => fetched.delete(id));
    fetched.set(id, info);
  }
  return info;
}

// Sets whose TCGdex listing doesn't match the cards, so their cards come from Limitless
// instead: 30th Classic Collection is numbered 1-30 in another order (its 001 is
// Charizard, the card is CC2), clashing with the main set's numbers, and has no images.
const ELSEWHERE = new Set(['30th-c']);

const setOf = (card: BriefCard) => card.id.slice(0, card.id.lastIndexOf('-'));

// Card numbers as printed: TCGdex pads some sets' numbers (073), cards don't (73)
const printed = (card: BriefCard) =>
  /^\d+$/.test(card.localId) ? String(Number(card.localId)) : card.localId;

// A set code's release date (its first set's), for cards from Limitless
export const codeDate = (code: string) =>
  Object.values(known).find((set) => set?.code === code)?.date ?? '';

// TCGdex images take a quality and format; high is 600×825, low 245×337
function toResult(card: BriefCard, set: SetInfo): CardResult | null {
  if (!card.image) return null;
  return {
    set: set.code,
    number: printed(card),
    image: `${card.image}/high.webp`,
    thumb: `${card.image}/low.webp`,
    name: card.name,
  };
}

export async function lookupCard(code: string, number: string): Promise<CardResult | null> {
  const upper = code.toUpperCase();
  // A code can cover more than one TCGdex set (a set and its subsets)
  const ids = Object.keys(known).filter((id) => known[id]?.code === upper && !ELSEWHERE.has(id));
  for (const id of ids) {
    const card = await get<FullCard>(
      `/sets/${encodeURIComponent(id)}/${encodeURIComponent(number)}`
    );
    const result = card && toResult(card, known[id]!);
    if (result) return result;
  }
  return null;
}

// A search's cards, each with its set's release date. For the fallback, `missing` holds
// the cards TCGdex has no image for, by `cardKey`, and `elsewhere` the codes with cards
// in an ELSEWHERE set, which all come from Limitless.
export type CardInfo = { name: string; date: string };
export type Search = {
  results: (CardResult & CardInfo)[];
  missing: Map<string, CardInfo>;
  elsewhere: Set<string>;
};

export const cardKey = (card: { set: string; number: string }) => `${card.set} ${card.number}`;

// Every card whose name contains the query
export async function searchCards(query: string): Promise<Search> {
  const params = new URLSearchParams({ name: query });
  const cards = (await get<BriefCard[]>(`/cards?${params}`)) ?? [];
  const setIds = [...new Set(cards.map(setOf))];
  const sets = new Map(
    await Promise.all(setIds.map(async (id) => [id, await setInfo(id)] as const))
  );

  const search: Search = { results: [], missing: new Map(), elsewhere: new Set() };
  for (const card of cards) {
    const set = sets.get(setOf(card));
    if (set) addCard(search, card, set, setOf(card));
  }
  return search;
}

// Every card in the sets with these codes (a code's subsets too). `covered` holds the
// codes TCGdex has; sets newer than tcgdex-sets.json aren't looked for.
export async function setCards(codes: string[]): Promise<Search & { covered: Set<string> }> {
  const ids = Object.keys(known).filter((id) => codes.includes(known[id]?.code ?? ''));
  const sets = await Promise.all(
    ids.map((id) => get<{ cards: BriefCard[] }>(`/sets/${encodeURIComponent(id)}`))
  );
  const search = {
    results: [],
    missing: new Map(),
    elsewhere: new Set<string>(),
    covered: new Set<string>(),
  };
  sets.forEach((found, i) => {
    const set = known[ids[i]];
    if (!found || !set) return;
    search.covered.add(set.code);
    for (const card of found.cards) addCard(search, card, set, ids[i]);
  });
  return search;
}

function addCard(search: Search, card: BriefCard, set: SetInfo, setId: string) {
  if (ELSEWHERE.has(setId)) {
    search.elsewhere.add(set.code);
    return;
  }
  const result = toResult(card, set);
  const info = { name: card.name, date: set.date };
  if (result) search.results.push({ ...result, ...info });
  else search.missing.set(cardKey({ set: set.code, number: printed(card) }), info);
}
