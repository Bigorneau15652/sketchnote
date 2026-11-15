// The special forms of a box shape: the comic bubbles (with a tail that points at the speaker) and the festoons (banners, ribbons and labels). A form is stored on a rectangle
// element (field `form`, and `tail` for a bubble); this module turns it into the data of a closed path in the box of the element. Pure module: no page, no library.

import type { Point } from "./elements";

export const BUBBLE_FORMS = [`oval`, `rounded`, `thought`, `shout`] as const;
export type BubbleForm = (typeof BUBBLE_FORMS)[number];

export const FESTOON_FORMS = [`ribbon`, `notched`, `wave`, `scallop`, `plaque`, `tag`, `pennant`, `pointer`, `hexagon`, `flag`, `seal`] as const;
export type FestoonForm = (typeof FESTOON_FORMS)[number];

export type ShapeForm = BubbleForm | FestoonForm;

export function isBubbleForm(value: unknown): value is BubbleForm {
  return typeof value === `string` && (BUBBLE_FORMS as readonly string[]).includes(value);
}

export function isFestoonForm(value: unknown): value is FestoonForm {
  return typeof value === `string` && (FESTOON_FORMS as readonly string[]).includes(value);
}

export function isShapeForm(value: unknown): value is ShapeForm {
  return isBubbleForm(value) || isFestoonForm(value);
}

// The tail of a bubble is a point, written as a part of the width and of the height of the box from its centre (so it follows the box when it is moved, resized or turned). The usual
// tail points down and left, a little below the box.
export type Tail = [number, number];
export const DEFAULT_TAIL: Tail = [-0.28, 0.78];
export const MAX_TAIL = 2.5;

// Returns a tail with every part checked, or null when it is not two finite numbers.
export function readTail(value: unknown): Tail | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value as unknown[];
  if (typeof x !== `number` || typeof y !== `number` || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [Math.round(Math.max(-MAX_TAIL, Math.min(MAX_TAIL, x)) * 1000) / 1000, Math.round(Math.max(-MAX_TAIL, Math.min(MAX_TAIL, y)) * 1000) / 1000];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

// A closed outline: its points in order.
type Outline = Point[];

// Writes an outline as the data of a closed path of straight segments.
function pathOf(outlines: Outline[]): string {
  return outlines.map((pts) => `${pts.map((p, i) => `${i === 0 ? `M` : `L`}${r2(p[0])},${r2(p[1])}`).join(` `)} Z`).join(` `);
}

// The points of an ellipse.
function ellipseOutline(cx: number, cy: number, rx: number, ry: number, n = 72): Outline {
  const out: Outline = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

// The points of a rectangle with rounded corners, clockwise from the top left corner.
function roundedOutline(x: number, y: number, w: number, h: number, radius: number): Outline {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const out: Outline = [];
  const corner = (cx: number, cy: number, from: number): void => {
    for (let i = 0; i <= 8; i++) {
      const a = from + (i / 8) * (Math.PI / 2);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return out;
}

// The points of a cloud: an ellipse whose edge is made of round bumps.
function cloudOutline(cx: number, cy: number, rx: number, ry: number, bumps: number): Outline {
  const out: Outline = [];
  const n = bumps * 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = 0.9 + 0.12 * Math.abs(Math.sin((bumps * (a + Math.PI / 2)) / 2));
    out.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
  }
  return out;
}

// The points of a star with spikes, the same every time: the spikes are not all as long.
function starOutline(cx: number, cy: number, rx: number, ry: number, spikes: number, inner: number, jitter: number): Outline {
  const out: Outline = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const long = i % 2 === 0;
    const k = long ? 1 - jitter * ((i * 7) % 5) / 4 : inner;
    out.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
  }
  return out;
}

// Puts the tail of a bubble into a closed outline: the part of the outline where the line from the centre to the tail point crosses it is replaced by the tail, a wedge whose
// tip is the tail point.
function withTail(outline: Outline, centre: Point, tip: Point, width: number): Outline {
  const n = outline.length;
  const angle = Math.atan2(tip[1] - centre[1], tip[0] - centre[0]);
  // The point of the outline whose direction from the centre is the closest to the tail.
  let best = 0;
  let bestDiff = Infinity;
  outline.forEach((p, i) => {
    let d = Math.atan2(p[1] - centre[1], p[0] - centre[0]) - angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < bestDiff) {
      bestDiff = Math.abs(d);
      best = i;
    }
  });
  // The outline is cut on both sides of that point, as far as the tail is wide (a part of the outline, counted in points).
  const half = Math.max(1, Math.round(n * width));
  const out: Outline = [];
  for (let k = half; k < n - half; k++) out.push(outline[(best + k) % n]);
  out.push(tip);
  return out;
}

// The small circles that go from a thought bubble to the speaker: three, smaller and smaller, along the line to the tail point.
function thoughtDots(centre: Point, rx: number, ry: number, tip: Point): Outline[] {
  const angle = Math.atan2(tip[1] - centre[1], tip[0] - centre[0]);
  const edge: Point = [centre[0] + rx * 0.92 * Math.cos(angle), centre[1] + ry * 0.92 * Math.sin(angle)];
  const reach = Math.hypot(tip[0] - edge[0], tip[1] - edge[1]);
  if (reach < 4) return [];
  const size = Math.min(rx, ry);
  return [0.28, 0.62, 0.95].map((t, i) => {
    const r = Math.max(2, size * [0.14, 0.1, 0.07][i]);
    return ellipseOutline(edge[0] + (tip[0] - edge[0]) * t, edge[1] + (tip[1] - edge[1]) * t, r, r, 20);
  });
}

// Scales a list of points written in a box of 1 by 1 to the box x, y, w, h.
function inBox(unit: number[][], x: number, y: number, w: number, h: number): Outline {
  return unit.map((p): Point => [x + p[0] * w, y + p[1] * h]);
}

// The points of a rectangle whose edges have round bumps outwards, kept inside the box.
function scallopOutline(x: number, y: number, w: number, h: number): Outline {
  const depth = Math.max(2, Math.min(w, h) * 0.09);
  const [ix, iy, iw, ih] = [x + depth, y + depth, w - 2 * depth, h - 2 * depth];
  const bumpsAcross = Math.max(2, Math.round(iw / (depth * 4)));
  const bumpsDown = Math.max(2, Math.round(ih / (depth * 4)));
  const out: Outline = [];
  const edge = (count: number, at: (t: number, bump: number) => Point): void => {
    const steps = count * 10;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      out.push(at(t, Math.sin(t * count * Math.PI)));
    }
  };
  edge(bumpsAcross, (t, b) => [ix + iw * t, iy - depth * Math.abs(b)]);
  edge(bumpsDown, (t, b) => [ix + iw + depth * Math.abs(b), iy + ih * t]);
  edge(bumpsAcross, (t, b) => [ix + iw - iw * t, iy + ih + depth * Math.abs(b)]);
  edge(bumpsDown, (t, b) => [ix - depth * Math.abs(b), iy + ih - ih * t]);
  return out;
}

