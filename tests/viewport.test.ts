import { test } from "node:test";
import assert from "node:assert/strict";
import { clampZoom, fitZoom, MAX_ZOOM, MIN_ZOOM, pinchZoom, stepZoom } from "../src/viewport";

test(`le zoom est borne et arrondi`, () => {
  assert.equal(clampZoom(0), MIN_ZOOM);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(NaN), 1);
  assert.equal(clampZoom(1.23456), 1.235);
});

test(`ajuster la page calcule le zoom qui la fait entrer avec une marge`, () => {
  assert.equal(fitZoom(800, 1000, 832, 532), 0.5);
  assert.equal(fitZoom(1000, 500, 532, 1032), 0.5);
  assert.equal(fitZoom(800, 1000, 0, 0), 1);
  assert.equal(fitZoom(800, 1000, 20, 20), 1);
  assert.equal(fitZoom(0, 0, 500, 500), 1);
});

test(`un cran de zoom avant puis arriere revient presque au meme zoom`, () => {
  const up = stepZoom(1, 1);
  assert.equal(up, 1.25);
  assert.ok(Math.abs(stepZoom(up, -1) - 1) < 0.001);
  assert.equal(stepZoom(MAX_ZOOM, 1), MAX_ZOOM);
  assert.equal(stepZoom(MIN_ZOOM, -1), MIN_ZOOM);
});

test(`le pincement suit la distance entre les doigts`, () => {
  assert.equal(pinchZoom(1, 100, 200), 2);
  assert.equal(pinchZoom(1, 100, 50), 0.5);
  assert.equal(pinchZoom(1, 0, 50), 1);
  assert.equal(pinchZoom(3, 100, 300), MAX_ZOOM);
});
