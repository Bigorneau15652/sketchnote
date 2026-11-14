// Draws a page as an SVG element, from its settings. Built with the DOM only: no markup text is ever parsed.
import { PageSettings } from "./file-format";
import { backgroundSpec } from "./page-background";
import { svgEl } from "./svg";

export interface RenderedPage {
  svg: SVGElement;
  // Group that will hold the elements of the page (from version 0.4.0).
  content: SVGElement;
}

let counter = 0;

// Builds the SVG of a page at a given zoom: the page colour, the repeating tile of its style and an empty group for the elements.
export function renderPage(page: PageSettings, zoom: number): RenderedPage {
  const { width, height } = page;
  const spec = backgroundSpec(page);
  const svg = svgEl(`svg`, { class: `sketchnote-page`, width: width * zoom, height: height * zoom, viewBox: `0 0 ${width} ${height}` });
  svgEl(`rect`, { x: 0, y: 0, width, height, fill: spec.fill }, svg);
  if (spec.tile !== null) {
    counter += 1;
    const id = `sketchnote-tile-${counter}`;
    const defs = svgEl(`defs`, {}, svg);
    const tile = svgEl(`pattern`, { id, width: spec.tile, height: spec.tile, patternUnits: `userSpaceOnUse` }, defs);
    for (const shape of spec.shapes) svgEl(shape.tag, shape.attrs, tile);
    svgEl(`rect`, { x: 0, y: 0, width, height, fill: `url(#${id})` }, svg);
  }
  const content = svgEl(`g`, { class: `sketchnote-content` }, svg);
  return { svg, content };
}
