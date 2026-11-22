// The objects that a figure holds in a hand (thirty), and the clothes that it can wear. An object is drawn in its own frame (the hand at the origin, units of the figure, up is positive),
// then put on the hand: upright for what is held vertically, along the forearm for what is held out, hanging for what is carried. Pure module: no page, no application.
import type { IconShapeData, Point } from "./elements";
import { t } from "./i18n";

export const ITEM_IDS = [
  `none`,
  `umbrellaClosed`,
  `umbrellaOpen`,
  `cane`,
  `hat`,
  `pistol`,
  `rifle`,
  `bazooka`,
  `sword`,
  `knife`,
  `microphone`,
  `book`,
  `briefcase`,
  `suitcase`,
  `backpack`,
  `pickaxe`,
  `shovel`,
  `flag`,
  `gamepad`,
  `wheel`,
  `hammer`,
  `flashlight`,
  `balloon`,
  `flowers`,
  `magnifier`,
  `phone`,
  `mug`,
  `iceCream`,
  `wand`,
  `trophy`,
  `baguette`,
] as const;
export type ItemId = (typeof ITEM_IDS)[number];
export const isItemId = (v: unknown): v is ItemId => typeof v === `string` && (ITEM_IDS as readonly string[]).includes(v);

export const TOP_IDS = [`none`, `cape`, `tailcoat`, `tie`, `bowtie`, `scarf`] as const;
export type TopId = (typeof TOP_IDS)[number];
export const isTopId = (v: unknown): v is TopId => typeof v === `string` && (TOP_IDS as readonly string[]).includes(v);

export const BOTTOM_IDS = [`none`, `rainboots`, `skirt`] as const;
export type BottomId = (typeof BOTTOM_IDS)[number];
export const isBottomId = (v: unknown): v is BottomId => typeof v === `string` && (BOTTOM_IDS as readonly string[]).includes(v);

const r1 = (n: number): number => Math.round(n * 10) / 10;
const pt = (p: Point): string => `${r1(p[0])},${r1(p[1])}`;

type V = [number, number];

// A pen that draws in the frame of an object: it writes the data of the paths in page units.
class Sketch {
  readonly shapes: IconShapeData[] = [];

  constructor(
    private map: (x: number, y: number) => Point,
    private u: number,
  ) {}

  private p(v: V): string {
    return pt(this.map(v[0], v[1]));
  }

  line(...pts: V[]): void {
    this.shapes.push({ d: `M${pts.map((v) => this.p(v)).join(`L`)}`, fill: false, stroke: true, closed: false });
  }

  loop(...pts: V[]): void {
    this.shapes.push({ d: `M${pts.map((v) => this.p(v)).join(`L`)}Z`, fill: false, stroke: true, closed: true });
  }

  // A curve with one control point.
  quad(a: V, c: V, b: V): void {
    this.shapes.push({ d: `M${this.p(a)}Q${this.p(c)} ${this.p(b)}`, fill: false, stroke: true, closed: false });
  }

  // A closed shape made of a first point and curves (each a control point and an end point).
  blob(start: V, ...curves: [V, V][]): void {
    this.shapes.push({ d: `M${this.p(start)}${curves.map(([c, e]) => `Q${this.p(c)} ${this.p(e)}`).join(``)}Z`, fill: false, stroke: true, closed: true });
  }

  circle(cx: number, cy: number, r: number): void {
    const c = this.map(cx, cy);
    const rr = r * this.u;
    this.shapes.push({ d: `M${r1(c[0] + rr)},${r1(c[1])}A${r1(rr)},${r1(rr)} 0 1,1 ${r1(c[0] - rr)},${r1(c[1])}A${r1(rr)},${r1(rr)} 0 1,1 ${r1(c[0] + rr)},${r1(c[1])}Z`, fill: false, stroke: true, closed: true });
  }
}

interface ItemDef {
  // How the object is put on the hand: `world` (upright, up is up on the page), `forward` (along the forearm, away from the elbow), `back` (worn on the back, no hand).
  mode: `world` | `forward` | `back`;
  draw: (s: Sketch) => void;
}

