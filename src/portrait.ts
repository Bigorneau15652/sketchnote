// The character in the manner of an identikit: a face alone, made of parts that the user chooses (the shape of the face, a man or a woman, the hair, a hat, a beard or a moustache, glasses,
// earrings, the nose, the expression, the side it looks at). It is an icon element that keeps its choices; its shapes are drawn again from them each time one changes, so every tool that
// works on an icon (move, resize, turn, mirror, colour, erase, export) works on a portrait. Pure module: no page, no application.
import type { IconElement, IconShapeData, Point } from "./elements";
import { DEFAULT_FACE, DEFAULT_LOOK, FACE_IDS, FaceId, faceShapes, FIGURE_VB, isFaceId, isLookId, LOOK_IDS, LookId } from "./figure";
import { t } from "./i18n";

export const SHAPE_IDS = [`round`, `long`, `square`, `oval`, `heart`] as const;
export type FaceShapeId = (typeof SHAPE_IDS)[number];
export const SEX_IDS = [`man`, `woman`] as const;
export type SexId = (typeof SEX_IDS)[number];
export const HAIR_IDS = [`bald`, `short`, `long`, `medium`, `bob`, `ponytail`, `bun`, `fringe`, `crest`, `punk`] as const;
export type HairId = (typeof HAIR_IDS)[number];
export const HAT_IDS = [`none`, `cap`, `captain`, `round`, `top`, `beanie`, `helmet`, `crown`] as const;
export type HatId = (typeof HAT_IDS)[number];
export const BEARD_IDS = [`none`, `short`, `long`, `goatee`, `moustache`, `thin`, `handlebar`, `goateestache`, `both`] as const;
export type BeardId = (typeof BEARD_IDS)[number];
export const GLASSES_IDS = [`none`, `round`, `square`] as const;
export type GlassesId = (typeof GLASSES_IDS)[number];
export const EARRING_IDS = [`none`, `rings`] as const;
export type EarringId = (typeof EARRING_IDS)[number];
export const NOSE_IDS = [`small`, `long`, `round`] as const;
export type NoseId = (typeof NOSE_IDS)[number];

// Six skin tones, from the lightest to the darkest, and fifteen colours of hair. A colour is painted on the shapes it belongs to (the face, the hair, the beard), whatever the fill of the element.
export const SKIN_TONES = { s1: `#fbe3d3`, s2: `#f1c9a5`, s3: `#dfa97a`, s4: `#c28a5c`, s5: `#8d5a3b`, s6: `#5b3a29` } as const;
export type SkinId = keyof typeof SKIN_TONES;
export const SKIN_IDS = Object.keys(SKIN_TONES) as SkinId[];
export const HAIR_COLORS = {
  black: `#1d1a1a`,
  darkbrown: `#3a2417`,
  brown: `#5b3a22`,
  chestnut: `#8a5a34`,
  auburn: `#9b3d1c`,
  red: `#c8501e`,
  darkblond: `#b98f3e`,
  blond: `#e2c26a`,
  platinum: `#efe9d2`,
  grey: `#9b9b9b`,
  white: `#f4f4f4`,
  blue: `#3a6fd8`,
  pink: `#e86aa6`,
  green: `#3fae5a`,
  purple: `#8a4fd1`,
} as const;
export type HairColorId = keyof typeof HAIR_COLORS;
export const HAIR_COLOR_IDS = Object.keys(HAIR_COLORS) as HairColorId[];
// Eight colours for the hat, so that it hides what is under it.
export const HAT_COLORS = { white: `#fafafa`, black: `#2b2b2b`, red: `#d9382b`, blue: `#2f5fb8`, navy: `#1f2f5a`, green: `#3a9a4e`, yellow: `#f0c43a`, brown: `#7a5230` } as const;
export type HatColorId = keyof typeof HAT_COLORS;
export const HAT_COLOR_IDS = Object.keys(HAT_COLORS) as HatColorId[];

// What an element keeps of a portrait.
export interface PortraitData {
  shape: FaceShapeId;
  sex: SexId;
  hair: HairId;
  hat: HatId;
  beard: BeardId;
  glasses: GlassesId;
  earrings: EarringId;
  nose: NoseId;
  face: FaceId;
  look: LookId;
  skin: SkinId;
  haircolor: HairColorId;
  hatcolor: HatColorId;
}

