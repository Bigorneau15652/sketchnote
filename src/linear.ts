// Lines and arrows as lists of free points, with the rules of the line editor of Excalidraw: a handle on every point, a handle in the middle of every segment that
// creates a new point when it is dragged, free ends (no box around the line), rounded edges, and the shapes of the arrow heads. Pure module.
import type { ArrowElement, Head, Point, PointsElement, SketchElement } from "./elements";
import { hasPoints, headOf } from "./elements";
import { curveSamples, drawnPoints, isRounded } from "./curves";
import { distToSegment } from "./geometry";

export { curveSamples, drawnPoints, isRounded };

const r2 = (n: number): number => Math.round(n * 100) / 100;

// Returns the middle of a segment.
export function midpointOf(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

// Returns the middle handles that are shown: the segment number and the position of each handle. A segment too short to hold its handle next to its two points has none.
export function visibleMidpoints(points: Point[], radius: number): { segment: number; pos: Point }[] {
  const out: { segment: number; pos: Point }[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    if (Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]) < radius * 4) continue;
    out.push({ segment: i, pos: midpointOf(points[i], points[i + 1]) });
  }
  return out;
}

// Returns the index of the point that is under a position, or -1. The radius is in page units.
export function pointIndexAt(points: Point[], p: Point, radius: number): number {
  let best = -1;
  let bestDist = radius;
  points.forEach((q, i) => {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

// Returns the number of the segment whose middle handle is under a position, or -1 (the segment i goes from point i to point i + 1). A segment too short to hold its
// handle next to its two points has no middle handle.
export function midpointIndexAt(points: Point[], p: Point, radius: number): number {
  for (const m of visibleMidpoints(points, radius)) if (Math.hypot(p[0] - m.pos[0], p[1] - m.pos[1]) <= radius) return m.segment;
  return -1;
}

// Returns the same kind of element with other points.
function withPoints<T extends PointsElement>(el: T, points: Point[]): T {
  return { ...el, points };
}

// Returns the line with a point moved to a position.
export function movePointTo<T extends PointsElement>(el: T, index: number, p: Point): T {
  if (index < 0 || index >= el.points.length) return el;
  return withPoints(el, el.points.map((q, i): Point => (i === index ? [r2(p[0]), r2(p[1])] : q)));
}

// Returns the line with a new point at the given place in the list (the new point has that index).
export function insertPointAt<T extends PointsElement>(el: T, index: number, p: Point): T {
  const i = Math.max(0, Math.min(el.points.length, index));
  return withPoints(el, [...el.points.slice(0, i), [r2(p[0]), r2(p[1])], ...el.points.slice(i)]);
}

// Returns the line without one point, or null when it would have fewer than two points left.
export function removePointAt<T extends PointsElement>(el: T, index: number): T | null {
  if (el.points.length <= 2 || index < 0 || index >= el.points.length) return null;
  return withPoints(el, el.points.filter((_, i) => i !== index));
}

// Returns the point of a line that is the closest to a position: the number of the segment, the point on it and the distance. The segments are the straight ones between the
// control points.
export function nearestOnLine(el: PointsElement, p: Point): { segment: number; point: Point; dist: number } | null {
  let best: { segment: number; point: Point; dist: number } | null = null;
  for (let i = 0; i + 1 < el.points.length; i++) {
    const a = el.points[i];
    const b = el.points[i + 1];
    const dist = distToSegment(p, a, b);
    if (best === null || dist < best.dist) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
      best = { segment: i, point: [a[0] + t * dx, a[1] + t * dy], dist };
    }
  }
  return best;
}

// Brings a position to the nearest multiple of 15 degrees around an anchor point, keeping its distance (what the Shift key does when a point is moved).
export function lockAngle(anchor: Point, p: Point): Point {
  const dx = p[0] - anchor[0];
  const dy = p[1] - anchor[1];
  const len = Math.hypot(dx, dy);
  const step = (15 * Math.PI) / 180;
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  return [anchor[0] + len * Math.cos(a), anchor[1] + len * Math.sin(a)];
}

// Returns the size of an arrow head for a line width.
export function headSize(strokeWidth: number): number {
  return Math.max(14, strokeWidth * 5);
}

// The pieces that draw an arrow head: open polylines, filled polygons and filled discs.
export interface HeadShape {
  lines: Point[][];
  polygons: Point[][];
  circles: { c: Point; r: number }[];
}

// Returns the shape of a head. `tip` is the end of the line, `dir` the unit direction that points outwards, from the line to the tip.
export function headShape(kind: Head, tip: Point, dir: Point, size: number): HeadShape {
  const none: HeadShape = { lines: [], polygons: [], circles: [] };
  if (kind === `none`) return none;
  const nx = -dir[1];
  const ny = dir[0];
  const back = (d: number, w: number): Point => [tip[0] - dir[0] * d + nx * w, tip[1] - dir[1] * d + ny * w];
  const spread = Math.tan((24 * Math.PI) / 180);
  switch (kind) {
    case `arrow`:
      return { lines: [[back(size, size * spread), tip, back(size, -size * spread)]], polygons: [], circles: [] };
    case `triangle`:
      return { lines: [], polygons: [[tip, back(size, size * spread), back(size, -size * spread)]], circles: [] };
    case `bar`:
      return { lines: [[back(0, size * 0.5), back(0, -size * 0.5)]], polygons: [], circles: [] };
    case `dot`: {
      const r = size * 0.4;
      return { lines: [], polygons: [], circles: [{ c: back(r, 0), r }] };
    }
    case `diamond`:
      return { lines: [], polygons: [[tip, back(size * 0.5, size * 0.3), back(size, 0), back(size * 0.5, -size * 0.3)]], circles: [] };
  }
}

// Returns the unit direction at an end of a line, pointing outwards, or null for a line of no length. For rounded edges the direction is the one of the last drawn piece.
export function endDirection(el: PointsElement, end: `start` | `end`): { tip: Point; dir: Point } | null {
  const pts = drawnPoints(el);
  if (pts.length < 2) return null;
  const tip = end === `start` ? pts[0] : pts[pts.length - 1];
  // Look back far enough from the tip to get a stable direction (a rounded curve is made of very short pieces).
  let from = end === `start` ? pts[1] : pts[pts.length - 2];
  for (let i = 1; i < pts.length; i++) {
    const q = end === `start` ? pts[i] : pts[pts.length - 1 - i];
    from = q;
    if (Math.hypot(q[0] - tip[0], q[1] - tip[1]) >= 4) break;
  }
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy);
  return len === 0 ? null : { tip, dir: [dx / len, dy / len] };
}

// Returns the shapes of the two heads of an arrow (empty for a line, or for the ends with no head).
export function arrowHeadShapes(el: SketchElement): { start: HeadShape; end: HeadShape } | null {
  if (el.type !== `arrow` || !hasPoints(el)) return null;
  const size = headSize(el.strokeWidth);
  const make = (e: `start` | `end`): HeadShape => {
    const d = endDirection(el, e);
    const kind = headOf(el as ArrowElement, e);
    return d ? headShape(kind, d.tip, d.dir, size) : { lines: [], polygons: [], circles: [] };
  };
  return { start: make(`start`), end: make(`end`) };
}
