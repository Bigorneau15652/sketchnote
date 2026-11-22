import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, RectElement } from "../src/elements";
import { elementBounds, tailFromPage, tailPagePoint } from "../src/geometry";
import { labelBox } from "../src/labels";
import { elementPaths } from "../src/shape-paths";
import { applyStyle, defaultStyle, styleOf } from "../src/style";
import { BUBBLE_FORMS, DEFAULT_TAIL, FESTOON_FORMS, formPath, formRoom, isShapeForm, readTail } from "../src/shape-forms";
import { elementFromDrag } from "../src/tools";
import { panelKinds, sectionShown } from "../src/panel-kinds";

const none = { shift: false, alt: false };
const bubble: RectElement = { id: `b`, type: `rect`, x: 100, y: 100, width: 200, height: 100, stroke: `#000000`, strokeWidth: 3, form: `oval` };

// Every number of a path of a form, to check the form stays finite and in a reasonable place.
function numbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

test(`chaque forme donne un trace ferme fait de commandes sures`, () => {
  for (const form of [...BUBBLE_FORMS, ...FESTOON_FORMS]) {
    const d = formPath(form, 0, 0, 200, 100);
    assert.match(d, /^[MLZ0-9.,\s-]+$/, form);
    assert.ok(d.startsWith(`M`) && d.trim().endsWith(`Z`), form);
    assert.ok(numbers(d).every((n) => Number.isFinite(n)), form);
  }
});

test(`un feston reste dans sa boite et une bulle ne depasse que par sa queue`, () => {
  for (const form of FESTOON_FORMS) {
    const n = numbers(formPath(form, 0, 0, 200, 100));
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    assert.ok(Math.min(...xs) >= -0.5 && Math.max(...xs) <= 200.5 && Math.min(...ys) >= -0.5 && Math.max(...ys) <= 100.5, form);
  }
  const ys = numbers(formPath(`oval`, 0, 0, 200, 100, [0, 1.5])).filter((_, i) => i % 2 === 1);
  assert.ok(Math.max(...ys) > 140, `la queue va jusqu au point demande`);
  const around = numbers(formPath(`oval`, 0, 0, 200, 100, [0, 1.5])).filter((_, i) => i % 2 === 0);
  assert.ok(Math.min(...around) >= -0.5 && Math.max(...around) <= 200.5);
});

test(`la queue suit le point demande dans les quatre directions`, () => {
  for (const [tx, ty] of [[0, 1.2], [0, -1.2], [1.2, 0], [-1.2, 0]] as [number, number][]) {
    const n = numbers(formPath(`rounded`, 0, 0, 200, 100, [tx, ty]));
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    const tip = [100 + tx * 200, 50 + ty * 100];
    assert.ok(xs.some((x, i) => Math.abs(x - tip[0]) < 0.6 && Math.abs(ys[i] - tip[1]) < 0.6), `pointe en ${tx},${ty}`);
  }
});

test(`un nuage de pensee a ses petits cercles et une forme inconnue est refusee`, () => {
  const d = formPath(`thought`, 0, 0, 200, 100);
  assert.ok((d.match(/M/g) ?? []).length === 4, `le nuage et trois cercles`);
  assert.equal(isShapeForm(`oval`), true);
  assert.equal(isShapeForm(`sphere`), false);
  assert.equal(isShapeForm(undefined), false);
});

test(`la queue est lue avec ses limites`, () => {
  assert.deepEqual(readTail([0.3, 0.8]), [0.3, 0.8]);
  assert.deepEqual(readTail([99, -99]), [2.5, -2.5]);
  for (const bad of [[1], [1, 2, 3], [`a`, 1], [NaN, 0], null, 5, {}]) assert.equal(readTail(bad), null);
});

test(`une bulle est relue d un fichier et les valeurs fausses refusent le fichier`, () => {
  const ok = readElements([{ ...bubble, tail: [0.2, 0.9] }]);
  assert.equal(ok.ok, true);
  assert.deepEqual((ok as { elements: RectElement[] }).elements[0].form, `oval`);
  assert.deepEqual((ok as { elements: RectElement[] }).elements[0].tail, [0.2, 0.9]);
  assert.equal(readElements([{ ...bubble, form: `cube` }]).ok, false);
  assert.equal(readElements([{ ...bubble, tail: `x` }]).ok, false);
  assert.equal(readElements([{ id: `d`, type: `diamond`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 2, tail: [0, 0] }]).ok, false);
});

test(`les traces d une bulle et d un feston sont calcules`, () => {
  const paths = elementPaths(bubble);
  assert.ok(paths.pieces.length > 0);
  assert.ok(paths.pieces.every((p) => /^[MLCQTZmlcqtz0-9eE.,\s+-]*$/.test(p.d)));
  assert.ok(elementPaths({ ...bubble, id: `f`, form: `ribbon` }).pieces.length > 0);
});

test(`la queue sort de la boite : les limites la comptent et le point tourne avec la bulle`, () => {
  const b = elementBounds({ ...bubble, tail: [0, 1.5] });
  assert.ok(b.y + b.h > 240);
  const turned: RectElement = { ...bubble, angle: 90, tail: [0, 1] };
  const tip = tailPagePoint(turned);
  assert.ok(Math.abs(tip[0] - 100) < 0.01 && Math.abs(tip[1] - 150) < 0.01, `la queue d en bas va a gauche quand la bulle tourne de 90 degres`);
  const back = tailFromPage(turned, tip);
  assert.ok(Math.abs(back[0] - 0) < 0.01 && Math.abs(back[1] - 1) < 0.01);
  const flipped: RectElement = { ...bubble, flipX: true, tail: [0.3, 0.8] };
  assert.ok(tailPagePoint(flipped)[0] < 200, `une bulle retournee a sa queue de l autre cote`);
  assert.deepEqual(tailFromPage(flipped, tailPagePoint(flipped)), [0.3, 0.8]);
  assert.deepEqual(tailFromPage(bubble, tailPagePoint(bubble)), DEFAULT_TAIL);
});

