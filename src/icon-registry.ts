// Where the shapes of an icon come from. An icon of Lucide is looked for by its name in the icons that Obsidian holds (the plugin gives the function that reads them), and kept in
// memory once read; a drawing of the user carries its shapes in its element. Pure module: the function that reads Obsidian is given by the plugin.
import type { IconElement } from "./elements";
import type { IconData } from "./icon-svg";

let lucide: ((name: string) => IconData | null) | null = null;
const cache = new Map<string, IconData | null>();

// Gives the function that reads an icon of Lucide by its name (null for none: the icons are then drawn as a dotted square).
export function setLucideSource(read: ((name: string) => IconData | null) | null): void {
  lucide = read;
  cache.clear();
}

// Returns an icon of Lucide, from its name, or null when Obsidian does not know it.
export function lucideData(name: string): IconData | null {
  if (cache.has(name)) return cache.get(name) ?? null;
  let data: IconData | null = null;
  try {
    data = lucide ? lucide(name) : null;
  } catch {
    data = null;
  }
  // An icon that has no shape is not an icon.
  if (data && data.shapes.length === 0) data = null;
  cache.set(name, data);
  return data;
}

// Returns the drawing of an icon element: its own shapes, or the icon of Lucide that it names. Null when there is none (an unknown name).
export function iconData(el: IconElement): IconData | null {
  if (el.shapes && el.vb) return { vb: el.vb, shapes: el.shapes.map((s) => ({ ...s })), warnings: [] };
  return el.icon ? lucideData(el.icon) : null;
}
