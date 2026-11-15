// Pure operations on a selection of elements: delete, copy, duplicate, change the order and nudge.
import { newId, SketchElement } from "./elements";
import { boxesIntersect, elementBounds, unionBox } from "./geometry";
import { isLocked } from "./lock";
import { translate } from "./transform";

// Returns the elements without the selected ones. A locked element is never removed.
export function removeElements(elements: SketchElement[], ids: Set<string>): SketchElement[] {
  return elements.filter((e) => !ids.has(e.id) || isLocked(e));
}

// Returns copies of the selected elements (in drawing order) moved by an offset, with new identifiers that do not clash with the list.
// A copy is never part of a structure: it belongs to the user and survives a change of structure. The copies of a group form a new group of their own, so that the
// copy is independent of the original.
export function cloneElements(elements: SketchElement[], source: SketchElement[], dx: number, dy: number): SketchElement[] {
  const all = [...elements];
  const out: SketchElement[] = [];
  const usedGroups = new Set(elements.flatMap((e) => e.groups ?? []));
  const groupMap = new Map<string, string>();
  // Returns the new group that takes the place of an old one in the copies (always the same one for the same old group).
  const copyOfGroup = (old: string): string => {
    const known = groupMap.get(old);
    if (known !== undefined) return known;
    let n = usedGroups.size + 1;
    while (usedGroups.has(`g${n}`)) n++;
    const fresh = `g${n}`;
    usedGroups.add(fresh);
    groupMap.set(old, fresh);
    return fresh;
  };
  for (const el of source) {
    const { group: _g, groups, locked: _k, ...rest } = el;
    void _g;
    void _k;
    const mapped = (groups ?? []).map(copyOfGroup);
    const copy = translate({ ...rest, ...(mapped.length > 0 ? { groups: mapped } : {}), id: newId(all) } as SketchElement, dx, dy);
    all.push(copy);
    out.push(copy);
  }
  return out;
}

// Moves the selected elements to the front (end of the list) or to the back (start of the list), keeping their order.
export function reorder(elements: SketchElement[], ids: Set<string>, where: `front` | `back`): SketchElement[] {
  const chosen = elements.filter((e) => ids.has(e.id) && !isLocked(e));
  const others = elements.filter((e) => !ids.has(e.id) || isLocked(e));
  return where === `front` ? [...others, ...chosen] : [...chosen, ...others];
}

// Moves the selected elements one level up or down: they pass the nearest element that overlaps them (an element far away would change nothing that can be seen). The
// selected elements that are not locked move together and keep their order. When nothing overlaps them in that direction, the list does not change.
export function reorderStep(elements: SketchElement[], ids: Set<string>, where: `up` | `down`): SketchElement[] {
  const indexes: number[] = [];
  elements.forEach((e, i) => {
    if (ids.has(e.id) && !isLocked(e)) indexes.push(i);
  });
  if (indexes.length === 0) return elements;
  const chosen = indexes.map((i) => elements[i]);
  const area = unionBox(chosen.map((e) => elementBounds(e)));
  if (!area) return elements;
  const overlaps = (e: SketchElement): boolean => boxesIntersect(elementBounds(e), area);
  const isChosen = (e: SketchElement): boolean => ids.has(e.id) && !isLocked(e);
  let target = -1;
  if (where === `up`) {
    for (let j = indexes[indexes.length - 1] + 1; j < elements.length; j++) {
      if (!isChosen(elements[j]) && overlaps(elements[j])) {
        target = j;
        break;
      }
    }
  } else {
    for (let j = indexes[0] - 1; j >= 0; j--) {
      if (!isChosen(elements[j]) && overlaps(elements[j])) {
        target = j;
        break;
      }
    }
  }
  if (target < 0) return elements;
  const out: SketchElement[] = [];
  elements.forEach((e, i) => {
    if (isChosen(e)) return;
    if (i === target && where === `down`) out.push(...chosen);
    out.push(e);
    if (i === target && where === `up`) out.push(...chosen);
  });
  return out;
}

// Returns the list with the selected elements moved by a distance.
export function moveElements(elements: SketchElement[], ids: Set<string>, dx: number, dy: number): SketchElement[] {
  return elements.map((e) => (ids.has(e.id) && !isLocked(e) ? translate(e, dx, dy) : e));
}
