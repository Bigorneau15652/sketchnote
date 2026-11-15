// Reads an SVG drawing (a Lucide icon of Obsidian, or a file of the user) into shapes that the plugin can draw in its hand drawn look: the data of each path, and whether it has a
// line and a fill. Only the shapes are kept (paths, circles, ellipses, rectangles, lines, polylines and polygons): the colours of the file are not (the drawing takes the colour
// of its element), and what the plugin cannot draw (gradients, filters, images, texts, transformations) is left out and reported. The text of the file is read here, with no
// XML parser of the page. Pure module.
import { ellipsePath, isSafePath, pathToSubpaths, rectPath } from "./svg-path";

// A shape of an icon.
export interface IconShape {
  // The data of its path, in the coordinates of the view box of the icon.
  d: string;
  // Whether the shape has a fill (the file had one), and whether it has a line.
  fill: boolean;
  stroke: boolean;
  // Whether the shape is closed (a fill can be given to it).
  closed: boolean;
  // What a circle, an ellipse or a rectangle was, so that it can become a circle, an ellipse or a rectangle again.
  prim?: { kind: `ellipse`; cx: number; cy: number; rx: number; ry: number } | { kind: `rect`; x: number; y: number; w: number; h: number; r: number };
}

// What could not be drawn, so that the user can be told.
export type IconWarning = `transform` | `gradient` | `text` | `image` | `style` | `use` | `filter` | `clip` | `unknown`;

export interface IconData {
  // The view box: where the drawing starts, and its width and height.
  vb: [number, number, number, number];
  shapes: IconShape[];
  warnings: IconWarning[];
}

// The most shapes, and the longest text, that are read.
export const MAX_ICON_SHAPES = 400;
export const MAX_ICON_TEXT = 300000;

interface Tag {
  name: string;
  attrs: Record<string, string>;
  open: boolean;
  close: boolean;
}

// Splits the text of an SVG file into its tags (comments, declarations and the text between the tags are left out).
function tags(text: string): Tag[] {
  const out: Tag[] = [];
  const clean = text.replace(/<!--[\s\S]*?-->/g, ``).replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ``).replace(/<\?[\s\S]*?\?>/g, ``).replace(/<!DOCTYPE[\s\S]*?>/gi, ``);
  // The quotes of the attributes are written with their codes, so that this file holds no quote character.
  const [dq, sq] = [String.fromCharCode(34), String.fromCharCode(39)];
  const value = `(?:${dq}[^${dq}]*${dq}|${sq}[^${sq}]*${sq})`;
  const re = new RegExp(`<\\s*(\\/?)\\s*([A-Za-z][\\w:.-]*)((?:\\s+[\\w:.-]+\\s*=\\s*${value})*)\\s*(\\/?)\\s*>`, `g`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const attrs: Record<string, string> = {};
    const are = new RegExp(`([\\w:.-]+)\\s*=\\s*(?:${dq}([^${dq}]*)${dq}|${sq}([^${sq}]*)${sq})`, `g`);
    let a: RegExpExecArray | null;
    while ((a = are.exec(m[3])) !== null) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? ``;
    const name = m[2].toLowerCase().replace(/^svg:/, ``);
    out.push({ name, attrs, open: m[1] === ``, close: m[1] === `/` || m[4] === `/` });
  }
  return out;
}

