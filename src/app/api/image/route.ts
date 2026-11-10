// Serves card and sprite images from our own origin. Canvas export refuses to read
// images from hosts that don't send CORS headers, so TierBinder loads every image
// through here, which also keeps one cache of them. Only known image hosts are allowed, so this can't
// be used as an open proxy.
const ALLOWED_HOSTS = new Set([
  'assets.tcgdex.net',
  // Boards saved before the move to TCGdex hold Limitless image URLs
  'limitlesstcg.nyc3.cdn.digitaloceanspaces.com',
  'r2.limitlesstcg.net',
  'images.pokemontcg.io',
]);

const MAX_BYTES = 5_000_000;

export async function GET(req: Request) {
  let url: URL;
  try {
    url = new URL(new URL(req.url).searchParams.get('url') ?? '');
  } catch {
    return Response.json({ error: 'Need an image URL.' }, { status: 400 });
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return Response.json({ error: 'Image host not allowed.' }, { status: 400 });
  }

  try {
    // No redirects: they could lead off the allowed hosts
    const res = await fetch(url, { redirect: 'error' });
    const type = res.headers.get('Content-Type') ?? '';
    if (!res.ok || !type.startsWith('image/')) {
      return Response.json({ error: 'Image not found.' }, { status: 404 });
    }
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return Response.json({ error: 'Image too large.' }, { status: 413 });
    }
    return new Response(body, {
      headers: {
        'Content-Type': type,
        // Card images never change
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    console.error('API /api/image error:', e);
    return Response.json({ error: 'Image fetch failed.' }, { status: 502 });
  }
}
