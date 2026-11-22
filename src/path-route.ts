// The route of the Path structure: an arrow that crosses the page, with a point on it for each step. The arrow can wind like a snake, zigzag, climb in steps or go straight, and it
// goes from one side of the page to the opposite one, in any of eight directions. Pure module: it returns points, the structure builds the elements and the zones from them.
import type { Point } from "./elements";

export const PATH_SHAPES = [`snake`, `zigzag`, `steps`, `diagonal`] as const;
export type PathShape = (typeof PATH_SHAPES)[number];

export const PATH_DIRECTIONS = [`down`, `up`, `right`, `left`, `down-right`, `down-left`, `up-right`, `up-left`] as const;
export type PathDirection = (typeof PATH_DIRECTIONS)[number];

export const DEFAULT_PATH_SHAPE: PathShape = `snake`;
export const DEFAULT_PATH_DIRECTION: PathDirection = `down`;

export function isPathShape(value: unknown): value is PathShape {
  return typeof value === `string` && (PATH_SHAPES as readonly string[]).includes(value);
}

export function isPathDirection(value: unknown): value is PathDirection {
  return typeof value === `string` && (PATH_DIRECTIONS as readonly string[]).includes(value);
}

// The area of the page where the route goes.
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A step of the route: the point on the arrow, and the unit vector that points to the side where its zone goes (away from the arrow).
export interface RouteStep {
  point: Point;
  side: Point;
  // The point of the middle line of the route that the zone is measured from, and how far from it the arrow can go on that side: the zones are beside the arrow wherever it
  // swings, so they never meet it or each other.
  base: Point;
  clear: number;
}

