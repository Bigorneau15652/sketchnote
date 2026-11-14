import { test } from "node:test";
import assert from "node:assert/strict";
import { BRUSH_DEFS, BRUSH_KINDS, BRUSH_PARAMS, BrushKind, BrushParams, brushPieces, cleanParam, fieldsOf, isBrush, isParamValue, paramsFromFields, paramsOf, PARAM_RANGES, previewPoints, sparseParams, spaced, speedFactors, sprayPath } from "../src/brushes";
import { FreedrawElement, Point, readElements, SketchElement } from "../src/elements";
import { elementPaths } from "../src/shape-paths";
import { applyStyle, brushDefaultsPatch, cleanPatch, defaultStyle, styleOf } from "../src/style";
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
const height = (poly: Point[]): number => Math.max(...poly.map((p) => p[1])) - Math.min(...poly.map((p) => p[1]));

const horizontal: Point[] = Array.from({ length: 40 }, (_, i): Point => [10 + i * 5, 50]);
const input = (brush: BrushKind, extra: Partial<{ points: Point[]; width: number; params: Partial<BrushParams>; dynamic: boolean; seed: number }> = {}) => ({
  brush,
  points: extra.points ?? horizontal,
  width: extra.width ?? 5,
  color: `#000000`,
  seed: extra.seed ?? 3,
  params: paramsOf(brush, extra.params ?? {}),
  dynamic: extra.dynamic ?? true,
});
const all = (brush: BrushKind, extra = {}): string => brushPieces(input(brush, extra)).map((p) => p.d).join(` `);

test(`les points sont repartis regulierement en gardant le premier et le dernier`, () => {
  const pts = spaced([[0, 0], [100, 0]], 10);
  assert.equal(pts.length, 11);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[pts.length - 1], [100, 0]);
  assert.deepEqual(spaced([[5, 5]], 3), [[5, 5]]);
  assert.deepEqual(spaced([], 3), []);
});

test(`chaque pinceau a ses reglages habituels dans leurs limites, et ne montre que ceux qui le concernent`, () => {
  assert.equal(BRUSH_KINDS.length, 10);
  for (const b of BRUSH_KINDS) {
    const def = BRUSH_DEFS[b];
    for (const p of BRUSH_PARAMS) assert.ok(isParamValue(p, def.defaults[p]), `${b} ${p}`);
    assert.ok(def.params.every((p) => (BRUSH_PARAMS as readonly string[]).includes(p)));
    assert.ok(def.size > 0);
  }
  assert.deepEqual(BRUSH_DEFS.round.params, [], `le pinceau rond est le crayon d'avant : rien a regler`);
  assert.ok(BRUSH_DEFS.nib.params.includes(`rotation`) && BRUSH_DEFS.nib.params.includes(`form`));
  assert.ok(!BRUSH_DEFS.ink.params.includes(`flow`));
  assert.ok(BRUSH_DEFS.pencil.params.includes(`grain`) && BRUSH_DEFS.airbrush.params.includes(`hardness`));
  // The soft brushes are soft and the hard ones are hard.
  assert.ok(BRUSH_DEFS.airbrush.defaults.hardness < BRUSH_DEFS.felt.defaults.hardness);
  assert.equal(isBrush(`nib`), true);
  assert.equal(isBrush(`felt`), true);
  assert.equal(isBrush(`crayon`), false);
  assert.equal(isBrush(3), false);
});

