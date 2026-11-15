// The brushes of the pen: the shapes they leave on the page. The round brush is the pen as it always was (see shape-paths.ts). The other brushes put a tip (a stamp) again and again
// along the stroke, as the brushes of a painting program do, and every brush has its own settings. Pure module: no access to the page.
import type { Point } from "./elements";

// The brushes. The round one is the default and is not stored in a file.
export const BRUSH_KINDS = [`round`, `soft`, `pencil`, `felt`, `square`, `ink`, `nib`, `lino`, `airbrush`, `aerosol`, `watercolor`, `gouache`, `oil`, `drybrush`, `chalk`, `pastel`, `charcoal`] as const;
export type BrushKind = (typeof BRUSH_KINDS)[number];

// The settings of a brush, and what each one does (the three that look alike are told apart here):
// - the flow is the paint that every touch of the brush leaves. Touches that overlap add up, so a light flow gives a light stroke that gets denser where the brush goes over
//   itself or crosses itself. The opacity of the effects, on the contrary, makes the whole stroke more transparent at once and nothing builds up;
// - the hardness only changes the edge of the stroke, from a sharp one to a soft one that fades out, and never how dark the middle is;
// - the spacing is the distance between two touches (as a part of the size); the form goes from a flat tip to a round one; the rotation is the angle of the tip in degrees;
// - the grain goes from smooth to rough (a rough edge, dots, bristles that skip); the dynamics make the stroke thinner when the pointer goes fast.
export const BRUSH_PARAMS = [`flow`, `hardness`, `spacing`, `form`, `rotation`, `grain`, `dynamics`] as const;
export type BrushParam = (typeof BRUSH_PARAMS)[number];
export type BrushParams = Record<BrushParam, number>;

// The range of every setting.
export const PARAM_RANGES: Record<BrushParam, [number, number]> = {
  flow: [0.05, 1],
  hardness: [0, 1],
  spacing: [0.05, 2],
  form: [0.1, 1],
  rotation: [0, 180],
  grain: [0, 1],
  dynamics: [0, 1],
};

// What a brush draws with: the legacy pen, tips (stamps) put along the stroke, or a spray of scattered dots.
export type BrushShape = `legacy` | `stamps` | `spray`;

// Dots scattered along the stroke (the lead of a pencil, the grain of chalk, the granulation of a watercolour): how many at full grain, how large, how far from the stroke as a part of
// the radius of the tip, and how opaque.
export interface Speckle {
  density: number;
  size: number;
  sizeGrain: number;
  scale: number;
  opacity: number;
}

// Bristles: thin lines along the stroke, spread across its width. At most `count` of them, each with an opacity between the two values of `alpha`, and `gaps` for the amount of
// gaps at full grain (bristles that skip, more and more towards the end of the stroke, as a brush that runs out of paint).
export interface Bristles {
  count: number;
  alpha: [number, number];
  gaps: number;
}

export interface BrushDef {
  shape: BrushShape;
  // The tip of the stamps.
  tip: `ellipse` | `rect`;
  // The width of a tip as a number of times the thickness of the stroke.
  size: number;
  // The stroke is pointed at its two ends.
  taper: boolean;
  // Whether tips are put along the stroke (a brush of bristles or dots can do without).
  stamps: boolean;
  // How irregular the edge of a tip is at full grain (0 for a smooth tip).
  rough: number;
  speckle?: Speckle;
  bristles?: Bristles;
  // The settings that the panel shows for this brush.
  params: BrushParam[];
  // The value of every setting when the stroke does not store it.
  defaults: BrushParams;
  // The thickness of the stroke that the pictogram of the brush is drawn with.
  previewWidth: number;
  // How opaque the paint of the brush is (1 when absent): an airbrush or a watercolour is translucent by nature.
  body?: number;
}

const BASE: BrushParams = { flow: 1, hardness: 1, spacing: 0.15, form: 1, rotation: 45, grain: 0, dynamics: 0 };

const STAMP = { shape: `stamps` as const, tip: `ellipse` as const, taper: false, stamps: true, rough: 0, previewWidth: 3 };

