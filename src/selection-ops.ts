// Pure operations on a selection of elements: delete, copy, duplicate, change the order and nudge.
import { newId, SketchElement } from "./elements";
import { translate } from "./transform";

// Returns the elements without the selected ones.
export function removeElements(elements: SketchElement[], ids: Set<string>): SketchElement[] {
  return elements.filter((e) => !ids.has(e.id));
}

// Returns copies of the selected elements (in drawing order) moved by an offset, with new identifiers that do not clash with the list.
// A copy is never part of a structure: it belongs to the user and survives a change of structure.
export function cloneElements(elements: SketchElement[], source: SketchElement[], dx: number, dy: number): SketchElement[] {
  const all = [...elements];
  const out: SketchElement[] = [];
  for (const el of source) {
    const { group: _g, ...rest } = el;
    void _g;
    const copy = translate({ ...rest, id: newId(all) } as SketchElement, dx, dy);
    all.push(copy);
    out.push(copy);
  }
  return out;
}

// Moves the selected elements to the front (end of the list) or to the back (start of the list), keeping their order.
export function reorder(elements: SketchElement[], ids: Set<string>, where: `front` | `back`): SketchElement[] {
  const chosen = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return where === `front` ? [...others, ...chosen] : [...chosen, ...others];
}

// Returns the list with the selected elements moved by a distance.
export function moveElements(elements: SketchElement[], ids: Set<string>, dx: number, dy: number): SketchElement[] {
  return elements.map((e) => (ids.has(e.id) ? translate(e, dx, dy) : e));
}
