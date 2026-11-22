// The icons of Tabler Icons that come with the plugin (a selection, see tabler-data.ts): the entries that the window of the icons lists and the drawing of each one. The text of the data is
// read once, the first time it is needed. Pure module.
import type { IconData } from "./icon-svg";
import type { IconEntry } from "./icon-themes";
import { themesOf } from "./icon-themes";
import { TABLER_TEXT } from "./tabler-data";

interface TablerRow {
  name: string;
  theme: string;
  shapes: string[];
}

let rows: TablerRow[] | null = null;
const cache = new Map<string, IconData | null>();

// Reads the text of the data: one icon per line, name|theme|shapes. A line that is not well formed is left out.
export function readTabler(text: string): TablerRow[] {
  const out: TablerRow[] = [];
  for (const line of text.split(`\n`)) {
    const parts = line.split(`|`);
    if (parts.length !== 3 || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(parts[0]) || parts[2] === ``) continue;
    out.push({ name: parts[0], theme: parts[1], shapes: parts[2].split(`;`).filter((s) => s !== ``) });
  }
  return out;
}

function all(): TablerRow[] {
  if (!rows) rows = readTabler(TABLER_TEXT);
  return rows;
}

// The identifier of an icon of Tabler in the window of the icons (its name alone could be the one of an icon of Lucide).
export const tablerKey = (name: string): string => `tabler:${name}`;

// Returns the entries of the icons of Tabler. An icon that has no theme of its own takes the themes that its name gives.
export function tablerEntries(): IconEntry[] {
  return all().map((r) => ({ name: tablerKey(r.name), source: `tabler` as const, label: r.name, themes: r.theme === `other` ? themesOf(r.name) : [r.theme] }));
}

// Returns the drawing of an icon of Tabler from its identifier (a 24 by 24 grid, lines with no fill but the small dots), or null when it is not one of them.
export function tablerData(key: string): IconData | null {
  if (cache.has(key)) return cache.get(key) ?? null;
  const name = key.startsWith(`tabler:`) ? key.slice(7) : key;
  const row = all().find((r) => r.name === name);
  let data: IconData | null = null;
  if (row) {
    data = {
      vb: [0, 0, 24, 24],
      warnings: [],
      shapes: row.shapes.map((s) => {
        const filled = s.startsWith(`*`);
        const d = filled ? s.slice(1) : s;
        return { d, fill: filled, stroke: !filled, closed: /z\s*$/i.test(d) };
      }),
    };
  }
  cache.set(key, data);
  return data;
}
