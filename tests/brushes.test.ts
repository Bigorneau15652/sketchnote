import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFlow, DEFAULT_NIB_ANGLE, isBrush, nibPath, spaced, sprayPath, squarePath } from "../src/brushes";
import { FreedrawElement, Point, readElements, SketchElement } from "../src/elements";
import { elementPaths } from "../src/shape-paths";
import { applyStyle, cleanPatch, defaultStyle, styleOf } from "../src/style";
import { penElement } from "../src/tools";

const SAFE = /^[MLZ0-9.,\s-]*$/;

// Returns the polygons of a path made of M, L and Z.
function polygons(d: string): Point[][] {
  return d
    .split(`Z`)
    .map((part) => part.trim())
    .filter((part) => part !== ``)
    .map((part) => part.replace(/[ML]/g, ` `).trim().split(/\s+/).map((pair): Point => [Number(pair.split(`,`)[0]), Number(pair.split(`,`)[1])]));
}

const signedArea = (poly: Point[]): number => poly.reduce((sum, a, i) => sum + (a[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * a[1]), 0) / 2;
const extent = (d: string): { w: number; h: number } => {
  const pts = polygons(d).flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

const horizontal: Point[] = Array.from({ length: 30 }, (_, i): Point => [10 + i * 5, 50]);
const vertical: Point[] = Array.from({ length: 30 }, (_, i): Point => [50, 10 + i * 5]);

test(`les points sont repartis regulierement en gardant le premier et le dernier`, () => {
  const pts = spaced([[0, 0], [100, 0]], 10);
  assert.equal(pts.length, 11);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[pts.length - 1], [100, 0]);
  assert.deepEqual(spaced([[5, 5]], 3), [[5, 5]]);
  assert.deepEqual(spaced([], 3), []);
});

test(`le pinceau carre laisse une bande aussi large que son cote, dans tous les sens`, () => {
  for (const line of [horizontal, vertical]) {
    const d = squarePath(line, 10);
    assert.match(d, SAFE);
    const e = extent(d);
    const across = line === horizontal ? e.h : e.w;
    assert.ok(Math.abs(across - 10) < 0.1, `largeur ${across}`);
  }
  // A single stamp is one square.
  const one = polygons(squarePath([[20, 20]], 8));
  assert.equal(one.length, 1);
  assert.equal(squarePath([], 8), ``);
});

test(`tous les polygones d'un pinceau tournent dans le meme sens, sinon leurs recouvrements s'annuleraient`, () => {
  const curve: Point[] = Array.from({ length: 60 }, (_, i): Point => [100 + 60 * Math.cos(i / 9), 100 + 60 * Math.sin(i / 9)]);
  for (const d of [squarePath(curve, 9), nibPath(curve, 20, 45), nibPath(curve, 20, 135), nibPath(curve, 20, 0)]) {
    const areas = polygons(d).map(signedArea);
    assert.ok(areas.length > 5);
    assert.ok(areas.every((a) => a >= 0), `un polygone tourne a l'envers`);
  }
});

test(`la plume est epaisse en travers de sa pointe et fine dans son sens`, () => {
  // A horizontal tip drawn sideways is a hairline, drawn down it is as long as the nib.
  const sideways = extent(nibPath(horizontal, 20, 0));
  assert.ok(sideways.h < 0.5, `trait fin: ${sideways.h}`);
  const down = extent(nibPath(vertical, 20, 0));
  assert.ok(Math.abs(down.w - 20) < 0.1, `trait epais: ${down.w}`);
  // A tip at 90 degrees is the other way round.
  assert.ok(extent(nibPath(horizontal, 20, 90)).h > 19);
  // At 45 degrees the stroke of a horizontal line is as high as the tip projected.
  const slanted = extent(nibPath(horizontal, 20, 45));
  assert.ok(Math.abs(slanted.h - 20 * Math.sin(Math.PI / 4)) < 0.2);
  assert.match(nibPath(horizontal, 20, 45), SAFE);
  assert.equal(nibPath([], 20, 45), ``);
  assert.ok(polygons(nibPath([[10, 10]], 20, 45)).length === 1, `un point fait un petit trait`);
});

test(`le spray fait plus de points avec plus de flux, toujours les memes pour une graine, et dans son rayon`, () => {
  const count = (s: { small: string; large: string }): number => (s.small.match(/M/g) ?? []).length + (s.large.match(/M/g) ?? []).length;
  const light = sprayPath(horizontal, 8, 0.2, 5);
  const full = sprayPath(horizontal, 8, 1, 5);
  assert.ok(count(full) > count(light) * 2, `${count(light)} puis ${count(full)}`);
  assert.deepEqual(sprayPath(horizontal, 8, 1, 5), full);
  assert.notDeepEqual(sprayPath(horizontal, 8, 1, 6), full);
  assert.match(full.small + ` ` + full.large, SAFE);
  const ys = polygonlessPoints(full.small + ` ` + full.large).map((p) => p[1]);
  assert.ok(Math.max(...ys) <= 58.01 && Math.min(...ys) >= 41.99, `dans le rayon`);
  assert.ok(full.large !== `` && full.small !== ``, `deux tailles de points`);
  // A long stroke stays under the limit of dots.
  const long: Point[] = [[0, 0], [20000, 0]];
  assert.ok(count(sprayPath(long, 8, 1, 3)) <= 6500);
  assert.deepEqual(sprayPath([], 8, 1, 1), { small: ``, large: `` });
  assert.ok(count(sprayPath([[10, 10]], 8, 1, 1)) >= 1);
});

function polygonlessPoints(d: string): Point[] {
  return (d.match(/M-?[0-9.]+,-?[0-9.]+/g) ?? []).map((m): Point => [Number(m.slice(1).split(`,`)[0]), Number(m.slice(1).split(`,`)[1])]);
}

test(`un pinceau et un flux sont reconnus ou refuses`, () => {
  assert.equal(isBrush(`nib`), true);
  assert.equal(isBrush(`round`), true);
  assert.equal(isBrush(`felt`), false);
  assert.equal(isBrush(3), false);
  assert.equal(cleanFlow(5), 1);
  assert.equal(cleanFlow(0), 0.05);
  assert.equal(cleanFlow(0.456), 0.46);
});

const stroke = (extra: Record<string, unknown> = {}): unknown => ({ id: `a`, type: `freedraw`, stroke: `#000000`, strokeWidth: 5, points: horizontal, seed: 3, ...extra });

test(`un trait libre relit son pinceau, son flux et l'angle de sa plume, et refuse les valeurs fausses`, () => {
  const read = readElements([stroke({ brush: `nib`, flow: 0.4, nibAngle: 120 })]);
  assert.equal(read.ok, true);
  if (read.ok) {
    const el = read.elements[0] as FreedrawElement;
    assert.deepEqual([el.brush, el.flow, el.nibAngle], [`nib`, 0.4, 120]);
  }
  const plain = readElements([stroke({ flow: 1, nibAngle: 45 })]);
  assert.equal(plain.ok && `flow` in plain.elements[0], false, `les valeurs par defaut ne sont pas enregistrees`);
  assert.equal(plain.ok && `nibAngle` in plain.elements[0], false);
  for (const bad of [{ brush: `felt` }, { brush: `round` }, { brush: 2 }, { flow: 0 }, { flow: 1.5 }, { flow: `1` }, { nibAngle: -1 }, { nibAngle: 181 }, { nibAngle: `45` }]) {
    assert.equal(readElements([stroke(bad)]).ok, false, JSON.stringify(bad));
  }
  // The strokes of the previous versions are round brush strokes.
  const old = readElements([stroke()]);
  assert.equal(old.ok && (old.elements[0] as FreedrawElement).brush, undefined);
});

test(`le crayon prend le pinceau du style, le reglage change la selection et le style relit tout`, () => {
  const style = { ...defaultStyle(`#000000`), brush: `nib` as const, flow: 0.6, brushAngle: 30 };
  const made = penElement(horizontal, style, `p`, 1, 5000) as FreedrawElement;
  assert.deepEqual([made.brush, made.flow, made.nibAngle], [`nib`, 0.6, 30]);
  const round = penElement(horizontal, defaultStyle(`#000000`), `p`, 1, 5000) as FreedrawElement;
  assert.deepEqual([round.brush, round.flow, round.nibAngle], [undefined, undefined, undefined]);
  const s = styleOf(made as SketchElement);
  assert.deepEqual([s?.brush, s?.flow, s?.brushAngle], [`nib`, 0.6, 30]);
  assert.deepEqual([styleOf(round as SketchElement)?.brush, styleOf(round as SketchElement)?.flow, styleOf(round as SketchElement)?.brushAngle], [`round`, 1, DEFAULT_NIB_ANGLE]);
  const changed = applyStyle(round as SketchElement, { brush: `aerosol`, flow: 0.3, brushAngle: 100 }) as FreedrawElement;
  assert.deepEqual([changed.brush, changed.flow, changed.nibAngle], [`aerosol`, 0.3, 100]);
  const back = applyStyle(changed as SketchElement, { brush: `round`, flow: 1, brushAngle: 45 }) as FreedrawElement;
  assert.deepEqual([`brush` in back, `flow` in back, `nibAngle` in back], [false, false, false]);
  // A shape has no brush.
  const rect = { id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 3 } as SketchElement;
  assert.equal(`brush` in (applyStyle(rect, { brush: `nib` }) as object), false);
  assert.deepEqual(cleanPatch({ brush: `felt` as never }), {});
  assert.deepEqual(cleanPatch({ brush: `square`, flow: 9, brushAngle: 400 }), { brush: `square`, flow: 1, brushAngle: 180 });
  assert.deepEqual(cleanPatch({ flow: 0, brushAngle: -5 }), { flow: 0.05, brushAngle: 0 });
});

test(`chaque pinceau dessine autre chose, et le rond reste le crayon d'avant`, () => {
  const make = (brush: string): FreedrawElement => ({ ...(readElements([stroke(brush === `round` ? {} : { brush })]) as { ok: true; elements: SketchElement[] }).elements[0] }) as FreedrawElement;
  const round = elementPaths(make(`round`)).pieces;
  assert.equal(round.length, 1);
  assert.equal(round[0].stroke, `none`);
  assert.equal(round[0].opacity, 1);
  const designs = [`aerosol`, `square`, `nib`].map((b) => elementPaths(make(b)).pieces.map((p) => p.d).join(`|`));
  assert.equal(new Set([round[0].d, ...designs]).size, 4);
  const aerosol = elementPaths(make(`aerosol`)).pieces;
  assert.ok(aerosol.length >= 1 && aerosol.every((p) => p.fill === `none` && p.stroke === `#000000`));
  // The flow of a brush with a body is its opacity.
  const light = elementPaths(readElements([stroke({ brush: `square`, flow: 0.4 })]).ok ? ((readElements([stroke({ brush: `square`, flow: 0.4 })]) as { elements: FreedrawElement[] }).elements[0]) : make(`square`)).pieces;
  assert.equal(light[0].opacity, 0.4);
  const lightRound = (readElements([stroke({ flow: 0.5 })]) as { elements: FreedrawElement[] }).elements[0];
  assert.equal(elementPaths(lightRound).pieces[0].opacity, 0.5);
});
