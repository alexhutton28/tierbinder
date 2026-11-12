import { isCardRef, lookupCard } from '../cardSource';

// One card by set code and number: /api/card?set=TWM&number=130
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const set = params.get('set');
  const number = params.get('number');
  if (!isCardRef(set, number)) {
    return Response.json({ error: 'Need a Set Code and Card Number' }, { status: 400 });
  }
  try {
    const card = await lookupCard(set, number!);
    if (!card) return Response.json({ error: 'Card Not Found' }, { status: 404 });
    return Response.json(card, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
    });
  } catch (e) {
    console.error('API /api/card error:', e);
    return Response.json({ error: 'Lookup Failed' }, { status: 502 });
  }
}
