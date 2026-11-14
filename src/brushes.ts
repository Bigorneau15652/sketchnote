// The brushes of the pen: the shapes they leave on the page. The round brush is the pen as it always was (see shape-paths.ts); the other brushes are made here as data of
// paths. Pure module: no access to the page.
import type { Point } from "./elements";

// The brushes. The round one is the default and is not stored in a file.
export const BRUSH_KINDS = [`round`, `aerosol`, `square`, `nib`] as const;
export type BrushKind = (typeof BRUSH_KINDS)[number];

// The flow goes from a light stroke (MIN_FLOW) to a full one (1, the default, which is not stored).
export const MIN_FLOW = 0.05;
export const DEFAULT_FLOW = 1;
// The angle of the nib in degrees, from 0 to 180, and its default.
export const MAX_NIB_ANGLE = 180;
export const DEFAULT_NIB_ANGLE = 45;
// The most dots that a spray makes, so that a long stroke stays light to draw.
const MAX_DOTS = 6000;

const r2 = (n: number): number => Math.round(n * 100) / 100;

// Tells whether a value is a brush.
export function isBrush(value: unknown): value is BrushKind {
  return typeof value === `string` && (BRUSH_KINDS as readonly string[]).includes(value);
}

// Brings a flow into its range.
export function cleanFlow(value: number): number {
  return Math.min(1, Math.max(MIN_FLOW, Math.round(value * 100) / 100));
}

// Returns the points again, evenly spaced along the polyline (about `step` apart, the first and the last point kept).
export function spaced(points: Point[], step: number): Point[] {
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

// Returns the signed area of a polygon: positive when its points turn one way, negative when they turn the other way.
function area(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

// Returns the data of a closed polygon. Every polygon of a brush turns the same way, so that the shapes that overlap add up instead of cancelling out (the fill rule of the page
// counts the turns).
function polygonPath(poly: Point[]): string {
  const ordered = area(poly) < 0 ? [...poly].reverse() : poly;
  return `M${ordered.map((p) => `${r2(p[0])},${r2(p[1])}`).join(` L`)} Z`;
}

// Returns the data of the square brush: a square of the given side, with its sides along the page, stamped along the stroke (with no gap between two stamps).
export function squarePath(points: Point[], side: number): string {
  if (points.length === 0) return ``;
  const h = side / 2;
  const pts = points.length === 1 ? points : spaced(points, Math.max(0.8, side / 3));
  if (pts.length === 1) return polygonPath([[pts[0][0] - h, pts[0][1] - h], [pts[0][0] + h, pts[0][1] - h], [pts[0][0] + h, pts[0][1] + h], [pts[0][0] - h, pts[0][1] + h]]);
  // The stroke is the surface swept by the square: between two positions, the polygon around the two squares (the squares of the two ends are part of it).
  const sweeps: string[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const corners: Point[] = [[-h, -h], [h, -h], [h, h], [-h, h]];
    const cloud: Point[] = [];
    for (const c of corners) cloud.push([a[0] + c[0], a[1] + c[1]], [b[0] + c[0], b[1] + c[1]]);
    sweeps.push(polygonPath(hull(cloud)));
  }
  return sweeps.join(` `);
}

// Returns the convex hull of points (Andrew's monotone chain).
function hull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// Returns the data of the nib: a flat tip, a line of the given length turned by an angle (in degrees, 0 is horizontal), that is dragged along the stroke. The stroke is thick
// across the direction of the tip and thin along it, like a pen of calligraphy.
export function nibPath(points: Point[], length: number, angleDeg: number): string {
  if (points.length === 0) return ``;
  const a = (angleDeg * Math.PI) / 180;
  const d: Point = [(Math.cos(a) * length) / 2, (Math.sin(a) * length) / 2];
  const pts = points.length === 1 ? points : spaced(points, Math.max(0.8, length / 6));
  const polys: string[] = [];
  // A single stamp makes a short line of the tip.
  if (pts.length === 1) return polygonPath([[pts[0][0] - d[0], pts[0][1] - d[1]], [pts[0][0] + d[0], pts[0][1] + d[1]], [pts[0][0] + d[0] + 0.5, pts[0][1] + d[1] + 0.5], [pts[0][0] - d[0] + 0.5, pts[0][1] - d[1] + 0.5]]);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [p, q] = [pts[i], pts[i + 1]];
    polys.push(polygonPath([[p[0] - d[0], p[1] - d[1]], [p[0] + d[0], p[1] + d[1]], [q[0] + d[0], q[1] + d[1]], [q[0] - d[0], q[1] - d[1]]]));
  }
  return polys.join(` `);
}

// Returns a repeatable random generator for a seed.
function random(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Returns the data of the spray: tiny dots scattered around the stroke, in a disc of the given radius. The flow gives how many there are. A dot is a segment of no length that the
// round ends of the line make round, so the data only has moves and lines. Two sizes of dots make it grainy.
export function sprayPath(points: Point[], radius: number, flow: number, seed: number): { small: string; large: string } {
  if (points.length === 0) return { small: ``, large: `` };
  const rnd = random(seed);
  let length = 0;
  for (let i = 0; i + 1 < points.length; i++) length += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  const perStep = Math.max(1, Math.round(flow * 5));
  // The step grows for a very long stroke, so that the number of dots stays under the limit.
  const step = Math.max(radius * 0.35, 1.5, (length * perStep) / MAX_DOTS);
  const centres = points.length === 1 ? points : spaced(points, step);
  const small: string[] = [];
  const large: string[] = [];
  for (const c of centres) {
    for (let k = 0; k < perStep; k++) {
      const angle = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * radius;
      const x = r2(c[0] + Math.cos(angle) * dist);
      const y = r2(c[1] + Math.sin(angle) * dist);
      (rnd() < 0.25 ? large : small).push(`M${x},${y} L${r2(x + 0.01)},${y}`);
    }
  }
  return { small: small.join(` `), large: large.join(` `) };
}
