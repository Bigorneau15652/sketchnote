import { test } from "node:test";
import assert from "node:assert/strict";
import { SketchElement } from "../src/elements";
import { canUngroup, expandToGroups, groupAction, groupElements, isGroupable, topGroupId, ungroupElements } from "../src/groups";
import { boxOf, hasRotateHandle, hitHandle, visibleCorners } from "../src/geometry";
import { cloneElements } from "../src/selection-ops";
import { rotateAbout, scaleAbout } from "../src/transform";

const base = { stroke: `#000000`, strokeWidth: 2 };
const rect = (id: string, x: number, y: number, w = 20, h = 10, groups?: string[], extra: Record<string, unknown> = {}): SketchElement =>
  ({ id, type: `rect`, x, y, width: w, height: h, ...base, ...(groups ? { groups } : {}), ...extra }) as SketchElement;
const line = (id: string, pts: [number, number][], groups?: string[]): SketchElement => ({ id, type: `line`, points: pts, ...base, ...(groups ? { groups } : {}) });
const ids = (...a: string[]): Set<string> => new Set(a);
const near = (a: number, b: number, eps = 0.05): void => assert.ok(Math.abs(a - b) <= eps, `${a} different de ${b}`);

test(`le groupe qu'un clic selectionne est le plus exterieur, sauf pendant l'edition d'un groupe`, () => {
  const el = rect(`a`, 0, 0, 5, 5, [`in`, `out`]);
  assert.equal(topGroupId(el, null), `out`);
  assert.equal(topGroupId(el, `out`), `in`);
  assert.equal(topGroupId(el, `in`), null);
  assert.equal(topGroupId(rect(`b`, 0, 0), null), null);
});

test(`choisir un membre selectionne tout le groupe, et rien de plus pour un element seul`, () => {
  const list = [rect(`a`, 0, 0, 5, 5, [`g1`]), rect(`b`, 10, 0, 5, 5, [`g1`]), rect(`c`, 20, 0), rect(`d`, 30, 0, 5, 5, [`g2`])];
  assert.deepEqual([...expandToGroups(list, ids(`a`), null)].sort(), [`a`, `b`]);
  assert.deepEqual([...expandToGroups(list, ids(`c`), null)], [`c`]);
  assert.deepEqual([...expandToGroups(list, ids(`a`, `d`), null)].sort(), [`a`, `b`, `d`]);
  assert.deepEqual([...expandToGroups(list, ids(`a`), `g1`)], [`a`], `editing a group selects the member only`);
});

test(`les groupes imbriques se selectionnent par le plus exterieur`, () => {
  const list = [rect(`a`, 0, 0, 5, 5, [`in`, `out`]), rect(`b`, 10, 0, 5, 5, [`in`, `out`]), rect(`c`, 20, 0, 5, 5, [`out`])];
  assert.deepEqual([...expandToGroups(list, ids(`a`), null)].sort(), [`a`, `b`, `c`]);
  assert.deepEqual([...expandToGroups(list, ids(`a`), `out`)].sort(), [`a`, `b`]);
});

test(`grouper met les elements choisis dans un nouveau groupe, sans toucher les autres`, () => {
  const list = [rect(`a`, 0, 0), rect(`b`, 30, 0), rect(`c`, 60, 0, 20, 10, [`old`])];
  const { elements, groupId } = groupElements(list, ids(`a`, `b`));
  assert.ok(!(`old` === groupId));
  assert.deepEqual(elements[0].groups, [groupId]);
  assert.deepEqual(elements[1].groups, [groupId]);
  assert.deepEqual(elements[2].groups, [`old`]);
  const nested = groupElements(elements, ids(`b`, `c`));
  assert.deepEqual(nested.elements[2].groups, [`old`, nested.groupId]);
  assert.notEqual(nested.groupId, groupId);
});

