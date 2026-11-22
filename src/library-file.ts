// The library of drawings: a selection of the page is kept as a drawing note (.sketchdraw) and can be put on a page again. This module makes the note from a selection and puts a note
// back as elements. Pure module: no page, no application.
import { createEmptyDrawing, CANVAS_HEIGHT, CANVAS_WIDTH, contentBox, SketchdrawDoc } from "./drawing-file";
import { newGroupId, Point, SketchElement } from "./elements";
import { centerOf, elementBounds, unionBox } from "./geometry";
import { cleanName } from "./settings";
import { inlineDrawing } from "./zone-content";
import { translate } from "./transform";

// Tells whether an element can be kept in the library: not a stroke of the structure of a page and not a frame of a drawing note of an earlier version.
export function isLibraryElement(el: SketchElement): boolean {
  return el.group !== `structure` && el.type !== `drawing`;
}

// Returns the elements of a selection that can be kept in the library.
export function libraryElements(elements: SketchElement[], ids: Set<string>): SketchElement[] {
  return elements.filter((e) => ids.has(e.id) && isLibraryElement(e));
}

// Makes the drawing note of a selection: the elements without the number of their zone, moved to the middle of the surface of a drawing, with the ink and the palette of the page.
// Returns null when nothing can be kept.
export function drawingFromSelection(elements: SketchElement[], ink: string, palette: string[]): SketchdrawDoc | null {
  if (elements.length === 0) return null;
  const box = unionBox(elements.map(elementBounds));
  if (!box) return null;
  const c = centerOf(box);
  const dx = Math.round(CANVAS_WIDTH / 2 - c[0]);
  const dy = Math.round(CANVAS_HEIGHT / 2 - c[1]);
  const kept = elements.map((e) => {
    const { slot: _s, ...rest } = e;
    void _s;
    return translate(rest as SketchElement, dx, dy);
  });
  return { ...createEmptyDrawing(ink, palette), elements: kept };
}

// The name that a drawing is proposed under: a clean name, or a default one.
export function libraryName(wanted: string, fallback: string): string {
  const clean = cleanName(wanted);
  return clean === `Sketchnote` && wanted.trim() === `` ? cleanName(fallback) : clean;
}

// The most that a drawing may take of the width of the view when it is put on a page.
export const PLACE_SHARE = 0.5;

// Returns the elements of a drawing of the library as they are put on a page: they keep their size unless the drawing is wider than a part of the view (then it is made smaller to that width),
// they are centred on a point, they get identifiers and group names that the page does not use, and they all belong to one new group, so that the drawing moves as one block.
export function placeDrawing(drawing: SketchdrawDoc, centre: Point, maxWidth: number, taken: SketchElement[]): SketchElement[] {
  const box = contentBox(drawing);
  if (!box || drawing.elements.length === 0) return [];
  const width = Math.min(box.w, Math.max(40, maxWidth));
  const height = (box.h * width) / box.w;
  const frame = { id: `library`, type: `drawing` as const, x: centre[0] - width / 2, y: centre[1] - height / 2, width, height, path: `library` };
  const placed = inlineDrawing(frame, drawing, taken);
  const group = newGroupId([...taken, ...placed]);
  return placed.map((e) => ({ ...e, groups: [...(e.groups ?? []), group] }));
}

// Returns the path of a new drawing of the library: the folder and the name, with a number after the name when that path is taken. `taken` holds the paths that are taken (compared without
// regard to the case).
export function libraryPath(folder: string, name: string, taken: Set<string>): string {
  const used = new Set([...taken].map((p) => p.toLowerCase()));
  const base = cleanName(name);
  for (let n = 1; n < 10000; n++) {
    const path = `${folder}/${n === 1 ? base : `${base} ${n}`}.sketchdraw`;
    if (!used.has(path.toLowerCase())) return path;
  }
  return `${folder}/${base} ${Date.now()}.sketchdraw`;
}
