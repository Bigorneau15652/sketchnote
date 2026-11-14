import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ELEMENTS, MAX_POINTS, newId, readElements, SketchElement } from "../src/elements";

const line = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ id: `a1`, type: `line`, points: [[0, 0], [10, 10]], stroke: `#000000`, strokeWidth: 2, ...over });

test(`les quatre types d'element valides sont lus`, () => {
  const raw = [
    line(),
    line({ id: `a2`, type: `arrow` }),
    { id: `a3`, type: `rect`, x: 1, y: 2, width: 30, height: 40, stroke: `#fff`, strokeWidth: 1 },
    { id: `a4`, type: `ellipse`, cx: 5, cy: 6, rx: 7, ry: 8, stroke: `#112233`, strokeWidth: 3, group: `structure` },
  ];
  const r = readElements(raw);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.elements.length, 4);
    assert.equal(r.elements[3].group, `structure`);
  }
});

test(`une liste absente est une page vide`, () => {
  const r = readElements(undefined);
  assert.deepEqual(r, { ok: true, elements: [] });
});

test(`un element invalide refuse toute la liste et donne son numero`, () => {
  const bad: Record<string, unknown>[] = [
    line({ id: `` }),
    line({ id: `a b` }),
    line({ id: `x`.repeat(65) }),
    line({ stroke: `red` }),
    line({ stroke: `url(javascript:x)` }),
    line({ strokeWidth: 0 }),
    line({ strokeWidth: 999 }),
    line({ strokeWidth: NaN }),
    line({ points: [[0, 0]] }),
    line({ points: [[0, 0], [1]] }),
    line({ points: [[0, 0], [`1`, 2]] }),
    line({ points: [[0, 0], [1e9, 2]] }),
    line({ type: `polygon` }),
    line({ group: `autre` }),
    { id: `r`, type: `rect`, x: 0, y: 0, width: 0, height: 5, stroke: `#000`, strokeWidth: 1 },
    { id: `e`, type: `ellipse`, cx: 0, cy: 0, rx: -1, ry: 5, stroke: `#000`, strokeWidth: 1 },
  ];
  for (const item of bad) {
    const r = readElements([line({ id: `ok` }), item]);
    assert.equal(r.ok, false, JSON.stringify(item));
    if (!r.ok && `index` in r) assert.equal(r.index, 2);
  }
  assert.equal(readElements(`pas une liste`).ok, false);
  assert.equal(readElements([null]).ok, false);
  assert.equal(readElements([[]]).ok, false);
});

test(`deux elements ne peuvent pas avoir le meme identifiant`, () => {
  const r = readElements([line(), line()]);
  assert.equal(r.ok, false);
});

test(`les limites de nombre d'elements et de points sont appliquees`, () => {
  const many = Array.from({ length: MAX_ELEMENTS + 1 }, (_, i) => line({ id: `e${i}` }));
  const r = readElements(many);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(`tooMany` in r);
  const points = Array.from({ length: MAX_POINTS + 1 }, (_, i) => [i, i]);
  assert.equal(readElements([line({ points })]).ok, false);
});

test(`les champs inconnus d'un element ne sont pas recopies`, () => {
  const r = readElements([line({ evil: `<script>`, onclick: `x` })]);
  assert.equal(r.ok, true);
  if (r.ok) {
    const el = r.elements[0] as unknown as Record<string, unknown>;
    assert.equal(`evil` in el, false);
    assert.equal(`onclick` in el, false);
  }
});

test(`le type SketchElement couvre les quatre formes`, () => {
  const kinds: SketchElement[`type`][] = [`line`, `arrow`, `rect`, `ellipse`];
  assert.equal(kinds.length, 4);
});

test(`l'angle d'un rectangle ou d'une ellipse est lu, borne et ecarte quand il vaut zero`, () => {
  const rect = (angle: unknown): Record<string, unknown> => ({ id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000`, strokeWidth: 1, angle });
  const r = readElements([rect(45)]);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal((r.elements[0] as { angle?: number }).angle, 45);
  const z = readElements([rect(0)]);
  if (z.ok) assert.equal(`angle` in z.elements[0], false);
  for (const bad of [`45`, NaN, 1000, -361, null]) assert.equal(readElements([rect(bad)]).ok, false, String(bad));
  assert.equal(readElements([{ id: `e`, type: `ellipse`, cx: 0, cy: 0, rx: 5, ry: 5, stroke: `#000`, strokeWidth: 1, angle: 90 }]).ok, true);
});

test(`un nouvel identifiant n'est jamais deja pris`, () => {
  const items = [1, 2, 3].map((n): SketchElement => ({ id: `e${n + 1}`, type: `line`, points: [[0, 0], [1, 1]], stroke: `#000`, strokeWidth: 1 }));
  const id = newId(items);
  assert.ok(!items.some((e) => e.id === id));
  assert.equal(newId([]), `e1`);
});