export const BRUSH_DEFS: Record<BrushKind, BrushDef> = {
  round: { ...STAMP, shape: `legacy`, size: 1.6, stamps: false, params: [], defaults: BASE },
  soft: { ...STAMP, size: 2.4, params: [`flow`, `hardness`, `spacing`], defaults: { ...BASE, hardness: 0.3, spacing: 0.12 } },
  pencil: { ...STAMP, size: 1.8, stamps: false, speckle: { density: 8, size: 0.1, sizeGrain: 0.14, scale: 1, opacity: 0.9 }, params: [`flow`, `grain`], defaults: { ...BASE, flow: 0.8, grain: 0.5 } },
  felt: { ...STAMP, size: 2, params: [`flow`, `spacing`], defaults: { ...BASE, spacing: 0.15 } },
  square: { ...STAMP, tip: `rect`, size: 1.8, params: [`flow`, `form`, `rotation`], defaults: { ...BASE, spacing: 0.12, rotation: 0 } },
  ink: { ...STAMP, size: 2.4, taper: true, params: [`dynamics`, `spacing`], defaults: { ...BASE, spacing: 0.08, dynamics: 0.7 } },
  nib: { ...STAMP, size: 3, params: [`flow`, `form`, `rotation`], defaults: { ...BASE, spacing: 0.06, form: 0.15, rotation: 45 } },
  lino: { ...STAMP, size: 2.8, taper: true, rough: 0.9, params: [`grain`, `dynamics`], defaults: { ...BASE, spacing: 0.08, grain: 0.5, dynamics: 0.8 } },
  airbrush: { ...STAMP, size: 5, previewWidth: 4, body: 0.5, params: [`flow`, `hardness`], defaults: { ...BASE, hardness: 0.05, spacing: 0.08 } },
  aerosol: { ...STAMP, shape: `spray`, size: 2.2, stamps: false, params: [`flow`], defaults: { ...BASE, grain: 0.5 } },
  // The brushes of painting.
  watercolor: { ...STAMP, size: 3.2, previewWidth: 5, body: 0.55, speckle: { density: 3, size: 0.1, sizeGrain: 0.1, scale: 0.9, opacity: 0.45 }, params: [`flow`, `hardness`, `grain`, `spacing`], defaults: { ...BASE, hardness: 0.35, spacing: 0.1, grain: 0.4 } },
  gouache: { ...STAMP, size: 2.6, previewWidth: 4, rough: 0.25, body: 0.85, bristles: { count: 10, alpha: [0.75, 1], gaps: 0.2 }, params: [`flow`, `grain`, `dynamics`], defaults: { ...BASE, spacing: 0.1, grain: 0.3 } },
  oil: { ...STAMP, size: 2.4, previewWidth: 4, body: 0.8, bristles: { count: 18, alpha: [0.65, 1], gaps: 0.25 }, params: [`flow`, `grain`, `dynamics`], defaults: { ...BASE, spacing: 0.1, grain: 0.2, dynamics: 0.3 } },
  drybrush: { ...STAMP, size: 2.6, previewWidth: 4, stamps: false, bristles: { count: 24, alpha: [0.55, 1], gaps: 1 }, params: [`flow`, `grain`, `dynamics`], defaults: { ...BASE, flow: 0.85, grain: 0.6, dynamics: 0.2 } },
  // The brushes of dry supports.
  chalk: { ...STAMP, size: 2.2, previewWidth: 4, rough: 0.5, speckle: { density: 6, size: 0.1, sizeGrain: 0.1, scale: 1.05, opacity: 0.8 }, params: [`flow`, `grain`, `spacing`], defaults: { ...BASE, flow: 0.9, hardness: 0.8, spacing: 0.12, grain: 0.6 } },
  pastel: { ...STAMP, size: 2.6, previewWidth: 4, body: 0.9, speckle: { density: 5, size: 0.1, sizeGrain: 0.1, scale: 1, opacity: 0.6 }, params: [`flow`, `hardness`, `grain`], defaults: { ...BASE, hardness: 0.5, spacing: 0.1, grain: 0.4 } },
  charcoal: { ...STAMP, size: 3, previewWidth: 5, rough: 0.6, speckle: { density: 8, size: 0.13, sizeGrain: 0.1, scale: 1.1, opacity: 0.85 }, params: [`flow`, `hardness`, `grain`, `dynamics`], defaults: { ...BASE, flow: 0.85, hardness: 0.4, spacing: 0.1, grain: 0.7, dynamics: 0.4 } },
};

