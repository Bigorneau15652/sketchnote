import { test } from "node:test";
import assert from "node:assert/strict";
import { SketchElement } from "../src/elements";
import { boxCorners, boxOf, boxesIntersect, distToSegment, elementBounds, hitElement, hitHandle, hitTop, rotateHandlePos, rotatePoint, unionBox } from "../src/geometry";

const base = { stroke: `#000000`, strokeWidth: 2 };
const line = (id: string, points: [number, number][]): SketchElement => ({ id, type: `line`, points, ...base });
const rect = (id: string, x: number, y: number, w: number, h: number, angle = 0): SketchElement => ({ id, type: `rect`, x, y, width: w, height: h, ...(angle ? { angle } : {}), ...base });
const ellipse = (id: string, cx: number, cy: number, rx: number, ry: number, angle = 0): SketchElement => ({ id, type: `ellipse`, cx, cy, rx, ry, ...(angle ? { angle } : {}), ...base });
const near = (a: number, b: number, eps = 1e-6): void => assert.ok(Math.abs(a - b) <= eps, `${a} different de ${b}`);

test(`une rotation de 90 degres tourne un point autour du centre`, () => {
  const p = rotatePoint([10, 0], [0, 0], 90);
  near(p[0], 0);
  near(p[1], 10);
  const back = rotatePoint(p, [0, 0], -90);
  near(back[0], 10);
  near(back[1], 0);
});

test(`la boite d'une ligne est celle de ses points et celle d'un rectangle ou d'une ellipse est la leur`, () => {
  assert.deepEqual(boxOf(line(`a`, [[10, 20], [30, 5], [20, 40]])).box, { x: 10, y: 5, w: 20, h: 35 });
  assert.deepEqual(boxOf(rect(`b`, 1, 2, 3, 4, 30)), { box: { x: 1, y: 2, w: 3, h: 4 }, angle: 30 });
  assert.deepEqual(boxOf(ellipse(`c`, 10, 10, 5, 3)).box, { x: 5, y: 7, w: 10, h: 6 });
});

test(`les limites d'un rectangle tourne de 90 degres echangent largeur et hauteur`, () => {
  const b = elementBounds(rect(`r`, 0, 0, 100, 40, 90));
  near(b.w, 40);
  near(b.h, 100);
  near(b.x + b.w / 2, 50);
  near(b.y + b.h / 2, 20);
  const e = elementBounds(ellipse(`e`, 0, 0, 50, 20, 90));
  near(e.w, 40);
  near(e.h, 100);
});

test(`les quatre coins d'une boite sans rotation sont dans l'ordre haut gauche, haut droit, bas droit, bas gauche`, () => {
  assert.deepEqual(boxCorners({ x: 0, y: 0, w: 10, h: 20 }, 0), [[0, 0], [10, 0], [10, 20], [0, 20]]);
});

test(`l'union et l'intersection de boites`, () => {
  assert.deepEqual(unionBox([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 30 }]), { x: 0, y: 0, w: 30, h: 35 });
  assert.equal(unionBox([]), null);
  assert.equal(boxesIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 10, w: 5, h: 5 }), true);
  assert.equal(boxesIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 5, h: 5 }), false);
});

test(`la distance d'un point a un segment`, () => {
  near(distToSegment([5, 5], [0, 0], [10, 0]), 5);
  near(distToSegment([-3, 4], [0, 0], [10, 0]), 5);
  near(distToSegment([1, 1], [2, 2], [2, 2]), Math.SQRT2);
});

test(`un clic sur le trait d'une ligne la touche et un clic loin ne la touche pas`, () => {
  const l = line(`l`, [[0, 0], [100, 0]]);
  assert.equal(hitElement(l, [50, 3], 4), true);
  assert.equal(hitElement(l, [50, 12], 4), false);
});

test(`un clic sur le bord d'un rectangle le touche mais pas son interieur ni l'exterieur eloigne`, () => {
  const r = rect(`r`, 0, 0, 100, 100);
  assert.equal(hitElement(r, [0, 50], 4), true);
  assert.equal(hitElement(r, [50, 50], 4), false);
  assert.equal(hitElement(r, [-30, 50], 4), false);
});

test(`le bord d'un rectangle tourne est touche a sa nouvelle place`, () => {
  const r = rect(`r`, 0, 0, 100, 20, 90);
  // Turned by 90 degrees around (50, 10): it now spans x from 40 to 60 and y from -40 to 60.
  assert.equal(hitElement(r, [50, -40], 4), true);
  assert.equal(hitElement(r, [95, 10], 4), false);
});