// Returns the properties of a style attribute (fill: red; stroke: none) as a record.
function styleOf(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const part of style.split(`;`)) {
    const i = part.indexOf(`:`);
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

// Reads a number written with an optional unit (24, 24px).
function num(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

// Reads the points of a polyline or a polygon.
function pointsOf(value: string | undefined): [number, number][] | null {
  if (!value) return null;
  const nums = (value.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  if (nums.length < 4) return null;
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

// What a painted property says: none, or a colour (a gradient or a pattern counts as a colour and is reported).
function paint(value: string | undefined, inherited: boolean, warn: (w: IconWarning) => void): boolean {
  if (value === undefined || value === ``) return inherited;
  const v = value.trim().toLowerCase();
  if (v === `none` || v === `transparent`) return false;
  if (v.startsWith(`url(`)) warn(`gradient`);
  return true;
}

const SKIPPED: Record<string, IconWarning | null> = {
  defs: null,
  title: null,
  desc: null,
  metadata: null,
  clippath: `clip`,
  mask: `clip`,
  filter: `filter`,
  lineargradient: `gradient`,
  radialgradient: `gradient`,
  pattern: `gradient`,
  symbol: `use`,
  use: `use`,
  text: `text`,
  tspan: `text`,
  image: `image`,
  foreignobject: `image`,
  style: `style`,
  script: null,
};

// Reads the text of an SVG file. Returns null when there is no svg in it.
export function parseIconSvg(text: string): IconData | null {
  if (typeof text !== `string` || text.length > MAX_ICON_TEXT) return null;
  const list = tags(text);
  const root = list.find((t) => t.name === `svg` && t.open);
  if (!root) return null;
  const warnings = new Set<IconWarning>();
  const warn = (w: IconWarning): void => void warnings.add(w);
  // The view box: the one of the file, or its width and height, or the usual 24 by 24 of icons.
  let vb: [number, number, number, number] = [0, 0, 24, 24];
  const box = (root.attrs.viewbox ?? ``).trim().split(/[\s,]+/).map(Number);
  if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) vb = [box[0], box[1], box[2], box[3]];
  else if (num(root.attrs.width) > 0 && num(root.attrs.height) > 0) vb = [0, 0, num(root.attrs.width), num(root.attrs.height)];
  const shapes: IconShape[] = [];
  // The stack of what the groups give to what they hold: whether the fill and the line exist.
  type Inherit = { fill: boolean; stroke: boolean };
  const stack: Inherit[] = [];
  let skipDepth = 0;
  const parent = (): Inherit => stack[stack.length - 1] ?? { fill: true, stroke: false };
  const own = (t: Tag): Inherit => {
    const st = styleOf(t.attrs.style);
    const inh = parent();
    return { fill: paint(st.fill ?? t.attrs.fill, inh.fill, warn), stroke: paint(st.stroke ?? t.attrs.stroke, inh.stroke, warn) };
  };
  const push = (shape: Omit<IconShape, `fill` | `stroke`>, p: Inherit): void => {
    if (shapes.length >= MAX_ICON_SHAPES) return;
    if (!p.fill && !p.stroke) return;
    if (!isSafePath(shape.d)) return;
    shapes.push({ ...shape, fill: p.fill, stroke: p.stroke });
  };
  const closedOf = (d: string): boolean => (pathToSubpaths(d) ?? []).some((s) => s.closed);
  for (const t of list) {
    if (t.name === `svg` && t === root) {
      if (t.open && !t.close) stack.push(own(t));
      continue;
    }
    if (skipDepth > 0) {
      if (t.open && !t.close) skipDepth++;
      else if (!t.open && t.close) skipDepth--;
      continue;
    }
    if (t.name in SKIPPED) {
      const w = SKIPPED[t.name];
      if (w) warn(w);
      if (t.open && !t.close) skipDepth = 1;
      continue;
    }
    if (!t.open) {
      // A closing tag ends a group.
      if (t.name === `g` || t.name === `svg` || t.name === `a`) stack.pop();
      continue;
    }
    if (t.attrs.transform && !/^\s*(translate\(\s*0[\s,]*0?\s*\)|none)?\s*$/i.test(t.attrs.transform)) warn(`transform`);
    if (t.name === `g` || t.name === `a` || t.name === `svg`) {
      if (!t.close) stack.push(own(t));
      continue;
    }
    const p = own(t);
    const a = t.attrs;
    if (t.name === `path`) {
      const d = a.d ?? ``;
      if (d.trim() !== ``) push({ d: d.trim().replace(/\s+/g, ` `), closed: closedOf(d) }, p);
    } else if (t.name === `circle` || t.name === `ellipse`) {
      const [cx, cy] = [num(a.cx), num(a.cy)];
      const [rx, ry] = t.name === `circle` ? [num(a.r), num(a.r)] : [num(a.rx), num(a.ry)];
      if (rx > 0 && ry > 0) push({ d: ellipsePath(cx, cy, rx, ry), closed: true, prim: { kind: `ellipse`, cx, cy, rx, ry } }, p);
    } else if (t.name === `rect`) {
      const [x, y, w, h] = [num(a.x), num(a.y), num(a.width), num(a.height)];
      const rx = a.rx !== undefined ? num(a.rx) : a.ry !== undefined ? num(a.ry) : 0;
      const ry = a.ry !== undefined ? num(a.ry) : rx;
      if (w > 0 && h > 0) push({ d: rectPath(x, y, w, h, rx, ry), closed: true, prim: { kind: `rect`, x, y, w, h, r: Math.min(rx, ry) } }, p);
    } else if (t.name === `line`) {
      const [x1, y1, x2, y2] = [num(a.x1), num(a.y1), num(a.x2), num(a.y2)];
      push({ d: `M${x1} ${y1}L${x2} ${y2}`, closed: false }, p);
    } else if (t.name === `polyline` || t.name === `polygon`) {
      const pts = pointsOf(a.points);
      if (pts) push({ d: `M${pts.map((q) => `${q[0]} ${q[1]}`).join(`L`)}${t.name === `polygon` ? `Z` : ``}`, closed: t.name === `polygon` }, p);
    } else {
      warn(`unknown`);
    }
  }
  if (shapes.length === 0) return warnings.size > 0 ? { vb, shapes, warnings: [...warnings] } : null;
  return { vb, shapes, warnings: [...warnings] };
}

// Tells how large an icon is once stored: the length of the data of its shapes.
export function iconWeight(shapes: IconShape[]): number {
  return shapes.reduce((s, q) => s + q.d.length + 12, 0);
}
