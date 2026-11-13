// Cards flying across the page: a copy of a card's picture that leaves one place (a search
// result's or featured pool's thumbnail) and lands on another (its spot on the board or in
// the card tray), along a slight arc, easing in and out (--ease-flight) over
// --duration-flight, each a little after the last. Plain DOM over the page, outside React,
// since it's redrawn every frame; the landing spot is asked for every frame too, so it
// follows the board as it rescales or the page scrolls.

import styles from './flights.module.css';

export type Box = { left: number; top: number; width: number; height: number; radius: number };

export type Flight = {
  id: string;
  src: string;
  from: Box;
};

// Each card leaves this long (ms) after the one before it
export const FLIGHT_STAGGER = 40;
// How long past the last landing (ms) the cards are put down anyway, if frames have stopped
const LANDING_GRACE = 200;
// How far the path bows from a straight line at its middle, as a share of the distance
// flown: toward where the card lands (down to a spot lower than its thumbnail, up to a
// higher one), so it drops in from the side the tray is on
const FLIGHT_ARC = 0.15;

// The flight's easing (--ease-flight, a cubic-bezier()) as a function of time, or null if it
// can't be read (the cards then land at once)
function readEasing(): ((t: number) => number) | null {
  const value = getComputedStyle(document.body).getPropertyValue('--ease-flight');
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

function readDuration(name: string) {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  const ms = parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
  return Number.isFinite(ms) ? ms : 0;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Whether all of a box shows in the window
export const wholeOnScreen = (box: Box) =>
  box.top >= 0 &&
  box.top + box.height <= innerHeight &&
  box.left >= 0 &&
  box.left + box.width <= innerWidth;

// Whether any of a box shows in the window
export const onScreen = (box: Box) =>
  box.top < innerHeight &&
  box.top + box.height > 0 &&
  box.left < innerWidth &&
  box.left + box.width > 0;

// Flies each card from its `from` box to where it lands, calling `onLand` with the cards
// that arrived (or whose landing spot went away: the board cleared mid-flight), once a frame.
// With `onScreenOnly`, a card whose landing spot is off screen when it would leave (on a
// phone, the board scrolled away above the results) lands there at once instead.
// `measure` is called once a frame, before anything moves, and gives each card's landing
// spot, so the page's layout is read once a frame however many cards fly. Returns a function
// that lands them all at once.
export function launchFlights(
  flights: Flight[],
  measure: () => (id: string) => Box | null,
  onLand: (ids: string[]) => void,
  { onScreenOnly = false } = {}
) {
  const ease = readEasing();
  const duration = ease ? readDuration('--duration-flight') : 0;
  const start = performance.now();
  const live = flights.map((flight, i) => {
    const img = document.createElement('img');
    img.src = flight.src;
    img.alt = '';
    img.className = styles.flight;
    img.setAttribute('aria-hidden', 'true');
    document.body.append(img);
    return { ...flight, img, delay: i * FLIGHT_STAGGER, landed: false };
  });

  const place = (img: HTMLImageElement, box: Box) => {
    img.style.left = `${box.left}px`;
    img.style.top = `${box.top}px`;
    img.style.width = `${box.width}px`;
    img.style.height = `${box.height}px`;
    img.style.borderRadius = `${box.radius}px`;
  };
  // Kept a couple of frames after landing, so the card it hands over to has been drawn
  const remove = (img: HTMLImageElement) =>
    requestAnimationFrame(() => requestAnimationFrame(() => img.remove()));

  let frame = 0;
  let timer = 0;
  let first = true;
  const step = (now: number) => {
    const target = measure();
    const landed: string[] = [];
    for (const flight of live) {
      if (flight.landed) continue;
      const to = target(flight.id);
      const t = duration ? (now - start - flight.delay) / duration : 1;
      const offScreen = first && onScreenOnly && to !== null && !onScreen(to);
      if (!to || t >= 1 || offScreen) {
        flight.landed = true;
        if (to) place(flight.img, to);
        landed.push(flight.id);
        if (offScreen) flight.img.remove();
        else remove(flight.img);
        continue;
      }
      const p = ease ? ease(Math.max(0, t)) : 1;
      const { from } = flight;
      // The arc: off the straight line between the boxes' centers, at right angles to it,
      // most at the middle; (-dy, dx) is that right angle, at the distance's length, turned
      // to the landing's side (down, unless the spot is higher than the thumbnail)
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const toward = dx * (dy < 0 ? -1 : 1) < 0 ? -1 : 1;
      const bow = FLIGHT_ARC * 4 * p * (1 - p) * toward;
      place(flight.img, {
        left: mix(from.left, to.left, p) - dy * bow,
        top: mix(from.top, to.top, p) + dx * bow,
        width: mix(from.width, to.width, p),
        height: mix(from.height, to.height, p),
        radius: mix(from.radius, to.radius, p),
      });
    }
    first = false;
    if (landed.length) onLand(landed);
    if (live.some((f) => !f.landed)) frame = requestAnimationFrame(step);
    else clearTimeout(timer);
  };
  // Lands every card still flying: at once when asked (`now`: before an export), else
  // handing over to the drawn card as a landing does
  const land = (now: boolean) => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    const landed = live.filter((f) => !f.landed);
    for (const flight of live) {
      if (now) flight.img.remove();
      else if (!flight.landed) remove(flight.img);
      flight.landed = true;
    }
    if (landed.length) onLand(landed.map((f) => f.id));
  };
  // Each copy sits over its thumbnail at once, then they leave one by one
  for (const flight of live) place(flight.img, flight.from);
  frame = requestAnimationFrame(step);
  // Frames stop in a tab that isn't painting (hidden): the cards land anyway once their
  // time is up, rather than staying hidden
  timer = window.setTimeout(
    () => land(false),
    duration + live.length * FLIGHT_STAGGER + LANDING_GRACE
  );
  return () => land(true);
}
