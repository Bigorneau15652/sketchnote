// The elements that can be drawn on a page (lines, arrows, rectangles, ellipses) and the strict reading of them from a file.
// No dependency on Obsidian: tested without the application.
import { isSafeColor } from "./color";

export type Point = [number, number];

export const MAX_ELEMENTS = 20000;
export const MAX_POINTS = 500;
const MAX_COORD = 100000;
const MIN_STROKE = 0.5;
const MAX_STROKE = 40;

interface BaseElement {
  id: string;
  // Elements made by a page structure carry the group `structure`: choosing another structure replaces them.
  group?: `structure`;
  stroke: string;
  strokeWidth: number;
}

export interface LineElement extends BaseElement {
  type: `line`;
  points: Point[];
}

export interface ArrowElement extends BaseElement {
  type: `arrow`;
  points: Point[];
}

export interface RectElement extends BaseElement {
  type: `rect`;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EllipseElement extends BaseElement {
  type: `ellipse`;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type SketchElement = LineElement | ArrowElement | RectElement | EllipseElement;

export type ElementsResult = { ok: true; elements: SketchElement[] } | { ok: false; index: number } | { ok: false; tooMany: true };

// Tells whether a value is a plain object (not null, not an array).
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === `object` && value !== null && !Array.isArray(value);
}

// Tells whether a value is a finite coordinate of reasonable size.
function isCoord(value: unknown): value is number {
  return typeof value === `number` && Number.isFinite(value) && Math.abs(value) <= MAX_COORD;
}

// Tells whether a value is a strictly positive size of reasonable size.
function isSize(value: unknown): value is number {
  return isCoord(value) && value > 0;
}

// Reads a list of points: 2 to MAX_POINTS pairs of coordinates. Returns null when anything is wrong.
function readPoints(value: unknown): Point[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_POINTS) return null;
  const points: Point[] = [];
  for (const p of value) {
    if (!Array.isArray(p) || p.length !== 2 || !isCoord(p[0]) || !isCoord(p[1])) return null;
    points.push([p[0], p[1]]);
  }
  return points;
}

// Reads one element and copies only its known fields. Returns null when it is not valid.
function readElement(value: unknown): SketchElement | null {
  if (!isRecord(value)) return null;
  const { id, type, stroke, strokeWidth } = value;
  if (typeof id !== `string` || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  if (!isSafeColor(stroke)) return null;
  if (typeof strokeWidth !== `number` || !Number.isFinite(strokeWidth) || strokeWidth < MIN_STROKE || strokeWidth > MAX_STROKE) return null;
  if (value.group !== undefined && value.group !== `structure`) return null;
  const base = value.group === `structure` ? { id, group: `structure` as const, stroke, strokeWidth } : { id, stroke, strokeWidth };
  if (type === `line` || type === `arrow`) {
    const points = readPoints(value.points);
    return points === null ? null : { ...base, type, points };
  }
  if (type === `rect`) {
    const { x, y, width, height } = value;
    return isCoord(x) && isCoord(y) && isSize(width) && isSize(height) ? { ...base, type, x, y, width, height } : null;
  }
  if (type === `ellipse`) {
    const { cx, cy, rx, ry } = value;
    return isCoord(cx) && isCoord(cy) && isSize(rx) && isSize(ry) ? { ...base, type, cx, cy, rx, ry } : null;
  }
  return null;
}

// Reads the list of elements of a file. The first invalid element (or a repeated identifier) refuses the whole list, so that the view never
// saves a page after silently dropping an element. An absent list is an empty page.
export function readElements(value: unknown): ElementsResult {
  if (value === undefined) return { ok: true, elements: [] };
  if (!Array.isArray(value)) return { ok: false, index: 0 };
  if (value.length > MAX_ELEMENTS) return { ok: false, tooMany: true };
  const seen = new Set<string>();
  const elements: SketchElement[] = [];
  for (let i = 0; i < value.length; i++) {
    const el = readElement(value[i]);
    if (el === null || seen.has(el.id)) return { ok: false, index: i + 1 };
    seen.add(el.id);
    elements.push(el);
  }
  return { ok: true, elements };
}

// Returns the three points of the head of an arrow: one side, the tip and the other side. Returns null for a line of no length.
export function arrowHeadPoints(points: Point[], strokeWidth: number): [Point, Point, Point] | null {
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  if (!a || !b) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const size = Math.max(12, strokeWidth * 5);
  const cos = Math.cos(0.5);
  const sin = Math.sin(0.5);
  const side = (s: number): Point => [b[0] - size * (ux * cos - s * uy * sin), b[1] - size * (uy * cos + s * ux * sin)];
  return [side(1), b, side(-1)];
}
