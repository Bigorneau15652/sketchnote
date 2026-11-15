import { test } from "node:test";
import assert from "node:assert/strict";
import { IconElement, readElements } from "../src/elements";
import { iconData } from "../src/icon-registry";
import { elementPaths } from "../src/shape-paths";
import { isSafePath } from "../src/svg-path";
import { applyStyle, cleanPatch, defaultStyle } from "../src/style";
import { cleanStampSize, DEFAULT_STAMP_SIZE, isStampId, MAX_STAMP_SIZE, MIN_STAMP_SIZE, stampElement, stampName, stampShapes, STAMP_IDS } from "../src/stamps";

const look = { stroke: `#1a1a1a`, strokeWidth: 5, roughness: 1, seed: 7 };

test(`il y a au moins quinze formes, toutes differentes et nommees`, () => {
  assert.ok(STAMP_IDS.length >= 15);
  assert.equal(new Set(STAMP_IDS).size, STAMP_IDS.length);
  assert.equal(new Set(STAMP_IDS.map((id) => stampName(id))).size, STAMP_IDS.length);
  for (const id of STAMP_IDS) assert.ok(stampName(id).length > 0, id);
});

test(`les formes sont des traces surs et rien ne depasse la grille de 100`, () => {
  for (const id of STAMP_IDS) {
    const shapes = stampShapes(id);
    assert.ok(shapes.length > 0, id);
    for (const sh of shapes) {
      assert.equal(isSafePath(sh.d), true, id);
      const nums = (sh.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      assert.ok(nums.every((n) => n >= 0 && n <= 100), `${id} reste dans la grille`);
    }
  }
});

test(`un clic pose une icone centree, de la bonne taille, relue sans erreur d un fichier`, () => {
  for (const id of STAMP_IDS) {
    const el = stampElement(id, [200, 300], 40, stampName(id), look, `s1`);
    assert.equal(el.type, `icon`);
    assert.deepEqual([el.x, el.y, el.width, el.height], [180, 280, 40, 40]);
    const file = readElements([el]);
    assert.equal(file.ok, true, id);
    const back = (file as { elements: IconElement[] }).elements[0];
    assert.equal(back.shapes?.length, el.shapes?.length);
    assert.ok(iconData(back), `${id} se dessine`);
    assert.ok(elementPaths(el).pieces.length > 0, `${id} donne des traces`);
  }
});

test(`la taille est bornee et le trait reste fin sur une petite forme`, () => {
  assert.equal(cleanStampSize(1), MIN_STAMP_SIZE);
  assert.equal(cleanStampSize(5000), MAX_STAMP_SIZE);
  assert.equal(stampElement(`star`, [0, 0], 1, `x`, look, `s`).width, MIN_STAMP_SIZE);
  assert.equal(stampElement(`star`, [0, 0], 16, `x`, { ...look, strokeWidth: 9 }, `s`).strokeWidth, 2);
  assert.equal(stampElement(`star`, [0, 0], 100, `x`, { ...look, strokeWidth: 9 }, `s`).strokeWidth, 9);
});

test(`les reglages de la forme sont verifies`, () => {
  const style = defaultStyle(`#000000`);
  assert.equal(style.stamp, `disc`);
  assert.equal(style.stampSize, DEFAULT_STAMP_SIZE);
  assert.deepEqual(cleanPatch({ stamp: `star`, stampSize: 9999 }), { stamp: `star`, stampSize: MAX_STAMP_SIZE });
  assert.deepEqual(cleanPatch({ stamp: `licorne` as never, stampSize: NaN }), {});
  assert.equal(isStampId(`heart`), true);
  assert.equal(isStampId(`x`), false);
  // The shape belongs to the tool: a style change does not touch an element that is already there.
  const el = stampElement(`heart`, [0, 0], 30, `Coeur`, look, `s`);
  assert.deepEqual(applyStyle(el, { stamp: `star` }).type === `icon` ? (applyStyle(el, { stamp: `star` }) as IconElement).shapes : null, el.shapes);
});