test(`les reglages d'un trait sont ceux qu'il garde et les habituels de son pinceau pour les autres`, () => {
  assert.equal(paramsOf(`nib`, {}).rotation, 45);
  assert.equal(paramsOf(`square`, {}).rotation, 0);
  assert.equal(paramsOf(`nib`, { rotation: 100 }).rotation, 100);
  assert.equal(paramsOf(`soft`, { flow: NaN }).flow, BRUSH_DEFS.soft.defaults.flow);
  // Only what is not the usual value is kept, under the names of the file (the rotation is the angle of the nib).
  assert.deepEqual(sparseParams(`nib`, { rotation: 45, flow: 1, form: 0.5 }), { form: 0.5 });
  assert.deepEqual(fieldsOf({ rotation: 90, grain: 0.2 }), { nibAngle: 90, grain: 0.2 });
  assert.deepEqual(paramsFromFields({ nibAngle: 90, grain: 0.2 }), { rotation: 90, grain: 0.2 });
  // A value is brought into its range.
  assert.equal(cleanParam(`flow`, 5), 1);
  assert.equal(cleanParam(`flow`, 0), 0.05);
  assert.equal(cleanParam(`rotation`, 400), 180);
  assert.equal(cleanParam(`rotation`, 33.6), 34);
  assert.equal(cleanParam(`spacing`, 0.456), 0.46);
  assert.equal(isParamValue(`form`, 0.05), false);
  assert.equal(isParamValue(`hardness`, 0), true);
  assert.equal(isParamValue(`grain`, `1`), false);
  assert.deepEqual(PARAM_RANGES.rotation, [0, 180]);
});

test(`la dynamique amincit le trait quand le pointeur va vite`, () => {
  const slow: Point[] = Array.from({ length: 20 }, (_, i): Point => [i * 2, 0]);
  const fast: Point[] = Array.from({ length: 20 }, (_, i): Point => [i * 30, 0]);
  assert.deepEqual(speedFactors(slow, 10, 0), slow.map(() => 1), `sans dynamique rien ne change`);
  const a = speedFactors(slow, 10, 1);
  const b = speedFactors(fast, 10, 1);
  assert.ok(Math.min(...b) < Math.min(...a), `plus fin quand c'est rapide`);
  assert.ok(Math.min(...b) >= 0.25 && Math.max(...a) <= 1, `entre 0,25 et 1`);
  assert.ok(Math.min(...speedFactors(fast, 10, 0.5)) > Math.min(...b), `une dynamique plus faible amincit moins`);
  assert.deepEqual(speedFactors([], 10, 1), []);
  assert.deepEqual(speedFactors([[0, 0], [1, 1]], 10, 1), [1, 1]);
});

test(`chaque pinceau laisse des chemins de lignes seulement, et le rond n'en laisse pas ici`, () => {
  assert.deepEqual(brushPieces(input(`round`)), []);
  for (const b of BRUSH_KINDS.filter((k) => k !== `round`)) {
    const pieces = brushPieces(input(b));
    assert.ok(pieces.length >= 1, b);
    for (const p of pieces) {
      assert.match(p.d, SAFE, b);
      assert.ok(p.opacity > 0 && p.opacity <= 1, `${b} opacite ${p.opacity}`);
    }
  }
  assert.deepEqual(brushPieces({ ...input(`soft`), points: [] }), []);
});

test(`tous les polygones d'un pinceau tournent dans le meme sens, sinon leurs recouvrements s'annuleraient`, () => {
  const curve: Point[] = Array.from({ length: 80 }, (_, i): Point => [100 + 60 * Math.cos(i / 12), 100 + 60 * Math.sin(i / 12)]);
  for (const b of [`soft`, `felt`, `square`, `ink`, `nib`, `lino`, `airbrush`] as const) {
    const polys = brushPieces(input(b, { points: curve })).flatMap((p) => polygons(p.d));
    assert.ok(polys.length > 20, b);
    assert.ok(polys.every((poly) => signedArea(poly) >= 0), `${b}: un polygone tourne a l'envers`);
  }
});

