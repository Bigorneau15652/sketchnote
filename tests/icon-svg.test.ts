import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIconSvg } from "../src/icon-svg";
import { ellipsePath, isSafePath, parseCommands, pathToSubpaths, rectPath } from "../src/svg-path";

// The icon "house" of Lucide, as Obsidian gives it.
const HOUSE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`;

test(`les commandes d'un trace sont lues, avec leurs nombres, les separateurs courts et les arcs colles`, () => {
  assert.deepEqual(parseCommands(`M10 20L30 40`), [{ cmd: `M`, args: [10, 20] }, { cmd: `L`, args: [30, 40] }]);
  // A move followed by more numbers goes on with lines, and a command can be repeated without its letter.
  assert.deepEqual(parseCommands(`M0 0 10 10 20 0`)?.map((c) => c.cmd), [`M`, `L`, `L`]);
  assert.deepEqual(parseCommands(`m1-2.5.5-1`)?.map((c) => c.args), [[1, -2.5], [0.5, -1]]);
  assert.deepEqual(parseCommands(`M0 0h5v5H0z`)?.map((c) => c.cmd), [`M`, `h`, `v`, `H`, `z`]);
  // The flags of an arc can be written against each other and against the next number.
  const arc = parseCommands(`M0 0a1 1 0 011 1`);
  assert.deepEqual(arc?.[1], { cmd: `a`, args: [1, 1, 0, 0, 1, 1, 1] });
  assert.deepEqual(parseCommands(`M0 0 1e1 2E-1`)?.[1].args, [10, 0.2]);
  // What is not a path is refused.
  for (const bad of [`M0 0 <script>`, `X 1 2`, `M0`, `L5 5`, `M 1 2 javascript`, `M0 0 L 5`]) assert.equal(parseCommands(bad), null, bad);
  assert.equal(isSafePath(`M0 0L5 5Z`), true);
  assert.equal(isSafePath(`M0 0"onload=`), false);
  assert.equal(isSafePath(`M0 0`.repeat(10000)), false, `trop long`);
  assert.equal(isSafePath(5), false);
});

test(`un trace droit garde ses points, un trace ferme est ferme et sans point en double`, () => {
  const [square] = pathToSubpaths(`M0 0H10V10H0Z`) ?? [];
  assert.deepEqual(square.points, [[0, 0], [10, 0], [10, 10], [0, 10]]);
  assert.equal(square.closed, true);
  assert.equal(square.curved, false);
  const open = pathToSubpaths(`M0 0L5 5L10 0`)?.[0];
  assert.equal(open?.closed, false);
  // Relative commands.
  assert.deepEqual(pathToSubpaths(`m5 5l5 0 0 5z`)?.[0].points, [[5, 5], [10, 5], [10, 10]]);
  // Several parts, and a part that starts again after a Z.
  const two = pathToSubpaths(`M0 0L1 1M5 5L6 6`) ?? [];
  assert.equal(two.length, 2);
  assert.deepEqual(two[1].points[0], [5, 5]);
  const again = pathToSubpaths(`M0 0L4 0L4 4Z l2 2`) ?? [];
  assert.equal(again.length, 2, `apres Z, une nouvelle partie commence au depart`);
  assert.deepEqual(again[1].points[0], [0, 0]);
});

test(`une courbe a quelques points : celui du milieu s'ajoute, et un cercle en a huit`, () => {
  const cubic = pathToSubpaths(`M0 0C0 10 10 10 10 0`)?.[0];
  assert.equal(cubic?.curved, true);
  assert.equal(cubic?.points.length, 3);
  assert.deepEqual(cubic?.points[1], [5, 7.5], `le milieu de la courbe`);
  const quad = pathToSubpaths(`M0 0Q5 10 10 0`)?.[0];
  assert.deepEqual(quad?.points[1], [5, 5]);
  // Smooth commands reflect the previous control point.
  const smooth = pathToSubpaths(`M0 0C0 5 5 5 5 0S10 -5 10 0`)?.[0];
  assert.equal(smooth?.points.length, 5);
  const circle = pathToSubpaths(ellipsePath(12, 12, 5, 5))?.[0];
  assert.equal(circle?.closed, true);
  assert.equal(circle?.points.length, 8, `deux points pour chaque quart de tour`);
  for (const p of circle?.points ?? []) assert.ok(Math.abs(Math.hypot(p[0] - 12, p[1] - 12) - 5) < 0.01, `sur le cercle`);
  // An arc of a quarter of a turn gets two points.
  assert.equal(pathToSubpaths(`M0 0A5 5 0 0 1 5 5`)?.[0].points.length, 3);
  // A radius that is too small to reach is made larger, and a null radius gives a line.
  assert.ok((pathToSubpaths(`M0 0A1 1 0 0 1 10 0`)?.[0].points.length ?? 0) >= 3);
  assert.equal(pathToSubpaths(`M0 0A0 0 0 0 1 10 0`)?.[0].points.length, 2);
});

test(`un rectangle a coins arrondis est un trace ferme`, () => {
  assert.equal(rectPath(0, 0, 10, 4, 0, 0), `M0 0H10V4H0Z`);
  const rounded = pathToSubpaths(rectPath(2, 3, 20, 10, 4, 4))?.[0];
  assert.equal(rounded?.closed, true);
  assert.equal(rounded?.curved, true);
  // The radius cannot be larger than half of a side.
  const big = pathToSubpaths(rectPath(0, 0, 10, 4, 100, 100))?.[0];
  assert.ok(big && big.points.every((p) => p[0] >= -0.01 && p[0] <= 10.01 && p[1] >= -0.01 && p[1] <= 4.01));
});

