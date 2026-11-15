// The distortions of a text and its vertical writing: where every letter goes, how it is turned, slanted and stretched. The text stays a text (it is edited as one); the letters are
// placed one by one when it is drawn. The width of a letter comes from a function given by the caller (the browser measures it), so that this module does not need the page and can
// be tested.
import type { TextAlign } from "./elements";
import { LINE_HEIGHT, textLines, wrapLines } from "./text-layout";

// The distortions of a text.
export const WARP_KINDS = [`arc`, `wave`, `slant`, `perspective`, `bulge`] as const;
export type WarpKind = (typeof WARP_KINDS)[number];

// The strength of a distortion goes from -1 (the other way) to 1; the usual one when a distortion is chosen is this.
export const DEFAULT_WARP_AMOUNT = 0.5;
export const MAX_WARP_AMOUNT = 1;
// A text with more letters than this is drawn without distortion (every letter is an element of the page).
export const MAX_WARP_LETTERS = 600;

// Tells whether a value is a distortion.
export function isWarpKind(value: unknown): value is WarpKind {
  return typeof value === `string` && (WARP_KINDS as readonly string[]).includes(value);
}

// Brings a strength into its range, to the hundredth.
export function cleanWarpAmount(value: number): number {
  return Math.min(MAX_WARP_AMOUNT, Math.max(-MAX_WARP_AMOUNT, Math.round(value * 100) / 100));
}

// What the layout of a text needs to know.
export interface WarpInput {
  text: string;
  size: number;
  align: TextAlign;
  // A text zone wraps its lines to its width (or, written vertically, to its height); any other text keeps its own lines.
  zone: boolean;
  width: number;
  height: number;
  vertical: boolean;
  warp: WarpKind | null;
  amount: number;
}

// A letter, placed: its middle (the letter is drawn centred on it), its turn and its slant in degrees, its stretch, and its width before the stretch.
export interface PlacedGlyph {
  char: string;
  x: number;
  y: number;
  rotate: number;
  skew: number;
  sx: number;
  sy: number;
  w: number;
}

