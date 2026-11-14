// How far the drawing of an element goes beyond its box (the box of its points or of its sides): the width of its line, the lines of its border, the wobble of the hand drawn look,
// the head of an arrow. It is used to put the reflection edge to edge with the element and to keep the text of a shape away from its border. Pure module.
import type { SketchElement } from "./elements";
import { headSize } from "./linear";
import { ringsOf } from "./shape-paths";

// Returns how far the lines of the border of a shape go from its edge, on either side (the thickest line counts, wherever it is).
export function borderReach(el: { border?: Parameters<typeof ringsOf>[0]; strokeWidth: number }): number {
  return Math.max(...ringsOf(el.border, el.strokeWidth).map((r) => Math.abs(r.grow) + r.width / 2));
}

// Returns the distance, in page units, that the drawing of an element goes beyond its box.
export function outlineExtent(el: SketchElement): number {
  const wobble = ((`roughness` in el ? el.roughness : 0) ?? 0) * 1.5;
  switch (el.type) {
    case `rect`:
    case `ellipse`:
    case `diamond`:
    case `triangle`:
      return borderReach(el) + wobble + 1;
    case `line`:
      return el.strokeWidth / 2 + wobble + 1;
    case `arrow`:
      return Math.max(el.strokeWidth / 2 + wobble + 1, headSize(el.strokeWidth) / 2);
    case `freedraw`:
      return el.strokeWidth + 1;
    case `text`:
      return el.size * 0.2;
    default:
      return 0;
  }
}
