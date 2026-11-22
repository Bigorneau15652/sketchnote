import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFieldValue, presetValues, showFieldValue, ZOOM_PRESETS } from "../src/field-values";

test(`les valeurs proposees : toutes quand il y en a peu, sinon neuf reparties sur la plage`, () => {
  assert.deepEqual(presetValues(0, 100, 25), [0, 25, 50, 75, 100]);
  assert.deepEqual(presetValues(1, 24, 1).length, 9);
  const big = presetValues(1, 24, 1);
  assert.equal(big[0], 1);
  assert.equal(big[big.length - 1], 24);
  assert.ok(big.every((v, i) => i === 0 || v > big[i - 1]));
  assert.deepEqual(presetValues(0, 50, 1).length, 9);
  assert.deepEqual(presetValues(5, 5, 1), [5]);
  assert.deepEqual(presetValues(0, 1, 0.25), [0, 0.25, 0.5, 0.75, 1]);
});

test(`ce que l utilisateur tape est lu, borne et ramene sur le pas`, () => {
  assert.equal(parseFieldValue(`12`, 1, 24, 1), 12);
  assert.equal(parseFieldValue(` 7,6 px`, 1, 24, 1), 8);
  assert.equal(parseFieldValue(`999`, 1, 24, 1), 24);
  assert.equal(parseFieldValue(`-5`, 1, 24, 1), 1);
  assert.equal(parseFieldValue(`33`, 0, 100, 5), 35);
  assert.equal(parseFieldValue(`0.3`, 0, 1, 0.1), 0.3);
  for (const bad of [``, `abc`, `px`, `-`, `,5`]) assert.equal(parseFieldValue(bad, 1, 24, 1), null, bad);
});

test(`une valeur s affiche avec son unite`, () => {
  assert.equal(showFieldValue(100, ` %`), `100 %`);
  assert.equal(showFieldValue(2.5, ` px`), `2.5 px`);
  assert.equal(showFieldValue(3, ``), `3`);
  assert.deepEqual(ZOOM_PRESETS.slice(0, 4), [25, 50, 75, 100]);
});
