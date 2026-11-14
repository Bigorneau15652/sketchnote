// Locking of elements: a locked element stays where it is and as it is (it cannot be moved, resized, turned, mirrored, deleted, written in or given another look), while the
// other elements of the page stay free. The lock is saved in the file. Pure module: no access to the page.
import type { SketchElement } from "./elements";

// Tells whether an element is locked.
export function isLocked(el: SketchElement): boolean {
  return el.locked === true;
}

// Returns an element locked or unlocked (an unlocked element carries no field, like a file of the previous versions).
export function withLock(el: SketchElement, on: boolean): SketchElement {
  if (on) return el.locked === true ? el : { ...el, locked: true };
  if (el.locked !== true) return el;
  const { locked: _l, ...rest } = el;
  void _l;
  return rest as SketchElement;
}

// Returns the list with the elements of `ids` locked or unlocked. The other elements are returned as they are.
export function lockElements(elements: SketchElement[], ids: Set<string>, on: boolean): SketchElement[] {
  return elements.map((e) => (ids.has(e.id) ? withLock(e, on) : e));
}

// Tells what the lock button does for a selection: it locks when at least one selected element is free, and unlocks when all of them are locked. Null for no selection.
export function lockAction(elements: SketchElement[], ids: Set<string>): `lock` | `unlock` | null {
  const chosen = elements.filter((e) => ids.has(e.id));
  if (chosen.length === 0) return null;
  return chosen.every(isLocked) ? `unlock` : `lock`;
}

// Returns the identifiers of the elements of `ids` that are not locked.
export function freeIds(elements: SketchElement[], ids: Set<string>): Set<string> {
  return new Set(elements.filter((e) => ids.has(e.id) && !isLocked(e)).map((e) => e.id));
}

// Tells whether every selected element is locked (and there is at least one).
export function allLocked(elements: SketchElement[], ids: Set<string>): boolean {
  return lockAction(elements, ids) === `unlock`;
}

// Tells whether at least one selected element is locked.
export function anyLocked(elements: SketchElement[], ids: Set<string>): boolean {
  return elements.some((e) => ids.has(e.id) && isLocked(e));
}
