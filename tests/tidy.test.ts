import { test } from "node:test";
import assert from "node:assert/strict";
import { canFill, FreedrawElement, Point, readElements, SketchElement } from "../src/elements";
import { applyStyle, cleanPatch, defaultStyle, styleOf } from "../src/style";
import { hitElement } from "../src/geometry";
import { elementPaths } from "../src/shape-paths";
import { penElement } from "../src/tools";
import { isClosedStroke, pathLength, recognise, tidyStroke } from "../src/tidy";

// A small repeatable random generator, so that the hand drawn strokes of the tests are the same every time.
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Walks along a clean closed shape with a shaky hand: noise on every point, and the end overshooting the start a little.
function shaky(clean: (t: number) => Point, count: number, noise: number, seed: number, turns = 1.04): Point[] {
  const rnd = random(seed);
  return Array.from({ length: count }, (_, i): Point => {
    const p = clean(((i / (count - 1)) * turns) % 1.0001);
    return [p[0] + (rnd() - 0.5) * noise, p[1] + (rnd() - 0.5) * noise];
  });
}

const circle = (cx: number, cy: number, r: number) => (t: number): Point => [cx + r * Math.cos(2 * Math.PI * t), cy + r * Math.sin(2 * Math.PI * t)];
const ellipseOf = (cx: number, cy: number, rx: number, ry: number) => (t: number): Point => [cx + rx * Math.cos(2 * Math.PI * t), cy + ry * Math.sin(2 * Math.PI * t)];

// A polygon walked at an even pace.
function polygon(vertices: Point[]) {
  const sides = vertices.map((v, i): [Point, Point] => [v, vertices[(i + 1) % vertices.length]]);
  const lengths = sides.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = lengths.reduce((x, y) => x + y, 0);
  return (t: number): Point => {
    let at = t * total;
    for (let i = 0; i < sides.length; i++) {
      if (at <= lengths[i] || i === sides.length - 1) {
        const k = Math.min(1, at / lengths[i]);
        return [sides[i][0][0] + (sides[i][1][0] - sides[i][0][0]) * k, sides[i][0][1] + (sides[i][1][1] - sides[i][0][1]) * k];
      }
      at -= lengths[i];
    }
    return vertices[0];
  };
}

test(`un rond fait a la main devient un cercle`, () => {
  for (const seed of [3, 11, 29, 101]) {
    const r = recognise(shaky(circle(200, 150, 80), 120, 6, seed), 3);
    assert.equal(r?.kind, `circle`, `graine ${seed}`);
    // Every point of the clean outline is at the same distance of the centre.
    const radii = (r?.outline ?? []).map((p) => Math.hypot(p[0] - 200, p[1] - 150));
    assert.ok(Math.max(...radii) - Math.min(...radii) < 6, `le cercle est regulier`);
  }
});

test(`un ovale devient une ellipse, un carre un carre et un rectangle un rectangle`, () => {
  assert.equal(recognise(shaky(ellipseOf(200, 150, 120, 60), 140, 5, 7))?.kind, `ellipse`);
  const square = polygon([[100, 100], [220, 100], [220, 220], [100, 220]]);
  assert.equal(recognise(shaky(square, 160, 5, 5, 1.02))?.kind, `square`);
  const rect = polygon([[100, 100], [300, 100], [300, 190], [100, 190]]);
  assert.equal(recognise(shaky(rect, 160, 5, 9, 1.02))?.kind, `rectangle`);
  const turned = polygon([[150, 60], [270, 110], [230, 190], [110, 140]]);
  assert.equal(recognise(shaky(turned, 160, 4, 13, 1.02))?.kind, `rectangle`, `un rectangle penche`);
});

test(`trois cotes deviennent un triangle`, () => {
  const tri = polygon([[200, 80], [320, 260], [80, 260]]);
  const r = recognise(shaky(tri, 150, 5, 17, 1.02));
  assert.equal(r?.kind, `triangle`);
});

test(`un trait presque droit devient une droite, horizontale ou verticale quand il l'est presque`, () => {
  const rnd = random(5);
  const wobbly: Point[] = Array.from({ length: 60 }, (_, i): Point => [20 + i * 5, 100 + (rnd() - 0.5) * 6]);
  const line = recognise(wobbly);
  assert.equal(line?.kind, `line`);
  assert.equal(line?.outline.length, 2);
  assert.equal(line?.outline[0][1], line?.outline[1][1], `horizontale`);
  const slanted: Point[] = Array.from({ length: 60 }, (_, i): Point => [20 + i * 4, 20 + i * 3 + (rnd() - 0.5) * 4]);
  const second = recognise(slanted);
  assert.equal(second?.kind, `line`);
  assert.notEqual(second?.outline[0][1], second?.outline[1][1]);
});

test(`un gribouillis, une courbe ou un tout petit trait ne deviennent rien`, () => {
  const zigzag: Point[] = Array.from({ length: 40 }, (_, i): Point => [i * 6, (i % 2) * 60]);
  assert.equal(recognise(zigzag), null);
  const arc: Point[] = Array.from({ length: 50 }, (_, i): Point => [100 + 80 * Math.cos((i / 49) * Math.PI), 100 + 80 * Math.sin((i / 49) * Math.PI)]);
  assert.equal(recognise(arc), null, `un demi cercle reste une courbe`);
  assert.equal(recognise([[0, 0], [1, 1], [2, 1], [3, 2]]), null);
  assert.equal(recognise([[0, 0]]), null);
});

