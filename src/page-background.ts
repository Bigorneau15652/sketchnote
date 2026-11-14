// Pure description of the background of a page: colours and the small tile that repeats (lines, grid, dots, craft paper, chalkboard).
// The view turns this description into SVG; keeping it apart lets tests check it and lets the future export reuse it.
import { PageSettings } from "./file-format";

export interface TileShape {
  tag: `line` | `circle` | `ellipse` | `rect`;
  attrs: Record<string, string | number>;
  // Name of a gradient of the spec used to fill the shape. The view turns it into a unique reference.
  gradient?: string;
}

export interface GradientStop {
  offset: number;
  color: string;
  opacity: number;
}

// A radial gradient, in fractions of the shape it fills.
export interface GradientDef {
  name: string;
  stops: GradientStop[];
}

export interface BackgroundSpec {
  // Colour of the whole page.
  fill: string;
  // Side of the repeating square tile in pixels, or null when the page has no tile.
  tile: number | null;
  shapes: TileShape[];
  // Gradients used by the overlay shapes.
  gradients: GradientDef[];
  // Shapes drawn once over the whole page, in page coordinates, after the tile (soft marks and shading of the chalkboard).
  overlay: TileShape[];
}

const STEP = 32;

// Returns the colours of the dotted frames that show the slots of a structure: blue on a light page, white on a dark page.
export function slotStyle(background: string): { color: string; strokeOpacity: number; fillOpacity: number } {
  return brightness(background) < 0.5 ? { color: `#ffffff`, strokeOpacity: 0.55, fillOpacity: 0.05 } : { color: `#3f78c0`, strokeOpacity: 0.7, fillOpacity: 0.05 };
}

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

// Returns a function that gives repeatable pseudo random numbers between 0 and 1 (mulberry32). The same seed always gives the same sequence,
// so the chalkboard looks identical at every drawing and in every export.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rounds a number to one decimal, which keeps the drawing description short.
const r1 = (n: number): number => Math.round(n * 10) / 10;

// Builds the chalkboard. Three layers: a fine grain (a 160 pixel tile of tiny light and dark specks, too fine to show a repetition),
// a few very soft wide wipe marks of the eraser (radial gradients, no sharp edge) and a slight darkening of the borders.
function chalkboard(fill: string, width: number, height: number): BackgroundSpec {
  const grain = seeded(7);
  const shapes: TileShape[] = [];
  for (let i = 0; i < 240; i++) {
    const light = grain() < 0.6;
    shapes.push({
      tag: `circle`,
      attrs: {
        cx: r1(grain() * 160),
        cy: r1(grain() * 160),
        r: r1(0.4 + grain() * 0.6),
        fill: light ? `#ffffff` : `#000000`,
        "fill-opacity": r1((light ? 0.03 + grain() * 0.07 : 0.06 + grain() * 0.1) * 100) / 100,
      },
    });
  }
  const wipes = seeded(21);
  const overlay: TileShape[] = [];
  for (let i = 0; i < 6; i++) {
    const rx = width * (0.22 + wipes() * 0.2);
    const ry = height * (0.035 + wipes() * 0.04);
    const cx = width * (0.1 + wipes() * 0.8);
    const cy = height * ((i + 0.5) / 6 + (wipes() - 0.5) * 0.2);
    const angle = (wipes() - 0.5) * 14;
    overlay.push({ tag: `ellipse`, gradient: `dust`, attrs: { cx: r1(cx), cy: r1(cy), rx: r1(rx), ry: r1(ry), transform: `rotate(${r1(angle)} ${r1(cx)} ${r1(cy)})` } });
  }
  overlay.push({ tag: `rect`, gradient: `shade`, attrs: { x: 0, y: 0, width, height } });
  return {
    fill,
    tile: 160,
    shapes,
    gradients: [
      { name: `dust`, stops: [{ offset: 0, color: `#ffffff`, opacity: 0.055 }, { offset: 0.6, color: `#ffffff`, opacity: 0.025 }, { offset: 1, color: `#ffffff`, opacity: 0 }] },
      { name: `shade`, stops: [{ offset: 0, color: `#000000`, opacity: 0 }, { offset: 0.65, color: `#000000`, opacity: 0 }, { offset: 1, color: `#000000`, opacity: 0.2 }] },
    ],
    overlay,
  };
}

// Returns a spec with the page colour, an optional tile size and nothing else yet.
function plain(fill: string, tile: number | null): BackgroundSpec {
  return { fill, tile, shapes: [], gradients: [], overlay: [] };
}

// Returns the description of the background of a page.
export function backgroundSpec(page: PageSettings): BackgroundSpec {
  const fill = page.background;
  const guide = guideStyle(fill);
  const lineAttrs = { stroke: guide.color, "stroke-opacity": guide.opacity, "stroke-width": 1 };
  switch (page.pattern) {
    case `lines`:
      return { ...plain(fill, STEP), shapes: [{ tag: `line`, attrs: { x1: 0, y1: STEP - 0.5, x2: STEP, y2: STEP - 0.5, ...lineAttrs } }] };
    case `grid`:
      return {
        ...plain(fill, STEP),
        shapes: [
          { tag: `line`, attrs: { x1: 0, y1: STEP - 0.5, x2: STEP, y2: STEP - 0.5, ...lineAttrs } },
          { tag: `line`, attrs: { x1: STEP - 0.5, y1: 0, x2: STEP - 0.5, y2: STEP, ...lineAttrs } },
        ],
      };
    case `dots`:
      return { ...plain(fill, STEP), shapes: [{ tag: `circle`, attrs: { cx: STEP / 2, cy: STEP / 2, r: 1.6, fill: guide.color, "fill-opacity": guide.opacity + 0.1 } }] };
    case `craft`:
      return {
        ...plain(fill, 200),
        shapes: [
          ...FIBRES.map(([x1, y1, x2, y2]): TileShape => ({ tag: `line`, attrs: { x1, y1, x2, y2, stroke: `#7a5a2e`, "stroke-opacity": 0.22, "stroke-width": 1 } })),
          ...SPECKS.map(([cx, cy]): TileShape => ({ tag: `circle`, attrs: { cx, cy, r: 1.2, fill: `#7a5a2e`, "fill-opacity": 0.3 } })),
        ],
      };
    case `chalkboard`:
      return chalkboard(fill, page.width, page.height);
    default:
      return plain(fill, null);
  }
}
