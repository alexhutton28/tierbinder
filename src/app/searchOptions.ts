// The card search's set filter and sort direction, shared by the Add Cards tab and the
// search API route (as query parameters). Results are always by release date.

export type SearchOptions = {
  // Official set codes (TWM, PRE); none means every set
  sets: string[];
  // Oldest set first instead of newest
  reverse: boolean;
};

export const DEFAULT_SEARCH: SearchOptions = { sets: [], reverse: false };

// What the sort button says the order is, as given and reversed
export const SORT_DIRECTIONS = ['Newest first', 'Oldest first'] as const;

// How many filters are on (the sort direction isn't a filter)
export const activeFilters = (options: SearchOptions) => options.sets.length;

const SET_CODE = /^[A-Z0-9-]{2,8}$/;

// Only what differs from the defaults, so a plain search keeps its plain URL
export function toParams(query: string, options: SearchOptions) {
  const params = new URLSearchParams({ q: query });
  if (options.sets.length) params.set('sets', options.sets.join(','));
  if (options.reverse) params.set('reverse', '1');
  return params;
}

export function fromParams(params: URLSearchParams): SearchOptions {
  return {
    sets: (params.get('sets') ?? '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter((code) => SET_CODE.test(code)),
    reverse: params.get('reverse') === '1',
  };
}