test(`un trait revient a son depart quand l'ecart entre ses bouts est petit`, () => {
  const full = shaky(circle(100, 100, 50), 80, 2, 1, 1.0);
  assert.equal(isClosedStroke(full, 3), true);
  const half: Point[] = Array.from({ length: 40 }, (_, i): Point => [100 + 50 * Math.cos((i / 39) * Math.PI), 100 + 50 * Math.sin((i / 39) * Math.PI)]);
  assert.equal(isClosedStroke(half, 3), false);
  assert.equal(isClosedStroke([[0, 0], [1, 1]], 3), false);
  // A C shape that is nearly shut still counts, one with a wide opening does not.
  const almost: Point[] = Array.from({ length: 80 }, (_, i): Point => [100 + 50 * Math.cos((i / 79) * Math.PI * 1.96), 100 + 50 * Math.sin((i / 79) * Math.PI * 1.96)]);
  assert.equal(isClosedStroke(almost, 3), true);
  const wide: Point[] = Array.from({ length: 80 }, (_, i): Point => [100 + 50 * Math.cos((i / 79) * Math.PI * 1.6), 100 + 50 * Math.sin((i / 79) * Math.PI * 1.6)]);
  assert.equal(isClosedStroke(wide, 3), false);
});

test(`la regularite 0 laisse le trait tel qu'il a ete fait, le maximum donne la forme exacte et entre les deux le trait s'en approche`, () => {
  const hand = shaky(circle(200, 150, 80), 120, 8, 3);
  assert.equal(tidyStroke(hand, 0), hand);
  const exact = tidyStroke(hand, 5);
  const spread = (pts: Point[]): number => {
    const radii = pts.map((p) => Math.hypot(p[0] - 200, p[1] - 150));
    return Math.max(...radii) - Math.min(...radii);
  };
  assert.ok(spread(exact) < 4, `exactement rond au maximum: ${spread(exact)}`);
  assert.deepEqual(exact[0], exact[exact.length - 1], `le cercle est ferme`);
  const half = tidyStroke(hand, 2.5);
  assert.ok(spread(half) < spread(hand) && spread(half) > spread(exact), `entre les deux: ${spread(hand)} > ${spread(half)} > ${spread(exact)}`);
  // The more regular, the closer to round, step by step.
  const steps = [1, 2, 3, 4].map((v) => spread(tidyStroke(hand, v)));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] <= steps[i - 1] + 0.01, `de plus en plus rond: ${steps.join(` `)}`);
  // A stroke that is no shape is only smoothed, and keeps its two ends.
  const scribble: Point[] = Array.from({ length: 50 }, (_, i): Point => [i * 6, (i % 2) * 40 + Math.sin(i) * 10]);
  const smoothed = tidyStroke(scribble, 5);
  assert.ok(smoothed.length > 3);
  assert.deepEqual(smoothed[0], tidyStroke(scribble, 1)[0]);
  assert.ok(pathLength(smoothed) < pathLength(scribble), `plus lisse donc plus court`);
});

test(`le triangle et le rectangle gardent leurs coins au maximum`, () => {
  const tri = tidyStroke(shaky(polygon([[200, 80], [320, 260], [80, 260]]), 150, 5, 17, 1.02), 5);
  const near = (p: Point): boolean => [[200, 80], [320, 260], [80, 260]].some((c) => Math.hypot(p[0] - c[0], p[1] - c[1]) < 14);
  const corners = tri.filter((p, i) => near(p) && (i === 0 || !near(tri[i - 1])));
  assert.ok(corners.length >= 3, `les trois coins sont dans le trace`);
  const rect = tidyStroke(shaky(polygon([[100, 100], [300, 100], [300, 190], [100, 190]]), 160, 5, 9, 1.02), 5);
  const xs = rect.map((p) => p[0]);
  assert.ok(Math.abs(Math.min(...xs) - 100) < 12 && Math.abs(Math.max(...xs) - 300) < 12);
  // The edges are exactly straight: the points of the top side all have the same height.
  const top = rect.filter((p) => Math.abs(p[1] - Math.min(...rect.map((q) => q[1]))) < 3);
  assert.ok(top.length >= 20);
});

// Reads one element through the reader of a list, which is the way files are read.
function readElement(value: unknown): SketchElement | null {
  const r = readElements([value]);
  return r.ok ? r.elements[0] : null;
}

