// The articulated figure: a little man made of a head, a body, two arms and two legs. It is an icon element that keeps, beside its shapes, the position of its joints, its face and its build
// (a stick man or a thick one): the shapes are drawn again from them each time a joint moves, so every tool that works on an icon (move, resize, turn, mirror, colour, erase, export)
// works on a figure. The joints are on a grid of 100 by 100. Pure module: no page, no application.
import type { IconElement, IconShapeData, Point } from "./elements";
import { t } from "./i18n";

export const JOINTS = [`head`, `neck`, `hip`, `elbowL`, `handL`, `elbowR`, `handR`, `kneeL`, `footL`, `kneeR`, `footR`] as const;
export type JointId = (typeof JOINTS)[number];
export type Pose = Record<JointId, Point>;

export const POSE_IDS = [`stand`, `walk`, `run`, `sit`, `armsup`, `wave`, `point`, `think`] as const;
export type PoseId = (typeof POSE_IDS)[number];

export const FACE_IDS = [`blank`, `neutral`, `happy`, `laugh`, `sad`, `cry`, `fear`, `angry`, `surprised`, `think`, `shout`, `wink`, `love`, `sleep`, `talk`] as const;
export type FaceId = (typeof FACE_IDS)[number];

export const BUILD_IDS = [`stick`, `thick`] as const;
export type BuildId = (typeof BUILD_IDS)[number];

// What an element keeps of a figure.
export interface FigureData {
  joints: Pose;
  face: FaceId;
  build: BuildId;
}

export const DEFAULT_POSE: PoseId = `stand`;
export const DEFAULT_FACE: FaceId = `happy`;
export const DEFAULT_BUILD: BuildId = `stick`;
export const MIN_FIGURE_SIZE = 40;
export const MAX_FIGURE_SIZE = 400;
export const DEFAULT_FIGURE_SIZE = 120;
export const FIGURE_VB: [number, number, number, number] = [0, 0, 100, 100];

export const isPoseId = (v: unknown): v is PoseId => typeof v === `string` && (POSE_IDS as readonly string[]).includes(v);
export const isFaceId = (v: unknown): v is FaceId => typeof v === `string` && (FACE_IDS as readonly string[]).includes(v);
export const isBuildId = (v: unknown): v is BuildId => typeof v === `string` && (BUILD_IDS as readonly string[]).includes(v);