export const DEFAULT_PORTRAIT: PortraitData = { shape: `round`, sex: `man`, hair: `short`, hat: `none`, beard: `none`, glasses: `none`, earrings: `none`, nose: `small`, face: DEFAULT_FACE, look: DEFAULT_LOOK, skin: `s2`, haircolor: `brown`, hatcolor: `white` };
export const MIN_PORTRAIT_SIZE = 40;
export const MAX_PORTRAIT_SIZE = 400;
export const DEFAULT_PORTRAIT_SIZE = 140;

const KINDS = { shape: SHAPE_IDS, sex: SEX_IDS, hair: HAIR_IDS, hat: HAT_IDS, beard: BEARD_IDS, glasses: GLASSES_IDS, earrings: EARRING_IDS, nose: NOSE_IDS, face: FACE_IDS, look: LOOK_IDS, skin: SKIN_IDS, haircolor: HAIR_COLOR_IDS, hatcolor: HAT_COLOR_IDS } as const;
export type PortraitKey = keyof PortraitData;
export const PORTRAIT_KEYS = Object.keys(KINDS) as PortraitKey[];

export function cleanPortraitSize(size: number): number {
  return Math.round(Math.min(MAX_PORTRAIT_SIZE, Math.max(MIN_PORTRAIT_SIZE, size)));
}

// Reads a portrait: every choice is one of the known ones. A missing choice takes the usual one, a wrong one makes the whole thing refused (null).
export function readPortrait(value: unknown): PortraitData | null {
  if (typeof value !== `object` || value === null) return null;
  const v = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of PORTRAIT_KEYS) {
    const given = v[key];
    if (given === undefined) {
      out[key] = DEFAULT_PORTRAIT[key];
      continue;
    }
    if (typeof given !== `string` || !(KINDS[key] as readonly string[]).includes(given)) return null;
    out[key] = given;
  }
  return out as unknown as PortraitData;
}

// Keeps the choices of a patch that are known, over the choices that already are.
export function mergePortrait(base: PortraitData, patch: unknown): PortraitData {
  if (typeof patch !== `object` || patch === null) return base;
  const p = patch as Record<string, unknown>;
  const out: Record<string, string> = { ...base };
  for (const key of PORTRAIT_KEYS) {
    const given = p[key];
    if (typeof given === `string` && (KINDS[key] as readonly string[]).includes(given)) out[key] = given;
  }
  return out as unknown as PortraitData;
}

export const isPortraitFace = (v: unknown): v is FaceId => isFaceId(v);
export const isPortraitLook = (v: unknown): v is LookId => isLookId(v);

// ------------------------------------------------------------------------------------------------------------------------------------------------ geometry

const SC = 0.8;
const r1 = (n: number): number => Math.round(n * 10) / 10;
const f = (n: number): string => String(r1(n));
// A point of the design (the head is about 60 wide, centred) on the grid of 100 by 100.
const A = (x: number, y: number): Point => [50 + x * SC, 60 + y * SC];
const pt = (p: Point): string => `${f(p[0])},${f(p[1])}`;
const line = (d: string): IconShapeData => ({ d, fill: false, stroke: true, closed: false });
const paintedLoop = (d: string, paint: string): IconShapeData => ({ d, fill: false, stroke: true, closed: true, paint });
const loop = (d: string, paint?: string): IconShapeData => ({ d, fill: false, stroke: true, closed: true, ...(paint ? { paint } : {}) });

