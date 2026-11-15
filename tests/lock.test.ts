import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, SketchElement } from "../src/elements";
import { canFlip, flipElements } from "../src/flip";
import { allLocked, anyLocked, freeIds, isLocked, lockAction, lockElements, withLock } from "../src/lock";
import { cloneElements, moveElements, removeElements, reorder, reorderStep } from "../src/selection-ops";
import { applyStyle, applyStyleToIds } from "../src/style";

const rect = (id: string, x = 0, locked = false): SketchElement => ({ id, type: `rect`, x, y: 0, width: 40, height: 20, stroke: `#000000`, strokeWidth: 3, ...(locked ? { locked: true as const } : {}) });
const ids = (...list: string[]): Set<string> => new Set(list);

test(`un element se verrouille et se deverrouille sans laisser de champ`, () => {
  const free = rect(`a`);
  const locked = withLock(free, true);
  assert.equal(isLocked(locked), true);
  assert.equal(isLocked(free), false);
  assert.equal(withLock(locked, true), locked, `rien ne change quand il est deja verrouille`);
  const back = withLock(locked, false);
  assert.equal(`locked` in back, false);
  assert.equal(withLock(free, false), free);
});

test(`le bouton verrouille quand un element est libre et deverrouille quand tout est verrouille`, () => {
  const list = [rect(`a`, 0, true), rect(`b`), rect(`c`, 0, true)];
  assert.equal(lockAction(list, ids()), null);
  assert.equal(lockAction(list, ids(`a`)), `unlock`);
  assert.equal(lockAction(list, ids(`b`)), `lock`);
  assert.equal(lockAction(list, ids(`a`, `b`)), `lock`, `un melange se verrouille`);
  assert.equal(lockAction(list, ids(`a`, `c`)), `unlock`);
  assert.equal(allLocked(list, ids(`a`, `c`)), true);
  assert.equal(allLocked(list, ids(`a`, `b`)), false);
  assert.equal(anyLocked(list, ids(`a`, `b`)), true);
  assert.equal(anyLocked(list, ids(`b`)), false);
  assert.deepEqual([...freeIds(list, ids(`a`, `b`, `c`))], [`b`]);
});

test(`verrouiller ou deverrouiller une selection ne touche pas les autres elements`, () => {
  const list = [rect(`a`), rect(`b`), rect(`c`)];
  const locked = lockElements(list, ids(`a`, `b`), true);
  assert.deepEqual(locked.map(isLocked), [true, true, false]);
  assert.equal(locked[2], list[2]);
  const freed = lockElements(locked, ids(`a`), false);
  assert.deepEqual(freed.map(isLocked), [false, true, false]);
});

test(`un element verrouille ne se deplace pas, ne se supprime pas et ne change pas d'ordre, les autres si`, () => {
  const list = [rect(`a`, 0, true), rect(`b`, 0), rect(`c`, 0)];
  const moved = moveElements(list, ids(`a`, `b`), 10, 5);
  assert.deepEqual(moved.map((e) => (e.type === `rect` ? e.x : -1)), [0, 10, 0]);
  assert.equal(moved[0], list[0]);
  assert.deepEqual(removeElements(list, ids(`a`, `b`)).map((e) => e.id), [`a`, `c`]);
  assert.deepEqual(reorder(list, ids(`a`, `b`), `front`).map((e) => e.id), [`a`, `c`, `b`], `seul le libre passe devant`);
  assert.deepEqual(reorder(list, ids(`a`), `back`).map((e) => e.id), [`a`, `b`, `c`]);
});

test(`un element verrouille n'est pas retourne et ne compte pas dans le miroir`, () => {
  const list = [rect(`a`, 0, true), rect(`b`, 100)];
  assert.equal(canFlip(list[0]), false);
  assert.equal(canFlip(list[1]), true);
  const flipped = flipElements(list, ids(`a`, `b`), `x`);
  assert.equal(flipped[0], list[0]);
  // The mirror is about the free elements only: b stays in place about its own middle.
  assert.equal(flipped[1].type === `rect` ? flipped[1].x : -1, 100);
  assert.equal(flipElements([list[0]], ids(`a`), `x`)[0], list[0]);
});

