import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, SketchElement, StrokedElement, TriangleElement } from "../src/elements";
import { boxOf, hitElement, insideShape, visibleSides } from "../src/geometry";
import { isLabeledShape, labelBox } from "../src/labels";
import { elementPaths } from "../src/shape-paths";
import { defaultStyle, applyStyle } from "../src/style";
import { elementFromDrag } from "../src/tools";
import { resizeElement, resizeSide } from "../src/transform";
import { flipElements } from "../src/flip";

const tri: TriangleElement = { id: `t`, type: `triangle`, x: 100, y: 100, width: 200, height: 100, stroke: `#000000`, strokeWidth: 4 };
const mods = (shift: boolean, alt = false): { shift: boolean; alt: boolean } => ({ shift, alt });
const style = defaultStyle(`#000000`);

test(`un triangle se lit dans un fichier comme les autres formes`, () => {
  const ok = readElements([{ ...tri, fill: `#ff0000`, border: `double`, angle: 20, label: { text: `Hop`, font: `caveat`, size: 24 } }]);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual([ok.elements[0].type, (ok.elements[0] as TriangleElement).border, (ok.elements[0] as TriangleElement).angle, (ok.elements[0] as TriangleElement).label?.text], [`triangle`, `double`, 20, `Hop`]);
  for (const bad of [{ width: 0 }, { height: -5 }, { x: `1` }, { fill: `red` }, { border: `x` }]) assert.equal(readElements([{ ...tri, ...bad }]).ok, false, JSON.stringify(bad));
  assert.equal(isLabeledShape(tri), true);
});

test(`un glisser trace un triangle isocele dans la boite, avec Maj il a des proportions fixes`, () => {
  const free = elementFromDrag(`triangle`, [10, 10], [210, 60], mods(false), style, `a`, 1) as TriangleElement;
  assert.deepEqual([free.type, free.x, free.y, free.width, free.height], [`triangle`, 10, 10, 200, 50]);
  // Dragged up and to the left: the box is the same, the other way round.
  const back = elementFromDrag(`triangle`, [210, 60], [10, 10], mods(false), style, `a`, 1) as TriangleElement;
  assert.deepEqual([back.x, back.y, back.width, back.height], [10, 10, 200, 50]);
  const fixed = elementFromDrag(`triangle`, [10, 10], [210, 20], mods(true), style, `a`, 1) as TriangleElement;
  assert.equal(fixed.width, 200);
  assert.ok(Math.abs(fixed.height - 173.21) < 0.01, `equilateral: ${fixed.height}`);
  const up = elementFromDrag(`triangle`, [10, 300], [110, 290], mods(true), style, `a`, 1) as TriangleElement;
  assert.ok(Math.abs(up.height - 86.6) < 0.1 && Math.abs(up.y - (300 - up.height)) < 0.01, `upwards: ${up.y}`);
  assert.equal(elementFromDrag(`triangle`, [10, 10], [11, 11], mods(false), style, `a`, 1), null);
  const centred = elementFromDrag(`triangle`, [100, 100], [150, 120], mods(false, true), style, `a`, 1) as TriangleElement;
  assert.deepEqual([centred.x, centred.width], [50, 100]);
});

test(`un triangle se touche sur ses cotes, et dedans quand il a un remplissage`, () => {
  // Apex (200, 100), base from (100, 200)... the box is x 100..300, y 100..200: apex (200, 100), base corners (100, 200) and (300, 200).
  assert.equal(hitElement(tri, [200, 102], 4), true, `apex`);
  assert.equal(hitElement(tri, [200, 198], 4), true, `base`);
  assert.equal(hitElement(tri, [150, 150], 4), true, `left side`);
  assert.equal(hitElement(tri, [200, 160], 4), false, `inside without a fill`);
  assert.equal(hitElement({ ...tri, fill: `#ff0000` }, [200, 160], 4), true, `inside with a fill`);
  assert.equal(hitElement({ ...tri, fill: `#ff0000` }, [110, 120], 2), false, `outside, in the corner of the box`);
  assert.equal(insideShape(tri, [200, 160]), true);
  assert.equal(insideShape(tri, [110, 110]), false);
  assert.equal(insideShape({ ...tri, angle: 180 } as SketchElement, [200, 110]), true, `turned upside down: the inside is near the top`);
  assert.deepEqual(boxOf(tri).box, { x: 100, y: 100, w: 200, h: 100 });
  assert.deepEqual(visibleSides(tri), [0, 1, 2, 3]);
});

test(`un triangle se redimensionne et se retourne comme les autres formes`, () => {
  const wide = resizeSide(tri, 1, [400, 150], false) as TriangleElement;
  assert.deepEqual([wide.x, wide.width, wide.height], [100, 300, 100]);
  const big = resizeElement(tri, 2, [500, 300], false) as TriangleElement;
  assert.deepEqual([big.x, big.y, big.width, big.height], [100, 100, 400, 200]);
  const flipped = flipElements([tri], new Set([`t`]), `y`)[0] as TriangleElement & { flipY?: boolean };
  assert.equal(flipped.flipY, true);
  assert.equal((applyStyle(tri, { fill: `#00ff00`, border: `frame` }) as TriangleElement).border, `frame`);
});

test(`le texte d'un triangle est dans le plus grand rectangle sur sa base`, () => {
  assert.deepEqual(labelBox(tri), { x: 150, y: 150, w: 100, h: 50 });
});

test(`un triangle se dessine, avec ses bordures, ses coins vers l'interieur ou l'exterieur`, () => {
  const count = (el: object): number => elementPaths(el as StrokedElement).pieces.filter((p) => p.outline === true).length;
  const plain = { ...tri, roughness: 0 } as StrokedElement;
  const simple = count(plain);
  assert.ok(simple >= 1);
  assert.equal(count({ ...plain, border: `double` }), 2 * simple);
  assert.equal(count({ ...plain, border: `frame` }), 3 * simple);
  assert.equal(count({ ...plain, border: `none` }), 0);
  const filled = elementPaths({ ...plain, fill: `#ff0000`, fillStyle: `solid` } as StrokedElement);
  assert.ok(filled.pieces.some((p) => p.fill === `#ff0000`));
  assert.equal(elementPaths({ ...plain, angle: 30 } as StrokedElement).transform, `rotate(30 200 150)`);
  // The outer line of a double border is farther from the middle of the triangle than the main one.
  const nums = (el: object): number[] => elementPaths(el as StrokedElement).pieces.filter((p) => p.outline === true).flatMap((p) => (p.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number));
  const top = (el: object): number => Math.min(...nums(el).filter((_, i) => i % 2 === 1));
  assert.ok(top({ ...plain, border: `double` }) < top(plain), `the second line is outside`);
});
