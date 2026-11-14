// The elements that can be drawn on a page or in a drawing, and the strict reading of them from a file.
// No dependency on Obsidian: tested without the application.
import { isSafeColor } from "./color";

export type Point = [number, number];
// How a fill is drawn: solid, with hatching lines, with dots or with a grid (crossed hatching).
export type FillStyle = `solid` | `hachure` | `dots` | `grid`;
export const FILL_STYLES: FillStyle[] = [`solid`, `hachure`, `dots`, `grid`];
// The shape at an end of an arrow: nothing, an open arrow head, a filled triangle, a dot, a bar or a diamond.
export type Head = `none` | `arrow` | `triangle` | `dot` | `bar` | `diamond`;
export const HEADS: Head[] = [`none`, `arrow`, `triangle`, `dot`, `bar`, `diamond`];

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

// A shadow under an element: the offset, the blur, the colour and the opacity.
export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
}

// The look of the line of a shape, a line or an arrow: continuous, dashed or dotted.
export type LineStyle = `solid` | `dashed` | `dotted`;
// The border of a shape: none, a double border (a thick line and a thin one), a double border the other way round, a picture frame (a thick line between two thin ones) or a
// wide mat with a thin line inside. Absent means a simple border.
export type Border = `none` | `double` | `double-reverse` | `frame` | `mat`;
export const BORDERS: Border[] = [`none`, `double`, `double-reverse`, `frame`, `mat`];
export const MAX_RADIUS = 1000;
export const MIN_OPACITY = 0.05;

interface BaseElement {
  id: string;
  // The opacity of the whole element (the line, the fill and the text), from MIN_OPACITY to 1. Absent means opaque.
  opacity?: number;
  shadow?: Shadow;
  // Mirrored in its own frame, before its rotation. A line, an arrow and a pen stroke are mirrored by their points instead.
  flipX?: boolean;
  flipY?: boolean;
  // A faded copy of the element, upside down, under it.
  reflection?: boolean;
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
  lineStyle?: LineStyle;
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
  // Rounded edges: a smooth curve goes through the points instead of straight segments.
  rounded?: boolean;
}

// An arrow has the heads of its two ends. When they are absent the start has none and the end has an open arrow head.
export interface ArrowElement extends BaseElement, Strokes {
  type: `arrow`;
  points: Point[];
  rounded?: boolean;
  startHead?: Head;
  endHead?: Head;
}

// A line drawn freehand with the pen.
export interface FreedrawElement extends BaseElement, Strokes {
  type: `freedraw`;
  points: Point[];
}

// A text written inside a shape (a rectangle, an ellipse or a diamond). It belongs to the shape: it moves, turns, is copied and deleted with it. It is centred in the
// shape (the middle of the part inside), wraps to the width of that part and takes its colour from the fill. The size is one of the sizes of texts.
export interface ShapeLabel {
  text: string;
  font: string;
  size: number;
  align?: TextAlign;
}

export interface RectElement extends BaseElement, Strokes, Fills {
  type: `rect`;
  x: number;
  y: number;
  width: number;
  height: number;
  // Rotation in degrees around the centre. Absent means 0.
  angle?: number;
  // The radius of the corners. Absent means square corners.
  radius?: number;
  border?: Border;
  label?: ShapeLabel;
}

export interface EllipseElement extends BaseElement, Strokes, Fills {
  type: `ellipse`;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  angle?: number;
  border?: Border;
  label?: ShapeLabel;
}