const star = (cx: number, cy: number, r: number): V[] => {
  const out: V[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return out;
};

const ITEMS: Record<Exclude<ItemId, `none`>, ItemDef> = {
  umbrellaClosed: {
    mode: `world`,
    draw: (s) => {
      s.line([0, -8], [0, 30]);
      s.quad([0, -8], [0, -13], [4, -12]);
      s.loop([0, 38], [-2.6, 26], [-3.4, 14], [0, 10], [3.4, 14], [2.6, 26]);
    },
  },
  umbrellaOpen: {
    mode: `world`,
    draw: (s) => {
      s.line([0, -8], [0, 30]);
      s.quad([0, -8], [0, -13], [4, -12]);
      s.blob([-26, 18], [[0, 54], [26, 18]], [[17, 12], [9, 18]], [[0, 12], [-9, 18]], [[-17, 12], [-26, 18]]);
      s.line([0, 36], [0, 18]);
    },
  },
  cane: {
    mode: `world`,
    draw: (s) => {
      s.line([0, -32], [0, 24]);
      s.quad([0, 24], [0, 33], [8, 31]);
      s.quad([8, 31], [13, 29], [12, 22]);
    },
  },
  hat: {
    mode: `world`,
    draw: (s) => {
      s.blob([-9, 4], [[-10, 20], [0, 20]], [[10, 20], [9, 4]]);
      s.blob([-16, 4], [[0, 9], [16, 4]], [[0, -1], [-16, 4]]);
      s.line([-9, 8], [9, 8]);
    },
  },
  pistol: {
    mode: `forward`,
    draw: (s) => {
      s.loop([-4, -8], [1, -8], [3, -1], [19, -1], [19, 5], [-2, 5]);
      s.quad([3, -1], [6, -5], [9, -1]);
    },
  },
  rifle: {
    mode: `forward`,
    draw: (s) => {
      s.loop([-16, -4], [4, -3], [36, -1], [36, 2], [4, 3], [-12, 6], [-17, 1]);
      s.line([4, -3], [4, -8], [10, -3]);
      s.line([14, 3], [14, 8]);
    },
  },
  bazooka: {
    mode: `forward`,
    draw: (s) => {
      s.loop([-16, -4], [28, -4], [28, 5], [-16, 5]);
      s.loop([28, -7], [34, -7], [34, 8], [28, 8]);
      s.line([2, 5], [2, 13]);
      s.line([-16, 0], [-22, -3], [-22, 4], [-16, 1]);
    },
  },
  sword: {
    mode: `world`,
    draw: (s) => {
      s.loop([-2, 5], [2, 5], [2, 40], [0, 46], [-2, 40]);
      s.line([-9, 5], [9, 5]);
      s.line([0, 5], [0, -9]);
      s.circle(0, -11, 2.2);
    },
  },
  knife: {
    mode: `forward`,
    draw: (s) => {
      s.loop([-10, -2], [0, -2], [0, 2], [-10, 2]);
      s.loop([0, -3.5], [14, -3.5], [21, 0], [14, 2.5], [0, 2.5]);
    },
  },
  microphone: {
    mode: `world`,
    draw: (s) => {
      s.circle(0, 10, 5);
      s.line([-4.5, 10], [4.5, 10]);
      s.loop([-2, 5], [2, 5], [1.3, -14], [-1.3, -14]);
    },
  },
  book: {
    mode: `world`,
    draw: (s) => {
      s.loop([-16, 2], [0, 0], [0, 16], [-16, 18]);
      s.loop([16, 2], [0, 0], [0, 16], [16, 18]);
      s.line([-12, 8], [-4, 7]);
      s.line([-12, 12], [-4, 11]);
      s.line([12, 8], [4, 7]);
      s.line([12, 12], [4, 11]);
    },
  },
  briefcase: {
    mode: `world`,
    draw: (s) => {
      s.quad([-5, -9], [0, -2], [5, -9]);
      s.loop([-14, -9], [14, -9], [14, -29], [-14, -29]);
      s.line([-14, -19], [14, -19]);
      s.circle(0, -19, 1.8);
    },
  },
  suitcase: {
    mode: `world`,
    draw: (s) => {
      s.quad([-5, -9], [0, -2], [5, -9]);
      s.loop([-11, -9], [11, -9], [11, -39], [-11, -39]);
      s.line([-5, -9], [-5, -39]);
      s.line([5, -9], [5, -39]);
      s.circle(-7, -41.5, 2);
      s.circle(7, -41.5, 2);
    },
  },
  backpack: {
    mode: `back`,
    draw: () => undefined,
  },
  pickaxe: {
    mode: `world`,
    draw: (s) => {
      s.line([0, -16], [0, 30]);
      s.quad([-24, 22], [0, 40], [24, 22]);
      s.line([-24, 22], [-26, 18]);
      s.line([24, 22], [26, 18]);
    },
  },
  shovel: {
    mode: `world`,
    draw: (s) => {
      s.line([0, -16], [0, 28]);
      s.line([-5, -16], [5, -16]);
      s.loop([-7, 28], [7, 28], [8, 42], [0, 49], [-8, 42]);
    },
  },
  flag: {
    mode: `world`,
    draw: (s) => {
      s.line([0, -16], [0, 46]);
      s.circle(0, 47.5, 1.6);
      s.blob([0, 44], [[8, 48], [16, 44]], [[24, 40], [30, 44]], [[30, 36], [30, 30]], [[24, 34], [16, 30]], [[8, 26], [0, 30]]);
    },
  },
  gamepad: {
    mode: `world`,
    draw: (s) => {
      s.loop([-14, 4], [14, 4], [19, 10], [14, 16], [7, 16], [0, 12], [-7, 16], [-14, 16], [-19, 10]);
      s.line([-11, 10], [-6, 10]);
      s.line([-8.5, 7.5], [-8.5, 12.5]);
      s.circle(8, 8.5, 1.3);
      s.circle(12, 11.5, 1.3);
    },
  },
  wheel: {
    mode: `world`,
    draw: (s) => {
      s.circle(0, 14, 14);
      s.circle(0, 14, 3.5);
      s.line([0, 17.5], [0, 28]);
      s.line([-3, 12.5], [-13, 9]);
      s.line([3, 12.5], [13, 9]);
    },
  },
  hammer: {
    mode: `world`,
    draw: (s) => {
      s.line([0, -14], [0, 28]);
      s.loop([-11, 28], [11, 28], [11, 37], [-11, 37]);
    },
  },
  flashlight: {
    mode: `forward`,
    draw: (s) => {
      s.loop([-8, -3.5], [10, -3.5], [10, 3.5], [-8, 3.5]);
      s.loop([10, -5.5], [17, -8], [17, 8], [10, 5.5]);
      s.line([21, 0], [34, 0]);
      s.line([21, -5], [33, -10]);
      s.line([21, 5], [33, 10]);
    },
  },
  balloon: {
    mode: `world`,
    draw: (s) => {
      s.quad([0, 2], [4, 10], [0, 18]);
      s.quad([0, 18], [-4, 24], [0, 30]);
      s.blob([0, 32], [[-14, 34], [-10, 46]], [[-6, 58], [0, 58]], [[6, 58], [10, 46]], [[14, 34], [0, 32]]);
      s.loop([0, 32], [-2.5, 29], [2.5, 29]);
    },
  },
  flowers: {
    mode: `world`,
    draw: (s) => {
      s.line([0, 0], [-8, 22]);
      s.line([0, 0], [0, 27]);
      s.line([0, 0], [8, 22]);
      s.circle(-8, 25, 3.5);
      s.circle(0, 30, 3.5);
      s.circle(8, 25, 3.5);
      s.circle(-8, 25, 1);
      s.circle(0, 30, 1);
      s.circle(8, 25, 1);
    },
  },
  magnifier: {
    mode: `forward`,
    draw: (s) => {
      s.line([-8, 0], [6, 0]);
      s.circle(14, 0, 8);
    },
  },
  phone: {
    mode: `world`,
    draw: (s) => {
      s.loop([-5, 0], [5, 0], [5, 17], [-5, 17]);
      s.line([-3.5, 3.5], [3.5, 3.5]);
      s.line([-3.5, 14], [3.5, 14]);
      s.circle(0, 1.7, 0.6);
    },
  },
  mug: {
    mode: `world`,
    draw: (s) => {
      s.loop([-7, 0], [7, 0], [6, 13], [-6, 13]);
      s.quad([7, 10], [14, 9], [6.8, 3]);
      s.quad([-2, 16], [0, 19], [-2, 22]);
      s.quad([2, 16], [4, 19], [2, 22]);
    },
  },
  iceCream: {
    mode: `world`,
    draw: (s) => {
      s.loop([-5, 14], [5, 14], [0, 0]);
      s.circle(0, 19, 6.5);
      s.circle(0, 28, 4.5);
    },
  },
  wand: {
    mode: `forward`,
    draw: (s) => {
      s.line([-8, 0], [26, 0]);
      s.loop(...star(31, 0, 6));
    },
  },
  trophy: {
    mode: `world`,
    draw: (s) => {
      s.loop([-8, 22], [8, 22], [6, 11], [0, 8], [-6, 11]);
      s.line([0, 8], [0, 3]);
      s.loop([-6, 3], [6, 3], [6, 0], [-6, 0]);
      s.quad([-8, 21], [-16, 20], [-6, 12]);
      s.quad([8, 21], [16, 20], [6, 12]);
    },
  },
  baguette: {
    mode: `forward`,
    draw: (s) => {
      s.blob([-8, 0], [[-8, 4], [-2, 4]], [[14, 4], [30, 3]], [[34, 0], [30, -3]], [[14, -4], [-2, -4]], [[-8, -4], [-8, 0]]);
      for (const x of [2, 10, 18, 26]) s.line([x - 1.5, 3.2], [x + 1.5, -3.2]);
    },
  },
};

// Draws an object in the frame it is put in.
function draw(id: Exclude<ItemId, `none`>, map: (x: number, y: number) => Point, u: number): IconShapeData[] {
  const s = new Sketch(map, u);
  ITEMS[id].draw(s);
  return s.shapes;
}

export function itemMode(id: ItemId): `world` | `forward` | `back` | null {
  return id === `none` ? null : ITEMS[id].mode;
}

// Returns the shapes of an object held by a hand. `hand` is the hand, `dir` the unit vector from the elbow to the hand, `u` the scale of the figure, `left` whether it is the hand on the
// left of the page (an object held upright is mirrored there so that it points outward).
export function itemShapes(id: ItemId, hand: Point, dir: Point, u: number, left: boolean): IconShapeData[] {
  if (id === `none`) return [];
  const mode = ITEMS[id].mode;
  if (mode === `back`) return [];
  if (mode === `forward`) {
    // An arm that hangs down would point the object at the ground: it is then held out to the side, a little downward.
    if (dir[1] > 0.5) {
      const out = left ? -1 : 1;
      const k = Math.hypot(out, 0.25);
      dir = [out / k, 0.25 / k];
    }
    // The up side of the object is the one that points up on the page.
    let n: Point = [dir[1], -dir[0]];
    if (n[1] > 0) n = [-n[0], -n[1]];
    return draw(id, (x, y) => [hand[0] + dir[0] * x * u + n[0] * y * u, hand[1] + dir[1] * x * u + n[1] * y * u], u);
  }
  const m = left ? -1 : 1;
  return draw(id, (x, y) => [hand[0] + m * x * u, hand[1] - y * u], u);
}

// Returns the shapes of a backpack, behind the body: a bag along the back, with its straps, on the side away from where the figure looks.
export function backpackShapes(neck: Point, hip: Point, u: number, side: number): IconShapeData[] {
  const sx = hip[0] - neck[0];
  const sy = hip[1] - neck[1];
  const len = Math.hypot(sx, sy) || 1;
  const s: Point = [sx / len, sy / len];
  const p: Point = [-s[1], s[0]];
  const at = (a: number, b: number): Point => [neck[0] + s[0] * a * len + p[0] * b * u * side, neck[1] + s[1] * a * len + p[1] * b * u * side];
  const out: IconShapeData[] = [];
  const poly = (pts: Point[], closed: boolean): void => {
    out.push({ d: `M${pts.map(pt).join(`L`)}${closed ? `Z` : ``}`, fill: false, stroke: true, closed });
  };
  poly([at(0.05, 4), at(0.05, 15), at(0.9, 15), at(0.9, 4)], true);
  poly([at(0.28, 4), at(0.28, 15)], false);
  poly([at(0.05, 8), at(-0.04, 5), at(-0.04, -5), at(0.08, -7)], false);
  return out;
}

// The shapes of the pictogram of an object: drawn upright (or pointing right) and fitted in a square of 100.
export function itemIconShapes(id: ItemId): IconShapeData[] {
  if (id === `none`) return [{ d: `M20,20L80,80M80,20L20,80`, fill: false, stroke: true, closed: false }];
  if (id === `backpack`) return backpackShapes([50, 14], [50, 78], 1.2, 1);
  const first = draw(id, (x, y) => [x, -y], 1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const sh of first) for (const m of sh.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
    xs.push(Number(m[1]));
    ys.push(Number(m[2]));
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const k = Math.min(76 / Math.max(1, maxX - minX), 76 / Math.max(1, maxY - minY));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // The same drawing, scaled and moved (the circles keep their radius through the scale u).
  return draw(id, (x, y) => [50 + (x - cx) * k, 50 + (-y - cy) * k], k);
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ clothes

export interface Body {
  head: Point;
  neck: Point;
  hip: Point;
  kneeL: Point;
  footL: Point;
  kneeR: Point;
  footR: Point;
}

const poly = (pts: Point[], closed: boolean): IconShapeData => ({ d: `M${pts.map(pt).join(`L`)}${closed ? `Z` : ``}`, fill: false, stroke: true, closed });

function basis(b: Body): { s: Point; p: Point; len: number } {
  const dx = b.hip[0] - b.neck[0];
  const dy = b.hip[1] - b.neck[1];
  const len = Math.hypot(dx, dy) || 1;
  const s: Point = [dx / len, dy / len];
  return { s, p: [-s[1], s[0]], len };
}

// What is worn behind the body (drawn first): the cape.
export function clothesBehind(top: TopId, b: Body, u: number): IconShapeData[] {
  if (top !== `cape`) return [];
  const { s, p, len } = basis(b);
  const at = (a: number, c: number): Point => [b.neck[0] + s[0] * a * len + p[0] * c * u, b.neck[1] + s[1] * a * len + p[1] * c * u];
  const wave = (a: number, c: number, w: number): string => `Q${pt(at(a + 0.05, c - w))} ${pt(at(a, c))}`;
  return [
    {
      d: `M${pt(at(0, -6))}L${pt(at(0, 6))}L${pt(at(0.55, 20))}L${pt(at(1.35, 24))}${wave(1.4, 12, 4)}${wave(1.35, 0, -4)}${wave(1.4, -12, 4)}L${pt(at(1.35, -24))}L${pt(at(0.55, -20))}Z`,
      fill: false,
      stroke: true,
      closed: true,
    },
  ];
}

// What is worn on the torso and over it (drawn after the body): the tail coat, the tie, the bow tie, the scarf.
export function clothesOver(top: TopId, b: Body, u: number): IconShapeData[] {
  if (top === `none` || top === `cape`) return [];
  const { s, p, len } = basis(b);
  const at = (a: number, c: number): Point => [b.neck[0] + s[0] * a * len + p[0] * c * u, b.neck[1] + s[1] * a * len + p[1] * c * u];
  switch (top) {
    case `tailcoat`:
      return [
        poly([at(0.02, -9), at(0.02, 9), at(1, 10), at(1.62, 12), at(1.12, 2.5), at(1.12, -2.5), at(1.62, -12), at(1, -10)], true),
        poly([at(0.02, -3), at(0.5, 0), at(0.02, 3)], false),
        poly([at(0.02, -9), at(0.42, -2.5), at(0.6, 0)], false),
        poly([at(0.02, 9), at(0.42, 2.5), at(0.6, 0)], false),
        poly([at(0.7, 0), at(1, 0)], false),
      ];
    case `tie`:
      return [poly([at(0.04, -2), at(0.04, 2), at(0.12, 1.6), at(0.12, -1.6)], true), poly([at(0.12, -1.6), at(0.12, 1.6), at(0.55, 3), at(0.66, 0), at(0.55, -3)], true)];
    case `bowtie`:
      return [poly([at(0.05, 0), at(-0.01, 7), at(0.11, 7)], true), poly([at(0.05, 0), at(-0.01, -7), at(0.11, -7)], true), poly([at(0.02, -1.5), at(0.02, 1.5), at(0.08, 1.5), at(0.08, -1.5)], true)];
    case `scarf`:
      return [poly([at(-0.03, -8), at(-0.03, 8), at(0.1, 8), at(0.1, -8)], true), poly([at(0.1, 3), at(0.1, 8), at(0.5, 9), at(0.5, 4)], true)];
    default:
      return [];
  }
}

// The clothes of the legs: the rain boots (a boot on each foot, the toe turned to `front`) and the skirt (from the hip, over the thighs).
export function clothesBottom(bottom: BottomId, b: Body, u: number, front: number): IconShapeData[] {
  if (bottom === `none`) return [];
  if (bottom === `skirt`) {
    const { s, p, len } = basis(b);
    const at = (a: number, c: number): Point => [b.hip[0] + s[0] * a * len + p[0] * c * u, b.hip[1] + s[1] * a * len + p[1] * c * u];
    return [poly([at(-0.04, -7), at(-0.04, 7), at(0.42, 14), at(0.78, 18), at(0.72, 10), at(0.78, 2), at(0.72, -4), at(0.78, -10), at(0.78, -18), at(0.42, -14)], true)];
  }
  const boot = (knee: Point, foot: Point, toe: number): IconShapeData => {
    const dx = foot[0] - knee[0];
    const dy = foot[1] - knee[1];
    const l = Math.hypot(dx, dy) || 1;
    const a: Point = [dx / l, dy / l];
    const f: Point = [toe, 0];
    const top: Point = [foot[0] - a[0] * 11 * u, foot[1] - a[1] * 11 * u];
    return poly(
      [
        [top[0] - f[0] * 4.2 * u, top[1] - f[1] * 4.2 * u],
        [top[0] + f[0] * 4.2 * u, top[1] + f[1] * 4.2 * u],
        [foot[0] + f[0] * 4.8 * u, foot[1] + f[1] * 4.8 * u],
        [foot[0] + f[0] * 10 * u + a[0] * 1.5 * u, foot[1] + f[1] * 10 * u + a[1] * 1.5 * u],
        [foot[0] - f[0] * 4.8 * u + a[0] * 1.5 * u, foot[1] - f[1] * 4.8 * u + a[1] * 1.5 * u],
      ],
      true,
    );
  };
  // Seen from the front, the toes point outward.
  return [boot(b.kneeL, b.footL, front === 0 ? -1 : front), boot(b.kneeR, b.footR, front === 0 ? 1 : front)];
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ names

export function itemName(id: ItemId): string {
  const names: Record<ItemId, string> = {
    none: t(`Rien dans la main`),
    umbrellaClosed: t(`Parapluie fermé`),
    umbrellaOpen: t(`Parapluie ouvert`),
    cane: t(`Canne`),
    hat: t(`Chapeau à la main`),
    pistol: t(`Pistolet`),
    rifle: t(`Carabine`),
    bazooka: t(`Lance-roquettes`),
    sword: t(`Épée`),
    knife: t(`Couteau`),
    microphone: t(`Micro`),
    book: t(`Livre ouvert`),
    briefcase: t(`Mallette`),
    suitcase: t(`Valise`),
    backpack: t(`Sac à dos`),
    pickaxe: t(`Pioche`),
    shovel: t(`Pelle`),
    flag: t(`Drapeau`),
    gamepad: t(`Manette de jeu`),
    wheel: t(`Volant`),
    hammer: t(`Marteau`),
    flashlight: t(`Lampe de poche`),
    balloon: t(`Ballon`),
    flowers: t(`Bouquet de fleurs`),
    magnifier: t(`Loupe`),
    phone: t(`Téléphone`),
    mug: t(`Tasse`),
    iceCream: t(`Glace`),
    wand: t(`Baguette magique`),
    trophy: t(`Trophée`),
    baguette: t(`Baguette de pain`),
  };
  return names[id];
}

export function topName(id: TopId): string {
  const names: Record<TopId, string> = { none: t(`Sans habit du haut`), cape: t(`Cape`), tailcoat: t(`Queue de pie`), tie: t(`Cravate`), bowtie: t(`Nœud papillon`), scarf: t(`Écharpe`) };
  return names[id];
}

export function bottomName(id: BottomId): string {
  const names: Record<BottomId, string> = { none: t(`Sans habit du bas`), rainboots: t(`Bottes de pluie`), skirt: t(`Jupe`) };
  return names[id];
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ pictograms of the clothes

// A little stick figure on which a piece of clothing is drawn, on the grid of 100 by 100.
const SAMPLE: Body = { head: [50, 20], neck: [50, 34], hip: [50, 62], kneeL: [42, 80], footL: [40, 94], kneeR: [58, 80], footR: [60, 94] };

function sampleBody(extra: IconShapeData[]): IconShapeData[] {
  const b = SAMPLE;
  return [
    { d: `M${pt(b.head)}m-9,0a9,9 0 1,1 18,0a9,9 0 1,1 -18,0Z`, fill: false, stroke: true, closed: true },
    poly([b.hip, b.neck], false),
    poly([b.neck, [36, 50], [32, 60]], false),
    poly([b.neck, [64, 50], [68, 60]], false),
    poly([b.hip, b.kneeL, b.footL], false),
    poly([b.hip, b.kneeR, b.footR], false),
    ...extra,
  ];
}

export function topIconShapes(id: TopId): IconShapeData[] {
  if (id === `none`) return sampleBody([]);
  return sampleBody([...clothesBehind(id, SAMPLE, 1), ...clothesOver(id, SAMPLE, 1)]);
}

export function bottomIconShapes(id: BottomId): IconShapeData[] {
  return sampleBody(clothesBottom(id, SAMPLE, 1, 0));
}