test(`le flux s'accumule : chaque couche porte la peinture d'une touche, et plus de flux donne un trait plus plein`, () => {
  const light = brushPieces(input(`felt`, { params: { flow: 0.2 } }));
  const full = brushPieces(input(`felt`, { params: { flow: 1 } }));
  assert.ok(light.length >= 2 && light.length <= 5, `plusieurs couches qui s'additionnent: ${light.length}`);
  assert.ok(light.every((p) => Math.abs(p.opacity - 0.04) < 1e-9), `la peinture d'une touche croit plus vite que le flux`);
  assert.ok(full.every((p) => p.opacity === 1));
  // Where the touches overlap, the paint adds up: with N layers of this paint, the stroke is denser than one touch.
  const density = 1 - Math.pow(1 - 0.04, light.length);
  assert.ok(density > 0.04, `le trait se renforce quand les touches se recouvrent: ${density}`);
  // The flow is not the opacity of the element: the element has none stored.
  assert.equal(`opacity` in (penElement(horizontal, { ...defaultStyle(`#000000`), brush: `felt`, ...brushDefaultsPatch(`felt`) }, `a`, 1, 5000) as object), false);
});

test(`la durete donne des bords flous : plusieurs pointes de plus en plus petites s'ajoutent`, () => {
  const count = (hardness: number): number => brushPieces(input(`soft`, { params: { hardness } })).flatMap((p) => polygons(p.d)).length;
  const hard = count(1);
  const soft = count(0);
  assert.ok(soft >= hard * 3 && soft <= hard * 4 + 4, `${hard} puis ${soft}`);
  // A softer brush lays a lighter paint on each touch.
  const alphaOf = (hardness: number): number => brushPieces(input(`soft`, { params: { hardness, flow: 1 } }))[0].opacity;
  assert.ok(alphaOf(0) < alphaOf(1));
  assert.equal(alphaOf(1), 1);
});

test(`l'espacement change le nombre de touches`, () => {
  const count = (spacing: number): number => brushPieces(input(`felt`, { params: { spacing } })).flatMap((p) => polygons(p.d)).length;
  assert.ok(count(0.1) > count(0.5) * 3, `${count(0.1)} puis ${count(0.5)}`);
});

test(`la largeur du trait suit la taille, la forme et la rotation de la pointe`, () => {
  // The square marker is as wide as its side (1.8 times the thickness), the other way too.
  const marker = extent(all(`square`, { width: 5 }));
  assert.ok(Math.abs(marker.h - 9) < 0.3, `bande de 9: ${marker.h}`);
  // A flat tip turned along the stroke is a hairline, turned across it is as long as the tip.
  const along = extent(all(`nib`, { width: 5, params: { rotation: 0 } }));
  const across = extent(all(`nib`, { width: 5, params: { rotation: 90 } }));
  assert.ok(along.h < 4, `fin dans le sens de la pointe: ${along.h}`);
  assert.ok(across.h > 14, `epais en travers: ${across.h}`);
  // A rounder tip makes a thicker stroke.
  const flat = extent(all(`nib`, { params: { rotation: 0, form: 0.15 } })).h;
  const round = extent(all(`nib`, { params: { rotation: 0, form: 1 } })).h;
  assert.ok(round > flat * 3);
  // The thickness slider scales the brush.
  assert.ok(extent(all(`felt`, { width: 10 })).h > extent(all(`felt`, { width: 4 })).h * 2);
});

test(`les pinceaux pointus finissent en pointe et le trait suit la vitesse seulement quand il est dynamique`, () => {
  const polys = brushPieces(input(`ink`)).flatMap((p) => polygons(p.d));
  const heights = polys.map(height);
  assert.ok(Math.min(...heights) < Math.max(...heights) * 0.6, `les bouts sont plus fins`);
  const uneven: Point[] = Array.from({ length: 30 }, (_, i): Point => [10 + (i < 15 ? i * 2 : 30 + (i - 15) * 25), 50]);
  const moving = brushPieces(input(`ink`, { points: uneven, dynamic: true })).map((p) => p.d).join(` `);
  const still = brushPieces(input(`ink`, { points: uneven, dynamic: false })).map((p) => p.d).join(` `);
  assert.notEqual(moving, still, `la vitesse change le dessin`);
  // Without dynamics, the middle of a tidy stroke has a constant width.
  const middle = brushPieces(input(`felt`)).flatMap((p) => polygons(p.d)).filter((poly) => poly[0][0] > 60 && poly[0][0] < 160).map(height);
  assert.ok(Math.max(...middle) - Math.min(...middle) < 0.6);
});

