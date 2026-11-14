import { test } from "node:test";
import assert from "node:assert/strict";
import { SketchElement } from "../src/elements";
import { applyStyle, applyStyleToIds, cleanPatch, defaultStyle, MAX_WIDTH, MIN_WIDTH, STROKE_WIDTHS, styleOf } from "../src/style";
import { addPenPoint, CREATION_TOOLS, elementFromDrag, linearElement, penElement, pointElement } from "../src/tools";

const style = defaultStyle(`#000000`);
const none = { shift: false, alt: false };
const rect: SketchElement = { id: `r`, type: `rect`, x: 0, y: 0, width: 10, height: 10, stroke: `#000000`, strokeWidth: 3 };

test(`le style par defaut est un trait fin noir a main levee sans remplissage`, () => {
  assert.deepEqual(style, { stroke: `#000000`, fill: null, fillStyle: `solid`, fillOpacity: 1, strokeWidth: STROKE_WIDTHS.thin, roughness: 1, rounded: false, startHead: `none`, endHead: `arrow`, font: `caveat`, fontSize: 32, align: `left`, opacity: 1, shadow: `none`, reflection: false, lineStyle: `solid`, border: `simple`, radius: 0 });
  assert.equal(defaultStyle(`#ffffff`).stroke, `#ffffff`);
  assert.equal(defaultStyle(`red`).stroke, `#000000`);
});

test(`un style est nettoye avant usage`, () => {
  assert.deepEqual(cleanPatch({ stroke: `red`, fill: `javascript:x` as string, strokeWidth: 999, roughness: 5 }), { strokeWidth: MAX_WIDTH, roughness: 1 });
  assert.deepEqual(cleanPatch({ strokeWidth: -4, roughness: 0 }), { strokeWidth: MIN_WIDTH, roughness: 0 });
  assert.deepEqual(cleanPatch({ fill: null, fillStyle: `hachure` }), { fill: null, fillStyle: `hachure` });
  assert.deepEqual(cleanPatch({ strokeWidth: NaN }), {});
});

test(`appliquer un style change l'element sans toucher l'original`, () => {
  const copy = JSON.stringify(rect);
  const red = applyStyle(rect, { stroke: `#ff0000`, strokeWidth: 9 }) as { stroke: string; strokeWidth: number };
  assert.equal(red.stroke, `#ff0000`);
  assert.equal(red.strokeWidth, 9);
  assert.equal(JSON.stringify(rect), copy);
});

test(`un remplissage se pose, se change de style et s'enleve`, () => {
  const filled = applyStyle(rect, { fill: `#00ff00` }) as { fill?: string; fillStyle?: string };
  assert.equal(filled.fill, `#00ff00`);
  assert.equal(filled.fillStyle, `solid`);
  const hatch = applyStyle(filled as SketchElement, { fillStyle: `hachure` }) as { fillStyle?: string };
  assert.equal(hatch.fillStyle, `hachure`);
  const empty = applyStyle(hatch as SketchElement, { fill: null }) as { fill?: string };
  assert.equal(`fill` in empty, false);
});

test(`une ligne ne prend pas de remplissage et un cadre de dessin n'a pas de style`, () => {
  const line: SketchElement = { id: `l`, type: `line`, points: [[0, 0], [1, 1]], stroke: `#000000`, strokeWidth: 3 };
  assert.equal(`fill` in applyStyle(line, { fill: `#ff0000` }), false);
  const frame: SketchElement = { id: `c`, type: `drawing`, x: 0, y: 0, width: 50, height: 50, path: null };
  assert.equal(applyStyle(frame, { stroke: `#ff0000` }), frame);
  assert.equal(styleOf(frame), null);
});

