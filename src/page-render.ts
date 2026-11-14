// Draws the surface of a page as an SVG element, from its settings: the page colour, the repeating tile of its style, the dotted frames of its structure.
// The elements are drawn into the group `content` by the view. Built with the DOM only: no markup text is ever parsed.
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

// Builds the SVG of a page at a given zoom: the page colour, the repeating tile of its style, an empty group for the elements, the slots and the editor overlay.
export function renderPage(page: PageSettings, zoom: number, slots: Slot[] = []): RenderedPage {
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
  if (slots.length > 0) drawSlots(slots, page.background, svg);
  const ui = svgEl(`g`, { class: `sketchnote-ui`, "pointer-events": `none` }, svg);
  return { svg, content, ui };
}

// Builds the SVG of the surface of a drawing: a plain colour and the groups for the elements and the editor overlay. The colour is dark when the ink is
// light, so that a white drawing made for a chalkboard stays visible.
export function renderCanvas(width: number, height: number, zoom: number, dark: boolean): RenderedPage {
  const svg = svgEl(`svg`, { class: `sketchnote-page sketchnote-canvas`, width: width * zoom, height: height * zoom, viewBox: `0 0 ${width} ${height}` });
  svgEl(`rect`, { x: 0, y: 0, width, height, fill: dark ? `#2a3631` : `#ffffff` }, svg);
  const content = svgEl(`g`, { class: `sketchnote-content` }, svg);
  const ui = svgEl(`g`, { class: `sketchnote-ui`, "pointer-events": `none` }, svg);
  return { svg, content, ui };
}