test(`degrouper retire le groupe le plus exterieur et laisse les membres en place`, () => {
  const list = [rect(`a`, 0, 0, 20, 10, [`in`, `out`]), rect(`b`, 30, 0, 20, 10, [`in`, `out`]), rect(`z`, 90, 0)];
  const once = ungroupElements(list, ids(`a`, `b`), null);
  assert.deepEqual(once[0].groups, [`in`]);
  assert.deepEqual(once[1].groups, [`in`]);
  const twice = ungroupElements(once, ids(`a`, `b`), null);
  assert.equal(`groups` in twice[0], false);
  assert.equal(twice[0].type === `rect` && twice[0].x, 0);
  assert.equal(ungroupElements(list, ids(`z`), null)[2], list[2]);
});

test(`le bouton groupe propose de grouper, de degrouper, ou rien`, () => {
  const list = [rect(`a`, 0, 0, 20, 10, [`g1`]), rect(`b`, 30, 0, 20, 10, [`g1`]), rect(`c`, 60, 0), rect(`d`, 90, 0)];
  assert.equal(groupAction(list, ids(`a`, `b`), null), `ungroup`, `exactly one whole group`);
  assert.equal(groupAction(list, ids(`c`, `d`), null), `group`);
  assert.equal(groupAction(list, ids(`a`, `b`, `c`), null), `group`, `a group and another element`);
  assert.equal(groupAction(list, ids(`c`), null), null, `a single element`);
  assert.equal(groupAction(list, ids(), null), null);
  assert.equal(groupAction(list, ids(`a`), `g1`), null, `one member while editing the group`);
  assert.equal(canUngroup(list, ids(`a`, `b`), null), true);
  assert.equal(canUngroup(list, ids(`c`, `d`), null), false);
});

test(`les traits de la structure et les zones ne se groupent pas`, () => {
  const structure: SketchElement = { ...line(`s1`, [[0, 0], [5, 5]]), group: `structure` };
  const zone: SketchElement = { id: `z`, type: `drawing`, x: 0, y: 0, width: 50, height: 50, slot: 2, path: null };
  const free: SketchElement = { id: `f`, type: `drawing`, x: 0, y: 0, width: 50, height: 50, path: null };
  assert.equal(isGroupable(structure), false);
  assert.equal(isGroupable(zone), false);
  assert.equal(isGroupable(free), true);
  assert.equal(groupAction([structure, rect(`a`, 0, 0)], ids(`s1`, `a`), null), null);
  assert.equal(groupAction([zone, free], ids(`z`, `f`), null), null);
});

test(`dupliquer un groupe cree un nouveau groupe independant`, () => {
  const list = [rect(`a`, 0, 0, 20, 10, [`g1`]), rect(`b`, 30, 0, 20, 10, [`g1`]), rect(`c`, 60, 0, 20, 10, [`g2`, `g1`])];
  const copies = cloneElements(list, [list[0], list[1]], 10, 10);
  const g = copies[0].groups?.[0];
  assert.ok(g && g !== `g1`, `new group id`);
  assert.deepEqual(copies[1].groups, [g], `both copies share the new group`);
  assert.deepEqual(list[0].groups, [`g1`], `the original is untouched`);
  const nested = cloneElements(list, [list[2]], 0, 0);
  assert.equal(nested[0].groups?.length, 2);
  assert.ok(nested[0].groups?.every((x) => ![`g1`, `g2`].includes(x)));
  assert.equal(cloneElements(list, [rect(`s`, 0, 0)], 0, 0)[0].groups, undefined);
});

