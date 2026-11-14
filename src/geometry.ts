// Pure geometry of the elements: boxes, rotation, hit tests and the position of the handles of a selected element.
import { hasPoints, isShape, isStroked } from "./elements";
import type { Point, SketchElement } from "./elements";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A handle of a selected element: one of the four corners (0 top left, 1 top right, 2 bottom right, 3 bottom left) or the rotation handle.
export type Handle = { kind: `rotate` } | { kind: `resize`; corner: 0 | 1 | 2 | 3 };

// Distance in screen pixels between the top of a selected element and its rotation handle.
export const ROTATE_OFFSET = 28;
const RAD = Math.PI / 180;

// Returns a point turned by an angle in degrees around a centre.
export function rotatePoint(p: Point, c: Point, degrees: number): Point {
  const a = degrees * RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
}

// Returns the centre of a box.
export function centerOf(box: Box): Point {
  return [box.x + box.w / 2, box.y + box.h / 2];
}

// Returns the box of an element before rotation and its rotation. A line or an arrow has no rotation of its own: its box is the one of its points.
export function boxOf(el: SketchElement): { box: Box; angle: number } {
  if (el.type === `rect` || el.type === `diamond` || el.type === `drawing`) return { box: { x: el.x, y: el.y, w: el.width, h: el.height }, angle: el.angle ?? 0 };
  if (el.type === `ellipse`) return { box: { x: el.cx - el.rx, y: el.cy - el.ry, w: 2 * el.rx, h: 2 * el.ry }, angle: el.angle ?? 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of el.points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, angle: 0 };
}

// Returns the four corners of a box turned by an angle around its centre: top left, top right, bottom right, bottom left.
export function boxCorners(box: Box, angle: number): [Point, Point, Point, Point] {
  const c = centerOf(box);
  const raw: [Point, Point, Point, Point] = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]];
  return angle === 0 ? raw : [rotatePoint(raw[0], c, angle), rotatePoint(raw[1], c, angle), rotatePoint(raw[2], c, angle), rotatePoint(raw[3], c, angle)];
}