test(`le texte d une forme tient dans la place que la forme lui laisse`, () => {
  for (const form of [...BUBBLE_FORMS, ...FESTOON_FORMS]) {
    const r = formRoom(form);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1 && r.w > 0.3 && r.h > 0.3, form);
    const box = labelBox({ ...bubble, form });
    assert.ok(box.x >= bubble.x && box.y >= bubble.y && box.x + box.w <= bubble.x + bubble.width && box.y + box.h <= bubble.y + bubble.height, form);
  }
});

test(`les outils bulle et feston font un rectangle avec la forme choisie`, () => {
  const style = { ...defaultStyle(`#000000`), bubbleForm: `shout` as const, festoonForm: `wave` as const };
  const b = elementFromDrag(`bubble`, [10, 10], [210, 110], none, style, `b1`, 1) as RectElement;
  assert.equal(b.type, `rect`);
  assert.equal(b.form, `shout`);
  assert.equal(b.tail, undefined);
  const f = elementFromDrag(`festoon`, [10, 10], [210, 110], none, style, `f1`, 1) as RectElement;
  assert.equal(f.form, `wave`);
  assert.equal(elementFromDrag(`bubble`, [10, 10], [11, 11], none, style, `b2`, 1), null);
});

test(`le style d une bulle change sa forme sans toucher a un rectangle`, () => {
  const style = defaultStyle(`#000000`);
  assert.equal((applyStyle(bubble, { bubbleForm: `thought` }) as RectElement).form, `thought`);
  // A festoon form given to a bubble, or a bubble form to a festoon, is not applied.
  assert.equal((applyStyle(bubble, { festoonForm: `tag` }) as RectElement).form, `oval`);
  const plain: RectElement = { id: `p`, type: `rect`, x: 0, y: 0, width: 10, height: 10, stroke: `#000000`, strokeWidth: 2 };
  assert.equal((applyStyle(plain, { bubbleForm: `thought` }) as RectElement).form, undefined);
  assert.equal(styleOf({ ...bubble, form: `rounded` })?.bubbleForm, `rounded`);
  assert.equal(styleOf({ ...bubble, form: `tag` })?.festoonForm, `tag`);
  assert.equal(styleOf(plain)?.bubbleForm, style.bubbleForm);
});

test(`le menu d une bulle montre sa forme et pas les coins`, () => {
  const kinds = panelKinds(`select`, [bubble]);
  assert.deepEqual([...kinds], [`bubble`]);
  assert.equal(sectionShown(`bubbleform`, kinds), true);
  assert.equal(sectionShown(`festoonform`, kinds), false);
  assert.equal(sectionShown(`corners`, kinds), false);
  assert.equal(sectionShown(`fill`, kinds), true);
  const tool = panelKinds(`festoon`, []);
  assert.equal(sectionShown(`festoonform`, tool), true);
  assert.equal(sectionShown(`bubbleform`, tool), false);
  const labelled = panelKinds(`select`, [{ ...bubble, label: { text: `Salut`, font: `caveat`, size: 32 } }]);
  assert.equal(sectionShown(`text`, labelled), true);
});

test(`la bulle rectangulaire a de petits coins ronds et une queue fine, courbe d un cote, qui sort du cote ou elle pointe`, () => {
  const points = (d: string): [number, number][] => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const tipOf = (tail: [number, number]): [number, number] => [100 + 0.5 * 200 + tail[0] * 200, 50 + 0.5 * 100 + tail[1] * 100];
  for (const tail of [[-0.28, 0.78], [0.3, 0.85], [0.9, 0.1], [-0.9, 0.1], [0.1, -0.85]] as [number, number][]) {
    const pts = points(formPath(`rounded`, 100, 50, 200, 100, tail));
    const tip = tipOf(tail);
    assert.ok(pts.some((p) => Math.abs(p[0] - tip[0]) < 0.06 && Math.abs(p[1] - tip[1]) < 0.06), `la queue arrive a son point : ${tail}`);
    // the box itself is only left for the tail: nothing of the outline is outside of the box but the tail
    const outside = pts.filter((p) => p[0] < 99.9 || p[0] > 300.1 || p[1] < 49.9 || p[1] > 150.1);
    assert.ok(outside.length >= 8 && outside.length <= 20, `une queue fine : ${outside.length} points hors de la boite`);
  }
  // a tail that stays in the box is not drawn
  const inside = points(formPath(`rounded`, 100, 50, 200, 100, [0.1, 0.1]));
  assert.ok(inside.every((p) => p[0] >= 99.9 && p[0] <= 300.1 && p[1] >= 49.9 && p[1] <= 150.1));
  // the corners are small
  const corner = points(formPath(`rounded`, 100, 50, 200, 100, [-0.28, 0.78])).filter((p) => p[1] < 50.5 && p[0] < 110);
  assert.ok(corner.length > 0 && Math.min(...corner.map((p) => p[0])) > 100);
});