export function cleanFigureSize(size: number): number {
  return Math.round(Math.min(MAX_FIGURE_SIZE, Math.max(MIN_FIGURE_SIZE, size)));
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const LIMIT = [-20, 120];
const clampCoord = (n: number): number => Math.min(LIMIT[1], Math.max(LIMIT[0], n));

// The lengths of the parts of the body on the grid (the head is a circle of this radius, at this distance above the neck).
const LEN = { spine: 28, head: 16, upperArm: 17, foreArm: 16, thigh: 21, shin: 20 };
const HEAD_RADIUS = { stick: 10.5, thick: 13 };

// The direction of an angle that is 0 for down, 90 for right, 180 for up and -90 for left (the page goes down).
const dir = (deg: number): Point => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
const add = (p: Point, d: Point, length: number): Point => [p[0] + d[0] * length, p[1] + d[1] * length];

interface Angles {
  spine: number;
  head: number;
  uL: number;
  lL: number;
  uR: number;
  lR: number;
  tL: number;
  sL: number;
  tR: number;
  sR: number;
}

// The angles of each pose (absolute: 0 down, 90 to the right, 180 up, the left of the figure is on the left of the page).
const ANGLES: Record<PoseId, Angles> = {
  stand: { spine: 180, head: 180, uL: -22, lL: -14, uR: 22, lR: 14, tL: -9, sL: -5, tR: 9, sR: 5 },
  walk: { spine: 178, head: 180, uL: -25, lL: -10, uR: 28, lR: 55, tL: 28, sL: 8, tR: -22, sR: -30 },
  run: { spine: 166, head: 172, uL: -50, lL: -125, uR: 55, lR: 150, tL: 60, sL: 20, tR: -35, sR: -80 },
  sit: { spine: 180, head: 180, uL: -8, lL: 35, uR: 18, lR: 62, tL: 80, sL: 2, tR: 84, sR: -2 },
  armsup: { spine: 180, head: 180, uL: -145, lL: -168, uR: 145, lR: 168, tL: -14, sL: -8, tR: 14, sR: 8 },
  wave: { spine: 180, head: 180, uL: -10, lL: -5, uR: 132, lR: 168, tL: -6, sL: -4, tR: 6, sR: 4 },
  point: { spine: 180, head: 178, uL: -10, lL: -5, uR: 92, lR: 95, tL: -8, sL: -5, tR: 8, sR: 5 },
  think: { spine: 180, head: 172, uL: 22, lL: 100, uR: 30, lR: 162, tL: -6, sL: -4, tR: 6, sR: 4 },
};

// Builds the joints of a pose from its angles, centred on the grid.
export function poseJoints(id: PoseId): Pose {
  const a = ANGLES[id];
  const hip: Point = [0, 0];
  const neck = add(hip, dir(a.spine), LEN.spine);
  const head = add(neck, dir(a.head), LEN.head);
  const elbowL = add(neck, dir(a.uL), LEN.upperArm);
  const handL = add(elbowL, dir(a.lL), LEN.foreArm);
  const elbowR = add(neck, dir(a.uR), LEN.upperArm);
  const handR = add(elbowR, dir(a.lR), LEN.foreArm);
  const kneeL = add(hip, dir(a.tL), LEN.thigh);
  const footL = add(kneeL, dir(a.sL), LEN.shin);
  const kneeR = add(hip, dir(a.tR), LEN.thigh);
  const footR = add(kneeR, dir(a.sR), LEN.shin);
  const all: Pose = { head, neck, hip, elbowL, handL, elbowR, handR, kneeL, footL, kneeR, footR };
  // The head circle counts for the extent of the figure.
  const xs = JOINTS.map((j) => all[j][0]);
  const ys = JOINTS.map((j) => all[j][1]);
  const minX = Math.min(...xs) - HEAD_RADIUS.thick;
  const maxX = Math.max(...xs) + HEAD_RADIUS.thick;
  const minY = Math.min(...ys) - HEAD_RADIUS.thick;
  const maxY = Math.max(...ys) + HEAD_RADIUS.thick;
  const dx = 50 - (minX + maxX) / 2;
  const dy = 50 - (minY + maxY) / 2;
  const out = {} as Pose;
  for (const j of JOINTS) out[j] = [r1(all[j][0] + dx), r1(all[j][1] + dy)];
  return out;
}

export function figureOf(pose: PoseId, face: FaceId, build: BuildId): FigureData {
  return { joints: poseJoints(pose), face, build };
}

// Reads a figure from a file: every joint is a point of the grid, the face and the build are known. Null for anything else.
export function readFigure(value: unknown): FigureData | null {
  if (typeof value !== `object` || value === null) return null;
  const v = value as Record<string, unknown>;
  if (!isFaceId(v.face) || !isBuildId(v.build) || typeof v.joints !== `object` || v.joints === null) return null;
  const raw = v.joints as Record<string, unknown>;
  const joints = {} as Pose;
  for (const j of JOINTS) {
    const p = raw[j];
    if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => typeof n === `number` && Number.isFinite(n) && n >= LIMIT[0] && n <= LIMIT[1])) return null;
    joints[j] = [p[0] as number, p[1] as number];
  }
  return { joints, face: v.face, build: v.build };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ moving a joint

// Puts a point at the same distance from its parent as before, in the direction of a target.
function around(parent: Point, child: Point, target: Point): Point {
  const length = Math.hypot(child[0] - parent[0], child[1] - parent[1]);
  const dx = target[0] - parent[0];
  const dy = target[1] - parent[1];
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return child;
  return [clampCoord(parent[0] + (dx / d) * length), clampCoord(parent[1] + (dy / d) * length)];
}

