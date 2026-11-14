// Turns an element into the path data that draws it: clean lines or a hand drawn look (roughjs), and freehand lines (perfect-freehand).
// Pure module (no DOM): it returns plain data, so the result is tested without a browser and the view writes it into the page as attributes.
import getStroke from "perfect-freehand";
import { RoughGenerator } from "roughjs/bin/generator";
import { drawnPoints } from "./curves";
import { ArrowElement, Border, DiamondElement, EllipseElement, FreedrawElement, headOf, LineElement, LineStyle, Point, RectElement, StrokedElement, TriangleElement } from "./elements";
import { arrowHeadShapes, HeadShape } from "./linear";
import { DEFAULT_NIB_ANGLE, nibPath, sprayPath, squarePath } from "./brushes";
import { isClosedStroke, tidyStroke } from "./tidy";

// One path to draw: its data, its line colour and width and its fill colour (`none` for no fill).
export interface PathPiece {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  // Opacity of the piece, from 0 to 1. Only the pieces of a fill (the colour and the hatching) are made transparent.
  opacity: number;
  // The dash pattern of an outline (stroke-dasharray), for a dashed or dotted line. Absent for a continuous line.
  dash?: string;
  // Whether the piece is the outline of a shape (as opposed to its fill), so that a shape without a border can keep its fill only.
  outline?: boolean;
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
    // The grid is the crossed hatching of roughjs.
    opts.fillStyle = el.fillStyle === `grid` ? `cross-hatch` : el.fillStyle ?? `solid`;
  }
  return opts;
}

// Returns the dash pattern of a line style at a line width: long dashes, or dots (tiny dashes with the round line caps of the drawing).
function dashOf(style: LineStyle, width: number): { dash?: string } {
  if (style === `dashed`) return { dash: `${r2(Math.max(8, width * 3.5))} ${r2(Math.max(6, width * 2.5))}` };
  if (style === `dotted`) return { dash: `0.1 ${r2(Math.max(6, width * 2.2))}` };
  return {};
}

