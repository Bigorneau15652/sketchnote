import { test } from "node:test";
import assert from "node:assert/strict";
import { applySettings, remapFrames } from "../src/doc-ops";
import { DrawingElement, readElements, RectElement, SketchElement } from "../src/elements";
import { createEmptyDoc } from "../src/file-format";
import { addZone, buildStructure, defaultLayout, LAYOUT_LIMITS, LAYOUT_TYPES, LayoutSettings, ROW_LIMITS, Slot, slotIndexAt } from "../src/layout";
import { changeSize } from "../src/page-settings";

const frame = (slot: number | undefined, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}): DrawingElement =>
  ({ id: `f${slot ?? `x`}`, type: `drawing`, x, y, width: w, height: h, ...(slot === undefined ? {} : { slot }), path: null, ...extra }) as DrawingElement;

test(`ajouter une zone ajoute une colonne, une etape ou une bulle jusqu'au maximum`, () => {
  for (const type of LAYOUT_TYPES) {
    if (type === `modular`) continue;
    const l = LAYOUT_LIMITS[type];
    let layout: LayoutSettings | null = defaultLayout(type);
    let n = layout.count;
    while ((layout = addZone(layout))) n = layout.count;
    assert.equal(n, l.max, type);
  }
  assert.equal(addZone({ type: `popcorn`, count: 14, rows: 2 }), null);
  assert.equal(addZone({ type: `radial`, count: 8, rows: 2 })?.count, 9);
});

test(`dans la structure modulaire, une zone de plus ajoute d'abord une colonne puis une ligne`, () => {
  assert.deepEqual(addZone({ type: `modular`, count: 2, rows: 2 }), { type: `modular`, count: 3, rows: 2 });
  assert.deepEqual(addZone({ type: `modular`, count: 4, rows: 2 }), { type: `modular`, count: 4, rows: 3 });
  assert.equal(addZone({ type: `modular`, count: 4, rows: ROW_LIMITS.max }), null);
});

test(`une zone de plus donne au moins un emplacement de plus`, () => {
  const page = createEmptyDoc().page;
  for (const type of LAYOUT_TYPES) {
    const layout = defaultLayout(type);
    const more = addZone(layout);
    assert.ok(more, type);
    if (more) assert.ok(buildStructure(more, page).slots.length > buildStructure(layout, page).slots.length, type);
  }
});

test(`le point d'un emplacement est trouve, rectangle ou ellipse, et le vide ne donne rien`, () => {
  const slots: Slot[] = [
    { x: 0, y: 0, width: 100, height: 50, shape: `rect` },
    { x: 200, y: 0, width: 100, height: 100, shape: `ellipse` },
  ];
  assert.equal(slotIndexAt(slots, [50, 25]), 0);
  assert.equal(slotIndexAt(slots, [250, 50]), 1);
  assert.equal(slotIndexAt(slots, [205, 5]), -1);
  assert.equal(slotIndexAt(slots, [150, 25]), -1);
  assert.equal(slotIndexAt([], [1, 1]), -1);
});

test(`on trouve l'emplacement sous le centre de chaque emplacement d'une structure`, () => {
  const page = createEmptyDoc().page;
  for (const type of LAYOUT_TYPES) {
    const { slots } = buildStructure(defaultLayout(type), page);
    slots.forEach((s, i) => assert.equal(slotIndexAt(slots, [s.x + s.width / 2, s.y + s.height / 2]), i, `${type} ${i}`));
  }
});

test(`un cadre de dessin suit son emplacement quand les emplacements changent`, () => {
  const old: Slot[] = [{ x: 100, y: 100, width: 200, height: 100, shape: `ellipse` }];
  const next: Slot[] = [{ x: 400, y: 300, width: 100, height: 50, shape: `ellipse` }];
  // The frame is twice as wide as its slot and a little to the right: it keeps that, in proportion, in the new slot.
  const out = remapFrames([frame(0, 100, 100, 400, 200)], old, next)[0] as DrawingElement;
  assert.equal(out.width, 200);
  assert.equal(out.height, 100);
  assert.equal(out.x + out.width / 2, 450 + 50);
  assert.equal(out.y + out.height / 2, 325 + 25);
});

test(`un cadre dont l'emplacement a disparu devient libre et les autres elements ne bougent pas`, () => {
  const old: Slot[] = [{ x: 0, y: 0, width: 100, height: 100, shape: `rect` }, { x: 200, y: 0, width: 100, height: 100, shape: `rect` }];
  const next: Slot[] = [{ x: 0, y: 0, width: 100, height: 100, shape: `rect` }];
  const rect: SketchElement = { id: `r`, type: `rect`, x: 5, y: 5, width: 10, height: 10, stroke: `#000000`, strokeWidth: 2 };
  const free = frame(undefined, 20, 20, 50, 50);
  const [gone, r, f] = remapFrames([frame(1, 200, 0, 100, 100, { path: `D/g.sketchdraw` }), rect, free], old, next);
  assert.equal(`slot` in gone, false);
  assert.equal((gone as DrawingElement).x, 200);
  assert.equal(r, rect);
  assert.equal(f, free);
  // An empty frame goes with its zone.
  assert.equal(remapFrames([frame(1, 200, 0, 100, 100)], old, next).length, 0);
});

