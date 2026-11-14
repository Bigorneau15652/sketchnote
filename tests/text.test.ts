import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, SketchElement, TextElement } from "../src/elements";
import { cssFamily, fontStack, userFontId } from "../src/fonts";
import { layoutText, lineMiddle, refitText, textLines } from "../src/text-layout";
import { applyStyle, defaultStyle, styleOf, TEXT_SIZES } from "../src/style";
import { textElement } from "../src/tools";
import { boxOf, hitElement } from "../src/geometry";
import { resizeElement, scaleAbout } from "../src/transform";

// A measure that gives ten units to every character, whatever the font.
const measure = (line: string, _font?: string, _size?: number): number => line.length * 10;

const text: TextElement = { id: `t1`, type: `text`, x: 10, y: 20, width: 50, height: 40, text: `Salut\nle monde`, font: `caveat`, size: 32, stroke: `#000000` };

test(`un texte est relu avec ses champs et le reste est refuse`, () => {
  const ok = readElements([text]);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.elements[0], text);
  const aligned = readElements([{ ...text, align: `center`, angle: 30 }]);
  assert.equal(aligned.ok && (aligned.elements[0] as TextElement).align, `center`);
  for (const bad of [{ ...text, text: `` }, { ...text, text: 5 }, { ...text, font: `Caveat` }, { ...text, font: `a b` }, { ...text, size: 2 }, { ...text, size: 9999 }, { ...text, align: `justify` }, { ...text, stroke: `red` }, { ...text, width: 0 }, { ...text, text: `x`.repeat(5001) }]) {
    assert.equal(readElements([bad]).ok, false);
  }
  const extra = readElements([{ ...text, onclick: `x` }]);
  assert.equal(extra.ok && `onclick` in extra.elements[0], false);
});

test(`les lignes d'un texte et sa boite`, () => {
  assert.deepEqual(textLines(`a\r\nb\nc`), [`a`, `b`, `c`]);
  assert.deepEqual(textLines(`a\n`), [`a`, ``]);
  const box = layoutText(`ab\nabcd`, 20, (l) => l.length * 10);
  assert.equal(box.width, 40);
  assert.equal(box.height, 50);
  assert.ok(layoutText(``, 20, () => 0).width > 0);
  assert.equal(lineMiddle(1, 20), 37.5);
});

test(`un nouveau texte prend le style choisi et la taille mesuree`, () => {
  const style = { ...defaultStyle(`#c0392b`), font: `patrick-hand`, fontSize: TEXT_SIZES.large, align: `center` as const };
  const made = textElement([100, 50], `Bonjour`, style, `t2`, measure);
  assert.equal(made.stroke, `#c0392b`);
  assert.equal(made.font, `patrick-hand`);
  assert.equal(made.size, 52);
  assert.equal(made.align, `center`);
  assert.equal(made.width, 70);
  assert.equal(made.height, 65);
});

test(`le style d'un texte se lit et s'applique, la boite est remesuree a part`, () => {
  const s = styleOf(text);
  assert.equal(s?.font, `caveat`);
  assert.equal(s?.fontSize, 32);
  const next = applyStyle(text, { font: `gloria-hallelujah`, fontSize: 52, align: `right`, stroke: `#2b6cb0`, strokeWidth: 9 }) as TextElement;
  assert.equal(next.font, `gloria-hallelujah`);
  assert.equal(next.size, 52);
  assert.equal(next.align, `right`);
  assert.equal(next.stroke, `#2b6cb0`);
  assert.equal(`strokeWidth` in next, false);
  assert.equal((applyStyle(next, { align: `left` }) as TextElement).align, undefined);
  const refit = refitText(next, measure);
  assert.equal(refit.width, 80);
  assert.equal(refit.height, 130);
  assert.equal(applyStyle(text, { font: `Not valid!` } as never).type, `text`);
  assert.equal((applyStyle(text, { font: `Not valid!` } as never) as TextElement).font, `caveat`);
});

test(`un texte se touche dans sa boite, a le cadre d'un rectangle et grandit comme une image`, () => {
  assert.deepEqual(boxOf(text).box, { x: 10, y: 20, w: 50, h: 40 });
  assert.equal(hitElement(text, [30, 40], 2), true);
  assert.equal(hitElement(text, [200, 40], 2), false);
  const bigger = resizeElement(text, 2, [110, 120], false) as TextElement;
  assert.ok(bigger.size > text.size);
  assert.ok(Math.abs(bigger.width / bigger.height - text.width / text.height) < 0.01);
  const scaled = scaleAbout(text, [0, 0], 2) as TextElement;
  assert.equal(scaled.size, 64);
  assert.equal(scaled.width, 100);
});

test(`les polices ont une famille CSS simple et un identifiant sans accent`, () => {
  assert.equal(cssFamily(`caveat`), `sk-caveat`);
  assert.equal(fontStack(`caveat`), `sk-caveat, cursive`);
  assert.equal(userFontId(`Écriture d'Élève 2`), `u-ecriture-d-eleve-2`);
  assert.equal(userFontId(`!!!`), `u-police`);
  const all: SketchElement[] = [text];
  assert.equal(all.length, 1);
});
