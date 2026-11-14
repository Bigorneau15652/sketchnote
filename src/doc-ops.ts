// Pure operations on a whole document: applying new page settings and a new structure together.
import type { SketchnoteDoc, PageSettings } from "./file-format";
import { DrawingElement, isStroked, newId, SketchElement } from "./elements";
import { buildStructure, LayoutSettings, sameLayout, Slot } from "./layout";

// Moves and scales the frames of drawings so that each one keeps its place in its slot when the slots change (another number of zones, another structure, another
// page size). A frame keeps its distance from the centre of its slot and its size, both in proportion to the slot, so that a drawing made larger than its slot stays
// larger. An empty zone that was not touched keeps filling its zone. A frame whose slot does not exist any more becomes a free frame.
export function remapFrames(elements: SketchElement[], oldSlots: Slot[], newSlots: Slot[]): SketchElement[] {
  return elements.flatMap((el): SketchElement[] => {
    if (el.type !== `drawing` || el.slot === undefined) return [el];
    const from = oldSlots[el.slot];
    const to = newSlots[el.slot];
    if (!to) {
      // The zone is gone: an empty frame goes with it; a frame that holds a drawing stays, as a free frame.
      if (el.path === null) return [];
      const { slot: _s, shape: _h, ...free } = el;
      void _s;
      void _h;
      return [free];
    }
    if (!from || from.width <= 0) return [el];
    // An empty zone that the user did not touch keeps filling its zone, whatever the new proportions of the zone.
    const untouched = el.path === null && Math.abs(el.x - from.x) < 0.5 && Math.abs(el.y - from.y) < 0.5 && Math.abs(el.width - from.width) < 0.5 && Math.abs(el.height - from.height) < 0.5;
    if (untouched) return [{ ...el, x: to.x, y: to.y, width: to.width, height: to.height }];
    const k = to.width / from.width;
    const cx = to.x + to.width / 2 + (el.x + el.width / 2 - (from.x + from.width / 2)) * k;
    const cy = to.y + to.height / 2 + (el.y + el.height / 2 - (from.y + from.height / 2)) * k;
    const width = Math.round(el.width * k * 100) / 100;
    const height = Math.round(el.height * k * 100) / 100;
    return [{ ...el, x: Math.round((cx - width / 2) * 100) / 100, y: Math.round((cy - height / 2) * 100) / 100, width, height }];
  });
}

// Returns the frame of a zone: an empty drawing frame that fills the slot. Every zone of a structure has one from the start, so that a zone can be selected, moved,
// resized and opened like any other element.
export function zoneFrame(slot: Slot, index: number, id: string): DrawingElement {
  return { id, type: `drawing`, x: slot.x, y: slot.y, width: slot.width, height: slot.height, slot: index, shape: slot.shape, path: null };
}

// Makes sure that each zone of the structure has its frame, and that no frame belongs to a zone that does not exist. A zone frame that is empty and has no zone left is
// removed; one that holds a drawing becomes a free frame. Without a structure the same rule applies to every zone frame. Returns the same document when nothing changes.
export function ensureZoneFrames(doc: SketchnoteDoc): SketchnoteDoc {
  const slots = doc.layout ? buildStructure(doc.layout, doc.page).slots : [];
  let changed = false;
  const out: SketchElement[] = [];
  const have = new Set<number>();
  for (const el of doc.elements) {
    if (el.type !== `drawing` || el.slot === undefined) {
      out.push(el);
      continue;
    }
    if (el.slot >= slots.length) {
      changed = true;
      if (el.path !== null) {
        const { slot: _s, shape: _h, ...free } = el;
        void _s;
        void _h;
        out.push(free);
      }
      continue;
    }
    have.add(el.slot);
    const shape = slots[el.slot].shape;
    if (el.shape !== shape) {
      changed = true;
      out.push({ ...el, shape });
    } else {
      out.push(el);
    }
  }
  slots.forEach((s, i) => {
    if (have.has(i)) return;
    changed = true;
    out.push(zoneFrame(s, i, newId(out)));
  });
  return changed ? { ...doc, elements: out } : doc;
}

// Returns the document with new page settings and a new structure (or none).
// The elements of the structure (group `structure`) are made again when the structure or the page size changes, and removed when the structure is removed.
// They are drawn first, so they stay behind the contents. When only the default ink changes, the structure elements that had the old ink take the new one.
// Every other element is kept as it is.
export function applySettings(doc: SketchnoteDoc, page: PageSettings, layout: LayoutSettings | null): SketchnoteDoc {
  const own = doc.elements.filter((e) => e.group !== `structure`);
  if (layout === null) return ensureZoneFrames({ ...doc, page, layout: null, elements: own });
  const sizeChanged = page.width !== doc.page.width || page.height !== doc.page.height;
  if (sizeChanged || !sameLayout(doc.layout, layout)) {
    const next = buildStructure(layout, page);
    const moved = doc.layout === null ? own : remapFrames(own, buildStructure(doc.layout, doc.page).slots, next.slots);
    return ensureZoneFrames({ ...doc, page, layout, elements: [...next.elements, ...moved] });
  }
  if (page.ink !== doc.page.ink) {
    const elements = doc.elements.map((e) => (e.group === `structure` && isStroked(e) && e.stroke === doc.page.ink ? { ...e, stroke: page.ink } : e));
    return { ...doc, page, layout, elements };
  }
  return { ...doc, page, layout };
}

// Writes a value as JSON with the keys of every object in alphabetical order, so that two values with the same content give the same text
// whatever the order of their fields (a file that was read again does not list the fields in the order the generator uses).
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(`,`)}]`;
  if (value !== null && typeof value === `object`) {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(`,`)}}`;
  }
  return JSON.stringify(value);
}

// Tells whether the user has changed what the structure drew (moved, resized, rotated or deleted a separator, an arrow or a link).
// Replacing the structure would then lose those changes, so the view asks first.
export function structureEdited(doc: SketchnoteDoc): boolean {
  if (doc.layout === null) return false;
  const current = doc.elements.filter((e) => e.group === `structure`);
  return canonical(current) !== canonical(buildStructure(doc.layout, doc.page).elements);
}
