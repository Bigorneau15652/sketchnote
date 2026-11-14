// Draws the elements of a page or of a drawing into an SVG group. Built with the DOM only: nothing is ever parsed from text.
// A hand drawn or clean line comes from shape-paths; a frame of a drawing shows the drawing it points to, fitted to its width.
import { DrawingElement, isStroked, SketchElement, TextElement } from "./elements";
import { boxOf, elementBounds } from "./geometry";
import { fontStack } from "./fonts";
import { lineMiddle, textLines } from "./text-layout";
import { contentBox, fitInFrame, SketchdrawDoc } from "./drawing-file";
import { slotStyle } from "./page-background";
import { elementPaths } from "./shape-paths";
import { svgEl } from "./svg";

// Gives the content of a drawing note from its path, or null when it is unknown or not loaded yet.
export type DrawingLookup = (path: string) => SketchdrawDoc | null;

// What the drawing of elements needs to know: where to find the content of drawings, whether the dotted outline of the empty zones is shown (the eye button of
// the page), and the colour of the page (to choose the colour of that outline).
export interface RenderOptions {
  lookup: DrawingLookup | null;
  showZones: boolean;
  background: string;
}

// Options for the drawing inside a frame and for a drawing surface: no nested drawings and no zones.
export const PLAIN: RenderOptions = { lookup: null, showZones: false, background: `#ffffff` };

// Returns the transform that mirrors an element in its own frame (about the middle of its box, before its rotation), or null when it is not mirrored. A line, an arrow
// and a pen stroke have no such mirror: they are mirrored by their points.
function flipOf(el: SketchElement): string | null {
  if (el.type === `line` || el.type === `arrow` || el.type === `freedraw`) return null;
  if (el.flipX !== true && el.flipY !== true) return null;
  const { box } = boxOf(el);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return `translate(${el.flipX === true ? 2 * cx : 0} ${el.flipY === true ? 2 * cy : 0}) scale(${el.flipX === true ? -1 : 1} ${el.flipY === true ? -1 : 1})`;
}

// Returns the group that holds the content of an element: the mirror of the element when it has one, otherwise the parent itself.
function mirrored(el: SketchElement, parent: Element): Element {
  const flip = flipOf(el);
  return flip ? svgEl(`g`, { transform: flip }, parent) : parent;
}

// Draws one element with a stroke (everything except a drawing frame and a text).
function drawStroked(el: Exclude<SketchElement, DrawingElement | TextElement>, parent: Element): void {
  const { pieces, transform } = elementPaths(el);
  const turned = svgEl(`g`, transform ? { transform } : {}, parent);
  const group = mirrored(el, turned);
  for (const p of pieces) {
    svgEl(`path`, { d: p.d, stroke: p.stroke, "stroke-width": p.strokeWidth, fill: p.fill, ...(p.opacity < 1 ? { opacity: p.opacity } : {}), ...(p.dash ? { "stroke-dasharray": p.dash } : {}), "stroke-linecap": `round`, "stroke-linejoin": `round` }, group);
  }
}

// Draws a text: one line of the SVG text for each line of the text, each one centred on its own height, so that the position does not depend on the font. The lines keep
// their spaces and are set from the text of the element as plain text.
function drawText(el: TextElement, parent: Element): void {
  const anchor = el.align === `center` ? `middle` : el.align === `right` ? `end` : `start`;
  const x = el.align === `center` ? el.x + el.width / 2 : el.align === `right` ? el.x + el.width : el.x;
  const turn: Record<string, string> = el.angle ? { transform: `rotate(${el.angle} ${el.x + el.width / 2} ${el.y + el.height / 2})` } : {};
  const holder = mirrored(el, svgEl(`g`, turn, parent));
  const group = svgEl(`text`, { class: `sketchnote-text`, "font-family": fontStack(el.font), "font-size": el.size, fill: el.stroke, "text-anchor": anchor, "dominant-baseline": `central`, style: `white-space:pre` }, holder);
  textLines(el.text).forEach((line, i) => {
    const row = svgEl(`tspan`, { x, y: el.y + lineMiddle(i, el.size) }, group);
    row.textContent = line === `` ? ` ` : line;
  });
}

