// Creation of elements from a gesture (a drag from one point to another, or the points of a pen stroke), with the same keys as Excalidraw:
// Shift for a square, a circle or a line at a multiple of 15 degrees, Alt to start from the centre. Pure module.
import { fieldsOf, sparseParams } from "./brushes";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "./elements";
import type { ArrowElement, DiamondElement, FillStyle, TriangleElement, EllipseElement, FreedrawElement, LineElement, Point, RectElement, SketchElement, TextElement } from "./elements";
import type { ToolStyle } from "./style";
import { effectFields, lineStyleField } from "./effects";
import { LINE_HEIGHT, refitText } from "./text-layout";

export type CreationTool = `rect` | `diamond` | `ellipse` | `triangle` | `bubble` | `festoon` | `line` | `arrow` | `pen` | `point` | `figure` | `portrait`;
export const CREATION_TOOLS: CreationTool[] = [`rect`, `diamond`, `ellipse`, `triangle`, `bubble`, `festoon`, `line`, `arrow`, `pen`, `point`, `figure`, `portrait`];

export interface Modifiers {
  shift: boolean;
  alt: boolean;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

// Returns the box of a drag between two points: from corner to corner, or from the centre with Alt, as a square with Shift.
function dragBox(start: Point, end: Point, mods: Modifiers): { x: number; y: number; w: number; h: number } {
  let dx = end[0] - start[0];
  let dy = end[1] - start[1];
  if (mods.shift) {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * s;
    dy = Math.sign(dy || 1) * s;
  }
  if (mods.alt) return { x: start[0] - Math.abs(dx), y: start[1] - Math.abs(dy), w: 2 * Math.abs(dx), h: 2 * Math.abs(dy) };
  return { x: Math.min(start[0], start[0] + dx), y: Math.min(start[1], start[1] + dy), w: Math.abs(dx), h: Math.abs(dy) };
}

// Returns the box of an equilateral triangle dragged from a point: as wide as the drag is wide, and 0.866 times as high, upwards or downwards like the pointer, from the centre of
// the base with Alt.
function equilateralBox(start: Point, end: Point, mods: Modifiers): { x: number; y: number; w: number; h: number } {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const w = Math.max(Math.abs(dx), Math.abs(dy) / EQUILATERAL);
  const h = w * EQUILATERAL;
  const x = mods.alt ? start[0] - w : dx < 0 ? start[0] - w : start[0];
  const width = mods.alt ? 2 * w : w;
  const height = mods.alt ? 2 * h : h;
  const y = mods.alt ? start[1] - h : dy < 0 ? start[1] - h : start[1];
  return { x, y, w: width, h: height };
}

// Height of an equilateral triangle as a part of its base.
const EQUILATERAL = Math.sqrt(3) / 2;

// Returns the end of a line, brought to the nearest multiple of 15 degrees around its start when Shift is held.
function lineEnd(start: Point, end: Point, shift: boolean): Point {
  if (!shift) return end;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy);
  const step = (15 * Math.PI) / 180;
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  return [start[0] + len * Math.cos(a), start[1] + len * Math.sin(a)];
}

// Returns the look fields of a new element, from the style chosen by the user.
function look(style: ToolStyle, seed: number): ReturnType<typeof effectFields> & ReturnType<typeof lineStyleField> & { stroke: string; strokeWidth: number; roughness: number; seed: number } {
  return { stroke: style.stroke, strokeWidth: style.strokeWidth, roughness: style.roughness, seed, ...lineStyleField(style.lineStyle), ...effectFields(style) };
}

// Returns the border and the corners of a new shape: only what differs from a simple border and square corners.
function borderOf(style: ToolStyle, rect: boolean): { border?: Exclude<ToolStyle[`border`], `simple`>; radius?: number } {
  return { ...(style.border !== `simple` ? { border: style.border } : {}), ...(rect && style.radius > 0 ? { radius: style.radius } : {}) };
}

// Returns the fill fields of a new shape: nothing when the style has no fill.
function fillOf(style: ToolStyle): { fill?: string; fillStyle?: FillStyle; fillOpacity?: number } {
  if (style.fill === null) return {};
  return { fill: style.fill, fillStyle: style.fillStyle, ...(style.fillOpacity < 1 ? { fillOpacity: style.fillOpacity } : {}) };
}

