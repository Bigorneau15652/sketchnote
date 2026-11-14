// The few pictograms that Obsidian does not have: fill, width and style of the lines. They are built from constants written in this file (never from user data) and
// registered once with addIcon, on a 100 by 100 grid, in the colour of the text.
import { addIcon } from "obsidian";

const Q = String.fromCharCode(34);

// Writes one SVG element from its name and its attributes (a helper, so that this file holds no quote character).
function tag(name: string, attrs: Record<string, string | number>): string {
  return `<${name} ${Object.entries(attrs).map(([k, v]) => `${k}=${Q}${v}${Q}`).join(` `)}/>`;
}

const line = { fill: `none`, stroke: `currentColor`, "stroke-linecap": `round` };
const FRAME = tag(`rect`, { x: 18, y: 18, width: 64, height: 64, rx: 6, fill: `none`, stroke: `currentColor`, "stroke-width": 7 });

const ICONS: Record<string, string> = {
  "sketchnote-fill-none": FRAME,
  "sketchnote-fill-solid": tag(`rect`, { x: 18, y: 18, width: 64, height: 64, rx: 6, fill: `currentColor`, stroke: `currentColor`, "stroke-width": 7 }),
  "sketchnote-fill-hachure": FRAME + tag(`path`, { d: `M30 66L66 30M30 46L46 30M54 70L70 54`, ...line, "stroke-width": 6 }),
  "sketchnote-width-thin": tag(`path`, { d: `M14 50H86`, ...line, "stroke-width": 5 }),
  "sketchnote-width-medium": tag(`path`, { d: `M14 50H86`, ...line, "stroke-width": 11 }),
  "sketchnote-width-thick": tag(`path`, { d: `M14 50H86`, ...line, "stroke-width": 20 }),
  "sketchnote-style-sketch": tag(`path`, { d: `M12 56C26 38 36 66 50 48S72 40 88 52`, ...line, "stroke-width": 8 }),
  "sketchnote-style-clean": tag(`path`, { d: `M12 50H88`, ...line, "stroke-width": 8 }),
};

// Registers the pictograms of the plugin.
export function registerIcons(): void {
  for (const [name, svg] of Object.entries(ICONS)) addIcon(name, svg);
}