export interface WarpLayout {
  glyphs: PlacedGlyph[];
  // The box that holds all the letters, in the coordinates of the layout.
  box: { x: number; y: number; w: number; h: number };
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
const r2 = (n: number): number => Math.round(n * 100) / 100;

// The space between two columns of a vertical text, as a multiple of the font size, and the height of a letter in a column.
const COLUMN_WIDTH = 1.25;
const LETTER_HEIGHT = 1.05;

// Lays the letters out on a straight grid, before any distortion: a row of letters for each line, or, for a vertical text, a column of letters stacked one under the other for each
// line (a long line of a vertical zone goes on in the next column). The middle of every letter is given in a block that starts at 0,0.
function grid(input: WarpInput, measure: (ch: string) => number): { glyphs: PlacedGlyph[]; w: number; h: number } {
  const { size } = input;
  const glyph = (char: string, x: number, y: number): PlacedGlyph => ({ char, x, y, rotate: 0, skew: 0, sx: 1, sy: 1, w: measure(char) });
  const out: PlacedGlyph[] = [];
  if (input.vertical) {
    // The columns: one per line of the text, cut every `rows` letters in a zone.
    const rows = input.zone ? Math.max(1, Math.floor(input.height / (size * LETTER_HEIGHT))) : Infinity;
    const columns: string[][] = [];
    for (const line of textLines(input.text)) {
      const letters = Array.from(line);
      if (letters.length === 0) columns.push([]);
      for (let i = 0; i < letters.length; i += rows) columns.push(letters.slice(i, i + rows));
    }
    const tallest = Math.max(1, ...columns.map((c) => c.length));
    const blockH = input.zone ? Math.max(input.height, size * LETTER_HEIGHT) : tallest * size * LETTER_HEIGHT;
    columns.forEach((column, c) => {
      // The alignment of the text places a column at the top, the middle or the bottom of the block.
      const free = blockH - column.length * size * LETTER_HEIGHT;
      const top = input.align === `center` ? free / 2 : input.align === `right` ? free : 0;
      column.forEach((ch, i) => out.push(glyph(ch, (c + 0.5) * size * COLUMN_WIDTH, top + (i + 0.5) * size * LETTER_HEIGHT)));
    });
    return { glyphs: out, w: Math.max(1, columns.length) * size * COLUMN_WIDTH, h: blockH };
  }
  const lines = input.zone ? wrapLines(input.text, input.width, (line) => Array.from(line).reduce((s, ch) => s + measure(ch), 0)) : textLines(input.text);
  const widths = lines.map((line) => Array.from(line).reduce((s, ch) => s + measure(ch), 0));
  const blockW = input.zone ? Math.max(1, input.width) : Math.max(size * 0.5, ...widths);
  lines.forEach((line, row) => {
    const free = blockW - widths[row];
    let x = input.align === `center` ? free / 2 : input.align === `right` ? free : 0;
    for (const ch of Array.from(line)) {
      const w = measure(ch);
      out.push(glyph(ch, x + w / 2, (row + 0.5) * size * LINE_HEIGHT));
      x += w;
    }
  });
  return { glyphs: out, w: blockW, h: Math.max(1, lines.length) * size * LINE_HEIGHT };
}

// Applies a distortion to letters placed on a grid of a width and a height. The letters keep their own shape: each one is moved, turned, slanted or stretched.
function distort(glyphs: PlacedGlyph[], kind: WarpKind, amount: number, w: number, h: number, size: number): PlacedGlyph[] {
  const a = cleanWarpAmount(amount);
  if (a === 0 || glyphs.length === 0) return glyphs;
  const midX = w / 2;
  const midY = h / 2;
  switch (kind) {
    case `arc`: {
      // The text follows an arc of a circle whose chord is the width of the block. A positive strength is a rainbow (the ends go down), a negative one a smile.
      const sagitta = Math.max(1, Math.abs(a) * w * 0.4);
      const radius = (w * w) / 4 / (2 * sagitta) + sagitta / 2;
      return glyphs.map((g) => {
        const phi = (g.x - midX) / radius;
        // The rows above or below the middle of the block are further from or closer to the centre of the circle.
        const offset = a > 0 ? midY - g.y : g.y - midY;
        const r = radius + offset;
        if (a > 0) return { ...g, x: midX + r * Math.sin(phi), y: midY + radius - r * Math.cos(phi), rotate: r2((phi * 180) / Math.PI) };
        return { ...g, x: midX + r * Math.sin(phi), y: midY - radius + r * Math.cos(phi), rotate: r2((-phi * 180) / Math.PI) };
      });
    }
    case `wave`: {
      // The letters go up and down like a flag, and turn along the wave.
      const amplitude = a * size * 0.9;
      const cycles = 1.25;
      return glyphs.map((g) => {
        const t = w > 0 ? g.x / w : 0;
        const phase = 2 * Math.PI * cycles * t;
        const slope = w > 0 ? (amplitude * 2 * Math.PI * cycles * Math.cos(phase)) / w : 0;
        return { ...g, y: g.y + amplitude * Math.sin(phase), rotate: r2((Math.atan(slope) * 180) / Math.PI) };
      });
    }
    case `slant`: {
      // The whole text leans, as italics do: every letter is slanted and the rows lean with it.
      const angle = a * 35;
      const tan = Math.tan(rad(angle));
      return glyphs.map((g) => ({ ...g, x: g.x + (midY - g.y) * tan, skew: r2(-angle) }));
    }
    case `perspective`:
    case `bulge`: {
      // The letters are stretched from the middle of their row, more on one side (perspective) or more in the middle (bulge); the space between them follows.
      const factor = (t: number): number => (kind === `perspective` ? 1 + a * 0.6 * (2 * t - 1) : 1 + a * 0.8 * (1 - (2 * t - 1) * (2 * t - 1)));
      const widthFactor = (t: number): number => (kind === `perspective` ? factor(t) : 1 + a * 0.25 * (1 - (2 * t - 1) * (2 * t - 1)));
      // Each row is moved along by the stretched widths of its letters.
      const rows = new Map<number, PlacedGlyph[]>();
      for (const g of glyphs) rows.set(g.y, [...(rows.get(g.y) ?? []), g]);
      const placed = new Map<PlacedGlyph, PlacedGlyph>();
      for (const [, row] of rows) {
        const start = Math.min(...row.map((g) => g.x - g.w / 2));
        const end = Math.max(...row.map((g) => g.x + g.w / 2));
        let cursor = start;
        const mapped = row.map((g) => {
          const t = w > 0 ? Math.min(1, Math.max(0, g.x / w)) : 0.5;
          const sx = widthFactor(t);
          const sy = factor(t);
          const next = { ...g, x: cursor + (g.w * sx) / 2, y: g.y, sx: r2(sx), sy: r2(sy) };
          cursor += g.w * sx;
          return next;
        });
        // The row keeps its middle where it was.
        const shift = (start + end) / 2 - (start + cursor) / 2;
        for (let i = 0; i < row.length; i++) {
          const m = mapped[i];
          // A letter that gets taller grows around the middle of its row: its distance to the middle of the block is stretched too.
          placed.set(row[i], { ...m, x: m.x + shift, y: midY + (m.y - midY) * m.sy });
        }
      }
      return glyphs.map((g) => placed.get(g) ?? g);
    }
  }
}

// Returns the box of a letter once it is placed: the box of its row (as wide as the letter and as tall as the line, or as the space of a letter in a column) turned, slanted and
// stretched about its middle.
function glyphBox(g: PlacedGlyph, row: number): { x0: number; y0: number; x1: number; y1: number } {
  const hw = (g.w * g.sx) / 2;
  const hh = (row * g.sy) / 2;
  const [cos, sin] = [Math.cos(rad(g.rotate)), Math.sin(rad(g.rotate))];
  const tan = Math.tan(rad(g.skew));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [cx, cy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
    const sx = cx + cy * tan;
    xs.push(g.x + sx * cos - cy * sin);
    ys.push(g.y + sx * sin + cy * cos);
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Lays out the letters of a text with its distortion and its direction. For a text that is only as large as its letters the result is moved so that its box starts at 0,0 (the
// box of the text is the box of its letters); for a zone the letters stay in the coordinates of the zone, whose box does not change.
export function layoutWarp(input: WarpInput, measure: (ch: string) => number): WarpLayout {
  const base = grid(input, measure);
  const letters = base.glyphs.length;
  const glyphs = input.warp !== null && letters <= MAX_WARP_LETTERS ? distort(base.glyphs, input.warp, input.amount, base.w, base.h, input.size) : base.glyphs;
  if (glyphs.length === 0) return { glyphs, box: { x: 0, y: 0, w: base.w, h: base.h } };
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const g of glyphs) {
    const b = glyphBox(g, input.vertical ? input.size * LETTER_HEIGHT : input.size * LINE_HEIGHT);
    x0 = Math.min(x0, b.x0);
    y0 = Math.min(y0, b.y0);
    x1 = Math.max(x1, b.x1);
    y1 = Math.max(y1, b.y1);
  }
  if (input.zone) return { glyphs, box: { x: 0, y: 0, w: Math.max(base.w, 1), h: Math.max(base.h, 1) } };
  const moved = glyphs.map((g) => ({ ...g, x: r2(g.x - x0), y: r2(g.y - y0) }));
  return { glyphs: moved, box: { x: 0, y: 0, w: r2(Math.max(1, x1 - x0)), h: r2(Math.max(1, y1 - y0)) } };
}

// Returns the transform of a placed letter: its middle, its turn, its slant and its stretch (drawn with text-anchor middle and a central baseline).
export function glyphTransform(g: PlacedGlyph, dx: number, dy: number): string {
  const parts = [`translate(${r2(g.x + dx)} ${r2(g.y + dy)})`];
  if (g.rotate !== 0) parts.push(`rotate(${g.rotate})`);
  if (g.skew !== 0) parts.push(`skewX(${g.skew})`);
  if (g.sx !== 1 || g.sy !== 1) parts.push(`scale(${g.sx} ${g.sy})`);
  return parts.join(` `);
}
