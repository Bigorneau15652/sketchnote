// Pure geometry of the elements: boxes, rotation, hit tests and the position of the handles of a selected element.
import { drawnPoints } from "./curves";
import { hasPoints, isShape, isStroked } from "./elements";
import { isClosedStroke } from "./tidy";
import type { Point, SketchElement } from "./elements";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A handle of a selected element: one of the four corners (0 top left, 1 top right, 2 bottom right, 3 bottom left), the middle of one of the four sides (0 top, 1 right,
// 2 bottom, 3 left) or the rotation handle.
export type Side = 0 | 1 | 2 | 3;
export type Handle = { kind: `rotate` } | { kind: `resize`; corner: 0 | 1 | 2 | 3 } | { kind: `side`; side: Side };

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
  if (el.type === `rect` || el.type === `diamond` || el.type === `triangle` || el.type === `drawing` || el.type === `text` || el.type === `icon` || el.type === `image`) return { box: { x: el.x, y: el.y, w: el.width, h: el.height }, angle: el.angle ?? 0 };
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
  if (hasPoints(el) && el.type !== `freedraw`) {
    // A rounded line bulges outside of its control points: the bounds are the ones of the drawn curve.
    const pts = drawnPoints(el);
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
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

// Tells whether a point is inside a triangle given by its three corners.
function insideTriangle(p: Point, t: [Point, Point, Point]): boolean {
  const side = (a: Point, b: Point): number => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const d1 = side(t[0], t[1]);
  const d2 = side(t[1], t[2]);
  const d3 = side(t[2], t[0]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

// Tells whether a point is inside a closed polygon (a ray going to the right crosses its sides an odd number of times).
function insidePolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// Tells whether a point touches an element, with a tolerance in page units. A line is touched on its stroke, a shape on its outline (and inside
// when it has a fill), a drawing frame anywhere inside.
export function hitElement(el: SketchElement, p: Point, tolerance: number): boolean {
  const reach = (isStroked(el) ? el.strokeWidth / 2 : 0) + tolerance;
  if (hasPoints(el)) {
    const pts = el.type === `freedraw` ? el.points : drawnPoints(el);
    for (let i = 0; i + 1 < pts.length; i++) if (distToSegment(p, pts[i], pts[i + 1]) <= reach) return true;
    // A closed stroke with a fill is touched inside too.
    if (el.type === `freedraw` && el.fill !== undefined && isClosedStroke(pts, el.strokeWidth)) return insidePolygon(p, pts);
    return false;
  }
  const { box, angle } = boxOf(el);
  const c = centerOf(box);
  const q = rotatePoint(p, c, -angle);
  const lx = q[0] - c[0];
  const ly = q[1] - c[1];
  const filled = isShape(el) && el.fill !== undefined;
  if (el.type === `rect` || el.type === `drawing` || el.type === `text` || el.type === `icon` || el.type === `image`) {
    const dx = Math.abs(lx) - box.w / 2;
    const dy = Math.abs(ly) - box.h / 2;
    // A frame, a text and an icon are touched anywhere inside their box.
    if (el.type === `drawing` || el.type === `text` || el.type === `icon` || el.type === `image`) return dx <= tolerance && dy <= tolerance;
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
  if (el.type === `triangle`) {
    const hw = box.w / 2;
    const hh = box.h / 2;
    const corners: [Point, Point, Point] = [[0, -hh], [hw, hh], [-hw, hh]];
    if (filled && insideTriangle([lx, ly], corners)) return true;
    for (let i = 0; i < 3; i++) if (distToSegment([lx, ly], corners[i], corners[(i + 1) % 3]) <= reach) return true;
    return false;
  }
  const r = Math.hypot(lx / (box.w / 2), ly / (box.h / 2));
  if (filled && r <= 1) return true;
  return Math.abs(r - 1) * Math.min(box.w / 2, box.h / 2) <= reach;
}

// Tells whether a point is inside a rectangle, an ellipse, a diamond or a text zone (rotation included), whether or not it has a fill. Used to write in a shape that is selected
// and to move it by its inside.
export function insideShape(el: SketchElement, p: Point): boolean {
  if (el.type !== `rect` && el.type !== `ellipse` && el.type !== `diamond` && el.type !== `triangle` && !(el.type === `text` && el.zone === true)) return false;
  const { box, angle } = boxOf(el);
  const c = centerOf(box);
  const q = rotatePoint(p, c, -angle);
  const lx = Math.abs(q[0] - c[0]);
  const ly = Math.abs(q[1] - c[1]);
  if (el.type === `ellipse`) return (lx / (box.w / 2)) ** 2 + (ly / (box.h / 2)) ** 2 <= 1;
  if (el.type === `diamond`) return lx / (box.w / 2) + ly / (box.h / 2) <= 1;
  if (el.type === `triangle`) return insideTriangle([q[0] - c[0], q[1] - c[1]], [[0, -box.h / 2], [box.w / 2, box.h / 2], [-box.w / 2, box.h / 2]]);
  return lx <= box.w / 2 && ly <= box.h / 2;
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

// Returns the corners that carry a resize handle. A line or an arrow has none: it is changed by its points (see linear.ts), without any box around it. Everything else has
// the four corners.
export function visibleCorners(el: SketchElement): (0 | 1 | 2 | 3)[] {
  return el.type === `line` || el.type === `arrow` ? [] : [0, 1, 2, 3];
}

// Returns the sides that carry a handle in their middle: the rectangle, the ellipse, the diamond and the text zone, which are stretched or squashed with them. A text that is
// only as large as its lines, a picture frame, a line, an arrow and a pen stroke have none.
export function visibleSides(el: SketchElement): Side[] {
  if (el.type === `rect` || el.type === `ellipse` || el.type === `diamond` || el.type === `triangle` || el.type === `icon` || el.type === `image` || (el.type === `text` && el.zone === true)) return [0, 1, 2, 3];
  return [];
}

// Returns the middle of a side of a box turned by an angle around its centre.
export function sidePoint(box: Box, angle: number, side: Side): Point {
  const raw: Point = side === 0 ? [box.x + box.w / 2, box.y] : side === 1 ? [box.x + box.w, box.y + box.h / 2] : side === 2 ? [box.x + box.w / 2, box.y + box.h] : [box.x, box.y + box.h / 2];
  return angle === 0 ? raw : rotatePoint(raw, centerOf(box), angle);
}

// Returns the handle of a box (upright, without rotation) that a point touches, among the given corners, the middle of the given sides and the rotation handle when `rotation`
// is true. The corners come first when they are close to a side handle.
export function hitBoxHandle(box: Box, angle: number, p: Point, zoom: number, radiusPx: number, corners: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3], rotation = true, sides: Side[] = []): Handle | null {
  const r = radiusPx / zoom;
  if (rotation) {
    const rot = rotateHandlePos(box, angle, zoom);
    if (Math.hypot(p[0] - rot[0], p[1] - rot[1]) <= r) return { kind: `rotate` };
  }
  const all = boxCorners(box, angle);
  for (const i of corners) {
    if (Math.hypot(p[0] - all[i][0], p[1] - all[i][1]) <= r) return { kind: `resize`, corner: i };
  }
  for (const side of sides) {
    const at = sidePoint(box, angle, side);
    if (Math.hypot(p[0] - at[0], p[1] - at[1]) <= r) return { kind: `side`, side };
  }
  return null;
}

// Returns the handle that a point touches on a selected element, or null. The radius is in screen pixels.
export function hitHandle(el: SketchElement, p: Point, zoom: number, radiusPx: number): Handle | null {
  const { box, angle } = boxOf(el);
  return hitBoxHandle(box, angle, p, zoom, radiusPx, visibleCorners(el), hasRotateHandle(el), visibleSides(el));
}

// Returns the frame drawn around several selected elements, a little larger than their common box: the block that is moved, resized and turned as one.
export function blockBox(elements: SketchElement[], zoom: number): Box | null {
  const u = unionBox(elements.map(elementBounds));
  if (!u) return null;
  const pad = 6 / zoom;
  return { x: u.x - pad, y: u.y - pad, w: u.w + 2 * pad, h: u.h + 2 * pad };
}
