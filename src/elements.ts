// The elements that can be drawn on a page or in a drawing, and the strict reading of them from a file.
// No dependency on Obsidian: tested without the application.
import { isSafeColor } from "./color";

export type Point = [number, number];
export type FillStyle = `solid` | `hachure`;

export const MAX_ELEMENTS = 20000;
export const MAX_POINTS = 500;
export const MAX_FREEDRAW_POINTS = 5000;
const MAX_COORD = 100000;
const MIN_STROKE = 0.5;
const MAX_STROKE = 40;
const MAX_ROUGHNESS = 3;
const MAX_SEED = 2147483647;
const MAX_PATH_LENGTH = 512;
export const MIN_FILL_OPACITY = 0.05;
const MAX_GROUPS = 8;
const MAX_SLOT = 999;

interface BaseElement {
  id: string;
  // Elements made by a page structure carry the group `structure`: choosing another structure replaces them.
  group?: `structure`;
  // The groups the element belongs to, from the innermost to the outermost (a group can hold other groups). A group is selected, moved, resized and turned as one
  // block. Same idea as in Excalidraw.
  groups?: string[];
}

// How the lines of an element look. The roughness is 0 for clean lines, 1 for a hand drawn look and 2 for a rougher one. The seed makes the
// hand drawn look identical at every drawing.
interface Strokes {
  stroke: string;
  strokeWidth: number;
  roughness?: number;
  seed?: number;
}

// A fill, for the shapes that have an inside. The opacity goes from almost transparent to 1 (opaque, the default) and only concerns the fill, not the line.
interface Fills {
  fill?: string;
  fillStyle?: FillStyle;
  fillOpacity?: number;
}

export interface LineElement extends BaseElement, Strokes {
  type: `line`;
  points: Point[];
}

export interface ArrowElement extends BaseElement, Strokes {
  type: `arrow`;
  points: Point[];
}

// A line drawn freehand with the pen.
export interface FreedrawElement extends BaseElement, Strokes {
  type: `freedraw`;
  points: Point[];
}

export interface RectElement extends BaseElement, Strokes, Fills {
  type: `rect`;
  x: number;
  y: number;
  width: number;
  height: number;
  // Rotation in degrees around the centre. Absent means 0.
  angle?: number;
}

export interface EllipseElement extends BaseElement, Strokes, Fills {
  type: `ellipse`;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  angle?: number;
}

export interface DiamondElement extends BaseElement, Strokes, Fills {
  type: `diamond`;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}

// A frame on a page that shows a drawing kept in its own note. The path is the path of the drawing note in the vault, or null while the
// drawing has not been created yet. The slot is the number of the slot of the page structure (the dotted zone) that the frame belongs to: when the
// structure changes, the frame follows its slot.
export interface DrawingElement extends BaseElement {
  type: `drawing`;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  slot?: number;
  // The shape of the dotted outline shown while the frame is empty: the shape of its zone (a rectangle by default).
  shape?: `rect` | `ellipse`;
  path: string | null;
}

export type PointsElement = LineElement | ArrowElement | FreedrawElement;
export type ShapeElement = RectElement | EllipseElement | DiamondElement;
export type StrokedElement = PointsElement | ShapeElement;
export type SketchElement = StrokedElement | DrawingElement;

export type ElementsResult = { ok: true; elements: SketchElement[] } | { ok: false; index: number } | { ok: false; tooMany: true };

// Tells whether an element is a line, an arrow or a freehand line: a list of points.
export function hasPoints(el: SketchElement): el is PointsElement {
  return el.type === `line` || el.type === `arrow` || el.type === `freedraw`;
}

// Tells whether an element has lines with a colour and a width (everything except a drawing frame).
export function isStroked(el: SketchElement): el is StrokedElement {
  return el.type !== `drawing`;
}

// Tells whether an element is a shape with an inside: a rectangle, an ellipse or a diamond.
export function isShape(el: SketchElement): el is ShapeElement {
  return el.type === `rect` || el.type === `ellipse` || el.type === `diamond`;
}

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

// Reads a list of points: at least 2 and at most `max` pairs of coordinates. Returns null when anything is wrong.
function readPoints(value: unknown, max: number): Point[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > max) return null;
  const points: Point[] = [];
  for (const p of value) {
    if (!Array.isArray(p) || p.length !== 2 || !isCoord(p[0]) || !isCoord(p[1])) return null;
    points.push([p[0], p[1]]);
  }
  return points;
}

// Reads an optional rotation in degrees. An absent angle is 0; a value that is not a finite number between -360 and 360 gives null.
function readAngle(value: unknown): number | null {
  if (value === undefined) return 0;
  return typeof value === `number` && Number.isFinite(value) && Math.abs(value) <= 360 ? value : null;
}

// Tells whether a path is a safe path of a drawing note of the vault: relative, no `..`, no control character, ending with .sketchdraw.
export function isSafeDrawingPath(value: unknown): value is string {
  if (typeof value !== `string` || value.length === 0 || value.length > MAX_PATH_LENGTH) return false;
  if (value.startsWith(`/`) || value.startsWith(`\\`) || /^[A-Za-z]:/.test(value)) return false;
  if (/[\u0000-\u001f]/.test(value)) return false;
  if (value.split(/[\\/]/).some((part) => part === `..` || part === `.`)) return false;
  return value.toLowerCase().endsWith(`.sketchdraw`);
}

