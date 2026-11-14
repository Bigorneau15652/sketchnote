// Creation of elements from a gesture (a drag from one point to another, or the points of a pen stroke), with the same keys as Excalidraw:
// Shift for a square, a circle or a line at a multiple of 15 degrees, Alt to start from the centre. Pure module.
import type { DiamondElement, EllipseElement, FreedrawElement, Point, RectElement, SketchElement } from "./elements";
import type { ToolStyle } from "./style";

export type CreationTool = `rect` | `diamond` | `ellipse` | `line` | `arrow` | `pen` | `point`;
export const CREATION_TOOLS: CreationTool[] = [`rect`, `diamond`, `ellipse`, `line`, `arrow`, `pen`, `point`];

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
function look(style: ToolStyle, seed: number): { stroke: string; strokeWidth: number; roughness: number; seed: number } {
  return { stroke: style.stroke, strokeWidth: style.strokeWidth, roughness: style.roughness, seed };
}

// Returns the fill fields of a new shape: nothing when the style has no fill.
function fillOf(style: ToolStyle): { fill?: string; fillStyle?: `solid` | `hachure` } {
  return style.fill === null ? {} : { fill: style.fill, fillStyle: style.fillStyle };
}

// Builds the element that a drag from `start` to `end` makes with a tool, or null when the drag is too small to be an element.
export function elementFromDrag(tool: CreationTool, start: Point, end: Point, mods: Modifiers, style: ToolStyle, id: string, seed: number): SketchElement | null {
  if (tool === `rect` || tool === `diamond`) {
    const b = dragBox(start, end, mods);
    if (b.w < 2 || b.h < 2) return null;
    const el: RectElement | DiamondElement = { id, type: tool, x: r2(b.x), y: r2(b.y), width: r2(b.w), height: r2(b.h), ...look(style, seed), ...fillOf(style) };
    return el;
  }
  if (tool === `ellipse`) {
    const b = dragBox(start, end, mods);
    if (b.w < 2 || b.h < 2) return null;
    const el: EllipseElement = { id, type: `ellipse`, cx: r2(b.x + b.w / 2), cy: r2(b.y + b.h / 2), rx: r2(b.w / 2), ry: r2(b.h / 2), ...look(style, seed), ...fillOf(style) };
    return el;
  }
  if (tool === `line` || tool === `arrow`) {
    const e = lineEnd(start, end, mods.shift);
    if (Math.hypot(e[0] - start[0], e[1] - start[1]) < 2) return null;
    return { id, type: tool, points: [[r2(start[0]), r2(start[1])], [r2(e[0]), r2(e[1])]], ...look(style, seed) };
  }
  return null;
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
  return { id, type: `freedraw`, points: pts, ...look(style, seed) };
}