// The points of a banner whose top and bottom edges wave.
function waveOutline(x: number, y: number, w: number, h: number): Outline {
  const amp = h * 0.11;
  const steps = 40;
  const wave = (t: number): number => Math.sin(t * Math.PI * 3) * amp;
  const top: Outline = [];
  const bottom: Outline = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    top.push([x + w * t, y + amp + wave(t)]);
    bottom.push([x + w * (1 - t), y + h - amp + wave(1 - t)]);
  }
  return [...top, ...bottom];
}

// The outlines of a festoon in a box.
function festoonOutlines(form: FestoonForm, x: number, y: number, w: number, h: number): Outline[] {
  const c = Math.min(w, h) * 0.22;
  switch (form) {
    case `ribbon`:
      return [inBox([[0.08, 0], [0.92, 0], [0.92, 0.22], [1, 0.22], [0.93, 0.61], [1, 1], [0.78, 1], [0.78, 0.78], [0.22, 0.78], [0.22, 1], [0, 1], [0.07, 0.61], [0, 0.22], [0.08, 0.22]], x, y, w, h)];
    case `notched`:
      return [inBox([[0, 0], [1, 0], [0.93, 0.5], [1, 1], [0, 1], [0.07, 0.5]], x, y, w, h)];
    case `wave`:
      return [waveOutline(x, y, w, h)];
    case `scallop`:
      return [scallopOutline(x, y, w, h)];
    case `plaque`:
      return [[[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]];
    case `tag`:
      return [inBox([[0.2, 0], [1, 0], [1, 1], [0.2, 1], [0, 0.5]], x, y, w, h)];
    case `pennant`:
      return [inBox([[0, 0], [1, 0.5], [0, 1]], x, y, w, h)];
    case `pointer`:
      return [inBox([[0, 0], [0.78, 0], [1, 0.5], [0.78, 1], [0, 1]], x, y, w, h)];
    case `hexagon`:
      return [inBox([[0.12, 0], [0.88, 0], [1, 0.5], [0.88, 1], [0.12, 1], [0, 0.5]], x, y, w, h)];
    case `flag`:
      return [inBox([[0, 0], [1, 0], [0.82, 0.5], [1, 1], [0, 1]], x, y, w, h)];
    case `seal`:
      return [starOutline(x + w / 2, y + h / 2, w / 2, h / 2, 16, 0.88, 0)];
  }
}

// Returns the data of the closed path of a form in the box x, y, w, h. A bubble takes the tail given as a part of the box from its centre (the usual tail when it is absent). Both
// the box and the tail can be grown by a distance, to draw the other lines of a border outside the first one.
export function formPath(form: ShapeForm, x: number, y: number, w: number, h: number, tail: Tail = DEFAULT_TAIL, grow = 0): string {
  const [gx, gy, gw, gh] = [x - grow, y - grow, w + 2 * grow, h + 2 * grow];
  if (isFestoonForm(form)) return pathOf(festoonOutlines(form, gx, gy, gw, gh));
  const centre: Point = [gx + gw / 2, gy + gh / 2];
  const tip: Point = [x + w / 2 + tail[0] * w, y + h / 2 + tail[1] * h];
  switch (form) {
    case `oval`:
      return pathOf([withTail(ellipseOutline(centre[0], centre[1], gw / 2, gh / 2, 96), centre, tip, 0.045)]);
    case `rounded`:
      return pathOf([withTail(roundedOutline(gx, gy, gw, gh, Math.min(gw, gh) * 0.25), centre, tip, 0.03)]);
    case `thought`:
      return pathOf([cloudOutline(centre[0], centre[1], gw / 2, gh / 2, Math.max(6, Math.min(14, Math.round((gw + gh) / 70)))), ...thoughtDots(centre, gw / 2, gh / 2, tip)]);
    case `shout`:
      return pathOf([withTail(starOutline(centre[0], centre[1], gw / 2, gh / 2, 12, 0.74, 0.18), centre, tip, 0.05)]);
  }
}

// Returns the part of the box where the text of a form goes, as a part of the box (x, y, width and height from 0 to 1).
export function formRoom(form: ShapeForm): { x: number; y: number; w: number; h: number } {
  switch (form) {
    case `oval`:
      return { x: 0.15, y: 0.15, w: 0.7, h: 0.7 };
    case `rounded`:
      return { x: 0.07, y: 0.07, w: 0.86, h: 0.86 };
    case `thought`:
      return { x: 0.17, y: 0.17, w: 0.66, h: 0.66 };
    case `shout`:
      return { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };
    case `ribbon`:
      return { x: 0.1, y: 0.06, w: 0.8, h: 0.66 };
    case `notched`:
      return { x: 0.1, y: 0.08, w: 0.8, h: 0.84 };
    case `wave`:
      return { x: 0.06, y: 0.24, w: 0.88, h: 0.52 };
    case `scallop`:
      return { x: 0.12, y: 0.12, w: 0.76, h: 0.76 };
    case `plaque`:
      return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    case `tag`:
      return { x: 0.26, y: 0.08, w: 0.68, h: 0.84 };
    case `pennant`:
      return { x: 0.05, y: 0.3, w: 0.45, h: 0.4 };
    case `pointer`:
      return { x: 0.06, y: 0.08, w: 0.66, h: 0.84 };
    case `hexagon`:
      return { x: 0.14, y: 0.1, w: 0.72, h: 0.8 };
    case `flag`:
      return { x: 0.06, y: 0.08, w: 0.68, h: 0.84 };
    case `seal`:
      return { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };
  }
}

// Tells whether a form has a tail that can be moved: the bubbles that are not clouds of thought also have one, the clouds have the small circles that lead to it.
export function hasTail(form: ShapeForm | undefined): boolean {
  return isBubbleForm(form);
}

// Returns the point of the tail on the page for a box (before its rotation).
export function tailPoint(box: { x: number; y: number; w: number; h: number }, tail: Tail | undefined): Point {
  const t = tail ?? DEFAULT_TAIL;
  return [box.x + box.w / 2 + t[0] * box.w, box.y + box.h / 2 + t[1] * box.h];
}
