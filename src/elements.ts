// The elements that can be drawn on a page or in a drawing, and the strict reading of them from a file.
// No dependency on Obsidian: tested without the application.
import { isSafeColor } from "./color";
import { BRUSH_PARAMS, BrushFields, BrushKind, fieldsOf, isBrush, isParamValue, sparseParams } from "./brushes";
import { isClosedStroke, MAX_REGULARITY } from "./tidy";
import { DEFAULT_WARP_AMOUNT, isWarpKind, MAX_WARP_AMOUNT, WarpKind } from "./text-warp";
import { isSafePath } from "./svg-path";
import { isShapeForm, readTail, ShapeForm, Tail } from "./shape-forms";
import { EraseStroke, readErase } from "./erase-data";

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
// The most imperfect the hand drawn look can be: the roughness of an element goes from 0 (a clean line) to this.
export const MAX_ROUGHNESS = 5;
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
  // The passes of the eraser on the element (see erase.ts): the element is drawn through a mask that they cut out, and it is whole again without them.
  erase?: EraseStroke[];
  // How tall the reflection is, as a part of the height of the element (0.1 to 1, 0.6 when absent), and how much it fades away (0 for no fade, 1 for a fade to nothing, which is
  // the default).
  reflectDepth?: number;
  reflectFade?: number;
  // How far the reflection is from the element, as a part of the height of the element (0, edge to edge, when absent).
  reflectGap?: number;
  // A locked element cannot be moved, resized, turned, mirrored, deleted, written in or given another look. Absent means free.
  locked?: true;
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

export interface LineElement extends BaseElement, Strokes, Fills {
  type: `line`;
  points: Point[];
  // Rounded edges: a smooth curve goes through the points instead of straight segments.
  rounded?: boolean;
  // A text in the middle of the line, which cuts the line around it so that it can be read.
  label?: ShapeLabel;
  // How much the line is tapered: 0 for a line of constant width (absent), up to 1 for a line that is as wide as set at its start and ends in a point at its end.
  taper?: number;
}

// An arrow has the heads of its two ends. When they are absent the start has none and the end has an open arrow head.
export interface ArrowElement extends BaseElement, Strokes {
  type: `arrow`;
  points: Point[];
  rounded?: boolean;
  label?: ShapeLabel;
  taper?: number;
  startHead?: Head;
  endHead?: Head;
}

