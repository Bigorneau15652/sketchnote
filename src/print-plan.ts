// The plan of a print: the paper (A4 or A3, in portrait or in landscape), the margin, and how the picture is spread on the sheets: fitted on one sheet, or at its real size on as many
// sheets as it takes (to be put side by side). All sizes are in CSS pixels (96 to the inch, which is what one unit of a drawing is). Pure module.
export type Paper = `a4` | `a3`;
export type PrintScale = `fit` | `real`;
export type Orientation = `portrait` | `landscape`;

export const PAPERS: Paper[] = [`a4`, `a3`];
export const PRINT_SCALES: PrintScale[] = [`fit`, `real`];
// The margin around what is printed, in millimetres, and the most sheets that a print can take.
export const PRINT_MARGIN_MM = 10;
export const PRINT_MAX_SHEETS = 36;
// A drawing that is fitted is not enlarged more than this (a small drawing does not become huge).
export const PRINT_MAX_ENLARGE = 6;

const PAPER_MM: Record<Paper, [number, number]> = { a4: [210, 297], a3: [297, 420] };
const PX_PER_MM = 96 / 25.4;

export interface Sheet {
  // Where the part of the picture that is on this sheet starts, in pixels of the picture shown (the picture is moved by the opposite).
  col: number;
  row: number;
}

export interface PrintPlan {
  orientation: Orientation;
  // The size of the paper in millimetres (after the orientation), and the size of the printed area (the paper without the margin) in pixels.
  paperMm: [number, number];
  innerW: number;
  innerH: number;
  // The size at which the whole picture is shown, in pixels, and where it starts on its sheet when it is alone (to centre it).
  imageW: number;
  imageH: number;
  offsetX: number;
  offsetY: number;
  columns: number;
  rows: number;
  sheets: Sheet[];
  // True when the real size would need too many sheets, so that the picture was fitted instead.
  tooBig: boolean;
}

// Returns the paper size in millimetres in an orientation.
function paperIn(paper: Paper, orientation: Orientation): [number, number] {
  const [w, h] = PAPER_MM[paper];
  return orientation === `portrait` ? [w, h] : [h, w];
}

// Plans the sheets of a print for a picture of `width` x `height` units. With `fit` the picture is shown as large as it can be on one sheet; with `real` it keeps its size and is cut
// into sheets. The orientation is the one that suits the shape of the picture (or, at real size, the one that takes the fewest sheets).
export function planPrint(width: number, height: number, paper: Paper, scale: PrintScale, marginMm = PRINT_MARGIN_MM): PrintPlan {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const layout = (orientation: Orientation, mode: PrintScale): PrintPlan => {
    const paperMm = paperIn(paper, orientation);
    const innerW = Math.max(10, (paperMm[0] - 2 * marginMm) * PX_PER_MM);
    const innerH = Math.max(10, (paperMm[1] - 2 * marginMm) * PX_PER_MM);
    if (mode === `fit`) {
      const k = Math.min(innerW / w, innerH / h, PRINT_MAX_ENLARGE);
      const imageW = w * k;
      const imageH = h * k;
      return { orientation, paperMm, innerW, innerH, imageW, imageH, offsetX: (innerW - imageW) / 2, offsetY: (innerH - imageH) / 2, columns: 1, rows: 1, sheets: [{ col: 0, row: 0 }], tooBig: false };
    }
    const columns = Math.max(1, Math.ceil(w / innerW - 1e-9));
    const rows = Math.max(1, Math.ceil(h / innerH - 1e-9));
    const sheets: Sheet[] = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) sheets.push({ col, row });
    return { orientation, paperMm, innerW, innerH, imageW: w, imageH: h, offsetX: columns === 1 ? (innerW - w) / 2 : 0, offsetY: rows === 1 ? (innerH - h) / 2 : 0, columns, rows, sheets, tooBig: false };
  };
  const natural: Orientation = w >= h ? `landscape` : `portrait`;
  if (scale === `fit`) return layout(natural, `fit`);
  const a = layout(`portrait`, `real`);
  const b = layout(`landscape`, `real`);
  const best = a.sheets.length < b.sheets.length ? a : b.sheets.length < a.sheets.length ? b : layout(natural, `real`);
  return best.sheets.length > PRINT_MAX_SHEETS ? { ...layout(natural, `fit`), tooBig: true } : best;
}

// Tells whether a value is a paper.
export function isPaper(value: unknown): value is Paper {
  return value === `a4` || value === `a3`;
}
