// Turns an element into the path data that draws it: clean lines or a hand drawn look (roughjs), and freehand lines (perfect-freehand).
// Pure module (no DOM): it returns plain data, so the result is tested without a browser and the view writes it into the page as attributes.
import getStroke from "perfect-freehand";
import { RoughGenerator } from "roughjs/bin/generator";
import { arrowHeadPoints, Point, StrokedElement } from "./elements";

// One path to draw: its data, its line colour and width and its fill colour (`none` for no fill).
export interface PathPiece {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  // Opacity of the piece, from 0 to 1. Only the pieces of a fill (the colour and the hatching) are made transparent.
  opacity: number;
}

// What it takes to draw an element: the paths, and an SVG transform (a rotation) when the element is turned.
export interface ElementPaths {
  pieces: PathPiece[];
  transform: string | null;
}

// Path commands and numbers only. Anything else in a generated path is refused, so that nothing but a drawing can come out of the libraries.
const SAFE_PATH = /^[MLCQTZmlcqtz0-9eE.,\s+-]*$/;

const generator = new RoughGenerator();
const cache = new WeakMap<StrokedElement, ElementPaths>();

// Rounds to two decimals for short path data.
const r2 = (n: number): number => Math.round(n * 100) / 100;

// Returns the options of the hand drawn look for an element.
function roughOptions(el: StrokedElement): Record<string, unknown> {
  const roughness = el.roughness ?? 0;
  const opts: Record<string, unknown> = {
    stroke: el.stroke,
    strokeWidth: el.strokeWidth,
    roughness,
    seed: el.seed ?? 1,
    disableMultiStroke: roughness === 0,
    hachureGap: Math.max(6, el.strokeWidth * 3.5),
    fillWeight: Math.max(1, el.strokeWidth / 2),
  };
  if (`fill` in el && el.fill !== undefined) {
    opts.fill = el.fill;
    opts.fillStyle = el.fillStyle ?? `solid`;
  }
  return opts;
}

// Turns a drawable of roughjs into pieces, one per set of operations: the outline (the colour and width of the line), the solid fill, or the hatching of a fill. The
// fill pieces take the opacity of the fill; the outline stays opaque. (The same cases as roughjs does in its own toPaths, which does not tell them apart.)
function piecesOf(drawable: ReturnType<RoughGenerator[`line`]>, fillOpacity = 1): PathPiece[] {
  const out: PathPiece[] = [];
  const o = drawable.options;
  for (const set of drawable.sets) {
    const d = generator.opsToPath(set);
    if (d === `` || !SAFE_PATH.test(d)) continue;
    if (set.type === `path`) out.push({ d, stroke: o.stroke, strokeWidth: o.strokeWidth, fill: `none`, opacity: 1 });
    else if (set.type === `fillPath`) out.push({ d, stroke: `none`, strokeWidth: 0, fill: o.fill || `none`, opacity: fillOpacity });
    else if (set.type === `fillSketch`) out.push({ d, stroke: o.fill || `none`, strokeWidth: o.fillWeight < 0 ? o.strokeWidth / 2 : o.fillWeight, fill: `none`, opacity: fillOpacity });
  }
  return out;
}

// Turns the outline given by perfect-freehand into the data of a smooth closed path.
function pathFromOutline(points: number[][]): string {
  const len = points.length;
  if (len < 4) return ``;
  const avg = (a: number, b: number): number => (a + b) / 2;
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let d = `M${r2(a[0])},${r2(a[1])} Q${r2(b[0])},${r2(b[1])} ${r2(avg(b[0], c[0]))},${r2(avg(b[1], c[1]))} T`;
  for (let i = 2; i < len - 1; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${r2(avg(a[0], b[0]))},${r2(avg(a[1], b[1]))} `;
  }
  return `${d}Z`;
}

// Returns the rotation of an element as an SVG transform, or null when it is not turned.
function turn(angle: number | undefined, cx: number, cy: number): string | null {
  return angle ? `rotate(${r2(angle)} ${r2(cx)} ${r2(cy)})` : null;
}

// Computes the paths of an element.
function compute(el: StrokedElement): ElementPaths {
  const opts = roughOptions(el);
  if (el.type === `rect`) {
    return { pieces: piecesOf(generator.rectangle(el.x, el.y, el.width, el.height, opts), el.fillOpacity), transform: turn(el.angle, el.x + el.width / 2, el.y + el.height / 2) };
  }
  if (el.type === `ellipse`) {
    return { pieces: piecesOf(generator.ellipse(el.cx, el.cy, 2 * el.rx, 2 * el.ry, opts), el.fillOpacity), transform: turn(el.angle, el.cx, el.cy) };
  }
  if (el.type === `diamond`) {
    const { x, y, width: w, height: h } = el;
    const poly: Point[] = [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
    return { pieces: piecesOf(generator.polygon(poly, opts), el.fillOpacity), transform: turn(el.angle, x + w / 2, y + h / 2) };
  }
  if (el.type === `freedraw`) {
    const outline = getStroke(el.points, { size: el.strokeWidth * 1.6, thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
    const d = pathFromOutline(outline);
    return { pieces: SAFE_PATH.test(d) && d !== `` ? [{ d, stroke: `none`, strokeWidth: 0, fill: el.stroke, opacity: 1 }] : [], transform: null };
  }
  const pieces = piecesOf(generator.linearPath(el.points, opts));
  if (el.type === `arrow`) {
    const head = arrowHeadPoints(el.points, el.strokeWidth);
    if (head) pieces.push(...piecesOf(generator.linearPath(head, { ...opts, seed: (el.seed ?? 1) + 1 })));
  }
  return { pieces, transform: null };
}

// Returns the paths of an element. The result is kept for as long as the element object lives, so a page is not computed again at every redraw.
export function elementPaths(el: StrokedElement): ElementPaths {
  const known = cache.get(el);
  if (known) return known;
  const made = compute(el);
  cache.set(el, made);
  return made;
}
