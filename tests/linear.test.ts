import { test } from "node:test";
import assert from "node:assert/strict";
import { ArrowElement, headOf, LineElement, readElements, SketchElement } from "../src/elements";
import { curveSamples, drawnPoints, endDirection, headShape, headSize, insertPointAt, isRounded, lockAngle, midpointIndexAt, midpointOf, movePointTo, nearestOnLine, pointIndexAt, removePointAt, arrowHeadShapes } from "../src/linear";
import { elementBounds, hitElement } from "../src/geometry";
import { elementPaths } from "../src/shape-paths";

const base = { stroke: `#112233`, strokeWidth: 3, roughness: 1, seed: 9 };
const line = (points: [number, number][], extra: Record<string, unknown> = {}): LineElement => ({ id: `l`, type: `line`, points, ...base, ...extra }) as LineElement;
const arrow = (points: [number, number][], extra: Record<string, unknown> = {}): ArrowElement => ({ id: `a`, type: `arrow`, points, ...base, ...extra }) as ArrowElement;
const near = (a: number, b: number, eps = 0.01): void => assert.ok(Math.abs(a - b) <= eps, `${a} different de ${b}`);

test(`les points d'un trait se deplacent n'importe ou, sans cadre ni limite d'angle`, () => {
  const l = line([[0, 0], [100, 100]]);
  const m = movePointTo(l, 1, [-50, 30]);
  assert.deepEqual(m.points, [[0, 0], [-50, 30]]);
  assert.deepEqual(movePointTo(l, 0, [500, -200]).points, [[500, -200], [100, 100]]);
  assert.equal(movePointTo(l, 5, [1, 1]), l);
  assert.deepEqual(l.points, [[0, 0], [100, 100]], `the original is untouched`);
});

test(`on peut ajouter un point entre deux autres et en retirer un, jusqu'a deux points`, () => {
  const l = line([[0, 0], [100, 0]]);
  const bent = insertPointAt(l, 1, [50, 40]);
  assert.deepEqual(bent.points, [[0, 0], [50, 40], [100, 0]]);
  assert.deepEqual(insertPointAt(l, 99, [1, 1]).points[2], [1, 1], `an index too large adds at the end`);
  assert.deepEqual(removePointAt(bent, 1)?.points, [[0, 0], [100, 0]]);
  assert.equal(removePointAt(l, 0), null, `a line keeps at least two points`);
  assert.equal(removePointAt(bent, 7), null);
});

test(`la poignee d'un point et celle du milieu d'un segment se trouvent sous le pointeur`, () => {
  const pts: [number, number][] = [[0, 0], [100, 0], [100, 100]];
  assert.equal(pointIndexAt(pts, [2, 1], 6), 0);
  assert.equal(pointIndexAt(pts, [100, 98], 6), 2);
  assert.equal(pointIndexAt(pts, [50, 50], 6), -1);
  assert.equal(midpointIndexAt(pts, [50, 2], 6), 0);
  assert.equal(midpointIndexAt(pts, [101, 50], 6), 1);
  assert.equal(midpointIndexAt(pts, [0, 0], 6), -1);
  assert.deepEqual(midpointOf([0, 0], [10, 20]), [5, 10]);
});

test(`un segment trop court n'a pas de poignee de milieu`, () => {
  assert.equal(midpointIndexAt([[0, 0], [10, 0]], [5, 0], 6), -1);
  assert.equal(midpointIndexAt([[0, 0], [60, 0]], [30, 0], 6), 0);
});

test(`le point le plus proche d'un trait donne le segment ou l'on ajoute un point`, () => {
  const l = line([[0, 0], [100, 0], [100, 100]]);
  const a = nearestOnLine(l, [60, 5]);
  assert.ok(a && a.segment === 0 && near(a.point[0], 60) === undefined && a.dist === 5);
  const b = nearestOnLine(l, [95, 70]);
  assert.ok(b && b.segment === 1 && b.point[1] === 70);
  assert.equal(nearestOnLine(line([[0, 0], [1, 1]], {}) as LineElement, [0, 0])?.segment, 0);
});

test(`Maj verrouille l'angle par pas de 15 degres autour du point voisin`, () => {
  const p = lockAngle([0, 0], [100, 3]);
  near(p[1], 0, 0.5);
  near(Math.hypot(p[0], p[1]), Math.hypot(100, 3), 0.01);
  const q = lockAngle([10, 10], [10 + 50, 10 + 50]);
  near(q[0] - 10, q[1] - 10, 0.01);
});

test(`une courbe arrondie passe par tous les points de controle`, () => {
  const pts: [number, number][] = [[0, 0], [50, 80], [100, 0], [150, 80]];
  const s = curveSamples(pts, 8);
  for (const p of pts) assert.ok(s.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01), `passes through ${p}`);
  assert.deepEqual(curveSamples([[0, 0], [10, 10]]), [[0, 0], [10, 10]], `two points stay straight`);
  assert.equal(s.length, 1 + 3 * 8);
});

