import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync, inflateSync } from "node:zlib";
import { canBeTransparent, DEFAULT_JPEG_QUALITY, EXPORT_TARGETS, isHexColor, JPEG_QUALITIES, elementsBox, EXPORT_MARGIN, EXPORT_MAX_PIXELS, EXPORT_MAX_SIDE, exportFileName, fitSize, fontFaceCss, isExportFormat, pluginFamilies, toBase64 } from "../src/export-plan";
import { buildPdf } from "../src/pdf-writer";
import { readElements, SketchElement } from "../src/elements";
import { readSettings, DEFAULT_SETTINGS } from "../src/settings";

const read = (list: unknown[]): SketchElement[] => (readElements(list) as { ok: true; elements: SketchElement[] }).elements;
const rect = (extra: Record<string, unknown> = {}): unknown => ({ id: `r`, type: `rect`, x: 100, y: 50, width: 200, height: 100, stroke: `#000000`, strokeWidth: 4, seed: 1, ...extra });

test(`la boite d'un export entoure les elements avec le trait, l'ombre, le reflet et une marge, et rien ne donne rien`, () => {
  assert.equal(elementsBox([]), null);
  const plain = elementsBox(read([rect()]), 0);
  assert.ok(plain && plain.x < 100 && plain.x > 90 && plain.w > 200 && plain.h > 100, JSON.stringify(plain));
  const margin = elementsBox(read([rect()]));
  assert.ok(margin && plain && Math.abs(margin.w - plain.w - 2 * EXPORT_MARGIN) < 1e-9);
  const shadow = elementsBox(read([rect({ shadow: { x: 10, y: 10, blur: 8, color: `#000000`, opacity: 0.5 } })]), 0);
  assert.ok(shadow && plain && shadow.w > plain.w + 20 && shadow.h > plain.h + 20, `l'ombre agrandit la boite`);
  const mirror = elementsBox(read([rect({ reflection: true })]), 0);
  assert.ok(mirror && plain && mirror.h > plain.h + 40 && mirror.w === plain.w, `le reflet agrandit la boite vers le bas`);
  const two = elementsBox(read([rect(), rect({ id: `s`, x: 600, y: 400 })]), 0);
  assert.ok(two && two.x < 100 && two.x + two.w > 800 && two.y + two.h > 500);
});

test(`la taille d'une image exportee est limitee pour que le navigateur tienne`, () => {
  const normal = fitSize(400, 300, 2);
  assert.deepEqual([normal.width, normal.height, normal.reduced], [800, 600, false]);
  const big = fitSize(6000, 4000, 4);
  assert.equal(big.reduced, true);
  assert.ok(big.width <= EXPORT_MAX_SIDE && big.height <= EXPORT_MAX_SIDE && big.width * big.height <= EXPORT_MAX_PIXELS * 1.001, `${big.width} x ${big.height}`);
  assert.ok(Math.abs(big.width / big.height - 1.5) < 0.01, `les proportions sont gardees`);
  assert.deepEqual([fitSize(0, 0, 1).width, fitSize(10, 10, NaN).width, fitSize(10, 10, -3).width], [1, 10, 10]);
  const long = fitSize(100000, 100, 1);
  assert.ok(long.width <= EXPORT_MAX_SIDE && long.reduced);
});

test(`le nom d'un export : la note, la partie, la date, l'extension, et jamais un nom deja pris`, () => {
  const now = new Date(2026, 10, 5, 9, 8, 7);
  assert.equal(exportFileName(`Ma page`, ``, `png`, now, new Set()), `Ma page 2026-11-05 09-08-07.png`);
  assert.equal(exportFileName(`Ma page`, `sélection`, `svg`, now, new Set()), `Ma page sélection 2026-11-05 09-08-07.svg`);
  assert.equal(exportFileName(`Ma page`, ``, `pdf`, now, new Set([`Ma page 2026-11-05 09-08-07.pdf`])), `Ma page 2026-11-05 09-08-07 2.pdf`);
  assert.equal(exportFileName(`a/b:c*?`, ``, `png`, now, new Set()), `abc 2026-11-05 09-08-07.png`);
  assert.equal(isExportFormat(`png`) && isExportFormat(`pdf`) && !isExportFormat(`exe`) && !isExportFormat(5), true);
});

