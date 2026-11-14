// Pure transformations of elements: move, resize from a corner and rotate. Each function returns a new element and never changes its argument.
import type { Point, SketchElement } from "./elements";
import { Box, boxOf, centerOf, rotatePoint } from "./geometry";

export const MIN_SIZE = 4;
const SIGNS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// Rounds to two decimals, which keeps the file short and avoids drifting digits.
const r2 = (n: number): number => Math.round(n * 100) / 100;

// Returns the element moved by a distance.
export function translate(el: SketchElement, dx: number, dy: number): SketchElement {
  if (el.type === `line` || el.type === `arrow`) return { ...el, points: el.points.map((p): Point => [r2(p[0] + dx), r2(p[1] + dy)]) };
  if (el.type === `rect`) return { ...el, x: r2(el.x + dx), y: r2(el.y + dy) };
  return { ...el, cx: r2(el.cx + dx), cy: r2(el.cy + dy) };
}

// Returns a rectangle or an ellipse with a new box, keeping everything else.
function withBox(el: SketchElement, box: Box): SketchElement {
  if (el.type === `rect`) return { ...el, x: r2(box.x), y: r2(box.y), width: r2(box.w), height: r2(box.h) };
  if (el.type === `ellipse`) return { ...el, cx: r2(box.x + box.w / 2), cy: r2(box.y + box.h / 2), rx: r2(box.w / 2), ry: r2(box.h / 2) };
  return el;
}

// Resizes a line or an arrow by moving one corner of its box. The opposite corner stays where it is. An axis along which the box has no size is left alone.
function resizeLine(el: SketchElement, corner: number, pointer: Point, keepRatio: boolean): SketchElement {
  if (el.type !== `line` && el.type !== `arrow`) return el;
  const { box } = boxOf(el);
  const [sx, sy] = SIGNS[corner];
  const ox = sx === -1 ? box.x + box.w : box.x;
  const oy = sy === -1 ? box.y + box.h : box.y;
  let scaleX = box.w < 1e-6 ? 1 : Math.max(MIN_SIZE, sx * (pointer[0] - ox)) / box.w;
  let scaleY = box.h < 1e-6 ? 1 : Math.max(MIN_SIZE, sy * (pointer[1] - oy)) / box.h;
  if (keepRatio && box.w >= 1e-6 && box.h >= 1e-6) {
    const s = Math.max(scaleX, scaleY);
    scaleX = s;
    scaleY = s;
  }
  const map = (p: Point): Point => [r2(ox + (p[0] - ox) * scaleX), r2(oy + (p[1] - oy) * scaleY)];
  return { ...el, points: el.points.map(map) };
}

// Resizes an element by dragging one corner to a point. The opposite corner stays where it is on the page, even when the element is rotated.
// With keepRatio the shape keeps its proportions.
export function resizeElement(el: SketchElement, corner: 0 | 1 | 2 | 3, pointer: Point, keepRatio: boolean): SketchElement {
  if (el.type === `line` || el.type === `arrow`) return resizeLine(el, corner, pointer, keepRatio);
  const { box, angle } = boxOf(el);
  const [sx, sy] = SIGNS[corner];
  const c = centerOf(box);
  const local = rotatePoint(pointer, c, -angle);
  const ox = (-sx * box.w) / 2;
  const oy = (-sy * box.h) / 2;
  let nw = Math.max(MIN_SIZE, sx * (local[0] - c[0] - ox));
  let nh = Math.max(MIN_SIZE, sy * (local[1] - c[1] - oy));
  if (keepRatio) {
    const s = Math.max(nw / box.w, nh / box.h);
    nw = Math.max(MIN_SIZE, box.w * s);
    nh = Math.max(MIN_SIZE, box.h * s);
  }
  const centre = rotatePoint([c[0] + ox + (sx * nw) / 2, c[1] + oy + (sy * nh) / 2], c, angle);
  return withBox(el, { x: centre[0] - nw / 2, y: centre[1] - nh / 2, w: nw, h: nh });
}

// Brings an angle in degrees into the range from -180 to 180.
export function normalizeAngle(degrees: number): number {
  let a = degrees % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

// Turns an element by an angle in degrees around its centre. A rectangle or an ellipse keeps its shape and takes a rotation; a line or an arrow has its points turned.
export function rotateBy(el: SketchElement, degrees: number): SketchElement {
  if (el.type === `line` || el.type === `arrow`) {
    const c = centerOf(boxOf(el).box);
    return { ...el, points: el.points.map((p): Point => { const q = rotatePoint(p, c, degrees); return [r2(q[0]), r2(q[1])]; }) };
  }
  const angle = r2(normalizeAngle((el.angle ?? 0) + degrees));
  if (angle === 0) {
    const { angle: _a, ...rest } = el;
    void _a;
    return rest as SketchElement;
  }
  return { ...el, angle };
}
