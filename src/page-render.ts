// Draws a page as an SVG element, from its settings. Built with the DOM only: no markup text is ever parsed.
import { arrowHeadPoints, SketchElement } from "./elements";
import { PageSettings } from "./file-format";
import type { Slot } from "./layout";
import { backgroundSpec, slotStyle, TileShape } from "./page-background";
import { svgEl } from "./svg";

export interface RenderedPage {
  svg: SVGElement;
  // Group that holds the elements of the page.
  content: SVGElement;
  // Group drawn above everything, for the selection frames, handles and guide lines of the editor. It is never part of the drawing.
  ui: SVGElement;
}

let counter = 0;

// Draws one shape of a background description into a parent. A shape that names a gradient is filled with it.
function drawShape(shape: TileShape, parent: Element, prefix: string): void {
  const attrs: Record<string, string | number> = { ...shape.attrs };
  if (shape.gradient) attrs.fill = `url(#${prefix}-${shape.gradient})`;
  svgEl(shape.tag, attrs, parent);
}

// Turns a list of points into the text of an SVG points attribute.
function pointsText(points: [number, number][]): string {
  return points.map((p) => `${p[0]},${p[1]}`).join(` `);
}

// Draws one element of the page into a parent. Strokes are round and clean (the hand-drawn style comes with the drawing tools).
export function drawElement(el: SketchElement, parent: Element): void {
  const look = { stroke: el.stroke, "stroke-width": el.strokeWidth, "stroke-linecap": `round`, "stroke-linejoin": `round`, fill: `none` };
  if (el.type === `line` || el.type === `arrow`) {
    svgEl(`polyline`, { points: pointsText(el.points), ...look }, parent);
    const head = el.type === `arrow` ? arrowHeadPoints(el.points, el.strokeWidth) : null;
    if (head) svgEl(`polyline`, { points: pointsText(head), ...look }, parent);
  } else if (el.type === `rect`) {
    const turn: Record<string, string | number> = el.angle ? { transform: `rotate(${el.angle} ${el.x + el.width / 2} ${el.y + el.height / 2})` } : {};
    svgEl(`rect`, { x: el.x, y: el.y, width: el.width, height: el.height, ...look, ...turn }, parent);
  } else {
    const turn: Record<string, string | number> = el.angle ? { transform: `rotate(${el.angle} ${el.cx} ${el.cy})` } : {};
    svgEl(`ellipse`, { cx: el.cx, cy: el.cy, rx: el.rx, ry: el.ry, ...look, ...turn }, parent);
  }
}

// Draws a list of elements into a group, in order (the first one is at the back).
export function drawElements(elements: SketchElement[], parent: Element): void {
  for (const el of elements) drawElement(el, parent);
}

// Draws the slots of a structure as dotted frames in their own group. They help to place the contents while editing and are never part of the drawing.
function drawSlots(slots: Slot[], background: string, parent: Element): void {
  const style = slotStyle(background);
  const group = svgEl(`g`, { class: `sketchnote-guides`, "pointer-events": `none` }, parent);
  const look = { fill: style.color, "fill-opacity": style.fillOpacity, stroke: style.color, "stroke-opacity": style.strokeOpacity, "stroke-width": 1.5, "stroke-dasharray": `8 6` };
  for (const s of slots) {
    if (s.shape === `ellipse`) svgEl(`ellipse`, { cx: s.x + s.width / 2, cy: s.y + s.height / 2, rx: s.width / 2, ry: s.height / 2, ...look }, group);
    else svgEl(`rect`, { x: s.x, y: s.y, width: s.width, height: s.height, rx: 6, ...look }, group);
  }
}

// Builds the SVG of a page at a given zoom: the page colour, the repeating tile of its style and an empty group for the elements.
export function renderPage(page: PageSettings, zoom: number, elements: SketchElement[] = [], slots: Slot[] = []): RenderedPage {
  const { width, height } = page;
  const spec = backgroundSpec(page);
  const svg = svgEl(`svg`, { class: `sketchnote-page`, width: width * zoom, height: height * zoom, viewBox: `0 0 ${width} ${height}` });
  svgEl(`rect`, { x: 0, y: 0, width, height, fill: spec.fill }, svg);
  counter += 1;
  const prefix = `sketchnote-${counter}`;
  const defs = svgEl(`defs`, {}, svg);
  for (const g of spec.gradients) {
    const gradient = svgEl(`radialGradient`, { id: `${prefix}-${g.name}`, cx: 0.5, cy: 0.5, r: 0.5 }, defs);
    for (const stop of g.stops) svgEl(`stop`, { offset: stop.offset, "stop-color": stop.color, "stop-opacity": stop.opacity }, gradient);
  }
  if (spec.tile !== null) {
    const id = `${prefix}-tile`;
    const tile = svgEl(`pattern`, { id, width: spec.tile, height: spec.tile, patternUnits: `userSpaceOnUse` }, defs);
    for (const shape of spec.shapes) drawShape(shape, tile, prefix);
    svgEl(`rect`, { x: 0, y: 0, width, height, fill: `url(#${id})` }, svg);
  }
  for (const shape of spec.overlay) drawShape(shape, svg, prefix);
  const content = svgEl(`g`, { class: `sketchnote-content` }, svg);
  drawElements(elements, content);
  if (slots.length > 0) drawSlots(slots, page.background, svg);
  const ui = svgEl(`g`, { class: `sketchnote-ui`, "pointer-events": `none` }, svg);
  return { svg, content, ui };
}