export interface DiamondElement extends BaseElement, Strokes, Fills {
  type: `diamond`;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  border?: Border;
  label?: ShapeLabel;
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

// A text of one or several lines, written in a font (the identifier of a built-in or imported font) at a size. The box is the measured size of the text, kept in the file so that it can
// be selected and drawn without measuring again. The colour of the text is `stroke`.
export type TextAlign = `left` | `center` | `right`;
export const TEXT_ALIGNS: TextAlign[] = [`left`, `center`, `right`];
export interface TextElement extends BaseElement {
  type: `text`;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  text: string;
  font: string;
  size: number;
  align?: TextAlign;
  stroke: string;
  // A text zone: the width and the height are the ones of the zone that the user drew (shown dotted when selected); the text wraps to its width. Absent for a text
  // that is only as large as its lines.
  zone?: boolean;
}

export const MAX_TEXT_LENGTH = 5000;
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 400;

// Tells whether a value can be the identifier of a font: lowercase letters, digits and hyphens.
export function isFontId(value: unknown): value is string {
  return typeof value === `string` && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
}

export type PointsElement = LineElement | ArrowElement | FreedrawElement;
export type ShapeElement = RectElement | EllipseElement | DiamondElement;
export type StrokedElement = PointsElement | ShapeElement;
export type SketchElement = StrokedElement | DrawingElement | TextElement;

export type ElementsResult = { ok: true; elements: SketchElement[] } | { ok: false; index: number } | { ok: false; tooMany: true };

// Tells whether an element is a line, an arrow or a freehand line: a list of points.
export function hasPoints(el: SketchElement): el is PointsElement {
  return el.type === `line` || el.type === `arrow` || el.type === `freedraw`;
}

// Tells whether an element has lines with a colour and a width (everything except a drawing frame and a text).
export function isStroked(el: SketchElement): el is StrokedElement {
  return el.type !== `drawing` && el.type !== `text`;
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
    if (!FILL_STYLES.includes(value.fillStyle as FillStyle)) return null;
    out.fillStyle = value.fillStyle as FillStyle;
  }
  return out;
}

// Reads the optional effects shared by every element (opacity, shadow, mirror, reflection). Returns null when a field is present and wrong, otherwise the fields present.
function readEffects(value: Record<string, unknown>): Pick<BaseElement, `opacity` | `shadow` | `flipX` | `flipY` | `reflection`> | null {
  const out: Pick<BaseElement, `opacity` | `shadow` | `flipX` | `flipY` | `reflection`> = {};
  if (value.opacity !== undefined) {
    if (typeof value.opacity !== `number` || !Number.isFinite(value.opacity) || value.opacity < MIN_OPACITY || value.opacity > 1) return null;
    if (value.opacity < 1) out.opacity = value.opacity;
  }
  if (value.shadow !== undefined) {
    const sh = value.shadow;
    if (!isRecord(sh)) return null;
    const { x, y, blur, color, opacity } = sh;
    if (typeof x !== `number` || typeof y !== `number` || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 200 || Math.abs(y) > 200) return null;
    if (typeof blur !== `number` || !Number.isFinite(blur) || blur < 0 || blur > 100) return null;
    if (!isSafeColor(color)) return null;
    if (typeof opacity !== `number` || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) return null;
    out.shadow = { x, y, blur, color, opacity };
  }
  for (const key of [`flipX`, `flipY`, `reflection`] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== `boolean`) return null;
    if (value[key] === true) out[key] = true;
  }
  return out;
}

// Reads the optional border of a shape: its kind and, for a rectangle, the radius of its corners. Returns null when a field is present and wrong.
function readBorder(value: Record<string, unknown>, withRadius: boolean): { border?: Border; radius?: number } | null {
  const out: { border?: Border; radius?: number } = {};
  if (value.border !== undefined) {
    if (!BORDERS.includes(value.border as Border)) return null;
    out.border = value.border as Border;
  }
  if (value.radius !== undefined && withRadius) {
    if (typeof value.radius !== `number` || !Number.isFinite(value.radius) || value.radius < 0 || value.radius > MAX_RADIUS) return null;
    if (value.radius > 0) out.radius = value.radius;
  }
  return out;
}

// Reads the optional label of a shape: a text, a font, a size and an alignment. Returns null when it is present and wrong, undefined when absent.
function readLabel(value: unknown): ShapeLabel | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const { text, font, size, align } = value;
  if (typeof text !== `string` || text.length === 0 || text.length > MAX_TEXT_LENGTH || !isFontId(font)) return null;
  if (typeof size !== `number` || !Number.isFinite(size) || size < MIN_FONT_SIZE || size > MAX_FONT_SIZE) return null;
  if (align !== undefined && !TEXT_ALIGNS.includes(align as TextAlign)) return null;
  return { text, font, size, ...(align === undefined ? {} : { align: align as TextAlign }) };
}