// The most polygons that a stroke makes, and the most dots that a spray makes, so that a long stroke stays light to draw.
const MAX_POLYGONS = 2200;
const MAX_DOTS = 6000;

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

// Tells whether a value is a brush.
export function isBrush(value: unknown): value is BrushKind {
  return typeof value === `string` && (BRUSH_KINDS as readonly string[]).includes(value);
}

// Brings a setting into its range (and rounds it: whole degrees for the rotation, hundredths for the others).
export function cleanParam(param: BrushParam, value: number): number {
  const [min, max] = PARAM_RANGES[param];
  const rounded = param === `rotation` ? Math.round(value) : Math.round(value * 100) / 100;
  return Math.min(max, Math.max(min, rounded));
}

// Tells whether a value is a valid value of a setting.
export function isParamValue(param: BrushParam, value: unknown): value is number {
  return typeof value === `number` && Number.isFinite(value) && value >= PARAM_RANGES[param][0] && value <= PARAM_RANGES[param][1];
}

// Returns the settings of a stroke: the ones it stores, and the usual ones of its brush for the others.
export function paramsOf(brush: BrushKind, stored: Partial<BrushParams>): BrushParams {
  const out = { ...BRUSH_DEFS[brush].defaults };
  for (const p of BRUSH_PARAMS) {
    const v = stored[p];
    if (typeof v === `number` && Number.isFinite(v)) out[p] = v;
  }
  return out;
}

// The names under which a stroke stores its settings (the rotation keeps the name of the angle of the nib, which the files of version 0.19.0 already use).
export interface BrushFields {
  flow?: number;
  hardness?: number;
  spacing?: number;
  form?: number;
  nibAngle?: number;
  grain?: number;
  dynamics?: number;
}

// Returns the settings in the names that a stroke stores them under.
export function fieldsOf(params: Partial<BrushParams>): BrushFields {
  const out: BrushFields = {};
  for (const p of BRUSH_PARAMS) {
    const v = params[p];
    if (typeof v === `number`) {
      if (p === `rotation`) out.nibAngle = v;
      else out[p] = v;
    }
  }
  return out;
}

// Returns the settings that a stroke stores, in the names of the settings.
export function paramsFromFields(fields: BrushFields): Partial<BrushParams> {
  const out: Partial<BrushParams> = {};
  for (const p of BRUSH_PARAMS) {
    const v = p === `rotation` ? fields.nibAngle : fields[p];
    if (typeof v === `number`) out[p] = v;
  }
  return out;
}

// Returns only the settings that are not the usual ones of the brush (what a file keeps).
export function sparseParams(brush: BrushKind, params: Partial<BrushParams>): Partial<BrushParams> {
  const out: Partial<BrushParams> = {};
  for (const p of BRUSH_PARAMS) {
    const v = params[p];
    if (typeof v === `number` && v !== BRUSH_DEFS[brush].defaults[p]) out[p] = v;
  }
  return out;
}

// Returns the points again, evenly spaced along the polyline (about `step` apart, the first and the last point kept), with a value for each of them taken from the values of the
// points of the polyline, and the distance along the stroke where each one is.
function along(points: Point[], values: number[], step: number): { pts: Point[]; vals: number[]; pos: number[]; total: number } {
  const pts: Point[] = [[points[0][0], points[0][1]]];
  const vals: number[] = [values[0]];
  const pos: number[] = [0];
  let carried = 0;
  let run = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let at = step - carried;
    while (at <= length) {
      const t = at / length;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      vals.push(values[i] + (values[i + 1] - values[i]) * t);
      pos.push(run + at);
      at += step;
    }
    carried = length - (at - step);
    run += length;
  }
  const last = points[points.length - 1];
  const end = pts[pts.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 0.01) {
    pts.push([last[0], last[1]]);
    vals.push(values[values.length - 1]);
    pos.push(run);
  }
  return { pts, vals, pos, total: run };
}