// A smooth curve through points (Catmull-Rom as Bezier curves), closed or open.
function spline(points: Point[], closed: boolean): string {
  const n = points.length;
  const at = (i: number): Point => (closed ? points[((i % n) + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

// The right half of the outline of each shape of face, from the top to the chin, in design units (x to the right of the centre, y down from the centre of the head).
const HALF: Record<FaceShapeId, [number, number][]> = {
  round: [[0, -35], [20, -30], [31, -10], [29, 12], [16, 29], [0, 34]],
  long: [[0, -40], [18, -35], [24, -12], [23, 14], [13, 34], [0, 42]],
  square: [[0, -33], [24, -32], [31, -24], [31, -2], [30, 16], [20, 30], [0, 34]],
  oval: [[0, -38], [19, -33], [27, -12], [25, 12], [14, 31], [0, 38]],
  heart: [[0, -35], [25, -31], [32, -14], [24, 8], [12, 26], [0, 38]],
};

// The outline of the face as design points, all round (the right half down, then the left half up). A woman has a slightly narrower face.
function outlinePoints(shape: FaceShapeId, sex: SexId): [number, number][] {
  const k = sex === `woman` ? 0.93 : 1;
  const half = HALF[shape].map(([x, y]): [number, number] => [x * k, y]);
  const right = half;
  const left = half.slice(1, -1).reverse().map(([x, y]): [number, number] => [-x, y]);
  return [...right, ...left];
}

// The top of the head and its width at the temples, for the hair and the hat.
const topOf = (shape: FaceShapeId): number => HALF[shape][0][1];

const smooth = (pts: [number, number][], closed = true): string => spline(pts.map(([x, y]) => A(x, y)), closed);
const poly = (pts: [number, number][], close: boolean): string => `M${pts.map(([x, y]) => pt(A(x, y))).join(`L`)}${close ? `Z` : ``}`;
const move = (x: number, y: number): string => `M${pt(A(x, y))}`;
const lineTo = (x: number, y: number): string => `L${pt(A(x, y))}`;
const quadTo = (cx: number, cy: number, x: number, y: number): string => `Q${pt(A(cx, cy))} ${pt(A(x, y))}`;
const circleD = (cx: number, cy: number, r: number): string => {
  const c = A(cx, cy);
  const rr = r * SC;
  return `M${f(c[0] + rr)},${f(c[1])}A${f(rr)},${f(rr)} 0 1,1 ${f(c[0] - rr)},${f(c[1])}A${f(rr)},${f(rr)} 0 1,1 ${f(c[0] + rr)},${f(c[1])}Z`;
};

// ------------------------------------------------------------------------------------------------------------------------------------------------ the parts

// The hair, in two parts: what covers the top of the head (hidden by a hat) and what hangs at the sides. Every closed shape of the hair is painted with the colour of the hair.
function hairParts(hair: HairId, top: number, paint: string): { top: IconShapeData[]; side: IconShapeData[] } {
  const cap = (): IconShapeData =>
    loop(`${move(-27, -12)}C${pt(A(-31, top - 12))} ${pt(A(31, top - 12))} ${pt(A(27, -12))}${lineTo(24, -18)}C${pt(A(18, top + 4))} ${pt(A(-18, top + 4))} ${pt(A(-24, -18))}Z`, paint);
  const sides = (to: number, flat = false): IconShapeData[] => {
    const l = flat
      ? loop(`${move(-28, -14)}${lineTo(-34, to)}${lineTo(-22, to)}${lineTo(-24, -14)}Z`, paint)
      : loop(`${move(-28, -14)}C${pt(A(-37, 8))} ${pt(A(-35, to - 12))} ${pt(A(-29, to))}${lineTo(-20, to)}C${pt(A(-25, to - 16))} ${pt(A(-24, 8))} ${pt(A(-25, -14))}Z`, paint);
    const r = flat
      ? loop(`${move(28, -14)}${lineTo(34, to)}${lineTo(22, to)}${lineTo(24, -14)}Z`, paint)
      : loop(`${move(28, -14)}C${pt(A(37, 8))} ${pt(A(35, to - 12))} ${pt(A(29, to))}${lineTo(20, to)}C${pt(A(25, to - 16))} ${pt(A(24, 8))} ${pt(A(25, -14))}Z`, paint);
    return [l, r];
  };
  switch (hair) {
    case `short`:
      return { top: [cap()], side: [] };
    case `long`:
      return { top: [cap()], side: sides(46) };
    case `medium`:
      return { top: [cap()], side: sides(26) };
    case `bob`:
      return { top: [cap()], side: sides(24, true) };
    case `ponytail`:
      return { top: [cap()], side: [loop(`${move(29, -18)}C${pt(A(46, -22))} ${pt(A(54, 0))} ${pt(A(42, 22))}C${pt(A(42, 10))} ${pt(A(38, 0))} ${pt(A(30, -8))}Z`, paint), loop(circleD(30, -14, 2.4), paint)] };
    case `bun`:
      return { top: [loop(circleD(0, top - 8, 9), paint), cap()], side: [] };
    case `fringe`:
      return { top: [loop(`${move(-27, -14)}C${pt(A(-31, top - 12))} ${pt(A(31, top - 12))} ${pt(A(27, -14))}${quadTo(14, -4, 0, -15)}${quadTo(-14, -4, -27, -14)}Z`, paint)], side: [] };
    case `crest`:
      return { top: [loop(poly([[-12, top + 8], [-10, top - 10], [-5, top + 2], [0, top - 14], [5, top + 2], [10, top - 10], [12, top + 8]], true), paint)], side: [] };
    case `punk`:
      return { top: [loop(poly([[-26, -14], [-28, top - 4], [-20, top + 2], [-22, top - 14], [-12, top - 4], [-10, top - 20], [0, top - 6], [3, top - 22], [10, top - 6], [15, top - 18], [19, top - 2], [28, top - 8], [26, -14], [20, -22], [-20, -22]], true), paint)], side: [] };
    default:
      return { top: [], side: [] };
  }
}

// The hat, sitting on the top of the head.
function hatShapes(hat: HatId, top: number, paint: string): IconShapeData[] {
  const ty = top;
  const loop = (d: string): IconShapeData => paintedLoop(d, paint);
  switch (hat) {
    case `cap`:
      // A baseball cap: a dome and a peak.
      return [loop(`${move(-28, ty + 12)}C${pt(A(-28, ty - 14))} ${pt(A(28, ty - 14))} ${pt(A(28, ty + 12))}Z`), loop(`${move(10, ty + 10)}${lineTo(42, ty + 12)}${quadTo(46, ty + 18, 38, ty + 18)}${lineTo(10, ty + 16)}Z`), line(`${move(0, ty - 10)}${lineTo(0, ty + 10)}`)];
    case `captain`:
      // A ship captain's cap: a wide flat crown, a band, a badge and a peak.
      return [loop(`${move(-31, ty + 10)}C${pt(A(-36, ty - 12))} ${pt(A(36, ty - 12))} ${pt(A(31, ty + 10))}Z`), loop(poly([[-27, ty + 10], [27, ty + 10], [27, ty + 19], [-27, ty + 19]], true)), loop(circleD(0, ty + 4, 3.4)), loop(`${move(-17, ty + 19)}${quadTo(0, ty + 29, 17, ty + 19)}Z`)];
    case `round`:
      return [loop(`${move(-24, ty + 10)}C${pt(A(-24, ty - 20))} ${pt(A(24, ty - 20))} ${pt(A(24, ty + 10))}Z`), loop(`${move(-42, ty + 12)}${quadTo(0, ty + 20, 42, ty + 12)}${quadTo(0, ty + 4, -42, ty + 12)}Z`)];
    case `top`:
      return [loop(poly([[-18, ty + 8], [-16, ty - 28], [16, ty - 28], [18, ty + 8]], true)), line(poly([[-17, ty - 2], [17, ty - 2]], false)), loop(`${move(-30, ty + 10)}${quadTo(0, ty + 18, 30, ty + 10)}${quadTo(0, ty + 2, -30, ty + 10)}Z`)];
    case `beanie`:
      return [loop(`${move(-29, ty + 14)}C${pt(A(-30, ty - 16))} ${pt(A(30, ty - 16))} ${pt(A(29, ty + 14))}Z`), loop(poly([[-29, ty + 14], [29, ty + 14], [29, ty + 22], [-29, ty + 22]], true)), loop(circleD(0, ty - 12, 6))];
    case `helmet`:
      return [loop(`${move(-28, ty + 12)}C${pt(A(-28, ty - 14))} ${pt(A(28, ty - 14))} ${pt(A(28, ty + 12))}Z`), loop(poly([[-34, ty + 12], [34, ty + 12], [32, ty + 18], [-32, ty + 18]], true)), line(poly([[0, ty - 10], [0, ty + 12]], false))];
    case `crown`:
      return [loop(poly([[-24, ty + 12], [-24, ty - 8], [-12, ty + 2], [0, ty - 14], [12, ty + 2], [24, ty - 8], [24, ty + 12]], true))];
    default:
      return [];
  }
}

// The beard and the moustache, painted with the colour of the hair. The beard follows the lower half of the outline.
function beardShapes(beard: BeardId, outline: [number, number][], chin: number, long: boolean, paint: string): IconShapeData[] {
  const out: IconShapeData[] = [];
  const full = beard === `short` || beard === `long` || beard === `both`;
  if (full) {
    // The lower half of the outline, from one cheek to the other through the chin.
    const lower = [...outline.slice(2, Math.ceil(outline.length / 2) + 1), ...outline.slice(Math.floor(outline.length / 2) + 1, outline.length - 1)];
    const grow = beard === `long` || (beard === `both` && long) ? 1 : 0;
    const outer = lower.map(([x, y]): [number, number] => [x * 1.05, y > 0 ? y * 1.05 + grow * 12 * (y / 34) : y]);
    const inner = lower.map(([x, y]): [number, number] => [x * 0.78, y > 4 ? y * 0.78 - 4 : y]).reverse();
    out.push(loop(smooth([...outer, ...inner]), paint));
  }
  if (beard === `goatee` || beard === `goateestache`) {
    out.push(loop(smooth([[-7, chin - 16], [7, chin - 16], [6, chin - 6], [0, chin + 5], [-6, chin - 6]]), paint));
  }
  if (beard === `moustache` || beard === `goateestache` || beard === `both`) {
    out.push(loop(`${move(0, 5)}${quadTo(-8, 1, -17, 7)}${quadTo(-9, 10, 0, 8)}${quadTo(9, 10, 17, 7)}${quadTo(8, 1, 0, 5)}Z`, paint));
  }
  if (beard === `thin`) {
    out.push(line(`${move(-15, 7)}${quadTo(-8, 3, 0, 6)}${quadTo(8, 3, 15, 7)}`));
  }
  if (beard === `handlebar`) {
    // A big moustache whose ends curl up.
    out.push(loop(`${move(0, 5)}${quadTo(-10, 1, -18, 8)}${quadTo(-24, 13, -28, 5)}${quadTo(-25, 11, -19, 12)}${quadTo(-9, 10, 0, 10)}${quadTo(9, 10, 19, 12)}${quadTo(25, 11, 28, 5)}${quadTo(24, 13, 18, 8)}${quadTo(10, 1, 0, 5)}Z`, paint));
  }
  return out;
}

// The glasses, on the eyes.
function glassesShapes(glasses: GlassesId, look: LookId): IconShapeData[] {
  if (glasses === `none`) return [];
  const side = look === `left` ? -1 : look === `right` ? 1 : 0;
  const squeeze = side === 0 ? 1 : 0.8;
  const shift = side * 0.32 * 30;
  const X = (x: number): number => x * squeeze + shift;
  const out: IconShapeData[] = [];
  const ey = -4;
  for (const sx of [-1, 1]) {
    const cx = X(sx * 11.5);
    if (glasses === `round`) out.push(loop(circleD(cx, ey, 7.5 * squeeze)));
    else out.push(loop(`${move(cx - 8 * squeeze, ey - 6)}${lineTo(cx + 8 * squeeze, ey - 6)}${lineTo(cx + 8 * squeeze, ey + 6)}${lineTo(cx - 8 * squeeze, ey + 6)}Z`));
  }
  out.push(line(`${move(X(-4), ey)}${quadTo(X(0), ey - 3, X(4), ey)}`));
  out.push(line(`${move(X(-19), ey)}${lineTo(-31, ey - 2)}`), line(`${move(X(19), ey)}${lineTo(31, ey - 2)}`));
  return out;
}

// The nose seen from the front (a face that looks aside has the nose of the face).
function noseShapes(nose: NoseId, look: LookId): IconShapeData[] {
  if (look !== `front`) return [];
  switch (nose) {
    case `long`:
      return [line(`${move(0, -6)}${lineTo(-1.5, 11)}${quadTo(-7, 14, 5, 13)}`)];
    case `round`:
      return [loop(circleD(0, 8, 3.6))];
    default:
      return [line(`${move(1, 2)}${quadTo(5, 9, -2, 10)}`)];
  }
}

// The eyebrows and the lashes that the expressions do not have.
function extraShapes(face: FaceId, sex: SexId, look: LookId): IconShapeData[] {
  const out: IconShapeData[] = [];
  const squeeze = look === `front` ? 1 : 0.8;
  const shift = look === `left` ? -9.6 : look === `right` ? 9.6 : 0;
  const X = (x: number): number => x * squeeze + shift;
  const browless: FaceId[] = [`neutral`, `happy`, `laugh`, `wink`, `love`, `sleep`];
  if (browless.includes(face)) out.push(line(`${move(X(-16), -14)}${quadTo(X(-11), -17, X(-6), -14)}`), line(`${move(X(6), -14)}${quadTo(X(11), -17, X(16), -14)}`));
  const dotEyes: FaceId[] = [`neutral`, `happy`, `sad`, `cry`, `angry`, `think`, `shout`, `wink`, `talk`];
  if (sex === `woman` && dotEyes.includes(face)) out.push(line(`${move(X(-15.5), -5)}${lineTo(X(-18.5), -8)}`), line(`${move(X(15.5), -5)}${lineTo(X(18.5), -8)}`));
  return out;
}

// Returns the shapes of a portrait. The face is painted with the skin tone, the hair and the beard with the colour of the hair.
export function portraitShapes(p: PortraitData): IconShapeData[] {
  const out: IconShapeData[] = [];
  const outline = outlinePoints(p.shape, p.sex);
  const top = topOf(p.shape);
  const chin = HALF[p.shape][HALF[p.shape].length - 1][1];
  const skin = SKIN_TONES[p.skin];
  const hairPaint = HAIR_COLORS[p.haircolor];
  const hair = hairParts(p.hair, top, hairPaint);
  // The hair that hangs behind the face is drawn first, then the face, then what covers it.
  out.push(...hair.side);
  out.push(loop(smooth(outline), skin));
  // The ear that can be seen: both from the front, only the one on the side away from where the face looks otherwise.
  const ears: number[] = p.look === `front` ? [-1, 1] : p.look === `left` ? [1] : [-1];
  const earX = HALF[p.shape][2][0] * (p.sex === `woman` ? 0.93 : 1);
  for (const sx of ears) {
    out.push(line(`${move(sx * earX, -10)}C${pt(A(sx * (earX + 8), -12))} ${pt(A(sx * (earX + 8), 4))} ${pt(A(sx * earX, 3))}`));
    if (p.earrings === `rings`) out.push(loop(circleD(sx * (earX + 2.5), 8, 2.4)));
  }
  // The beard is over the face, under the features.
  out.push(...beardShapes(p.beard, outline, chin, p.shape === `long`, hairPaint));
  out.push(...extraShapes(p.face, p.sex, p.look));
  out.push(...faceShapes(p.face, A(0, p.shape === `long` ? 3 : 0), 30 * SC, 0, p.look));
  out.push(...noseShapes(p.nose, p.look));
  out.push(...glassesShapes(p.glasses, p.look));
  if (p.hat === `none`) out.push(...hair.top);
  else out.push(...hatShapes(p.hat, top, HAT_COLORS[p.hatcolor]));
  return out;
}

// Builds the element that a click with the Character tool puts: an icon, centred on the click, that keeps its portrait.
export function portraitElement(data: PortraitData, center: Point, size: number, ink: { stroke: string; strokeWidth: number; roughness: number; seed: number }, elementId: string): IconElement {
  const side = cleanPortraitSize(size);
  return {
    id: elementId,
    type: `icon`,
    x: r1(center[0] - side / 2),
    y: r1(center[1] - side / 2),
    width: side,
    height: side,
    name: t(`Personnage`),
    vb: [...FIGURE_VB],
    shapes: portraitShapes(data),
    portrait: data,
    stroke: ink.stroke,
    strokeWidth: Math.max(1, Math.min(ink.strokeWidth, side / 60)),
    roughness: ink.roughness,
    seed: ink.seed,
  };
}

// Returns the element with its portrait changed, and its shapes drawn again.
export function withPortrait(el: IconElement, data: PortraitData): IconElement {
  return { ...el, portrait: data, shapes: portraitShapes(data), vb: [...FIGURE_VB] };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ names and pictograms

export function partName(key: PortraitKey, id: string): string {
  const names: Record<string, Record<string, string>> = {
    shape: { round: t(`Visage rond`), long: t(`Visage allongé`), square: t(`Visage carré`), oval: t(`Visage ovale`), heart: t(`Visage en cœur`) },
    sex: { man: t(`Homme`), woman: t(`Femme`) },
    hair: { bald: t(`Chauve`), short: t(`Cheveux courts`), long: t(`Cheveux longs`), medium: t(`Cheveux mi-longs`), bob: t(`Carré`), ponytail: t(`Queue de cheval`), bun: t(`Chignon`), fringe: t(`Frange`), crest: t(`Crête`), punk: t(`Coupe punk`) },
    hat: { none: t(`Sans chapeau`), cap: t(`Casquette de base-ball`), captain: t(`Casquette de capitaine`), round: t(`Chapeau rond`), top: t(`Haut-de-forme`), beanie: t(`Bonnet`), helmet: t(`Casque de chantier`), crown: t(`Couronne`) },
    beard: { none: t(`Sans barbe`), short: t(`Barbe courte`), long: t(`Barbe longue`), goatee: t(`Bouc`), moustache: t(`Moustache`), thin: t(`Moustache fine`), handlebar: t(`Grosse moustache retroussée`), goateestache: t(`Moustache et bouc`), both: t(`Barbe et moustache`) },
    glasses: { none: t(`Sans lunettes`), round: t(`Lunettes rondes`), square: t(`Lunettes carrées`) },
    earrings: { none: t(`Sans boucles d'oreilles`), rings: t(`Boucles d'oreilles`) },
    nose: { small: t(`Petit nez`), long: t(`Long nez`), round: t(`Nez rond`) },
  };
  return names[key]?.[id] ?? id;
}

// The shapes of the pictogram of a choice: a bare head with that choice only.
export function partIconShapes(key: PortraitKey, id: string): IconShapeData[] {
  const bare: PortraitData = { ...DEFAULT_PORTRAIT, hair: `bald`, face: `blank`, nose: `small` };
  return portraitShapes({ ...bare, [key]: id } as PortraitData);
}

export const PARTS: { key: PortraitKey; ids: readonly string[] }[] = [
  { key: `shape`, ids: SHAPE_IDS },
  { key: `sex`, ids: SEX_IDS },
  { key: `hair`, ids: HAIR_IDS },
  { key: `hat`, ids: HAT_IDS },
  { key: `beard`, ids: BEARD_IDS },
  { key: `glasses`, ids: GLASSES_IDS },
  { key: `earrings`, ids: EARRING_IDS },
  { key: `nose`, ids: NOSE_IDS },
];

// The names of the colours.
export function skinName(id: SkinId): string {
  const names: Record<SkinId, string> = { s1: t(`Peau très claire`), s2: t(`Peau claire`), s3: t(`Peau mate`), s4: t(`Peau hâlée`), s5: t(`Peau brune`), s6: t(`Peau foncée`) };
  return names[id];
}

export function hairColorName(id: HairColorId): string {
  const names: Record<HairColorId, string> = {
    black: t(`Cheveux noirs`),
    darkbrown: t(`Cheveux bruns foncés`),
    brown: t(`Cheveux bruns`),
    chestnut: t(`Cheveux châtains`),
    auburn: t(`Cheveux auburn`),
    red: t(`Cheveux roux`),
    darkblond: t(`Cheveux blonds foncés`),
    blond: t(`Cheveux blonds`),
    platinum: t(`Cheveux platine`),
    grey: t(`Cheveux gris`),
    white: t(`Cheveux blancs`),
    blue: t(`Cheveux bleus`),
    pink: t(`Cheveux roses`),
    green: t(`Cheveux verts`),
    purple: t(`Cheveux violets`),
  };
  return names[id];
}

export function hatColorName(id: HatColorId): string {
  const names: Record<HatColorId, string> = { white: t(`Chapeau blanc`), black: t(`Chapeau noir`), red: t(`Chapeau rouge`), blue: t(`Chapeau bleu`), navy: t(`Chapeau bleu marine`), green: t(`Chapeau vert`), yellow: t(`Chapeau jaune`), brown: t(`Chapeau brun`) };
  return names[id];
}

// The name of a kind of choice (the title of a group of choices of the window).
export function partLabel(key: PortraitKey): string {
  const names: Record<PortraitKey, string> = {
    shape: t(`Forme du visage`),
    sex: t(`Homme ou femme`),
    hair: t(`Cheveux`),
    hat: t(`Chapeau`),
    beard: t(`Barbe et moustache`),
    glasses: t(`Lunettes`),
    earrings: t(`Boucles d'oreilles`),
    nose: t(`Nez`),
    face: t(`Expression`),
    look: t(`Direction du visage`),
    skin: t(`Peau`),
    haircolor: t(`Couleur des cheveux`),
    hatcolor: t(`Couleur du chapeau`),
  };
  return names[key];
}
