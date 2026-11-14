import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDrawing, contentBox, fitInFrame, guideBox, makeGuide, parseSketchdraw, renameReferences, serializeSketchdraw } from "../src/drawing-file";
import { SketchElement } from "../src/elements";
import { cleanName, DEFAULT_SETTINGS, normalizeFolder, readSettings, uniqueDrawingPath } from "../src/settings";
import { defaultPaletteFor, isPalette } from "../src/color";
import { setLanguage } from "../src/i18n";

setLanguage(`fr`);
const rect = (x: number, y: number, w: number, h: number): SketchElement => ({ id: `r${x}`, type: `rect`, x, y, width: w, height: h, stroke: `#000000`, strokeWidth: 4 });

test(`un dessin vide s'ecrit puis se relit a l'identique`, () => {
  const doc = createEmptyDrawing();
  const r = parseSketchdraw(serializeSketchdraw(doc));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.doc, doc);
});

test(`un dessin garde son encre blanche et sa palette`, () => {
  const doc = createEmptyDrawing(`#ffffff`);
  assert.equal(doc.palette[0], `#ffffff`);
  const r = parseSketchdraw(serializeSketchdraw({ ...doc, elements: [rect(0, 0, 10, 10)] }));
  assert.equal(r.ok && r.doc.elements.length, 1);
});

test(`un texte vide, invalide ou d'un autre format est refuse`, () => {
  for (const bad of [``, `  `, `{x`, `[]`, `null`, `{"format":"sketchnote"}`, `{"format":"sketchdraw","version":9}`]) assert.equal(parseSketchdraw(bad).ok, false, bad);
});

test(`une encre, une palette ou un element invalide refuse le fichier`, () => {
  const make = (patch: Record<string, unknown>): string => JSON.stringify({ ...createEmptyDrawing(), ...patch });
  assert.equal(parseSketchdraw(make({ ink: `black` })).ok, false);
  assert.equal(parseSketchdraw(make({ palette: [`#000000`, `#111111`] })).ok, false);
  assert.equal(parseSketchdraw(make({ palette: [`#000000`, `#111111`, `x`] })).ok, false);
  assert.equal(parseSketchdraw(make({ elements: [{ id: `a` }] })).ok, false);
});

test(`un dessin ne peut pas contenir de cadre de dessin`, () => {
  const frame = { id: `c`, type: `drawing`, x: 0, y: 0, width: 50, height: 50, path: null };
  assert.equal(parseSketchdraw(JSON.stringify({ ...createEmptyDrawing(), elements: [frame] })).ok, false);
});

test(`la boite du contenu englobe les elements avec la largeur des traits et une marge`, () => {
  assert.equal(contentBox(createEmptyDrawing()), null);
  const doc = { ...createEmptyDrawing(), elements: [rect(100, 100, 50, 40), rect(300, 200, 10, 10)] };
  const b = contentBox(doc, 8);
  assert.ok(b);
  if (b) {
    assert.equal(b.x, 100 - 2 - 8);
    assert.equal(b.y, 100 - 2 - 8);
    assert.equal(b.x + b.w, 310 + 2 + 8);
    assert.equal(b.y + b.h, 210 + 2 + 8);
  }
});

test(`un dessin s'ajuste a la largeur du cadre et donne sa hauteur`, () => {
  const fit = fitInFrame(50, 60, 200, { x: 100, y: 40, w: 400, h: 100 });
  assert.equal(fit.scale, 0.5);
  assert.equal(fit.height, 50);
  // The top left of the content box lands on the top left of the frame.
  assert.equal(100 * fit.scale + fit.tx, 50);
  assert.equal(40 * fit.scale + fit.ty, 60);
});

test(`les palettes valides ont de 3 a 5 couleurs`, () => {
  assert.equal(isPalette(defaultPaletteFor(`#000000`)), true);
  assert.equal(isPalette(defaultPaletteFor(`#ffffff`)), true);
  assert.equal(isPalette([`#000`, `#111`, `#222`, `#333`, `#444`, `#555`]), false);
  assert.equal(isPalette(`#000000`), false);
});

test(`un dossier est nettoye ou refuse`, () => {
  assert.equal(normalizeFolder(` Sketchnote/Dessins/ `), `Sketchnote/Dessins`);
  assert.equal(normalizeFolder(`a\\b`), `a/b`);
  assert.equal(normalizeFolder(`a//b`), `a/b`);
  for (const bad of [``, `   `, `/`, `../x`, `/../x`, `a/../b`, `a/./b`, `a:b`, `a*b`, `a|b`, `C:/x`, `x`.repeat(300), 5, null]) assert.equal(normalizeFolder(bad), null, String(bad));
  // A slash at the start means the root of the vault, as in the field of the settings.
  assert.equal(normalizeFolder(`/dessin`), `dessin`);
  assert.equal(normalizeFolder(`/Sketchnote/Dessins/`), `Sketchnote/Dessins`);
});