test(`une icone de Lucide est lue en formes au trait, sans remplissage`, () => {
  const icon = parseIconSvg(HOUSE);
  assert.ok(icon);
  assert.deepEqual(icon?.vb, [0, 0, 24, 24]);
  assert.equal(icon?.shapes.length, 2);
  assert.ok(icon?.shapes.every((s) => s.stroke && !s.fill));
  assert.equal(icon?.shapes[1].closed, true);
  assert.equal(icon?.shapes[0].closed, false);
  assert.deepEqual(icon?.warnings, []);
});

test(`les cercles, rectangles, lignes et polylignes d'une icone deviennent des formes, les ronds et les rectangles restent reconnaissables`, () => {
  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="2" y1="2" x2="22" y2="2"/><polyline points="1 1 5 9 9 1"/><polygon points="0 0 4 0 2 3"/><ellipse cx="5" cy="5" rx="3" ry="2"/></svg>`;
  const icon = parseIconSvg(svg);
  assert.equal(icon?.shapes.length, 6);
  assert.deepEqual(icon?.shapes[0].prim, { kind: `ellipse`, cx: 12, cy: 12, rx: 10, ry: 10 });
  assert.deepEqual(icon?.shapes[1].prim, { kind: `rect`, x: 3, y: 4, w: 18, h: 12, r: 2 });
  assert.equal(icon?.shapes[2].d, `M2 2L22 2`);
  assert.equal(icon?.shapes[3].d, `M1 1L5 9L9 1`);
  assert.equal(icon?.shapes[3].closed, false);
  assert.equal(icon?.shapes[4].closed, true);
  assert.ok(icon?.shapes.every((s) => s.stroke && !s.fill));
});

test(`les dessins pleins d'un fichier de l'utilisateur gardent leur remplissage, la couleur d'origine est laissee`, () => {
  const svg = `<?xml version="1.0"?><!-- un commentaire --><svg xmlns="http://www.w3.org/2000/svg" width="48px" height="32px"><g fill="#ff0000"><path d="M0 0H10V10Z"/><path d="M20 0L30 10" stroke="blue" fill="none"/><path d="M0 20H5V30Z" style="fill:none;stroke:#000"/></g><circle cx="40" cy="10" r="4" fill="none"/></svg>`;
  const icon = parseIconSvg(svg);
  assert.deepEqual(icon?.vb, [0, 0, 48, 32], `la taille vient de width et height`);
  // The circle has no fill and no line: nothing to draw.
  assert.equal(icon?.shapes.length, 3);
  assert.deepEqual(icon?.shapes.map((s) => [s.fill, s.stroke]), [[true, false], [false, true], [false, true]]);
  assert.deepEqual(icon?.warnings, []);
  // The view box wins over the size.
  assert.deepEqual(parseIconSvg(`<svg viewBox="10 20 100 50" width="5" height="5"><path d="M0 0L1 1" stroke="black"/></svg>`)?.vb, [10, 20, 100, 50]);
  assert.deepEqual(parseIconSvg(`<svg><path d="M0 0L1 1" stroke="black"/></svg>`)?.vb, [0, 0, 24, 24], `sans taille, celle des icones`);
});

test(`ce que le plugin ne sait pas dessiner est laisse de cote et signale`, () => {
  const svg = `<svg viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><path d="M0 0H10V10Z" fill="url(#g)"/><text x="1" y="2">Bonjour</text><image href="x.png"/><path d="M1 1L5 5" stroke="black" transform="rotate(45)"/><g filter="url(#f)"><use href="#a"/></g><style>.a{fill:red}</style><clipPath id="c"><rect width="5" height="5"/></clipPath></svg>`;
  const icon = parseIconSvg(svg);
  assert.ok(icon);
  const w = new Set(icon?.warnings);
  for (const k of [`gradient`, `text`, `image`, `transform`, `use`, `style`, `clip`]) assert.ok(w.has(k as never), `${k} est signale: ${[...w]}`);
  // The shapes that can be drawn are kept: the one with a gradient counts as filled, the text and the image give nothing, the one with a transformation is kept as it is written.
  assert.equal(icon?.shapes.length, 2);
  // What is inside a skipped element is skipped too.
  assert.ok(!icon?.shapes.some((s) => s.d.includes(`5 5H`)));
  assert.equal(parseIconSvg(`<svg><g><defs><path d="M0 0L9 9" stroke="red"/></defs></g></svg>`), null, `rien a dessiner`);
});

test(`un fichier qui n'est pas un dessin, ou trop gros, ou dangereux, ne donne rien de risque`, () => {
  assert.equal(parseIconSvg(``), null);
  assert.equal(parseIconSvg(`hello`), null);
  assert.equal(parseIconSvg(`<html><body></body></html>`), null);
  assert.equal(parseIconSvg(`x`.repeat(300001)), null);
  // A path with anything else than path data is dropped.
  const evil = parseIconSvg(`<svg viewBox="0 0 24 24"><path d="M0 0L5 5" stroke="black"/><path d="M0 0 &quot; onload=alert(1)" stroke="black"/><path d="javascript:alert(1)" stroke="black"/></svg>`);
  assert.equal(evil?.shapes.length, 1);
  // Many shapes are cut at the limit.
  const many = parseIconSvg(`<svg viewBox="0 0 24 24" stroke="black">${`<path d="M0 0L1 1"/>`.repeat(500)}</svg>`);
  assert.equal(many?.shapes.length, 400);
  // Tags and attributes written in capitals or with single quotes.
  const odd = parseIconSvg(`<SVG viewBox='0 0 10 10'><PATH D='M0 0L5 5' STROKE='red'/></SVG>`);
  assert.equal(odd?.shapes.length, 1);
});
