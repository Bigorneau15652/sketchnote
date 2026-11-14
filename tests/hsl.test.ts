import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToHsl, hexToRgb, hslToHex, hsToWheel, luminanceToSlider, normalizeHex, rgbToHex, rgbToHsl, sliderToLuminance, wheelToHs } from "../src/hsl";

test(`une couleur hexadecimale est lue avec ou sans diese, en 3, 6 ou 8 chiffres`, () => {
  assert.deepEqual(hexToRgb(`#ff8000`), [255, 128, 0]);
  assert.deepEqual(hexToRgb(`FF8000`), [255, 128, 0]);
  assert.deepEqual(hexToRgb(`#f80`), [255, 136, 0]);
  assert.deepEqual(hexToRgb(` #ff800080 `), [255, 128, 0]);
  for (const bad of [``, `#`, `#ff`, `#ff80`, `#gg0000`, `rgb(1,2,3)`, `#ff80000`, `red`, `javascript:1`]) assert.equal(hexToRgb(bad), null, bad);
  assert.equal(normalizeHex(`ABC`), `#aabbcc`);
  assert.equal(normalizeHex(`zzz`), null);
  assert.equal(rgbToHex([300, -5, 12.4]), `#ff000c`);
});

test(`le passage entre rouge vert bleu et teinte saturation luminance est reversible`, () => {
  assert.deepEqual(rgbToHsl([255, 0, 0]), { h: 0, s: 100, l: 50 });
  assert.deepEqual(rgbToHsl([0, 255, 0]), { h: 120, s: 100, l: 50 });
  assert.deepEqual(rgbToHsl([0, 0, 255]), { h: 240, s: 100, l: 50 });
  assert.deepEqual(rgbToHsl([255, 255, 255]), { h: 0, s: 0, l: 100 });
  assert.deepEqual(rgbToHsl([0, 0, 0]), { h: 0, s: 0, l: 0 });
  for (const hex of [`#c0392b`, `#2b6cb0`, `#2f855a`, `#d69e2e`, `#123456`, `#fedcba`, `#808080`, `#ffffff`, `#000000`]) assert.equal(hslToHex(hexToHsl(hex)), hex, hex);
  assert.equal(hslToHex({ h: 360, s: 100, l: 50 }), `#ff0000`);
  assert.equal(hslToHex({ h: -120, s: 100, l: 50 }), `#0000ff`);
  assert.equal(hslToHex({ h: 120, s: 500, l: 500 }), `#ffffff`);
});

test(`le cercle chromatique donne la teinte par l'angle et la saturation par la distance`, () => {
  // Red on the right, yellow towards the top right, green towards the top left, cyan on the left, blue towards the bottom left.
  assert.deepEqual(wheelToHs(50, 0, 100), { h: 0, s: 50 });
  assert.equal(Math.round(wheelToHs(0, -100, 100).h), 90);
  assert.equal(Math.round(wheelToHs(-100, 0, 100).h), 180);
  assert.equal(Math.round(wheelToHs(0, 100, 100).h), 270);
  assert.equal(wheelToHs(0, 0, 100).s, 0);
  assert.equal(wheelToHs(500, 0, 100).s, 100);
  assert.equal(wheelToHs(1, 1, 0).s, 0);
  for (const [h, s] of [[0, 100], [45, 30], [200, 80], [300, 5]]) {
    const [dx, dy] = hsToWheel(h, s, 120);
    const back = wheelToHs(dx, dy, 120);
    assert.ok(Math.abs(back.h - h) < 1e-6 || s < 1, `hue ${h}`);
    assert.ok(Math.abs(back.s - s) < 1e-6, `sat ${s}`);
  }
});

test(`le curseur de luminance va de -100 a 100 avec 0 pour la couleur pure`, () => {
  assert.equal(sliderToLuminance(0), 50);
  assert.equal(sliderToLuminance(-100), 0);
  assert.equal(sliderToLuminance(100), 100);
  assert.equal(sliderToLuminance(999), 100);
  assert.equal(luminanceToSlider(50), 0);
  assert.equal(luminanceToSlider(0), -100);
  assert.equal(luminanceToSlider(75), 50);
});