test(`le style d'un element est relu tel qu'il est`, () => {
  const s = styleOf({ ...rect, fill: `#abc`, fillStyle: `hachure`, roughness: 1 } as SketchElement);
  assert.deepEqual(s, { stroke: `#000000`, fill: `#abc`, fillStyle: `hachure`, fillOpacity: 1, strokeWidth: 3, roughness: 1, rounded: false, startHead: `none`, endHead: `none`, font: `caveat`, fontSize: 32, align: `left`, opacity: 1, shadow: `none`, reflection: false, lineStyle: `solid`, border: `simple`, radius: 0 });
  assert.equal(styleOf(rect)?.fill, null);
});

test(`le style est applique aux seuls elements choisis`, () => {
  const other: SketchElement = { ...rect, id: `o` };
  const next = applyStyleToIds([rect, other], new Set([`o`]), { stroke: `#ff0000` });
  assert.equal(next[0], rect);
  assert.equal((next[1] as { stroke: string }).stroke, `#ff0000`);
});

test(`un glisser trace un rectangle de coin a coin`, () => {
  const el = elementFromDrag(`rect`, [10, 20], [110, 70], none, style, `n1`, 5);
  assert.ok(el && el.type === `rect`);
  if (el && el.type === `rect`) {
    assert.deepEqual([el.x, el.y, el.width, el.height], [10, 20, 100, 50]);
    assert.equal(el.stroke, `#000000`);
    assert.equal(el.roughness, 1);
    assert.equal(el.seed, 5);
    assert.equal(`fill` in el, false);
  }
  const back = elementFromDrag(`rect`, [110, 70], [10, 20], none, style, `n2`, 5);
  assert.ok(back && back.type === `rect` && back.x === 10 && back.width === 100);
});

test(`Maj donne un carre ou un cercle et Alt part du centre`, () => {
  const sq = elementFromDrag(`rect`, [0, 0], [100, 40], { shift: true, alt: false }, style, `a`, 1);
  assert.ok(sq && sq.type === `rect` && sq.width === 100 && sq.height === 100);
  const circle = elementFromDrag(`ellipse`, [0, 0], [60, 20], { shift: true, alt: false }, style, `b`, 1);
  assert.ok(circle && circle.type === `ellipse` && circle.rx === 30 && circle.ry === 30);
  const centred = elementFromDrag(`rect`, [100, 100], [130, 110], { shift: false, alt: true }, style, `c`, 1);
  assert.ok(centred && centred.type === `rect` && centred.x === 70 && centred.width === 60 && centred.y === 90 && centred.height === 20);
});

test(`une ellipse et un losange sont crees dans la boite du glisser`, () => {
  const e = elementFromDrag(`ellipse`, [0, 0], [100, 60], none, style, `e`, 1);
  assert.ok(e && e.type === `ellipse` && e.cx === 50 && e.cy === 30 && e.rx === 50 && e.ry === 30);
  const d = elementFromDrag(`diamond`, [0, 0], [40, 80], none, style, `d`, 1);
  assert.ok(d && d.type === `diamond` && d.width === 40 && d.height === 80);
});

test(`les formes avec remplissage le gardent`, () => {
  const s = { ...style, fill: `#ff0000`, fillStyle: `hachure` as const };
  const el = elementFromDrag(`rect`, [0, 0], [20, 20], none, s, `r`, 1);
  assert.ok(el && el.type === `rect` && el.fill === `#ff0000` && el.fillStyle === `hachure`);
});

test(`un trait et une fleche vont du depart a l'arrivee, Maj par pas de 15 degres`, () => {
  const l = elementFromDrag(`line`, [0, 0], [100, 3], none, style, `l`, 1);
  assert.ok(l && l.type === `line` && l.points[1][0] === 100 && l.points[1][1] === 3);
  const snapped = elementFromDrag(`arrow`, [0, 0], [100, 3], { shift: true, alt: false }, style, `a`, 1);
  assert.ok(snapped && snapped.type === `arrow`);
  if (snapped && snapped.type === `arrow`) {
    near(snapped.points[1][1], 0);
    near(Math.hypot(snapped.points[1][0], snapped.points[1][1]), Math.hypot(100, 3));
  }
});

