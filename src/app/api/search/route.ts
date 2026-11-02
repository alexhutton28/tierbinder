import { searchCards } from '../limitless';

// Card search by name: /api/tcg-tier-stack/search?q=dragapult+ex
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!query || query.length > 100) {
    return Response.json({ error: 'Need a search of up to 100 characters.' }, { status: 400 });
  }
  try {
    const results = await searchCards(query);
    return Response.json(
      { results },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
    );
  } catch (e) {
    console.error('API /api/tcg-tier-stack/search error:', e);
    return Response.json({ error: 'Search failed.' }, { status: 502 });
  }
}
