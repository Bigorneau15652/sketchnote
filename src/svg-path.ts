// Reads the data of an SVG path (the d attribute) and turns it into lists of points, with few points: the points where the path goes through, and one or more points in the middle of
// every curve, so that a line drawn through them with rounded edges follows the curve. Pure module: no access to the page.
import type { Point } from "./elements";

// One part of a path: its points, whether it comes back to its start (Z), and whether it holds curves.
export interface Subpath {
  points: Point[];
  closed: boolean;
  curved: boolean;
}

// The characters that the data of a path may hold (the data is written in the page, so nothing else is accepted).
export const PATH_CHARS = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/;

interface Command {
  cmd: string;
  args: number[];
}

const COUNTS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

// Reads a number at a position: returns it and the position after it, or null.
function readNumber(s: string, from: number): { value: number; end: number } | null {
  const m = /^[\s,]*([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/.exec(s.slice(from));
  if (!m) return null;
  return { value: Number(m[1]), end: from + m[0].length };
}

// Reads a flag of an arc (a single 0 or 1, which may be written right against the next number).
function readFlag(s: string, from: number): { value: number; end: number } | null {
  const m = /^[\s,]*([01])/.exec(s.slice(from));
  if (!m) return null;
  return { value: Number(m[1]), end: from + m[0].length };
}

// Splits the data of a path into commands with their numbers (a command followed by more numbers than it needs is repeated). Returns null when the data is not valid.
export function parseCommands(d: string): Command[] | null {
  if (typeof d !== `string` || d.length > 100000 || !PATH_CHARS.test(d) || !/^\s*[Mm]/.test(d)) return null;
  const out: Command[] = [];
  let i = 0;
  let current = ``;
  const length = d.length;
  while (i < length) {
    const ch = d[i];
    if (/\s|,/.test(ch)) {
      i++;
      continue;
    }
    if (/[A-Za-z]/.test(ch) && ch !== `e` && ch !== `E`) {
      current = ch;
      i++;
      if ((COUNTS[ch.toLowerCase()] ?? -1) < 0) return null;
      if (COUNTS[ch.toLowerCase()] === 0) out.push({ cmd: ch, args: [] });
      continue;
    }
    if (current === ``) return null;
    const need = COUNTS[current.toLowerCase()];
    if (need === 0) return null;
    const args: number[] = [];
    for (let k = 0; k < need; k++) {
      const isFlag = current.toLowerCase() === `a` && (k === 3 || k === 4);
      const r = isFlag ? readFlag(d, i) : readNumber(d, i);
      if (!r) return null;
      args.push(r.value);
      i = r.end;
    }
    out.push({ cmd: current, args });
    // A move followed by more numbers goes on with lines.
    if (current === `M`) current = `L`;
    else if (current === `m`) current = `l`;
  }
  return out;
}

// Returns the point of a cubic curve at t.
function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
}

// Returns the point of a quadratic curve at t.
function quad(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

// Returns the points of an elliptical arc, from its start to its end: the end of every quarter of the arc and the middle of every quarter (the points of the arc itself).
function arcPoints(from: Point, rxIn: number, ryIn: number, rotation: number, large: number, sweep: number, to: Point): Point[] {
  let [rx, ry] = [Math.abs(rxIn), Math.abs(ryIn)];
  if (rx === 0 || ry === 0 || (from[0] === to[0] && from[1] === to[1])) return [to];
  const phi = (rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  // The radii are made larger when they cannot reach.
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (den || 1)));
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cos * cxp - sin * cyp + (from[0] + to[0]) / 2;
  const cy = sin * cxp + cos * cyp + (from[1] + to[1]) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let delta = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  // Two points for every quarter of a turn: the middle of the quarter, then its end.
  const quarters = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const out: Point[] = [];
  for (let q = 1; q <= quarters * 2; q++) {
    const t = theta + (delta * q) / (quarters * 2);
    const px = rx * Math.cos(t);
    const py = ry * Math.sin(t);
    out.push([cos * px - sin * py + cx, sin * px + cos * py + cy]);
  }
  out[out.length - 1] = [to[0], to[1]];
  return out;
}

// Turns the data of a path into its parts, as lists of points with few points (see above). A path that is not valid gives null.
export function pathToSubpaths(d: string): Subpath[] | null {
  const commands = parseCommands(d);
  if (!commands) return null;
  const subs: Subpath[] = [];
  let cur: Subpath | null = null;
  let pos: Point = [0, 0];
  let start: Point = [0, 0];
  // The last control point, to reflect for the smooth commands.
  let lastCubic: Point | null = null;
  let lastQuad: Point | null = null;
  const begin = (p: Point): void => {
    cur = { points: [[p[0], p[1]]], closed: false, curved: false };
    subs.push(cur);
  };
  const add = (p: Point): void => {
    if (!cur) begin(pos);
    (cur as Subpath).points.push([p[0], p[1]]);
  };
  for (const { cmd, args } of commands) {
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    const ox = rel ? pos[0] : 0;
    const oy = rel ? pos[1] : 0;
    let nextCubic: Point | null = null;
    let nextQuad: Point | null = null;
    // After a Z, a command that is not a move starts a new part where the last one started.
    if (!cur && c !== `M` && c !== `Z`) begin(pos);
    if (c === `M`) {
      pos = [ox + args[0], oy + args[1]];
      start = pos;
      begin(pos);
    } else if (c === `L`) {
      pos = [ox + args[0], oy + args[1]];
      add(pos);
    } else if (c === `H`) {
      pos = [rel ? pos[0] + args[0] : args[0], pos[1]];
      add(pos);
    } else if (c === `V`) {
      pos = [pos[0], rel ? pos[1] + args[0] : args[0]];
      add(pos);
    } else if (c === `C` || c === `S`) {
      const p1: Point = c === `C` ? [ox + args[0], oy + args[1]] : lastCubic ? [2 * pos[0] - lastCubic[0], 2 * pos[1] - lastCubic[1]] : [pos[0], pos[1]];
      const o = c === `C` ? 2 : 0;
      const p2: Point = [ox + args[o], oy + args[o + 1]];
      const p3: Point = [ox + args[o + 2], oy + args[o + 3]];
      add(cubic(pos, p1, p2, p3, 0.5));
      add(p3);
      if (cur) (cur as Subpath).curved = true;
      nextCubic = p2;
      pos = p3;
    } else if (c === `Q` || c === `T`) {
      const p1: Point = c === `Q` ? [ox + args[0], oy + args[1]] : lastQuad ? [2 * pos[0] - lastQuad[0], 2 * pos[1] - lastQuad[1]] : [pos[0], pos[1]];
      const o = c === `Q` ? 2 : 0;
      const p2: Point = [ox + args[o], oy + args[o + 1]];
      add(quad(pos, p1, p2, 0.5));
      add(p2);
      if (cur) (cur as Subpath).curved = true;
      nextQuad = p1;
      pos = p2;
    } else if (c === `A`) {
      const to: Point = [ox + args[5], oy + args[6]];
      const pts = arcPoints(pos, args[0], args[1], args[2], args[3], args[4], to);
      for (const p of pts) add(p);
      if (cur && pts.length > 1) (cur as Subpath).curved = true;
      pos = to;
    } else if (c === `Z`) {
      if (cur) {
        const s: Subpath = cur;
        s.closed = true;
        // The last point is the start again: it is not repeated.
        const last = s.points[s.points.length - 1];
        if (s.points.length > 1 && Math.hypot(last[0] - s.points[0][0], last[1] - s.points[0][1]) < 1e-6) s.points.pop();
      }
      pos = start;
      cur = null;
    }
    lastCubic = nextCubic;
    lastQuad = nextQuad;
  }
  return subs.filter((s) => s.points.length >= 2 || s.closed).map((s) => ({ ...s, points: s.points.map((p): Point => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]) }));
}