// Turns a drawable of roughjs into pieces, one per set of operations: the outline (the colour and width of the line), the solid fill, or the hatching of a fill. The
// fill pieces take the opacity of the fill; the outline stays opaque. (The same cases as roughjs does in its own toPaths, which does not tell them apart.)
function piecesOf(drawable: ReturnType<RoughGenerator[`line`]>, fillOpacity = 1, style: LineStyle = `solid`): PathPiece[] {
  const out: PathPiece[] = [];
  const o = drawable.options;
  for (const set of drawable.sets) {
    const d = generator.opsToPath(set);
    if (d === `` || !SAFE_PATH.test(d)) continue;
    if (set.type === `path`) out.push({ d, stroke: o.stroke, strokeWidth: o.strokeWidth, fill: `none`, opacity: 1, outline: true, ...dashOf(style, o.strokeWidth) });
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

// Turns the shape of an arrow head into pieces: its open lines, and its filled polygons and discs (filled with the colour of the line).
function headPieces(shape: HeadShape, opts: Record<string, unknown>, salt: number): PathPiece[] {
  const out: PathPiece[] = [];
  const base = (opts.seed as number) + salt;
  shape.lines.forEach((l, i) => out.push(...piecesOf(generator.linearPath(l, { ...opts, seed: base + i }))));
  shape.polygons.forEach((poly, i) => out.push(...piecesOf(generator.polygon(poly, { ...opts, seed: base + 10 + i, fill: opts.stroke as string, fillStyle: `solid` }))));
  shape.circles.forEach((c, i) => out.push(...piecesOf(generator.ellipse(c.c[0], c.c[1], 2 * c.r, 2 * c.r, { ...opts, seed: base + 20 + i, fill: opts.stroke as string, fillStyle: `solid` }))));
  return out;
}

// A line of the border of a shape: how far it is from the edge of the shape (positive outwards, negative inwards), how wide it is, and whether it is the one that
// goes with the fill.
export interface Ring {
  grow: number;
  width: number;
  main: boolean;
}

// Returns the lines of the border of a shape. The thin line is half the width of the line of the shape and the thick one is 1.6 times that width, and a gap separates the lines.
export function ringsOf(border: Border | undefined, width: number): Ring[] {
  if (border === undefined) return [{ grow: 0, width, main: true }];
  const thin = Math.max(1.5, width * 0.5);
  const thick = width * 1.6;
  const gap = Math.max(4, width * 1.2);
  switch (border) {
    case `none`:
      return [{ grow: 0, width: 0, main: true }];
    case `double`:
      return [{ grow: 0, width: thick, main: true }, { grow: thick / 2 + gap + thin / 2, width: thin, main: false }];
    case `double-reverse`:
      return [{ grow: 0, width: thin, main: true }, { grow: thin / 2 + gap + thick / 2, width: thick, main: false }];
    case `frame`:
      return [{ grow: 0, width: thick, main: true }, { grow: thick / 2 + gap + thin / 2, width: thin, main: false }, { grow: -(thick / 2 + gap + thin / 2), width: thin, main: false }];
    case `mat`: {
      const band = width * 2.6;
      return [{ grow: 0, width: band, main: true }, { grow: -(band / 2 + gap + thin / 2), width: thin, main: false }];
    }
  }
}

// Returns the data of a rectangle with rounded corners as a path of lines and curves (the radius is limited to half of the shortest side).
function roundedRectPath(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const [x2, y2] = [x + w, y + h];
  return `M${r2(x + r)},${r2(y)} L${r2(x2 - r)},${r2(y)} Q${r2(x2)},${r2(y)} ${r2(x2)},${r2(y + r)} L${r2(x2)},${r2(y2 - r)} Q${r2(x2)},${r2(y2)} ${r2(x2 - r)},${r2(y2)} L${r2(x + r)},${r2(y2)} Q${r2(x)},${r2(y2)} ${r2(x)},${r2(y2 - r)} L${r2(x)},${r2(y + r)} Q${r2(x)},${r2(y)} ${r2(x + r)},${r2(y)} Z`;
}

// Returns the drawable of a shape grown (or shrunk) by a distance on every side, or null when nothing is left of it.
function grownShape(el: RectElement | EllipseElement | DiamondElement | TriangleElement, grow: number, opts: Record<string, unknown>): ReturnType<RoughGenerator[`rectangle`]> | null {
  if (el.type === `rect`) {
    const [x, y, w, h] = [el.x - grow, el.y - grow, el.width + 2 * grow, el.height + 2 * grow];
    if (w < 2 || h < 2) return null;
    const radius = el.radius === undefined ? 0 : Math.max(0, el.radius + grow);
    return radius > 0 ? generator.path(roundedRectPath(x, y, w, h, radius), opts) : generator.rectangle(x, y, w, h, opts);
  }
  if (el.type === `ellipse`) {
    const [rx, ry] = [el.rx + grow, el.ry + grow];
    return rx < 1 || ry < 1 ? null : generator.ellipse(el.cx, el.cy, 2 * rx, 2 * ry, opts);
  }
  if (el.type === `triangle`) {
    // An isosceles triangle: its sides are moved by the distance along their normal, which scales it about its centre (the middle of its inscribed circle).
    const [apex, left, right]: Point[] = [[el.x + el.width / 2, el.y], [el.x, el.y + el.height], [el.x + el.width, el.y + el.height]];
    const sides = [Math.hypot(left[0] - right[0], left[1] - right[1]), Math.hypot(apex[0] - right[0], apex[1] - right[1]), Math.hypot(apex[0] - left[0], apex[1] - left[1])];
    const perimeter = sides[0] + sides[1] + sides[2];
    const centre: Point = [(sides[0] * apex[0] + sides[1] * left[0] + sides[2] * right[0]) / perimeter, (sides[0] * apex[1] + sides[1] * left[1] + sides[2] * right[1]) / perimeter];
    const radius = (el.width * el.height) / perimeter;
    const k = (radius + grow) / radius;
    if (k <= 0.05) return null;
    const scale = (p: Point): Point => [centre[0] + (p[0] - centre[0]) * k, centre[1] + (p[1] - centre[1]) * k];
    return generator.polygon([scale(apex), scale(right), scale(left)], opts);
  }
  // A diamond: its sides are moved by the distance along their normal, which grows both half diagonals by the same factor.
  const a = el.width / 2;
  const b = el.height / 2;
  const k = 1 + grow * Math.sqrt(1 / (a * a) + 1 / (b * b));
  if (k <= 0.05) return null;
  const [cx, cy] = [el.x + a, el.y + b];
  const poly: Point[] = [[cx, cy - b * k], [cx + a * k, cy], [cx, cy + b * k], [cx - a * k, cy]];
  return generator.polygon(poly, opts);
}

// Computes the pieces of a rectangle, an ellipse or a diamond: the fill with the main line of its border, then the other lines of the border (none for a simple border).
function shapePieces(el: RectElement | EllipseElement | DiamondElement | TriangleElement, opts: Record<string, unknown>): PathPiece[] {
  const out: PathPiece[] = [];
  const style = el.lineStyle ?? `solid`;
  for (const ring of ringsOf(el.border, el.strokeWidth)) {
    // The main line carries the fill. Without a border (width 0) only the fill is drawn.
    const ringOpts: Record<string, unknown> = ring.main ? { ...opts, strokeWidth: Math.max(ring.width, 0.01) } : { ...opts, strokeWidth: ring.width, fill: undefined, seed: (opts.seed as number) + 31 };
    const drawable = grownShape(el, ring.grow, ringOpts);
    if (!drawable) continue;
    const pieces = piecesOf(drawable, el.fillOpacity, style);
    out.push(...(ring.main && ring.width === 0 ? pieces.filter((p) => p.outline !== true) : pieces));
  }
  return out;
}

// Returns the points of a polyline again, evenly spaced along it (about `step` apart), the first and the last point kept.
export function resample(points: Point[], step: number): Point[] {
  if (points.length < 2) return points.map((p): Point => [p[0], p[1]]);
  const out: Point[] = [[points[0][0], points[0][1]]];
  let carried = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let at = step - carried;
    while (at <= length) {
      out.push([a[0] + ((b[0] - a[0]) * at) / length, a[1] + ((b[1] - a[1]) * at) / length]);
      at += step;
    }
    carried = length - (at - step);
  }
  const last = points[points.length - 1];
  const end = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 0.01) out.push([last[0], last[1]]);
  return out;
}

