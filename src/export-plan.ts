// The rules of the exports: which part is exported, in which format, at which size and on which background, the box that holds the drawn elements, the size of the picture (limited, so
// that the browser keeps working), the name of the file and the font faces written into an exported SVG. Pure module: no page, no application.
import type { SketchElement } from "./elements";
import { Box, elementBounds, unionBox } from "./geometry";
import { outlineExtent } from "./extent";
import { cleanName } from "./settings";
import { freeName } from "./image-files";

export type ExportScope = `all` | `selection`;
export type ExportFormat = `png` | `svg` | `pdf`;
export type ExportBackground = `transparent` | `white` | `page`;

export const EXPORT_FORMATS: ExportFormat[] = [`png`, `svg`, `pdf`];
export const EXPORT_BACKGROUNDS: ExportBackground[] = [`transparent`, `white`, `page`];
// How many pixels one unit of the drawing becomes: one is the size on the screen, the others give pictures for printing.
export const EXPORT_SCALES = [1, 2, 3, 4];
// The space left around the exported elements of a drawing or of a selection, in units of the drawing.
export const EXPORT_MARGIN = 24;
// The biggest picture that is made: the longest side, and the number of pixels.
export const EXPORT_MAX_SIDE = 12000;
export const EXPORT_MAX_PIXELS = 50_000_000;

// Tells whether a value is one of the formats.
export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === `string` && (EXPORT_FORMATS as string[]).includes(value);
}

// Returns the box that holds the drawing of the elements: their boxes with the width of the lines, the shadow and the reflection, and a margin. Null for no element.
export function elementsBox(elements: SketchElement[], margin = EXPORT_MARGIN): Box | null {
  const boxes = elements.map((el) => {
    const b = elementBounds(el);
    let pad = outlineExtent(el);
    if (el.shadow) pad += Math.max(Math.abs(el.shadow.x), Math.abs(el.shadow.y)) + el.shadow.blur * 2;
    // The reflection goes below the element: as deep as it says (at least 8) and as far as its gap.
    const below = el.reflection === true ? (el.reflectGap ?? 0) * b.h + Math.max(8, (b.h + 2 * pad) * (el.reflectDepth ?? 0.6)) : 0;
    return { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad + below };
  });
  const u = unionBox(boxes);
  return u ? { x: u.x - margin, y: u.y - margin, w: u.w + 2 * margin, h: u.h + 2 * margin } : null;
}

// Returns the size in pixels of the picture of a box at a scale. The scale is lowered when the picture would be too big; `reduced` tells it.
export function fitSize(width: number, height: number, scale: number): { width: number; height: number; scale: number; reduced: boolean } {
  let s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let limit = s;
  limit = Math.min(limit, EXPORT_MAX_SIDE / Math.max(w, h), Math.sqrt(EXPORT_MAX_PIXELS / (w * h)));
  const reduced = limit < s;
  s = limit;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)), scale: s, reduced };
}

// Returns the name of the file of an export: the name of the note, the part exported and the date and time, with the extension. `used` holds the names already in the folder.
export function exportFileName(base: string, part: string, format: ExportFormat, now: Date, used: Set<string>): string {
  const p = (n: number): string => String(n).padStart(2, `0`);
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
  return freeName(`${cleanName(`${base} ${part}`)} ${stamp}.${format}`, used);
}

// Encodes bytes in base 64 (by pieces, so that a big file does not overflow the call stack).
export function toBase64(bytes: Uint8Array): string {
  let text = ``;
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export interface FontFaceData {
  // The CSS family that the texts use.
  family: string;
  // The media type of the font file and its content in base 64.
  mime: string;
  base64: string;
}

// Returns the style sheet that carries the fonts into an exported SVG: one font face for each font, written as data (nothing is loaded from outside). The family and the media type are
// checked, so that nothing but a font declaration can come out.
export function fontFaceCss(fonts: FontFaceData[]): string {
  const rules: string[] = [];
  for (const f of fonts) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(f.family) || !/^font\/(woff2|ttf|otf)$/.test(f.mime) || !/^[A-Za-z0-9+/=]*$/.test(f.base64)) continue;
    rules.push(`@font-face{font-family:${f.family};src:url(data:${f.mime};base64,${f.base64});}`);
  }
  return rules.join(`\n`);
}

// Returns the families of the fonts of the plugin (sk- and an identifier) that a font-family value names.
export function pluginFamilies(value: string): string[] {
  return value.split(`,`).map((p) => p.trim()).filter((p) => /^sk-[a-z0-9-]{1,64}$/.test(p));
}
