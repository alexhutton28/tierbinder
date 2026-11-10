// The card search's set filter and sort direction, shared by the Add Cards tab and the
// search API route (as query parameters). Results are always by release date.

export type SearchOptions = {
  // Official set codes (TWM, PRE); none means every set
  sets: string[];
  // Oldest set first instead of newest
  reverse: boolean;
};

export const DEFAULT_SEARCH: SearchOptions = { sets: [], reverse: false };

// What the sort button says the order is, as given and reversed: by set, or by number
// when the filter has one set
export function sortDirection(options: SearchOptions) {
  const [usual, reversed] =
    options.sets.length === 1
      ? ['Lowest number first', 'Highest number first']
      : ['Newest first', 'Oldest first'];
  return options.reverse ? reversed : usual;
}

// How many filters are on (the sort direction isn't a filter)
export const activeFilters = (options: SearchOptions) => options.sets.length;

// The most sets one search can take: each set listed is a request or two to TCGdex and
// Limitless. The set filter stops ticking at this many.
export const MAX_SETS = 40;

const SET_CODE = /^[A-Z0-9-]{2,8}$/;

// Only what differs from the defaults, so a plain search keeps its plain URL. Sets go in
// alphabetical order (the order they were ticked only colors their boxes), so the same
// sets are the same URL and its cached response.
export function toParams(query: string, options: SearchOptions) {
  const params = new URLSearchParams({ q: query });
  if (options.sets.length) params.set('sets', options.sets.toSorted().join(','));
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
