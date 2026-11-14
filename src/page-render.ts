// Draws the surface of a page as an SVG element, from its settings: the page colour, the repeating tile of its style, the dotted frames of its structure.
// The elements are drawn into the group `content` by the view. Built with the DOM only: no markup text is ever parsed.
import { DrawingGuide, guideBox } from "./drawing-file";
import { PageSettings } from "./file-format";
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

// Builds the SVG of a page at a given zoom: the page colour, the repeating tile of its style, an empty group for the elements and the editor overlay.
export function renderPage(page: PageSettings, zoom: number): RenderedPage {
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
  const ui = svgEl(`g`, { class: `sketchnote-ui`, "pointer-events": `none` }, svg);
  return { svg, content, ui };
}

// Builds the SVG of the surface of a drawing: a plain colour, the dotted guide of its zone if it has one, and the groups for the elements and the editor overlay. The colour is dark when the ink is
// light, so that a white drawing made for a chalkboard stays visible.
export function renderCanvas(width: number, height: number, zoom: number, dark: boolean, guide: DrawingGuide | null = null): RenderedPage {
  const svg = svgEl(`svg`, { class: `sketchnote-page sketchnote-canvas`, width: width * zoom, height: height * zoom, viewBox: `0 0 ${width} ${height}` });
  const background = dark ? `#2a3631` : `#ffffff`;
  svgEl(`rect`, { x: 0, y: 0, width, height, fill: background }, svg);
  if (guide) {
    // The guide: a big dotted shape in the middle, with the proportions of the zone of the page. It only helps to draw; elements can go outside of it.
    const b = guideBox(guide);
    const style = slotStyle(background);
    const look = { class: `sketchdraw-guide`, fill: style.color, "fill-opacity": style.fillOpacity, stroke: style.color, "stroke-opacity": style.strokeOpacity, "stroke-width": 2, "stroke-dasharray": `12 8` };
    if (guide.shape === `ellipse`) svgEl(`ellipse`, { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2, ...look }, svg);
    else svgEl(`rect`, { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, ...look }, svg);
  }
  const content = svgEl(`g`, { class: `sketchnote-content` }, svg);
  const ui = svgEl(`g`, { class: `sketchnote-ui`, "pointer-events": `none` }, svg);
  return { svg, content, ui };
}