test(`un element libre relit sa regularite et son remplissage, et refuse les valeurs fausses`, () => {
  const ring = shaky(circle(100, 100, 50), 60, 2, 1, 1.0);
  const el = readElement({ id: `a`, type: `freedraw`, stroke: `#000000`, strokeWidth: 3, points: ring, regularity: 3.5, fill: `#c0392b`, fillStyle: `hachure` }) as FreedrawElement;
  assert.deepEqual([el.regularity, el.fill, el.fillStyle], [3.5, `#c0392b`, `hachure`]);
  const plain = readElement({ id: `b`, type: `freedraw`, stroke: `#000000`, strokeWidth: 3, points: ring, regularity: 0 }) as FreedrawElement;
  assert.equal(`regularity` in plain, false);
  for (const bad of [{ regularity: 6 }, { regularity: -1 }, { regularity: `3` }, { fill: `red` }, { fillStyle: `plaid` }]) {
    assert.equal(readElement({ id: `c`, type: `freedraw`, stroke: `#000000`, strokeWidth: 3, points: ring, ...bad }), null, JSON.stringify(bad));
  }
  // The strokes of the previous versions open as they were.
  const old = readElement({ id: `d`, type: `freedraw`, stroke: `#000000`, strokeWidth: 3, points: ring, roughness: 1, seed: 4 }) as FreedrawElement;
  assert.equal(old.regularity, undefined);
});

test(`le crayon prend la regularite du style, un reglage sur la selection la change et le style la relit`, () => {
  const ring = shaky(circle(100, 100, 50), 60, 2, 1, 1.0);
  const style = { ...defaultStyle(`#000000`), regularity: 2.5 };
  const made = penElement(ring, style, `p`, 1, 5000);
  assert.equal(made?.regularity, 2.5);
  assert.equal(penElement(ring, defaultStyle(`#000000`), `p`, 1, 5000)?.regularity, undefined, `0 n'est pas enregistre`);
  const moved = applyStyle(made as SketchElement, { regularity: 5 }) as FreedrawElement;
  assert.equal(moved.regularity, 5);
  assert.equal(styleOf(moved)?.regularity, 5);
  assert.equal(`regularity` in (applyStyle(moved, { regularity: 0 }) as object), false);
  assert.deepEqual(cleanPatch({ regularity: 9 }), { regularity: 5 });
  assert.deepEqual(cleanPatch({ regularity: -2 }), { regularity: 0 });
  assert.deepEqual(cleanPatch({ regularity: NaN }), {});
  // The regularity does not touch a shape.
  const rect = { id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 3 } as SketchElement;
  assert.equal(`regularity` in (applyStyle(rect, { regularity: 3 }) as object), false);
});

test(`seul un trait libre ferme peut etre rempli`, () => {
  const ring = penElement(shaky(circle(100, 100, 50), 60, 2, 1, 1.0), defaultStyle(`#000000`), `a`, 1, 5000) as SketchElement;
  const open = penElement(Array.from({ length: 20 }, (_, i): Point => [i * 10, (i % 3) * 6]), defaultStyle(`#000000`), `b`, 1, 5000) as SketchElement;
  assert.equal(canFill(ring), true);
  assert.equal(canFill(open), false);
  const filled = applyStyle(ring, { fill: `#2b6cb0`, fillStyle: `dots` }) as FreedrawElement;
  assert.deepEqual([filled.fill, filled.fillStyle], [`#2b6cb0`, `dots`]);
  assert.deepEqual([styleOf(filled)?.fill, styleOf(filled)?.fillStyle], [`#2b6cb0`, `dots`]);
  assert.equal(`fill` in applyStyle(open, { fill: `#2b6cb0` }), false, `un trait ouvert ne prend pas de remplissage`);
  assert.equal(`fill` in (applyStyle(filled, { fill: null }) as object), false);
  const half = applyStyle(filled, { fillOpacity: 0.5 }) as FreedrawElement;
  assert.equal(half.fillOpacity, 0.5);
});

test(`le remplissage d'un trait libre ferme est dessine sous la ligne, et on le touche a l'interieur`, () => {
  const ring = shaky(circle(100, 100, 50), 60, 2, 1, 1.0);
  const plain = penElement(ring, defaultStyle(`#000000`), `a`, 1, 5000) as FreedrawElement;
  const filled = applyStyle(plain, { fill: `#2b6cb0` }) as FreedrawElement;
  assert.equal(elementPaths(plain).pieces.length, 1);
  const pieces = elementPaths(filled).pieces;
  assert.ok(pieces.length >= 2, `un remplissage et un trait`);
  assert.equal(pieces[0].fill, `#2b6cb0`);
  assert.equal(pieces[pieces.length - 1].fill, `#000000`, `le trait est dessus`);
  assert.equal(hitElement(plain, [100, 100], 4), false, `sans remplissage le centre n'est pas touche`);
  assert.equal(hitElement(filled, [100, 100], 4), true, `avec remplissage le centre est touche`);
  assert.equal(hitElement(filled, [300, 300], 4), false);
});

test(`la regularite change le dessin d'un trait libre`, () => {
  const hand = shaky(circle(200, 150, 80), 120, 8, 3);
  const raw = penElement(hand, defaultStyle(`#000000`), `a`, 1, 5000) as FreedrawElement;
  const tidy = applyStyle(raw, { regularity: 5 }) as FreedrawElement;
  assert.notEqual(elementPaths(raw).pieces[0].d, elementPaths(tidy).pieces[0].d);
  assert.equal(elementPaths(tidy).pieces.length, 1);
});