test(`une mise a l'echelle uniforme garde les distances proportionnelles autour de l'ancre`, () => {
  const a = scaleAbout(rect(`a`, 100, 100, 40, 20), [100, 100], 2) as { x: number; y: number; width: number; height: number };
  assert.deepEqual([a.x, a.y, a.width, a.height], [100, 100, 80, 40]);
  const b = scaleAbout(rect(`b`, 200, 100, 40, 20), [100, 100], 2) as { x: number; y: number; width: number; height: number };
  assert.deepEqual([b.x, b.y, b.width, b.height], [300, 100, 80, 40]);
  const e = scaleAbout({ id: `e`, type: `ellipse`, cx: 150, cy: 150, rx: 10, ry: 5, ...base }, [100, 100], 3) as { cx: number; cy: number; rx: number; ry: number };
  assert.deepEqual([e.cx, e.cy, e.rx, e.ry], [250, 250, 30, 15]);
  const l = scaleAbout(line(`l`, [[100, 100], [120, 110]]), [100, 100], 2) as { points: number[][]; strokeWidth: number };
  assert.deepEqual(l.points, [[100, 100], [140, 120]]);
  assert.equal(l.strokeWidth, 2);
  const turned = scaleAbout(rect(`t`, 0, 0, 40, 20, undefined, { angle: 30 }), [0, 0], 2) as { angle?: number };
  assert.equal(turned.angle, 30);
});

test(`une rotation en bloc fait tourner le centre autour du point et ajoute l'angle`, () => {
  const r = rotateAbout(rect(`r`, 100, 0, 20, 20), [0, 10], 90) as { x: number; y: number; width: number; angle?: number };
  // Its centre (110, 10) goes round (0, 10) by a quarter turn clockwise: to (0, 120).
  near(r.x + r.width / 2, 0);
  near(r.y + 10, 120);
  assert.equal(r.angle, 90);
  const back = rotateAbout(r as SketchElement, [0, 10], -90) as { x: number; y: number; angle?: number };
  near(back.x, 100);
  near(back.y, 0);
  assert.equal(`angle` in back, false);
  const l = rotateAbout(line(`l`, [[10, 0], [20, 0]]), [0, 0], 90) as { points: number[][] };
  near(l.points[0][0], 0);
  near(l.points[0][1], 10);
});

test(`un trait et une fleche n'ont pas de poignee de rotation, une forme oui`, () => {
  const l = line(`l`, [[0, 0], [100, 50]]);
  const arrow: SketchElement = { id: `a`, type: `arrow`, points: [[0, 0], [100, 50]], ...base };
  assert.equal(hasRotateHandle(l), false);
  assert.equal(hasRotateHandle(arrow), false);
  assert.equal(hasRotateHandle(rect(`r`, 0, 0)), true);
  const free: SketchElement = { id: `f`, type: `freedraw`, points: [[0, 0], [5, 5], [9, 2]], ...base };
  assert.equal(hasRotateHandle(free), true);
  const top = boxOf(l).box;
  // Where the rotation handle would be: nothing there for a line.
  assert.equal(hitHandle(l, [top.x + top.w / 2, top.y - 28], 1, 10), null);
  const r = rect(`r`, 0, 0, 100, 50);
  assert.deepEqual(hitHandle(r, [50, -28], 1, 10), { kind: `rotate` });
});

test(`une ligne droite n'a de poignee qu'a ses deux bouts`, () => {
  assert.deepEqual(visibleCorners(line(`a`, [[0, 0], [100, 50]])), [0, 2]);
  assert.deepEqual(visibleCorners(line(`b`, [[0, 50], [100, 0]])), [3, 1]);
  assert.deepEqual(visibleCorners(line(`c`, [[10, 10], [10, 90]])), [0, 3]);
  assert.deepEqual(visibleCorners(line(`d`, [[0, 10], [90, 10]])), [0, 1]);
  assert.deepEqual(visibleCorners(rect(`r`, 0, 0)), [0, 1, 2, 3]);
  assert.deepEqual(visibleCorners({ id: `f`, type: `freedraw`, points: [[0, 0], [5, 5], [9, 2]], ...base }), [0, 1, 2, 3]);
  // A handle that is not shown cannot be grabbed.
  const diag = line(`a`, [[0, 0], [100, 50]]);
  assert.equal(hitHandle(diag, [100, 0], 1, 10), null);
  assert.deepEqual(hitHandle(diag, [100, 50], 1, 10), { kind: `resize`, corner: 2 });
});
