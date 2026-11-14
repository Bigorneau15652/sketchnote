// The seven page structures (linear, radial, vertical, path, modular, skyscraper, popcorn) and their geometry.
// From a structure and a page, buildStructure returns the elements to draw (separators, arrows, links: real parts of the drawing, printed)
// and the slots (dotted frames that help to place the contents, shown while editing and never printed).
// Pure module: no dependency on Obsidian, tested without the application.
import type { PageSettings } from "./file-format";
import type { Point, SketchElement } from "./elements";

export type LayoutType = `linear` | `radial` | `vertical` | `path` | `modular` | `skyscraper` | `popcorn`;
export const LAYOUT_TYPES: LayoutType[] = [`linear`, `radial`, `vertical`, `path`, `modular`, `skyscraper`, `popcorn`];

export interface LayoutSettings {
  type: LayoutType;
  // Number of columns (linear, vertical arrows, modular, skyscraper), satellites (radial), steps (path) or bubbles (popcorn).
  count: number;
  // Number of rows of the modular structure. Ignored by the other structures.
  rows: number;
}

export const LAYOUT_LIMITS: Record<LayoutType, { min: number; max: number; default: number }> = {
  linear: { min: 2, max: 4, default: 2 },
  radial: { min: 3, max: 12, default: 8 },
  vertical: { min: 2, max: 5, default: 3 },
  path: { min: 3, max: 10, default: 5 },
  modular: { min: 1, max: 4, default: 2 },
  skyscraper: { min: 2, max: 6, default: 3 },
  popcorn: { min: 4, max: 14, default: 9 },
};
export const ROW_LIMITS = { min: 1, max: 4, default: 2 };

// A frame that shows where to put a content. The shape tells whether it is drawn as a rectangle or an ellipse.
export interface Slot {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: `rect` | `ellipse`;
}

export interface Structure {
  elements: SketchElement[];
  slots: Slot[];
}

// Keeps a value inside a range as a whole number. A value that is not a number gives the default.
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== `number` || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// Returns the settings of a structure with its default numbers.
export function defaultLayout(type: LayoutType): LayoutSettings {
  return { type, count: LAYOUT_LIMITS[type].default, rows: ROW_LIMITS.default };
}

// Returns the settings with every number whole and inside the limits of the structure.
export function normalizeLayout(layout: LayoutSettings): LayoutSettings {
  const l = LAYOUT_LIMITS[layout.type];
  return { type: layout.type, count: clampInt(layout.count, l.min, l.max, l.default), rows: clampInt(layout.rows, ROW_LIMITS.min, ROW_LIMITS.max, ROW_LIMITS.default) };
}

// Tells whether two structure settings are the same (both absent counts as the same).
export function sameLayout(a: LayoutSettings | null, b: LayoutSettings | null): boolean {
  if (a === null || b === null) return a === b;
  return a.type === b.type && a.count === b.count && (a.type !== `modular` || a.rows === b.rows);
}

// Reads the structure of a file. Returns undefined when the type is unknown, so that the file is refused. Numbers outside the limits are brought back inside.
export function readLayout(value: unknown): LayoutSettings | null | undefined {
  if (value === null) return null;
  if (typeof value !== `object` || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== `string` || !LAYOUT_TYPES.includes(raw.type as LayoutType)) return undefined;
  const type = raw.type as LayoutType;
  const d = defaultLayout(type);
  return normalizeLayout({ type, count: typeof raw.count === `number` ? raw.count : d.count, rows: typeof raw.rows === `number` ? raw.rows : d.rows });
}

// Rounds to one decimal.
const r1 = (n: number): number => Math.round(n * 10) / 10;

// Returns how far along a direction one must go from the centre of an ellipse to reach its edge.
function edgeT(dx: number, dy: number, rx: number, ry: number): number {
  return 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
}

