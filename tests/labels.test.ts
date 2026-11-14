import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, SketchElement } from "../src/elements";
import { labelBox, labelColor, labelLayout, LabeledShape } from "../src/labels";
import { wrapLines } from "../src/text-layout";

// Ten units for every character.
const m = (line: string): number => line.length * 10;
const m3 = (line: string, _font: string, _size: number): number => line.length * 10;

test(`le texte passe a la ligne a la largeur donnee, mot entier quand c'est possible`, () => {
  assert.deepEqual(wrapLines(`un deux trois quatre`, 80, m), [`un deux`, `trois`, `quatre`]);
  assert.deepEqual(wrapLines(`un deux trois quatre`, 1000, m), [`un deux trois quatre`]);
  assert.deepEqual(wrapLines(`ab\n\ncd`, 1000, m), [`ab`, ``, `cd`]);
  assert.deepEqual(wrapLines(``, 100, m), [``]);
  assert.deepEqual(wrapLines(`a\n`, 100, m), [`a`, ``]);
});

test(`un mot plus large que la zone est coupe entre ses lettres, sans boucle infinie`, () => {
  assert.deepEqual(wrapLines(`abcdefghij`, 40, m), [`abcd`, `efgh`, `ij`]);
  assert.deepEqual(wrapLines(`ab abcdefghij cd`, 40, m), [`ab`, `abcd`, `efgh`, `ij`, `cd`]);
  // A width smaller than a letter still gives one letter a line.
  assert.deepEqual(wrapLines(`abc`, 3, m), [`a`, `b`, `c`]);
  assert.deepEqual(wrapLines(`a  b`, 100, m), [`a  b`]);
  const long = wrapLines(`x `.repeat(500), 25, m);
  assert.ok(long.length > 100 && long.every((l) => l.length <= 2));
});

const rect: LabeledShape = { id: `r`, type: `rect`, x: 0, y: 0, width: 200, height: 100, stroke: `#000000`, strokeWidth: 4 };
const ellipse: LabeledShape = { id: `e`, type: `ellipse`, cx: 100, cy: 50, rx: 100, ry: 50, stroke: `#000000`, strokeWidth: 4 };
const diamond: LabeledShape = { id: `d`, type: `diamond`, x: 0, y: 0, width: 200, height: 100, stroke: `#000000`, strokeWidth: 4 };

test(`la zone du texte est l'interieur de la forme`, () => {
  assert.deepEqual(labelBox(rect), { x: 10, y: 10, w: 180, h: 80 });
  const e = labelBox(ellipse);
  assert.ok(Math.abs(e.w - 141.42) < 0.1 && Math.abs(e.h - 70.71) < 0.1);
  assert.ok(Math.abs(e.x + e.w / 2 - 100) < 1e-9 && Math.abs(e.y + e.h / 2 - 50) < 1e-9);
  assert.deepEqual(labelBox(diamond), { x: 50, y: 25, w: 100, h: 50 });
  // A tiny shape still has a room to write in.
  const tiny = labelBox({ ...rect, width: 6, height: 6 });
  assert.ok(tiny.w >= 8 && tiny.h >= 8);
});

test(`la couleur du texte suit le fond : noir sur clair, blanc sur sombre, l'encre sans remplissage`, () => {
  assert.equal(labelColor(rect, `#000000`), `#000000`);
  assert.equal(labelColor(rect, `#ffffff`), `#ffffff`);
  assert.equal(labelColor({ ...rect, fill: `#ffffff` }, `#ffffff`), `#000000`);
  assert.equal(labelColor({ ...rect, fill: `#d69e2e` }, `#000000`), `#000000`);
  assert.equal(labelColor({ ...rect, fill: `#000000` }, `#000000`), `#ffffff`);
  assert.equal(labelColor({ ...rect, fill: `#2b6cb0` }, `#000000`), `#ffffff`);
  // A mostly transparent fill lets the background show: the ink is used.
  assert.equal(labelColor({ ...rect, fill: `#000000`, fillOpacity: 0.3 }, `#000000`), `#000000`);
  assert.equal(labelColor({ ...rect, fill: `#000000`, fillOpacity: 0.3 }, `#ffffff`), `#ffffff`);
  assert.equal(labelColor(rect, `red`), `#000000`);
});

test(`le texte d'une forme est centre en hauteur et ancre selon l'alignement`, () => {
  const label = { text: `un deux trois`, font: `caveat`, size: 20 };
  const l = labelLayout(rect, label, m3);
  // The room is 180 wide: 18 characters. The text holds on one line, centred in the 80 high room.
  assert.deepEqual(l.lines, [`un deux trois`]);
  assert.equal(l.lineHeight, 25);
  assert.equal(l.top, 10 + (80 - 25) / 2);
  assert.equal(l.anchorX, 100);
  assert.equal(labelLayout(rect, { ...label, align: `left` }, m3).anchorX, 10);
  assert.equal(labelLayout(rect, { ...label, align: `right` }, m3).anchorX, 190);
  const narrow = labelLayout({ ...rect, width: 70 }, label, m3);
  assert.ok(narrow.lines.length > 1);
});

test(`le texte d'une forme et la zone de texte se lisent dans un fichier strictement`, () => {
  const label = { text: `Bonjour`, font: `caveat`, size: 32, align: `left` };
  const ok = readElements([{ ...rect, label }, { ...ellipse, label: { text: `x`, font: `caveat`, size: 20 } }, { id: `t`, type: `text`, x: 0, y: 0, width: 80, height: 40, text: `Zone`, font: `caveat`, size: 20, stroke: `#000000`, zone: true }]);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual((ok.elements[0] as unknown as { label: unknown }).label, label);
    assert.equal((ok.elements[2] as unknown as { zone?: boolean }).zone, true);
  }
  for (const bad of [{ text: `` }, { text: 3 }, { font: `Caveat` }, { size: 1 }, { size: 999 }, { align: `justify` }, 5, null]) {
    const el = typeof bad === `object` && bad !== null ? { ...rect, label: { ...label, ...bad } } : { ...rect, label: bad };
    assert.equal(readElements([el as unknown as SketchElement]).ok, false, JSON.stringify(bad));
  }
  assert.equal(readElements([{ id: `t`, type: `text`, x: 0, y: 0, width: 80, height: 40, text: `Zone`, font: `caveat`, size: 20, stroke: `#000000`, zone: `oui` }]).ok, false);
  // A line cannot have a label: the field is dropped.
  const line = readElements([{ id: `l`, type: `line`, points: [[0, 0], [1, 1]], stroke: `#000000`, strokeWidth: 3, label }]);
  assert.equal(line.ok && `label` in line.elements[0], false);
});
