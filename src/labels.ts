// The text written inside a shape: the part of the shape that holds it, its colour and its lines. Pure module: the width of a piece of text is given by the caller (the browser
// measures it), so this is tested without a page.
import { drawnPoints } from "./curves";
import type { ArrowElement, DiamondElement, EllipseElement, LineElement, Point, RectElement, ShapeLabel, SketchElement, TriangleElement } from "./elements";
import { hexToRgb } from "./hsl";
import { Box } from "./geometry";
import { borderReach } from "./extent";
import { LINE_HEIGHT, textLines, wrapLines } from "./text-layout";

export type LabeledShape = RectElement | EllipseElement | DiamondElement | TriangleElement;

// Tells whether an element is a shape that a text can be written in.
export function isLabeledShape(el: SketchElement): el is LabeledShape {
  return el.type === `rect` || el.type === `ellipse` || el.type === `diamond` || el.type === `triangle`;
}

// The smallest size, in page units, of the part of a shape that holds text.
const MIN_ROOM = 8;

// Returns the part of a shape (before its rotation) where its text goes: the shape inside its line for a rectangle, the largest rectangle inside an ellipse (about 70 % of
// each side) and the largest rectangle inside a diamond (half of each side).
export function labelBox(el: LabeledShape): Box {
  // The border can have several lines, some of them inside, and the hand drawn look wobbles: the text keeps away from all of them.
  const extra = Math.max(0, borderReach(el) - el.strokeWidth / 2) + (el.roughness ?? 0) * 2;
  let box: Box;
  if (el.type === `rect`) {
    const pad = 6 + el.strokeWidth + extra;
    box = { x: el.x + pad, y: el.y + pad, w: el.width - 2 * pad, h: el.height - 2 * pad };
  } else if (el.type === `ellipse`) {
    const [w, h] = [2 * el.rx * Math.SQRT1_2, 2 * el.ry * Math.SQRT1_2];
    box = { x: el.cx - w / 2, y: el.cy - h / 2, w, h };
  } else if (el.type === `triangle`) {
    // The largest rectangle in an isosceles triangle sits on the base: half as wide and half as high.
    box = { x: el.x + el.width / 4, y: el.y + el.height / 2, w: el.width / 2, h: el.height / 2 };
  } else {
    box = { x: el.x + el.width / 4, y: el.y + el.height / 4, w: el.width / 2, h: el.height / 2 };
  }
  // The room of the other shapes is the rectangle inside them, made smaller by the same margin on every side.
  if (el.type !== `rect`) box = { x: box.x + extra, y: box.y + extra, w: box.w - 2 * extra, h: box.h - 2 * extra };
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

// ---------------------------------------------------------------------------------------------------------------------------- the text of a line

// The room kept around the text of a line, in page units: the line is cut over the text and this margin.
export const LINE_LABEL_PAD = 6;

// Returns the point in the middle of a line or an arrow, measured along its path (the curve itself when its edges are rounded), and the angle of the path there in degrees.
export function pathMiddle(el: LineElement | ArrowElement): { point: Point; angle: number } {
  const pts = drawnPoints(el);
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  let remaining = total / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const length = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (remaining <= length || i + 2 === pts.length) {
      const k = length === 0 ? 0 : Math.min(1, remaining / length);
      return { point: [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k], angle: (Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) * 180) / Math.PI };
    }
    remaining -= length;
  }
  return { point: pts[0] ?? [0, 0], angle: 0 };
}

// The layout of the text in the middle of a line: its lines (as typed, they are not wrapped), the box that they fill, and the box that is cut out of the line around them.
export interface LineLabelLayout {
  lines: string[];
  // The top of the first line and the anchor of the lines, for the alignment.
  top: number;
  anchorX: number;
  align: `left` | `center` | `right`;
  lineHeight: number;
  size: number;
  // The box of the text with its margin: the line is cut under it.
  cut: Box;
}

export function lineLabelLayout(el: LineElement | ArrowElement, label: ShapeLabel, measure: (line: string, font: string, size: number) => number): LineLabelLayout {
  const { point } = pathMiddle(el);
  const lines = textLines(label.text);
  const lineHeight = label.size * LINE_HEIGHT;
  const width = Math.max(label.size * 0.5, ...lines.map((l) => measure(l, label.font, label.size)));
  const height = lines.length * lineHeight;
  const align = label.align ?? `center`;
  const left = point[0] - width / 2;
  const anchorX = align === `left` ? left : align === `right` ? left + width : point[0];
  return { lines, top: point[1] - height / 2, anchorX, align, lineHeight, size: label.size, cut: { x: left - LINE_LABEL_PAD, y: point[1] - height / 2 - LINE_LABEL_PAD, w: width + 2 * LINE_LABEL_PAD, h: height + 2 * LINE_LABEL_PAD } };
}
