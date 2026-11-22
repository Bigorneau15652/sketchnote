// The few pictograms that Obsidian does not have: fill, width and style of the lines. They are built from constants written in this file (never from user data) and
// registered once with addIcon, on a 100 by 100 grid, in the colour of the text.
import { addIcon } from "obsidian";
import { BUBBLE_FORMS, FESTOON_FORMS, formPath } from "./shape-forms";
import { STAMP_IDS, stampShapes } from "./stamps";
import { BOTTOM_IDS, bottomIconShapes, ITEM_IDS, itemIconShapes, TOP_IDS, topIconShapes } from "./figure-items";
import { BUILD_IDS, buildIconShapes, FACE_IDS, faceIconShapes, LOOK_IDS, POSE_IDS, poseIconShapes } from "./figure";
import type { IconShapeData } from "./elements";
import { HAIR_COLORS, HAT_COLORS, PARTS, partIconShapes, SKIN_TONES } from "./portrait";

const Q = String.fromCharCode(34);

// Writes one SVG element from its name and its attributes (a helper, so that this file holds no quote character).
function tag(name: string, attrs: Record<string, string | number>): string {
  return `<${name} ${Object.entries(attrs).map(([k, v]) => `${k}=${Q}${v}${Q}`).join(` `)}/>`;
}

const line = { fill: `none`, stroke: `currentColor`, "stroke-linecap": `round` };
const boxed = { fill: `none`, stroke: `currentColor`, "stroke-linejoin": `round` };
const FRAME = tag(`rect`, { x: 18, y: 18, width: 64, height: 64, rx: 6, fill: `none`, stroke: `currentColor`, "stroke-width": 7 });

const ICONS: Record<string, string> = {
  // The button of the plugin at the top of the column of a drawing: a page and a pencil.
  "sketchnote-logo": tag(`rect`, { x: 14, y: 12, width: 52, height: 76, rx: 7, fill: `none`, stroke: `currentColor`, "stroke-width": 7 }) + tag(`path`, { d: `M27 34H53M27 50H43`, ...line, "stroke-width": 7 }) + tag(`path`, { d: `M56 80L84 36L94 43L66 87Z`, fill: `currentColor`, stroke: `currentColor`, "stroke-linejoin": `round`, "stroke-width": 4 }),
  // The pictogram of the zen mode, the same as in the plugin Bigorneau: a figure sitting cross-legged in meditation (drawn on a 24 grid, scaled to the 100 grid).
  "sketchnote-zen": `<g transform=${Q}scale(4.1667)${Q} fill=${Q}none${Q} stroke=${Q}currentColor${Q} stroke-width=${Q}2${Q} stroke-linecap=${Q}round${Q} stroke-linejoin=${Q}round${Q}>` +
    tag(`circle`, { cx: 12, cy: 4.6, r: 3, fill: `currentColor`, stroke: `none` }) +
    tag(`path`, { d: `M9 9c.9-.6 5.1-.6 6 0l.8 6.2H8.2z`, fill: `currentColor`, stroke: `none` }) +
    tag(`path`, { d: `M8.6 10.4 3.8 14.6M15.4 10.4l4.8 4.2`, "stroke-width": 2.4 }) +
    tag(`path`, { d: `M2.4 19.2c0-1.4 1-2.3 2.4-2.1l8.4 1.6c1.2.3 1.3 1.4.4 2l-4.2 1.8c-3 .9-7 .6-7-3.3z`, fill: `currentColor`, stroke: `none` }) +
    tag(`path`, { d: `M21.6 19.2c0-1.4-1-2.3-2.4-2.1l-8.4 1.6c-1.2.3-1.3 1.4-.4 2l4.2 1.8c3 .9 7 .6 7-3.3z`, fill: `currentColor`, stroke: `none`, opacity: 0.85 }) +
    `</g>`,
  // The tips of the eraser: soft (a blurred disc), round (a disc) and square.
  "sketchnote-erase-soft": tag(`circle`, { cx: 50, cy: 50, r: 34, fill: `currentColor`, "fill-opacity": 0.25, stroke: `none` }) + tag(`circle`, { cx: 50, cy: 50, r: 22, fill: `currentColor`, "fill-opacity": 0.5, stroke: `none` }) + tag(`circle`, { cx: 50, cy: 50, r: 10, fill: `currentColor`, stroke: `none` }),
  "sketchnote-erase-round": tag(`circle`, { cx: 50, cy: 50, r: 30, fill: `currentColor`, stroke: `none` }),
  "sketchnote-erase-square": tag(`rect`, { x: 22, y: 22, width: 56, height: 56, fill: `currentColor`, stroke: `none` }),
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
  // The eraser: a tilted block with its band, standing on a line.
  "sketchnote-eraser": `<g transform=${Q}rotate(-35 50 57)${Q}>` + tag(`rect`, { x: 22, y: 38, width: 56, height: 38, rx: 10, ...boxed, "stroke-width": 7 }) + tag(`path`, { d: `M46 38V76`, ...line, "stroke-width": 7 }) + `</g>` + tag(`path`, { d: `M12 91H88`, ...line, "stroke-width": 7 }),
  // The settings of the brushes: the spacing (dots in a row), the form (a flattened ellipse), the grain (scattered specks) and two circles that overlap (the opacity of an element).
  "sketchnote-brush-spacing": tag(`circle`, { cx: 18, cy: 50, r: 9, fill: `currentColor`, stroke: `none` }) + tag(`circle`, { cx: 50, cy: 50, r: 9, fill: `currentColor`, stroke: `none` }) + tag(`circle`, { cx: 82, cy: 50, r: 9, fill: `currentColor`, stroke: `none` }),
  "sketchnote-brush-form": tag(`ellipse`, { cx: 50, cy: 50, rx: 38, ry: 22, ...boxed, "stroke-width": 7 }),
  "sketchnote-paint-pot": tag(`path`, { d: `M22 38h56v42a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10Z`, ...boxed, "stroke-width": 7 }) + tag(`path`, { d: `M16 38h68M30 38V26h40v12`, ...boxed, "stroke-width": 7, "stroke-linecap": `round` }) + tag(`path`, { d: `M40 56c0 6 8 6 8 0v-4M58 62c0 6 8 6 8 0`, ...boxed, "stroke-width": 6, "stroke-linecap": `round` }),
  "sketchnote-brush-grain": [[22, 24], [52, 18], [80, 30], [34, 50], [66, 54], [18, 76], [48, 80], [82, 78]].map(([x, y]) => tag(`circle`, { cx: x, cy: y, r: 6, fill: `currentColor`, stroke: `none` })).join(``),
  "sketchnote-overlap": tag(`circle`, { cx: 38, cy: 50, r: 26, ...boxed, "stroke-width": 7 }) + tag(`circle`, { cx: 62, cy: 50, r: 26, ...boxed, "stroke-width": 7 }),
  "sketchnote-opacity": tag(`circle`, { cx: 50, cy: 50, r: 32, ...boxed, "stroke-width": 7 }) + tag(`path`, { d: `M50 18A32 32 0 0 1 50 82Z`, fill: `currentColor`, stroke: `none` }),
};

