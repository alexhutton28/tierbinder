// Client side of card sourcing: lookups and search through our API routes, and image
// loading through the same-origin proxy so canvas export works.

export type CardResult = {
  set: string;
  number: string;
  image: string;
  thumb: string;
  name?: string;
};

export async function fetchCard(set: string, number: string): Promise<CardResult | null> {
  const params = new URLSearchParams({ set, number });
  const res = await fetch(`/api/tcg-tier-stack/card?${params}`);
  return res.ok ? res.json() : null;
}

export async function searchCards(query: string): Promise<CardResult[]> {
  const res = await fetch(`/api/tcg-tier-stack/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return (await res.json()).results;
}

export function proxied(url: string) {
  return `/api/tcg-tier-stack/image?url=${encodeURIComponent(url)}`;
}

// One load per image URL for the whole session
const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string) {
  let image = images.get(url);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(url); // let a later render retry
        reject(new Error(`Image failed: ${url}`));
      };
      img.src = proxied(url);
    });
    images.set(url, image);
  }
  return image;
}

// Runs tasks a few at a time so a big import doesn't hit Limitless all at once
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
