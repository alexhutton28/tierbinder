// Card lookups for TierBinder, from the TCGdex API (tcgdex.dev: free, no key, open
// source), its only card source. Cards are saved and imported by their official set code
// and number (TWM 130), as printed on the card, so this maps those to TCGdex's own set
// ids (sv06) through tcgdex-sets.json, and looks up any set released since that file was
// made. Cards TCGdex has no image for are left out.
import SETS from './tcgdex-sets.json';

export type CardResult = {
  set: string;
  number: string;
  image: string;
  thumb: string;
  name: string;
};

// `unlisted`: cards the API gives no image, but whose image is on TCGdex's asset host
// anyway (some promos), found by `npm run tcgdex:sets`
type SetInfo = { code: string; date: string; unlisted?: { serie: string; ids: string[] } };
type BriefCard = { id: string; localId: string; name: string; image?: string };

const API = 'https://api.tcgdex.net/v2/en';
const ASSETS = 'https://assets.tcgdex.net/en';
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

// Sets whose TCGdex listing doesn't match the cards, so they're left out: 30th Classic
// Collection is numbered 1-30 in another order (its 001 is Charizard, the card is CC2),
// clashing with the main set's numbers
const MISNUMBERED = new Set(['30th-c']);

const setOf = (card: BriefCard) => card.id.slice(0, card.id.lastIndexOf('-'));

// Card numbers as printed: TCGdex pads some sets' numbers (073), cards don't (73)
const printed = (card: BriefCard) =>
  /^\d+$/.test(card.localId) ? String(Number(card.localId)) : card.localId;

// The card's image without its quality and format: the API's, or one only on the asset
// host
function imageOf(card: BriefCard, setId: string, set: SetInfo) {
  if (card.image) return card.image;
  const unlisted = set.unlisted;
  return unlisted?.ids.includes(card.localId)
    ? `${ASSETS}/${unlisted.serie}/${setId}/${card.localId}`
    : null;
}

// TCGdex images take a quality and format; high is 600×825, low 245×337
function toResult(card: BriefCard, setId: string, set: SetInfo): Found | null {
  const image = !MISNUMBERED.has(setId) && imageOf(card, setId, set);
  if (!image) return null;
  return {
    set: set.code,
    number: printed(card),
    image: `${image}/high.webp`,
    thumb: `${image}/low.webp`,
    name: card.name,
    date: set.date,
  };
}

export async function lookupCard(code: string, number: string): Promise<CardResult | null> {
  const upper = code.toUpperCase();
  // A code can cover more than one TCGdex set (a set and its subsets)
  let ids = Object.keys(known).filter((id) => known[id]?.code === upper && !MISNUMBERED.has(id));
  // A set newer than tcgdex-sets.json: look through the sets missing from it
  if (!ids.length) {
    const unknown = ((await get<{ id: string }[]>('/sets')) ?? [])
      .map((s) => s.id)
      .filter((id) => !(id in known));
    const infos = await Promise.all(unknown.map(setInfo));
    ids = unknown.filter((_, i) => infos[i]?.code === upper);
  }
  for (const id of ids) {
    const card = await get<BriefCard>(
      `/sets/${encodeURIComponent(id)}/${encodeURIComponent(number)}`
    );
    const set = known[id] ?? (await setInfo(id));
    const result = card && set && toResult(card, id, set);
    if (result) {
      const { set, image, thumb, name } = result;
      return { set, number: result.number, image, thumb, name };
    }
  }
  return null;
}

// A search's cards, each with its set's release date for sorting
export type Found = CardResult & { date: string };

// Every card whose name contains the query
export async function searchCards(query: string): Promise<Found[]> {
  const params = new URLSearchParams({ name: query });
  const cards = (await get<BriefCard[]>(`/cards?${params}`)) ?? [];
  const setIds = [...new Set(cards.map(setOf))];
  const sets = new Map(
    await Promise.all(setIds.map(async (id) => [id, await setInfo(id)] as const))
  );
  return cards.flatMap((card) => {
    const set = sets.get(setOf(card));
    const result = set && toResult(card, setOf(card), set);
    return result ? [result] : [];
  });
}

// Every card in the sets with these codes (a code's subsets too); sets newer than
// tcgdex-sets.json aren't looked for
export async function setCards(codes: string[]): Promise<Found[]> {
  const ids = Object.keys(known).filter(
    (id) => codes.includes(known[id]?.code ?? '') && !MISNUMBERED.has(id)
  );
  const sets = await Promise.all(
    ids.map((id) => get<{ cards: BriefCard[] }>(`/sets/${encodeURIComponent(id)}`))
  );
  return sets.flatMap((found, i) => {
    const set = known[ids[i]];
    if (!found || !set) return [];
    return found.cards.flatMap((card) => {
      const result = toResult(card, ids[i], set);
      return result ? [result] : [];
    });
  });
}