// Returns the figure with a joint dragged to a target (on the grid). A joint turns about its parent and keeps the length of its limb; what hangs from it follows (the hand follows the
// elbow, the whole upper body follows the neck, the legs follow the hip).
export function moveJoint(fig: FigureData, joint: JointId, target: Point): FigureData {
  const p = {} as Pose;
  for (const j of JOINTS) p[j] = [fig.joints[j][0], fig.joints[j][1]];
  const shift = (names: JointId[], from: Point, to: Point): void => {
    for (const n of names) p[n] = [clampCoord(p[n][0] + to[0] - from[0]), clampCoord(p[n][1] + to[1] - from[1])];
  };
  const turn = (parent: JointId, follow: JointId[]): void => {
    const old = p[joint];
    const next = around(p[parent], old, target);
    p[joint] = next;
    shift(follow, old, next);
  };
  switch (joint) {
    case `head`:
      turn(`neck`, []);
      break;
    case `handL`:
      turn(`elbowL`, []);
      break;
    case `handR`:
      turn(`elbowR`, []);
      break;
    case `footL`:
      turn(`kneeL`, []);
      break;
    case `footR`:
      turn(`kneeR`, []);
      break;
    case `elbowL`:
      turn(`neck`, [`handL`]);
      break;
    case `elbowR`:
      turn(`neck`, [`handR`]);
      break;
    case `kneeL`:
      turn(`hip`, [`footL`]);
      break;
    case `kneeR`:
      turn(`hip`, [`footR`]);
      break;
    case `neck`:
      turn(`hip`, [`head`, `elbowL`, `handL`, `elbowR`, `handR`]);
      break;
    case `hip`:
      turn(`neck`, [`kneeL`, `footL`, `kneeR`, `footR`]);
      break;
  }
  return { ...fig, joints: p };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ the shapes

const line = (d: string): IconShapeData => ({ d, fill: false, stroke: true, closed: false });
const loop = (d: string): IconShapeData => ({ d, fill: false, stroke: true, closed: true });
const dotShape = (d: string): IconShapeData => ({ d, fill: true, stroke: false, closed: true });

const f = (n: number): string => String(r1(n));
const pt = (p: Point): string => `${f(p[0])},${f(p[1])}`;

// The data of a circle as two arcs.
function circlePath(c: Point, r: number): string {
  return `M${f(c[0] + r)},${f(c[1])}A${f(r)},${f(r)} 0 1,1 ${f(c[0] - r)},${f(c[1])}A${f(r)},${f(r)} 0 1,1 ${f(c[0] + r)},${f(c[1])}Z`;
}

// A limb as a closed capsule around the segment between two points, for the thick build.
function capsule(a: Point, b: Point, r: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  const n: Point = [-dy / d, dx / d];
  const p1: Point = [a[0] + n[0] * r, a[1] + n[1] * r];
  const p2: Point = [b[0] + n[0] * r, b[1] + n[1] * r];
  const p3: Point = [b[0] - n[0] * r, b[1] - n[1] * r];
  const p4: Point = [a[0] - n[0] * r, a[1] - n[1] * r];
  return `M${pt(p1)}L${pt(p2)}A${f(r)},${f(r)} 0 0,0 ${pt(p3)}L${pt(p4)}A${f(r)},${f(r)} 0 0,0 ${pt(p1)}Z`;
}

// The face, drawn in the frame of the head: its centre, its radius and the turn of the head. Every feature is given on a grid where the head is a circle of radius 1.
function faceShapes(face: FaceId, centre: Point, radius: number, turn: number): IconShapeData[] {
  if (face === `blank`) return [];
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const T = (x: number, y: number): Point => [centre[0] + radius * (x * cos - y * sin), centre[1] + radius * (x * sin + y * cos)];
  const P = (x: number, y: number): string => pt(T(x, y));
  const seg = (x1: number, y1: number, x2: number, y2: number): IconShapeData => line(`M${P(x1, y1)}L${P(x2, y2)}`);
  const quad = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): IconShapeData => line(`M${P(x1, y1)}Q${P(cx, cy)} ${P(x2, y2)}`);
  const dot = (x: number, y: number, r = 0.1): IconShapeData => dotShape(circlePath(T(x, y), radius * r));
  const ring = (x: number, y: number, r: number): IconShapeData => loop(circlePath(T(x, y), radius * r));
  const oval = (x: number, y: number, rx: number, ry: number): IconShapeData => loop(`M${P(x + rx, y)}Q${P(x + rx, y + ry * 1.6)} ${P(x, y + ry)}Q${P(x - rx, y + ry * 1.6)} ${P(x - rx, y)}Q${P(x - rx, y - ry * 1.6)} ${P(x, y - ry)}Q${P(x + rx, y - ry * 1.6)} ${P(x + rx, y)}Z`);
  const heart = (x: number, y: number, s: number): IconShapeData => dotShape(`M${P(x, y + 0.7 * s)}C${P(x - 1.1 * s, y)} ${P(x - 0.9 * s, y - 0.8 * s)} ${P(x, y - 0.4 * s)}C${P(x + 0.9 * s, y - 0.8 * s)} ${P(x + 1.1 * s, y)} ${P(x, y + 0.7 * s)}Z`);
  const eyes = (): IconShapeData[] => [dot(-0.38, -0.12), dot(0.38, -0.12)];
  const smile = (): IconShapeData => quad(-0.42, 0.3, 0, 0.8, 0.42, 0.3);
  const frown = (): IconShapeData => quad(-0.38, 0.65, 0, 0.2, 0.38, 0.65);
  const closedUp = (x: number): IconShapeData => quad(x - 0.2, -0.05, x, -0.4, x + 0.2, -0.05);
  const closedDown = (x: number): IconShapeData => quad(x - 0.2, -0.2, x, 0.05, x + 0.2, -0.2);
  switch (face) {
    case `neutral`:
      return [...eyes(), seg(-0.32, 0.45, 0.32, 0.45)];
    case `happy`:
      return [...eyes(), smile()];
    case `laugh`:
      return [closedUp(-0.38), closedUp(0.38), loop(`M${P(-0.5, 0.2)}L${P(0.5, 0.2)}Q${P(0.45, 0.85)} ${P(0, 0.85)}Q${P(-0.45, 0.85)} ${P(-0.5, 0.2)}Z`)];
    case `sad`:
      return [...eyes(), seg(-0.62, -0.5, -0.2, -0.36), seg(0.62, -0.5, 0.2, -0.36), frown()];
    case `cry`:
      return [...eyes(), seg(-0.62, -0.5, -0.2, -0.36), seg(0.62, -0.5, 0.2, -0.36), quad(-0.38, 0.02, -0.5, 0.35, -0.42, 0.62), quad(0.38, 0.02, 0.5, 0.35, 0.42, 0.62), frown()];
    case `fear`:
      return [ring(-0.38, -0.1, 0.2), ring(0.38, -0.1, 0.2), dot(-0.38, -0.1, 0.06), dot(0.38, -0.1, 0.06), quad(-0.62, -0.55, -0.4, -0.72, -0.18, -0.55), quad(0.18, -0.55, 0.4, -0.72, 0.62, -0.55), oval(0, 0.55, 0.2, 0.14), loop(`M${P(1.05, -0.5)}Q${P(1.3, -0.2)} ${P(1.05, -0.1)}Q${P(0.8, -0.2)} ${P(1.05, -0.5)}Z`)];
    case `angry`:
      return [...eyes(), seg(-0.65, -0.55, -0.15, -0.3), seg(0.65, -0.55, 0.15, -0.3), quad(-0.35, 0.6, 0, 0.35, 0.35, 0.6)];
    case `surprised`:
      return [dot(-0.38, -0.12, 0.13), dot(0.38, -0.12, 0.13), quad(-0.62, -0.55, -0.4, -0.75, -0.18, -0.55), quad(0.18, -0.55, 0.4, -0.75, 0.62, -0.55), ring(0, 0.5, 0.17)];
    case `think`:
      return [dot(-0.28, -0.22), dot(0.48, -0.22), seg(-0.65, -0.5, -0.15, -0.5), quad(0.2, -0.55, 0.5, -0.8, 0.8, -0.55), seg(-0.2, 0.5, 0.3, 0.4), ring(1.05, -0.95, 0.1), ring(1.35, -1.25, 0.16)];
    case `shout`:
      return [dot(-0.38, -0.15), dot(0.38, -0.15), seg(-0.65, -0.55, -0.15, -0.35), seg(0.65, -0.55, 0.15, -0.35), oval(0, 0.5, 0.42, 0.3)];
    case `wink`:
      return [dot(-0.38, -0.12), closedUp(0.38), smile()];
    case `love`:
      return [heart(-0.4, -0.12, 0.28), heart(0.4, -0.12, 0.28), smile()];
    case `sleep`:
      return [closedDown(-0.38), closedDown(0.38), ring(0, 0.5, 0.1), line(`M${P(1, -0.95)}L${P(1.4, -0.95)}L${P(1, -0.5)}L${P(1.4, -0.5)}`)];
    case `talk`:
      return [...eyes(), seg(-0.6, -0.5, -0.2, -0.5), quad(0.2, -0.55, 0.4, -0.7, 0.6, -0.55), oval(0, 0.5, 0.25, 0.2)];
    default:
      return [];
  }
}

