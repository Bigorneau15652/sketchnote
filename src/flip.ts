// Mirrors elements horizontally or vertically, as a block about the middle of the selection (like Excalidraw). A line, an arrow and a pen stroke have their points mirrored;
// the other elements move to their mirror place, turn the other way and take a mirror flag, so that their content is mirrored too. Pure module.
import type { Point, SketchElement } from "./elements";
import { elementBounds, unionBox } from "./geometry";

const r2 = (n: number): number => Math.round(n * 100) / 100;

// Tells whether an element can be mirrored: the strokes of a page structure and the frames of its zones belong to the structure and stay where they are.
export function canFlip(el: SketchElement): boolean {
  if (el.group === `structure`) return false;
  return !(el.type === `drawing` && el.slot !== undefined);
}

// Returns the list with the elements of `ids` mirrored: `x` turns left into right, `y` turns top into bottom. The other elements are returned as they are.
export function flipElements(elements: SketchElement[], ids: Set<string>, axis: `x` | `y`): SketchElement[] {
  const chosen = elements.filter((e) => ids.has(e.id) && canFlip(e));
  if (chosen.length === 0) return elements;
  const box = unionBox(chosen.map(elementBounds));
  if (!box) return elements;
  const mid = axis === `x` ? box.x + box.w / 2 : box.y + box.h / 2;
  const mirror = (v: number): number => r2(2 * mid - v);
  const flag = axis === `x` ? `flipX` : `flipY`;
  return elements.map((el): SketchElement => {
    if (!ids.has(el.id) || !canFlip(el)) return el;
    if (el.type === `line` || el.type === `arrow` || el.type === `freedraw`) {
      return { ...el, points: el.points.map((p): Point => (axis === `x` ? [mirror(p[0]), p[1]] : [p[0], mirror(p[1])])) };
    }
    const { [flag]: old, ...rest } = el as SketchElement & { flipX?: boolean; flipY?: boolean };
    const turned = el.angle !== undefined && el.angle !== 0 ? { angle: r2(-el.angle) } : {};
    const { angle: _a, ...noAngle } = rest as typeof rest & { angle?: number };
    void _a;
    const toggled = old === true ? {} : { [flag]: true };
    if (el.type === `ellipse`) return { ...noAngle, ...turned, ...toggled, cx: axis === `x` ? mirror(el.cx) : el.cx, cy: axis === `y` ? mirror(el.cy) : el.cy } as SketchElement;
    return {
      ...noAngle,
      ...turned,
      ...toggled,
      x: axis === `x` ? mirror(el.x + el.width) : el.x,
      y: axis === `y` ? mirror(el.y + el.height) : el.y,
    } as SketchElement;
  });
}
