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
  // A pen stroke cannot have a label: the field is dropped.
  const pen = readElements([{ id: `l`, type: `freedraw`, points: [[0, 0], [1, 1]], stroke: `#000000`, strokeWidth: 3, label }]);
  assert.equal(pen.ok && `label` in pen.elements[0], false);
});

// ---------------------------------------------------------------------------------------------------------- the text of a line

import { LINE_LABEL_PAD, lineLabelLayout, pathMiddle } from "../src/labels";
import { refitText } from "../src/text-layout";
import { zoneElement, zoneFontSize } from "../src/tools";
import { defaultStyle } from "../src/style";
import type { LineElement, TextElement } from "../src/elements";

test(`le milieu d'un trait est le milieu de son chemin, pas celui de ses points`, () => {
  const straight: LineElement = { id: `l`, type: `line`, points: [[0, 0], [100, 0]], stroke: `#000000`, strokeWidth: 3 };
  assert.deepEqual(pathMiddle(straight).point, [50, 0]);
  // Two segments of 30 and 70: the middle is at 50 along the path, on the second segment.
  const bent: LineElement = { ...straight, points: [[0, 0], [30, 0], [30, 70]] };
  assert.deepEqual(pathMiddle(bent).point, [30, 20]);
  assert.equal(Math.round(pathMiddle(bent).angle), 90);
  const point: LineElement = { ...straight, points: [[5, 5], [5, 5]] };
  assert.deepEqual(pathMiddle(point).point, [5, 5]);
});

test(`le texte d'un trait est centre sur son milieu et la boite decoupee l'entoure`, () => {
  const line: LineElement = { id: `l`, type: `line`, points: [[0, 100], [200, 100]], stroke: `#000000`, strokeWidth: 3 };
  const l = lineLabelLayout(line, { text: `Bonjour\nle monde`, font: `caveat`, size: 20 }, m3);
  assert.deepEqual(l.lines, [`Bonjour`, `le monde`]);
  // The widest line has 8 characters: 80 units, centred on x = 100; the two lines make 50 units, centred on y = 100.
  assert.deepEqual(l.cut, { x: 100 - 40 - LINE_LABEL_PAD, y: 100 - 25 - LINE_LABEL_PAD, w: 80 + 2 * LINE_LABEL_PAD, h: 50 + 2 * LINE_LABEL_PAD });
  assert.equal(l.top, 75);
  assert.equal(l.anchorX, 100);
  assert.equal(lineLabelLayout(line, { text: `abc`, font: `caveat`, size: 20, align: `left` }, m3).anchorX, 100 - 15);
  assert.equal(lineLabelLayout(line, { text: `abc`, font: `caveat`, size: 20, align: `right` }, m3).anchorX, 100 + 15);
});

test(`le texte d'un trait ou d'une fleche se lit dans un fichier, pas celui d'un trace au stylo`, () => {
  const label = { text: `Oui`, font: `caveat`, size: 24 };
  const out = readElements([
    { id: `l`, type: `line`, points: [[0, 0], [9, 9]], stroke: `#000000`, strokeWidth: 3, label },
    { id: `a`, type: `arrow`, points: [[0, 0], [9, 9]], stroke: `#000000`, strokeWidth: 3, label },
    { id: `f`, type: `freedraw`, points: [[0, 0], [9, 9]], stroke: `#000000`, strokeWidth: 3, label },
  ]);
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.deepEqual((out.elements[0] as unknown as { label: unknown }).label, label);
    assert.deepEqual((out.elements[1] as unknown as { label: unknown }).label, label);
    assert.equal(`label` in out.elements[2], false);
  }
  assert.equal(readElements([{ id: `l`, type: `line`, points: [[0, 0], [9, 9]], stroke: `#000000`, strokeWidth: 3, label: { ...label, size: 1 } }]).ok, false);
});

// ---------------------------------------------------------------------------------------------------------- the text zone

const zone: TextElement = { id: `z`, type: `text`, x: 0, y: 0, width: 80, height: 25, text: `un deux trois quatre`, font: `caveat`, size: 20, stroke: `#000000`, zone: true };

test(`la hauteur d'une zone de texte suit ses lignes : elle grandit quand le texte passe a la ligne`, () => {
  // 80 units hold 8 characters: "un deux" then "trois" then "quatre": three lines of 25.
  const fitted = refitText(zone, m3);
  assert.equal(fitted.height, 75);
  assert.equal(fitted.width, 80);
  assert.equal(fitted.size, 20);
  assert.equal(refitText({ ...zone, width: 400 }, m3).height, 25);
  assert.equal(refitText({ ...zone, text: `` }, m3).height, 25);
  assert.equal(refitText({ ...zone, width: 20 }, m3).height > 75, true);
});

test(`la hauteur de la boite tracee donne la taille des lettres`, () => {
  assert.equal(zoneFontSize(50), 40);
  assert.equal(zoneFontSize(25), 20);
  assert.equal(zoneFontSize(1), 6);
  assert.equal(zoneFontSize(100000), 400);
  const z = zoneElement({ x: 10, y: 20, w: 200, h: 62.5 }, `Salut`, { ...defaultStyle(`#c0392b`), fontSize: 99 }, `n`);
  assert.deepEqual([z.size, z.width, z.height, z.zone, z.stroke], [50, 200, 62.5, true, `#c0392b`]);
});

test(`le texte d'une forme reste loin des lignes de sa bordure, y compris celles de l'interieur`, () => {
  const plain = labelBox(rect);
  const mat = labelBox({ ...rect, border: `mat` });
  const reverse = labelBox({ ...rect, border: `double-reverse` });
  const frame = labelBox({ ...rect, border: `frame` });
  for (const b of [mat, reverse, frame]) assert.ok(b.w < plain.w && b.h < plain.h, `smaller than the plain room`);
  // The shapes that are not rectangles keep the same margin on every side.
  const e = labelBox({ ...ellipse, border: `mat` });
  assert.ok(e.w < labelBox(ellipse).w && e.h < labelBox(ellipse).h);
  const rough = labelBox({ ...rect, roughness: 5 });
  assert.ok(rough.w < plain.w, `the wobble of the hand drawn look needs room too`);
  // A border cannot take the whole shape.
  assert.ok(labelBox({ ...rect, width: 40, height: 40, border: `mat`, strokeWidth: 12 }).w >= 8);
});