// Returns the points again, evenly spaced along the polyline (about `step` apart, the first and the last point kept).
export function spaced(points: Point[], step: number): Point[] {
  if (points.length < 2) return points.map((p): Point => [p[0], p[1]]);
  return along(points, points.map(() => 0), step).pts;
}

// Returns how thick the stroke is at every recorded point, from 1 (the full size) down to 0.25: the further apart two recorded points are, the faster the pointer went, and the
// thinner the stroke gets for dynamics above 0.
export function speedFactors(points: Point[], reference: number, dynamics: number): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (dynamics <= 0 || n < 3) return points.map(() => 1);
  const gap = points.map((p, i) => (i === 0 ? 0 : Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1])));
  gap[0] = gap[1];
  const speed = gap.map((g) => Math.min(1, g / Math.max(1, reference * 1.2)));
  // The speed is smoothed over a few points, so that the width does not jump.
  return speed.map((_, i) => {
    let [sum, count] = [0, 0];
    for (let k = -3; k <= 3; k++) {
      const j = i + k;
      if (j >= 0 && j < n) {
        sum += speed[j];
        count++;
      }
    }
    return Math.max(0.25, 1 - dynamics * 0.75 * (sum / count));
  });
}

// Returns a repeatable random generator for a seed.
function random(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// The data of a closed polygon (the points turn the same way for every tip, so that tips of one layer that overlap merge instead of cancelling out).
function polygon(poly: Point[]): string {
  return `M${poly.map((p) => `${r1(p[0])},${r1(p[1])}`).join(` L`)} Z`;
}

// Returns the polygon of a tip centred on a point: an ellipse (radii rx along the rotation and ry across it, with an optional roughness of the edge) or a rectangle.
function tip(shape: `ellipse` | `rect`, cx: number, cy: number, rx: number, ry: number, rotation: number, rough: number, rnd: () => number): Point[] {
  const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
  const at = (x: number, y: number): Point => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  if (shape === `rect`) return [at(-rx, -ry), at(rx, -ry), at(rx, ry), at(-rx, ry)];
  const n = Math.max(rx, ry) > 6 ? 12 : Math.max(rx, ry) > 2.5 ? 10 : 8;
  return Array.from({ length: n }, (_, k): Point => {
    const a = (k * 2 * Math.PI) / n;
    const jitter = rough > 0 ? 1 + (rnd() - 0.5) * rough : 1;
    return at(rx * jitter * Math.cos(a), ry * jitter * Math.sin(a));
  });
}

// Returns the data of the spray: tiny dots scattered around the stroke, in a disc of the given radius. The flow gives how many there are (`density` dots per step at full flow).
// A dot is a segment of no length that the round ends of the line make round, so the data only has moves and lines. Two sizes of dots make it grainy.
export function sprayPath(points: Point[], radius: number, flow: number, seed: number, density = 5): { small: string; large: string } {
  if (points.length === 0) return { small: ``, large: `` };
  const rnd = random(seed);
  let length = 0;
  for (let i = 0; i + 1 < points.length; i++) length += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  const perStep = Math.max(1, Math.round(flow * density));
  // The step grows for a very long stroke, so that the number of dots stays under the limit.
  const step = Math.max(radius * 0.35, 1.5, (length * perStep) / MAX_DOTS);
  const centres = points.length === 1 ? points : spaced(points, step);
  const small: string[] = [];
  const large: string[] = [];
  for (const c of centres) {
    for (let k = 0; k < perStep; k++) {
      const angle = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * radius;
      const x = r2(c[0] + Math.cos(angle) * dist);
      const y = r2(c[1] + Math.sin(angle) * dist);
      (rnd() < 0.25 ? large : small).push(`M${x},${y} L${r2(x + 0.01)},${y}`);
    }
  }
  return { small: small.join(` `), large: large.join(` `) };
}

// What a brush leaves on the page: paths with their colours, ready to be drawn.
export interface BrushPiece {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity: number;
  // A blur of the piece (a standard deviation, in page units): the soft edge of a brush that is not hard.
  blur?: number;
}

export interface BrushInput {
  brush: BrushKind;
  // The points of the stroke (as drawn, or tidied).
  points: Point[];
  // The thickness of the stroke, in page units.
  width: number;
  color: string;
  seed: number;
  params: BrushParams;
  // Whether the speed of the pointer, read in the gaps between the points, changes the width (not for a tidied stroke, whose points are evenly spaced).
  dynamic: boolean;
}

// What a brush makes: its pieces, and the data of the gaps where there is no paint left on the brush (empty for a stroke without gaps).
export interface BrushResult {
  pieces: BrushPiece[];
  holes: string;
}

// Returns the length of a polyline.
function lengthOf(points: Point[]): number {
  let length = 0;
  for (let i = 0; i + 1 < points.length; i++) length += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  return length;
}

// Returns the gaps of a stroke made with a brush that has little paint on it. The flow is the quantity of paint on the brush: at 1 the stroke is whole; below, streaks and spots of
// the paper show through, and there are more of them as the brush runs out of paint towards the end of the stroke. The gaps are thin ellipses that follow the stroke.
export function paintHoles(points: Point[], width: number, flow: number, seed: number): string {
  if (points.length < 2 || flow >= 1) return ``;
  const rnd = random(seed * 7 + 13);
  const half = Math.max(1, width) / 2;
  const total = lengthOf(points);
  if (total < 1) return ``;
  const step = Math.max(width * 0.5, 2, total / 700);
  const pts = spaced(points, step);
  const out: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const angle = Math.atan2(next[1] - prev[1], next[0] - prev[0]);
    const progress = pts.length > 1 ? i / (pts.length - 1) : 0;
    // The part of the stroke that has no paint: from a little at the start to much more at the end.
    const missing = Math.min(0.92, (1 - flow) * (0.28 + 0.75 * progress));
    // Most of the gaps are thin streaks that follow the stroke, as the marks of bristles, and some are small round spots; their edge is irregular.
    const spot = rnd() < 0.3;
    const mean = spot ? half * 0.18 : half * 1.2;
    const ell = spot ? half * (0.08 + rnd() * 0.22) : half * (0.4 + rnd() * 1.6);
    const thick = spot ? ell : half * (0.05 + rnd() * 0.17);
    const expected = (missing * step * 2 * half * 0.85) / (Math.PI * (spot ? ell * thick : mean * half * 0.14) + 0.01);
    let count = Math.floor(expected);
    if (rnd() < expected - count) count++;
    for (let k = 0; k < count; k++) {
      // The gaps of one place are spread along the stroke as well as across it, so that they do not line up.
      const across = (rnd() * 2 - 1) * half * 1.05;
      const along = (rnd() - 0.5) * step * 1.6;
      const cx = pts[i][0] - Math.sin(angle) * across + Math.cos(angle) * along;
      const cy = pts[i][1] + Math.cos(angle) * across + Math.sin(angle) * along;
      out.push(polygon(tip(`ellipse`, cx, cy, ell, thick, angle, 0.7, rnd)));
    }
  }
  return out.join(` `);
}

