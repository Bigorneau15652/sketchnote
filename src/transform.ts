// Pure transformations of elements: move, resize from a corner and rotate. Each function returns a new element and never changes its argument.
import { hasPoints, MAX_CROP_SIDE, MAX_FONT_SIZE, MIN_CROP_VISIBLE, MIN_FONT_SIZE } from "./elements";
import type { ImageElement, Point, SketchElement } from "./elements";
import { Box, boxOf, centerOf, rotatePoint, Side } from "./geometry";

export const MIN_SIZE = 4;
const SIGNS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// Rounds to two decimals, which keeps the file short and avoids drifting digits.
const r2 = (n: number): number => Math.round(n * 100) / 100;

// Returns the element moved by a distance.
export function translate(el: SketchElement, dx: number, dy: number): SketchElement {
  if (hasPoints(el)) return { ...el, points: el.points.map((p): Point => [r2(p[0] + dx), r2(p[1] + dy)]) };
  if (el.type === `ellipse`) return { ...el, cx: r2(el.cx + dx), cy: r2(el.cy + dy) };
  return { ...el, x: r2(el.x + dx), y: r2(el.y + dy) };
}

// Returns a rectangle or an ellipse with a new box, keeping everything else. A text takes the size of its font from its height, so that it grows like a picture.
function withBox(el: SketchElement, box: Box, scaleText = true): SketchElement {
  if (el.type === `text`) return { ...el, x: r2(box.x), y: r2(box.y), width: r2(box.w), height: r2(box.h), ...(scaleText ? { size: scaledSize(el.size, box.h / el.height) } : {}) };
  if (el.type === `rect` || el.type === `diamond` || el.type === `triangle` || el.type === `drawing` || el.type === `icon` || el.type === `image`) return { ...el, x: r2(box.x), y: r2(box.y), width: r2(box.w), height: r2(box.h) };
  if (el.type === `ellipse`) return { ...el, cx: r2(box.x + box.w / 2), cy: r2(box.y + box.h / 2), rx: r2(box.w / 2), ry: r2(box.h / 2) };
  return el;
}

// Returns a font size multiplied by a factor, rounded to one decimal and kept in the range of the sizes of a file.
function scaledSize(size: number, k: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size * k * 10) / 10));
}

