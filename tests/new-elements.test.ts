import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeDrawingPath, MAX_FREEDRAW_POINTS, readElements, seedFrom } from "../src/elements";

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
