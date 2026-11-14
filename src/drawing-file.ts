// The .sketchdraw file: one drawing kept in its own note, and how a drawing is fitted into a frame of a page. No dependency on Obsidian.
import { defaultPaletteFor, isPalette, isSafeColor, MAX_PALETTE, MIN_PALETTE } from "./color";
import { ElementsResult, readElements, SketchElement } from "./elements";
import { Box, elementBounds, unionBox } from "./geometry";
import { t } from "./i18n";

export const DRAW_FORMAT_NAME = `sketchdraw`;
export const DRAW_FORMAT_VERSION = 1;
export const MAX_DRAW_FILE_CHARS = 50 * 1024 * 1024;
// Size of the drawing surface, in pixels. A drawing is drawn anywhere on it; the part that holds elements is what a page shows.
export const CANVAS_WIDTH = 2400;
export const CANVAS_HEIGHT = 1800;
export { MAX_PALETTE, MIN_PALETTE };

export interface SketchdrawDoc {
  format: typeof DRAW_FORMAT_NAME;
  version: number;
  // Default ink colour of the drawing (white when it was made on a chalkboard page).
  ink: string;
  // Colours offered first in the tools, copied from the page at creation.
  palette: string[];
  elements: SketchElement[];
}

export type DrawParseResult = { ok: true; doc: SketchdrawDoc } | { ok: false; error: string };

// Returns a new empty drawing.
export function createEmptyDrawing(ink = `#000000`, palette: string[] = defaultPaletteFor(ink)): SketchdrawDoc {
  return { format: DRAW_FORMAT_NAME, version: DRAW_FORMAT_VERSION, ink, palette: [...palette], elements: [] };
}

// Reads the text of a .sketchdraw file with the same strictness as a sketchnote: every field is checked and copied.
export function parseSketchdraw(text: string): DrawParseResult {
  if (text.length > MAX_DRAW_FILE_CHARS) return { ok: false, error: t(`Le fichier est trop volumineux.`) };
  if (text.trim() === ``) return { ok: false, error: t(`Le fichier est vide ou n'est pas du JSON valide.`) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t(`Le fichier est vide ou n'est pas du JSON valide.`) };
  }
  if (typeof raw !== `object` || raw === null || Array.isArray(raw)) return { ok: false, error: t(`Le fichier n'est pas un dessin sketchnote.`) };
  const r = raw as Record<string, unknown>;
  if (r.format !== DRAW_FORMAT_NAME) return { ok: false, error: t(`Le fichier n'est pas un dessin sketchnote.`) };
  if (r.version !== DRAW_FORMAT_VERSION) return { ok: false, error: t(`Version de fichier non prise en charge : {0}.`, String(r.version)) };
  const ink = r.ink === undefined ? `#000000` : r.ink;
  if (!isSafeColor(ink)) return { ok: false, error: t(`Le dessin est invalide.`) };
  const palette = r.palette === undefined ? defaultPaletteFor(ink) : r.palette;
  if (!isPalette(palette)) return { ok: false, error: t(`Le dessin est invalide.`) };
  const elements: ElementsResult = readElements(r.elements);
  if (!elements.ok) return { ok: false, error: `tooMany` in elements ? t(`Trop d'éléments sur la page.`) : t(`Élément {0} invalide.`, elements.index) };
  // A drawing cannot hold a frame of a drawing: that would allow a drawing to contain itself.
  const bad = elements.elements.findIndex((e) => e.type === `drawing`);
  if (bad >= 0) return { ok: false, error: t(`Élément {0} invalide.`, bad + 1) };
  return { ok: true, doc: { format: DRAW_FORMAT_NAME, version: DRAW_FORMAT_VERSION, ink, palette: [...palette], elements: elements.elements } };
}

// Writes a drawing as the text of a .sketchdraw file.
export function serializeSketchdraw(doc: SketchdrawDoc): string {
  return JSON.stringify(doc, null, 2) + `\n`;
}

// Returns the box that holds every element of a drawing, with a margin (the width of the lines is included), or null for an empty drawing.
export function contentBox(doc: SketchdrawDoc, margin = 8): Box | null {
  const boxes = doc.elements.map((e) => {
    const b = elementBounds(e);
    const pad = `strokeWidth` in e ? e.strokeWidth / 2 : 0;
    return { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
  });
  const u = unionBox(boxes);
  return u ? { x: u.x - margin, y: u.y - margin, w: u.w + 2 * margin, h: u.h + 2 * margin } : null;
}

// Returns how a drawing fits into a frame of a given width: the scale, the translation of the drawing and the height of the frame. The width is kept and the
// height takes the proportions of the drawing, like a picture.
export function fitInFrame(frameX: number, frameY: number, frameWidth: number, box: Box): { scale: number; tx: number; ty: number; height: number } {
  const scale = box.w > 0 ? frameWidth / box.w : 1;
  return { scale, tx: frameX - box.x * scale, ty: frameY - box.y * scale, height: box.h * scale };
}

// Rewrites the text of a sketchnote file so that the frames that pointed to a drawing note point to its new path. Returns the new text, or null when
// the file has no such frame or cannot be read (a file that is not understood is never touched).
export function renameReferences(text: string, oldPath: string, newPath: string): string | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== `object` || raw === null || Array.isArray(raw)) return null;
  const doc = raw as { format?: unknown; elements?: unknown };
  if (doc.format !== `sketchnote` || !Array.isArray(doc.elements)) return null;
  let changed = false;
  for (const el of doc.elements) {
    if (typeof el === `object` && el !== null && (el as { type?: unknown }).type === `drawing` && (el as { path?: unknown }).path === oldPath) {
      (el as { path: string }).path = newPath;
      changed = true;
    }
  }
  return changed ? JSON.stringify(doc, null, 2) + `\n` : null;
}
