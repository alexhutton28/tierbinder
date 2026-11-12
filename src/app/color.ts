// Color helpers for drawing on colors people choose (the board's, a tier's)

// Petrel 950 (design/theme.css), for marks drawn on light colors where CSS variables
// can't reach: canvas text, and SVG checkmarks used as backgrounds
export const PETREL_950 = '#12171a';

// WCAG's relative luminance of a #rrggbb color
export function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Whether `dark` contrasts more with `color` than white does (WCAG contrast); colors that
// aren't #rrggbb count as dark backgrounds, taking white
export function darkReadsBetter(color: string, dark: string) {
  const hex = color.toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) return false;
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const background = luminance(hex);
  return contrast(background, luminance(dark)) > contrast(background, 1);
}
