import { test } from "node:test";
import assert from "node:assert/strict";
import { LineElement, readElements, RectElement } from "../src/elements";
import { eraseCaps, eraseFromPage, eraseLine, erasePagePoints, eraseTouches, mirrorErase, withErase, withoutErase } from "../src/erase";
import { cleanEraseDensity, cleanEraseSize, MAX_ERASE_POINTS, MAX_ERASE_SIZE, MAX_ERASE_STROKES, MIN_ERASE_SIZE, readErase } from "../src/erase-data";
import { flipElements } from "../src/flip";
import { cleanPatch, defaultStyle } from "../src/style";
import { Point } from "../src/elements";

const rect: RectElement = { id: `r`, type: `rect`, x: 100, y: 100, width: 200, height: 100, stroke: `#000000`, strokeWidth: 3, fill: `#ffcc00` };
const near = (a: Point, b: Point): boolean => Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02;

test(`une passe de gomme se relit a la meme place meme apres un tour`, () => {
  const page: Point[] = [[150, 120], [250, 180]];
  const stroke = eraseFromPage(rect, page, 30, `soft`, 1);
  assert.deepEqual(stroke.points[0], [0.25, 0.2]);
  const back = erasePagePoints(rect, stroke);
  assert.ok(near(back[0], page[0]) && near(back[1], page[1]));
  // The element moves: the pass moves with it.
  const moved = { ...rect, x: 400, y: 50 };
  assert.ok(near(erasePagePoints(moved, stroke)[0], [450, 70]));
  // The element is turned or mirrored after the pass: the pass stays on the same part of the element.
  const turned = { ...rect, angle: 90 };
  const a = eraseFromPage(turned, [[200, 20]], 30, `round`, 1);
  assert.ok(near(erasePagePoints(turned, a)[0], [200, 20]));
  const flipped: RectElement = { ...rect, flipX: true };
  const b = eraseFromPage(flipped, [[110, 150]], 30, `round`, 1);
  assert.ok(near(erasePagePoints(flipped, b)[0], [110, 150]));
  assert.ok(b.points[0][0] > 0.9, `une bulle retournee : le bord gauche de la page est le bord droit de l element`);
});

test(`la gomme touche ce qui est dessine et pas le vide`, () => {
  assert.equal(eraseTouches(rect, [[200, 150]], 20), true, `dans une forme remplie`);
  assert.equal(eraseTouches({ ...rect, fill: undefined }, [[200, 150]], 20), false, `au milieu d une forme vide`);
  assert.equal(eraseTouches({ ...rect, fill: undefined }, [[100, 150]], 20), true, `sur son trait`);
  assert.equal(eraseTouches(rect, [[600, 600]], 20), false);
  assert.equal(eraseTouches(rect, [[0, 150], [400, 150]], 20), true, `une passe qui traverse`);
  assert.equal(eraseTouches({ ...rect, locked: true }, [[200, 150]], 20), false, `un element verrouille`);
  assert.equal(eraseTouches({ ...rect, group: `structure` }, [[200, 150]], 20), false, `un trace de la structure`);
});

test(`une passe est ajoutee puis retiree sans toucher l original`, () => {
  const stroke = eraseFromPage(rect, [[150, 120]], 30, `soft`, 0.5);
  const erased = withErase(rect, stroke);
  assert.equal(rect.erase, undefined);
  assert.equal(erased.erase?.length, 1);
  assert.equal(withErase(erased, stroke).erase?.length, 2);
  assert.equal(withoutErase(erased).erase, undefined);
  assert.equal(withoutErase(rect), rect);
  const many = Array.from({ length: MAX_ERASE_STROKES + 5 }).reduce<RectElement>((el) => withErase(el, stroke) as RectElement, rect);
  assert.equal(many.erase?.length, MAX_ERASE_STROKES);
});

test(`les reglages de la gomme sont bornes`, () => {
  assert.equal(cleanEraseSize(-3), MIN_ERASE_SIZE);
  assert.equal(cleanEraseSize(9999), MAX_ERASE_SIZE);
  assert.equal(cleanEraseDensity(5), 1);
  assert.equal(cleanEraseDensity(0), 0.1);
  const p = cleanPatch({ eraseShape: `carre` as never, eraseSize: 500, eraseDensity: 0.55 });
  assert.deepEqual(p, { eraseSize: MAX_ERASE_SIZE, eraseDensity: 0.55 });
  assert.equal(defaultStyle(`#000000`).eraseShape, `soft`);
  assert.deepEqual(eraseCaps(`square`), { cap: `square`, join: `miter` });
  assert.deepEqual(eraseCaps(`soft`), { cap: `round`, join: `round` });
});

test(`les passes lues d un fichier sont verifiees`, () => {
  const good = [{ points: [[0.1, 0.2], [0.5, 0.5]], size: 30, shape: `round`, density: 1 }];
  assert.deepEqual(readErase(good)?.[0].points, [[0.1, 0.2], [0.5, 0.5]]);
  assert.equal(readErase(undefined), undefined);
  for (const bad of [
    `x`,
    [{ ...good[0], shape: `losange` }],
    [{ ...good[0], size: 1 }],
    [{ ...good[0], size: 500 }],
    [{ ...good[0], density: 0 }],
    [{ ...good[0], points: [] }],
    [{ ...good[0], points: [[1]] }],
    [{ ...good[0], points: [[1000, 0]] }],
    [{ ...good[0], points: [[NaN, 0]] }],
    [{ ...good[0], points: Array.from({ length: MAX_ERASE_POINTS + 1 }, () => [0, 0]) }],
    Array.from({ length: MAX_ERASE_STROKES + 1 }, () => good[0]),
    [5],
  ]) assert.equal(readErase(bad), null);
  const file = readElements([{ ...rect, erase: good }]);
  assert.equal(file.ok, true);
  assert.equal((file as { elements: RectElement[] }).elements[0].erase?.length, 1);
  assert.equal(readElements([{ ...rect, erase: [{ ...good[0], shape: `x` }] }]).ok, false);
  // An empty list is the same as none.
  assert.equal((readElements([{ ...rect, erase: [] }]) as { elements: RectElement[] }).elements[0].erase, undefined);
});

test(`la ligne du masque est faite de segments et un clic fait un point`, () => {
  const one = eraseFromPage(rect, [[150, 120]], 30, `soft`, 1);
  assert.match(eraseLine(rect, one), /^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
  const two = eraseFromPage(rect, [[150, 120], [160, 130], [170, 140]], 30, `soft`, 1);
  assert.equal(eraseLine(rect, two).split(` `).length, 3);
  assert.match(eraseLine(rect, two), /^[ML0-9.,\s-]+$/);
});

test(`retourner une ligne retourne aussi ses effacements`, () => {
  const line: LineElement = { id: `l`, type: `line`, points: [[0, 0], [100, 0]], stroke: `#000000`, strokeWidth: 3, erase: [{ points: [[0.2, 0.5]], size: 20, shape: `round`, density: 1 }] };
  const flipped = flipElements([line], new Set([`l`]), `x`)[0] as LineElement;
  assert.deepEqual(flipped.points, [[100, 0], [0, 0]]);
  assert.deepEqual(flipped.erase?.[0].points[0], [0.8, 0.5]);
  assert.deepEqual(mirrorErase(undefined, `x`), undefined);
  assert.deepEqual(mirrorErase(line.erase, `y`)?.[0].points[0], [0.2, 0.5]);
});
