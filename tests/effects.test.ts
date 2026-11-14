import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, SketchElement } from "../src/elements";
import { cleanOpacity, effectFields, shadowFrom, shadowSettingsOf } from "../src/effects";
import { applyStyle, cleanPatch, defaultStyle, styleOf } from "../src/style";
import { elementFromDrag, textElement } from "../src/tools";
import { elementPaths, resample, wobble } from "../src/shape-paths";
import { outlineExtent } from "../src/extent";
import type { StrokedElement } from "../src/elements";

const rect: SketchElement = { id: `r`, type: `rect`, x: 0, y: 0, width: 100, height: 60, stroke: `#000000`, strokeWidth: 4 };
const arrow: SketchElement = { id: `a`, type: `arrow`, points: [[0, 0], [100, 0]], stroke: `#000000`, strokeWidth: 3 };
const text: SketchElement = { id: `t`, type: `text`, x: 0, y: 0, width: 50, height: 40, text: `Salut`, font: `caveat`, size: 32, stroke: `#000000` };

const SH = { distance: 10, blur: 10, opacity: 0.4, color: `#000000` };

test(`l'ombre se regle par son eloignement, son flou, sa densite et sa couleur`, () => {
  assert.deepEqual(shadowFrom({ distance: 10, blur: 12, opacity: 0.3, color: `#336699` }), { x: 5.5, y: 8.4, blur: 12, color: `#336699`, opacity: 0.3 });
  // The settings are brought into their ranges.
  const big = shadowFrom({ distance: 999, blur: 999, opacity: 5, color: `#000000` });
  assert.deepEqual([big.blur, big.opacity], [40, 1]);
  assert.ok(Math.abs(Math.hypot(big.x, big.y) - 60) < 0.2);
  assert.equal(shadowFrom({ ...SH, distance: -4, opacity: 0 }).y, 0);
  assert.equal(shadowFrom({ ...SH, opacity: 0 }).opacity, 0.05);
  // The settings read back from a shadow are the ones that made it, and an element without shadow gives the usual ones.
  assert.deepEqual(shadowSettingsOf(shadowFrom({ distance: 20, blur: 7, opacity: 0.6, color: `#ff0000` })), { distance: 20, blur: 7, opacity: 0.6, color: `#ff0000` });
  assert.deepEqual(shadowSettingsOf(undefined), SH);
  assert.equal(cleanOpacity(0), 0.05);
  assert.equal(cleanOpacity(3), 1);
  assert.equal(cleanOpacity(0.456), 0.46);
});

test(`les effets, la bordure et le style de trait se lisent dans un fichier et le reste est refuse`, () => {
  const good = readElements([{ ...rect, opacity: 0.5, shadow: shadowFrom(SH), flipX: true, reflection: true, border: `double`, radius: 20, lineStyle: `dashed` }]);
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
  assert.equal(readElements([{ ...text, shadow: shadowFrom({ ...SH, distance: 14 }), opacity: 0.6 }]).ok, true);
  assert.equal(readElements([{ ...arrow, shadow: shadowFrom({ ...SH, distance: 12 }) }]).ok, true);
});

test(`les effets se posent et s'enlevent par le style, sur les formes comme sur le texte`, () => {
  const styled = applyStyle(rect, { opacity: 0.4, shadow: true, shadowDistance: 8, shadowOpacity: 0.3, reflection: true, border: `frame`, radius: 14, lineStyle: `dotted` }) as unknown as Record<string, unknown>;
  assert.deepEqual([styled.opacity, styled.reflection, styled.border, styled.radius, styled.lineStyle], [0.4, true, `frame`, 14, `dotted`]);
  assert.deepEqual(styled.shadow, shadowFrom({ ...SH, distance: 8, opacity: 0.3 }));
  const s = styleOf(styled as unknown as SketchElement);
  assert.deepEqual([s?.opacity, s?.shadow, s?.shadowDistance, s?.shadowOpacity, s?.reflection, s?.border, s?.radius, s?.lineStyle], [0.4, true, 8, 0.3, true, `frame`, 14, `dotted`]);
  const back = applyStyle(styled as unknown as SketchElement, { opacity: 1, shadow: false, reflection: false, border: `simple`, radius: 0, lineStyle: `solid` }) as unknown as Record<string, unknown>;
  for (const key of [`opacity`, `shadow`, `reflection`, `border`, `radius`, `lineStyle`]) assert.equal(key in back, false, key);
  // The original is not changed.
  assert.equal(`opacity` in rect, false);
  // A text takes the opacity and the shadow but no border; an arrow takes no border or corners.
  const t = applyStyle(text, { opacity: 0.5, shadow: true, shadowDistance: 13, border: `double`, radius: 10 }) as unknown as Record<string, unknown>;
  assert.deepEqual([t.opacity, shadowSettingsOf(t.shadow as never).distance, `border` in t, `radius` in t], [0.5, 13, false, false]);
  const a = applyStyle(arrow, { border: `double`, radius: 10, lineStyle: `dashed` }) as unknown as Record<string, unknown>;
  assert.deepEqual([`border` in a, `radius` in a, a.lineStyle], [false, false, `dashed`]);
  // Only a rectangle has corners.
  const ellipse: SketchElement = { id: `e`, type: `ellipse`, cx: 0, cy: 0, rx: 10, ry: 5, stroke: `#000000`, strokeWidth: 3 };
  assert.equal(`radius` in applyStyle(ellipse, { radius: 12, border: `double` }), false);
  assert.equal((applyStyle(ellipse, { border: `double` }) as unknown as { border: string }).border, `double`);
  // A pen stroke has no line style.
  const pen: SketchElement = { id: `p`, type: `freedraw`, points: [[0, 0], [1, 1]], stroke: `#000000`, strokeWidth: 3 };
  assert.equal(`lineStyle` in applyStyle(pen, { lineStyle: `dashed` }), false);
  assert.deepEqual(cleanPatch({ shadowDistance: NaN, border: `x` as never, lineStyle: `y` as never, opacity: NaN }), {});
});