test(`les bords arrondis changent la forme dessinee, les limites et le point touche`, () => {
  const pts: [number, number][] = [[0, 0], [100, 100], [200, 0]];
  const sharp = line(pts);
  const round = line(pts, { rounded: true });
  assert.equal(isRounded(sharp), false);
  assert.equal(isRounded(round), true);
  assert.equal(isRounded(line([[0, 0], [10, 10]], { rounded: true })), false, `needs three points`);
  assert.deepEqual(drawnPoints(sharp), pts);
  assert.ok(drawnPoints(round).length > 3);
  // The curve goes round the corner: the sharp corner at (100, 100) is cut, so the curve stays above it near the middle.
  assert.equal(hitElement(sharp, [100, 100], 2), true);
  assert.ok(elementBounds(round).h <= elementBounds(sharp).h + 0.01);
  assert.notDeepEqual(JSON.stringify(elementPaths(sharp).pieces), JSON.stringify(elementPaths(round).pieces));
});

test(`une fleche a par defaut une pointe a la fin et aucune au debut`, () => {
  const a = arrow([[0, 0], [100, 0]]);
  assert.equal(headOf(a, `start`), `none`);
  assert.equal(headOf(a, `end`), `arrow`);
  assert.equal(headOf({ ...a, startHead: `dot`, endHead: `none` }, `start`), `dot`);
  assert.equal(headOf({ ...a, endHead: `none` }, `end`), `none`);
  const shapes = arrowHeadShapes(a);
  assert.ok(shapes && shapes.start.lines.length + shapes.start.polygons.length + shapes.start.circles.length === 0);
  assert.equal(shapes?.end.lines.length, 1);
  assert.equal(arrowHeadShapes(line([[0, 0], [100, 0]]) as SketchElement), null);
});

test(`chaque pointe a sa forme et pointe dans la direction de la ligne`, () => {
  const tip: [number, number] = [100, 0];
  const dir: [number, number] = [1, 0];
  const size = 20;
  assert.deepEqual(headShape(`none`, tip, dir, size), { lines: [], polygons: [], circles: [] });
  const open = headShape(`arrow`, tip, dir, size);
  assert.equal(open.lines[0].length, 3);
  assert.deepEqual(open.lines[0][1], tip);
  assert.ok(open.lines[0][0][0] < 100 && open.lines[0][2][0] < 100, `the sides are behind the tip`);
  near(open.lines[0][0][1], -open.lines[0][2][1]);
  const tri = headShape(`triangle`, tip, dir, size);
  assert.equal(tri.polygons[0].length, 3);
  assert.deepEqual(tri.polygons[0][0], tip);
  const bar = headShape(`bar`, tip, dir, size);
  near(bar.lines[0][0][0], 100);
  near(bar.lines[0][1][0], 100);
  near(Math.abs(bar.lines[0][0][1] - bar.lines[0][1][1]), size * 0.5 * 2);
  const dot = headShape(`dot`, tip, dir, size);
  assert.equal(dot.circles.length, 1);
  near(dot.circles[0].c[0] + dot.circles[0].r, 100);
  const dia = headShape(`diamond`, tip, dir, size);
  assert.equal(dia.polygons[0].length, 4);
  assert.deepEqual(dia.polygons[0][0], tip);
  assert.ok(headSize(3) >= 14 && headSize(20) > headSize(3));
});

test(`la direction au bout d'une ligne pointe vers l'exterieur, au debut comme a la fin`, () => {
  const l = line([[0, 0], [50, 0], [50, 50]]);
  const end = endDirection(l, `end`);
  assert.ok(end);
  assert.deepEqual(end?.tip, [50, 50]);
  near(end?.dir[0] ?? 9, 0);
  near(end?.dir[1] ?? 9, 1);
  const start = endDirection(l, `start`);
  assert.deepEqual(start?.tip, [0, 0]);
  near(start?.dir[0] ?? 9, -1);
  assert.equal(endDirection(line([[5, 5], [5, 5]]), `end`), null);
});

test(`les pointes sont dessinees avec la fleche, sans pointe elles disparaissent, et un trait n'en a jamais`, () => {
  const count = (e: ArrowElement | LineElement): number => elementPaths(e).pieces.length;
  const plain = arrow([[0, 0], [100, 0]], { endHead: `none` });
  assert.ok(count(arrow([[0, 0], [100, 0]])) > count(plain), `the default head adds pieces`);
  assert.ok(count(arrow([[0, 0], [100, 0]], { startHead: `triangle` })) > count(arrow([[0, 0], [100, 0]])));
  const dot = elementPaths(arrow([[0, 0], [100, 0]], { endHead: `dot` })).pieces;
  assert.ok(dot.some((p) => p.fill === base.stroke), `a dot is filled with the colour of the line`);
  assert.equal(count(line([[0, 0], [100, 0]])), count(plain));
});

test(`les bords arrondis et les pointes sont lus et controles dans le fichier`, () => {
  const mk = (extra: Record<string, unknown>, type = `arrow`): unknown[] => [{ id: `a`, type, points: [[0, 0], [5, 5], [9, 0]], stroke: `#000`, strokeWidth: 2, ...extra }];
  assert.equal(readElements(mk({ rounded: true, startHead: `dot`, endHead: `triangle` })).ok, true);
  assert.equal(readElements(mk({ rounded: true }, `line`)).ok, true);
  for (const bad of [{ rounded: `yes` }, { startHead: `star` }, { endHead: 3 }, { endHead: null }]) assert.equal(readElements(mk(bad)).ok, false, JSON.stringify(bad));
  // A line has no heads: the fields are not kept.
  const r = readElements(mk({ endHead: `dot` }, `line`));
  assert.equal(r.ok && `endHead` in r.elements[0], false);
});
