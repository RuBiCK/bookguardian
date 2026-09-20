/**
 * The stand-in for a missing cover: a solid colour picked from the title,
 * with the title and author printed on it. Every colour in the palette is
 * dark enough for white text at ≥ 4.5:1, so the card reads the same in
 * light and dark mode — the placeholder owns its own colours and never
 * depends on the theme's.
 */

/** Background colours (white text on top). Keep them dark: see `contrastRatio` tests. */
export const PLACEHOLDER_PALETTE = [
  '#1f3a5f', // navy
  '#4a2c6b', // plum
  '#2f5d3a', // forest
  '#7a3b2e', // brick
  '#5b4a1f', // olive
  '#1f5c5a', // teal
  '#6b2d4a', // berry
  '#3b4a7a', // indigo
  '#5c3d1f', // cocoa
  '#2d4f6b', // slate blue
  '#6b3a2d', // rust
  '#3d3d3d', // charcoal
] as const;

export const PLACEHOLDER_TEXT = '#ffffff';

/** FNV-1a 32-bit: cheap, stable across sessions, spreads similar titles apart. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function placeholderColor(title: string): string {
  const key = title.trim().toLowerCase();
  return PLACEHOLDER_PALETTE[hashString(key) % PLACEHOLDER_PALETTE.length]!;
}

// ---- WCAG contrast (used by tests to guard the palette) --------------------

function channel(hex: string): number {
  const c = parseInt(hex, 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` colour (WCAG 2.x). */
export function luminance(hex: string): number {
  const rgb = hex.replace('#', '');
  return (
    0.2126 * channel(rgb.slice(0, 2)) +
    0.7152 * channel(rgb.slice(2, 4)) +
    0.0722 * channel(rgb.slice(4, 6))
  );
}

/** Contrast ratio between two colours, 1:1 … 21:1. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
