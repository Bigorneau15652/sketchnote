// Draws the elements of a page or of a drawing into an SVG group. Built with the DOM only: nothing is ever parsed from text.
// A hand drawn or clean line comes from shape-paths; a frame of a drawing shows the drawing it points to, fitted to its width.
import { DrawingElement, isStroked, SketchElement, TextElement } from "./elements";
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

// Draws one element with a stroke (everything except a drawing frame).
function drawStroked(el: Exclude<SketchElement, DrawingElement | TextElement>, parent: Element): void {
  const { pieces, transform } = elementPaths(el);
  const group = svgEl(`g`, transform ? { transform } : {}, parent);
  for (const p of pieces) {
    svgEl(`path`, { d: p.d, stroke: p.stroke, "stroke-width": p.strokeWidth, fill: p.fill, ...(p.opacity < 1 ? { opacity: p.opacity } : {}), "stroke-linecap": `round`, "stroke-linejoin": `round` }, group);
  }
}

// Draws a text: one line of the SVG text for each line of the text, each one centred on its own height, so that the position does not depend on the font. The lines keep
// their spaces and are set from the text of the element as plain text.
function drawText(el: TextElement, parent: Element): void {
  const anchor = el.align === `center` ? `middle` : el.align === `right` ? `end` : `start`;
  const x = el.align === `center` ? el.x + el.width / 2 : el.align === `right` ? el.x + el.width : el.x;
  const turn: Record<string, string> = el.angle ? { transform: `rotate(${el.angle} ${el.x + el.width / 2} ${el.y + el.height / 2})` } : {};
  const group = svgEl(`text`, { class: `sketchnote-text`, "font-family": fontStack(el.font), "font-size": el.size, fill: el.stroke, "text-anchor": anchor, "dominant-baseline": `central`, style: `white-space:pre`, ...turn }, parent);
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
    const group = svgEl(`g`, { class: `sketchnote-frame`, ...turn }, parent);
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

// Draws one element of the page or of a drawing into a parent.
export function drawElement(el: SketchElement, parent: Element, options: RenderOptions): void {
  if (isStroked(el)) drawStroked(el, parent);
  else if (el.type === `text`) drawText(el, parent);
  else drawFrame(el, parent, options);
}

// Draws a list of elements into a group, in order (the first one is at the back).
export function drawElements(elements: SketchElement[], parent: Element, options: RenderOptions): void {
  for (const el of elements) drawElement(el, parent, options);
}
