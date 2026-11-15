// The few pictograms that Obsidian does not have: fill, width and style of the lines. They are built from constants written in this file (never from user data) and
// registered once with addIcon, on a 100 by 100 grid, in the colour of the text.
import { addIcon } from "obsidian";

const Q = String.fromCharCode(34);

// Writes one SVG element from its name and its attributes (a helper, so that this file holds no quote character).
function tag(name: string, attrs: Record<string, string | number>): string {
  return `<${name} ${Object.entries(attrs).map(([k, v]) => `${k}=${Q}${v}${Q}`).join(` `)}/>`;
}

const line = { fill: `none`, stroke: `currentColor`, "stroke-linecap": `round` };
const boxed = { fill: `none`, stroke: `currentColor`, "stroke-linejoin": `round` };
const FRAME = tag(`rect`, { x: 18, y: 18, width: 64, height: 64, rx: 6, fill: `none`, stroke: `currentColor`, "stroke-width": 7 });

const ICONS: Record<string, string> = {
  "sketchnote-fill-none": FRAME,
  "sketchnote-fill-solid": tag(`rect`, { x: 18, y: 18, width: 64, height: 64, rx: 6, fill: `currentColor`, stroke: `currentColor`, "stroke-width": 7 }),
  "sketchnote-fill-hachure": FRAME + tag(`path`, { d: `M30 66L66 30M30 46L46 30M54 70L70 54`, ...line, "stroke-width": 6 }),
  "sketchnote-fill-dots": FRAME + tag(`path`, { d: `M34 34h.1M50 34h.1M66 34h.1M34 50h.1M50 50h.1M66 50h.1M34 66h.1M50 66h.1M66 66h.1`, ...line, "stroke-width": 9 }),
  "sketchnote-fill-grid": FRAME + tag(`path`, { d: `M18 38H82M18 62H82M38 18V82M62 18V82`, ...line, "stroke-width": 5 }),
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
  // Line styles, corners, borders, shadows, reflection and opacity.
  "sketchnote-line-solid": tag(`path`, { d: `M12 50H88`, ...line, "stroke-width": 8 }),
  "sketchnote-line-dashed": tag(`path`, { d: `M10 50H28M41 50H59M72 50H90`, ...line, "stroke-width": 8 }),
  "sketchnote-line-dotted": tag(`path`, { d: `M14 50.1H14.1M32 50.1H32.1M50 50.1H50.1M68 50.1H68.1M86 50.1H86.1`, ...line, "stroke-width": 11 }),
  "sketchnote-corner-square": tag(`rect`, { x: 16, y: 26, width: 68, height: 48, rx: 0, ...boxed, "stroke-width": 8 }),
  "sketchnote-corner-slight": tag(`rect`, { x: 16, y: 26, width: 68, height: 48, rx: 9, ...boxed, "stroke-width": 8 }),
  "sketchnote-corner-round": tag(`rect`, { x: 16, y: 26, width: 68, height: 48, rx: 18, ...boxed, "stroke-width": 8 }),
  "sketchnote-corner-pill": tag(`rect`, { x: 16, y: 26, width: 68, height: 48, rx: 24, ...boxed, "stroke-width": 8 }),
  // The pictograms of the borders are wide (twice as wide as high), so that the effect of each border can be imagined.
  "sketchnote-border-simple": tag(`rect`, { x: 8, y: 30, width: 84, height: 40, ...boxed, "stroke-width": 6 }),
  "sketchnote-border-none": tag(`rect`, { x: 8, y: 30, width: 84, height: 40, rx: 2, fill: `currentColor`, "fill-opacity": 0.35, stroke: `none` }),
  "sketchnote-border-double": tag(`rect`, { x: 6, y: 25, width: 88, height: 50, ...boxed, "stroke-width": 3 }) + tag(`rect`, { x: 18, y: 36, width: 64, height: 28, ...boxed, "stroke-width": 9 }),
  "sketchnote-border-double-reverse": tag(`rect`, { x: 8, y: 28, width: 84, height: 44, ...boxed, "stroke-width": 9 }) + tag(`rect`, { x: 25, y: 41, width: 50, height: 18, ...boxed, "stroke-width": 3 }),
  "sketchnote-border-frame": tag(`rect`, { x: 4, y: 22, width: 92, height: 56, ...boxed, "stroke-width": 3 }) + tag(`rect`, { x: 15, y: 32, width: 70, height: 36, ...boxed, "stroke-width": 8 }) + tag(`rect`, { x: 31, y: 45, width: 38, height: 10, ...boxed, "stroke-width": 3 }),
  "sketchnote-border-mat": tag(`rect`, { x: 10, y: 30, width: 80, height: 40, ...boxed, "stroke-width": 15 }) + tag(`rect`, { x: 33, y: 43, width: 34, height: 14, ...boxed, "stroke-width": 3 }),
  // The distortions of a text: four letters (bars) that follow the shape of the distortion.
  "sketchnote-warp-none": tag(`path`, { d: `M18 38V62M39 38V62M61 38V62M82 38V62`, ...line, "stroke-width": 8 }),
  "sketchnote-warp-arc": tag(`path`, { d: `M21.4 70.5L14.6 49.5M40.1 58.9L37.9 37.1M59.9 58.9L62.1 37.1M78.6 70.5L85.4 49.5`, ...line, "stroke-width": 8 }),
  "sketchnote-warp-wave": tag(`path`, { d: `M18 45V67M39 33V55M61 45V67M82 33V55`, ...line, "stroke-width": 8 }),
  "sketchnote-warp-slant": tag(`path`, { d: `M20 64L30 38M40 64L50 38M60 64L70 38M80 64L90 38`, ...line, "stroke-width": 8 }),
  "sketchnote-warp-perspective": tag(`path`, { d: `M18 44V56M39 40V60M61 35V65M82 28V72`, ...line, "stroke-width": 8 }),
  "sketchnote-warp-bulge": tag(`path`, { d: `M18 42V58M39 34V66M61 34V66M82 42V58`, ...line, "stroke-width": 8 }),
  // A line that is wide at its start and ends in a point.
  "sketchnote-taper": tag(`path`, { d: `M10 34L90 50L10 66Z`, fill: `currentColor`, stroke: `currentColor`, "stroke-linejoin": `round`, "stroke-width": 4 }),
  "sketchnote-shadow-none": tag(`rect`, { x: 22, y: 22, width: 52, height: 52, ...boxed, "stroke-width": 7 }),
  "sketchnote-shadow-soft": tag(`rect`, { x: 28, y: 30, width: 52, height: 52, rx: 4, fill: `currentColor`, "fill-opacity": 0.25, stroke: `none` }) + tag(`rect`, { x: 18, y: 18, width: 52, height: 52, ...boxed, "stroke-width": 7 }),
  "sketchnote-shadow-strong": tag(`rect`, { x: 30, y: 32, width: 52, height: 52, rx: 4, fill: `currentColor`, "fill-opacity": 0.55, stroke: `none` }) + tag(`rect`, { x: 16, y: 16, width: 52, height: 52, ...boxed, "stroke-width": 7 }),
  "sketchnote-shadow-offset": tag(`rect`, { x: 30, y: 30, width: 52, height: 52, fill: `currentColor`, "fill-opacity": 0.4, stroke: `none` }) + tag(`rect`, { x: 16, y: 16, width: 52, height: 52, ...boxed, "stroke-width": 7 }),
  "sketchnote-reflection": tag(`rect`, { x: 24, y: 14, width: 52, height: 30, ...boxed, "stroke-width": 7 }) + tag(`rect`, { x: 24, y: 54, width: 52, height: 30, fill: `currentColor`, "fill-opacity": 0.3, stroke: `none` }),
  "sketchnote-opacity": tag(`circle`, { cx: 50, cy: 50, r: 32, ...boxed, "stroke-width": 7 }) + tag(`path`, { d: `M50 18A32 32 0 0 1 50 82Z`, fill: `currentColor`, stroke: `none` }),
};

// Registers the pictograms of the plugin. Each head of an arrow also exists mirrored (sketchnote-head-start-...), to show the head at the start of an arrow.
export function registerIcons(): void {
  for (const [name, svg] of Object.entries(ICONS)) addIcon(name, svg);
  for (const [name, svg] of Object.entries(ICONS)) {
    if (name.startsWith(`sketchnote-head-`)) addIcon(name.replace(`sketchnote-head-`, `sketchnote-head-start-`), `<g transform=${Q}translate(100 0) scale(-1 1)${Q}>${svg}</g>`);
  }
}
