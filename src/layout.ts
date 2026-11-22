// The seven page structures (linear, radial, vertical, path, modular, skyscraper, popcorn) and their geometry.
// From a structure and a page, buildStructure returns the elements to draw (separators, arrows, links: real parts of the drawing, printed)
// and the slots (dotted frames that help to place the contents, shown while editing and never printed).
// Pure module: no dependency on Obsidian, tested without the application.
import type { PageSettings } from "./file-format";
import { seedFrom } from "./elements";
import type { Point, SketchElement } from "./elements";
import { DEFAULT_PATH_DIRECTION, DEFAULT_PATH_SHAPE, isPathDirection, isPathShape, PathDirection, PathShape, planRoute } from "./path-route";

export type LayoutType = `linear` | `radial` | `vertical` | `path` | `modular` | `skyscraper` | `popcorn`;
export const LAYOUT_TYPES: LayoutType[] = [`linear`, `radial`, `vertical`, `path`, `modular`, `skyscraper`, `popcorn`];

export interface LayoutSettings {
  type: LayoutType;
  // Number of columns (linear, vertical arrows, modular, skyscraper), satellites (radial), steps (path) or bubbles (popcorn).
  count: number;
  // Number of rows of the modular structure. Ignored by the other structures.
  rows: number;
  // The route of the path structure (the form of its arrow and where it goes from and to). Ignored by the other structures.
  shape?: PathShape;
  direction?: PathDirection;
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
  return { type, count: LAYOUT_LIMITS[type].default, rows: ROW_LIMITS.default, ...(type === `path` ? { shape: DEFAULT_PATH_SHAPE, direction: DEFAULT_PATH_DIRECTION } : {}) };
}

// Returns the settings with every number whole and inside the limits of the structure.
export function normalizeLayout(layout: LayoutSettings): LayoutSettings {
  const l = LAYOUT_LIMITS[layout.type];
  const route = layout.type === `path` ? { shape: isPathShape(layout.shape) ? layout.shape : DEFAULT_PATH_SHAPE, direction: isPathDirection(layout.direction) ? layout.direction : DEFAULT_PATH_DIRECTION } : {};
  return { type: layout.type, count: clampInt(layout.count, l.min, l.max, l.default), rows: clampInt(layout.rows, ROW_LIMITS.min, ROW_LIMITS.max, ROW_LIMITS.default), ...route };
}

// Returns the settings with one more zone, or null when the structure is already at its largest. The modular structure adds a column first, then a row.
export function addZone(layout: LayoutSettings): LayoutSettings | null {
  const l = LAYOUT_LIMITS[layout.type];
  if (layout.count < l.max) return normalizeLayout({ ...layout, count: layout.count + 1 });
  if (layout.type === `modular` && layout.rows < ROW_LIMITS.max) return normalizeLayout({ ...layout, rows: layout.rows + 1 });
  return null;
}

// Returns the number of the slot that holds a point, or -1 when the point is in no slot. A rectangle slot holds the points inside it; an ellipse slot the points
// inside its ellipse.
export function slotIndexAt(slots: Slot[], p: Point): number {
  let best = -1;
  let bestArea = Infinity;
  slots.forEach((s, i) => {
    const inside =
      s.shape === `rect`
        ? p[0] >= s.x && p[0] <= s.x + s.width && p[1] >= s.y && p[1] <= s.y + s.height
        : ((p[0] - (s.x + s.width / 2)) / (s.width / 2)) ** 2 + ((p[1] - (s.y + s.height / 2)) / (s.height / 2)) ** 2 <= 1;
    if (inside && s.width * s.height < bestArea) {
      best = i;
      bestArea = s.width * s.height;
    }
  });
  return best;
}

// Tells whether two structure settings are the same (both absent counts as the same).
export function sameLayout(a: LayoutSettings | null, b: LayoutSettings | null): boolean {
  if (a === null || b === null) return a === b;
  return a.type === b.type && a.count === b.count && (a.type !== `modular` || a.rows === b.rows) && (a.type !== `path` || (a.shape === b.shape && a.direction === b.direction));
}

