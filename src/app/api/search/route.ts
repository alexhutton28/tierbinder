import { fromParams } from '../../searchOptions';
import { searchCards } from '../cardSource';

// Card search by name, optionally only some sets and oldest first (searchOptions.ts):
// /api/search?q=dragapult+ex&sets=TWM,PRE&reverse=1
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const query = params.get('q')?.trim() ?? '';
  if (!query || query.length > 100) {
    return Response.json({ error: 'Need a search of up to 100 characters.' }, { status: 400 });
  }
  try {
    const results = await searchCards(query, fromParams(params));
    return Response.json(
      { results },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
    );
  } catch (e) {
    console.error('API /api/search error:', e);
    return Response.json({ error: 'Search failed.' }, { status: 502 });
  }
}