// Returns the sharpness of the edge of a brush as the blur that softens it: none for a hard brush, and up to almost half of the radius of the tip for the softest.
function edgeBlur(hardness: number, radius: number): number | undefined {
  const sigma = (1 - hardness) * radius * 0.45;
  return sigma >= 0.15 ? r2(sigma) : undefined;
}

// Returns the pieces of the tips of a brush: a row of tips put along the stroke, all in one shape (the paint does not build up where they overlap).
function stampPieces(input: BrushInput, def: BrushDef): BrushPiece[] {
  const { points, width, color, params } = input;
  const diameter = width * def.size;
  const rnd = random(input.seed);
  const values = input.dynamic ? speedFactors(points, diameter, params.dynamics) : points.map(() => 1);
  const length = lengthOf(points);
  const step = Math.max(0.7, params.spacing * diameter, length / MAX_POLYGONS);
  const spread = along(points.length === 1 ? [points[0], points[0]] : points, points.length === 1 ? [values[0], values[0]] : values, step);
  const rotation = (params.rotation * Math.PI) / 180;
  const rough = def.rough * params.grain;
  const polys: string[] = [];
  spread.pts.forEach((p, i) => {
    // A pointed stroke thins out over the last stretch before each end.
    const ends = def.taper ? Math.min(1, 0.3 + (0.7 * Math.min(spread.pos[i], spread.total - spread.pos[i])) / (diameter * 2)) : 1;
    const rx = (diameter / 2) * spread.vals[i] * ends;
    if (rx < 0.2) return;
    polys.push(polygon(tip(def.tip, p[0], p[1], rx, rx * params.form, rotation, rough, rnd)));
  });
  if (polys.length === 0) return [];
  return [{ d: polys.join(` `), stroke: `none`, strokeWidth: 0, fill: color, opacity: def.body ?? 1, ...(def.params.includes(`hardness`) ? { blur: edgeBlur(params.hardness, diameter / 2) } : {}) }];
}