// Returns the smallest upright box that holds the whole element, rotation included.
export function elementBounds(el: SketchElement): Box {
  const { box, angle } = boxOf(el);
  if (angle === 0) return box;
  if (el.type === `ellipse`) {
    const a = angle * RAD;
    const ex = Math.hypot(el.rx * Math.cos(a), el.ry * Math.sin(a));
    const ey = Math.hypot(el.rx * Math.sin(a), el.ry * Math.cos(a));
    return { x: el.cx - ex, y: el.cy - ey, w: 2 * ex, h: 2 * ey };
  }
  const corners = boxCorners(box, angle);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// Returns the smallest box that holds all the given boxes, or null for an empty list.
export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

// Tells whether two boxes overlap or touch.
export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

// Returns the distance from a point to a segment.
export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Tells whether a point touches an element, with a tolerance in page units. A line is touched on its stroke, a shape on its outline (and inside
// when it has a fill), a drawing frame anywhere inside.
export function hitElement(el: SketchElement, p: Point, tolerance: number): boolean {
  const reach = (isStroked(el) ? el.strokeWidth / 2 : 0) + tolerance;
  if (hasPoints(el)) {
    for (let i = 0; i + 1 < el.points.length; i++) if (distToSegment(p, el.points[i], el.points[i + 1]) <= reach) return true;
    return false;
  }
  const { box, angle } = boxOf(el);
  const c = centerOf(box);
  const q = rotatePoint(p, c, -angle);
  const lx = q[0] - c[0];
  const ly = q[1] - c[1];
  const filled = isShape(el) && el.fill !== undefined;
  if (el.type === `rect` || el.type === `drawing`) {
    const dx = Math.abs(lx) - box.w / 2;
    const dy = Math.abs(ly) - box.h / 2;
    if (el.type === `drawing`) return dx <= tolerance && dy <= tolerance;
    if (filled && dx <= 0 && dy <= 0) return true;
    const dist = dx <= 0 && dy <= 0 ? Math.min(-dx, -dy) : Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
    return dist <= reach;
  }
  if (el.type === `diamond`) {
    const hw = box.w / 2;
    const hh = box.h / 2;
    if (filled && Math.abs(lx) / hw + Math.abs(ly) / hh <= 1) return true;
    const corners: Point[] = [[0, -hh], [hw, 0], [0, hh], [-hw, 0]];
    for (let i = 0; i < 4; i++) if (distToSegment([lx, ly], corners[i], corners[(i + 1) % 4]) <= reach) return true;
    return false;
  }
  const r = Math.hypot(lx / (box.w / 2), ly / (box.h / 2));
  if (filled && r <= 1) return true;
  return Math.abs(r - 1) * Math.min(box.w / 2, box.h / 2) <= reach;
}

// Returns the element that is on top at a point (the last one of the list), or null.
export function hitTop(elements: SketchElement[], p: Point, tolerance: number): SketchElement | null {
  for (let i = elements.length - 1; i >= 0; i--) if (hitElement(elements[i], p, tolerance)) return elements[i];
  return null;
}

// Returns the position of the rotation handle: above the middle of the top side of the element, at a constant distance on screen.
export function rotateHandlePos(box: Box, angle: number, zoom: number): Point {
  const c = centerOf(box);
  return rotatePoint([c[0], box.y - ROTATE_OFFSET / zoom], c, angle);
}

// Tells whether an element has a rotation handle. A line or an arrow has none: it is changed by moving its ends.
export function hasRotateHandle(el: SketchElement): boolean {
  return el.type !== `line` && el.type !== `arrow`;
}

// Returns the corners that carry a resize handle. A straight line or arrow (two points) has a handle at each end only; everything else has the four corners.
export function visibleCorners(el: SketchElement): (0 | 1 | 2 | 3)[] {
  if (!hasPoints(el) || el.points.length !== 2) return [0, 1, 2, 3];
  const { box } = boxOf(el);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const corner = (p: Point): 0 | 1 | 2 | 3 => {
    const right = p[0] > cx;
    const bottom = p[1] > cy;
    return right ? (bottom ? 2 : 1) : bottom ? 3 : 0;
  };
  const a = corner(el.points[0]);
  const b = corner(el.points[1]);
  return a === b ? [a] : [a, b];
}

// Returns the handle of a box (upright, without rotation) that a point touches, among the given corners and the rotation handle when `rotation` is true.
export function hitBoxHandle(box: Box, angle: number, p: Point, zoom: number, radiusPx: number, corners: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3], rotation = true): Handle | null {
  const r = radiusPx / zoom;
  if (rotation) {
    const rot = rotateHandlePos(box, angle, zoom);
    if (Math.hypot(p[0] - rot[0], p[1] - rot[1]) <= r) return { kind: `rotate` };
  }
  const all = boxCorners(box, angle);
  for (const i of corners) {
    if (Math.hypot(p[0] - all[i][0], p[1] - all[i][1]) <= r) return { kind: `resize`, corner: i };
  }
  return null;
}

// Returns the handle that a point touches on a selected element, or null. The radius is in screen pixels.
export function hitHandle(el: SketchElement, p: Point, zoom: number, radiusPx: number): Handle | null {
  const { box, angle } = boxOf(el);
  return hitBoxHandle(box, angle, p, zoom, radiusPx, visibleCorners(el), hasRotateHandle(el));
}

// Returns the frame drawn around several selected elements, a little larger than their common box: the block that is moved, resized and turned as one.
export function blockBox(elements: SketchElement[], zoom: number): Box | null {
  const u = unionBox(elements.map(elementBounds));
  if (!u) return null;
  const pad = 6 / zoom;
  return { x: u.x - pad, y: u.y - pad, w: u.w + 2 * pad, h: u.h + 2 * pad };
}
