// The look of the lines and fills that the user chooses, and how a choice is applied to elements. Pure module.
import { FillStyle, Head, HEADS, headOf, isShape, isStroked, MIN_FILL_OPACITY, SketchElement } from "./elements";
import { isSafeColor } from "./color";

export interface ToolStyle {
  stroke: string;
  // Fill colour, or null for no fill.
  fill: string | null;
  fillStyle: FillStyle;
  // Opacity of the fill, from MIN_FILL_OPACITY (almost transparent) to 1 (opaque).
  fillOpacity: number;
  strokeWidth: number;
  // 0 for clean lines, 1 for the hand drawn look.
  roughness: number;
  // Rounded edges for lines and arrows, and the heads of arrows.
  rounded: boolean;
  startHead: Head;
  endHead: Head;
}

export type StylePatch = Partial<ToolStyle>;

// Widths proposed by the buttons: thin, medium and thick.
export const STROKE_WIDTHS = { thin: 3, medium: 5, thick: 9 };
export const MIN_WIDTH = 1;
export const MAX_WIDTH = 24;

// Returns the style of a new drawing: a thin hand drawn line in the ink colour of the page, with no fill.
export function defaultStyle(ink: string): ToolStyle {
  return { stroke: isSafeColor(ink) ? ink : `#000000`, fill: null, fillStyle: `solid`, fillOpacity: 1, strokeWidth: STROKE_WIDTHS.thin, roughness: 1, rounded: false, startHead: `none`, endHead: `arrow` };
}

// Returns a style patch with every value checked: unknown or invalid values are dropped.
export function cleanPatch(patch: StylePatch): StylePatch {
  const out: StylePatch = {};
  if (patch.stroke !== undefined && isSafeColor(patch.stroke)) out.stroke = patch.stroke;
  if (patch.fill !== undefined && (patch.fill === null || isSafeColor(patch.fill))) out.fill = patch.fill;
  if (patch.fillStyle === `solid` || patch.fillStyle === `hachure`) out.fillStyle = patch.fillStyle;
  if (typeof patch.fillOpacity === `number` && Number.isFinite(patch.fillOpacity)) out.fillOpacity = Math.min(1, Math.max(MIN_FILL_OPACITY, Math.round(patch.fillOpacity * 100) / 100));
  if (typeof patch.strokeWidth === `number` && Number.isFinite(patch.strokeWidth)) out.strokeWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, patch.strokeWidth));
  if (typeof patch.roughness === `number` && Number.isFinite(patch.roughness)) out.roughness = patch.roughness <= 0 ? 0 : 1;
  if (typeof patch.rounded === `boolean`) out.rounded = patch.rounded;
  if (patch.startHead !== undefined && HEADS.includes(patch.startHead)) out.startHead = patch.startHead;
  if (patch.endHead !== undefined && HEADS.includes(patch.endHead)) out.endHead = patch.endHead;
  return out;
}

// Applies a style patch to one element. A drawing frame has no style and is returned as it is. The fill only applies to shapes; a line keeps its stroke only.
export function applyStyle(el: SketchElement, patch: StylePatch): SketchElement {
  if (!isStroked(el)) return el;
  const p = cleanPatch(patch);
  let next = { ...el } as typeof el;
  if (p.stroke !== undefined) next.stroke = p.stroke;
  if (p.strokeWidth !== undefined) next.strokeWidth = p.strokeWidth;
  if (p.roughness !== undefined) next.roughness = p.roughness;
  if (next.type === `line` || next.type === `arrow`) {
    if (p.rounded !== undefined) {
      const { rounded: _r, ...rest } = next;
      void _r;
      next = (p.rounded ? { ...rest, rounded: true } : rest) as typeof el;
    }
  }
  if (next.type === `arrow`) {
    if (p.startHead !== undefined) next = { ...next, startHead: p.startHead } as typeof el;
    if (p.endHead !== undefined) next = { ...next, endHead: p.endHead } as typeof el;
  }
  if (isShape(next)) {
    if (p.fill === null) {
      const { fill: _f, ...rest } = next;
      void _f;
      next = rest as typeof el;
    } else if (p.fill !== undefined) {
      next = { ...next, fill: p.fill, fillStyle: next.fillStyle ?? p.fillStyle ?? `solid` } as typeof el;
    }
    if (p.fillStyle !== undefined && isShape(next) && next.fill !== undefined) next = { ...next, fillStyle: p.fillStyle } as typeof el;
    if (p.fillOpacity !== undefined && isShape(next)) {
      if (p.fillOpacity >= 1) {
        const { fillOpacity: _o, ...rest } = next;
        void _o;
        next = rest as typeof el;
      } else {
        next = { ...next, fillOpacity: p.fillOpacity } as typeof el;
      }
    }
  }
  return next;
}

// Applies a style patch to the selected elements of a list. The other elements are returned as they are.
export function applyStyleToIds(elements: SketchElement[], ids: Set<string>, patch: StylePatch): SketchElement[] {
  return elements.map((e) => (ids.has(e.id) ? applyStyle(e, patch) : e));
}

// Returns the style an element currently has, or null for a drawing frame. A line has no fill.
export function styleOf(el: SketchElement): ToolStyle | null {
  if (!isStroked(el)) return null;
  const fill = isShape(el) && el.fill !== undefined ? el.fill : null;
  const fillStyle: FillStyle = isShape(el) && el.fillStyle ? el.fillStyle : `solid`;
  const fillOpacity = isShape(el) && el.fillOpacity !== undefined ? el.fillOpacity : 1;
  const linear = el.type === `line` || el.type === `arrow`;
  const rounded = linear && el.rounded === true;
  const startHead: Head = el.type === `arrow` ? headOf(el, `start`) : `none`;
  const endHead: Head = el.type === `arrow` ? headOf(el, `end`) : `arrow`;
  return { stroke: el.stroke, fill, fillStyle, fillOpacity, strokeWidth: el.strokeWidth, roughness: el.roughness ?? 0, rounded, startHead, endHead };
}
