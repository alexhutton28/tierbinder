// The card search's filters and sort order, shared by the Add Cards tab and the search
// API route (as query parameters)

export const CARD_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'energy', label: 'Energy' },
] as const;

export const FORMATS = [
  { value: 'all', label: 'All' },
  { value: 'standard', label: 'Standard' },
  { value: 'expanded', label: 'Expanded' },
] as const;

export const SORT_ORDERS = [
  { value: 'newest', label: 'Newest set' },
  { value: 'name', label: 'Name' },
  { value: 'pokedex', label: 'Pokédex number' },
] as const;

export type CardType = (typeof CARD_TYPES)[number]['value'];
export type Format = (typeof FORMATS)[number]['value'];
export type SortOrder = (typeof SORT_ORDERS)[number]['value'];

export type SearchOptions = {
  type: CardType;
  format: Format;
  sort: SortOrder;
  // Only the newest print of each card name
  newestOnly: boolean;
};

export const DEFAULT_SEARCH: SearchOptions = {
  type: 'all',
  format: 'all',
  sort: 'newest',
  newestOnly: false,
};

// How many filters differ from the defaults (the sort order isn't a filter)
export function activeFilters(options: SearchOptions) {
  return (
    Number(options.type !== DEFAULT_SEARCH.type) +
    Number(options.format !== DEFAULT_SEARCH.format) +
    Number(options.newestOnly)
  );
}

// Only what differs from the defaults, so a plain search keeps its plain URL
export function toParams(query: string, options: SearchOptions) {
  const params = new URLSearchParams({ q: query });
  if (options.type !== 'all') params.set('type', options.type);
  if (options.format !== 'all') params.set('format', options.format);
  if (options.sort !== 'newest') params.set('sort', options.sort);
  if (options.newestOnly) params.set('newest', '1');
  return params;
}

const pick = <T extends string>(list: readonly { value: T }[], value: string | null, fallback: T) =>
  list.find((o) => o.value === value)?.value ?? fallback;

export function fromParams(params: URLSearchParams): SearchOptions {
  return {
    type: pick(CARD_TYPES, params.get('type'), DEFAULT_SEARCH.type),
    format: pick(FORMATS, params.get('format'), DEFAULT_SEARCH.format),
    sort: pick(SORT_ORDERS, params.get('sort'), DEFAULT_SEARCH.sort),
    newestOnly: params.get('newest') === '1',
  };
}
