// How long a closing popup (the card menu, dropdowns, the Sets popup, View) stays on screen:
// just past its fold (--duration-fold, 180ms). Timed rather than waiting for animationend,
// which doesn't fire in a tab that isn't painting.
export const FOLD_CLEARANCE = 220;

// An easing token (a cubic-bezier()) as a function of time, or null if it can't be read
// (what uses it then finishes at once)
export function readEasing(name: string): ((t: number) => number) | null {
  const value = getComputedStyle(document.body).getPropertyValue(name);
  const points = value
    .match(/cubic-bezier\(([^)]*)\)/)?.[1]
    .split(',')
    .map((s) => Number(s.trim()));
  if (!points || points.length !== 4 || points.some((n) => Number.isNaN(n))) return null;
  const [x1, y1, x2, y2] = points;
  // One coordinate of the curve at parameter u, from its two control values
  const at = (a: number, b: number, u: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  return (t) => {
    const x = Math.min(1, Math.max(0, t));
    // The parameter whose x is t, by bisection (x rises with u on a CSS easing curve)
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

// A duration token in ms (0 if it can't be read)
export function readDuration(name: string) {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  const ms = parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
  return Number.isFinite(ms) ? ms : 0;
}
