// Tidies a pen stroke: the more regular the setting, the more the hand drawn line is smoothed, then pulled onto the clean shape it was meant to be (a straight line, a circle or
// an ellipse, a rectangle or a square, a triangle). At the maximum the stroke is exactly that shape. Pure module: no access to the page.
import type { Point } from "./elements";

// The regularity goes from 0 (the stroke as drawn) to this value (the clean shape).
export const MAX_REGULARITY = 5;

// The kinds of clean shape that a stroke can be recognised as.
export type TidyKind = `line` | `circle` | `ellipse` | `rectangle` | `square` | `triangle`;

export interface Recognised {
  kind: TidyKind;
  // The clean outline as a dense polyline: closed for a shape (the last point is the first), two points for a line.
  outline: Point[];
}

// Returns the length of a polyline.
export function pathLength(points: Point[]): number {
  let length = 0;
  for (let i = 0; i + 1 < points.length; i++) length += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  return length;
}

// Tells whether a stroke comes back to where it started: the gap between its ends is small compared with its length (or with the width of the line).
export function isClosedStroke(points: Point[], width: number): boolean {
  if (points.length < 8) return false;
  const length = pathLength(points);
  const first = points[0];
  const last = points[points.length - 1];
  const gap = Math.hypot(last[0] - first[0], last[1] - first[1]);
  return length >= 30 && gap <= Math.max(length * 0.1, width * 2);
}

// Returns the distance from a point to a segment and the nearest point of the segment.
function nearestOnSegment(p: Point, a: Point, b: Point): { d: number; q: Point } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const q: Point = [a[0] + dx * t, a[1] + dy * t];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
}

// Returns the nearest point of a polyline to a point.
function nearestOnPath(p: Point, path: Point[]): { d: number; q: Point } {
  let best = { d: Infinity, q: path[0] };
  for (let i = 0; i + 1 < path.length; i++) {
    const n = nearestOnSegment(p, path[i], path[i + 1]);
    if (n.d < best.d) best = n;
  }
  return best;
}

// Returns the points again, evenly spaced along the polyline (about `step` apart).
function even(points: Point[], step: number): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
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
  out.push(points[points.length - 1]);
  return out;
}

// Returns a closed polygon as a dense polyline that keeps its corners (every corner is a point), the last point being the first.
function densePolygon(vertices: Point[], step: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  out.push([vertices[0][0], vertices[0][1]]);
  return out;
}

// Returns the mean distance from the points to a polyline.
function meanDistance(points: Point[], path: Point[]): number {
  let sum = 0;
  for (const p of points) sum += nearestOnPath(p, path).d;
  return sum / points.length;
}

// Finds the rectangle of least area around the points, turned by an angle (in steps of 3 degrees). Returns its centre, its two sizes and its angle in radians.
function leastBox(points: Point[]): { cx: number; cy: number; w: number; h: number; angle: number } {
  let best = { cx: 0, cy: 0, w: 0, h: 0, angle: 0, area: Infinity };
  for (let deg = 0; deg < 90; deg += 3) {
    const a = (deg * Math.PI) / 180;
    const [cos, sin] = [Math.cos(a), Math.sin(a)];
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of points) {
      const x = p[0] * cos + p[1] * sin;
      const y = -p[0] * sin + p[1] * cos;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area < best.area - 1e-9) {
      const mx = (minX + maxX) / 2;
      const my = (minY + maxY) / 2;
      best = { cx: mx * cos - my * sin, cy: mx * sin + my * cos, w: maxX - minX, h: maxY - minY, angle: a, area };
    }
  }
  return best;
}

