// Draws the elements of a page or of a drawing into an SVG group. Built with the DOM only: nothing is ever parsed from text.
// A hand drawn or clean line comes from shape-paths; a frame of a drawing shows the drawing it points to, fitted to its width.
import { DEFAULT_WARP_AMOUNT, glyphTransform, layoutWarp } from "./text-warp";
import { ArrowElement, DrawingElement, isStroked, LineElement, SketchElement, TextElement } from "./elements";
import { outlineExtent } from "./extent";
import { boxOf, elementBounds } from "./geometry";
import { fontStack } from "./fonts";
import { labelColor, labelLayout, LabeledShape, lineLabelLayout } from "./labels";
import { measureLine } from "./measure";
import { lineMiddle, textLines, wrapLines } from "./text-layout";
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
  // The ink of the drawing (black, or white for a drawing made on a chalkboard): the colour of the text written in a shape that has no fill.
  ink: string;
}

// Options for the drawing inside a frame and for a drawing surface: no nested drawings and no zones.
export const PLAIN: RenderOptions = { lookup: null, showZones: false, background: `#ffffff`, ink: `#000000` };

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
function drawStroked(el: Exclude<SketchElement, DrawingElement | TextElement>, parent: Element, options: RenderOptions): void {
  const { pieces, transform, holes } = elementPaths(el);
  const turned = svgEl(`g`, transform ? { transform } : {}, parent);
  const group = mirrored(el, turned);
  // The gaps of a brush with little paint on it cut the pieces of the brush with a mask (white everywhere, black in the gaps); a soft edge is a blur of the piece.
  let target: Element = group;
  let defs: Element | null = null;
  if (holes && holes.d !== ``) {
    effectCount++;
    const id = `skbr${effectCount}`;
    defs = svgEl(`defs`, {}, group);
    const mask = svgEl(`mask`, { id: `${id}-m`, maskUnits: `userSpaceOnUse`, x: holes.box.x, y: holes.box.y, width: holes.box.w, height: holes.box.h }, defs);
    svgEl(`rect`, { x: holes.box.x, y: holes.box.y, width: holes.box.w, height: holes.box.h, fill: `#ffffff` }, mask);
    svgEl(`path`, { d: holes.d, fill: `#000000`, stroke: `none` }, mask);
    target = svgEl(`g`, { mask: `url(#${id}-m)` }, group);
  }
  for (const p of pieces) {
    let into: Element = p.masked ? target : group;
    if (p.blur) {
      // The region of the filter is written in page units, so that a thin line keeps its soft edge.
      effectCount++;
      const fid = `skbl${effectCount}`;
      defs = defs ?? svgEl(`defs`, {}, group);
      const fdefs = defs;
      const margin = p.blur * 4 + 4;
      const box = holes ? holes.box : { x: -1e5, y: -1e5, w: 2e5, h: 2e5 };
      const filter = svgEl(`filter`, { id: fid, filterUnits: `userSpaceOnUse`, x: box.x - margin, y: box.y - margin, width: box.w + 2 * margin, height: box.h + 2 * margin }, fdefs);
      svgEl(`feGaussianBlur`, { stdDeviation: p.blur }, filter);
      into = svgEl(`g`, { filter: `url(#${fid})` }, into);
    }
    svgEl(`path`, { d: p.d, stroke: p.stroke, "stroke-width": p.strokeWidth, fill: p.fill, ...(p.opacity < 1 ? { opacity: p.opacity } : {}), ...(p.dash ? { "stroke-dasharray": p.dash } : {}), "stroke-linecap": `round`, "stroke-linejoin": `round` }, into);
  }
  if ((el.type === `rect` || el.type === `ellipse` || el.type === `diamond` || el.type === `triangle`) && el.label) drawLabel(el, group, options.ink);
  if ((el.type === `line` || el.type === `arrow`) && el.label) drawLineLabel(el, turned);
}

// Draws the text in the middle of a line or an arrow, and cuts the line around it (a mask that takes a box out of the line, so that the page or the shape behind shows through)
// to make the text readable. The text is horizontal and has the colour of the line.
function drawLineLabel(el: LineElement | ArrowElement, parent: Element): void {
  const label = el.label;
  if (!label) return;
  const layout = lineLabelLayout(el, label, measureLine);
  effectCount++;
  const id = `skcut${effectCount}`;
  const b = elementBounds(el);
  const pad = el.strokeWidth * 4 + 60;
  const defs = svgEl(`defs`, {}, parent);
  const mask = svgEl(`mask`, { id, maskUnits: `userSpaceOnUse`, x: b.x - pad, y: b.y - pad, width: b.w + 2 * pad, height: b.h + 2 * pad }, defs);
  svgEl(`rect`, { x: b.x - pad, y: b.y - pad, width: b.w + 2 * pad, height: b.h + 2 * pad, fill: `#ffffff` }, mask);
  svgEl(`rect`, { x: layout.cut.x, y: layout.cut.y, width: layout.cut.w, height: layout.cut.h, fill: `#000000` }, mask);
  // The line (everything drawn so far in the group of the element) is masked: its paths are moved into a group that carries the mask.
  const cutGroup = svgEl(`g`, { mask: `url(#${id})` }, parent);
  for (const child of Array.from(parent.children)) if (child !== defs && child !== cutGroup) cutGroup.appendChild(child);
  const anchor = layout.align === `center` ? `middle` : layout.align === `right` ? `end` : `start`;
  const text = svgEl(`text`, { class: `sketchnote-text sketchnote-label`, "font-family": fontStack(label.font), "font-size": label.size, fill: el.stroke, "text-anchor": anchor, "dominant-baseline": `central`, style: `white-space:pre` }, parent);
  layout.lines.forEach((line, i) => {
    const row = svgEl(`tspan`, { x: layout.anchorX, y: layout.top + lineMiddle(i, label.size) }, text);
    row.textContent = line === `` ? ` ` : line;
  });
}