// A line drawn freehand with the pen.
export interface FreedrawElement extends BaseElement, Strokes, Fills, BrushFields {
  type: `freedraw`;
  points: Point[];
  // How much the stroke is tidied, from 0 (as drawn, not stored) to MAX_REGULARITY (the clean shape it was meant to be). A stroke that comes back to its start can have a fill.
  regularity?: number;
  // The brush (the round one when absent). Its settings (flow, hardness, spacing, form, rotation as nibAngle, grain, dynamics) are only stored when they are not the usual ones
  // of the brush.
  brush?: BrushKind;
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
  // A special form in the box (a comic bubble or a festoon, see shape-forms.ts) instead of the rectangle. A bubble also has its tail, the point that it shows, as a part of the box
  // from its centre.
  form?: ShapeForm;
  tail?: Tail;
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

// An isosceles triangle in its box: the apex is in the middle of the top side, the base is the bottom side.
export interface TriangleElement extends BaseElement, Strokes, Fills {
  type: `triangle`;
  x: number;
  y: number;
  width: number;
  height: number;
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
  // A distortion of the text (an arc, a wave, a slant, a perspective or a bulge) and its strength from -1 to 1 (0.5 when absent), and the vertical writing (the letters stacked one
  // under the other, one column for each line). The text stays a text: the letters are placed one by one when it is drawn.
  warp?: WarpKind;
  warpAmount?: number;
  vertical?: boolean;
}

export const MAX_TEXT_LENGTH = 5000;
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 400;

// Tells whether a value can be the identifier of a font: lowercase letters, digits and hyphens.
export function isFontId(value: unknown): value is string {
  return typeof value === `string` && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
}

// A drawing from a library of icons, in its box, drawn in the hand drawn look with the colour and the width of its lines. It is either an icon of Lucide, kept by its name (the shapes
// come from Obsidian), or a drawing of the user, kept with its shapes (so that the file does not depend on the file of the icon).
export interface IconElement extends BaseElement, Strokes, Fills {
  type: `icon`;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  // The name of an icon of Lucide (house, zap...).
  icon?: string;
  // For a drawing of the user: its name to show, its view box (where it starts, its width and its height) and its shapes.
  name?: string;
  vb?: [number, number, number, number];
  shapes?: IconShapeData[];
}

// A shape of an icon that is kept in an element: the data of its path, whether it is filled, whether it has a line and whether it is closed.
export interface IconShapeData {
  d: string;
  fill: boolean;
  stroke: boolean;
  closed: boolean;
}

// A picture of the vault (a PNG, a JPEG, a WebP, a GIF or an SVG file), kept by its path: the file stays in the vault and is not copied into the drawing. The box shows the part that is
// kept (see `crop`); a border and rounded corners are options. The colour, the width, the hand drawn look and the border style of the panel are the ones of the border.
export interface ImageElement extends BaseElement, Strokes {
  type: `image`;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  path: string;
  // What is cut off the picture, as a part of the whole picture, on the left, the top, the right and the bottom. Absent when nothing is cut.
  crop?: [number, number, number, number];
  radius?: number;
  // A border is drawn around the picture (absent: none), in the style of `border` (simple when absent, like the borders of the shapes).
  frame?: true;
  border?: Border;
}

// The most that can be cut off a picture on each side, and the part of the picture that must remain visible.
export const MAX_CROP_SIDE = 0.9;
export const MIN_CROP_VISIBLE = 0.1;

// The file types of the pictures that can be shown.
export const IMAGE_EXTENSIONS = [`png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`] as const;

// Tells whether a path is a safe path of a picture of the vault: relative, no `..`, no colon (so no address of a site), no control character, and the extension of a picture.
export function isSafeImagePath(value: unknown): value is string {
  if (typeof value !== `string` || value.length === 0 || value.length > MAX_PATH_LENGTH) return false;
  if (value.startsWith(`/`) || value.startsWith(`\\`) || value.includes(`:`) || /[\u0000-\u001f]/.test(value)) return false;
  if (value.split(/[\\/]/).some((part) => part === `..` || part === `.` || part === ``)) return false;
  const dot = value.lastIndexOf(`.`);
  return dot > 0 && (IMAGE_EXTENSIONS as readonly string[]).includes(value.slice(dot + 1).toLowerCase());
}

// Tells whether four numbers can be the crop of a picture: each one from 0 to the most, and a visible part left in both directions.
export function isCrop(value: unknown): value is [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === `number` && Number.isFinite(n) && n >= 0 && n <= MAX_CROP_SIDE)) return false;
  return 1 - value[0] - value[2] >= MIN_CROP_VISIBLE - 1e-9 && 1 - value[1] - value[3] >= MIN_CROP_VISIBLE - 1e-9;
}

export const MAX_ICON_SHAPES_STORED = 400;
// The most that the shapes of one icon may weigh in a file (the length of their data).
export const MAX_ICON_WEIGHT = 200000;

export type PointsElement = LineElement | ArrowElement | FreedrawElement;
export type ShapeElement = RectElement | EllipseElement | DiamondElement | TriangleElement;
export type StrokedElement = PointsElement | ShapeElement | IconElement | ImageElement;
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
  return el.type === `rect` || el.type === `ellipse` || el.type === `diamond` || el.type === `triangle`;
}

// Tells whether a line made of several segments is closed: it has at least three points and ends where it starts (a click on its first point, or a double click, closes it).
export function isClosedLine(points: Point[]): boolean {
  if (points.length < 4) return false;
  const a = points[0];
  const b = points[points.length - 1];
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
}

