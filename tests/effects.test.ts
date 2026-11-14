import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, SketchElement } from "../src/elements";
import { cleanOpacity, effectFields, kindOfShadow, shadowOf } from "../src/effects";
import { applyStyle, cleanPatch, defaultStyle, styleOf } from "../src/style";
import { elementFromDrag, textElement } from "../src/tools";
import { elementPaths } from "../src/shape-paths";
import type { StrokedElement } from "../src/elements";

const rect: SketchElement = { id: `r`, type: `rect`, x: 0, y: 0, width: 100, height: 60, stroke: `#000000`, strokeWidth: 4 };
const arrow: SketchElement = { id: `a`, type: `arrow`, points: [[0, 0], [100, 0]], stroke: `#000000`, strokeWidth: 3 };
const text: SketchElement = { id: `t`, type: `text`, x: 0, y: 0, width: 50, height: 40, text: `Salut`, font: `caveat`, size: 32, stroke: `#000000` };

test(`les ombres sont des reglages reconnus`, () => {
  assert.equal(shadowOf(`none`), undefined);
  assert.equal(kindOfShadow(shadowOf(`soft`)), `soft`);
  assert.equal(kindOfShadow(shadowOf(`strong`)), `strong`);
  assert.equal(kindOfShadow(shadowOf(`offset`)), `offset`);
  assert.equal(kindOfShadow(undefined), `none`);
  assert.equal(kindOfShadow({ x: 1, y: 1, blur: 1, color: `#000000`, opacity: 0.5 }), `custom`);
  assert.equal(cleanOpacity(0), 0.05);
  assert.equal(cleanOpacity(3), 1);
  assert.equal(cleanOpacity(0.456), 0.46);
});

test(`les effets, la bordure et le style de trait se lisent dans un fichier et le reste est refuse`, () => {
  const good = readElements([{ ...rect, opacity: 0.5, shadow: shadowOf(`soft`), flipX: true, reflection: true, border: `double`, radius: 20, lineStyle: `dashed` }]);
  assert.equal(good.ok, true);
  if (good.ok) {
    const el = good.elements[0] as unknown as Record<string, unknown>;
    assert.deepEqual([el.opacity, el.flipX, el.reflection, el.border, el.radius, el.lineStyle], [0.5, true, true, `double`, 20, `dashed`]);
  }
  for (const bad of [{ opacity: 0 }, { opacity: 2 }, { opacity: `1` }, { shadow: 1 }, { shadow: { x: 1, y: 1, blur: 1, color: `red`, opacity: 1 } }, { shadow: { x: 1, y: 1, blur: -1, color: `#000000`, opacity: 1 } }, { shadow: { x: 999, y: 1, blur: 1, color: `#000000`, opacity: 1 } }, { flipX: 1 }, { reflection: `oui` }, { border: `fancy` }, { radius: -1 }, { radius: 99999 }, { lineStyle: `wavy` }]) {
    assert.equal(readElements([{ ...rect, ...bad }]).ok, false, JSON.stringify(bad));
  }
  // Default values are not kept: a plain element stays short.
  const plain = readElements([{ ...rect, opacity: 1, flipX: false, radius: 0, lineStyle: `solid` }]);
  assert.equal(plain.ok && Object.keys(plain.elements[0]).includes(`opacity`), false);
  assert.equal(plain.ok && Object.keys(plain.elements[0]).includes(`flipX`), false);
  // A text and an arrow take the effects too, a text has no border.
  assert.equal(readElements([{ ...text, shadow: shadowOf(`strong`), opacity: 0.6 }]).ok, true);
  assert.equal(readElements([{ ...arrow, shadow: shadowOf(`offset`) }]).ok, true);
});

test(`les effets se posent et s'enlevent par le style, sur les formes comme sur le texte`, () => {
  const styled = applyStyle(rect, { opacity: 0.4, shadow: `soft`, reflection: true, border: `frame`, radius: 14, lineStyle: `dotted` }) as unknown as Record<string, unknown>;
  assert.deepEqual([styled.opacity, styled.reflection, styled.border, styled.radius, styled.lineStyle], [0.4, true, `frame`, 14, `dotted`]);
  assert.equal(kindOfShadow(styled.shadow as never), `soft`);
  const s = styleOf(styled as unknown as SketchElement);
  assert.deepEqual([s?.opacity, s?.shadow, s?.reflection, s?.border, s?.radius, s?.lineStyle], [0.4, `soft`, true, `frame`, 14, `dotted`]);
  const back = applyStyle(styled as unknown as SketchElement, { opacity: 1, shadow: `none`, reflection: false, border: `simple`, radius: 0, lineStyle: `solid` }) as unknown as Record<string, unknown>;
  for (const key of [`opacity`, `shadow`, `reflection`, `border`, `radius`, `lineStyle`]) assert.equal(key in back, false, key);
  // The original is not changed.
  assert.equal(`opacity` in rect, false);
  // A text takes the opacity and the shadow but no border; an arrow takes no border or corners.
  const t = applyStyle(text, { opacity: 0.5, shadow: `strong`, border: `double`, radius: 10 }) as unknown as Record<string, unknown>;
  assert.deepEqual([t.opacity, kindOfShadow(t.shadow as never), `border` in t, `radius` in t], [0.5, `strong`, false, false]);
  const a = applyStyle(arrow, { border: `double`, radius: 10, lineStyle: `dashed` }) as unknown as Record<string, unknown>;
  assert.deepEqual([`border` in a, `radius` in a, a.lineStyle], [false, false, `dashed`]);
  // Only a rectangle has corners.
  const ellipse: SketchElement = { id: `e`, type: `ellipse`, cx: 0, cy: 0, rx: 10, ry: 5, stroke: `#000000`, strokeWidth: 3 };
  assert.equal(`radius` in applyStyle(ellipse, { radius: 12, border: `double` }), false);
  assert.equal((applyStyle(ellipse, { border: `double` }) as unknown as { border: string }).border, `double`);
  // A pen stroke has no line style.
  const pen: SketchElement = { id: `p`, type: `freedraw`, points: [[0, 0], [1, 1]], stroke: `#000000`, strokeWidth: 3 };
  assert.equal(`lineStyle` in applyStyle(pen, { lineStyle: `dashed` }), false);
  assert.deepEqual(cleanPatch({ shadow: `weird` as never, border: `x` as never, lineStyle: `y` as never, opacity: NaN }), {});
});