export interface Route {
  // The points of the arrow, from its start to its head.
  line: Point[];
  steps: RouteStep[];
  // How far the route advances for one step along each axis of the page, to size the zones.
  advance: Point;
  // The most that a zone may measure along each axis of the page (null for no limit other than the room of the page): in a staircase a zone must not be longer than the run that
  // it is beside, or it would cross the next step.
  cap: [number | null, number | null];
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

// The start and the end of the route of a direction. A route along an axis goes from the middle of a side to the middle of the opposite one; a diagonal one goes from a corner to the
// opposite corner, kept a little inside.
function ends(direction: PathDirection, a: Area): [Point, Point] {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const [l, r, t, b] = [a.x + a.w * 0.2, a.x + a.w * 0.8, a.y + a.h * 0.17, a.y + a.h * 0.83];
  switch (direction) {
    case `down`:
      return [[cx, a.y], [cx, a.y + a.h]];
    case `up`:
      return [[cx, a.y + a.h], [cx, a.y]];
    case `right`:
      return [[a.x, cy], [a.x + a.w, cy]];
    case `left`:
      return [[a.x + a.w, cy], [a.x, cy]];
    case `down-right`:
      return [[l, t], [r, b]];
    case `down-left`:
      return [[r, t], [l, b]];
    case `up-right`:
      return [[l, b], [r, t]];
    case `up-left`:
      return [[r, b], [l, t]];
  }
}

// The unit vectors along the route and across it (turned a quarter turn clockwise on the page).
function frame(s: Point, e: Point): { dir: Point; side: Point; length: number } {
  const length = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1;
  const dir: Point = [(e[0] - s[0]) / length, (e[1] - s[1]) / length];
  return { dir, side: [-dir[1], dir[0]], length };
}

// Returns the route of a shape, in a direction, for a number of steps, in an area of the page.
export function planRoute(shape: PathShape, direction: PathDirection, count: number, a: Area): Route {
  const n = Math.max(1, Math.round(count));
  const axis = direction === `down` || direction === `up` || direction === `right` || direction === `left`;
  const vertical = direction === `down` || direction === `up`;
  // The steps are climbed in steps between corners, so their route starts and ends elsewhere than the other routes.
  let [s, e] = ends(direction, a);
  if (shape === `steps` && axis) {
    // A staircase also moves across the page: it goes from a side of the area to the other one.
    const inset = vertical ? a.w * 0.22 : a.h * 0.22;
    if (vertical) [s, e] = [[a.x + inset, s[1]], [a.x + a.w - inset, e[1]]];
    else [s, e] = [[s[0], a.y + inset], [e[0], a.y + a.h - inset]];
  }
  const { dir, side, length } = frame(s, e);
  const at = (along: number, across: number): Point => [s[0] + dir[0] * along + side[0] * across, s[1] + dir[1] * along + side[1] * across];
  const cross = axis ? (vertical ? a.w : a.h) : Math.min(a.w, a.h) * 0.8;
  const advance: Point = [Math.abs(e[0] - s[0]) / n, Math.abs(e[1] - s[1]) / n];
  const line: Point[] = [];
  const steps: RouteStep[] = [];
  let cap: [number | null, number | null] = [null, null];
  // Alternates the side of the zones, starting on the side that has the most room.
  const alternate = (i: number): Point => (i % 2 === 0 ? side : [-side[0], -side[1]]);

  if (shape === `diagonal`) {
    line.push(s, e);
    for (let i = 0; i < n; i++) {
      const p = at(((i + 0.5) / n) * length, 0);
      steps.push({ point: p, side: alternate(i), base: p, clear: 0 });
    }
  } else if (shape === `snake`) {
    const amp = cross * 0.09;
    for (let i = 0; i <= 80; i++) line.push(at((i / 80) * length, amp * Math.sin((i / 80) * Math.PI * 3)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      steps.push({ point: at(t * length, amp * Math.sin(t * Math.PI * 3)), side: alternate(i), base: at(t * length, 0), clear: amp });
    }
  } else if (shape === `zigzag`) {
    // The steps are the corners: the arrow goes from side to side, a corner at each step.
    const amp = cross * 0.17;
    line.push(s);
    for (let i = 0; i < n; i++) {
      const across = (i % 2 === 0 ? 1 : -1) * amp;
      const corner = at(((i + 0.5) / n) * length, across);
      line.push(corner);
      // The zone is outside of the corner, on the side where the arrow turns back.
      steps.push({ point: corner, side: across > 0 ? side : [-side[0], -side[1]], base: at(((i + 0.5) / n) * length, 0), clear: amp });
    }
    line.push(e);
  } else {
    // A staircase: a run along the major axis of the route, then a step across it, n times. The step of the zone is the middle of a run.
    const dx = (e[0] - s[0]) / n;
    const dy = (e[1] - s[1]) / n;
    const runFirstVertical = Math.abs(e[1] - s[1]) >= Math.abs(e[0] - s[0]);
    cap = runFirstVertical ? [null, Math.abs(dy) * 0.85] : [Math.abs(dx) * 0.85, null];
    let p: Point = s;
    line.push(p);
    for (let i = 0; i < n; i++) {
      const run: Point = runFirstVertical ? [p[0], p[1] + dy] : [p[0] + dx, p[1]];
      const mid: Point = [(p[0] + run[0]) / 2, (p[1] + run[1]) / 2];
      steps.push({ point: mid, side: runFirstVertical ? (i % 2 === 0 ? [1, 0] : [-1, 0]) : i % 2 === 0 ? [0, 1] : [0, -1], base: mid, clear: 0 });
      line.push(run);
      p = runFirstVertical ? [run[0] + dx, run[1]] : [run[0], run[1] + dy];
      // The last jog is not drawn: the arrow ends on its last run.
      if (i < n - 1) line.push(p);
    }
  }
  // Nothing of the route leaves the area (a corner of a zigzag on a diagonal can swing a little beyond it).
  const keep = (p: Point): Point => [r1(Math.min(a.x + a.w, Math.max(a.x, p[0]))), r1(Math.min(a.y + a.h, Math.max(a.y, p[1])))];
  return { line: line.map(keep), steps: steps.map((st) => ({ point: keep(st.point), side: st.side, base: [r1(st.base[0]), r1(st.base[1])], clear: r1(st.clear) })), advance, cap };
}