test(`un element verrouille garde son aspect quel que soit le reglage`, () => {
  const locked = rect(`a`, 0, true);
  assert.equal(applyStyle(locked, { stroke: `#c0392b`, shadow: true, fill: `#2b6cb0`, strokeWidth: 9 }), locked);
  const list = [locked, rect(`b`)];
  const next = applyStyleToIds(list, ids(`a`, `b`), { stroke: `#c0392b` });
  assert.equal(next[0], locked);
  assert.equal(next[1].type === `rect` ? next[1].stroke : ``, `#c0392b`);
});

test(`une copie d'un element verrouille est libre`, () => {
  const list = [rect(`a`, 0, true)];
  const [copy] = cloneElements(list, list, 20, 20);
  assert.equal(isLocked(copy), false);
  assert.equal(`locked` in copy, false);
});

test(`le verrou est lu dans le fichier tel qu'il est et les valeurs fausses sont refusees`, () => {
  const read = readElements([{ id: `a`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 3, locked: true }, { id: `b`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 3, locked: false }]);
  assert.equal(read.ok, true);
  if (read.ok) {
    assert.equal(isLocked(read.elements[0]), true);
    assert.equal(`locked` in read.elements[1], false, `false n'est pas enregistre`);
    // It survives being written and read again.
    const again = readElements(JSON.parse(JSON.stringify(read.elements)));
    assert.equal(again.ok && isLocked(again.elements[0]), true);
  }
  for (const bad of [`yes`, 1, null, {}]) {
    assert.equal(readElements([{ id: `c`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 3, locked: bad }]).ok, false, JSON.stringify(bad));
  }
  // Every kind of element can be locked, a text and a frame of a drawing included.
  const kinds = readElements([
    { id: `t`, type: `text`, x: 0, y: 0, width: 20, height: 10, text: `a`, font: `caveat`, size: 20, stroke: `#000000`, locked: true },
    { id: `d`, type: `drawing`, x: 0, y: 0, width: 20, height: 10, path: null, locked: true },
    { id: `l`, type: `line`, points: [[0, 0], [5, 5]], stroke: `#000000`, strokeWidth: 3, locked: true },
  ]);
  assert.equal(kinds.ok && kinds.elements.every(isLocked), true);
});

test(`monter ou descendre d'un niveau passe l'element voisin qui le recouvre`, () => {
  const far = { ...rect(`far`, 500) };
  const list = [rect(`a`, 0), far, rect(`b`, 0), rect(`c`, 0)];
  assert.deepEqual(reorderStep(list, ids(`a`), `up`).map((e) => e.id), [`far`, `b`, `a`, `c`], `passe seulement le premier element qui le recouvre`);
  assert.deepEqual(reorderStep(list, ids(`c`), `down`).map((e) => e.id), [`a`, `far`, `c`, `b`]);
  assert.deepEqual(reorderStep(list, ids(`c`), `up`), list, `deja au dessus : rien ne change`);
  assert.deepEqual(reorderStep(list, ids(`a`), `down`), list, `deja au dessous : rien ne change`);
  assert.deepEqual(reorderStep(list, ids(`a`, `b`), `up`).map((e) => e.id), [`far`, `c`, `a`, `b`], `plusieurs elements montent ensemble`);
});

test(`un element verrouille ne change pas de niveau`, () => {
  const list = [rect(`a`, 0, true), rect(`b`, 0)];
  assert.deepEqual(reorderStep(list, ids(`a`), `up`), list);
  assert.deepEqual(reorderStep(list, ids(`b`), `down`).map((e) => e.id), [`b`, `a`]);
});
