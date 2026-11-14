// Draws the elements of a page or of a drawing into an SVG group. Built with the DOM only: nothing is ever parsed from text.
// A hand drawn or clean line comes from shape-paths; a frame of a drawing shows the drawing it points to, fitted to its width.
import { DrawingElement, isStroked, SketchElement } from "./elements";
import { contentBox, fitInFrame, SketchdrawDoc } from "./drawing-file";
import { elementPaths } from "./shape-paths";
import { svgEl } from "./svg";

// Gives the content of a drawing note from its path, or null when it is unknown or not loaded yet.
export type DrawingLookup = (path: string) => SketchdrawDoc | null;

// Draws one element with a stroke (everything except a drawing frame).
function drawStroked(el: Exclude<SketchElement, DrawingElement>, parent: Element): void {
  const { pieces, transform } = elementPaths(el);
  const group = svgEl(`g`, transform ? { transform } : {}, parent);
  for (const p of pieces) {
    svgEl(`path`, { d: p.d, stroke: p.stroke, "stroke-width": p.strokeWidth, fill: p.fill, "stroke-linecap": `round`, "stroke-linejoin": `round` }, group);
  }
}

// Draws the frame of a drawing: the drawing itself when it has content, otherwise a dashed frame with a pencil.
function drawFrame(el: DrawingElement, parent: Element, lookup: DrawingLookup | null): void {
  const turn: Record<string, string> = el.angle ? { transform: `rotate(${el.angle} ${el.x + el.width / 2} ${el.y + el.height / 2})` } : {};
  const group = svgEl(`g`, { class: `sketchnote-frame`, ...turn }, parent);
  const doc = el.path !== null && lookup ? lookup(el.path) : null;
  const box = doc ? contentBox(doc) : null;
  if (doc && box) {
    const fit = fitInFrame(el.x, el.y, el.width, box);
    const inner = svgEl(`g`, { transform: `translate(${fit.tx} ${fit.ty}) scale(${fit.scale})` }, group);
    drawElements(doc.elements, inner, null);
    return;
  }
  svgEl(`rect`, { class: `sketchnote-frame-empty`, x: el.x, y: el.y, width: el.width, height: el.height, rx: 8 }, group);
  // A pencil invites a double click (an empty drawing) or shows that the drawing is being loaded (the same pencil, fainter).
  const size = Math.max(22, Math.min(56, Math.min(el.width, el.height) * 0.3));
  svgEl(
    `path`,
    {
      class: doc || el.path === null ? `sketchnote-frame-pencil` : `sketchnote-frame-pencil is-loading`,
      d: `M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z M15 5l4 4`,
      transform: `translate(${el.x + el.width / 2 - size / 2} ${el.y + el.height / 2 - size / 2}) scale(${size / 24})`,
    },
    group,
  );
}

// Draws one element of the page or of a drawing into a parent.
export function drawElement(el: SketchElement, parent: Element, lookup: DrawingLookup | null): void {
  if (isStroked(el)) drawStroked(el, parent);
  else drawFrame(el, parent, lookup);
}

// Draws a list of elements into a group, in order (the first one is at the back).
export function drawElements(elements: SketchElement[], parent: Element, lookup: DrawingLookup | null): void {
  for (const el of elements) drawElement(el, parent, lookup);
}
