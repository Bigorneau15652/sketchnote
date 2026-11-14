// The colour swatches of the panel: five for the stroke and five for the fill. A fill swatch holds a colour and a pattern, or nothing (no colour). A click chooses a swatch,
// a double click changes it. Pure module (no Obsidian): tested without the application.
import { defaultPaletteFor, isSafeColor } from "./color";
import { FILL_STYLES, FillStyle } from "./elements";
import { hexToRgb } from "./hsl";

// A swatch of the fill: a colour with the pattern it is drawn with.
export interface FillSwatch {
  color: string;
  style: FillStyle;
}

// The number of swatches in each row.
export const SWATCH_COUNT = 5;

// Returns the stroke swatches of a palette of 3 to 5 colours as exactly five: the missing ones are the usual colours of the ink.
export function padPalette(palette: string[], ink: string): string[] {
  const usual = defaultPaletteFor(ink);
  const out = palette.slice(0, SWATCH_COUNT);
  for (const color of usual) {
    if (out.length >= SWATCH_COUNT) break;
    if (!out.some((c) => c.toLowerCase() === color.toLowerCase())) out.push(color);
  }
  while (out.length < SWATCH_COUNT) out.push(usual[out.length % usual.length]);
  return out;
}

// Returns the fill swatches of a new drawing: red, blue, green, black and no colour (lighter colours on a dark page, where the ink is white).
export function defaultFillPalette(ink: string): (FillSwatch | null)[] {
  const dark = ink.toLowerCase() === `#ffffff` || ink.toLowerCase() === `#fff`;
  const colors = dark ? [`#fc8181`, `#63b3ed`, `#68d391`, `#ffffff`] : [`#c0392b`, `#2b6cb0`, `#2f855a`, `#000000`];
  return [...colors.map((color): FillSwatch => ({ color, style: `solid` })), null];
}

// Reads the fill swatches of a file: exactly five, each one empty or a safe colour with a known pattern. Returns undefined when absent and null when it is not valid.
export function readFillPalette(value: unknown): (FillSwatch | null)[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== SWATCH_COUNT) return null;
  const out: (FillSwatch | null)[] = [];
  for (const entry of value) {
    if (entry === null) {
      out.push(null);
      continue;
    }
    if (typeof entry !== `object` || Array.isArray(entry)) return null;
    const { color, style } = entry as Record<string, unknown>;
    if (!isSafeColor(color) || !FILL_STYLES.includes(style as FillStyle)) return null;
    out.push({ color, style: style as FillStyle });
  }
  return out;
}

// Returns the CSS background that shows a fill swatch: the colour for a solid fill, the pattern drawn in the colour on white for the others, and white crossed by a red line
// for no colour. The colours come from a check of the file (#hex only).
export function swatchBackground(entry: FillSwatch | null): string {
  if (entry === null) return `linear-gradient(to top right, transparent 44%, #d9302c 44%, #d9302c 56%, transparent 56%), #ffffff`;
  const rgb = hexToRgb(entry.color);
  const c = rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : entry.color;
  switch (entry.style) {
    case `hachure`:
      return `repeating-linear-gradient(45deg, ${c} 0 2px, #ffffff 2px 6px)`;
    case `dots`:
      return `radial-gradient(circle, ${c} 1.6px, transparent 2px) 0 0 / 6px 6px, #ffffff`;
    case `grid`:
      return `repeating-linear-gradient(0deg, ${c} 0 1.5px, transparent 1.5px 6px), repeating-linear-gradient(90deg, ${c} 0 1.5px, transparent 1.5px 6px), #ffffff`;
    default:
      return c;
  }
}

// Tells whether a style (the fill and the pattern in use, or no fill) is the one of a swatch.
export function swatchMatches(entry: FillSwatch | null, fill: string | null, style: FillStyle): boolean {
  if (entry === null) return fill === null;
  if (fill === null) return false;
  const a = hexToRgb(entry.color);
  const b = hexToRgb(fill);
  return a !== null && b !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && entry.style === style;
}
