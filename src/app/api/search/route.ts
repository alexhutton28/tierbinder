import { fromParams, MAX_SETS } from '../../searchOptions';
import { searchCards } from '../cardSource';

// Card search by name, optionally only some sets and oldest first (searchOptions.ts):
// /api/search?q=dragapult+ex&sets=TWM,PRE&reverse=1. With sets and no name, every card
// in those sets.

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const query = params.get('q')?.trim() ?? '';
  const options = fromParams(params);
  if (query.length > 100 || (!query && !options.sets.length)) {
    return Response.json(
      { error: 'Need a Search of up to 100 Characters, or Some Sets' },
      { status: 400 }
    );
  }
  if (options.sets.length > MAX_SETS) {
    return Response.json({ error: `Pick up to ${MAX_SETS} Sets` }, { status: 400 });
  }
  try {
    const results = await searchCards(query, options);
    return Response.json(
      { results },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
    );
  } catch (e) {
    console.error('API /api/search error:', e);
    return Response.json({ error: 'Search Failed' }, { status: 502 });
  }
}
