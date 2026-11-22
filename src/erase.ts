// The eraser: it does not destroy anything. A pass of the eraser is kept on each element it touched, as a stroke written in the frame of the element (a part of its box, so it
// stays on the same place of the element when the element is moved, resized, turned or mirrored), and the element is drawn through a mask that the strokes cut out. Removing the
// strokes gives the whole element back. Pure module: no page, no application.
import type { Point, SketchElement } from "./elements";
import { boxOf, centerOf, hitElement, rotatePoint } from "./geometry";
import type { EraseShape, EraseStroke } from "./erase-data";
import { cleanEraseDensity, cleanEraseSize, FAR, MAX_ERASE_POINTS, MAX_ERASE_STROKES } from "./erase-data";

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r4 = (n: number): number => Math.round(n * 10000) / 10000;



// The frame of an element that the passes are written in: its box before the rotation (a line or a pen stroke has the box of its points, a segment that is straight has no width or
// no height, so the box is given at least one unit to divide by).
function frameOf(el: SketchElement): { x: number; y: number; w: number; h: number; angle: number; c: Point } {
  const { box, angle } = boxOf(el);
  const w = Math.max(1, box.w);
  const h = Math.max(1, box.h);
  const x = box.w < 1 ? box.x - (1 - box.w) / 2 : box.x;
  const y = box.h < 1 ? box.y - (1 - box.h) / 2 : box.y;
  return { x, y, w, h, angle, c: centerOf({ x, y, w, h }) };
}

// Tells whether an element is mirrored in its own frame (a line, an arrow and a pen stroke are mirrored by their points, so their frame is never mirrored).
function mirroredIn(el: SketchElement): { fx: boolean; fy: boolean } {
  if (el.type === `line` || el.type === `arrow` || el.type === `freedraw`) return { fx: false, fy: false };
  return { fx: el.flipX === true, fy: el.flipY === true };
}

// Returns the pass of the eraser that goes through points of the page, written in the frame of an element.
export function eraseFromPage(el: SketchElement, pagePoints: Point[], size: number, shape: EraseShape, density: number): EraseStroke {
  const f = frameOf(el);
  const { fx, fy } = mirroredIn(el);
  const points = pagePoints.slice(0, MAX_ERASE_POINTS).map((p): Point => {
    const q = rotatePoint(p, f.c, -f.angle);
    const x = fx ? 2 * f.c[0] - q[0] : q[0];
    const y = fy ? 2 * f.c[1] - q[1] : q[1];
    return [r4(Math.max(-FAR, Math.min(FAR, (x - f.x) / f.w))), r4(Math.max(-FAR, Math.min(FAR, (y - f.y) / f.h)))];
  });
  return { points, size: cleanEraseSize(size), shape, density: cleanEraseDensity(density) };
}

// Returns the points of a pass on the page, for the element as it is now (moved, resized, turned or mirrored).
export function erasePagePoints(el: SketchElement, stroke: EraseStroke): Point[] {
  const f = frameOf(el);
  const { fx, fy } = mirroredIn(el);
  return stroke.points.map((p): Point => {
    const x0 = f.x + p[0] * f.w;
    const y0 = f.y + p[1] * f.h;
    const q: Point = [fx ? 2 * f.c[0] - x0 : x0, fy ? 2 * f.c[1] - y0 : y0];
    return rotatePoint(q, f.c, f.angle);
  });
}

// Returns the data of the line that a pass of the eraser draws in the mask (straight segments; a click is a very short line so that the tip is drawn).
export function eraseLine(el: SketchElement, stroke: EraseStroke): string {
  const pts = erasePagePoints(el, stroke);
  if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1]]);
  return pts.map((p, i) => `${i === 0 ? `M` : `L`}${r2(p[0])},${r2(p[1])}`).join(` `);
}

// Tells whether a pass of the eraser touches an element: one of its points, or a point between two of them, is on the drawing of the element (on its line, on its fill or on
// its box for an icon, a picture or a text), as far as half the tip.
export function eraseTouches(el: SketchElement, pagePoints: Point[], size: number): boolean {
  if (el.locked === true || el.group === `structure`) return false;
  const reach = size / 2;
  const step = Math.max(2, size / 3);
  for (let i = 0; i < pagePoints.length; i++) {
    if (hitElement(el, pagePoints[i], reach)) return true;
    const next = pagePoints[i + 1];
    if (!next) continue;
    const length = Math.hypot(next[0] - pagePoints[i][0], next[1] - pagePoints[i][1]);
    for (let t = step; t < length; t += step) {
      if (hitElement(el, [pagePoints[i][0] + ((next[0] - pagePoints[i][0]) * t) / length, pagePoints[i][1] + ((next[1] - pagePoints[i][1]) * t) / length], reach)) return true;
    }
  }
  return false;
}

// Returns the element with one pass more (the passes of an element are limited).
export function withErase(el: SketchElement, stroke: EraseStroke): SketchElement {
  const strokes = [...(el.erase ?? []), stroke].slice(-MAX_ERASE_STROKES);
  return { ...el, erase: strokes };
}

// Returns the element with all its passes taken away: it is whole again.
export function withoutErase(el: SketchElement): SketchElement {
  if (el.erase === undefined) return el;
  const { erase: _e, ...rest } = el;
  void _e;
  return rest as SketchElement;
}

// Returns the passes mirrored for an element that is mirrored by its points (a line, an arrow or a pen stroke): the same place of the element, on the other side.
export function mirrorErase(erase: EraseStroke[] | undefined, axis: `x` | `y`): EraseStroke[] | undefined {
  if (!erase) return erase;
  return erase.map((s) => ({ ...s, points: s.points.map((p): Point => (axis === `x` ? [r4(1 - p[0]), p[1]] : [p[0], r4(1 - p[1])])) }));
}

// The shape of the line cap and of the corners that a tip has in the mask.
export function eraseCaps(shape: EraseShape): { cap: `round` | `square`; join: `round` | `miter` } {
  return shape === `square` ? { cap: `square`, join: `miter` } : { cap: `round`, join: `round` };
}

// How much a soft tip is blurred, as a part of its size, and how wide its line is so that the blur does not make it wider than the tip.
export const SOFT_BLUR = 0.07;
export const SOFT_WIDTH = 0.85;