test(`le grain rend le bord de la linogravure irregulier et les points du crayon plus gros`, () => {
  const smooth = brushPieces(input(`lino`, { params: { grain: 0 } })).map((p) => p.d).join(` `);
  const rough = brushPieces(input(`lino`, { params: { grain: 1 } })).map((p) => p.d).join(` `);
  assert.notEqual(smooth, rough);
  const fine = brushPieces(input(`pencil`, { params: { grain: 0 } }));
  const coarse = brushPieces(input(`pencil`, { params: { grain: 1 } }));
  assert.ok(coarse[0].strokeWidth > fine[0].strokeWidth, `des points plus gros`);
  assert.ok(fine.every((p) => p.fill === `none`));
});

test(`le spray fait plus de points avec plus de flux, toujours les memes pour une graine, et dans son rayon`, () => {
  const count = (s: { small: string; large: string }): number => (s.small.match(/M/g) ?? []).length + (s.large.match(/M/g) ?? []).length;
  const light = sprayPath(horizontal, 8, 0.2, 5);
  const full = sprayPath(horizontal, 8, 1, 5);
  assert.ok(count(full) > count(light) * 2, `${count(light)} puis ${count(full)}`);
  assert.deepEqual(sprayPath(horizontal, 8, 1, 5), full);
  assert.notDeepEqual(sprayPath(horizontal, 8, 1, 6), full);
  assert.match(full.small + ` ` + full.large, SAFE);
  const ys = ((full.small + ` ` + full.large).match(/M-?[0-9.]+,-?[0-9.]+/g) ?? []).map((m) => Number(m.slice(1).split(`,`)[1]));
  assert.ok(Math.max(...ys) <= 58.01 && Math.min(...ys) >= 41.99, `dans le rayon`);
  assert.ok(full.large !== `` && full.small !== ``, `deux tailles de points`);
  assert.ok(count(sprayPath([[0, 0], [20000, 0]], 8, 1, 3)) <= 6500, `un long trait reste leger`);
  assert.deepEqual(sprayPath([], 8, 1, 1), { small: ``, large: `` });
  assert.ok(count(sprayPath([[10, 10]], 8, 1, 1)) >= 1);
});

test(`un trait tres long reste sous la limite de polygones, et un simple clic laisse une touche`, () => {
  const long: Point[] = [[0, 0], [30000, 0]];
  for (const b of [`soft`, `airbrush`, `felt`] as const) {
    const polys = brushPieces(input(b, { points: long })).flatMap((p) => polygons(p.d));
    assert.ok(polys.length <= 2300, `${b}: ${polys.length}`);
  }
  for (const b of [`soft`, `square`, `nib`, `felt`] as const) {
    const polys = brushPieces(input(b, { points: [[50, 50]] })).flatMap((p) => polygons(p.d));
    assert.ok(polys.length >= 1, `${b}: une touche`);
  }
});

test(`l'apercu de chaque pinceau est un trait ondule de 100 sur 40`, () => {
  const pts = previewPoints();
  assert.ok(pts.length > 20);
  assert.ok(pts.every((p) => p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 40));
  for (const b of BRUSH_KINDS.filter((k) => k !== `round`)) {
    const d = brushPieces({ brush: b, points: pts, width: 3, color: `currentColor`, seed: 7, params: paramsOf(b, {}), dynamic: true }).map((p) => p.d).join(` `);
    const pointsOf = (d.match(/-?[0-9.]+,-?[0-9.]+/g) ?? []).map((m): Point => [Number(m.split(`,`)[0]), Number(m.split(`,`)[1])]);
    assert.ok(pointsOf.length > 0, b);
    assert.ok(pointsOf.every((p) => p[1] > -2 && p[1] < 42), `${b} reste dans l'image`);
  }
});