// Reads the optional look fields (roughness, seed). Returns null when a field is present and wrong, otherwise the fields that are present.
function readLook(value: Record<string, unknown>): { roughness?: number; seed?: number } | null {
  const out: { roughness?: number; seed?: number } = {};
  if (value.roughness !== undefined) {
    if (typeof value.roughness !== `number` || !Number.isFinite(value.roughness) || value.roughness < 0 || value.roughness > MAX_ROUGHNESS) return null;
    out.roughness = value.roughness;
  }
  if (value.seed !== undefined) {
    if (typeof value.seed !== `number` || !Number.isInteger(value.seed) || value.seed < 1 || value.seed > MAX_SEED) return null;
    out.seed = value.seed;
  }
  return out;
}

// Reads the optional list of groups of an element. Returns null when it is present and wrong, undefined when absent.
function readGroups(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GROUPS) return null;
  for (const g of value) if (typeof g !== `string` || !/^[A-Za-z0-9_-]{1,64}$/.test(g)) return null;
  return [...(value as string[])];
}

// Reads the optional fill fields. Returns null when a field is present and wrong.
function readFill(value: Record<string, unknown>): { fill?: string; fillStyle?: FillStyle; fillOpacity?: number } | null {
  const out: { fill?: string; fillStyle?: FillStyle; fillOpacity?: number } = {};
  if (value.fillOpacity !== undefined) {
    if (typeof value.fillOpacity !== `number` || !Number.isFinite(value.fillOpacity) || value.fillOpacity < MIN_FILL_OPACITY || value.fillOpacity > 1) return null;
    out.fillOpacity = value.fillOpacity;
  }
  if (value.fill !== undefined) {
    if (!isSafeColor(value.fill)) return null;
    out.fill = value.fill;
  }
  if (value.fillStyle !== undefined) {
    if (value.fillStyle !== `solid` && value.fillStyle !== `hachure`) return null;
    out.fillStyle = value.fillStyle;
  }
  return out;
}

// Reads one element and copies only its known fields. Returns null when it is not valid.
function readElement(value: unknown): SketchElement | null {
  if (!isRecord(value)) return null;
  const { id, type } = value;
  if (typeof id !== `string` || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  if (value.group !== undefined && value.group !== `structure`) return null;
  const groups = readGroups(value.groups);
  if (groups === null) return null;
  const head = { id, ...(value.group === `structure` ? { group: `structure` as const } : {}), ...(groups ? { groups } : {}) };
  if (type === `drawing`) {
    const { x, y, width, height } = value;
    if (!isCoord(x) || !isCoord(y) || !isSize(width) || !isSize(height)) return null;
    const angle = readAngle(value.angle);
    const path = value.path === null ? null : isSafeDrawingPath(value.path) ? value.path : undefined;
    if (angle === null || path === undefined) return null;
    const slotOk = value.slot === undefined || (typeof value.slot === `number` && Number.isInteger(value.slot) && value.slot >= 0 && value.slot <= MAX_SLOT);
    if (!slotOk) return null;
    const slot = value.slot === undefined ? {} : { slot: value.slot as number };
    if (value.shape !== undefined && value.shape !== `rect` && value.shape !== `ellipse`) return null;
    const shape = value.shape === undefined ? {} : { shape: value.shape as `rect` | `ellipse` };
    return { ...head, type, x, y, width, height, ...(angle === 0 ? {} : { angle }), ...slot, ...shape, path };
  }
  const { stroke, strokeWidth } = value;
  if (!isSafeColor(stroke)) return null;
  if (typeof strokeWidth !== `number` || !Number.isFinite(strokeWidth) || strokeWidth < MIN_STROKE || strokeWidth > MAX_STROKE) return null;
  const look = readLook(value);
  if (look === null) return null;
  const base = { ...head, stroke, strokeWidth, ...look };
  if (type === `line` || type === `arrow` || type === `freedraw`) {
    const points = readPoints(value.points, type === `freedraw` ? MAX_FREEDRAW_POINTS : MAX_POINTS);
    return points === null ? null : { ...base, type, points };
  }
  const fill = readFill(value);
  const angle = readAngle(value.angle);
  if (fill === null || angle === null) return null;
  const turn = angle === 0 ? {} : { angle };
  if (type === `rect` || type === `diamond`) {
    const { x, y, width, height } = value;
    return isCoord(x) && isCoord(y) && isSize(width) && isSize(height) ? { ...base, ...fill, ...turn, type, x, y, width, height } : null;
  }
  if (type === `ellipse`) {
    const { cx, cy, rx, ry } = value;
    return isCoord(cx) && isCoord(cy) && isSize(rx) && isSize(ry) ? { ...base, ...fill, ...turn, type, cx, cy, rx, ry } : null;
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

// Returns a new identifier that no element of the list uses, made of the prefix and a number.
export function newId(elements: SketchElement[], prefix = `e`): string {
  const used = new Set(elements.map((e) => e.id));
  let n = elements.length + 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

// Returns a seed for the hand drawn look, from a number (for example the count of elements). The same number always gives the same seed.
export function seedFrom(n: number): number {
  return ((Math.imul(n + 1, 2654435761) >>> 0) % 2147483646) + 1;
}

// Returns a new group identifier that no element of the list uses.
export function newGroupId(elements: SketchElement[]): string {
  const used = new Set(elements.flatMap((e) => e.groups ?? []));
  let n = used.size + 1;
  while (used.has(`g${n}`)) n++;
  return `g${n}`;
}