// Reads one element and copies only its known fields. Returns null when it is not valid.
function readElement(value: unknown): SketchElement | null {
  if (!isRecord(value)) return null;
  const { id, type } = value;
  if (typeof id !== `string` || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  if (value.group !== undefined && value.group !== `structure`) return null;
  const groups = readGroups(value.groups);
  if (groups === null) return null;
  const effects = readEffects(value);
  if (effects === null) return null;
  const head = { id, ...(value.group === `structure` ? { group: `structure` as const } : {}), ...(groups ? { groups } : {}), ...effects };
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
  if (type === `text`) {
    const { x, y, width, height, text, font, size } = value;
    if (!isCoord(x) || !isCoord(y) || !isSize(width) || !isSize(height) || !isSafeColor(value.stroke)) return null;
    if (typeof text !== `string` || text.length === 0 || text.length > MAX_TEXT_LENGTH || !isFontId(font)) return null;
    if (typeof size !== `number` || !Number.isFinite(size) || size < MIN_FONT_SIZE || size > MAX_FONT_SIZE) return null;
    if (value.align !== undefined && !TEXT_ALIGNS.includes(value.align as TextAlign)) return null;
    const angle = readAngle(value.angle);
    if (angle === null) return null;
    if (value.zone !== undefined && typeof value.zone !== `boolean`) return null;
    return { ...head, type, x, y, width, height, text, font, size, stroke: value.stroke, ...(value.zone === true ? { zone: true as const } : {}), ...(value.align === undefined || value.align === `left` ? {} : { align: value.align as TextAlign }), ...(angle === 0 ? {} : { angle }) };
  }
  const { stroke, strokeWidth } = value;
  if (!isSafeColor(stroke)) return null;
  if (typeof strokeWidth !== `number` || !Number.isFinite(strokeWidth) || strokeWidth < MIN_STROKE || strokeWidth > MAX_STROKE) return null;
  const look = readLook(value);
  if (look === null) return null;
  if (value.lineStyle !== undefined && value.lineStyle !== `solid` && value.lineStyle !== `dashed` && value.lineStyle !== `dotted`) return null;
  const lineStyle = value.lineStyle === `dashed` || value.lineStyle === `dotted` ? { lineStyle: value.lineStyle as LineStyle } : {};
  const base = { ...head, stroke, strokeWidth, ...look, ...lineStyle };
  if (type === `line` || type === `arrow` || type === `freedraw`) {
    const points = readPoints(value.points, type === `freedraw` ? MAX_FREEDRAW_POINTS : MAX_POINTS);
    if (points === null) return null;
    if (type === `freedraw`) return { ...base, type, points };
    if (value.rounded !== undefined && typeof value.rounded !== `boolean`) return null;
    const rounded = value.rounded === true ? { rounded: true } : {};
    if (type === `line`) return { ...base, type, points, ...rounded };
    for (const h of [value.startHead, value.endHead]) if (h !== undefined && !HEADS.includes(h as Head)) return null;
    return {
      ...base,
      type,
      points,
      ...rounded,
      ...(value.startHead !== undefined ? { startHead: value.startHead as Head } : {}),
      ...(value.endHead !== undefined ? { endHead: value.endHead as Head } : {}),
    };
  }
  const fill = readFill(value);
  const angle = readAngle(value.angle);
  if (fill === null || angle === null) return null;
  const turn = angle === 0 ? {} : { angle };
  const border = readBorder(value, type === `rect`);
  if (border === null) return null;
  const label = readLabel(value.label);
  if (label === null) return null;
  const labelField = label ? { label } : {};
  if (type === `rect` || type === `diamond`) {
    const { x, y, width, height } = value;
    return isCoord(x) && isCoord(y) && isSize(width) && isSize(height) ? { ...base, ...fill, ...turn, ...border, ...labelField, type, x, y, width, height } : null;
  }
  if (type === `ellipse`) {
    const { cx, cy, rx, ry } = value;
    return isCoord(cx) && isCoord(cy) && isSize(rx) && isSize(ry) ? { ...base, ...fill, ...turn, ...border, ...labelField, type, cx, cy, rx, ry } : null;
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

// Returns the head at one end of an arrow, with the defaults: nothing at the start and an open arrow head at the end.
export function headOf(el: ArrowElement, end: `start` | `end`): Head {
  return (end === `start` ? el.startHead : el.endHead) ?? (end === `start` ? `none` : `arrow`);
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