// Builds the elements and the slots of a structure for a page. The result depends only on the arguments.
export function buildStructure(layout: LayoutSettings, page: PageSettings): Structure {
  const W = page.width;
  const H = page.height;
  const M = Math.round(Math.min(W, H) * 0.05);
  const G = Math.round(M * 0.6);
  const T = Math.round(Math.min(H * 0.1, W * 0.14));
  const x0 = M;
  const x1 = W - M;
  const y0 = M + T + Math.round(G * 1.5);
  const y1 = H - M;
  const width = x1 - x0;
  const height = y1 - y0;
  const stroke = page.ink;
  const strokeWidth = Math.max(2, Math.round(Math.min(W, H) / 300));
  const elements: SketchElement[] = [];
  const slots: Slot[] = [];
  const n = layout.count;

  // Adds a line or an arrow of the structure.
  const link = (type: `line` | `arrow`, points: Point[]): void => {
    elements.push({ id: `s${elements.length + 1}`, group: `structure`, type, points: points.map((p): Point => [r1(p[0]), r1(p[1])]), stroke, strokeWidth });
  };
  // Adds a slot.
  const slot = (x: number, y: number, w: number, h: number, shape: `rect` | `ellipse`): void => {
    slots.push({ x: r1(x), y: r1(y), width: r1(w), height: r1(h), shape });
  };
  // Adds the slot of the title, at the top of the page.
  const titleSlot = (): void => slot(M, M, W - 2 * M, T, `rect`);

  if (layout.type === `linear` || layout.type === `skyscraper`) {
    titleSlot();
    const sep = 2 * G;
    const colW = (width - (n - 1) * sep) / n;
    for (let i = 0; i < n; i++) {
      const colX = x0 + i * (colW + sep);
      if (i > 0) link(`line`, [[colX - sep / 2, y0], [colX - sep / 2, y1]]);
      if (layout.type === `skyscraper`) {
        slot(colX, y0, colW, height, `rect`);
      } else {
        const arrowLen = height * 0.08;
        link(`arrow`, [[colX + colW / 2, y0], [colX + colW / 2, y0 + arrowLen]]);
        const top = y0 + arrowLen + G;
        const h = (y1 - top - 3 * G) / 4;
        for (let k = 0; k < 4; k++) slot(colX, top + k * (h + G), colW, h, `rect`);
      }
    }
  } else if (layout.type === `vertical`) {
    titleSlot();
    const colW = (width - (n - 1) * G) / n;
    for (let i = 0; i < n; i++) {
      const colX = x0 + i * (colW + G);
      link(`arrow`, [[colX + colW * 0.07, y0], [colX + colW * 0.07, y1]]);
      const h = (height - 3 * G) / 4;
      for (let k = 0; k < 4; k++) slot(colX + colW * 0.17, y0 + k * (h + G), colW * 0.83, h, `rect`);
    }
  } else if (layout.type === `modular`) {
    titleSlot();
    const sep = 2 * G;
    const rows = layout.rows;
    const cellW = (width - (n - 1) * sep) / n;
    const cellH = (height - (rows - 1) * sep) / rows;
    link(`line`, [[x0, y0 - G * 0.75], [x1, y0 - G * 0.75]]);
    for (let i = 1; i < n; i++) link(`line`, [[x0 + i * (cellW + sep) - sep / 2, y0], [x0 + i * (cellW + sep) - sep / 2, y1]]);
    for (let j = 1; j < rows; j++) link(`line`, [[x0, y0 + j * (cellH + sep) - sep / 2], [x1, y0 + j * (cellH + sep) - sep / 2]]);
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) slot(x0 + i * (cellW + sep), y0 + j * (cellH + sep), cellW, cellH, `rect`);
  } else if (layout.type === `path`) {
    // A winding road down the middle of the page. The steps alternate on its right and on its left, outside its swing, so it never crosses them.
    titleSlot();
    const cx = (x0 + x1) / 2;
    const amp = width * 0.1;
    const gap = width * 0.04;
    const xAt = (t: number): number => cx + amp * Math.sin(t * Math.PI * 3);
    const points: Point[] = [];
    for (let i = 0; i <= 60; i++) points.push([xAt(i / 60), y0 + (i / 60) * height]);
    link(`arrow`, points);
    const sw = width / 2 - amp - gap;
    const sh = Math.min((height / n) * 0.8, height * 0.2);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      slot(i % 2 === 0 ? cx + amp + gap : cx - amp - gap - sw, y0 + t * height - sh / 2, sw, sh, `ellipse`);
    }
  } else {
    // Radial and popcorn: a centre and ellipses around it, joined to the centre by links.
    const aW = width + 0;
    const aH = H - 2 * M;
    const cx = W / 2;
    const cy = H / 2;
    const popcorn = layout.type === `popcorn`;
    const crx = popcorn ? (W - 2 * M) * 0.14 : (W - 2 * M) * 0.2;
    const cry = popcorn ? aH * 0.07 : aH * 0.1;
    slot(cx - crx, cy - cry, 2 * crx, 2 * cry, `ellipse`);
    const f = Math.min(1, Math.max(0.6, 1.2 - n * 0.05));
    const sizes = popcorn ? [0.85, 1, 1.15] : [1];
    for (let i = 0; i < n; i++) {
      const k = sizes[i % sizes.length];
      const sw = (W - 2 * M) * (popcorn ? 0.24 : 0.24) * f * k;
      const sh = aH * (popcorn ? 0.11 : 0.13) * f * k;
      const jitter = popcorn ? (((i * 37) % 11) - 5) * 0.8 : 0;
      const angle = ((-90 + (i * 360) / n + jitter) * Math.PI) / 180;
      const ring = popcorn ? (i % 2 === 0 ? 0.94 : 0.74) : 1;
      const px = cx + ring * (aW / 2 - sw / 2) * Math.cos(angle);
      const py = cy + ring * (aH / 2 - sh / 2) * Math.sin(angle);
      slot(px - sw / 2, py - sh / 2, sw, sh, `ellipse`);
      const dx = px - cx;
      const dy = py - cy;
      const t0 = edgeT(dx, dy, crx, cry);
      const t1 = 1 - edgeT(dx, dy, sw / 2, sh / 2);
      if (t1 <= t0) continue;
      const from = popcorn ? t0 + (t1 - t0) * 0.25 : t0;
      const to = popcorn ? t0 + (t1 - t0) * 0.6 : t1;
      link(`line`, [[cx + dx * from, cy + dy * from], [cx + dx * to, cy + dy * to]]);
    }
  }
  return { elements, slots };
}