// Returns an element of a zone.
const inZone = (id: string, zone: number, x: number, y: number, w: number, h: number): SketchElement => ({ id, type: `rect`, x, y, width: w, height: h, stroke: `#000000`, strokeWidth: 4, slot: zone });

test(`une structure n'ajoute plus de cadre : ses zones sont ses emplacements`, () => {
  const doc0 = createEmptyDoc();
  for (const type of LAYOUT_TYPES) {
    const a = applySettings(doc0, doc0.page, defaultLayout(type));
    assert.equal(a.elements.filter((e) => e.type === `drawing`).length, 0, type);
    assert.equal(new Set(a.elements.map((e) => e.id)).size, a.elements.length, `${type} ids`);
  }
});

test(`ajouter une zone ou changer la taille de la page deplace les dessins de chaque zone avec elle`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`popcorn`));
  const from = buildStructure(defaultLayout(`popcorn`), a.page).slots[2];
  const drawn = { ...a, elements: [...a.elements, inZone(`d1`, 2, from.x + 10, from.y + 5, 40, 20)] };
  const more = addZone(defaultLayout(`popcorn`)) as LayoutSettings;
  const b = applySettings(drawn, drawn.page, more);
  const to = buildStructure(more, b.page).slots[2];
  const moved = b.elements.find((e) => e.id === `d1`) as RectElement;
  const k = Math.min(to.width / from.width, to.height / from.height);
  assert.ok(Math.abs(moved.width - 40 * k) < 0.5, `la taille suit la zone`);
  const centre = [moved.x + moved.width / 2, moved.y + moved.height / 2];
  const expected = [to.x + to.width / 2 + (from.x + 10 + 20 - (from.x + from.width / 2)) * k, to.y + to.height / 2 + (from.y + 5 + 10 - (from.y + from.height / 2)) * k];
  assert.ok(Math.abs(centre[0] - expected[0]) < 0.6 && Math.abs(centre[1] - expected[1]) < 0.6, `le dessin garde sa place dans la zone`);
  assert.equal(moved.slot, 2);
  const c = applySettings(b, changeSize(b.page, 1200, 1700), more);
  const t2 = buildStructure(more, c.page).slots[2];
  const m2 = c.elements.find((e) => e.id === `d1`) as RectElement;
  assert.ok(Math.abs(m2.x + m2.width / 2 - (t2.x + t2.width / 2)) < t2.width && Math.abs(m2.y + m2.height / 2 - (t2.y + t2.height / 2)) < t2.height, `le dessin reste dans sa zone apres un changement de taille de la page`);
});

test(`retirer des zones laisse libres les dessins des zones qui disparaissent`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, { type: `radial`, count: 6, rows: 2 });
  const slots = buildStructure({ type: `radial`, count: 6, rows: 2 }, a.page).slots;
  const last = slots.length - 1;
  const drawn = { ...a, elements: [...a.elements, inZone(`z1`, last, slots[last].x, slots[last].y, 30, 30), inZone(`z2`, 1, slots[1].x, slots[1].y, 30, 30)] };
  const b = applySettings(drawn, drawn.page, { type: `radial`, count: 3, rows: 2 });
  assert.equal(b.elements.find((e) => e.id === `z1`)?.slot, undefined);
  assert.equal(b.elements.find((e) => e.id === `z2`)?.slot, 1);
});

test(`retirer la structure laisse les dessins ou ils sont, sans zone`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`linear`));
  const drawn = { ...a, elements: [...a.elements, inZone(`q1`, 0, 30, 40, 100, 80)] };
  const b = applySettings(drawn, drawn.page, null);
  const q = b.elements.find((e) => e.id === `q1`) as RectElement;
  assert.deepEqual([q.x, q.y, q.width, q.height], [30, 40, 100, 80]);
  assert.equal(q.slot, undefined);
  assert.ok(b.elements.every((e) => e.group !== `structure`));
});

test(`les cadres de dessin des versions precedentes qui restent suivent encore leur zone`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`popcorn`));
  const from = buildStructure(defaultLayout(`popcorn`), a.page).slots[2];
  const old = { ...a, elements: [...a.elements, { id: `old1`, type: `drawing`, x: from.x, y: from.y, width: from.width, height: from.height, slot: 2, path: `D/x.sketchdraw` } as DrawingElement] };
  const more = addZone(defaultLayout(`popcorn`)) as LayoutSettings;
  const b = applySettings(old, old.page, more);
  const f = b.elements.find((e) => e.id === `old1`) as DrawingElement;
  const target = buildStructure(more, b.page).slots[2];
  assert.ok(Math.abs(f.x - target.x) < 0.5 && Math.abs(f.width - target.width) < 0.5);
});

test(`le numero d'emplacement d'un cadre est controle a la lecture`, () => {
  const make = (slot: unknown): unknown[] => [{ id: `c`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, slot, path: null }];
  assert.equal(readElements(make(3)).ok, true);
  assert.equal(readElements(make(undefined)).ok, true);
  for (const bad of [-1, 1.5, `2`, 5000, null, NaN]) assert.equal(readElements(make(bad)).ok, false, String(bad));
});
