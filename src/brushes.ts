// The brushes of the pen: the shapes they leave on the page. The round brush is the pen as it always was (see shape-paths.ts). The other brushes put a tip (a stamp) again and again
// along the stroke, as the brushes of a painting program do, and every brush has its own settings. Pure module: no access to the page.
import type { Point } from "./elements";

// The brushes. The round one is the default and is not stored in a file.
export const BRUSH_KINDS = [`round`, `soft`, `pencil`, `felt`, `square`, `ink`, `nib`, `lino`, `airbrush`, `aerosol`] as const;
export type BrushKind = (typeof BRUSH_KINDS)[number];

// The settings of a brush. The flow is the paint that every touch of the brush leaves (a touch that overlaps another one adds to it, which is not the same as the opacity of the
// whole stroke); the hardness goes from a soft edge to a sharp one; the spacing is the distance between two touches (as a part of the size); the form goes from a flat tip to a round
// one; the rotation is the angle of the tip in degrees; the grain goes from smooth to rough; the dynamics make the stroke thinner when the pointer goes fast.
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

// What a brush draws with: a legacy pen, tips that are ellipses or rectangles, a cloud of dots near the stroke, or a spray of scattered dots.
export type BrushShape = `legacy` | `ellipse` | `rect` | `dots` | `spray`;

export interface BrushDef {
  shape: BrushShape;
  // The width of a tip as a number of times the thickness of the stroke.
  size: number;
  // The stroke is pointed at its two ends.
  taper: boolean;
  // The settings that the panel shows for this brush.
  params: BrushParam[];
  // The value of every setting when the stroke does not store it.
  defaults: BrushParams;
}

const BASE: BrushParams = { flow: 1, hardness: 1, spacing: 0.15, form: 1, rotation: 45, grain: 0, dynamics: 0 };

export const BRUSH_DEFS: Record<BrushKind, BrushDef> = {
  round: { shape: `legacy`, size: 1.6, taper: false, params: [], defaults: BASE },
  soft: { shape: `ellipse`, size: 2.4, taper: false, params: [`flow`, `hardness`, `spacing`], defaults: { ...BASE, flow: 0.8, hardness: 0.3, spacing: 0.12 } },
  pencil: { shape: `dots`, size: 1.8, taper: false, params: [`flow`, `grain`], defaults: { ...BASE, flow: 0.7, grain: 0.5 } },
  felt: { shape: `ellipse`, size: 2, taper: false, params: [`flow`, `spacing`], defaults: { ...BASE, flow: 0.5, spacing: 0.15 } },
  square: { shape: `rect`, size: 1.8, taper: false, params: [`flow`, `form`, `rotation`], defaults: { ...BASE, flow: 0.6, spacing: 0.12, rotation: 0 } },
  ink: { shape: `ellipse`, size: 2.4, taper: true, params: [`dynamics`, `spacing`], defaults: { ...BASE, spacing: 0.08, dynamics: 0.7 } },
  nib: { shape: `ellipse`, size: 3, taper: false, params: [`flow`, `form`, `rotation`], defaults: { ...BASE, spacing: 0.06, form: 0.15, rotation: 45 } },
  lino: { shape: `ellipse`, size: 2.8, taper: true, params: [`grain`, `dynamics`], defaults: { ...BASE, spacing: 0.08, grain: 0.5, dynamics: 0.8 } },
  airbrush: { shape: `ellipse`, size: 5, taper: false, params: [`flow`, `hardness`], defaults: { ...BASE, flow: 0.3, hardness: 0.05, spacing: 0.08 } },
  aerosol: { shape: `spray`, size: 2.2, taper: false, params: [`flow`], defaults: { ...BASE, grain: 0.5 } },
};

// The number of layers that the touches are shared between: touches of different layers add up where they overlap, so the flow builds up (up to this many touches).
const LAYERS = 5;
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

// Returns the pieces that a brush other than the round one leaves along a stroke. A stroke of one point (a click) makes one touch.
export function brushPieces(input: BrushInput): BrushPiece[] {
  const def = BRUSH_DEFS[input.brush];
  const { points, width, color, params } = input;
  if (points.length === 0 || def.shape === `legacy`) return [];
  const diameter = width * def.size;
  if (def.shape === `spray` || def.shape === `dots`) {
    const dots = def.shape === `dots`;
    const spray = sprayPath(points, dots ? diameter / 2 : diameter, params.flow, input.seed, dots ? 8 : 5);
    const base = dots ? Math.max(0.7, width * (0.1 + 0.14 * params.grain)) : Math.max(0.9, width * 0.2);
    const piece = (d: string, w: number): BrushPiece[] => (d === `` ? [] : [{ d, stroke: color, strokeWidth: w, fill: `none`, opacity: dots ? 0.9 : 0.85 }]);
    return [...piece(spray.small, base), ...piece(spray.large, base * (dots ? 1.8 : 2))];
  }
  const rnd = random(input.seed);
  // The soft brushes put several smaller tips on top of each other, so that the middle is denser than the edge.
  const rings = 1 + Math.round((1 - params.hardness) * 3);
  const values = input.dynamic ? speedFactors(points, diameter, params.dynamics) : points.map(() => 1);
  const step = Math.max(0.7, params.spacing * diameter);
  let length = 0;
  for (let i = 0; i + 1 < points.length; i++) length += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  const spread = along(points.length === 1 ? [points[0], points[0]] : points, points.length === 1 ? [values[0], values[0]] : values, Math.max(step, (length * rings) / MAX_POLYGONS));
  const layers: string[][] = Array.from({ length: LAYERS }, () => []);
  const rotation = (params.rotation * Math.PI) / 180;
  const rough = def.shape === `ellipse` ? params.grain * (input.brush === `lino` ? 0.9 : 0) : 0;
  spread.pts.forEach((p, i) => {
    // A pointed stroke thins out over the last stretch before each end.
    const ends = def.taper ? Math.min(1, 0.3 + (0.7 * Math.min(spread.pos[i], spread.total - spread.pos[i])) / (diameter * 2)) : 1;
    const rx = (diameter / 2) * spread.vals[i] * ends;
    if (rx < 0.2) return;
    for (let j = 0; j < rings; j++) {
      const scale = 1 - (j / rings) * 0.9;
      layers[(i + j) % LAYERS].push(polygon(tip(def.shape === `rect` ? `rect` : `ellipse`, p[0], p[1], rx * scale, rx * scale * params.form, rotation, rough, rnd)));
    }
  });
  // Every layer has the paint of one touch; where touches of several layers overlap, the paint adds up.
  // The paint of a touch grows faster than the flow itself (its square), so that the flow can be told apart from full paint over the whole range of the slider.
  const alpha = params.flow * params.flow * (0.3 + 0.7 * params.hardness);
  return layers.filter((l) => l.length > 0).map((l): BrushPiece => ({ d: l.join(` `), stroke: `none`, strokeWidth: 0, fill: color, opacity: Math.min(1, alpha) }));
}

// The wave that every brush draws in its pictogram, on a grid of 100 by 40.
export function previewPoints(): Point[] {
  return Array.from({ length: 36 }, (_, i): Point => [6 + (i * 88) / 35, 20 + Math.sin((i / 35) * Math.PI * 2) * 9]);
}
