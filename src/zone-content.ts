// The content of the zones of a page. A zone is one of the dotted places of the structure; what is drawn in it is a set of ordinary elements of the page that carry the number of
// their zone (the field `slot`). A zone can be selected, moved, resized and turned as one block, and it follows its place when the structure or the size of the page changes.
// Drawings that were kept in notes of their own (the frames of the previous versions) are brought into the page by inlineDrawing. Pure module: no page, no application.
import { DrawingElement, newGroupId, Point, SketchElement } from "./elements";
import { fitInFrame, SketchdrawDoc, contentBox } from "./drawing-file";
import { Box, elementBounds, unionBox } from "./geometry";
import type { Slot } from "./layout";
import { scaleAbout, translate, rotateAbout } from "./transform";
import { MAX_WIDTH, MIN_WIDTH } from "./style";

const r2 = (n: number): number => Math.round(n * 100) / 100;

// Returns the elements of a zone, in drawing order.
// A frame of a drawing note (the drawings of the previous versions) has a slot too, but it is not content of a zone: it is brought into the page.
const inZone = (e: SketchElement): boolean => e.slot !== undefined && e.type !== `drawing`;

export function elementsOfZone(elements: SketchElement[], index: number): SketchElement[] {
  return elements.filter((e) => inZone(e) && e.slot === index);
}

// Tells whether a zone has something drawn in it.
export function zoneIsEmpty(elements: SketchElement[], index: number): boolean {
  return !elements.some((e) => inZone(e) && e.slot === index);
}

// Returns the box that holds what is drawn in a zone, or null when the zone is empty.
export function zoneBounds(elements: SketchElement[], index: number): Box | null {
  return unionBox(elementsOfZone(elements, index).map(elementBounds));
}

// Returns a set of ids widened to every element of the zones that those elements belong to: a click on a drawing of a zone selects the whole zone.
export function expandToZones(elements: SketchElement[], ids: Set<string>): Set<string> {
  const zones = new Set<number>();
  for (const el of elements) if (ids.has(el.id) && inZone(el) && el.slot !== undefined) zones.add(el.slot);
  if (zones.size === 0) return new Set(ids);
  const out = new Set(ids);
  for (const el of elements) if (inZone(el) && el.slot !== undefined && zones.has(el.slot)) out.add(el.id);
  return out;
}

// Returns an element with a zone (or without, for undefined).
export function withZone(el: SketchElement, zone: number | undefined): SketchElement {
  if (zone === undefined) {
    if (el.slot === undefined) return el;
    const { slot: _z, ...rest } = el;
    void _z;
    return rest as SketchElement;
  }
  return el.slot === zone ? el : ({ ...el, slot: zone } as SketchElement);
}

// Scales an element by a factor about a point, with the width of its lines (a drawing that is made smaller has thinner lines, as it has in a frame).
export function scaleWithLines(el: SketchElement, anchor: Point, k: number): SketchElement {
  const scaled = scaleAbout(el, anchor, k);
  if (!(`strokeWidth` in scaled) || typeof scaled.strokeWidth !== `number`) return scaled;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, r2(scaled.strokeWidth * k)));
  return { ...scaled, strokeWidth: width } as SketchElement;
}

// Brings a drawing that was kept in a note of its own into the page, in the place and at the scale where its frame showed it. The elements get new identifiers (and new group
// names) that the page does not use, and the number of the zone of the frame. A frame that is not in a zone gives free elements. `taken` holds the elements of the page.
export function inlineDrawing(frame: DrawingElement, drawing: SketchdrawDoc, taken: SketchElement[]): SketchElement[] {
  const box = contentBox(drawing);
  if (!box || drawing.elements.length === 0) return [];
  const fit = fitInFrame(frame.x, frame.y, frame.width, box);
  const used: SketchElement[] = [...taken];
  const groupNames = new Map<string, string>();
  const centre: Point = [frame.x + frame.width / 2, frame.y + frame.height / 2];
  const out: SketchElement[] = [];
  for (const source of drawing.elements) {
    if (source.type === `drawing`) continue;
    let el = scaleWithLines(source, [0, 0], fit.scale);
    el = translate(el, r2(fit.tx), r2(fit.ty));
    if (frame.angle) el = rotateAbout(el, centre, frame.angle);
    let id = `e${used.length + 1}`;
    const ids = new Set(used.map((e) => e.id));
    while (ids.has(id)) id = `e${Number(id.slice(1)) + 1}`;
    const groups = (el.groups ?? []).map((g) => {
      let name = groupNames.get(g);
      if (!name) {
        name = newGroupId([...used, ...out.map((o) => ({ ...o, groups: [...(o.groups ?? [])] }))]);
        groupNames.set(g, name);
        // The new name is reserved by a marker element in the list of used groups.
        used.push({ id: `group-${name}`, type: `line`, points: [[0, 0], [0, 0]], stroke: `#000000`, strokeWidth: 1, groups: [name] } as SketchElement);
      }
      return name;
    });
    const { groups: _g, slot: _z, ...rest } = el;
    void [_g, _z];
    const made = { ...rest, id, ...(groups.length > 0 ? { groups } : {}), ...(frame.slot !== undefined ? { slot: frame.slot } : {}) } as SketchElement;
    out.push(made);
    used.push(made);
  }
  return out;
}

// Moves and scales what is drawn in each zone so that it keeps its place in its zone when the zones change (another number of zones, another structure, another page size):
// it keeps its distance from the centre of the zone, in proportion to the zone, and its size in the same proportion. The drawing is never distorted (one factor for both
// directions). What is in a zone that does not exist any more stays in the page as free elements.
export function remapZoneElements(elements: SketchElement[], oldSlots: Slot[], newSlots: Slot[]): SketchElement[] {
  return elements.map((el): SketchElement => {
    if (!inZone(el) || el.slot === undefined) return el;
    const from = oldSlots[el.slot];
    const to = newSlots[el.slot];
    if (!to) return withZone(el, undefined);
    if (!from || from.width <= 0 || from.height <= 0) return el;
    const k = Math.min(to.width / from.width, to.height / from.height);
    const fromCentre: Point = [from.x + from.width / 2, from.y + from.height / 2];
    const toCentre: Point = [to.x + to.width / 2, to.y + to.height / 2];
    if (Math.abs(k - 1) < 1e-6 && Math.abs(fromCentre[0] - toCentre[0]) < 0.01 && Math.abs(fromCentre[1] - toCentre[1]) < 0.01) return el;
    // Scale about the old centre, then bring that centre to the new one.
    return translate(scaleWithLines(el, fromCentre, k), r2(toCentre[0] - fromCentre[0]), r2(toCentre[1] - fromCentre[1]));
  });
}

// Returns the frames of a page that hold a drawing note (the drawings of the previous versions), to be brought into the page.
export function framesToInline(elements: SketchElement[]): DrawingElement[] {
  return elements.filter((e): e is DrawingElement => e.type === `drawing` && e.path !== null);
}

// Returns the elements of a page without the frames that were brought in or that were empty zones, and with the new elements added in their place at the end.
export function withoutFrames(elements: SketchElement[], inlined: Set<string>): SketchElement[] {
  return elements.filter((e) => !(e.type === `drawing` && (e.path === null || inlined.has(e.id))));
}
