// The joints of a figure on the page: where each one is for an element that is moved, resized, turned or mirrored, and the joint that a click reaches. Pure module.
import type { IconElement, Point } from "./elements";
import { boxOf, centerOf, rotatePoint } from "./geometry";
import { FIGURE_VB, FigureData, JOINTS, JointId, moveJoint, withFigure } from "./figure";

// Returns the page position of a point of the grid of the figure of an element.
export function figureToPage(el: IconElement, p: Point): Point {
  const { box, angle } = boxOf(el);
  const c = centerOf(box);
  let x = box.x + (p[0] / FIGURE_VB[2]) * box.w;
  const y0 = box.y + (p[1] / FIGURE_VB[3]) * box.h;
  if (el.flipX === true) x = 2 * c[0] - x;
  const y = el.flipY === true ? 2 * c[1] - y0 : y0;
  return rotatePoint([x, y], c, angle);
}

// Returns the point of the grid of the figure of an element that is at a position of the page.
export function pageToFigure(el: IconElement, p: Point): Point {
  const { box, angle } = boxOf(el);
  const c = centerOf(box);
  const q = rotatePoint(p, c, -angle);
  const x = el.flipX === true ? 2 * c[0] - q[0] : q[0];
  const y = el.flipY === true ? 2 * c[1] - q[1] : q[1];
  return [((x - box.x) / Math.max(1, box.w)) * FIGURE_VB[2], ((y - box.y) / Math.max(1, box.h)) * FIGURE_VB[3]];
}

// Returns the page positions of the joints of a figure.
export function jointPositions(el: IconElement & { figure: FigureData }): { id: JointId; at: Point }[] {
  return JOINTS.map((id) => ({ id, at: figureToPage(el, el.figure.joints[id]) }));
}

// Returns the joint that is at a position of the page, as far as a radius (the nearest one), or null.
export function jointAt(el: IconElement, p: Point, radius: number): JointId | null {
  if (!el.figure) return null;
  let best: JointId | null = null;
  let bestDistance = radius;
  for (const j of jointPositions(el as IconElement & { figure: FigureData })) {
    const d = Math.hypot(j.at[0] - p[0], j.at[1] - p[1]);
    if (d <= bestDistance) {
      best = j.id;
      bestDistance = d;
    }
  }
  return best;
}

// Returns the element with a joint dragged to a position of the page.
export function dragFigureJoint(el: IconElement, joint: JointId, page: Point): IconElement {
  if (!el.figure) return el;
  return withFigure(el, moveJoint(el.figure, joint, pageToFigure(el, page)));
}