test(`les polices ecrites dans un SVG ne laissent passer que des declarations de police`, () => {
  assert.equal(toBase64(new Uint8Array([72, 105, 33])), `SGkh`);
  assert.equal(toBase64(new Uint8Array(100000)).length, Math.ceil(100000 / 3) * 4);
  const css = fontFaceCss([{ family: `sk-caveat`, mime: `font/woff2`, base64: `AAAA` }, { family: `sk-u-ma-police`, mime: `font/ttf`, base64: `QUJD` }]);
  assert.equal(css, `@font-face{font-family:sk-caveat;src:url(data:font/woff2;base64,AAAA);}\n@font-face{font-family:sk-u-ma-police;src:url(data:font/ttf;base64,QUJD);}`);
  for (const bad of [{ family: `a;}body{x`, mime: `font/ttf`, base64: `AA` }, { family: `sk-a`, mime: `text/html`, base64: `AA` }, { family: `sk-a`, mime: `font/ttf`, base64: `A)}x{` }, { family: ``, mime: `font/ttf`, base64: `AA` }]) {
    assert.equal(fontFaceCss([bad]), ``, JSON.stringify(bad));
  }
  assert.deepEqual(pluginFamilies(`sk-caveat, cursive`), [`sk-caveat`]);
  assert.deepEqual(pluginFamilies(`Arial, sk-u-ma-police-2, sk-`), [`sk-u-ma-police-2`]);
});

test(`un PDF d'une page contient l'image, une table des emplacements juste et la taille de la page`, () => {
  // Two pixels, red and blue, in the zlib format as the browser gives it.
  const pixels = Uint8Array.from([255, 0, 0, 0, 0, 255]);
  const data = new Uint8Array(deflateSync(pixels));
  const pdf = buildPdf(2, 1, data, 150, 75, `Ma page (1)\\`);
  let text = ``;
  for (const b of pdf) text += String.fromCharCode(b);
  assert.ok(text.startsWith(`%PDF-1.4`) && text.endsWith(`%%EOF\n`));
  assert.ok(text.includes(`/MediaBox [0 0 150 75]`) && text.includes(`/Width 2 /Height 1`) && text.includes(`/Filter /FlateDecode`));
  assert.ok(text.includes(`/Title (Ma page 1)`), `les caractères qui casseraient le texte sont retires`);
  const start = Number(/startxref\n(\d+)\n%%EOF/.exec(text)?.[1]);
  assert.equal(text.slice(start, start + 4), `xref`);
  const offsets = [...text.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 6);
  offsets.forEach((o, i) => assert.ok(text.slice(o).startsWith(`${i + 1} 0 obj`), `objet ${i + 1}`));
  // The length of the stream is the one written, and its content is the pixels.
  const stream = /\/Length (\d+) >>\nstream\n/.exec(text.slice(offsets[4]));
  assert.equal(Number(stream?.[1]), data.length);
  const at = offsets[4] + (text.slice(offsets[4]).indexOf(`stream\n`) + 7);
  assert.deepEqual(Array.from(inflateSync(pdf.slice(at, at + data.length))), Array.from(pixels));
});

test(`le dossier des exports des reglages a une valeur par defaut et refuse un dossier invalide`, () => {
  assert.equal(DEFAULT_SETTINGS.exportsFolder, `Sketchnote exports`);
  assert.deepEqual(readSettings({ exportsFolder: `/Mes exports/` }), { ...DEFAULT_SETTINGS, exportsFolder: `Mes exports` });
  assert.deepEqual(readSettings({ exportsFolder: `../x` }), DEFAULT_SETTINGS);
});

test(`le JPG est un format d'export, la transparence ne va qu'au PNG et au SVG, et une couleur de fond est controlee`, () => {
  assert.ok(isExportFormat(`jpg`));
  assert.ok(!isExportFormat(`gif`));
  assert.deepEqual(EXPORT_TARGETS, [`printer`, `png`, `jpg`, `pdf`, `svg`]);
  assert.deepEqual([`png`, `svg`, `jpg`, `pdf`, `printer`].map((f) => canBeTransparent(f as never)), [true, true, false, false, false]);
  assert.ok(isHexColor(`#a1B2c3`));
  for (const bad of [`#fff`, `red`, `#12345g`, `url(x)`, 5, null]) assert.ok(!isHexColor(bad), String(bad));
  assert.ok(JPEG_QUALITIES.includes(DEFAULT_JPEG_QUALITY));
  assert.match(exportFileName(`Note`, ``, `jpg`, new Date(2026, 10, 22, 8, 5, 3), new Set()), /\.jpg$/);
});
