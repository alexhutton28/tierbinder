import type { CardPlacement } from '../graphics/types';

// Moving the selection on the board with the arrow keys, for any graphic: from the cards
// as they're drawn (`placements`, the board's and the card tray's) and the places they're
// in (each tier, the canvas, the card tray: `place`, by id).

export type Direction = 'left' | 'right' | 'up' | 'down';

export const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

const center = (p: CardPlacement) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

// The card the selection moves to from `fromId` (null: it stays). Left and right stay in
// the card's place (along a tier's row, through the tray, across the canvas); up and down
// go to any card above or below. Either way it's the nearest card that way by center,
// a step across counting double, so a tier's next card wins over one in the next tier.
// Cards with the same center (stacked on the blank canvas) go in drawing order, so each
// can be reached.
export function nextCard(
  placements: CardPlacement[],
  place: (id: string) => number,
  fromId: string,
  direction: Direction
): string | null {
  const fromAt = placements.findIndex((p) => p.item.id === fromId);
  if (fromAt < 0) return null;
  const from = center(placements[fromAt]);
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;
  let best: { id: string; score: number } | null = null;
  placements.forEach((p, at) => {
    if (at === fromAt) return;
    if (horizontal && place(p.item.id) !== place(fromId)) return;
    const c = center(p);
    const along = (horizontal ? c.x - from.x : c.y - from.y) * sign;
    const across = Math.abs(horizontal ? c.y - from.y : c.x - from.x);
    // (on the same line, drawing order decides which way it is)
    if (along < 0 || (along === 0 && (across > 0 || (at - fromAt) * sign < 0))) return;
    // (a tie goes to the card nearest in drawing order)
    const score = along + 2 * across + Math.abs(at - fromAt) * 1e-6;
    if (!best || score < best.score) best = { id: p.item.id, score };
  });
  return (best as { id: string } | null)?.id ?? null;
}
