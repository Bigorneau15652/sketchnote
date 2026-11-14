import { test } from "node:test";
import assert from "node:assert/strict";
import { SketchElement } from "../src/elements";
import { boxCorners, boxOf } from "../src/geometry";
import { MIN_SIZE, normalizeAngle, resizeElement, rotateBy, translate } from "../src/transform";

const base = { stroke: `#000000`, strokeWidth: 2 };
const line = (points: [number, number][]): SketchElement => ({ id: `l`, type: `line`, points, ...base });
const rect = (x: number, y: number, w: number, h: number, angle = 0): SketchElement => ({ id: `r`, type: `rect`, x, y, width: w, height: h, ...(angle ? { angle } : {}), ...base });
const ellipse = (cx: number, cy: number, rx: number, ry: number): SketchElement => ({ id: `e`, type: `ellipse`, cx, cy, rx, ry, ...base });
const near = (a: number, b: number, eps = 0.02): void => assert.ok(Math.abs(a - b) <= eps, `${a} different de ${b}`);

test(`deplacer change la position et pas la taille`, () => {
  assert.deepEqual(translate(rect(10, 10, 50, 40), 5, -5), rect(15, 5, 50, 40));
  assert.deepEqual(translate(ellipse(10, 10, 5, 3), 1, 2), ellipse(11, 12, 5, 3));
  assert.deepEqual(translate(line([[0, 0], [10, 10]]), 3, 4), line([[3, 4], [13, 14]]));
});

test(`deplacer ne modifie pas l'element d'origine`, () => {
  const r = rect(10, 10, 50, 40);
  const copy = JSON.stringify(r);
  translate(r, 5, 5);
  assert.equal(JSON.stringify(r), copy);
});

test(`agrandir un rectangle par l'angle bas droit garde l'angle haut gauche`, () => {
  const r = resizeElement(rect(10, 10, 50, 40), 2, [110, 90], false);
  assert.deepEqual(r, rect(10, 10, 100, 80));
});

test(`tirer l'angle haut gauche garde l'angle bas droit`, () => {
  const r = resizeElement(rect(10, 10, 50, 40), 0, [0, 0], false);
  assert.deepEqual(r, rect(0, 0, 60, 50));
});

test(`une taille ne descend pas sous le minimum meme si on traverse l'angle oppose`, () => {
  const r = resizeElement(rect(10, 10, 50, 40), 2, [-100, -100], false) as { width: number; height: number };
  assert.equal(r.width, MIN_SIZE);
  assert.equal(r.height, MIN_SIZE);
});

test(`avec Maj, les proportions sont gardees`, () => {
  const r = resizeElement(rect(0, 0, 100, 50), 2, [200, 60], true) as { width: number; height: number };
  near(r.width / r.height, 2);
  assert.ok(r.width >= 200 - 0.02);
});

test(`agrandir une ellipse par un angle garde l'angle oppose`, () => {
  const e = resizeElement(ellipse(50, 50, 40, 20), 2, [130, 90], false) as { cx: number; cy: number; rx: number; ry: number };
  // Opposite corner stays at (10, 30): the box now spans (10, 30) to (130, 90).
  near(e.cx - e.rx, 10);
  near(e.cy - e.ry, 30);
  near(e.cx + e.rx, 130);
  near(e.cy + e.ry, 90);
});

test(`agrandir un rectangle tourne garde l'angle oppose a la meme place sur la page`, () => {
  for (const angle of [30, 90, -45, 135]) {
    const start = rect(100, 100, 80, 40, angle);
    const before = boxCorners(boxOf(start).box, angle);
    for (const corner of [0, 1, 2, 3] as const) {
      const pointer = boxCorners(boxOf(start).box, angle)[corner];
      const moved: [number, number] = [pointer[0] + 17, pointer[1] - 9];
      const next = resizeElement(start, corner, moved, false);
      const after = boxCorners(boxOf(next).box, boxOf(next).angle);
      const opposite = (corner + 2) % 4;
      near(after[opposite][0], before[opposite][0]);
      near(after[opposite][1], before[opposite][1]);
      assert.equal(boxOf(next).angle, angle);
    }
  }
});