// Returns the shapes of a figure: its head and its face, then its body (lines for a stick figure, closed capsules for a thick one).
export function figureShapes(fig: FigureData): IconShapeData[] {
  const j = fig.joints;
  const out: IconShapeData[] = [];
  const thick = fig.build === `thick`;
  const radius = thick ? HEAD_RADIUS.thick : HEAD_RADIUS.stick;
  // The turn of the head: how far the line from the neck to the head leans from the vertical.
  const turn = Math.atan2(j.head[0] - j.neck[0], -(j.head[1] - j.neck[1]));
  out.push(loop(circlePath(j.head, radius)));
  out.push(...faceShapes(fig.face, j.head, radius, turn));
  if (thick) {
    // The limbs start inside the body, a little way along their first segment, so that their outlines do not cross it.
    const from = (a: Point, b: Point, d: number): Point => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [a[0] + ((b[0] - a[0]) / l) * d, a[1] + ((b[1] - a[1]) / l) * d];
    };
    out.push(loop(capsule(from(j.neck, j.hip, 3), from(j.hip, j.neck, 3), 10)));
    out.push(loop(capsule(from(j.neck, j.elbowL, 7), j.elbowL, 4.8)), loop(capsule(j.elbowL, j.handL, 4.4)));
    out.push(loop(capsule(from(j.neck, j.elbowR, 7), j.elbowR, 4.8)), loop(capsule(j.elbowR, j.handR, 4.4)));
    out.push(loop(capsule(from(j.hip, j.kneeL, 7), j.kneeL, 5.8)), loop(capsule(j.kneeL, j.footL, 5.2)));
    out.push(loop(capsule(from(j.hip, j.kneeR, 7), j.kneeR, 5.8)), loop(capsule(j.kneeR, j.footR, 5.2)));
    return out;
  }
  // The neck goes from the neck joint to the edge of the head.
  const d = Math.hypot(j.head[0] - j.neck[0], j.head[1] - j.neck[1]) || 1;
  const edge: Point = [j.head[0] - ((j.head[0] - j.neck[0]) / d) * radius, j.head[1] - ((j.head[1] - j.neck[1]) / d) * radius];
  out.push(line(`M${pt(j.hip)}L${pt(j.neck)}L${pt(edge)}`));
  out.push(line(`M${pt(j.neck)}L${pt(j.elbowL)}L${pt(j.handL)}`));
  out.push(line(`M${pt(j.neck)}L${pt(j.elbowR)}L${pt(j.handR)}`));
  out.push(line(`M${pt(j.hip)}L${pt(j.kneeL)}L${pt(j.footL)}`));
  out.push(line(`M${pt(j.hip)}L${pt(j.kneeR)}L${pt(j.footR)}`));
  return out;
}

