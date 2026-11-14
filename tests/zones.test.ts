import { test } from "node:test";
import assert from "node:assert/strict";
import { applySettings, remapFrames } from "../src/doc-ops";
import { DrawingElement, readElements, SketchElement } from "../src/elements";
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
  const [gone, r, f] = remapFrames([frame(1, 200, 0, 100, 100), rect, free], old, next);
  assert.equal(`slot` in gone, false);
  assert.equal((gone as DrawingElement).x, 200);
  assert.equal(r, rect);
  assert.equal(f, free);
});

test(`changer le nombre de zones ou la taille de la page replace les cadres dans leurs emplacements`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`popcorn`));
  const slots = buildStructure(defaultLayout(`popcorn`), a.page).slots;
  const framed = { ...a, elements: [...a.elements, frame(2, slots[2].x, slots[2].y, slots[2].width, slots[2].height, { path: `D/x.sketchdraw` })] };
  const more = addZone(defaultLayout(`popcorn`)) as LayoutSettings;
  const b = applySettings(framed, framed.page, more);
  const f = b.elements.find((e) => e.type === `drawing`) as DrawingElement;
  const target = buildStructure(more, b.page).slots[2];
  assert.ok(Math.abs(f.x - target.x) < 0.5 && Math.abs(f.width - target.width) < 0.5, `frame follows its slot`);
  assert.equal(f.path, `D/x.sketchdraw`);
  const c = applySettings(b, changeSize(b.page, 1200, 1700), more);
  const g = c.elements.find((e) => e.type === `drawing`) as DrawingElement;
  const t2 = buildStructure(more, c.page).slots[2];
  assert.ok(Math.abs(g.x - t2.x) < 0.5 && Math.abs(g.y - t2.y) < 0.5, `frame follows its slot after a page resize`);
  // The structure elements of the frame's drawing never leak into the user's elements.
  assert.equal(c.elements.filter((e) => e.type === `drawing`).length, 1);
});

test(`retirer la structure laisse les cadres ou ils sont`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`linear`));
  const framed = { ...a, elements: [...a.elements, frame(0, 30, 40, 100, 80)] };
  const b = applySettings(framed, framed.page, null);
  const f = b.elements.find((e) => e.type === `drawing`) as DrawingElement;
  assert.deepEqual([f.x, f.y, f.width, f.height], [30, 40, 100, 80]);
});

test(`le numero d'emplacement d'un cadre est controle a la lecture`, () => {
  const make = (slot: unknown): unknown[] => [{ id: `c`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, slot, path: null }];
  assert.equal(readElements(make(3)).ok, true);
  assert.equal(readElements(make(undefined)).ok, true);
  for (const bad of [-1, 1.5, `2`, 5000, null, NaN]) assert.equal(readElements(make(bad)).ok, false, String(bad));
});
