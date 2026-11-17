import { TIER_COLORS } from '../graphics/tier-list/model';

// The color picker's Swatches: recommended colors for the board, a column per hue, each
// from palest to deepest: red, orange, yellow, green and blue, Storm, purple and pink,
// then Petrel. The tiers' colors are the middle of their columns,
// their other shades mixed toward white and black; Storm and Petrel are the design
// system's own shades. They're suggestions for the user's own colors
// (see Exceptions in the design system), not interface colors.

export type Swatch = { name: string; color: string };

// How far each shade is mixed toward white (positive) or black (negative), palest first;
// 0 is the hue itself
const SHADE_MIX = [0.45, 0.2, 0, -0.25];
const SHADE_NAMES = ['Pale', 'Light', '', 'Dark'];

function mix(hex: string, amount: number) {
  const toward = amount > 0 ? 255 : 0;
  const share = Math.abs(amount);
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${channels
    .map((c) =>
      Math.round(c + (toward - c) * share)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

const shaded = (hue: string, base: string): Swatch[] =>
  SHADE_MIX.map((amount, i) => ({
    name: SHADE_NAMES[i] ? `${SHADE_NAMES[i]} ${hue.toLowerCase()}` : hue,
    color: mix(base, amount),
  }));

// The design system's own shades, named as it names them ("Petrel 500")
const fixed = (hue: string, shades: [number, string][]): Swatch[] =>
  shades.map(([shade, color]) => ({ name: `${hue} ${shade}`, color }));

// The tiers' first seven colors' names (TIER_COLORS); its gray gives way to Petrel's
const TIER_HUES = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink'];

// Columns, left to right
const COLUMNS: Swatch[][] = [
  ...TIER_HUES.slice(0, 5).map((hue, i) => shaded(hue, TIER_COLORS[i])),
  fixed('Storm', [
    [200, '#bfd7e4'],
    [300, '#9cc0d4'],
    [400, '#78a5bd'],
    [600, '#466e85'],
  ]),
  ...TIER_HUES.slice(5, 7).map((hue, i) => shaded(hue, TIER_COLORS[i + 5])),
  fixed('Petrel', [
    [300, '#b3bec4'],
    [500, '#6c7d88'],
    [700, '#3e4b53'],
    [850, '#232b30'],
  ]),
];

export const SWATCH_COLUMNS = COLUMNS.length;
export const SWATCH_ROWS = SHADE_MIX.length;

// Row by row (palest first), with each one's column and row
export const SWATCHES = SHADE_MIX.flatMap((_, row) =>
  COLUMNS.map((c, column) => ({ ...c[row], column, row }))
);