// Builds the element that a click with the Figure tool puts: an icon, centred on the click, that keeps its figure.
export function figureElement(pose: PoseId, face: FaceId, build: BuildId, center: Point, size: number, look: { stroke: string; strokeWidth: number; roughness: number; seed: number }, elementId: string): IconElement {
  const side = cleanFigureSize(size);
  const figure = figureOf(pose, face, build);
  return {
    id: elementId,
    type: `icon`,
    x: r1(center[0] - side / 2),
    y: r1(center[1] - side / 2),
    width: side,
    height: side,
    name: figureName(pose),
    vb: [...FIGURE_VB],
    shapes: figureShapes(figure),
    figure,
    stroke: look.stroke,
    strokeWidth: Math.max(1, Math.min(look.strokeWidth, side / 45)),
    roughness: look.roughness,
    seed: look.seed,
  };
}

// Returns the element with its figure changed, and its shapes drawn again.
export function withFigure(el: IconElement, figure: FigureData): IconElement {
  return { ...el, figure, shapes: figureShapes(figure), vb: [...FIGURE_VB] };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ names

export function figureName(id: PoseId): string {
  const names: Record<PoseId, string> = {
    stand: t(`Bonhomme debout`),
    walk: t(`Bonhomme qui marche`),
    run: t(`Bonhomme qui court`),
    sit: t(`Bonhomme assis`),
    armsup: t(`Bonhomme bras levés`),
    wave: t(`Bonhomme qui salue`),
    point: t(`Bonhomme qui montre du doigt`),
    think: t(`Bonhomme qui réfléchit`),
  };
  return names[id];
}

export function faceName(id: FaceId): string {
  const names: Record<FaceId, string> = {
    blank: t(`Sans visage`),
    neutral: t(`Neutre`),
    happy: t(`Content`),
    laugh: t(`Rigole`),
    sad: t(`Triste`),
    cry: t(`Pleure`),
    fear: t(`Peur`),
    angry: t(`En colère`),
    surprised: t(`Surpris`),
    think: t(`Pense`),
    shout: t(`Crie`),
    wink: t(`Clin d'œil`),
    love: t(`Amoureux`),
    sleep: t(`Dort`),
    talk: t(`Explique`),
  };
  return names[id];
}

export function buildName(id: BuildId): string {
  return id === `stick` ? t(`Bonhomme en bâtons`) : t(`Corps épais`);
}

// The shapes of the pictogram of a pose (a stick figure with no face) and of a face (a head alone), on a grid of 100 by 100.
export function poseIconShapes(id: PoseId): IconShapeData[] {
  return figureShapes(figureOf(id, `blank`, `stick`));
}

export function faceIconShapes(id: FaceId): IconShapeData[] {
  return [loop(circlePath([50, 50], 40)), ...faceShapes(id, [50, 50], 40, 0)];
}

export function buildIconShapes(id: BuildId): IconShapeData[] {
  return figureShapes(figureOf(`stand`, `blank`, id));
}
