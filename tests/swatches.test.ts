import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDrawing, parseSketchdraw, serializeSketchdraw } from "../src/drawing-file";
import { defaultFillPalette, padPalette, readFillPalette, swatchBackground, swatchMatches } from "../src/swatches";

test(`le trait a toujours cinq pastilles, les manquantes etant les couleurs usuelles`, () => {
  const five = padPalette([`#111111`, `#222222`, `#333333`], `#000000`);
  assert.equal(five.length, 5);
  assert.deepEqual(five.slice(0, 3), [`#111111`, `#222222`, `#333333`]);
  assert.equal(new Set(five).size, 5);
  assert.equal(padPalette([`#111111`, `#222222`, `#333333`, `#444444`, `#555555`], `#000000`).length, 5);
  assert.equal(padPalette([`#ffffff`, `#f6ad55`, `#63b3ed`], `#ffffff`).length, 5);
});

test(`le remplissage commence par rouge, bleu, vert, noir et sans couleur`, () => {
  const p = defaultFillPalette(`#000000`);
  assert.equal(p.length, 5);
  assert.deepEqual(p.map((e) => e?.color), [`#c0392b`, `#2b6cb0`, `#2f855a`, `#000000`, undefined]);
  assert.equal(p[4], null);
  assert.ok(p.slice(0, 4).every((e) => e?.style === `solid`));
  // On a dark page the colours are light and the black one is white.
  assert.equal(defaultFillPalette(`#ffffff`)[3]?.color, `#ffffff`);
});

test(`les pastilles de remplissage sont relues avec strictement cinq entrees valides`, () => {
  const good = [{ color: `#ff0000`, style: `dots` }, null, { color: `#0f0`, style: `solid` }, { color: `#0000ff`, style: `grid` }, { color: `#000000`, style: `hachure` }];
  assert.deepEqual(readFillPalette(good), good);
  assert.equal(readFillPalette(undefined), undefined);
  for (const bad of [[], good.slice(0, 4), [...good, null], `x`, { 0: 1 }, [...good.slice(0, 4), { color: `red`, style: `solid` }], [...good.slice(0, 4), { color: `#000000`, style: `wavy` }], [...good.slice(0, 4), 5], [...good.slice(0, 4), [1]]]) {
    assert.equal(readFillPalette(bad), null, JSON.stringify(bad));
  }
  const copy = readFillPalette([...good.slice(0, 4), { color: `#000000`, style: `solid`, extra: 1 }]);
  assert.deepEqual(copy?.[4], { color: `#000000`, style: `solid` });
});

test(`une pastille montre sa couleur, son motif ou un trait rouge pour aucune couleur`, () => {
  assert.equal(swatchBackground({ color: `#ff0000`, style: `solid` }), `rgb(255, 0, 0)`);
  assert.ok(swatchBackground({ color: `#ff0000`, style: `hachure` }).includes(`repeating-linear-gradient(45deg`));
  assert.ok(swatchBackground({ color: `#ff0000`, style: `dots` }).includes(`radial-gradient`));
  assert.ok(swatchBackground({ color: `#ff0000`, style: `grid` }).split(`repeating-linear-gradient`).length === 3);
  const none = swatchBackground(null);
  assert.ok(none.includes(`#d9302c`) && none.includes(`#ffffff`));
  // Nothing but numbers and fixed words goes into the style.
  for (const style of [`solid`, `hachure`, `dots`, `grid`] as const) assert.ok(!/[;"'<>]/.test(swatchBackground({ color: `#abc`, style })));
});

test(`une pastille correspond au remplissage et au motif en cours`, () => {
  assert.equal(swatchMatches(null, null, `solid`), true);
  assert.equal(swatchMatches(null, `#ff0000`, `solid`), false);
  assert.equal(swatchMatches({ color: `#ff0000`, style: `solid` }, `#f00`, `solid`), true);
  assert.equal(swatchMatches({ color: `#ff0000`, style: `solid` }, `#f00`, `dots`), false);
  assert.equal(swatchMatches({ color: `#ff0000`, style: `dots` }, null, `dots`), false);
  assert.equal(swatchMatches({ color: `#ff0000`, style: `dots` }, `#ff0001`, `dots`), false);
});

test(`un dessin garde ses pastilles de remplissage et complete celles du trait`, () => {
  const doc = createEmptyDrawing(`#000000`, [`#111111`, `#222222`, `#333333`]);
  assert.equal(doc.palette.length, 5);
  assert.equal(`fillPalette` in doc, false);
  const withFill = { ...doc, fillPalette: defaultFillPalette(`#000000`) };
  const back = parseSketchdraw(serializeSketchdraw(withFill));
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(back.doc.fillPalette, withFill.fillPalette);
  // An old file with a palette of three colours is read with five.
  const old = parseSketchdraw(JSON.stringify({ format: `sketchdraw`, version: 1, ink: `#000000`, palette: [`#111111`, `#222222`, `#333333`], elements: [] }));
  assert.ok(old.ok && old.doc.palette.length === 5 && old.doc.fillPalette === undefined);
  const bad = parseSketchdraw(JSON.stringify({ format: `sketchdraw`, version: 1, ink: `#000000`, palette: [`#111111`, `#222222`, `#333333`], fillPalette: [null], elements: [] }));
  assert.equal(bad.ok, false);
});
