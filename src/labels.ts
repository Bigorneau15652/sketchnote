// The text written inside a shape: the part of the shape that holds it, its colour and its lines. Pure module: the width of a piece of text is given by the caller (the browser
// measures it), so this is tested without a page.
import type { DiamondElement, EllipseElement, RectElement, ShapeLabel } from "./elements";
import { hexToRgb } from "./hsl";
import { Box } from "./geometry";
import { LINE_HEIGHT, wrapLines } from "./text-layout";

export type LabeledShape = RectElement | EllipseElement | DiamondElement;

// The smallest size, in page units, of the part of a shape that holds text.
const MIN_ROOM = 8;

// Returns the part of a shape (before its rotation) where its text goes: the shape inside its line for a rectangle, the largest rectangle inside an ellipse (about 70 % of
// each side) and the largest rectangle inside a diamond (half of each side).
export function labelBox(el: LabeledShape): Box {
  let box: Box;
  if (el.type === `rect`) {
    const pad = 6 + el.strokeWidth;
    box = { x: el.x + pad, y: el.y + pad, w: el.width - 2 * pad, h: el.height - 2 * pad };
  } else if (el.type === `ellipse`) {
    const [w, h] = [2 * el.rx * Math.SQRT1_2, 2 * el.ry * Math.SQRT1_2];
    box = { x: el.cx - w / 2, y: el.cy - h / 2, w, h };
  } else {
    box = { x: el.x + el.width / 4, y: el.y + el.height / 4, w: el.width / 2, h: el.height / 2 };
  }
  const w = Math.max(MIN_ROOM, box.w);
  const h = Math.max(MIN_ROOM, box.h);
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

// Returns the colour of the text of a shape: black on a light fill, white on a dark one, and the ink of the drawing (black, or white on a chalkboard) when there is no fill
// or when the fill is mostly transparent, since then the background shows through.
export function labelColor(el: LabeledShape, ink: string): string {
  if (el.fill === undefined || (el.fillOpacity ?? 1) < 0.5) return hexToRgb(ink) ? ink : `#000000`;
  const rgb = hexToRgb(el.fill) ?? [0, 0, 0];
  const light = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return light > 0.55 ? `#000000` : `#ffffff`;
}

// The lines of the text of a shape and where they go: the lines wrapped to the width of the part of the shape that holds them, the top of the first one (the text is centred
// in height) and the horizontal anchor of the lines for the alignment (centred by default).
export interface LabelLayout {
  lines: string[];
  box: Box;
  top: number;
  size: number;
  lineHeight: number;
  align: `left` | `center` | `right`;
  anchorX: number;
}

export function labelLayout(el: LabeledShape, label: ShapeLabel, measure: (line: string, font: string, size: number) => number): LabelLayout {
  const box = labelBox(el);
  const lines = wrapLines(label.text, box.w, (line) => measure(line, label.font, label.size));
  const lineHeight = label.size * LINE_HEIGHT;
  const align = label.align ?? `center`;
  const anchorX = align === `left` ? box.x : align === `right` ? box.x + box.w : box.x + box.w / 2;
  return { lines, box, top: box.y + (box.h - lines.length * lineHeight) / 2, size: label.size, lineHeight, align, anchorX };
}