// Returns the convex hull of points (Andrew's monotone chain).
function hullOf(points: Point[]): Point[] {
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

// Finds the triangle of the greatest area whose corners are points of the hull.
function bestTriangle(hull: Point[]): [Point, Point, Point] | null {
  const h = hull.length > 36 ? Array.from({ length: 36 }, (_, i) => hull[Math.floor((i * hull.length) / 36)]) : hull;
  if (h.length < 3) return null;
  let best: [Point, Point, Point] | null = null;
  let area = 0;
  for (let i = 0; i < h.length; i++) {
    for (let j = i + 1; j < h.length; j++) {
      for (let k = j + 1; k < h.length; k++) {
        const a = Math.abs((h[j][0] - h[i][0]) * (h[k][1] - h[i][1]) - (h[k][0] - h[i][0]) * (h[j][1] - h[i][1])) / 2;
        if (a > area) {
          area = a;
          best = [h[i], h[j], h[k]];
        }
      }
    }
  }
  return best;
}

// The largest mean distance to the clean shape, in parts of its size, that still counts as that shape.
const MAX_FIT_ERROR = 0.07;

// Tells which clean shape a stroke is meant to be, or null when it is none of them.
export function recognise(points: Point[], width = 3): Recognised | null {
  if (points.length < 4) return null;
  const length = pathLength(points);
  if (length < 12) return null;
  const pts = even(points, Math.max(1.5, length / 90));
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!isClosedStroke(points, width)) {
    // A line: the stroke stays close to the straight line between its ends, which are not too near each other.
    const chord = Math.hypot(last[0] - first[0], last[1] - first[1]);
    if (chord < 8 || chord / length < 0.8) return null;
    let worst = 0;
    for (const p of pts) worst = Math.max(worst, nearestOnSegment(p, first, last).d);
    if (worst / chord > 0.1) return null;
    // A line that is nearly horizontal or vertical becomes exactly so.
    let end: Point = [last[0], last[1]];
    const angle = (Math.atan2(last[1] - first[1], last[0] - first[0]) * 180) / Math.PI;
    if (Math.abs(angle) < 5 || Math.abs(angle) > 175) end = [last[0], first[1]];
    else if (Math.abs(Math.abs(angle) - 90) < 5) end = [first[0], last[1]];
    return { kind: `line`, outline: [[first[0], first[1]], end] };
  }
  const box = leastBox(pts);
  // A box that is nearly straight is made straight.
  let { cx, cy, w, h, angle } = box;
  const deg = (angle * 180) / Math.PI;
  if (deg < 7 || deg > 83) {
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of pts) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    [cx, cy, w, h, angle] = [(minX + maxX) / 2, (minY + maxY) / 2, maxX - minX, maxY - minY, 0];
  }
  if (w < 6 || h < 6) return null;
  const size = Math.sqrt(w * h);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const place = (x: number, y: number): Point => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  const candidates: { kind: TidyKind; outline: Point[]; error: number }[] = [];

  // An ellipse in the box (a circle when it is nearly round).
  const round = Math.min(w, h) / Math.max(w, h) > 0.87;
  const [a, b] = round ? [(w + h) / 4, (w + h) / 4] : [w / 2, h / 2];
  const ring: Point[] = Array.from({ length: 73 }, (_, i) => place(a * Math.cos((i * 2 * Math.PI) / 72), b * Math.sin((i * 2 * Math.PI) / 72)));
  candidates.push({ kind: round ? `circle` : `ellipse`, outline: ring, error: meanDistance(pts, ring) / size });

  // A rectangle in the box (a square when it is nearly square).
  const square = Math.min(w, h) / Math.max(w, h) > 0.9;
  const [rw, rh] = square ? [(w + h) / 2, (w + h) / 2] : [w, h];
  const corners: Point[] = [place(-rw / 2, -rh / 2), place(rw / 2, -rh / 2), place(rw / 2, rh / 2), place(-rw / 2, rh / 2)];
  const rect = densePolygon(corners, 4);
  candidates.push({ kind: square ? `square` : `rectangle`, outline: rect, error: meanDistance(pts, rect) / size });

  // A triangle between three points of the hull.
  const tri = bestTriangle(hullOf(pts));
  if (tri) {
    const tr = densePolygon(tri, 4);
    candidates.push({ kind: `triangle`, outline: tr, error: meanDistance(pts, tr) / size });
  }
  // A small preference for the round shapes, which a hand draws less exactly.
  candidates[0].error *= 0.85;
  const best = candidates.reduce((x, y) => (y.error < x.error ? y : x));
  return best.error <= MAX_FIT_ERROR ? { kind: best.kind, outline: best.outline } : null;
}

// Smooths a polyline with a moving average (the two ends stay where they are, a closed stroke keeps its end on its start).
function smooth(points: Point[], radius: number, closed: boolean): Point[] {
  if (radius < 1 || points.length < 3) return points;
  const n = points.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const edge = closed ? radius : Math.min(radius, i, n - 1 - i);
    let [sx, sy, count] = [0, 0, 0];
    for (let k = -edge; k <= edge; k++) {
      const j = closed ? (((i + k) % (n - 1)) + (n - 1)) % (n - 1) : i + k;
      sx += points[j][0];
      sy += points[j][1];
      count++;
    }
    out.push([sx / count, sy / count]);
  }
  if (closed) out[n - 1] = [out[0][0], out[0][1]];
  return out;
}

// Returns the tidied points of a stroke for a regularity from 0 to MAX_REGULARITY. 0 gives the stroke as it was drawn; the more it is, the smoother it is and the closer
// to the clean shape it was meant to be, which it is exactly at the maximum.
export function tidyStroke(points: Point[], regularity: number, width = 3): Point[] {
  if (!(regularity > 0) || points.length < 3) return points;
  const t = Math.min(1, regularity / MAX_REGULARITY);
  const closed = isClosedStroke(points, width);
  const length = pathLength(points);
  const base = even(points, Math.max(1.5, length / 160));
  const ideal = recognise(points, width);
  if (ideal && t >= 1) return ideal.outline;
  const flat = smooth(base, Math.round(1 + t * 5), closed && base.length > 8);
  if (!ideal) return flat;
  return flat.map((p, i): Point => {
    const q = nearestOnPath(p, ideal.outline).q;
    // The two ends of a closed stroke meet at the same point.
    if (closed && i === flat.length - 1) return [0, 0];
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  }).map((p, i, all): Point => (closed && i === all.length - 1 ? all[0] : p));
}
