import { test } from "node:test";
import assert from "node:assert/strict";
import type { SketchElement } from "../src/elements";
import { canFlip, flipElements } from "../src/flip";

const rect = (id: string, x: number, extra: object = {}): SketchElement => ({ id, type: `rect`, x, y: 0, width: 20, height: 10, stroke: `#000000`, strokeWidth: 3, ...extra }) as SketchElement;
const line: SketchElement = { id: `l`, type: `line`, points: [[0, 0], [10, 20]], stroke: `#000000`, strokeWidth: 3 };

test(`un retournement horizontal echange la gauche et la droite de la selection`, () => {
  const [a, b] = flipElements([rect(`a`, 0), rect(`b`, 80)], new Set([`a`, `b`]), `x`) as unknown as { x: number; flipX?: boolean }[];
  // The block goes from 0 to 100: a (0 to 20) goes to 80 to 100 and b (80 to 100) goes to 0 to 20.
  assert.deepEqual([a.x, b.x], [80, 0]);
  assert.deepEqual([a.flipX, b.flipX], [true, true]);
});

test(`un element retourne deux fois revient a l'etat de depart, avec son angle`, () => {
  const start = [rect(`a`, 5, { angle: 30 })];
  const once = flipElements(start, new Set([`a`]), `x`) as unknown as { x: number; angle?: number; flipX?: boolean }[];
  assert.deepEqual([once[0].x, once[0].angle, once[0].flipX], [5, -30, true]);
  const twice = flipElements(once as unknown as SketchElement[], new Set([`a`]), `x`);
  assert.deepEqual(twice, start);
});

test(`un retournement vertical agit sur y et un trait est retourne par ses points`, () => {
  const [r, l] = flipElements([rect(`a`, 0), line], new Set([`a`, `l`]), `y`) as unknown as ({ y: number; flipY?: boolean; points?: number[][] })[];
  // The block goes from 0 to 20: the rectangle (0 to 10) goes to 10 to 20.
  assert.deepEqual([r.y, r.flipY], [10, true]);
  assert.deepEqual(l.points, [[0, 20], [10, 0]]);
  const x = flipElements([line], new Set([`l`]), `x`) as unknown as { points: number[][] }[];
  assert.deepEqual(x[0].points, [[10, 0], [0, 20]]);
});

test(`une ellipse change de place par son centre et les elements non choisis ou de structure restent`, () => {
  const ellipse: SketchElement = { id: `e`, type: `ellipse`, cx: 10, cy: 10, rx: 10, ry: 5, stroke: `#000000`, strokeWidth: 3 };
  const other = rect(`o`, 200);
  const out = flipElements([ellipse, other, rect(`s`, 400, { group: `structure` })], new Set([`e`, `s`]), `x`) as unknown as { cx?: number; x?: number; flipX?: boolean }[];
  assert.deepEqual([out[0].cx, out[0].flipX], [10, true]);
  assert.equal(out[1], other as never);
  assert.equal(out[2].x, 400);
  assert.equal(canFlip(rect(`s`, 0, { group: `structure` })), false);
  assert.equal(canFlip({ id: `f`, type: `drawing`, x: 0, y: 0, width: 5, height: 5, slot: 2, path: null }), false);
  assert.equal(canFlip({ id: `f`, type: `drawing`, x: 0, y: 0, width: 5, height: 5, path: null }), true);
  assert.equal(flipElements([other], new Set(), `x`)[0], other);
});
