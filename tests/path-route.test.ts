import { test } from "node:test";
import assert from "node:assert/strict";
import { ArrowElement, EllipseElement } from "../src/elements";
import { buildStructure, defaultLayout, LAYOUT_LIMITS, normalizeLayout, readLayout, sameLayout, Slot } from "../src/layout";
import { DEFAULT_PATH_DIRECTION, DEFAULT_PATH_SHAPE, isPathDirection, isPathShape, PATH_DIRECTIONS, PATH_SHAPES, planRoute } from "../src/path-route";

// The pages of the usual formats and orientations (the smallest custom page, 300 by 300, is left out: its zones are too small to be told apart).
const PAGES: [number, number][] = [[794, 1123], [1123, 794], [1280, 720], [720, 1280], [1000, 1000], [559, 794], [1587, 1123]];
const area = { x: 56, y: 200, w: 1011, h: 540 };

// The box of the ellipse inscribed in a slot, shrunk to the rectangle that is surely inside it.
const core = (s: Slot): { x: number; y: number; w: number; h: number } => ({ x: s.x + s.width * 0.15, y: s.y + s.height * 0.15, w: s.width * 0.7, h: s.height * 0.7 });
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// Tells whether a segment crosses a box.
function crosses(p: number[], q: number[], b: { x: number; y: number; w: number; h: number }): boolean {
  for (let t = 0; t <= 1; t += 0.01) {
    const x = p[0] + (q[0] - p[0]) * t;
    const y = p[1] + (q[1] - p[1]) * t;
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

test(`le chemin par defaut est le serpent de haut en bas, et les valeurs fausses sont remplacees`, () => {
  assert.equal(DEFAULT_PATH_SHAPE, `snake`);
  assert.equal(DEFAULT_PATH_DIRECTION, `down`);
  assert.deepEqual(defaultLayout(`path`), { type: `path`, count: 5, rows: 2, shape: `snake`, direction: `down` });
  assert.equal(`shape` in defaultLayout(`radial`), false);
  assert.deepEqual(readLayout({ type: `path`, count: 4, rows: 2 }), { type: `path`, count: 4, rows: 2, shape: `snake`, direction: `down` });
  assert.deepEqual(readLayout({ type: `path`, count: 4, rows: 2, shape: `zigzag`, direction: `up-left` }), { type: `path`, count: 4, rows: 2, shape: `zigzag`, direction: `up-left` });
  assert.deepEqual(readLayout({ type: `path`, count: 4, rows: 2, shape: `cube`, direction: `ailleurs` }), { type: `path`, count: 4, rows: 2, shape: `snake`, direction: `down` });
  assert.equal(`shape` in (readLayout({ type: `radial`, count: 4, rows: 2, shape: `zigzag` }) ?? {}), false);
  assert.equal(isPathShape(`steps`), true);
  assert.equal(isPathDirection(`down-left`), true);
  assert.equal(isPathDirection(`diagonal`), false);
  assert.equal(PATH_SHAPES.length, 4);
  assert.equal(PATH_DIRECTIONS.length, 8);
});

test(`changer la forme ou le sens change la structure`, () => {
  const a = defaultLayout(`path`);
  assert.equal(sameLayout(a, { ...a }), true);
  assert.equal(sameLayout(a, { ...a, shape: `zigzag` }), false);
  assert.equal(sameLayout(a, { ...a, direction: `up` }), false);
  const r = defaultLayout(`radial`);
  assert.equal(sameLayout(r, { ...r, shape: `zigzag` }), true);
  assert.deepEqual(normalizeLayout({ type: `path`, count: 99, rows: 2, shape: `steps` }), { type: `path`, count: 10, rows: 2, shape: `steps`, direction: `down` });
});

test(`chaque forme dans chaque sens a une fleche qui traverse la page et un point par etape sur la fleche`, () => {
  for (const shape of PATH_SHAPES) for (const direction of PATH_DIRECTIONS) {
    for (let n = LAYOUT_LIMITS.path.min; n <= LAYOUT_LIMITS.path.max; n++) {
      const route = planRoute(shape, direction, n, area);
      assert.equal(route.steps.length, n, `${shape} ${direction} ${n}`);
      assert.ok(route.line.length >= 2);
      const xs = route.line.map((p) => p[0]);
      const ys = route.line.map((p) => p[1]);
      assert.ok(Math.min(...xs) >= area.x - 1 && Math.max(...xs) <= area.x + area.w + 1 && Math.min(...ys) >= area.y - 1 && Math.max(...ys) <= area.y + area.h + 1, `${shape} ${direction} ${n} reste dans la page`);
      // Each point is on the arrow.
      for (const st of route.steps) {
        let best = Infinity;
        for (let i = 0; i + 1 < route.line.length; i++) {
          const [a, b] = [route.line[i], route.line[i + 1]];
          const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
          const t = Math.max(0, Math.min(1, ((st.point[0] - a[0]) * (b[0] - a[0]) + (st.point[1] - a[1]) * (b[1] - a[1])) / len2));
          best = Math.min(best, Math.hypot(st.point[0] - (a[0] + t * (b[0] - a[0])), st.point[1] - (a[1] + t * (b[1] - a[1]))));
        }
        assert.ok(best < 2, `${shape} ${direction} ${n} : un point est sur la fleche`);
      }
      assert.ok(Math.abs(Math.hypot(...route.steps[0].side) - 1) < 1e-6);
    }
  }
});

test(`le sens decide d ou la fleche part et ou elle arrive`, () => {
  const ends = (d: (typeof PATH_DIRECTIONS)[number]): { s: number[]; e: number[] } => {
    const r = planRoute(`diagonal`, d, 5, area);
    return { s: r.line[0], e: r.line[r.line.length - 1] };
  };
  assert.ok(ends(`down`).s[1] < ends(`down`).e[1]);
  assert.ok(ends(`up`).s[1] > ends(`up`).e[1]);
  assert.ok(ends(`right`).s[0] < ends(`right`).e[0]);
  assert.ok(ends(`left`).s[0] > ends(`left`).e[0]);
  assert.ok(ends(`down-right`).s[0] < ends(`down-right`).e[0] && ends(`down-right`).s[1] < ends(`down-right`).e[1]);
  assert.ok(ends(`up-left`).s[0] > ends(`up-left`).e[0] && ends(`up-left`).s[1] > ends(`up-left`).e[1]);
  assert.ok(ends(`down-left`).s[0] > ends(`down-left`).e[0] && ends(`down-left`).s[1] < ends(`down-left`).e[1]);
  assert.ok(ends(`up-right`).s[0] < ends(`up-right`).e[0] && ends(`up-right`).s[1] > ends(`up-right`).e[1]);
  // The steps follow the arrow in the order of its direction.
  const r = planRoute(`snake`, `up`, 6, area);
  for (let i = 1; i < r.steps.length; i++) assert.ok(r.steps[i].point[1] < r.steps[i - 1].point[1]);
});

test(`la structure dessine une fleche, un point par etape et une zone a cote, sans que les zones se chevauchent ni coupent la fleche`, () => {
  for (const [pw, ph] of PAGES) for (const shape of PATH_SHAPES) for (const direction of PATH_DIRECTIONS) {
    for (let n = LAYOUT_LIMITS.path.min; n <= LAYOUT_LIMITS.path.max; n++) {
      const name = `${pw}x${ph} ${shape} ${direction} ${n}`;
      const page = { width: pw, height: ph, ink: `#1a1a1a`, background: `#ffffff`, palette: [`#1a1a1a`] } as never;
      const st = buildStructure({ type: `path`, count: n, rows: 2, shape, direction }, page);
      const arrows = st.elements.filter((e): e is ArrowElement => e.type === `arrow`);
      const dots = st.elements.filter((e): e is EllipseElement => e.type === `ellipse`);
      assert.equal(arrows.length, 1, name);
      assert.equal(dots.length, n, name);
      assert.equal(st.slots.length, n + 1, name);
      assert.ok(st.elements.every((e) => e.group === `structure`), name);
      const zones = st.slots.slice(1);
      zones.forEach((z, i) => {
        assert.ok(z.x >= -0.5 && z.y >= -0.5 && z.x + z.width <= pw + 0.5 && z.y + z.height <= ph + 0.5, `${name} zone ${i} dans la page`);
        assert.ok(z.width > 20 && z.height > 12, `${name} zone ${i} assez grande`);
        // The zone is beside its point and does not cover it.
        const d = dots[i];
        assert.ok(!overlap(core(z), { x: d.cx - d.rx, y: d.cy - d.rx, w: 2 * d.rx, h: 2 * d.rx }), `${name} zone ${i} ne couvre pas son point`);
        for (let k = 0; k + 1 < arrows[0].points.length; k++) assert.ok(!crosses(arrows[0].points[k], arrows[0].points[k + 1], core(z)), `${name} zone ${i} ne coupe pas la fleche`);
        for (let j = 0; j < i; j++) assert.ok(!overlap(core(z), core(zones[j])), `${name} zones ${j} et ${i} ne se chevauchent pas`);
      });
    }
  }
});