test(`les reglages invalides reprennent la valeur par defaut`, () => {
  assert.deepEqual(readSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings({ drawingsFolder: `../x` }), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings({ drawingsFolder: `Mes dessins` }), { drawingsFolder: `Mes dessins` });
});

test(`le nom d'un dessin est unique, sans caracteres interdits`, () => {
  assert.equal(cleanName(`a/b:c*d`), `abcd`);
  assert.equal(cleanName(`   `), `Sketchnote`);
  assert.equal(cleanName(`x`.repeat(100)).length, 60);
  assert.equal(uniqueDrawingPath(`D`, `Mon note`, new Set()), `D/Mon note - dessin 1.sketchdraw`);
  assert.equal(uniqueDrawingPath(`D`, `Mon note`, new Set([`D/Mon note - dessin 1.sketchdraw`, `d/mon note - dessin 2.sketchdraw`])), `D/Mon note - dessin 3.sketchdraw`);
});

test(`le renommage d'un dessin met a jour les cadres qui le montrent et rien d'autre`, () => {
  const frame = (id: string, path: string | null): Record<string, unknown> => ({ id, type: `drawing`, x: 0, y: 0, width: 50, height: 50, path });
  const other = { id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 2 };
  const text = JSON.stringify({ format: `sketchnote`, version: 1, elements: [frame(`a`, `D/x.sketchdraw`), frame(`b`, `D/y.sketchdraw`), frame(`c`, null), other] });
  const next = renameReferences(text, `D/x.sketchdraw`, `E/z.sketchdraw`);
  assert.ok(next);
  const doc = JSON.parse(next ?? `{}`) as { elements: { id: string; path?: string | null }[] };
  assert.equal(doc.elements[0].path, `E/z.sketchdraw`);
  assert.equal(doc.elements[1].path, `D/y.sketchdraw`);
  assert.equal(doc.elements[2].path, null);
  assert.equal(doc.elements[3].id, `r`);
  assert.equal(renameReferences(text, `D/inconnu.sketchdraw`, `E/z.sketchdraw`), null);
});

test(`le renommage ne touche jamais un fichier qu'il ne comprend pas`, () => {
  for (const bad of [``, `pas du json`, `[]`, `{"format":"autre","elements":[]}`, `{"format":"sketchnote"}`]) assert.equal(renameReferences(bad, `a.sketchdraw`, `b.sketchdraw`), null, bad);
});

test(`le guide a les proportions de la zone et tient dans la surface de dessin`, () => {
  const wide = makeGuide(400, 100, `rect`);
  assert.ok(wide && wide.width === 1000 && wide.height === 250 && wide.shape === `rect`);
  const tall = makeGuide(100, 400, `ellipse`);
  assert.ok(tall && tall.height === 640 && tall.width === 160 && tall.shape === `ellipse`);
  const oval = makeGuide(147.8, 99, `ellipse`);
  assert.ok(oval && Math.abs(oval.width / oval.height - 147.8 / 99) < 0.01);
  for (const bad of [0, -5, NaN, Infinity]) assert.equal(makeGuide(bad, 100, `rect`), null, String(bad));
  const box = guideBox({ shape: `rect`, width: 1000, height: 600 });
  assert.equal(box.x + box.w / 2, 1200);
  assert.equal(box.y + box.h / 2, 900);
});

test(`le guide d'un dessin s'ecrit, se relit et est controle`, () => {
  const doc = createEmptyDrawing(`#000000`, undefined, { shape: `ellipse`, width: 900, height: 600 });
  const r = parseSketchdraw(serializeSketchdraw(doc));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.doc.guide, { shape: `ellipse`, width: 900, height: 600 });
  assert.equal(`guide` in createEmptyDrawing(), false);
  for (const bad of [{ shape: `star`, width: 100, height: 100 }, { shape: `rect`, width: 5, height: 100 }, { shape: `rect`, width: 100, height: 99999 }, { shape: `rect`, width: `100`, height: 100 }, `x`, []]) {
    assert.equal(parseSketchdraw(JSON.stringify({ ...createEmptyDrawing(), guide: bad })).ok, false, JSON.stringify(bad));
  }
});