// Builds the element that a drag from `start` to `end` makes with a tool, or null when the drag is too small to be an element.
export function elementFromDrag(tool: CreationTool, start: Point, end: Point, mods: Modifiers, style: ToolStyle, id: string, seed: number): SketchElement | null {
  if (tool === `rect` || tool === `diamond`) {
    const b = dragBox(start, end, mods);
    if (b.w < 2 || b.h < 2) return null;
    const el: RectElement | DiamondElement = { id, type: tool, x: r2(b.x), y: r2(b.y), width: r2(b.w), height: r2(b.h), ...look(style, seed), ...fillOf(style), ...borderOf(style, tool === `rect`) } as RectElement | DiamondElement;
    return el;
  }
  if (tool === `bubble` || tool === `festoon`) {
    // A comic bubble or a festoon: a rectangle with the form chosen in the menu of the tool (a bubble has the usual tail until it is moved).
    const b = dragBox(start, end, mods);
    if (b.w < 2 || b.h < 2) return null;
    const form = tool === `bubble` ? style.bubbleForm : style.festoonForm;
    const el: RectElement = { id, type: `rect`, x: r2(b.x), y: r2(b.y), width: r2(b.w), height: r2(b.h), ...look(style, seed), ...fillOf(style), ...borderOf(style, false), form };
    return el;
  }
  if (tool === `triangle`) {
    // The triangle is isosceles in the box that is dragged; with Shift its proportions are fixed (equilateral), like the square and the circle.
    const b = mods.shift ? equilateralBox(start, end, mods) : dragBox(start, end, mods);
    if (b.w < 2 || b.h < 2) return null;
    const el: TriangleElement = { id, type: `triangle`, x: r2(b.x), y: r2(b.y), width: r2(b.w), height: r2(b.h), ...look(style, seed), ...fillOf(style), ...borderOf(style, false) };
    return el;
  }
  if (tool === `ellipse`) {
    const b = dragBox(start, end, mods);
    if (b.w < 2 || b.h < 2) return null;
    const el: EllipseElement = { id, type: `ellipse`, cx: r2(b.x + b.w / 2), cy: r2(b.y + b.h / 2), rx: r2(b.w / 2), ry: r2(b.h / 2), ...look(style, seed), ...fillOf(style), ...borderOf(style, false) };
    return el;
  }
  if (tool === `line` || tool === `arrow`) {
    const e = lineEnd(start, end, mods.shift);
    if (Math.hypot(e[0] - start[0], e[1] - start[1]) < 2) return null;
    return linearElement(tool, [[start[0], start[1]], [e[0], e[1]]], style, id, seed);
  }
  return null;
}

// Builds a line or an arrow from its points and the style chosen by the user: rounded edges, and for an arrow the heads that are not the default ones.
export function linearElement(tool: `line` | `arrow`, points: Point[], style: ToolStyle, id: string, seed: number): LineElement | ArrowElement {
  const pts = points.map((p): Point => [r2(p[0]), r2(p[1])]);
  const rounded = style.rounded ? { rounded: true } : {};
  const taper = style.taper > 0 ? { taper: style.taper } : {};
  if (tool === `line`) return { id, type: `line`, points: pts, ...look(style, seed), ...rounded, ...taper };
  return {
    id,
    type: `arrow`,
    points: pts,
    ...look(style, seed),
    ...rounded,
    ...taper,
    ...(style.startHead !== `none` ? { startHead: style.startHead } : {}),
    ...(style.endHead !== `arrow` ? { endHead: style.endHead } : {}),
  };
}

// Builds the element of the Point tool: a small filled disc centred on the click.
export function pointElement(center: Point, style: ToolStyle, id: string, seed: number): EllipseElement {
  const r = Math.max(2, r2(style.strokeWidth * 1.2));
  return { id, type: `ellipse`, cx: r2(center[0]), cy: r2(center[1]), rx: r, ry: r, ...look(style, seed), fill: style.stroke, fillStyle: `solid` };
}

// Adds a point to a pen stroke when it is far enough from the last one (the distance is in page units).
export function addPenPoint(points: Point[], p: Point, minDistance: number): Point[] {
  const last = points[points.length - 1];
  if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < minDistance) return points;
  return [...points, [r2(p[0]), r2(p[1])]];
}

// Builds the element of a pen stroke. A single point (a click) becomes a very short stroke so that it still draws a dot.
export function penElement(points: Point[], style: ToolStyle, id: string, seed: number, maxPoints: number): FreedrawElement | null {
  if (points.length === 0) return null;
  const pts: Point[] = points.length === 1 ? [points[0], [r2(points[0][0] + 0.1), r2(points[0][1])]] : points.slice(0, maxPoints);
  const { lineStyle: _l, ...rest } = look(style, seed);
  void _l;
  return { id, type: `freedraw`, points: pts, ...rest, ...(style.regularity > 0 ? { regularity: style.regularity } : {}), ...(style.brush !== `round` ? { brush: style.brush } : {}), ...fieldsOf(sparseParams(style.brush, { flow: style.flow, hardness: style.hardness, spacing: style.spacing, form: style.form, rotation: style.brushAngle, grain: style.grain, dynamics: style.dynamics })) };
}

// Returns a text whose top left corner is at a point, in the font, the size, the alignment and the colour of the style. `measure` gives the width of a line of text.
export function textElement(at: Point, text: string, style: ToolStyle, id: string, measure: (line: string, font: string, size: number) => number): TextElement {
  const base: TextElement = { id, type: `text`, x: r2(at[0]), y: r2(at[1]), width: 1, height: 1, text, font: style.font, size: style.fontSize, stroke: style.stroke, ...(style.align === `left` ? {} : { align: style.align }), ...effectFields(style) };
  return refitText(base, measure);
}

// Returns the size of the letters for a text zone that was dragged: one line fills the height of the box, so the height of the box gives the height of the text.
export function zoneFontSize(boxHeight: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round((boxHeight / LINE_HEIGHT) * 10) / 10));
}

// Returns a text zone: a text in the box that the user dragged. The size of the letters comes from the height of the box (see zoneFontSize), the text wraps to the width of the box
// and the height of the zone then follows the lines (the caller measures it again).
export function zoneElement(box: { x: number; y: number; w: number; h: number }, text: string, style: ToolStyle, id: string): TextElement {
  return {
    id,
    type: `text`,
    x: r2(box.x),
    y: r2(box.y),
    width: r2(box.w),
    height: r2(box.h),
    text,
    font: style.font,
    size: zoneFontSize(box.h),
    stroke: style.stroke,
    zone: true,
    ...(style.align === `left` ? {} : { align: style.align }),
    ...effectFields(style),
  };
}