// Checks that two numbers are close.
function near(a: number, b: number): void {
  assert.ok(Math.abs(a - b) < 0.05, `${a} different de ${b}`);
}

test(`un glisser trop petit ne cree rien`, () => {
  assert.equal(elementFromDrag(`rect`, [0, 0], [1, 1], none, style, `x`, 1), null);
  assert.equal(elementFromDrag(`line`, [0, 0], [1, 0], none, style, `x`, 1), null);
  assert.equal(elementFromDrag(`ellipse`, [5, 5], [5, 50], none, style, `x`, 1), null);
});

test(`le point est un petit disque plein de la couleur du trait`, () => {
  const p = pointElement([10, 20], { ...style, stroke: `#ff0000` }, `p`, 1);
  assert.equal(p.fill, `#ff0000`);
  assert.equal(p.fillStyle, `solid`);
  assert.ok(p.rx >= 2 && p.rx === p.ry);
  assert.deepEqual([p.cx, p.cy], [10, 20]);
});

test(`le stylo garde les points assez eloignes et un clic donne un petit trait`, () => {
  let pts = addPenPoint([], [0, 0], 2);
  pts = addPenPoint(pts, [0.5, 0.5], 2);
  assert.equal(pts.length, 1);
  pts = addPenPoint(pts, [5, 5], 2);
  assert.equal(pts.length, 2);
  const el = penElement(pts, style, `p`, 1, 5000);
  assert.ok(el && el.points.length === 2);
  const dot = penElement([[3, 3]], style, `q`, 1, 5000);
  assert.ok(dot && dot.points.length === 2);
  assert.equal(penElement([], style, `r`, 1, 5000), null);
  const long = Array.from({ length: 50 }, (_, i): [number, number] => [i, i]);
  assert.equal(penElement(long, style, `s`, 1, 10)?.points.length, 10);
});

test(`les outils de creation sont ceux attendus`, () => {
  assert.deepEqual(CREATION_TOOLS, [`rect`, `diamond`, `ellipse`, `line`, `arrow`, `pen`, `point`]);
  assert.equal(elementFromDrag(`frame` as never, [0, 0], [200, 200], none, style, `f`, 1), null);
});

test(`la transparence du remplissage se regle, se garde bornee et ne touche pas le trait`, () => {
  assert.deepEqual(cleanPatch({ fillOpacity: 0.5 }), { fillOpacity: 0.5 });
  assert.deepEqual(cleanPatch({ fillOpacity: 0 }), { fillOpacity: 0.05 });
  assert.deepEqual(cleanPatch({ fillOpacity: 7 }), { fillOpacity: 1 });
  assert.deepEqual(cleanPatch({ fillOpacity: NaN }), {});
  const filled = applyStyle(rect, { fill: `#ff0000` });
  const half = applyStyle(filled, { fillOpacity: 0.4 }) as { fillOpacity?: number; stroke: string };
  assert.equal(half.fillOpacity, 0.4);
  assert.equal(half.stroke, `#000000`);
  const back = applyStyle(half as SketchElement, { fillOpacity: 1 });
  assert.equal(`fillOpacity` in back, false);
  assert.equal(styleOf(half as SketchElement)?.fillOpacity, 0.4);
  const line: SketchElement = { id: `l`, type: `line`, points: [[0, 0], [1, 1]], stroke: `#000000`, strokeWidth: 3 };
  assert.equal(`fillOpacity` in applyStyle(line, { fillOpacity: 0.5 }), false);
});

test(`les nouvelles formes prennent la transparence choisie, sauf quand elle est de zero`, () => {
  const s = { ...style, fill: `#ff0000`, fillStyle: `solid` as const, fillOpacity: 0.3 };
  const el = elementFromDrag(`rect`, [0, 0], [40, 40], none, s, `r`, 1);
  assert.ok(el && el.type === `rect` && el.fillOpacity === 0.3);
  const opaque = elementFromDrag(`rect`, [0, 0], [40, 40], none, { ...s, fillOpacity: 1 }, `r`, 1);
  assert.ok(opaque && opaque.type === `rect` && !(`fillOpacity` in opaque));
});

