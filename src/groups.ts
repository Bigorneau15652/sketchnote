// Groups of elements, with the same rules as Excalidraw: an element keeps the list of its groups (the innermost first); clicking an element selects the whole
// outermost group it belongs to, unless the user is editing that group (a double click on a member). Pure module, tested without Obsidian.
import { newGroupId, SketchElement } from "./elements";

// Returns the group that a click on an element selects: its outermost group, leaving out the group being edited and the groups outside it. Null when the element is
// alone.
export function topGroupId(el: SketchElement, editing: string | null): string | null {
  let groups = el.groups ?? [];
  if (editing !== null) {
    const at = groups.indexOf(editing);
    if (at >= 0) groups = groups.slice(0, at);
  }
  return groups.length > 0 ? groups[groups.length - 1] : null;
}

// Returns the ids of a selection widened to the whole groups of its elements: when one member of a group is selected, all the members are.
export function expandToGroups(elements: SketchElement[], ids: Set<string>, editing: string | null): Set<string> {
  const tops = new Set<string>();
  for (const el of elements) {
    if (!ids.has(el.id)) continue;
    const t = topGroupId(el, editing);
    if (t !== null) tops.add(t);
  }
  if (tops.size === 0) return new Set(ids);
  const out = new Set(ids);
  for (const el of elements) if ((el.groups ?? []).some((g) => tops.has(g))) out.add(el.id);
  return out;
}

// Tells whether an element can be part of a group: the strokes of a page structure and the zone frames belong to the structure and stay out.
export function isGroupable(el: SketchElement): boolean {
  if (el.group === `structure`) return false;
  return !(el.type === `drawing` && el.slot !== undefined);
}

export type GroupAction = `group` | `ungroup` | null;

// Tells what the group button does for a selection: ungroup when the selection is exactly one whole group, group when two or more elements (or groups) are selected,
// nothing otherwise (a single element, or elements that cannot be grouped).
export function groupAction(elements: SketchElement[], ids: Set<string>, editing: string | null): GroupAction {
  const selected = elements.filter((e) => ids.has(e.id));
  if (selected.length === 0 || !selected.every(isGroupable)) return null;
  const tops = new Set(selected.map((e) => topGroupId(e, editing)));
  if (tops.size === 1) {
    const top = [...tops][0];
    if (top !== null) {
      const members = elements.filter((e) => (e.groups ?? []).includes(top));
      return members.length === selected.length ? `ungroup` : selected.length >= 2 ? `group` : null;
    }
  }
  return selected.length >= 2 ? `group` : null;
}

// Tells whether at least one selected element belongs to a group (the palette command Ungroup works then).
export function canUngroup(elements: SketchElement[], ids: Set<string>, editing: string | null): boolean {
  return elements.some((e) => ids.has(e.id) && topGroupId(e, editing) !== null);
}

// Puts the selected elements in a new group, outside of the groups they may already be in. Returns the list and the id of the new group.
export function groupElements(elements: SketchElement[], ids: Set<string>): { elements: SketchElement[]; groupId: string } {
  const groupId = newGroupId(elements);
  return { elements: elements.map((e) => (ids.has(e.id) ? { ...e, groups: [...(e.groups ?? []), groupId] } : e)), groupId };
}

// Takes the selected groups apart: each selected element leaves its outermost group (within the group being edited). The members stay where they are.
export function ungroupElements(elements: SketchElement[], ids: Set<string>, editing: string | null): SketchElement[] {
  return elements.map((e) => {
    if (!ids.has(e.id)) return e;
    const top = topGroupId(e, editing);
    if (top === null) return e;
    const groups = (e.groups ?? []).filter((g) => g !== top);
    const { groups: _g, ...rest } = e;
    void _g;
    return (groups.length > 0 ? { ...rest, groups } : rest) as SketchElement;
  });
}
