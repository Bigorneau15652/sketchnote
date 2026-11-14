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
  "sketchnote-edge-sharp": tag(`path`, { d: `M14 74L40 26L62 70L86 30`, ...line, "stroke-linejoin": `miter`, "stroke-width": 8 }),
  "sketchnote-edge-round": tag(`path`, { d: `M14 74C30 20 48 20 56 50S76 74 86 30`, ...line, "stroke-width": 8 }),
  "sketchnote-head-none": tag(`path`, { d: `M14 50H80`, ...line, "stroke-width": 8 }),
  "sketchnote-head-arrow": tag(`path`, { d: `M14 50H84M62 28L84 50L62 72`, ...line, "stroke-linejoin": `round`, "stroke-width": 8 }),
  "sketchnote-head-triangle": tag(`path`, { d: `M14 50H58`, ...line, "stroke-width": 8 }) + tag(`path`, { d: `M56 28L88 50L56 72Z`, fill: `currentColor`, stroke: `currentColor`, "stroke-linejoin": `round`, "stroke-width": 6 }),
  "sketchnote-head-dot": tag(`path`, { d: `M14 50H70`, ...line, "stroke-width": 8 }) + tag(`circle`, { cx: 76, cy: 50, r: 14, fill: `currentColor` }),
  "sketchnote-head-bar": tag(`path`, { d: `M14 50H84M84 26V74`, ...line, "stroke-width": 8 }),
  "sketchnote-head-diamond": tag(`path`, { d: `M14 50H52`, ...line, "stroke-width": 8 }) + tag(`path`, { d: `M52 50L70 30L88 50L70 70Z`, fill: `currentColor`, stroke: `currentColor`, "stroke-linejoin": `round`, "stroke-width": 5 }),
  // The letter A at four sizes, for the size of texts.
  "sketchnote-size-small": tag(`path`, { d: `M32 74L50 38L68 74M39 62H61`, ...line, "stroke-linejoin": `round`, "stroke-width": 7 }),
  "sketchnote-size-medium": tag(`path`, { d: `M26 76L50 30L74 76M35 60H65`, ...line, "stroke-linejoin": `round`, "stroke-width": 8 }),
  "sketchnote-size-large": tag(`path`, { d: `M20 80L50 22L80 80M31 58H69`, ...line, "stroke-linejoin": `round`, "stroke-width": 9 }),
  "sketchnote-size-huge": tag(`path`, { d: `M12 86L50 14L88 86M26 56H74`, ...line, "stroke-linejoin": `round`, "stroke-width": 10 }),
};

// Registers the pictograms of the plugin.
export function registerIcons(): void {
  for (const [name, svg] of Object.entries(ICONS)) addIcon(name, svg);
}
