import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDoc, PATTERNS, PageSettings, Pattern } from "../src/file-format";
import { backgroundSpec, brightness, guideStyle, parseHex, toHex6 } from "../src/page-background";
import { STYLE_DEFAULTS } from "../src/page-settings";

// Returns a page with a given style and its default colours.
function pageWith(pattern: Pattern): PageSettings {
  return { ...createEmptyDoc().page, pattern, ...STYLE_DEFAULTS[pattern] };
}

test(`les couleurs #rgb, #rrggbb et #rrggbbaa sont lues et le reste est refuse`, () => {
  assert.deepEqual(parseHex(`#fff`), [255, 255, 255]);
  assert.deepEqual(parseHex(`#c8a678`), [200, 166, 120]);
  assert.deepEqual(parseHex(`#10203040`), [16, 32, 48]);
  for (const bad of [`red`, `#12`, `#ggg`, `rgb(0,0,0)`, ``]) assert.equal(parseHex(bad), null, bad);
  assert.equal(toHex6(`#abc`), `#aabbcc`);
  assert.equal(toHex6(`#11223344`), `#112233`);
  assert.equal(toHex6(`n'importe quoi`), `#000000`);
});

test(`la luminosite choisit des guides bleus sur fond clair et blancs sur fond sombre`, () => {
  assert.ok(brightness(`#ffffff`) > 0.9);
  assert.ok(brightness(`#2f3b36`) < 0.3);
  assert.equal(guideStyle(`#ffffff`).color, `#6f9bd1`);
  assert.equal(guideStyle(`#2f3b36`).color, `#ffffff`);
});

test(`la page blanche n'a pas de motif`, () => {
  const spec = backgroundSpec(pageWith(`blank`));
  assert.equal(spec.tile, null);
  assert.deepEqual(spec.shapes, []);
  assert.equal(spec.fill, `#ffffff`);
});

test(`lignes, quadrillage et points ont un motif de 32 pixels`, () => {
  assert.equal(backgroundSpec(pageWith(`lines`)).shapes.length, 1);
  assert.equal(backgroundSpec(pageWith(`grid`)).shapes.length, 2);
  const dots = backgroundSpec(pageWith(`dots`));
  assert.equal(dots.tile, 32);
  assert.equal(dots.shapes[0].tag, `circle`);
});

test(`le papier craft et le tableau noir ont un motif fixe et leur propre couleur`, () => {
  const craft = backgroundSpec(pageWith(`craft`));
  const board = backgroundSpec(pageWith(`chalkboard`));
  assert.ok(craft.shapes.length > 0 && board.shapes.length > 0);
  assert.equal(craft.fill, STYLE_DEFAULTS.craft.background);
  assert.equal(board.fill, STYLE_DEFAULTS.chalkboard.background);
  assert.deepEqual(backgroundSpec(pageWith(`craft`)), craft);
});

test(`chaque forme du motif n'a que des nombres finis ou des textes sans guillemet ni chevron`, () => {
  for (const pattern of PATTERNS) {
    const spec = backgroundSpec(pageWith(pattern));
    for (const shape of spec.shapes) {
      for (const [name, value] of Object.entries(shape.attrs)) {
        assert.ok(/^[a-z][a-z0-9-]*$/.test(name), name);
        if (typeof value === `number`) assert.ok(Number.isFinite(value), `${pattern} ${name}`);
        else assert.ok(/^#[0-9a-f]{6}$/i.test(value), `${pattern} ${name} ${value}`);
      }
    }
  }
});