// Resizes a line or an arrow by moving one corner of its box. The opposite corner stays where it is. An axis along which the box has no size is left alone.
function resizeLine(el: SketchElement, corner: number, pointer: Point, keepRatio: boolean): SketchElement {
  if (!hasPoints(el)) return el;
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

// Crop mode of a picture: the sides are moved over the picture instead of stretching it. `left`, `right`, `top` and `bottom` tell which sides the user drags; the new size is limited so
// that nothing is added beyond the whole picture and a part of it stays visible, and the crop that goes with it is returned.
function limitCrop(el: ImageElement, sides: { x: `l` | `r` | null; y: `t` | `b` | null }, nw: number, nh: number): { nw: number; nh: number; crop: [number, number, number, number] } {
  const crop: [number, number, number, number] = el.crop ? [el.crop[0], el.crop[1], el.crop[2], el.crop[3]] : [0, 0, 0, 0];
  const fx = 1 - crop[0] - crop[2];
  const fy = 1 - crop[1] - crop[3];
  const unitX = el.width / fx;
  const unitY = el.height / fy;
  if (sides.x) {
    const i = sides.x === `l` ? 0 : 2;
    const most = Math.min(fx + crop[i], 1 - crop[2 - i]) * unitX;
    nw = Math.min(most, Math.max(MIN_CROP_VISIBLE * unitX, nw));
    crop[i] = Math.min(MAX_CROP_SIDE, Math.max(0, r4(crop[i] + fx - nw / unitX)));
  }
  if (sides.y) {
    const i = sides.y === `t` ? 1 : 3;
    const most = Math.min(fy + crop[i], 1 - crop[4 - i]) * unitY;
    nh = Math.min(most, Math.max(MIN_CROP_VISIBLE * unitY, nh));
    crop[i] = Math.min(MAX_CROP_SIDE, Math.max(0, r4(crop[i] + fy - nh / unitY)));
  }
  return { nw, nh, crop };
}

// Rounds to four decimals (the crop is a part of the picture).
const r4 = (n: number): number => Math.round(n * 10000) / 10000;

// Returns a picture with a crop, or without the field when nothing is cut.
function withCrop(el: SketchElement, crop: [number, number, number, number]): SketchElement {
  if (el.type !== `image`) return el;
  const { crop: _c, ...rest } = el;
  void _c;
  return crop.some((n) => n > 0) ? { ...rest, crop } : rest;
}

// Resizes an element by dragging one corner to a point. The opposite corner stays where it is on the page, even when the element is rotated.
// With keepRatio the shape keeps its proportions.
export function resizeElement(el: SketchElement, corner: 0 | 1 | 2 | 3, pointer: Point, keepRatio: boolean, cropping = false): SketchElement {
  if (hasPoints(el)) return resizeLine(el, corner, pointer, keepRatio);
  // A drawing frame and an icon always keep the proportions of their drawing from a corner, like a picture (the sides stretch them).
  const crop = cropping && el.type === `image`;
  if (el.type === `drawing` || el.type === `text` || el.type === `icon` || el.type === `image`) keepRatio = !crop;
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
  let kept: [number, number, number, number] | null = null;
  if (crop && el.type === `image`) {
    const limited = limitCrop(el, { x: sx === -1 ? `l` : `r`, y: sy === -1 ? `t` : `b` }, nw, nh);
    nw = limited.nw;
    nh = limited.nh;
    kept = limited.crop;
  }
  const centre = rotatePoint([c[0] + ox + (sx * nw) / 2, c[1] + oy + (sy * nh) / 2], c, angle);
  const out = withBox(el, { x: centre[0] - nw / 2, y: centre[1] - nh / 2, w: nw, h: nh });
  return kept ? withCrop(out, kept) : out;
}

// Resizes an element by dragging the middle of one of its sides (0 top, 1 right, 2 bottom, 3 left): the opposite side stays where it is on the page, even when the element is
// rotated. The element is stretched or squashed along that side only; with keepRatio it keeps its proportions instead (the other side follows, about its middle). A text zone
// changes its width so that the text wraps again, and its top and bottom change the size of the letters; with keepRatio its letters grow with it.
export function resizeSide(el: SketchElement, side: Side, pointer: Point, keepRatio: boolean, cropping = false): SketchElement {
  if (el.type !== `rect` && el.type !== `ellipse` && el.type !== `diamond` && el.type !== `triangle` && el.type !== `icon` && el.type !== `image` && !(el.type === `text` && el.zone === true)) return el;
  const { box, angle } = boxOf(el);
  const c = centerOf(box);
  const local = rotatePoint(pointer, c, -angle);
  const horizontal = side === 1 || side === 3;
  const sign = side === 1 || side === 2 ? 1 : -1;
  const oldLength = horizontal ? box.w : box.h;
  // The new length along the side that moves, measured from the opposite side.
  const edge = (horizontal ? c[0] : c[1]) - (sign * oldLength) / 2;
  const length = Math.max(MIN_SIZE, sign * ((horizontal ? local[0] : local[1]) - edge));
  let nw = horizontal ? length : box.w;
  let nh = horizontal ? box.h : length;
  const crop = cropping && el.type === `image`;
  if (keepRatio && !crop) {
    const k = length / oldLength;
    nw = box.w * k;
    nh = box.h * k;
  }
  nw = Math.max(MIN_SIZE, nw);
  nh = Math.max(MIN_SIZE, nh);
  let kept: [number, number, number, number] | null = null;
  if (crop && el.type === `image`) {
    const limited = limitCrop(el, { x: horizontal ? (side === 3 ? `l` : `r`) : null, y: horizontal ? null : side === 0 ? `t` : `b` }, nw, nh);
    nw = limited.nw;
    nh = limited.nh;
    kept = limited.crop;
  }
  // The middle of the opposite side stays; the box grows from it along the moving axis and about its middle along the other one.
  const centreLocal: Point = horizontal ? [edge + (sign * nw) / 2, c[1]] : [c[0], edge + (sign * nh) / 2];
  const centre = rotatePoint(centreLocal, c, angle);
  // The top and the bottom of a text zone change the size of the letters (the text fills the new height); its left and right change the width only, and the text wraps again.
  const letters = keepRatio || (el.type === `text` && !horizontal);
  const out = withBox(el, { x: centre[0] - nw / 2, y: centre[1] - nh / 2, w: nw, h: nh }, letters);
  return kept ? withCrop(out, kept) : out;
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
  if (hasPoints(el)) {
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

// Scales an element by a factor around an anchor point: its centre moves along the line from the anchor, its size grows by the same factor and its angle stays.
// The width of the line is not scaled. Used to resize several elements as one block.
export function scaleAbout(el: SketchElement, anchor: Point, k: number): SketchElement {
  const at = (p: Point): Point => [r2(anchor[0] + (p[0] - anchor[0]) * k), r2(anchor[1] + (p[1] - anchor[1]) * k)];
  if (hasPoints(el)) return { ...el, points: el.points.map(at) };
  if (el.type === `ellipse`) {
    const c = at([el.cx, el.cy]);
    return { ...el, cx: c[0], cy: c[1], rx: r2(el.rx * k), ry: r2(el.ry * k) };
  }
  const c = at([el.x + el.width / 2, el.y + el.height / 2]);
  const width = r2(el.width * k);
  const height = r2(el.height * k);
  const moved = { ...el, x: r2(c[0] - width / 2), y: r2(c[1] - height / 2), width, height };
  return el.type === `text` ? { ...moved, size: scaledSize(el.size, k) } as SketchElement : moved;
}

// Turns an element around a point by an angle in degrees, as part of a block: its centre goes round the point and the element turns by the same angle (a line has
// its points turned). Used to rotate several elements as one block.
export function rotateAbout(el: SketchElement, center: Point, degrees: number): SketchElement {
  if (hasPoints(el)) return { ...el, points: el.points.map((p): Point => { const q = rotatePoint(p, center, degrees); return [r2(q[0]), r2(q[1])]; }) };
  const angle = r2(normalizeAngle((el.angle ?? 0) + degrees));
  const withAngle = <T extends SketchElement>(e: T): T => {
    if (angle === 0) {
      const { angle: _a, ...rest } = e as T & { angle?: number };
      void _a;
      return rest as T;
    }
    return { ...e, angle };
  };
  if (el.type === `ellipse`) {
    const c = rotatePoint([el.cx, el.cy], center, degrees);
    return withAngle({ ...el, cx: r2(c[0]), cy: r2(c[1]) });
  }
  const c = rotatePoint([el.x + el.width / 2, el.y + el.height / 2], center, degrees);
  return withAngle({ ...el, x: r2(c[0] - el.width / 2), y: r2(c[1] - el.height / 2) });
}
