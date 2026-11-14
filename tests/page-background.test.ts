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
  assert.deepEqual(craft.overlay, []);
  assert.equal(craft.fill, STYLE_DEFAULTS.craft.background);
  assert.equal(board.fill, STYLE_DEFAULTS.chalkboard.background);
  assert.deepEqual(backgroundSpec(pageWith(`craft`)), craft);
});

test(`chaque forme du motif n'a que des nombres finis ou des couleurs #hex`, () => {
  for (const pattern of PATTERNS) {
    const spec = backgroundSpec(pageWith(pattern));
    for (const shape of [...spec.shapes, ...spec.overlay]) {
      for (const [name, value] of Object.entries(shape.attrs)) {
        assert.ok(/^[a-z][a-z0-9-]*$/.test(name), name);
        if (typeof value === `number`) assert.ok(Number.isFinite(value), `${pattern} ${name}`);
        else if (name === `transform`) assert.ok(/^rotate\(-?[\d.]+ -?[\d.]+ -?[\d.]+\)$/.test(value), `${pattern} ${value}`);
        else assert.ok(/^#[0-9a-f]{6}$/i.test(value), `${pattern} ${name} ${value}`);
      }
    }
  }
});

test(`le tableau noir est un grain fin, de larges traces tres douces et des bords assombris`, () => {
  const spec = backgroundSpec({ ...pageWith(`chalkboard`), width: 800, height: 1100 });
  // The repeating tile holds only tiny specks: nothing that could show as a repeated blotch.
  assert.ok(spec.shapes.length >= 100);
  for (const s of spec.shapes) {
    assert.equal(s.tag, `circle`);
    assert.ok(Number(s.attrs.r) <= 1.1);
    assert.ok(Number(s.attrs[`fill-opacity`]) <= 0.2);
  }
  // The soft marks are drawn once over the page with named gradients, and every name used exists.
  const names = new Set(spec.gradients.map((g) => g.name));
  assert.ok(spec.overlay.length >= 2);
  for (const s of spec.overlay) assert.ok(s.gradient !== undefined && names.has(s.gradient));
  for (const g of spec.gradients) {
    for (const stop of g.stops) assert.ok(stop.opacity >= 0 && stop.opacity <= 0.35 && stop.offset >= 0 && stop.offset <= 1);
    assert.equal(g.stops[g.stops.length - 1].offset, 1);
  }
});

test(`le tableau noir est identique a chaque dessin et suit la taille de la page`, () => {
  const a = backgroundSpec({ ...pageWith(`chalkboard`), width: 800, height: 1100 });
  assert.deepEqual(backgroundSpec({ ...pageWith(`chalkboard`), width: 800, height: 1100 }), a);
  const b = backgroundSpec({ ...pageWith(`chalkboard`), width: 1100, height: 800 });
  assert.notDeepEqual(a.overlay, b.overlay);
});
