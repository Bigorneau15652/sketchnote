// Turns an icon into ordinary elements that can be changed one by one: a line for each stroke (with few points and rounded edges for the curves), an ellipse for a circle, a
// rectangle for a rectangle, and a pen stroke for a closed shape that has a fill. They are grouped, so that they move together. The icon cannot be replaced by another one
// afterwards. Pure module.
import { IconElement, newId, Point, SketchElement } from "./elements";
import type { IconData } from "./icon-svg";
import { groupElements } from "./groups";
import { rotatePoint } from "./geometry";
import { pathToSubpaths } from "./svg-path";

const r2 = (n: number): number => Math.round(n * 100) / 100;

// The fields of an element that every element made from the icon takes from it: its effects and its lock.
function shared(el: IconElement): Partial<SketchElement> {
  const out: Record<string, unknown> = {};
  for (const key of [`opacity`, `shadow`, `reflection`, `reflectDepth`, `reflectFade`, `reflectGap`, `locked`] as const) {
    const v = (el as unknown as Record<string, unknown>)[key];
    if (v !== undefined) out[key] = v;
  }
  return out as Partial<SketchElement>;
}

// Returns the elements that replace an icon, and the identifier of their group (none when there is only one element). `existing` is the list of elements of the document, so that the new
// identifiers are free. The elements are in the order of the shapes of the icon, with the group already set.
export function iconToElements(el: IconElement, data: IconData, existing: SketchElement[]): { elements: SketchElement[]; groupId: string | null } {
  const [vx, vy, vw, vh] = data.vb;
  const sx = el.width / vw;
  const sy = el.height / vh;
  const k = (sx + sy) / 2;
  const centre: Point = [el.x + el.width / 2, el.y + el.height / 2];
  const angle = el.angle ?? 0;
  // A point of the icon, on the page: scaled into the box, mirrored if the icon is, then turned with it.
  const place = (p: Point): Point => {
    let x = el.x + (p[0] - vx) * sx;
    let y = el.y + (p[1] - vy) * sy;
    if (el.flipX === true) x = 2 * centre[0] - x;
    if (el.flipY === true) y = 2 * centre[1] - y;
    const q = angle === 0 ? ([x, y] as Point) : rotatePoint([x, y], centre, angle);
    return [r2(q[0]), r2(q[1])];
  };
  const created: SketchElement[] = [];
  const all = [...existing];
  const push = (made: SketchElement): void => {
    created.push(made);
    all.push(made);
  };
  const look = { stroke: el.stroke, strokeWidth: el.strokeWidth, ...(el.roughness !== undefined ? { roughness: el.roughness } : {}), ...shared(el) };
  const seedOf = (i: number): { seed: number } => ({ seed: ((el.seed ?? 1) + i) % 2000000000 });
  data.shapes.forEach((shape, i) => {
    // What fills the shape: the colour of the line for a shape that the file filled, otherwise the fill of the element for a closed shape.
    const fill = shape.fill ? el.stroke : shape.closed ? el.fill : undefined;
    const fillFields = fill === undefined ? {} : { fill, fillStyle: shape.fill ? (`solid` as const) : el.fillStyle ?? (`solid` as const), ...(shape.fill || el.fillOpacity === undefined ? {} : { fillOpacity: el.fillOpacity }) };
    const noStroke = !shape.stroke;
    if (shape.prim && shape.prim.kind === `ellipse`) {
      const c = place([shape.prim.cx, shape.prim.cy]);
      const made = { id: newId(all), type: `ellipse` as const, cx: c[0], cy: c[1], rx: r2(Math.max(1, shape.prim.rx * sx)), ry: r2(Math.max(1, shape.prim.ry * sy)), ...(angle !== 0 ? { angle } : {}), ...look, ...seedOf(i), ...fillFields };
      push(made as SketchElement);
      return;
    }
    if (shape.prim && shape.prim.kind === `rect`) {
      const p = shape.prim;
      const c = place([p.x + p.w / 2, p.y + p.h / 2]);
      const w = r2(Math.max(1, p.w * sx));
      const h = r2(Math.max(1, p.h * sy));
      const radius = r2(p.r * k);
      const made = { id: newId(all), type: `rect` as const, x: r2(c[0] - w / 2), y: r2(c[1] - h / 2), width: w, height: h, ...(angle !== 0 ? { angle } : {}), ...(radius > 0 ? { radius } : {}), ...look, ...seedOf(i), ...fillFields };
      push(made as SketchElement);
      return;
    }
    const subs = pathToSubpaths(shape.d) ?? [];
    for (const sub of subs) {
      let points = sub.points.map(place);
      if (points.length < 2) continue;
      if (sub.closed) points = [...points, [points[0][0], points[0][1]]];
      if (fill !== undefined && sub.closed) {
        // A closed shape with a fill is a pen stroke that comes back to its start (the only element that has a fill and takes any shape); its points are closer together.
        const dense = densify(points, Math.max(1.5, Math.max(el.width, el.height) / 50));
        push({ id: newId(all), type: `freedraw`, points: dense, ...look, strokeWidth: noStroke ? 0.5 : el.strokeWidth, ...seedOf(i), ...fillFields } as SketchElement);
      } else {
        push({ id: newId(all), type: `line`, points, ...(sub.curved ? { rounded: true } : {}), ...look, ...seedOf(i) } as SketchElement);
      }
    }
  });
  if (created.length <= 1) return { elements: created, groupId: null };
  // The elements are grouped so that they move together.
  const grouped = groupElements(all, new Set(created.map((c) => c.id)));
  const byId = new Map(grouped.elements.map((e) => [e.id, e]));
  return { elements: created.map((c) => byId.get(c.id) ?? c), groupId: grouped.groupId };
}

// Returns the points of a polyline with extra points so that no two are further apart than a distance.
function densify(points: Point[], step: number): Point[] {
  const out: Point[] = [points[0]];
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 1; j <= n; j++) out.push([r2(a[0] + ((b[0] - a[0]) * j) / n), r2(a[1] + ((b[1] - a[1]) * j) / n)]);
  }
  return out;
}

// Tells how many elements an icon becomes, for the message that warns the user (the shapes that have parts count for each part).
export function strokeCount(data: IconData): number {
  let n = 0;
  for (const shape of data.shapes) n += shape.prim ? 1 : Math.max(1, (pathToSubpaths(shape.d) ?? []).length);
  return n;
}
