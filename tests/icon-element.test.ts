import { test } from "node:test";
import assert from "node:assert/strict";
import { IconElement, readElements, SketchElement } from "../src/elements";
import { boxOf, hitElement, visibleSides } from "../src/geometry";
import { iconData, lucideData, setLucideSource } from "../src/icon-registry";
import { parseIconSvg } from "../src/icon-svg";
import { iconToElements, strokeCount } from "../src/icon-strokes";
import { elementPaths } from "../src/shape-paths";
import { canFill } from "../src/elements";
import { panelKinds, sectionShown } from "../src/panel-kinds";
import { resizeElement, resizeSide, translate, rotateBy } from "../src/transform";
import { applyStyle, styleOf } from "../src/style";
import { outlineExtent } from "../src/extent";

const SVGS: Record<string, string> = {
  house: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  circle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="2" y1="2" x2="22" y2="2"/></svg>`,
};
const reads: string[] = [];
setLucideSource((name) => {
  reads.push(name);
  return SVGS[name] ? parseIconSvg(SVGS[name]) : null;
});

const icon = (extra: Record<string, unknown> = {}): unknown => ({ id: `i`, type: `icon`, x: 100, y: 50, width: 96, height: 96, icon: `house`, stroke: `#000000`, strokeWidth: 4, seed: 7, ...extra });
const make = (extra: Record<string, unknown> = {}): IconElement => (readElements([icon(extra)]) as { ok: true; elements: SketchElement[] }).elements[0] as IconElement;

test(`un element icone relit son nom de Lucide, ou ses formes avec leur cadre, et refuse le reste`, () => {
  const lucide = readElements([icon()]);
  assert.equal(lucide.ok, true);
  const el = (lucide as { elements: IconElement[] }).elements[0];
  assert.deepEqual([el.type, el.icon, el.shapes], [`icon`, `house`, undefined]);
  const custom = readElements([icon({ icon: undefined, name: `Ma grue`, vb: [0, 0, 48, 32], shapes: [{ d: `M0 0H10V10Z`, fill: true, stroke: false, closed: true }] })]);
  assert.equal(custom.ok, true);
  const c = (custom as { elements: IconElement[] }).elements[0];
  assert.deepEqual([c.name, c.vb, c.shapes?.length], [`Ma grue`, [0, 0, 48, 32], 1]);
  const bads: Record<string, unknown>[] = [
    { icon: `House` }, { icon: `a b` }, { icon: 5 }, { icon: undefined }, { icon: `../x` },
    { icon: undefined, shapes: [], vb: [0, 0, 5, 5] },
    { icon: undefined, shapes: [{ d: `M0 0L1 1`, fill: false, stroke: true, closed: false }] },
    { icon: undefined, shapes: [{ d: `M0 0L1 1`, fill: false, stroke: true, closed: false }], vb: [0, 0, 0, 5] },
    { icon: undefined, shapes: [{ d: `M0 0 onload`, fill: false, stroke: true, closed: false }], vb: [0, 0, 5, 5] },
    { icon: undefined, shapes: [{ d: `M0 0L1 1`, fill: `yes`, stroke: true, closed: false }], vb: [0, 0, 5, 5] },
    { icon: undefined, shapes: [{ d: `M0 0L1 1`, fill: false, stroke: true }], vb: [0, 0, 5, 5] },
    { icon: undefined, shapes: [{ d: `M0 0L1 1`, fill: false, stroke: true, closed: false }], vb: [0, 0, 5] },
    { icon: undefined, shapes: Array.from({ length: 401 }, () => ({ d: `M0 0L1 1`, fill: false, stroke: true, closed: false })), vb: [0, 0, 5, 5] },
    { vb: [0, 0, 5, 5] }, { name: `x`.repeat(121) }, { width: 0 }, { x: Infinity },
  ];
  for (const bad of bads) assert.equal(readElements([icon(bad)]).ok, false, JSON.stringify(bad).slice(0, 80));
  // A file is not too heavy.
  const heavy = readElements([icon({ icon: undefined, vb: [0, 0, 5, 5], shapes: Array.from({ length: 30 }, () => ({ d: `M0 0L1 1`.repeat(1000), fill: false, stroke: true, closed: false })) })]);
  assert.equal(heavy.ok, false);
});

test(`les formes d'une icone viennent de Lucide par son nom, une seule lecture, ou de l'element lui-meme`, () => {
  reads.length = 0;
  const a = lucideData(`house`);
  const b = lucideData(`house`);
  assert.equal(a, b, `lue une seule fois`);
  assert.equal(reads.filter((r) => r === `house`).length, 1);
  assert.equal(lucideData(`inconnue`), null);
  assert.equal(iconData(make({ icon: `inconnue` })), null);
  const own = iconData(make({ icon: undefined, vb: [0, 0, 10, 10], shapes: [{ d: `M0 0L5 5`, fill: false, stroke: true, closed: false }] }));
  assert.deepEqual(own?.vb, [0, 0, 10, 10]);
  assert.equal(own?.shapes.length, 1);
  // Without a source, nothing is known.
  setLucideSource(null);
  assert.equal(lucideData(`house`), null);
  setLucideSource((name) => (SVGS[name] ? parseIconSvg(SVGS[name]) : null));
  assert.ok(lucideData(`house`));
});

test(`une icone est dessinee a la main levee dans sa boite, avec la largeur de trait de l'element`, () => {
  const el = make();
  const made = elementPaths(el);
  assert.ok(made.pieces.length >= 2, `des traits`);
  assert.ok(made.pieces.every((p) => p.stroke === `#000000` || p.stroke === `none`));
  // The view box (24) is put in the box of the element (96): a scale of 4 and a move to its corner.
  assert.match(made.inner ?? ``, /^translate\(100 50\) scale\(4 4\) translate\(0 0\)$/);
  assert.equal(made.transform, null, `the placing is inside the mirror of the element, so a mirrored icon stays in its box`);
  // The lines have the width that the element says once they are scaled.
  const outline = made.pieces.find((p) => p.outline === true);
  assert.ok(outline && Math.abs(outline.strokeWidth * 4 - 4) < 0.01, `largeur ${outline?.strokeWidth}`);
  // The imperfection changes the drawing, a clean line (0) is the same each time.
  const wild = elementPaths(make({ roughness: 3 })).pieces.map((p) => p.d).join(`|`);
  const clean = elementPaths(make({ roughness: 0 })).pieces.map((p) => p.d).join(`|`);
  const again = elementPaths(make({ roughness: 0 })).pieces.map((p) => p.d).join(`|`);
  assert.notEqual(wild, clean);
  assert.equal(clean, again, `le meme dessin a chaque fois`);
  // A rotation is the transform of the element, and the placing is inside it.
  assert.equal(elementPaths(make({ angle: 30 })).transform, `rotate(30 148 98)`);
  assert.match(elementPaths(make({ angle: 30 })).inner ?? ``, /^translate\(100 50\)/);
  // The wobble is as large as on a shape, not four times larger: the points of the hand drawn drawing stay near the clean ones.
  const nums = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const spread = Math.max(...nums(wild.split(`|`).join(` `))) - Math.min(...nums(wild.split(`|`).join(` `)));
  assert.ok(spread < 40, `reste dans le dessin de 24: ${spread}`);
  // A wider box makes a wider drawing.
  assert.match(elementPaths(make({ width: 48, height: 96 })).inner ?? ``, /scale\(2 4\)/);
});

test(`le remplissage d'une icone va aux formes fermees, les formes pleines d'un fichier gardent leur couleur`, () => {
  const plain = elementPaths(make({ icon: `circle` })).pieces;
  assert.ok(plain.every((p) => p.fill === `none`), `pas de remplissage au depart`);
  const filled = elementPaths(make({ icon: `circle`, fill: `#2b6cb0` })).pieces;
  assert.ok(filled.some((p) => p.fill === `#2b6cb0`), `les formes fermees sont remplies`);
  // The line has no fill: it is open, so it gets none.
  const house = elementPaths(make({ fill: `#2b6cb0` })).pieces.filter((p) => p.fill === `#2b6cb0`);
  assert.ok(house.length >= 1, `la maison est fermee`);
  // A shape that the file filled is filled with the colour of the line, whatever the fill of the element, and has no line when the file had none.
  const own = make({ icon: undefined, stroke: `#c0392b`, vb: [0, 0, 10, 10], shapes: [{ d: `M0 0H10V10Z`, fill: true, stroke: false, closed: true }, { d: `M0 10L10 0`, fill: false, stroke: true, closed: false }] });
  const pieces = elementPaths(own).pieces;
  assert.ok(pieces.some((p) => p.fill === `#c0392b` && p.stroke === `none`), `plein`);
  assert.ok(pieces.some((p) => p.stroke === `#c0392b` && p.fill === `none`), `trait`);
  assert.equal(pieces.filter((p) => p.outline === true).length >= 1, true);
  // The icon takes a fill from the style, and says so.
  assert.equal(canFill(make()), true);
  const withFill = applyStyle(make(), { fill: `#2b6cb0`, fillStyle: `hachure` }) as IconElement;
  assert.deepEqual([withFill.fill, withFill.fillStyle], [`#2b6cb0`, `hachure`]);
  assert.deepEqual([styleOf(withFill)?.fill, styleOf(withFill)?.fillStyle], [`#2b6cb0`, `hachure`]);
  assert.equal(applyStyle(withFill, { stroke: `#c0392b`, strokeWidth: 9 }).type, `icon`);
  assert.equal((applyStyle(withFill, { stroke: `#c0392b`, strokeWidth: 9 }) as IconElement).strokeWidth, 9);
});

test(`une icone inconnue est un carre en pointilles a sa place`, () => {
  const lost = elementPaths(make({ icon: `inconnue` }));
  assert.ok(lost.pieces.length >= 1);
  assert.ok(lost.pieces.every((p) => p.dash !== undefined), `en pointilles`);
  assert.equal(lost.transform, null);
});

test(`une icone se deplace, se tourne, se redimensionne en gardant ses proportions et se touche partout dans sa boite`, () => {
  const el = make();
  assert.deepEqual(boxOf(el), { box: { x: 100, y: 50, w: 96, h: 96 }, angle: 0 });
  const moved = translate(el, 10, -5) as IconElement;
  assert.deepEqual([moved.x, moved.y, moved.icon], [110, 45, `house`]);
  assert.equal((rotateBy(el, 45) as IconElement).angle, 45);
  // From a corner it keeps its proportions, like a picture.
  const big = resizeElement(el, 2, [296, 146], false) as IconElement;
  assert.ok(Math.abs(big.width / big.height - 1) < 0.001, `${big.width} x ${big.height}`);
  assert.ok(big.width > 150);
  // From a side it is stretched.
  const wide = resizeSide(el, 1, [296, 98], false) as IconElement;
  assert.ok(wide.width > 190 && wide.height === 96);
  assert.deepEqual(visibleSides(el), [0, 1, 2, 3]);
  // Touched inside its box (an icon is a drawing of thin lines).
  assert.equal(hitElement(el, [148, 98], 4), true);
  assert.equal(hitElement(el, [101, 51], 4), true);
  assert.equal(hitElement(el, [300, 300], 4), false);
  assert.ok(outlineExtent(el) >= 2);
});

test(`le panneau d'une icone montre la couleur, le remplissage, l'epaisseur et la transformation en traits`, () => {
  const kinds = panelKinds(`select`, [make()]);
  assert.deepEqual([...kinds], [`icon`]);
  for (const s of [`colour`, `fill`, `width`, `look`, `effects`, `icon`] as const) assert.equal(sectionShown(s, kinds), true, s);
  for (const s of [`border`, `corners`, `dash`, `edges`, `heads`, `text`, `warp`, `brush`] as const) assert.equal(sectionShown(s, kinds), false, s);
  assert.equal(sectionShown(`icon`, panelKinds(`select`, [])), false);
});

test(`une icone devient des traits groupes : des lignes arrondies pour les courbes, des ellipses et des rectangles pour les ronds et les rectangles`, () => {
  const el = make({ icon: `circle`, strokeWidth: 3, roughness: 2 });
  const data = lucideData(`circle`);
  assert.ok(data);
  assert.equal(strokeCount(data!), 3);
  const { elements, groupId } = iconToElements(el, data!, [el]);
  assert.equal(elements.length, 3);
  assert.ok(groupId);
  assert.ok(elements.every((e) => (e.groups ?? []).includes(groupId as string)));
  const [ellipse, rect, line] = elements;
  assert.equal(ellipse.type, `ellipse`);
  assert.equal(rect.type, `rect`);
  assert.equal(line.type, `line`);
  // The circle of 10 in a drawing of 24 in a box of 96: a radius of 40, centred in the box.
  if (ellipse.type === `ellipse`) assert.deepEqual([ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry], [148, 98, 40, 40]);
  if (rect.type === `rect`) assert.deepEqual([rect.x, rect.y, rect.width, rect.height, rect.radius], [112, 66, 72, 48, 8]);
  if (line.type === `line`) assert.deepEqual(line.points, [[108, 58], [188, 58]]);
  // The look of the icon is kept, and the identifiers are free.
  assert.ok(elements.every((e) => `stroke` in e && (e as { stroke: string }).stroke === `#000000` && (e as { strokeWidth: number }).strokeWidth === 3 && (e as { roughness?: number }).roughness === 2));
  assert.equal(new Set([el.id, ...elements.map((e) => e.id)]).size, 4);
});

test(`une icone a courbes devient une ligne arrondie, fermee quand elle l'est, et garde son placement tourne ou retourne`, () => {
  const el = make();
  const data = lucideData(`house`)!;
  const { elements } = iconToElements(el, data, [el]);
  assert.equal(elements.length, 2);
  for (const e of elements) {
    assert.equal(e.type, `line`);
    assert.equal((e as { rounded?: boolean }).rounded, true, `les courbes sont arrondies`);
  }
  const roof = elements[1] as { points: [number, number][] };
  assert.deepEqual(roof.points[0], roof.points[roof.points.length - 1], `la forme fermee revient a son depart`);
  assert.ok(roof.points.length < 40, `peu de points: ${roof.points.length}`);
  // The points are inside the box.
  for (const p of (elements as { points: [number, number][] }[]).flatMap((e) => e.points)) assert.ok(p[0] >= 99 && p[0] <= 197 && p[1] >= 49 && p[1] <= 147);
  // A mirrored icon gives mirrored points, and a turned one turned points.
  const mirrored = iconToElements(make({ flipX: true }), data, [el]).elements as { points: [number, number][] }[];
  const straight = elements as { points: [number, number][] }[];
  assert.ok(Math.abs(mirrored[0].points[0][0] - (2 * 148 - straight[0].points[0][0])) < 0.02);
  const turned = iconToElements(make({ angle: 90 }), data, [el]).elements as { points: [number, number][] }[];
  assert.ok(Math.abs(turned[0].points[0][0] - (148 - (straight[0].points[0][1] - 98))) < 0.05);
  // The effects of the icon pass to every element, a locked icon gives locked elements.
  const fx = iconToElements(make({ opacity: 0.5, locked: true }), data, [el]).elements;
  assert.ok(fx.every((e) => e.opacity === 0.5 && e.locked === true));
});

test(`une forme pleine devient un trace libre ferme et rempli, les autres formes fermees prennent le remplissage de l'icone`, () => {
  const own = make({ icon: undefined, stroke: `#c0392b`, vb: [0, 0, 10, 10], shapes: [{ d: `M0 0H10V10Z`, fill: true, stroke: false, closed: true }, { d: `M0 10L10 0`, fill: false, stroke: true, closed: false }] });
  const { elements } = iconToElements(own, iconData(own)!, [own]);
  assert.deepEqual(elements.map((e) => e.type), [`freedraw`, `line`]);
  const solid = elements[0] as { fill?: string; points: [number, number][] };
  assert.equal(solid.fill, `#c0392b`);
  assert.deepEqual(solid.points[0], solid.points[solid.points.length - 1]);
  // A Lucide circle with a fill: the ellipse and the rectangle are filled, the line is not.
  const filled = make({ icon: `circle`, fill: `#2b6cb0`, fillStyle: `dots` });
  const made = iconToElements(filled, lucideData(`circle`)!, [filled]).elements as unknown as { type: string; fill?: string; fillStyle?: string }[];
  assert.deepEqual(made.map((e) => [e.type, e.fill, e.fillStyle]), [[`ellipse`, `#2b6cb0`, `dots`], [`rect`, `#2b6cb0`, `dots`], [`line`, undefined, undefined]]);
  // One element needs no group.
  const one = make({ icon: undefined, vb: [0, 0, 10, 10], shapes: [{ d: `M0 0L10 10`, fill: false, stroke: true, closed: false }] });
  const single = iconToElements(one, iconData(one)!, [one]);
  assert.equal(single.elements.length, 1);
  assert.equal(single.groupId, null);
  assert.equal(`groups` in single.elements[0], false);
});