// Tells whether an element can have a fill: a shape, a closed line, or a pen stroke that comes back to its start.
export function canFill(el: SketchElement): el is ShapeElement | FreedrawElement | IconElement | LineElement {
  return isShape(el) || el.type === `icon` || (el.type === `freedraw` && isClosedStroke(el.points, el.strokeWidth)) || (el.type === `line` && isClosedLine(el.points));
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
function readEffects(value: Record<string, unknown>): Pick<BaseElement, `opacity` | `shadow` | `flipX` | `flipY` | `reflection` | `reflectDepth` | `reflectFade` | `reflectGap` | `erase`> | null {
  const out: Pick<BaseElement, `opacity` | `shadow` | `flipX` | `flipY` | `reflection` | `reflectDepth` | `reflectFade` | `reflectGap` | `erase`> = {};
  const erase = readErase(value.erase);
  if (erase === null) return null;
  if (erase !== undefined && erase.length > 0) out.erase = erase;
  if (value.reflectGap !== undefined) {
    if (typeof value.reflectGap !== `number` || !Number.isFinite(value.reflectGap) || value.reflectGap < 0 || value.reflectGap > 1) return null;
    if (value.reflectGap !== 0) out.reflectGap = value.reflectGap;
  }
  if (value.reflectDepth !== undefined) {
    if (typeof value.reflectDepth !== `number` || !Number.isFinite(value.reflectDepth) || value.reflectDepth < 0.1 || value.reflectDepth > 1) return null;
    if (value.reflectDepth !== 0.6) out.reflectDepth = value.reflectDepth;
  }
  if (value.reflectFade !== undefined) {
    if (typeof value.reflectFade !== `number` || !Number.isFinite(value.reflectFade) || value.reflectFade < 0 || value.reflectFade > 1) return null;
    if (value.reflectFade !== 1) out.reflectFade = value.reflectFade;
  }
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
  if (value.locked !== undefined && typeof value.locked !== `boolean`) return null;
  const head = { id, ...(value.group === `structure` ? { group: `structure` as const } : {}), ...(groups ? { groups } : {}), ...(value.locked === true ? { locked: true as const } : {}), ...effects };
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
    if (value.warp !== undefined && !isWarpKind(value.warp)) return null;
    if (value.warpAmount !== undefined && (typeof value.warpAmount !== `number` || !Number.isFinite(value.warpAmount) || Math.abs(value.warpAmount) > MAX_WARP_AMOUNT)) return null;
    if (value.vertical !== undefined && typeof value.vertical !== `boolean`) return null;
    // The strength only means something with a distortion, and the usual one is not kept.
    const warpFields = value.warp === undefined ? {} : { warp: value.warp as WarpKind, ...(typeof value.warpAmount === `number` && value.warpAmount !== DEFAULT_WARP_AMOUNT ? { warpAmount: value.warpAmount } : {}) };
    return { ...head, type, x, y, width, height, text, font, size, stroke: value.stroke, ...(value.zone === true ? { zone: true as const } : {}), ...warpFields, ...(value.vertical === true ? { vertical: true as const } : {}), ...(value.align === undefined || value.align === `left` ? {} : { align: value.align as TextAlign }), ...(angle === 0 ? {} : { angle }) };
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
    if (type === `freedraw`) {
      const fillOfStroke = readFill(value);
      if (fillOfStroke === null) return null;
      if (value.regularity !== undefined && (typeof value.regularity !== `number` || !Number.isFinite(value.regularity) || value.regularity < 0 || value.regularity > MAX_REGULARITY)) return null;
      if (value.brush !== undefined && (!isBrush(value.brush) || value.brush === `round`)) return null;
      const brush: BrushKind = value.brush === undefined ? `round` : (value.brush as BrushKind);
      // The settings of the brush: each one must be in its range, and only those that are not the usual ones of the brush are kept.
      const stored: Record<string, number> = {};
      for (const p of BRUSH_PARAMS) {
        const field = p === `rotation` ? `nibAngle` : p;
        const v = value[field];
        if (v === undefined) continue;
        if (!isParamValue(p, v)) return null;
        stored[p] = v;
      }
      const kept = fieldsOf(sparseParams(brush, stored));
      return {
        ...base,
        ...fillOfStroke,
        type,
        points,
        ...(typeof value.regularity === `number` && value.regularity > 0 ? { regularity: value.regularity } : {}),
        ...(value.brush !== undefined ? { brush } : {}),
        ...kept,
      };
    }
    const lineLabel = readLabel(value.label);
    if (lineLabel === null) return null;
    const labelField = lineLabel ? { label: lineLabel } : {};
    if (value.taper !== undefined && (typeof value.taper !== `number` || !Number.isFinite(value.taper) || value.taper < 0 || value.taper > 1)) return null;
    const taperField = typeof value.taper === `number` && value.taper > 0 ? { taper: value.taper } : {};
    if (value.rounded !== undefined && typeof value.rounded !== `boolean`) return null;
    const rounded = value.rounded === true ? { rounded: true } : {};
    if (type === `line`) {
      const lineFill = readFill(value);
      if (lineFill === null) return null;
      return { ...base, ...lineFill, type, points, ...rounded, ...labelField, ...taperField };
    }
    for (const h of [value.startHead, value.endHead]) if (h !== undefined && !HEADS.includes(h as Head)) return null;
    return {
      ...base,
      type,
      points,
      ...rounded,
      ...labelField,
      ...taperField,
      ...(value.startHead !== undefined ? { startHead: value.startHead as Head } : {}),
      ...(value.endHead !== undefined ? { endHead: value.endHead as Head } : {}),
    };
  }
  const fill = readFill(value);
  const angle = readAngle(value.angle);
  if (fill === null || angle === null) return null;
  const turn = angle === 0 ? {} : { angle };
  if (type === `icon`) {
    const { x, y, width, height } = value;
    if (!isCoord(x) || !isCoord(y) || !isSize(width) || !isSize(height)) return null;
    const lucide = value.icon === undefined ? undefined : typeof value.icon === `string` && /^[a-z0-9][a-z0-9-]{0,80}$/.test(value.icon) ? value.icon : null;
    if (lucide === null) return null;
    if (value.name !== undefined && (typeof value.name !== `string` || value.name.length > 120 || /[\u0000-\u001f]/.test(value.name))) return null;
    let customFields: { vb?: [number, number, number, number]; shapes?: IconShapeData[] } = {};
    if (value.shapes !== undefined) {
      const list = value.shapes;
      if (!Array.isArray(list) || list.length === 0 || list.length > MAX_ICON_SHAPES_STORED) return null;
      const shapes: IconShapeData[] = [];
      let weight = 0;
      for (const item of list) {
        if (!isRecord(item) || !isSafePath(item.d) || typeof item.fill !== `boolean` || typeof item.stroke !== `boolean` || typeof item.closed !== `boolean`) return null;
        weight += item.d.length;
        shapes.push({ d: item.d, fill: item.fill, stroke: item.stroke, closed: item.closed });
      }
      const vb = value.vb;
      if (weight > MAX_ICON_WEIGHT || !Array.isArray(vb) || vb.length !== 4 || !vb.every((n) => typeof n === `number` && Number.isFinite(n) && Math.abs(n) <= 100000) || (vb[2] as number) <= 0 || (vb[3] as number) <= 0) return null;
      customFields = { vb: [vb[0], vb[1], vb[2], vb[3]] as [number, number, number, number], shapes };
    } else if (value.vb !== undefined) return null;
    // An icon needs a drawing: a name of Lucide, or shapes.
    if (lucide === undefined && customFields.shapes === undefined) return null;
    return { ...base, ...fill, ...turn, type, x, y, width, height, ...(lucide !== undefined ? { icon: lucide } : {}), ...(typeof value.name === `string` && value.name !== `` ? { name: value.name } : {}), ...customFields };
  }
  if (type === `image`) {
    const { x, y, width, height } = value;
    if (!isCoord(x) || !isCoord(y) || !isSize(width) || !isSize(height) || !isSafeImagePath(value.path)) return null;
    if (value.crop !== undefined && !isCrop(value.crop)) return null;
    if (value.frame !== undefined && typeof value.frame !== `boolean`) return null;
    const frame = readBorder(value, true);
    if (frame === null) return null;
    const crop = value.crop !== undefined && (value.crop as number[]).some((n) => n > 0) ? { crop: [...(value.crop as number[])] as [number, number, number, number] } : {};
    return { ...base, ...turn, ...frame, ...crop, ...(value.frame === true ? { frame: true as const } : {}), type, x, y, width, height, path: value.path };
  }
  const border = readBorder(value, type === `rect`);
  if (border === null) return null;
  const label = readLabel(value.label);
  if (label === null) return null;
  const labelField = label ? { label } : {};
  if (type === `rect` || type === `diamond` || type === `triangle`) {
    const { x, y, width, height } = value;
    // A rectangle can have a special form and, for a bubble, a tail.
    let formFields = {};
    if (type === `rect` && value.form !== undefined) {
      if (!isShapeForm(value.form)) return null;
      const tail = value.tail === undefined ? undefined : readTail(value.tail);
      if (tail === null) return null;
      formFields = { form: value.form, ...(tail ? { tail } : {}) };
    } else if (value.tail !== undefined) return null;
    return isCoord(x) && isCoord(y) && isSize(width) && isSize(height) ? { ...base, ...fill, ...turn, ...border, ...labelField, ...formFields, type, x, y, width, height } : null;
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
