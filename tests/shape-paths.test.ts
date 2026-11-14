import { test } from "node:test";
import assert from "node:assert/strict";
import { StrokedElement } from "../src/elements";
import { elementPaths } from "../src/shape-paths";

const base = { stroke: `#112233`, strokeWidth: 3, roughness: 1, seed: 42 };
const all: StrokedElement[] = [
  { id: `a`, type: `rect`, x: 10, y: 10, width: 100, height: 60, ...base },
  { id: `b`, type: `ellipse`, cx: 50, cy: 50, rx: 40, ry: 20, angle: 30, ...base },
  { id: `c`, type: `diamond`, x: 0, y: 0, width: 80, height: 50, ...base },
  { id: `d`, type: `line`, points: [[0, 0], [50, 20], [90, 5]], ...base },
  { id: `e`, type: `arrow`, points: [[0, 0], [80, 40]], ...base },
  { id: `f`, type: `freedraw`, points: [[0, 0], [5, 3], [10, 9], [18, 12], [30, 10]], ...base },
  { id: `g`, type: `rect`, x: 0, y: 0, width: 50, height: 50, fill: `#ff0000`, fillStyle: `hachure`, ...base },
  { id: `h`, type: `ellipse`, cx: 20, cy: 20, rx: 10, ry: 10, fill: `#00ff00`, fillStyle: `solid`, ...base },
];

test(`chaque type d'element donne au moins un trace fait seulement de commandes et de nombres`, () => {
  for (const el of all) {
    const { pieces } = elementPaths(el);
    assert.ok(pieces.length > 0, el.type);
    for (const p of pieces) {
      assert.ok(/^[MLCQTZmlcqtz0-9eE.,\s+-]+$/.test(p.d), `${el.type} : ${p.d.slice(0, 60)}`);
      assert.ok(Number.isFinite(p.strokeWidth));
    }
  }
});

test(`le meme element donne toujours le meme dessin`, () => {
  for (const el of all) {
    const a = JSON.stringify(elementPaths({ ...el } as StrokedElement));
    const b = JSON.stringify(elementPaths({ ...el } as StrokedElement));
    assert.equal(a, b, el.type);
  }
});

test(`une autre graine ou une autre rugosite change le dessin`, () => {
  const rect = all[0];
  const other = JSON.stringify(elementPaths({ ...rect, seed: 43 } as StrokedElement));
  const clean = JSON.stringify(elementPaths({ ...rect, roughness: 0 } as StrokedElement));
  const same = JSON.stringify(elementPaths(rect));
  assert.notEqual(same, other);
  assert.notEqual(same, clean);
});

test(`un element tourne donne une rotation autour de son centre`, () => {
  assert.equal(elementPaths(all[1]).transform, `rotate(30 50 50)`);
  assert.equal(elementPaths(all[0]).transform, null);
});

test(`une fleche a des traits en plus pour sa pointe`, () => {
  const line = elementPaths({ id: `x`, type: `line`, points: [[0, 0], [80, 40]], ...base }).pieces.length;
  const arrow = elementPaths(all[4]).pieces.length;
  assert.ok(arrow > line);
});

test(`un remplissage uni ou hachure ajoute un trace avec la couleur du remplissage`, () => {
  const hatch = elementPaths(all[6]).pieces;
  assert.ok(hatch.some((p) => p.stroke === `#ff0000` || p.fill === `#ff0000`));
  const solid = elementPaths(all[7]).pieces;
  assert.ok(solid.some((p) => p.fill === `#00ff00`));
  const none = elementPaths(all[0]).pieces;
  assert.ok(none.every((p) => p.fill === `none`));
});

test(`le trait libre est un contour rempli de la couleur du trait`, () => {
  const { pieces } = elementPaths(all[5]);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].fill, `#112233`);
  assert.equal(pieces[0].stroke, `none`);
});

test(`les traces sont gardes pour un meme element`, () => {
  assert.equal(elementPaths(all[0]), elementPaths(all[0]));
});