test(`un nouvel element prend les effets du style et reste court sans effet`, () => {
  const style = { ...defaultStyle(`#000000`), opacity: 0.7, shadow: `offset` as const, reflection: true, lineStyle: `dashed` as const, border: `double` as const, radius: 40 };
  const made = elementFromDrag(`rect`, [0, 0], [100, 50], { shift: false, alt: false }, style, `r1`, 5) as unknown as Record<string, unknown>;
  assert.deepEqual([made.opacity, made.reflection, made.lineStyle, made.border, made.radius], [0.7, true, `dashed`, `double`, 40]);
  const circle = elementFromDrag(`ellipse`, [0, 0], [100, 50], { shift: false, alt: false }, style, `e1`, 5) as unknown as Record<string, unknown>;
  assert.equal(`radius` in circle, false);
  const plain = elementFromDrag(`rect`, [0, 0], [100, 50], { shift: false, alt: false }, defaultStyle(`#000000`), `r2`, 5) as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(plain).sort(), [`height`, `id`, `roughness`, `seed`, `stroke`, `strokeWidth`, `type`, `width`, `x`, `y`]);
  const t = textElement([0, 0], `Hi`, style, `t1`, () => 10);
  assert.equal(t.opacity, 0.7);
  assert.deepEqual(effectFields({ opacity: 1, shadow: `none`, reflection: false }), {});
});

test(`les bordures et les coins changent le dessin d'une forme`, () => {
  const base: StrokedElement = { ...(rect as StrokedElement), roughness: 0 } as StrokedElement;
  const count = (el: object): number => elementPaths(el as StrokedElement).pieces.filter((p) => p.outline === true).length;
  const simple = count(base);
  assert.ok(simple >= 1);
  assert.equal(count({ ...base, border: `double` }), simple * 2);
  assert.equal(count({ ...base, border: `double-reverse` }), simple * 2);
  assert.equal(count({ ...base, border: `frame` }), simple * 3);
  assert.equal(count({ ...base, border: `mat` }), simple * 2);
  assert.equal(count({ ...base, border: `none` }), 0);
  // Without a border the fill stays.
  const filled = elementPaths({ ...base, fill: `#ff0000`, fillStyle: `solid`, border: `none` } as StrokedElement).pieces;
  assert.ok(filled.length > 0 && filled.every((p) => p.outline !== true));
  // Rounded corners make a path of curves.
  const round = elementPaths({ ...base, radius: 20 } as StrokedElement).pieces;
  assert.ok(round.length > 0 && round.some((p) => p.d.includes(`C`)));
  // A dashed line gets a dash pattern on its outline only; a dotted one gets dots.
  const dashed = elementPaths({ ...base, lineStyle: `dashed`, fill: `#ff0000`, fillStyle: `hachure` } as StrokedElement).pieces;
  assert.ok(dashed.filter((p) => p.outline === true).every((p) => typeof p.dash === `string`));
  assert.ok(dashed.filter((p) => p.outline !== true).every((p) => p.dash === undefined));
  const dotted = elementPaths({ ...base, lineStyle: `dotted` } as StrokedElement).pieces;
  assert.ok(dotted.every((p) => p.dash !== undefined && p.dash.startsWith(`0.1`)));
  // A frame too small for its inner line leaves it out, and an ellipse and a diamond have borders too.
  const tiny = { ...base, width: 6, height: 6, border: `frame` } as StrokedElement;
  assert.ok(count(tiny) >= simple);
  const ellipse = { id: `e`, type: `ellipse`, cx: 50, cy: 30, rx: 40, ry: 20, stroke: `#000000`, strokeWidth: 4, roughness: 0, border: `double` } as StrokedElement;
  assert.equal(count(ellipse), 2 * count({ ...ellipse, border: undefined }));
  const diamond = { id: `d`, type: `diamond`, x: 0, y: 0, width: 80, height: 60, stroke: `#000000`, strokeWidth: 4, roughness: 0, border: `frame` } as StrokedElement;
  assert.equal(count(diamond), 3 * count({ ...diamond, border: undefined }));
});
