// The data of the eraser: the passes kept on an element and their strict reading from a file. Pure module, with no dependency on the geometry (the file format reads it).
import type { Point } from "./elements";

// The tip of the eraser: soft (blurred edge), round or square.
export type EraseShape = `soft` | `round` | `square`;
export const ERASE_SHAPES: EraseShape[] = [`soft`, `round`, `square`];

export interface EraseStroke {
  // The points of the pass, as parts of the box of the element (0 to 1 inside it, and beyond it for what is outside).
  points: Point[];
  // The width of the tip in page units, the tip and how much it erases (from 0.1, a trace, to 1, everything).
  size: number;
  shape: EraseShape;
  density: number;
}

export const MIN_ERASE_SIZE = 2;
export const MAX_ERASE_SIZE = 200;
export const DEFAULT_ERASE_SIZE = 30;
export const MIN_ERASE_DENSITY = 0.1;
// What a file may hold, so that a damaged or hostile file cannot make a page unreadable: the passes of one element and the points of one pass.
export const MAX_ERASE_STROKES = 400;
export const MAX_ERASE_POINTS = 3000;
// The most that is far from the box of an element, as a part of it.
export const FAR = 100;


export function isEraseShape(value: unknown): value is EraseShape {
  return typeof value === `string` && (ERASE_SHAPES as string[]).includes(value);
}

// Returns the passes of an eraser read from a file, or null when something in them is wrong. An absent value gives undefined.
export function readErase(value: unknown): EraseStroke[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_ERASE_STROKES) return null;
  const out: EraseStroke[] = [];
  for (const item of value) {
    if (typeof item !== `object` || item === null || Array.isArray(item)) return null;
    const s = item as Record<string, unknown>;
    if (!Array.isArray(s.points) || s.points.length === 0 || s.points.length > MAX_ERASE_POINTS) return null;
    const points: Point[] = [];
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== `number` || typeof p[1] !== `number` || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > FAR || Math.abs(p[1]) > FAR) return null;
      points.push([p[0], p[1]]);
    }
    if (typeof s.size !== `number` || !Number.isFinite(s.size) || s.size < MIN_ERASE_SIZE || s.size > MAX_ERASE_SIZE) return null;
    if (!isEraseShape(s.shape)) return null;
    if (typeof s.density !== `number` || !Number.isFinite(s.density) || s.density < MIN_ERASE_DENSITY || s.density > 1) return null;
    out.push({ points, size: s.size, shape: s.shape, density: s.density });
  }
  return out;
}

// Cleans the settings of a pass: the size and the density are brought into their limits.
export function cleanEraseSize(size: number): number {
  return Math.round(Math.min(MAX_ERASE_SIZE, Math.max(MIN_ERASE_SIZE, size)));
}

export function cleanEraseDensity(density: number): number {
  return Math.round(Math.min(1, Math.max(MIN_ERASE_DENSITY, density)) * 100) / 100;
}