// Moves the points of a polyline a little to the side, smoothly and the same way every time for a seed, so that a tapered line has the hand drawn look too. The amplitude grows with
// the roughness of the element; the two ends stay where they are.
export function wobble(points: Point[], roughness: number, seed: number): Point[] {
  if (roughness <= 0 || points.length < 3) return points;
  const a = (((seed * 9301 + 49297) % 233280) / 233280) * Math.PI * 2;
  const b = (((seed * 4096 + 150889) % 714025) / 714025) * Math.PI * 2;
  const out: Point[] = [];
  let run = 0;
  points.forEach((p, i) => {
    if (i > 0) run += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]);
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;
    const edge = Math.min(1, i / 4, (points.length - 1 - i) / 4);
    const shift = (Math.sin(run / 23 + a) + 0.5 * Math.sin(run / 9 + b)) * roughness * 0.9 * edge;
    out.push([p[0] - ((next[1] - prev[1]) / len) * shift, p[1] + ((next[0] - prev[0]) / len) * shift]);
  });
  return out;
}

// Returns the piece that draws a tapered line or arrow: a filled outline (made with perfect-freehand) as wide as the line at its start and ending in a point at its end, or at the
// end that has the head of an arrow, the point being the tip. The taper goes over the last part of the line: all of it for a taper of 1, half of it for 0.5.
function taperedPiece(el: LineElement | ArrowElement): PathPiece[] {
  let pts = drawnPoints(el);
  if (el.type === `arrow` && headOf(el, `end`) === `none` && headOf(el, `start`) !== `none`) pts = [...pts].reverse();
  const dense = wobble(resample(pts, 3), el.roughness ?? 0, el.seed ?? 1);
  let length = 0;
  for (let i = 0; i + 1 < dense.length; i++) length += Math.hypot(dense[i + 1][0] - dense[i][0], dense[i + 1][1] - dense[i][1]);
  if (dense.length < 2 || length <= 0) return [];
  const outline = getStroke(dense, { size: el.strokeWidth, thinning: 0, smoothing: 0.5, streamline: 0, simulatePressure: false, last: true, start: { cap: true }, end: { cap: false, taper: Math.max(1, length * (el.taper ?? 0)) } });
  const d = pathFromOutline(outline);
  return SAFE_PATH.test(d) && d !== `` ? [{ d, stroke: `none`, strokeWidth: 0, fill: el.stroke, opacity: 1 }] : [];
}