test(`le coin tire d'un rectangle tourne suit le pointeur`, () => {
  const start = rect(100, 100, 80, 40, 30);
  const target: [number, number] = [260, 210];
  const next = resizeElement(start, 2, target, false);
  const corner = boxCorners(boxOf(next).box, boxOf(next).angle)[2];
  near(corner[0], target[0]);
  near(corner[1], target[1]);
});

test(`agrandir une ligne par le coin du bas etire ses points`, () => {
  const next = resizeElement(line([[0, 0], [100, 50]]), 2, [200, 100], false);
  assert.deepEqual(next, line([[0, 0], [200, 100]]));
});

test(`tirer une ligne verticale ne change que sa longueur`, () => {
  const next = resizeElement(line([[50, 0], [50, 100]]), 2, [90, 150], false);
  assert.deepEqual(next, line([[50, 0], [50, 150]]));
  const up = resizeElement(line([[50, 0], [50, 100]]), 0, [10, -40], false);
  assert.deepEqual(up, line([[50, -40], [50, 100]]));
});

test(`tirer une ligne horizontale ne change que sa largeur`, () => {
  const next = resizeElement(line([[0, 20], [100, 20]]), 1, [160, 70], false);
  assert.deepEqual(next, line([[0, 20], [160, 20]]));
});

test(`les angles sont ramenes entre -180 et 180`, () => {
  assert.equal(normalizeAngle(190), -170);
  assert.equal(normalizeAngle(-190), 170);
  assert.equal(normalizeAngle(360), 0);
  assert.equal(normalizeAngle(180), 180);
  assert.equal(normalizeAngle(-180), 180);
});

test(`tourner un rectangle change son angle et un retour a zero l'enleve`, () => {
  const turned = rotateBy(rect(0, 0, 10, 10), 45) as { angle?: number };
  assert.equal(turned.angle, 45);
  const again = rotateBy(turned as SketchElement, -45) as { angle?: number };
  assert.equal(`angle` in again, false);
  const wrapped = rotateBy(rect(0, 0, 10, 10, 170), 20) as { angle?: number };
  assert.equal(wrapped.angle, -170);
});

test(`tourner une ligne de 90 degres tourne ses points autour du centre de sa boite`, () => {
  const next = rotateBy(line([[0, 50], [100, 50]]), 90);
  assert.equal(next.type, `line`);
  if (next.type === `line`) {
    near(next.points[0][0], 50);
    near(next.points[0][1], 0);
    near(next.points[1][0], 50);
    near(next.points[1][1], 100);
  }
});

test(`un losange se deplace, se redimensionne et pivote comme un rectangle`, () => {
  const d: SketchElement = { id: `d`, type: `diamond`, x: 10, y: 10, width: 50, height: 40, ...base };
  assert.deepEqual(translate(d, 5, 5), { ...d, x: 15, y: 15 });
  const big = resizeElement(d, 2, [110, 90], false) as { width: number; height: number };
  assert.equal(big.width, 100);
  assert.equal(big.height, 80);
  assert.equal((rotateBy(d, 30) as { angle?: number }).angle, 30);
});

test(`un trait libre se deplace, s'etire et pivote comme une ligne`, () => {
  const f: SketchElement = { id: `f`, type: `freedraw`, points: [[0, 0], [50, 50], [100, 0]], ...base };
  const moved = translate(f, 10, 20) as { points: number[][] };
  assert.deepEqual(moved.points[1], [60, 70]);
  const wide = resizeElement(f, 2, [200, 100], false) as { points: number[][] };
  assert.deepEqual(wide.points[2], [200, 0]);
  assert.deepEqual(wide.points[1], [100, 100]);
  const turned = rotateBy(f, 90) as { points: number[][] };
  assert.equal(turned.points.length, 3);
});

test(`un cadre de dessin garde toujours ses proportions quand on le redimensionne`, () => {
  const frame: SketchElement = { id: `c`, type: `drawing`, x: 0, y: 0, width: 200, height: 100, path: null };
  const r = resizeElement(frame, 2, [400, 120], false) as { width: number; height: number };
  assert.ok(Math.abs(r.width / r.height - 2) < 0.01);
  assert.ok(r.width >= 399);
  const turned = rotateBy(frame, 45) as { angle?: number };
  assert.equal(turned.angle, 45);
});
