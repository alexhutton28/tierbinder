// Share links: the board showing, card tray included, carried in the link itself, so
// nothing is stored anywhere. The board's JSON (without the ids, which the board gets
// afresh when it loads) is compressed (deflate) and written as base64url after
// `#board=`. It's in the fragment, which browsers never send to the server.
// A link is about 600 characters for a small board and a few thousand for a full one.

import { parseGraphic } from './document';
import { typeOf, type Graphic } from './graphics';

const HASH_KEY = 'board';
// A version, so a later format can still read today's links
const FORMAT = '1';
// The most a link may unpack to (a full board is well under 100 KB), and the most cards
// it may hold, board and card tray together: repeated cards pack small, so a short link
// could otherwise hold a board too big to draw, which would then be saved
const MAX_BOARD_BYTES = 200_000;
export const MAX_SHARED_CARDS = 400;

// The cards a board holds, on it and in its card tray
export const sharedCards = (graphic: Graphic) =>
  typeOf(graphic.kind).layout(graphic).length + graphic.tray.items.length;

function toBase64Url(bytes: Uint8Array) {
  let text = '';
  // In chunks: String.fromCharCode takes its bytes as arguments
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BOARD_BYTES) {
      await reader.cancel();
      throw new Error('Too big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

// The link to `graphic`, on this page
export async function shareLink(graphic: Graphic) {
  // Ids are left out (cards', tiers' and strokes'), and cards' `kind`: parsing gives them back
  const json = JSON.stringify(graphic, (key, value) =>
    key === 'id' || (key === 'kind' && value === 'card') ? undefined : value
  );
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `${HASH_KEY}=${FORMAT}.${toBase64Url(packed)}`;
  return url.toString();
}

// Whether a location's hash is a share link (to clear it once it's been dealt with)
export function isShareHash(hash: string) {
  return new URLSearchParams(hash.replace(/^#/, '')).has(HASH_KEY);
}

// The board a share link's hash holds, or null when it has none or it doesn't read (cut
// short, edited, or from a later format): parsed as a saved board is, so only a valid board
// of a known type comes through
export async function readShareHash(hash: string): Promise<Graphic | null> {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY);
  const [format, data] = value?.split('.') ?? [];
  if (format !== FORMAT || !data) return null;
  try {
    const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
    const graphic = parseGraphic(JSON.parse(new TextDecoder().decode(bytes)));
    if (!graphic) return null;
    return sharedCards(graphic) <= MAX_SHARED_CARDS ? graphic : null;
  } catch {
    return null;
  }
}
