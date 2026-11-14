// Pure description of the background of a page: colours and the small tile that repeats (lines, grid, dots, craft paper, chalkboard).
// The view turns this description into SVG; keeping it apart lets tests check it and lets the future export reuse it.
import { PageSettings } from "./file-format";

export interface TileShape {
  tag: `line` | `circle` | `ellipse`;
  attrs: Record<string, string | number>;
}

export interface BackgroundSpec {
  // Colour of the whole page.
  fill: string;
  // Side of the repeating square tile in pixels, or null when the page has no tile.
  tile: number | null;
  shapes: TileShape[];
}

const STEP = 32;

// Reads a #rgb, #rrggbb or #rrggbbaa colour and returns its red, green and blue parts (0 to 255). Returns null for anything else.
export function parseHex(color: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(color);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split(``).map((c) => c + c).join(``);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

// Returns a colour as #rrggbb (colour inputs accept nothing else). An invalid colour gives black.
export function toHex6(color: string): string {
  const rgb = parseHex(color) ?? [0, 0, 0];
  return `#` + rgb.map((n) => n.toString(16).padStart(2, `0`)).join(``);
}

// Returns the relative brightness of a colour, from 0 (black) to 1 (white).
export function brightness(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return 1;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

// Returns the colour and opacity of the guide lines and dots: pale blue on a light page, translucent white on a dark page.
export function guideStyle(background: string): { color: string; opacity: number } {
  return brightness(background) < 0.5 ? { color: `#ffffff`, opacity: 0.22 } : { color: `#6f9bd1`, opacity: 0.5 };
}

// Short fibres of the craft paper, as [x1, y1, x2, y2] inside a 200 pixel tile. Fixed values keep the paper identical at every drawing.
const FIBRES: [number, number, number, number][] = [
  [12, 20, 34, 26], [70, 8, 88, 22], [140, 30, 160, 24], [180, 60, 192, 80], [30, 70, 52, 66],
  [100, 90, 124, 100], [160, 120, 184, 112], [10, 130, 28, 150], [64, 150, 90, 144], [120, 170, 146, 182],
  [176, 170, 194, 188], [44, 188, 62, 176],
];
const SPECKS: [number, number][] = [[56, 44], [118, 52], [150, 98], [24, 104], [86, 126], [190, 140], [102, 196], [8, 176]];

// Smudges of chalk dust of the chalkboard, as [cx, cy, rx, ry] inside a 240 pixel tile.
const SMUDGES: [number, number, number, number][] = [[50, 60, 46, 14], [170, 40, 38, 10], [120, 140, 60, 16], [40, 200, 34, 12], [200, 190, 30, 9]];

// Returns the description of the background of a page.
export function backgroundSpec(page: PageSettings): BackgroundSpec {
  const fill = page.background;
  const guide = guideStyle(fill);
  const lineAttrs = { stroke: guide.color, "stroke-opacity": guide.opacity, "stroke-width": 1 };
  switch (page.pattern) {
    case `lines`:
      return { fill, tile: STEP, shapes: [{ tag: `line`, attrs: { x1: 0, y1: STEP - 0.5, x2: STEP, y2: STEP - 0.5, ...lineAttrs } }] };
    case `grid`:
      return {
        fill,
        tile: STEP,
        shapes: [
          { tag: `line`, attrs: { x1: 0, y1: STEP - 0.5, x2: STEP, y2: STEP - 0.5, ...lineAttrs } },
          { tag: `line`, attrs: { x1: STEP - 0.5, y1: 0, x2: STEP - 0.5, y2: STEP, ...lineAttrs } },
        ],
      };
    case `dots`:
      return { fill, tile: STEP, shapes: [{ tag: `circle`, attrs: { cx: STEP / 2, cy: STEP / 2, r: 1.6, fill: guide.color, "fill-opacity": guide.opacity + 0.1 } }] };
    case `craft`:
      return {
        fill,
        tile: 200,
        shapes: [
          ...FIBRES.map(([x1, y1, x2, y2]): TileShape => ({ tag: `line`, attrs: { x1, y1, x2, y2, stroke: `#7a5a2e`, "stroke-opacity": 0.22, "stroke-width": 1 } })),
          ...SPECKS.map(([cx, cy]): TileShape => ({ tag: `circle`, attrs: { cx, cy, r: 1.2, fill: `#7a5a2e`, "fill-opacity": 0.3 } })),
        ],
      };
    case `chalkboard`:
      return {
        fill,
        tile: 240,
        shapes: SMUDGES.map(([cx, cy, rx, ry]): TileShape => ({ tag: `ellipse`, attrs: { cx, cy, rx, ry, fill: `#ffffff`, "fill-opacity": 0.032 } })),
      };
    default:
      return { fill, tile: null, shapes: [] };
  }
}