// Returns the dots scattered along a stroke (see Speckle).
function specklePieces(input: BrushInput, def: BrushDef, speckle: Speckle): BrushPiece[] {
  const { points, width, color, params } = input;
  const radius = ((width * def.size) / 2) * speckle.scale;
  // The grain gives how many dots and how large; without a grain setting, the usual grain of the brush.
  const grain = def.params.includes(`grain`) ? params.grain : def.defaults.grain;
  // A brush that has only dots (a pencil) makes fewer of them with less paint on it; the others have gaps instead (see paintHoles).
  const load = def.stamps ? 1 : params.flow;
  const density = Math.max(1, Math.round(speckle.density * (0.3 + 0.7 * grain) * load));
  const spray = sprayPath(points, radius, 1, input.seed + 5, density);
  const base = Math.max(0.7, width * (speckle.size + speckle.sizeGrain * grain));
  const piece = (d: string, w: number): BrushPiece[] => (d === `` ? [] : [{ d, stroke: color, strokeWidth: w, fill: `none`, opacity: speckle.opacity }]);
  return [...piece(spray.small, base), ...piece(spray.large, base * 1.8)];
}

// Returns the bristles of a brush: thin lines along the stroke, spread across its width, some of them skipping (see Bristles).
function bristlePieces(input: BrushInput, def: BrushDef, bristles: Bristles): BrushPiece[] {
  const { points, width, color, params } = input;
  const full = width * def.size;
  const count = Math.max(5, Math.min(bristles.count, Math.round(full / 1.6)));
  const rnd = random(input.seed + 11);
  const values = input.dynamic ? speedFactors(points, full, params.dynamics) : points.map(() => 1);
  const step = Math.min(6, Math.max(1.5, full * 0.12));
  const spread = along(points.length === 1 ? [points[0], points[0]] : points, points.length === 1 ? [values[0], values[0]] : values, step);
  const n = spread.pts.length;
  if (n < 2) return [];
  // The side of every sample of the stroke.
  const side: Point[] = spread.pts.map((_, i) => {
    const prev = spread.pts[Math.max(0, i - 1)];
    const next = spread.pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;
    return [-(next[1] - prev[1]) / len, (next[0] - prev[0]) / len];
  });
  const lines = [``, ``, ``];
  const grain = def.params.includes(`grain`) ? params.grain : def.defaults.grain;
  const gapAmount = Math.min(0.9, bristles.gaps * grain);
  const bw = Math.max(0.8, (full / count) * 1.35);
  for (let k = 0; k < count; k++) {
    const u = ((k + 0.5) / count) * 2 - 1 + (rnd() - 0.5) * (2 / count) * 0.6;
    const phase = rnd() * 6.28;
    const wave = 18 + rnd() * 30;
    const alpha = bristles.alpha[0] + rnd() * (bristles.alpha[1] - bristles.alpha[0]);
    const cls = alpha < bristles.alpha[0] + (bristles.alpha[1] - bristles.alpha[0]) / 3 ? 0 : alpha < bristles.alpha[0] + ((bristles.alpha[1] - bristles.alpha[0]) * 2) / 3 ? 1 : 2;
    // Ink and gaps follow one another along the bristle.
    let ink = true;
    let left = (0.8 + rnd() * 1.6) * full * 3;
    let run: string[] = [];
    const flush = (): void => {
      if (run.length >= 2) lines[cls] += `${lines[cls] === `` ? `` : ` `}M${run.join(` L`)}`;
      else if (run.length === 1) lines[cls] += `${lines[cls] === `` ? `` : ` `}M${run[0]} L${run[0]}`;
      run = [];
    };
    for (let i = 0; i < n; i++) {
      const progress = spread.total > 0 ? spread.pos[i] / spread.total : 0;
      if (i > 0) left -= spread.pos[i] - spread.pos[i - 1];
      if (left <= 0) {
        flush();
        ink = !ink;
        const inkLen = (0.8 + rnd() * 1.6) * full * 3;
        // The gaps get longer towards the end of the stroke, as a brush that runs out of paint.
        const gapShare = Math.min(0.92, gapAmount * (0.15 + 0.85 * Math.pow(progress, 1.2)));
        left = ink ? inkLen : (inkLen * gapShare) / Math.max(0.05, 1 - gapShare);
        if (!ink && gapShare < 0.04) {
          ink = true;
          left = inkLen;
        }
      }
      if (ink) {
        const off = (u * (full / 2) + Math.sin(spread.pos[i] / wave + phase) * full * 0.03) * spread.vals[i];
        run.push(`${r1(spread.pts[i][0] + side[i][0] * off)},${r1(spread.pts[i][1] + side[i][1] * off)}`);
      }
    }
    flush();
  }
  const out: BrushPiece[] = [];
  lines.forEach((d, cls) => {
    if (d !== ``) out.push({ d, stroke: color, strokeWidth: bw, fill: `none`, opacity: Math.min(1, bristles.alpha[0] + ((bristles.alpha[1] - bristles.alpha[0]) * (cls + 0.5)) / 3) });
  });
  return out;
}