test(`un nouvel element prend les effets du style et reste court sans effet`, () => {
  const style = { ...defaultStyle(`#000000`), opacity: 0.7, shadow: true, shadowDistance: 10, reflection: true, lineStyle: `dashed` as const, border: `double` as const, radius: 40 };
  const made = elementFromDrag(`rect`, [0, 0], [100, 50], { shift: false, alt: false }, style, `r1`, 5) as unknown as Record<string, unknown>;
  assert.deepEqual([made.opacity, made.reflection, made.lineStyle, made.border, made.radius], [0.7, true, `dashed`, `double`, 40]);
  const circle = elementFromDrag(`ellipse`, [0, 0], [100, 50], { shift: false, alt: false }, style, `e1`, 5) as unknown as Record<string, unknown>;
  assert.equal(`radius` in circle, false);
  const plain = elementFromDrag(`rect`, [0, 0], [100, 50], { shift: false, alt: false }, defaultStyle(`#000000`), `r2`, 5) as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(plain).sort(), [`height`, `id`, `roughness`, `seed`, `stroke`, `strokeWidth`, `type`, `width`, `x`, `y`]);
  const t = textElement([0, 0], `Hi`, style, `t1`, () => 10);
  assert.equal(t.opacity, 0.7);
  assert.deepEqual(effectFields(defaultStyle(`#000000`)), {});
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

test(`chaque reglage de l'ombre se change sans toucher les autres, et la case la pose ou l'enleve`, () => {
  const on = applyStyle(rect, { shadow: true }) as unknown as { shadow: { x: number; y: number; blur: number; opacity: number; color: string } };
  assert.deepEqual(shadowSettingsOf(on.shadow as never), SH);
  const far = applyStyle(on as unknown as SketchElement, { shadowDistance: 30 }) as unknown as { shadow: { blur: number; opacity: number; color: string } };
  assert.deepEqual([far.shadow.blur, far.shadow.opacity, far.shadow.color], [10, 0.4, `#000000`]);
  const dark = applyStyle(far as unknown as SketchElement, { shadowOpacity: 0.9, shadowColor: `#c0392b` }) as unknown as { shadow: { opacity: number; color: string; blur: number } };
  assert.deepEqual([dark.shadow.opacity, dark.shadow.color, dark.shadow.blur], [0.9, `#c0392b`, 10]);
  assert.equal(shadowSettingsOf(dark.shadow as never).distance, 30);
  const soft = applyStyle(dark as unknown as SketchElement, { shadowBlur: 25 }) as unknown as { shadow: { blur: number; color: string } };
  assert.deepEqual([soft.shadow.blur, soft.shadow.color], [25, `#c0392b`]);
  assert.equal(`shadow` in applyStyle(soft as unknown as SketchElement, { shadow: false }), false);
  // The settings alone put no shadow on an element that has none.
  assert.equal(`shadow` in applyStyle(rect, { shadowOpacity: 0.9, shadowDistance: 20 }), false);
  // An unsafe colour is dropped.
  assert.deepEqual(cleanPatch({ shadowColor: `red` }), {});
  assert.deepEqual(cleanPatch({ shadowColor: `#abc`, shadowBlur: 99 }), { shadowColor: `#abc`, shadowBlur: 40 });
});

test(`la profondeur et le degrade du reflet se reglent, se lisent et se valident`, () => {
  const r = applyStyle(rect, { reflection: true, reflectionDepth: 0.3, reflectionFade: 0.5, reflectionGap: 0.25 }) as unknown as { reflection: boolean; reflectDepth: number; reflectFade: number; reflectGap: number };
  assert.deepEqual([r.reflection, r.reflectDepth, r.reflectFade, r.reflectGap], [true, 0.3, 0.5, 0.25]);
  const s = styleOf(r as unknown as SketchElement);
  assert.deepEqual([s?.reflectionDepth, s?.reflectionFade, s?.reflectionGap], [0.3, 0.5, 0.25]);
  // The default values are not written.
  const plain = applyStyle(r as unknown as SketchElement, { reflectionDepth: 0.6, reflectionFade: 1, reflectionGap: 0 }) as unknown as Record<string, unknown>;
  assert.equal(`reflectDepth` in plain || `reflectFade` in plain || `reflectGap` in plain, false);
  assert.deepEqual([styleOf(rect)?.reflectionDepth, styleOf(rect)?.reflectionFade, styleOf(rect)?.reflectionGap], [0.6, 1, 0]);
  const made = effectFields({ ...defaultStyle(`#000000`), reflection: true, reflectionDepth: 0.3, reflectionFade: 0.2, reflectionGap: 0.1 });
  assert.deepEqual([made.reflection, made.reflectDepth, made.reflectFade, made.reflectGap], [true, 0.3, 0.2, 0.1]);
  assert.deepEqual(cleanPatch({ reflectionDepth: 9, reflectionFade: -1, reflectionGap: 9 }), { reflectionDepth: 1, reflectionFade: 0, reflectionGap: 1 });
  assert.equal(readElements([{ ...rect, reflection: true, reflectDepth: 0.3, reflectFade: 0.5 }]).ok, true);
  for (const bad of [{ reflectDepth: 0 }, { reflectDepth: 2 }, { reflectFade: -0.1 }, { reflectFade: `1` }, { reflectGap: -1 }, { reflectGap: 2 }]) assert.equal(readElements([{ ...rect, ...bad }]).ok, false, JSON.stringify(bad));
});

test(`le fuselage d'un trait ou d'une fleche se regle, se lit et se valide`, () => {
  const a = applyStyle(arrow, { taper: 0.7 }) as unknown as { taper?: number };
  assert.equal(a.taper, 0.7);
  assert.equal(styleOf(a as unknown as SketchElement)?.taper, 0.7);
  assert.equal(`taper` in applyStyle(a as unknown as SketchElement, { taper: 0 }), false);
  assert.equal(`taper` in applyStyle(rect, { taper: 0.5 }), false, `a shape has no taper`);
  assert.deepEqual(cleanPatch({ taper: 4 }), { taper: 1 });
  assert.equal(readElements([{ ...arrow, taper: 0.5 }]).ok, true);
  const line = readElements([{ id: `l`, type: `line`, points: [[0, 0], [9, 9]], stroke: `#000000`, strokeWidth: 3, taper: 0 }]);
  assert.equal(line.ok && `taper` in line.elements[0], false, `no taper is not written`);
  for (const bad of [{ taper: -0.1 }, { taper: 1.1 }, { taper: `1` }]) assert.equal(readElements([{ ...arrow, ...bad }]).ok, false, JSON.stringify(bad));
  const pen = readElements([{ id: `p`, type: `freedraw`, points: [[0, 0], [9, 9]], stroke: `#000000`, strokeWidth: 3, taper: 1 }]);
  assert.equal(pen.ok && `taper` in pen.elements[0], false);
  const made = linearElementWithTaper();
  assert.equal(made, 0.4);
});

function linearElementWithTaper(): number | undefined {
  const el = elementFromDrag(`arrow`, [0, 0], [100, 0], { shift: false, alt: false }, { ...defaultStyle(`#000000`), taper: 0.4 }, `a1`, 3) as unknown as { taper?: number };
  return el.taper;
}

test(`un trait fuselé se dessine en un contour plein, fin a la pointe`, () => {
  const plain = elementPaths({ ...arrow, roughness: 0 } as StrokedElement).pieces;
  const tapered = elementPaths({ ...arrow, roughness: 0, taper: 1, strokeWidth: 12 } as StrokedElement).pieces;
  // The line is one filled outline in the colour of the line (and the head of the arrow is drawn too).
  const body = tapered[0];
  assert.deepEqual([body.stroke, body.fill], [`none`, `#000000`]);
  assert.ok(tapered.length >= 1 && plain.some((p) => p.outline === true));
  // The outline is wide at the start and narrow at the end: measure the numbers of its path near both ends.
  const nums = body.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const spread = (from: number, to: number): number => {
    const ys = pts.filter((p) => p[0] >= from && p[0] <= to).map((p) => p[1]);
    return ys.length === 0 ? 0 : Math.max(...ys) - Math.min(...ys);
  };
  assert.ok(spread(0, 20) > 8, `wide at the start: ${spread(0, 20)}`);
  assert.ok(spread(80, 100) < spread(0, 20) / 2, `narrow at the end: ${spread(80, 100)}`);
});

test(`le fuselage va vers la pointe : le bout qui a une tete est le fin`, () => {
  const startHead = elementPaths({ ...arrow, roughness: 0, taper: 1, strokeWidth: 12, startHead: `arrow`, endHead: `none` } as StrokedElement).pieces[0];
  const nums = startHead.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const near = (from: number, to: number): number => {
    const ys = pts.filter((p) => p[0] >= from && p[0] <= to).map((p) => p[1]);
    return ys.length === 0 ? 0 : Math.max(...ys) - Math.min(...ys);
  };
  assert.ok(near(0, 20) < near(80, 100), `narrow at the start, where the head is: ${near(0, 20)} ${near(80, 100)}`);
});

test(`les points d'un trait sont reechantillonnes et deplaces de facon repetable`, () => {
  const pts = resample([[0, 0], [10, 0]], 3);
  assert.deepEqual(pts.map((p) => p[0]), [0, 3, 6, 9, 10]);
  assert.deepEqual(resample([[0, 0], [10, 0], [10, 10]], 5), [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]);
  assert.deepEqual(resample([[1, 1]], 3), [[1, 1]]);
  const line: [number, number][] = [[0, 0], [20, 0], [40, 0], [60, 0], [80, 0], [100, 0]];
  assert.deepEqual(wobble(line, 0, 5), line);
  const a = wobble(line, 2, 5);
  assert.deepEqual(a, wobble(line, 2, 5));
  assert.notDeepEqual(a, wobble(line, 2, 6));
  assert.deepEqual([a[0], a[a.length - 1]], [line[0], line[line.length - 1]]);
  assert.ok(a.slice(1, -1).some((p) => Math.abs(p[1]) > 0.05));
  const strong = wobble(line, 3, 5);
  assert.ok(Math.max(...strong.map((p) => Math.abs(p[1]))) >= Math.max(...a.map((p) => Math.abs(p[1]))));
});

test(`l'imperfection se regle de 0 a 5 par dixiemes`, () => {
  assert.deepEqual(cleanPatch({ roughness: 1.64 }), { roughness: 1.6 });
  assert.deepEqual(cleanPatch({ roughness: 9 }), { roughness: 5 });
  assert.deepEqual(cleanPatch({ roughness: 4.96 }), { roughness: 5 });
  assert.deepEqual(cleanPatch({ roughness: -2 }), { roughness: 0 });
  assert.deepEqual(cleanPatch({ roughness: 0 }), { roughness: 0 });
  assert.equal((applyStyle(rect, { roughness: 2.4 }) as unknown as { roughness: number }).roughness, 2.4);
  // The drawing of the same shape changes with the roughness.
  const calm = elementPaths({ ...rect, roughness: 0.2, seed: 7 } as StrokedElement).pieces.map((p) => p.d).join();
  const wild = elementPaths({ ...rect, roughness: 3, seed: 7 } as StrokedElement).pieces.map((p) => p.d).join();
  assert.notEqual(calm, wild);
});

test(`l'etendue du dessin d'un element depasse sa boite de la largeur de son trait et de sa bordure`, () => {
  const plain = outlineExtent(rect);
  assert.ok(plain >= 2 && plain < 5, `a simple border: ${plain}`);
  assert.ok(outlineExtent({ ...rect, border: `double-reverse` } as SketchElement) > plain, `the thick line outside counts`);
  assert.ok(outlineExtent({ ...rect, border: `mat` } as SketchElement) > plain);
  assert.ok(outlineExtent({ ...rect, roughness: 5 } as SketchElement) > outlineExtent({ ...rect, roughness: 0 } as SketchElement));
  assert.ok(outlineExtent(arrow) >= 7, `the head of an arrow goes beyond its end`);
  assert.equal(outlineExtent({ id: `d`, type: `drawing`, x: 0, y: 0, width: 5, height: 5, path: null }), 0);
  assert.equal(outlineExtent(text), 6.4);
});