// Registers the pictograms of the plugin. Each head of an arrow also exists mirrored (sketchnote-head-start-...), to show the head at the start of an arrow.
export function registerIcons(): void {
  for (const [name, svg] of Object.entries(ICONS)) addIcon(name, svg);
  // The pictogram of each shape of the Point tool: its own shapes, filled or drawn with a line.
  for (const id of STAMP_IDS) {
    const inner = stampShapes(id).map((sh) => (sh.fill ? tag(`path`, { d: sh.d, fill: `currentColor`, stroke: `none` }) : tag(`path`, { d: sh.d, fill: `none`, stroke: `currentColor`, "stroke-width": 8, "stroke-linecap": `round`, "stroke-linejoin": `round` }))).join(``);
    addIcon(`sketchnote-stamp-${id}`, inner);
  }
  // The pictograms of the figure: each pose (a stick man), each face (a head with its expression) and each build, drawn from the same shapes as the figure on the page.
  const figureIcon = (shapes: IconShapeData[], width: number): string =>
    shapes.map((sh) => (sh.fill ? tag(`path`, { d: sh.d, fill: `currentColor`, stroke: `none` }) : tag(`path`, { d: sh.d, fill: `none`, stroke: `currentColor`, "stroke-width": width, "stroke-linecap": `round`, "stroke-linejoin": `round` }))).join(``);
  for (const id of POSE_IDS) addIcon(`sketchnote-pose-${id}`, figureIcon(poseIconShapes(id), 6));
  for (const id of FACE_IDS) addIcon(`sketchnote-face-${id}`, figureIcon(faceIconShapes(id), 6));
  for (const id of LOOK_IDS) addIcon(`sketchnote-look-${id}`, figureIcon(faceIconShapes(`happy`, id), 6));
  // The pictograms of the portrait: each choice drawn on a bare head, and a disc for each colour (the colour is its own, the line takes the colour of the text).
  for (const part of PARTS) for (const id of part.ids) addIcon(`sketchnote-part-${part.key}-${id}`, figureIcon(partIconShapes(part.key, id), 4));
  const disc = (colour: string): string => tag(`circle`, { cx: 50, cy: 50, r: 36, fill: colour, stroke: `currentColor`, "stroke-width": 6 });
  for (const [id, colour] of Object.entries(SKIN_TONES)) addIcon(`sketchnote-skin-${id}`, disc(colour));
  for (const [id, colour] of Object.entries(HAIR_COLORS)) addIcon(`sketchnote-haircolor-${id}`, disc(colour));
  for (const [id, colour] of Object.entries(HAT_COLORS)) addIcon(`sketchnote-hatcolor-${id}`, disc(colour));
  for (const id of ITEM_IDS) addIcon(`sketchnote-item-${id}`, figureIcon(itemIconShapes(id), 5));
  for (const id of TOP_IDS) addIcon(`sketchnote-top-${id}`, figureIcon(topIconShapes(id), 5));
  for (const id of BOTTOM_IDS) addIcon(`sketchnote-bottom-${id}`, figureIcon(bottomIconShapes(id), 5));
  for (const id of BUILD_IDS) addIcon(`sketchnote-build-${id}`, figureIcon(buildIconShapes(id), 5));
  // The pictogram of each form of a bubble or of a festoon is the form itself, drawn from the same data as the shape on the page.
  for (const form of [...BUBBLE_FORMS, ...FESTOON_FORMS]) {
    const d = formPath(form, 12, 14, 76, 50, undefined, 0);
    addIcon(`sketchnote-form-${form}`, tag(`path`, { d, fill: `none`, stroke: `currentColor`, "stroke-width": 7, "stroke-linejoin": `round` }));
  }
  for (const [name, svg] of Object.entries(ICONS)) {
    if (name.startsWith(`sketchnote-head-`)) addIcon(name.replace(`sketchnote-head-`, `sketchnote-head-start-`), `<g transform=${Q}translate(100 0) scale(-1 1)${Q}>${svg}</g>`);
  }
}
