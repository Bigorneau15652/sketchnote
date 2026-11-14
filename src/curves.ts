// Rounded edges: the smooth curve that goes through the points of a line or an arrow. Pure module with no dependency, so that the geometry and the line editor can share it.
import type { Point, PointsElement } from "./elements";

// Returns the points of the smooth curve that goes through the control points, as short straight pieces. It follows the same Catmull-Rom curve that the drawing library
// draws, so that the hit test, the bounds and the heads match what is on the screen. Two points give a straight line.
export function curveSamples(points: Point[], perSegment = 16): Point[] {
  const n = points.length;
  if (n < 3) return points.map((p): Point => [p[0], p[1]]);
  const out: Point[] = [[points[0][0], points[0][1]]];
  for (let k = 0; k < n - 1; k++) {
    const p0 = points[k];
    const p3 = points[k + 1];
    const before = points[Math.max(0, k - 1)];
    const after = points[Math.min(n - 1, k + 2)];
    const c1: Point = [p0[0] + (p3[0] - before[0]) / 6, p0[1] + (p3[1] - before[1]) / 6];
    const c2: Point = [p3[0] + (p0[0] - after[0]) / 6, p3[1] + (p0[1] - after[1]) / 6];
    for (let i = 1; i <= perSegment; i++) {
      const t = i / perSegment;
      const u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]);
    }
  }
  return out;
}

// Tells whether a line or an arrow is drawn as a curve.
export function isRounded(el: PointsElement): boolean {
  return (el.type === `line` || el.type === `arrow`) && el.rounded === true && el.points.length >= 3;
}

// Returns the points that are really drawn: the control points, or the samples of the curve when the edges are rounded.
export function drawnPoints(el: PointsElement): Point[] {
  return isRounded(el) ? curveSamples(el.points) : el.points;
}