// Returns the pieces of the stroke of a pen: what the brush of the stroke leaves along the points. The round brush is the pen as it always was (a stroke that is thicker where the
// hand is slower); the others have a constant width. The flow of a brush that has a body is its opacity, and the flow of the spray is how many dots it makes.
function brushPieces(el: FreedrawElement, pts: Point[]): PathPiece[] {
  const flow = el.flow ?? 1;
  const solid = (d: string): PathPiece[] => (d !== `` && SAFE_PATH.test(d) ? [{ d, stroke: el.stroke, strokeWidth: Math.max(0.5, el.strokeWidth * 0.1), fill: el.stroke, opacity: flow }] : []);
  if (el.brush === `square`) return solid(squarePath(pts, el.strokeWidth * 1.6));
  if (el.brush === `nib`) return solid(nibPath(pts, el.strokeWidth * 3, el.nibAngle ?? DEFAULT_NIB_ANGLE));
  if (el.brush === `aerosol`) {
    const spray = sprayPath(pts, el.strokeWidth * 2.2, flow, el.seed ?? 1);
    const dot = (d: string, width: number): PathPiece[] => (d !== `` && SAFE_PATH.test(d) ? [{ d, stroke: el.stroke, strokeWidth: width, fill: `none`, opacity: 0.85 }] : []);
    return [...dot(spray.small, Math.max(0.9, el.strokeWidth * 0.2)), ...dot(spray.large, Math.max(1.6, el.strokeWidth * 0.4))];
  }
  const closedLook = (el.regularity ?? 0) >= 5;
  const outline = getStroke(pts, { size: el.strokeWidth * 1.6, thinning: closedLook ? 0 : 0.5, smoothing: 0.5, streamline: closedLook ? 0 : 0.5 });
  const d = pathFromOutline(outline);
  return SAFE_PATH.test(d) && d !== `` ? [{ d, stroke: `none`, strokeWidth: 0, fill: el.stroke, opacity: flow }] : [];
}

// Computes the paths of an element.
function compute(el: StrokedElement): ElementPaths {
  const opts = roughOptions(el);
  if (el.type === `rect`) return { pieces: shapePieces(el, opts), transform: turn(el.angle, el.x + el.width / 2, el.y + el.height / 2) };
  if (el.type === `ellipse`) return { pieces: shapePieces(el, opts), transform: turn(el.angle, el.cx, el.cy) };
  if (el.type === `diamond` || el.type === `triangle`) return { pieces: shapePieces(el, opts), transform: turn(el.angle, el.x + el.width / 2, el.y + el.height / 2) };
  if (el.type === `freedraw`) {
    // The stroke as tidied by its regularity (as drawn when it is 0). A stroke that comes back to its start can have a fill, drawn under the line.
    const pts = tidyStroke(el.points, el.regularity ?? 0, el.strokeWidth);
    const pieces: PathPiece[] = [];
    if (el.fill !== undefined && isClosedStroke(el.points, el.strokeWidth) && pts.length >= 3) {
      const poly = resample(pts, 4);
      pieces.push(...piecesOf(generator.polygon(poly, { ...opts, strokeWidth: 0.01, disableMultiStroke: true }), el.fillOpacity, `solid`).filter((p) => p.outline !== true));
    }
    pieces.push(...brushPieces(el, pts));
    return { pieces, transform: null };
  }
  // A line or an arrow: straight segments, or a smooth curve through the points when the edges are rounded.
  const drawable = el.rounded === true && el.points.length >= 3 ? generator.curve(el.points, opts) : generator.linearPath(el.points, opts);
  const pieces = (el.taper ?? 0) > 0 ? taperedPiece(el) : piecesOf(drawable, 1, el.lineStyle ?? `solid`);
  if (el.type === `arrow`) {
    const heads = arrowHeadShapes(el);
    if (heads) {
      pieces.push(...headPieces(heads.start, opts, 1), ...headPieces(heads.end, opts, 2));
    }
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