// Returns what a brush other than the round one leaves along a stroke. A stroke of one point (a click) makes one touch.
export function brushMake(input: BrushInput): BrushResult {
  const def = BRUSH_DEFS[input.brush];
  const { points, width, color, params } = input;
  if (points.length === 0 || def.shape === `legacy`) return { pieces: [], holes: `` };
  if (def.shape === `spray`) {
    const spray = sprayPath(points, width * def.size, params.flow, input.seed, 5);
    const piece = (d: string, w: number): BrushPiece[] => (d === `` ? [] : [{ d, stroke: color, strokeWidth: w, fill: `none`, opacity: 0.85 }]);
    return { pieces: [...piece(spray.small, Math.max(0.9, width * 0.2)), ...piece(spray.large, Math.max(1.6, width * 0.4))], holes: `` };
  }
  const pieces: BrushPiece[] = [];
  if (def.stamps) pieces.push(...stampPieces(input, def));
  if (def.speckle) pieces.push(...specklePieces(input, def, def.speckle));
  if (def.bristles) pieces.push(...bristlePieces(input, def, def.bristles));
  // The flow of a pencil is how many dots it makes; for the others it is the quantity of paint on the brush.
  const holes = def.speckle && !def.stamps ? `` : paintHoles(points, width * def.size, params.flow, input.seed);
  return { pieces, holes };
}

// Returns the pieces of a brush (without its gaps), for the pictograms.
export function brushPieces(input: BrushInput): BrushPiece[] {
  return brushMake(input).pieces;
}

// The wave that every brush draws in its pictogram, on a grid of 100 by 40.
export function previewPoints(): Point[] {
  return Array.from({ length: 36 }, (_, i): Point => [6 + (i * 88) / 35, 20 + Math.sin((i / 35) * Math.PI * 2) * 9]);
}