// Reads the structure of a file. Returns undefined when the type is unknown, so that the file is refused. Numbers outside the limits are brought back inside.
export function readLayout(value: unknown): LayoutSettings | null | undefined {
  if (value === null) return null;
  if (typeof value !== `object` || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== `string` || !LAYOUT_TYPES.includes(raw.type as LayoutType)) return undefined;
  const type = raw.type as LayoutType;
  const d = defaultLayout(type);
  return normalizeLayout({ type, count: typeof raw.count === `number` ? raw.count : d.count, rows: typeof raw.rows === `number` ? raw.rows : d.rows, shape: isPathShape(raw.shape) ? raw.shape : undefined, direction: isPathDirection(raw.direction) ? raw.direction : undefined });
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
    elements.push({ id: `s${elements.length + 1}`, group: `structure`, type, points: points.map((p): Point => [r1(p[0]), r1(p[1])]), stroke, strokeWidth, roughness: 1, seed: seedFrom(elements.length) });
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
    // An arrow that crosses the page (it winds, zigzags, climbs in steps or goes straight, in one of eight directions), a point on it for each step and, beside each point, the
    // zone of the step, on alternate sides. The arrow is the evolution: the steps are on it, in order.
    titleSlot();
    const route = planRoute(layout.shape ?? DEFAULT_PATH_SHAPE, layout.direction ?? DEFAULT_PATH_DIRECTION, n, { x: x0, y: y0, w: width, h: height });
    link(`arrow`, route.line);
    const dotR = Math.max(strokeWidth * 2.2, Math.min(W, H) * 0.012);
    // A zone is as large as its place allows: neighbours on the same side are two steps apart, so it may be nearly twice the advance of the route along an axis, and in a
    // staircase it is not longer than the run that it is beside.
    const size = (limit: number, advance: number, cap: number | null): number => Math.min(cap ?? limit, advance > limit * 0.08 ? Math.min(limit, Math.max(limit * 0.4, advance * 1.25)) : limit);
    const baseW = size(width * 0.28, route.advance[0], route.cap[0]);
    const baseH = size(height * 0.2, route.advance[1], route.cap[1]);
    const gap = dotR + G;
    // The zone of a step is beside the middle line of the route, beyond everything that the arrow can reach on that side, so that it meets neither the arrow nor another zone.
    const place = (st: (typeof route.steps)[number], side: Point, k: number): { x: number; y: number; w: number; h: number; fits: boolean } => {
      const [w, h] = [baseW * k, baseH * k];
      const reach = (Math.abs(side[0]) * w) / 2 + (Math.abs(side[1]) * h) / 2;
      const cx = st.base[0] + side[0] * (st.clear + gap + reach);
      const cy = st.base[1] + side[1] * (st.clear + gap + reach);
      return { x: cx - w / 2, y: cy - h / 2, w, h, fits: cx - w / 2 >= x0 - 0.5 && cx + w / 2 <= x1 + 0.5 && cy - h / 2 >= y0 - 0.5 && cy + h / 2 <= y1 + 0.5 };
    };
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    type Box4 = { x: number; y: number; w: number; h: number };
    const meets = (a: Box4, b: Box4): boolean => a.x + 1 < b.x + b.w && b.x + 1 < a.x + a.w && a.y + 1 < b.y + b.h && b.y + 1 < a.y + a.h;
    // Tells whether the arrow goes through the part of a zone that is surely inside its ellipse.
    const cuts = (z: Box4): boolean => {
      const inner: Box4 = { x: z.x + z.w * 0.15, y: z.y + z.h * 0.15, w: z.w * 0.7, h: z.h * 0.7 };
      for (let i = 0; i + 1 < route.line.length; i++) {
        const [p, q] = [route.line[i], route.line[i + 1]];
        const parts = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 6));
        for (let k = 0; k <= parts; k++) {
          const x = p[0] + ((q[0] - p[0]) * k) / parts;
          const y = p[1] + ((q[1] - p[1]) * k) / parts;
          if (x > inner.x && x < inner.x + inner.w && y > inner.y && y < inner.y + inner.h) return true;
        }
      }
      return false;
    };
    for (const st of route.steps) {
      elements.push({ id: `s${elements.length + 1}`, group: `structure`, type: `ellipse`, cx: r1(st.point[0]), cy: r1(st.point[1]), rx: r1(dotR), ry: r1(dotR), stroke, strokeWidth, roughness: 1, seed: seedFrom(elements.length), fill: stroke, fillStyle: `solid` });
      // The zone is beside the point, on its side of the arrow. It is made smaller (down to half) until it is inside the page, does not cover another zone and does not cross the arrow;
      // when that is not possible on its side it goes to the other side; at the very edge it is kept inside the page.
      let chosen: Box4 = place(st, st.side, 0.3);
      let found = false;
      for (const side of [st.side, [-st.side[0], -st.side[1]] as Point]) {
        for (let k = 1; k >= 0.3 - 1e-9 && !found; k -= 0.05) {
          const c = place(st, side, k);
          if (c.fits && !cuts(c) && !placed.some((o) => meets(c, o))) {
            chosen = c;
            found = true;
          }
        }
        if (found) break;
      }
      const zx = Math.min(x1 - chosen.w, Math.max(x0, chosen.x));
      const zy = Math.min(y1 - chosen.h, Math.max(y0, chosen.y));
      placed.push({ x: zx, y: zy, w: chosen.w, h: chosen.h });
      slot(zx, zy, chosen.w, chosen.h, `ellipse`);
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