// Draws the text written inside a shape: its lines wrapped to the part of the shape that holds them, centred in height, in the colour that suits the fill.
function drawLabel(el: LabeledShape, parent: Element, ink: string): void {
  const label = el.label;
  if (!label) return;
  const layout = labelLayout(el, label, measureLine);
  const anchor = layout.align === `center` ? `middle` : layout.align === `right` ? `end` : `start`;
  const text = svgEl(`text`, { class: `sketchnote-text sketchnote-label`, "font-family": fontStack(label.font), "font-size": label.size, fill: labelColor(el, ink), "text-anchor": anchor, "dominant-baseline": `central`, style: `white-space:pre` }, parent);
  layout.lines.forEach((line, i) => {
    const row = svgEl(`tspan`, { x: layout.anchorX, y: layout.top + lineMiddle(i, label.size) }, text);
    row.textContent = line === `` ? ` ` : line;
  });
}

// Draws a text: one line of the SVG text for each line of the text, each one centred on its own height, so that the position does not depend on the font. The lines keep
// their spaces and are set from the text of the element as plain text.
function drawText(el: TextElement, parent: Element): void {
  const anchor = el.align === `center` ? `middle` : el.align === `right` ? `end` : `start`;
  const x = el.align === `center` ? el.x + el.width / 2 : el.align === `right` ? el.x + el.width : el.x;
  const turn: Record<string, string> = el.angle ? { transform: `rotate(${el.angle} ${el.x + el.width / 2} ${el.y + el.height / 2})` } : {};
  const holder = mirrored(el, svgEl(`g`, turn, parent));
  // A text with a distortion, or written vertically, is drawn letter by letter (see text-warp.ts); the others are drawn as lines.
  if (el.warp !== undefined || el.vertical === true) {
    const layout = layoutWarp(
      { text: el.text, size: el.size, align: el.align ?? `left`, zone: el.zone === true, width: el.width, height: el.height, vertical: el.vertical === true, warp: el.warp ?? null, amount: el.warpAmount ?? DEFAULT_WARP_AMOUNT },
      (ch) => measureLine(ch, el.font, el.size),
    );
    const letters = svgEl(`g`, { class: `sketchnote-text sketchnote-text-letters`, "font-family": fontStack(el.font), "font-size": el.size, fill: el.stroke, "text-anchor": `middle`, "dominant-baseline": `central`, style: `white-space:pre` }, holder);
    for (const g of layout.glyphs) {
      if (g.char.trim() === ``) continue;
      const letter = svgEl(`text`, { transform: glyphTransform(g, el.x, el.y) }, letters);
      letter.textContent = g.char;
    }
    return;
  }
  const group = svgEl(`text`, { class: `sketchnote-text`, "font-family": fontStack(el.font), "font-size": el.size, fill: el.stroke, "text-anchor": anchor, "dominant-baseline": `central`, style: `white-space:pre` }, holder);
  // A text zone wraps its lines to its width; any other text keeps its own lines.
  const lines = el.zone === true ? wrapLines(el.text, el.width, (line) => measureLine(line, el.font, el.size)) : textLines(el.text);
  lines.forEach((line, i) => {
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
    drawElements(doc.elements, inner, { ...PLAIN, ink: doc.ink });
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
  if (isStroked(el)) drawStroked(el, parent, options);
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
    // The reflection starts at the outer edge of the drawing of the element (its line and its border included), so that it touches the element without overlapping it, and it
    // is a whole copy when its depth is at the maximum. The gap moves it away from the element, as a part of the height.
    const ext = outlineExtent(el);
    const top = b.y - ext;
    const full = b.h + 2 * ext;
    const bottom = top + full;
    const depth = Math.max(8, full * (el.reflectDepth ?? 0.6));
    const gap = (el.reflectGap ?? 0) * b.h;
    const fade = el.reflectFade ?? 1;
    const gradient = svgEl(`linearGradient`, { id: `${id}-g`, gradientUnits: `userSpaceOnUse`, x1: 0, y1: bottom, x2: 0, y2: bottom - depth }, defs);
    svgEl(`stop`, { offset: 0, "stop-color": `#ffffff`, "stop-opacity": 1 }, gradient);
    svgEl(`stop`, { offset: 1, "stop-color": `#ffffff`, "stop-opacity": 1 - fade }, gradient);
    const mask = svgEl(`mask`, { id: `${id}-m`, maskUnits: `userSpaceOnUse`, x: b.x - ext - 40, y: bottom - depth, width: b.w + 2 * ext + 80, height: depth }, defs);
    svgEl(`rect`, { x: b.x - ext - 40, y: bottom - depth, width: b.w + 2 * ext + 80, height: depth, fill: `url(#${id}-g)` }, mask);
    const mirror = svgEl(`g`, { transform: `translate(0 ${2 * bottom + gap}) scale(1 -1)`, opacity: 0.5, mask: `url(#${id}-m)` }, outer);
    svgEl(`use`, { href: `#${id}-c` }, mirror);
  }
}

// Draws a list of elements into a group, in order (the first one is at the back).
export function drawElements(elements: SketchElement[], parent: Element, options: RenderOptions): void {
  for (const el of elements) drawElement(el, parent, options);
}