test(`les bords arrondis et les pointes se reglent sur les traits et les fleches seulement`, () => {
  const line: SketchElement = { id: `l`, type: `line`, points: [[0, 0], [5, 5], [9, 0]], stroke: `#000000`, strokeWidth: 3 };
  const arrow: SketchElement = { ...line, id: `a`, type: `arrow` } as SketchElement;
  assert.deepEqual(cleanPatch({ rounded: true, startHead: `dot`, endHead: `star` as never }), { rounded: true, startHead: `dot` });
  assert.equal((applyStyle(line, { rounded: true }) as { rounded?: boolean }).rounded, true);
  assert.equal(`rounded` in applyStyle(applyStyle(line, { rounded: true }), { rounded: false }), false);
  const dotted = applyStyle(arrow, { startHead: `dot`, endHead: `triangle` }) as { startHead?: string; endHead?: string };
  assert.deepEqual([dotted.startHead, dotted.endHead], [`dot`, `triangle`]);
  // A line that is given a head becomes an arrow, with no head at the other end; a choice of no head leaves it a line.
  const turned = applyStyle(line, { startHead: `dot` }) as { type: string; startHead?: string; endHead?: string };
  assert.deepEqual([turned.type, turned.startHead, turned.endHead], [`arrow`, `dot`, `none`]);
  assert.equal(applyStyle(line, { endHead: `none` }).type, `line`);
  assert.equal(applyStyle(rect, { endHead: `arrow` }).type, `rect`);
  assert.equal(styleOf(line)?.endHead, `none`);
  assert.equal(`rounded` in applyStyle(rect, { rounded: true }), false);
  assert.deepEqual([styleOf(arrow)?.rounded, styleOf(arrow)?.startHead, styleOf(arrow)?.endHead], [false, `none`, `arrow`]);
  assert.equal(styleOf(dotted as SketchElement)?.endHead, `triangle`);
});

test(`une ligne ou une fleche creee prend les bords et les pointes du style`, () => {
  const s = { ...style, rounded: true, startHead: `dot` as const, endHead: `none` as const };
  const a = linearElement(`arrow`, [[0, 0], [50, 20], [90, 0]], s, `a`, 3);
  assert.deepEqual([a.type, (a as { rounded?: boolean }).rounded, (a as { startHead?: string }).startHead, (a as { endHead?: string }).endHead], [`arrow`, true, `dot`, `none`]);
  const l = linearElement(`line`, [[0, 0], [50, 20]], s, `l`, 3);
  assert.equal(`startHead` in l, false);
  assert.equal((l as { rounded?: boolean }).rounded, true);
  const plain = linearElement(`arrow`, [[0, 0], [50, 20]], style, `p`, 3);
  assert.equal(`rounded` in plain || `startHead` in plain || `endHead` in plain, false, `the defaults are not written`);
});

test(`les motifs de remplissage sont quatre et un motif inconnu est refuse`, () => {
  for (const fillStyle of [`solid`, `hachure`, `dots`, `grid`] as const) assert.deepEqual(cleanPatch({ fillStyle }), { fillStyle });
  assert.deepEqual(cleanPatch({ fillStyle: `wavy` as never }), {});
  const filled = applyStyle(rect, { fill: `#00ff00`, fillStyle: `dots` }) as { fill?: string; fillStyle?: string; fillOpacity?: number };
  assert.deepEqual([filled.fill, filled.fillStyle, filled.fillOpacity], [`#00ff00`, `dots`, undefined]);
  // A new colour with another pattern replaces the pattern of the fill.
  const grid = applyStyle(filled as SketchElement, { fill: `#0000ff`, fillStyle: `grid` }) as { fillStyle?: string };
  assert.equal(grid.fillStyle, `grid`);
});
