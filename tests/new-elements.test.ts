import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeDrawingPath, MAX_FREEDRAW_POINTS, newGroupId, readElements, seedFrom, SketchElement } from "../src/elements";

const base = { stroke: `#000000`, strokeWidth: 3 };

test(`un losange, un trait libre et un cadre de dessin valides sont lus`, () => {
  const r = readElements([
    { id: `d1`, type: `diamond`, x: 0, y: 0, width: 40, height: 30, angle: 20, fill: `#ff0000`, fillStyle: `hachure`, roughness: 1, seed: 5, ...base },
    { id: `f1`, type: `freedraw`, points: [[0, 0], [1, 1], [2, 3]], ...base },
    { id: `c1`, type: `drawing`, x: 10, y: 10, width: 200, height: 100, path: `Sketchnote dessins/A - dessin 1.sketchdraw` },
    { id: `c2`, type: `drawing`, x: 10, y: 10, width: 200, height: 100, path: null, angle: 15 },
  ]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.elements.length, 4);
    assert.equal((r.elements[3] as { angle?: number }).angle, 15);
  }
});

test(`les champs de style invalides refusent l'element`, () => {
  const rect = (extra: Record<string, unknown>): unknown[] => [{ id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, ...base, ...extra }];
  for (const bad of [{ roughness: -1 }, { roughness: 9 }, { roughness: `1` }, { seed: 0 }, { seed: 1.5 }, { seed: 3e9 }, { fill: `red` }, { fill: `url(x)` }, { fillStyle: `dots` }]) {
    assert.equal(readElements(rect(bad)).ok, false, JSON.stringify(bad));
  }
  assert.equal(readElements(rect({ roughness: 2, seed: 77, fill: `#abc`, fillStyle: `solid` })).ok, true);
});

test(`un trait libre a plus de points permis qu'une ligne mais reste borne`, () => {
  const pts = (n: number): number[][] => Array.from({ length: n }, (_, i) => [i, i]);
  assert.equal(readElements([{ id: `f`, type: `freedraw`, points: pts(MAX_FREEDRAW_POINTS), ...base }]).ok, true);
  assert.equal(readElements([{ id: `f`, type: `freedraw`, points: pts(MAX_FREEDRAW_POINTS + 1), ...base }]).ok, false);
  assert.equal(readElements([{ id: `l`, type: `line`, points: pts(501), ...base }]).ok, false);
});

test(`les chemins de dessin dangereux sont refuses`, () => {
  for (const bad of [``, `/etc/x.sketchdraw`, `\\x.sketchdraw`, `C:/x.sketchdraw`, `../x.sketchdraw`, `a/../x.sketchdraw`, `a/./x.sketchdraw`, `x.png`, `x.sketchdraw/..`, `a\u0000b.sketchdraw`, `x`.repeat(600) + `.sketchdraw`, 5, null, undefined]) {
    assert.equal(isSafeDrawingPath(bad), false, String(bad));
  }
  assert.equal(isSafeDrawingPath(`Dossier/Mon dessin - 1.sketchdraw`), true);
  assert.equal(isSafeDrawingPath(`a.SKETCHDRAW`), true);
  const r = readElements([{ id: `c`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, path: `../secret.sketchdraw` }]);
  assert.equal(r.ok, false);
});

test(`les graines sont stables, differentes et valides`, () => {
  assert.equal(seedFrom(3), seedFrom(3));
  assert.notEqual(seedFrom(3), seedFrom(4));
  for (let i = 0; i < 1000; i++) {
    const s = seedFrom(i);
    assert.ok(Number.isInteger(s) && s >= 1 && s <= 2147483647);
  }
});

test(`la forme du pointille d'un cadre est lue et controlee`, () => {
  const make = (shape: unknown): unknown[] => [{ id: `c`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, shape, path: null }];
  assert.equal(readElements(make(`ellipse`)).ok, true);
  assert.equal(readElements(make(`rect`)).ok, true);
  assert.equal(readElements(make(undefined)).ok, true);
  for (const bad of [`star`, 3, null]) assert.equal(readElements(make(bad)).ok, false, String(bad));
});

test(`la transparence du remplissage est lue et bornee`, () => {
  const rect = (o: unknown): unknown[] => [{ id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000`, strokeWidth: 1, fill: `#f00`, fillOpacity: o }];
  assert.equal(readElements(rect(0.5)).ok, true);
  assert.equal(readElements(rect(1)).ok, true);
  assert.equal(readElements(rect(0.05)).ok, true);
  for (const bad of [0, 0.01, 1.5, -1, `0.5`, NaN, null]) assert.equal(readElements(rect(bad)).ok, false, String(bad));
});

test(`la liste des groupes d'un element est lue et controlee`, () => {
  const line = (g: unknown): unknown[] => [{ id: `l`, type: `line`, points: [[0, 0], [1, 1]], stroke: `#000`, strokeWidth: 1, groups: g }];
  assert.equal(readElements(line([`g1`])).ok, true);
  assert.equal(readElements(line([`g1`, `g2`])).ok, true);
  for (const bad of [[], `g1`, [1], [`a b`], [``], [`x`.repeat(70)], Array.from({ length: 9 }, (_, i) => `g${i}`), null]) assert.equal(readElements(line(bad)).ok, false, JSON.stringify(bad));
  assert.equal(readElements(line(undefined)).ok, true);
});

test(`un nouvel identifiant de groupe n'est jamais deja pris`, () => {
  const mk = (id: string, groups?: string[]): SketchElement => ({ id, type: `line`, points: [[0, 0], [1, 1]], stroke: `#000`, strokeWidth: 1, ...(groups ? { groups } : {}) });
  assert.equal(newGroupId([]), `g1`);
  const items = [mk(`a`, [`g1`]), mk(`b`, [`g1`, `g2`]), mk(`c`, [`g3`])];
  assert.ok(![`g1`, `g2`, `g3`].includes(newGroupId(items)));
});