// Draws the frame of a drawing. A frame that holds a drawing shows only the drawing (no outline: the selection frame of the editor appears when it is selected). An
// empty frame shows the dotted outline of its zone, unless the eye button hid the zones.
function drawFrame(el: DrawingElement, parent: Element, options: RenderOptions): void {
  const turn: Record<string, string> = el.angle ? { transform: `rotate(${el.angle} ${el.x + el.width / 2} ${el.y + el.height / 2})` } : {};
  const doc = el.path !== null && options.lookup ? options.lookup(el.path) : null;
  const box = doc ? contentBox(doc) : null;
  if (doc && box) {
    const group = mirrored(el, svgEl(`g`, { class: `sketchnote-frame`, ...turn }, parent));
    const fit = fitInFrame(el.x, el.y, el.width, box);
    const inner = svgEl(`g`, { transform: `translate(${fit.tx} ${fit.ty}) scale(${fit.scale})` }, group);
    drawElements(doc.elements, inner, PLAIN);
    return;
  }
  if (!options.showZones) return;
  const style = slotStyle(options.background);
  const look = { class: `sketchnote-frame-empty`, fill: style.color, "fill-opacity": style.fillOpacity, stroke: style.color, "stroke-opacity": style.strokeOpacity, "stroke-width": 1.5, "stroke-dasharray": `8 6` };
  const group = svgEl(`g`, { ...turn }, parent);
  if (el.shape === `ellipse`) svgEl(`ellipse`, { cx: el.x + el.width / 2, cy: el.y + el.height / 2, rx: el.width / 2, ry: el.height / 2, ...look }, group);
  else svgEl(`rect`, { x: el.x, y: el.y, width: el.width, height: el.height, rx: 6, ...look }, group);
}

// Draws an element without its effects.
function drawBare(el: SketchElement, parent: Element, options: RenderOptions): void {
  if (isStroked(el)) drawStroked(el, parent);
  else if (el.type === `text`) drawText(el, parent);
  else drawFrame(el, parent, options);
}

// A number that makes the identifiers of the filters and masks of every drawn element different, so that two drawings with the same element names never share one.
let effectCount = 0;

// Draws one element of the page or of a drawing into a parent, with its effects: the opacity of the whole element, a shadow under it and a faded reflection below it.
export function drawElement(el: SketchElement, parent: Element, options: RenderOptions): void {
  if (el.opacity === undefined && el.shadow === undefined && el.reflection !== true) {
    drawBare(el, parent, options);
    return;
  }
  effectCount++;
  const id = `skfx${effectCount}`;
  const outer = svgEl(`g`, el.opacity !== undefined ? { opacity: el.opacity } : {}, parent);
  const defs = svgEl(`defs`, {}, outer);
  const b = elementBounds(el);
  let target: Element = outer;
  if (el.shadow) {
    // The region of the filter is written in page units: a horizontal line has no height, which would give an empty region with the default units of a filter.
    const margin = el.shadow.blur * 3 + Math.max(Math.abs(el.shadow.x), Math.abs(el.shadow.y)) + 40;
    const filter = svgEl(`filter`, { id: `${id}-f`, filterUnits: `userSpaceOnUse`, x: b.x - margin, y: b.y - margin, width: b.w + 2 * margin, height: b.h + 2 * margin }, defs);
    svgEl(`feDropShadow`, { dx: el.shadow.x, dy: el.shadow.y, stdDeviation: el.shadow.blur / 2, "flood-color": el.shadow.color, "flood-opacity": el.shadow.opacity }, filter);
    target = svgEl(`g`, { filter: `url(#${id}-f)` }, outer);
  }
  const content = svgEl(`g`, { id: `${id}-c` }, target);
  drawBare(el, content, options);
  if (el.reflection === true) {
    const bottom = b.y + b.h;
    const gradient = svgEl(`linearGradient`, { id: `${id}-g`, gradientUnits: `userSpaceOnUse`, x1: 0, y1: bottom, x2: 0, y2: bottom - Math.max(8, b.h * 0.6) }, defs);
    svgEl(`stop`, { offset: 0, "stop-color": `#ffffff`, "stop-opacity": 1 }, gradient);
    svgEl(`stop`, { offset: 1, "stop-color": `#ffffff`, "stop-opacity": 0 }, gradient);
    const mask = svgEl(`mask`, { id: `${id}-m`, maskUnits: `userSpaceOnUse`, x: b.x - 40, y: b.y - 40, width: b.w + 80, height: b.h + 80 }, defs);
    svgEl(`rect`, { x: b.x - 40, y: b.y - 40, width: b.w + 80, height: b.h + 80, fill: `url(#${id}-g)` }, mask);
    const mirror = svgEl(`g`, { transform: `translate(0 ${2 * bottom + 4}) scale(1 -1)`, opacity: 0.45, mask: `url(#${id}-m)` }, outer);
    svgEl(`use`, { href: `#${id}-c` }, mirror);
  }
}

// Draws a list of elements into a group, in order (the first one is at the back).
export function drawElements(elements: SketchElement[], parent: Element, options: RenderOptions): void {
  for (const el of elements) drawElement(el, parent, options);
}