const stroke = (extra: Record<string, unknown> = {}): unknown => ({ id: `a`, type: `freedraw`, stroke: `#000000`, strokeWidth: 5, points: horizontal, seed: 3, ...extra });

test(`un trait libre relit son pinceau et ses reglages, et refuse les valeurs fausses`, () => {
  const read = readElements([stroke({ brush: `nib`, flow: 0.4, nibAngle: 120, form: 0.5, hardness: 0.7, spacing: 0.3, grain: 0.2, dynamics: 0.9 })]);
  assert.equal(read.ok, true);
  if (read.ok) {
    const el = read.elements[0] as FreedrawElement;
    assert.deepEqual([el.brush, el.flow, el.nibAngle, el.form, el.hardness, el.spacing, el.grain, el.dynamics], [`nib`, 0.4, 120, 0.5, 0.7, 0.3, 0.2, 0.9]);
  }
  // The usual settings of the brush are not kept.
  const plain = readElements([stroke({ brush: `nib`, nibAngle: 45, form: 0.15, flow: 1, spacing: 0.06 })]);
  assert.equal(plain.ok, true);
  if (plain.ok) assert.deepEqual(Object.keys(plain.elements[0]).filter((k) => [`flow`, `nibAngle`, `form`, `spacing`].includes(k)), []);
  for (const bad of [{ brush: `felt-tip` }, { brush: `round` }, { brush: 2 }, { flow: 0 }, { flow: 1.5 }, { flow: `1` }, { nibAngle: -1 }, { nibAngle: 181 }, { form: 0.05 }, { hardness: 2 }, { spacing: 3 }, { grain: -0.1 }, { dynamics: 1.1 }]) {
    assert.equal(readElements([stroke(bad)]).ok, false, JSON.stringify(bad));
  }
  // The strokes of the previous versions are round brush strokes, and a flow stored by version 0.19.0 is still read.
  const old = readElements([stroke()]);
  assert.equal(old.ok && (old.elements[0] as FreedrawElement).brush, undefined);
  const flowed = readElements([stroke({ flow: 0.5 })]);
  assert.equal(flowed.ok && (flowed.elements[0] as FreedrawElement).flow, 0.5);
});