test(`le bord d'une ellipse est touche et son centre non`, () => {
  const e = ellipse(`e`, 50, 50, 40, 20);
  assert.equal(hitElement(e, [90, 50], 4), true);
  assert.equal(hitElement(e, [50, 30], 4), true);
  assert.equal(hitElement(e, [50, 50], 4), false);
});

test(`l'element du dessus est choisi en premier`, () => {
  const a = line(`a`, [[0, 0], [100, 0]]);
  const b = line(`b`, [[0, 0], [100, 0]]);
  assert.equal(hitTop([a, b], [50, 0], 3)?.id, `b`);
  assert.equal(hitTop([a, b], [50, 50], 3), null);
});

test(`les poignees d'angle et de rotation sont trouvees`, () => {
  const r = rect(`r`, 100, 100, 100, 50);
  assert.deepEqual(hitHandle(r, [100, 100], 1, 8), { kind: `resize`, corner: 0 });
  assert.deepEqual(hitHandle(r, [200, 100], 1, 8), { kind: `resize`, corner: 1 });
  assert.deepEqual(hitHandle(r, [200, 150], 1, 8), { kind: `resize`, corner: 2 });
  assert.deepEqual(hitHandle(r, [100, 150], 1, 8), { kind: `resize`, corner: 3 });
  const rot = rotateHandlePos(boxOf(r).box, 0, 1);
  assert.deepEqual(hitHandle(r, rot, 1, 8), { kind: `rotate` });
  assert.equal(hitHandle(r, [150, 125], 1, 8), null);
});

test(`la poignee de rotation reste a distance constante a l'ecran quel que soit le zoom`, () => {
  const box = { x: 0, y: 0, w: 100, h: 100 };
  const a = rotateHandlePos(box, 0, 1);
  const b = rotateHandlePos(box, 0, 2);
  near(box.y - a[1], 28);
  near(box.y - b[1], 14);
});

test(`la poignee de rotation suit la rotation de l'element`, () => {
  const box = { x: 0, y: 0, w: 100, h: 100 };
  const p = rotateHandlePos(box, 90, 1);
  near(p[0], 50 + 78);
  near(p[1], 50);
});

test(`le losange est touche sur ses cotes et pas dans ses coins vides`, () => {
  const d: SketchElement = { id: `d`, type: `diamond`, x: 0, y: 0, width: 100, height: 100, ...base };
  assert.equal(hitElement(d, [50, 0], 3), true);
  assert.equal(hitElement(d, [75, 25], 3), true);
  assert.equal(hitElement(d, [5, 5], 3), false);
  assert.equal(hitElement(d, [50, 50], 3), false);
});

test(`une forme avec remplissage est touchee a l'interieur, pas sans remplissage`, () => {
  const plain = rect(`p`, 0, 0, 100, 100);
  const filled: SketchElement = { ...plain, fill: `#ff0000` } as SketchElement;
  assert.equal(hitElement(plain, [50, 50], 3), false);
  assert.equal(hitElement(filled, [50, 50], 3), true);
  const e: SketchElement = { id: `e`, type: `ellipse`, cx: 50, cy: 50, rx: 40, ry: 20, fill: `#00ff00`, ...base };
  assert.equal(hitElement(e, [50, 50], 3), true);
  assert.equal(hitElement(e, [5, 5], 3), false);
});

test(`un cadre de dessin est touche partout a l'interieur, y compris tourne`, () => {
  const f: SketchElement = { id: `f`, type: `drawing`, x: 0, y: 0, width: 100, height: 20, path: null };
  assert.equal(hitElement(f, [50, 10], 3), true);
  assert.equal(hitElement(f, [50, 60], 3), false);
  const turned: SketchElement = { ...f, angle: 90 } as SketchElement;
  // Turned by 90 degrees around (50, 10): it now spans x from 40 to 60 and y from -40 to 60.
  assert.equal(hitElement(turned, [50, -30], 3), true);
  assert.equal(hitElement(turned, [95, 10], 3), false);
});

test(`un trait libre est touche sur son trace`, () => {
  const f: SketchElement = { id: `f`, type: `freedraw`, points: [[0, 0], [50, 50], [100, 0]], ...base };
  assert.equal(hitElement(f, [25, 25], 3), true);
  assert.equal(hitElement(f, [50, 0], 3), false);
  assert.deepEqual(boxOf(f).box, { x: 0, y: 0, w: 100, h: 50 });
});