// Tells whether data of a path is acceptable: made of the characters of a path, readable, and not too long.
export function isSafePath(d: unknown): d is string {
  return typeof d === `string` && d.length <= 20000 && PATH_CHARS.test(d) && parseCommands(d) !== null;
}

// The data of an ellipse (or of a circle when the two radii are the same), as a path of four arcs.
export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const r = (n: number): number => Math.round(n * 1000) / 1000;
  return `M${r(cx - rx)} ${r(cy)}A${r(rx)} ${r(ry)} 0 1 0 ${r(cx + rx)} ${r(cy)}A${r(rx)} ${r(ry)} 0 1 0 ${r(cx - rx)} ${r(cy)}Z`;
}

// The data of a rectangle with rounded corners (the radius is limited to half of each side).
export function rectPath(x: number, y: number, w: number, h: number, rxIn: number, ryIn: number): string {
  const r = (n: number): number => Math.round(n * 1000) / 1000;
  const rx = Math.min(Math.max(0, rxIn), w / 2);
  const ry = Math.min(Math.max(0, ryIn), h / 2);
  if (rx === 0 || ry === 0) return `M${r(x)} ${r(y)}H${r(x + w)}V${r(y + h)}H${r(x)}Z`;
  return `M${r(x + rx)} ${r(y)}H${r(x + w - rx)}A${r(rx)} ${r(ry)} 0 0 1 ${r(x + w)} ${r(y + ry)}V${r(y + h - ry)}A${r(rx)} ${r(ry)} 0 0 1 ${r(x + w - rx)} ${r(y + h)}H${r(x + rx)}A${r(rx)} ${r(ry)} 0 0 1 ${r(x)} ${r(y + h - ry)}V${r(y + ry)}A${r(rx)} ${r(ry)} 0 0 1 ${r(x + rx)} ${r(y)}Z`;
}