test(`le crayon prend le pinceau et les reglages du style, le reglage change la selection et le style relit tout`, () => {
  const style = { ...defaultStyle(`#000000`), brush: `nib` as const, ...brushDefaultsPatch(`nib`), flow: 0.6, brushAngle: 30, form: 0.4 };
  const made = penElement(horizontal, style, `p`, 1, 5000) as FreedrawElement;
  assert.deepEqual([made.brush, made.flow, made.nibAngle, made.form], [`nib`, 0.6, 30, 0.4]);
  assert.equal(`spacing` in made, false, `l'espacement habituel n'est pas enregistre`);
  const round = penElement(horizontal, defaultStyle(`#000000`), `p`, 1, 5000) as FreedrawElement;
  assert.deepEqual([round.brush, round.flow, round.nibAngle], [undefined, undefined, undefined]);
  const s = styleOf(made as SketchElement);
  assert.deepEqual([s?.brush, s?.flow, s?.brushAngle, s?.form], [`nib`, 0.6, 30, 0.4]);
  // What the stroke does not store is the usual value of its brush.
  assert.deepEqual([s?.hardness, s?.spacing, s?.dynamics], [1, 0.06, 0]);
  const rs = styleOf(round as SketchElement);
  assert.deepEqual([rs?.brush, rs?.flow, rs?.brushAngle], [`round`, 1, 45]);
  // A choice of brush starts from the usual settings of the new brush, and a setting replaces one.
  const felt = applyStyle(made as SketchElement, { brush: `felt` }) as FreedrawElement;
  assert.deepEqual([felt.brush, `flow` in felt, `nibAngle` in felt, `form` in felt], [`felt`, false, false, false]);
  const changed = applyStyle(felt as SketchElement, { flow: 0.9, spacing: 0.4 }) as FreedrawElement;
  assert.deepEqual([changed.brush, changed.flow, changed.spacing], [`felt`, 0.9, 0.4]);
  const again = applyStyle(changed as SketchElement, { flow: 0.7 }) as FreedrawElement;
  assert.deepEqual([again.flow, again.spacing], [0.7, 0.4], `les autres reglages sont gardes`);
  const usual = applyStyle(again as SketchElement, { flow: 0.5, spacing: 0.15 }) as FreedrawElement;
  assert.equal(`flow` in usual, false, `la valeur habituelle du feutre n'est pas gardee`);
  const back = applyStyle(changed as SketchElement, { brush: `round` }) as FreedrawElement;
  assert.deepEqual([`brush` in back, `flow` in back, `spacing` in back], [false, false, false]);
  // A shape has no brush.
  const rect = { id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 3 } as SketchElement;
  assert.equal(`brush` in (applyStyle(rect, { brush: `nib` }) as object), false);
  assert.deepEqual(cleanPatch({ brush: `felt-tip` as never }), {});
  assert.deepEqual(cleanPatch({ brush: `square`, flow: 9, brushAngle: 400, hardness: -3, spacing: 9, form: 0, grain: 7, dynamics: 2 }), { brush: `square`, flow: 1, brushAngle: 180, hardness: 0, spacing: 2, form: 0.1, grain: 1, dynamics: 1 });
  assert.deepEqual(cleanPatch({ flow: 0, brushAngle: -5 }), { flow: 0.05, brushAngle: 0 });
  assert.deepEqual(brushDefaultsPatch(`airbrush`), { flow: 0.3, hardness: 0.05, spacing: 0.08, form: 1, brushAngle: 45, grain: 0, dynamics: 0 });
});

test(`chaque pinceau dessine autre chose, et le rond reste le crayon d'avant`, () => {
  const make = (extra: Record<string, unknown>): FreedrawElement => (readElements([stroke(extra)]) as { ok: true; elements: FreedrawElement[] }).elements[0];
  const round = elementPaths(make({})).pieces;
  assert.equal(round.length, 1);
  assert.equal(round[0].stroke, `none`);
  assert.equal(round[0].opacity, 1);
  const designs = BRUSH_KINDS.filter((b) => b !== `round`).map((b) => elementPaths(make({ brush: b })).pieces.map((p) => p.d).join(`|`));
  assert.equal(new Set([round[0].d, ...designs]).size, BRUSH_KINDS.length, `dix dessins differents`);
  const aerosol = elementPaths(make({ brush: `aerosol` })).pieces;
  assert.ok(aerosol.length >= 1 && aerosol.every((p) => p.fill === `none` && p.stroke === `#000000`));
  // A flow stored by version 0.19.0 on a round brush is still the opacity of the stroke.
  assert.equal(elementPaths(make({ flow: 0.5 })).pieces[0].opacity, 0.5);
  // The flow of the other brushes is the paint of each layer, not the opacity of the element.
  const felt = elementPaths(make({ brush: `felt`, flow: 0.3 })).pieces;
  assert.ok(felt.every((p) => Math.abs(p.opacity - 0.09) < 1e-9) && felt.length >= 2);
  // A tidied stroke has a constant width (no dynamics).
  const tidy = elementPaths(make({ brush: `ink`, regularity: 5 })).pieces.map((p) => p.d).join(`|`);
  const free = elementPaths(make({ brush: `ink` })).pieces.map((p) => p.d).join(`|`);
  assert.notEqual(tidy, free);
});
