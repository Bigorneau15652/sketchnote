import { test } from "node:test";
import assert from "node:assert/strict";
import { applySettings, ensureZoneFrames, remapFrames } from "../src/doc-ops";
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
  const [gone, r, f] = remapFrames([frame(1, 200, 0, 100, 100, { path: `D/g.sketchdraw` }), rect, free], old, next);
  assert.equal(`slot` in gone, false);
  assert.equal((gone as DrawingElement).x, 200);
  assert.equal(r, rect);
  assert.equal(f, free);
  // An empty frame goes with its zone.
  assert.equal(remapFrames([frame(1, 200, 0, 100, 100)], old, next).length, 0);
});

// Returns the frame of a slot of a document.
const frameOf = (doc: { elements: SketchElement[] }, slot: number): DrawingElement => doc.elements.find((e) => e.type === `drawing` && e.slot === slot) as DrawingElement;

test(`chaque zone d'une structure a son cadre vide qui remplit son emplacement`, () => {
  const doc0 = createEmptyDoc();
  for (const type of LAYOUT_TYPES) {
    const a = applySettings(doc0, doc0.page, defaultLayout(type));
    const slots = buildStructure(defaultLayout(type), a.page).slots;
    const frames = a.elements.filter((e): e is DrawingElement => e.type === `drawing`);
    assert.equal(frames.length, slots.length, type);
    slots.forEach((s, i) => {
      const f = frameOf(a, i);
      assert.ok(f.path === null && f.shape === s.shape, `${type} ${i}`);
      assert.ok(Math.abs(f.x - s.x) < 0.2 && Math.abs(f.width - s.width) < 0.2 && Math.abs(f.height - s.height) < 0.2, `${type} ${i} fills its slot`);
    });
    assert.equal(new Set(a.elements.map((e) => e.id)).size, a.elements.length, `${type} ids`);
  }
});

test(`ajouter une zone ajoute son cadre et garde les autres cadres et leurs dessins`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`popcorn`));
  const drawn = { ...a, elements: a.elements.map((e) => (e.type === `drawing` && e.slot === 2 ? { ...e, path: `D/x.sketchdraw` } : e)) };
  const more = addZone(defaultLayout(`popcorn`)) as LayoutSettings;
  const b = applySettings(drawn, drawn.page, more);
  assert.equal(b.elements.filter((e) => e.type === `drawing`).length, buildStructure(more, b.page).slots.length);
  const f = frameOf(b, 2);
  const target = buildStructure(more, b.page).slots[2];
  assert.equal(f.path, `D/x.sketchdraw`);
  assert.ok(Math.abs(f.x - target.x) < 0.5 && Math.abs(f.width - target.width) < 0.5, `frame follows its slot`);
  const c = applySettings(b, changeSize(b.page, 1200, 1700), more);
  const g = frameOf(c, 2);
  const t2 = buildStructure(more, c.page).slots[2];
  assert.ok(Math.abs(g.x + g.width / 2 - (t2.x + t2.width / 2)) < 1 && Math.abs(g.y + g.height / 2 - (t2.y + t2.height / 2)) < 1, `frame stays centred on its slot after a page resize`);
  // The empty zones keep filling their zones, even when the proportions of the page change.
  const empty = frameOf(c, 0);
  const s0 = buildStructure(more, c.page).slots[0];
  assert.ok(Math.abs(empty.x - s0.x) < 0.2 && Math.abs(empty.y - s0.y) < 0.2 && Math.abs(empty.width - s0.width) < 0.2 && Math.abs(empty.height - s0.height) < 0.2);
});

test(`un cadre agrandi par l'utilisateur garde sa taille relative a sa zone`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`popcorn`));
  const slot = buildStructure(defaultLayout(`popcorn`), a.page).slots[1];
  const big = { ...a, elements: a.elements.map((e) => (e.type === `drawing` && e.slot === 1 ? { ...e, path: `D/y.sketchdraw`, x: slot.x - slot.width / 2, width: slot.width * 2, y: slot.y - 10, height: slot.height * 2 } : e)) };
  const more = addZone(defaultLayout(`popcorn`)) as LayoutSettings;
  const b = applySettings(big, big.page, more);
  const f = frameOf(b, 1);
  const to = buildStructure(more, b.page).slots[1];
  assert.ok(Math.abs(f.width / to.width - 2) < 0.02, `still twice as wide as its zone: ${f.width / to.width}`);
});

test(`retirer des zones supprime les cadres vides et laisse libres les cadres qui ont un dessin`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, { type: `radial`, count: 6, rows: 2 });
  const last = a.elements.filter((e): e is DrawingElement => e.type === `drawing`).length - 1;
  const drawn = { ...a, elements: a.elements.map((e) => (e.type === `drawing` && e.slot === last ? { ...e, path: `D/z.sketchdraw` } : e)) };
  const b = applySettings(drawn, drawn.page, { type: `radial`, count: 3, rows: 2 });
  const frames = b.elements.filter((e): e is DrawingElement => e.type === `drawing`);
  assert.equal(frames.filter((f) => f.slot !== undefined).length, 4);
  const free = frames.filter((f) => f.slot === undefined);
  assert.equal(free.length, 1);
  assert.equal(free[0].path, `D/z.sketchdraw`);
});

test(`retirer la structure supprime les zones vides et laisse les dessins ou ils sont`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`linear`));
  const drawn = { ...a, elements: a.elements.map((e) => (e.type === `drawing` && e.slot === 0 ? { ...e, path: `D/q.sketchdraw`, x: 30, y: 40, width: 100, height: 80 } : e)) };
  const b = applySettings(drawn, drawn.page, null);
  const frames = b.elements.filter((e) => e.type === `drawing`) as DrawingElement[];
  assert.equal(frames.length, 1);
  assert.deepEqual([frames[0].x, frames[0].y, frames[0].width, frames[0].height], [30, 40, 100, 80]);
  assert.equal(frames[0].slot, undefined);
});

test(`une page des versions precedentes recoit les cadres qui lui manquent a l'ouverture, sans changer ceux qui existent`, () => {
  const doc0 = createEmptyDoc();
  const a = applySettings(doc0, doc0.page, defaultLayout(`modular`));
  const slots = buildStructure(defaultLayout(`modular`), a.page).slots;
  // An old page: only one frame, in slot 3, without a shape.
  const old = { ...a, elements: [...a.elements.filter((e) => e.type !== `drawing`), { id: `old1`, type: `drawing`, x: 1, y: 2, width: 30, height: 20, slot: 3, path: `D/o.sketchdraw` } as DrawingElement] };
  const fixed = ensureZoneFrames(old);
  assert.equal(fixed.elements.filter((e) => e.type === `drawing`).length, slots.length);
  const kept = frameOf(fixed, 3);
  assert.equal(kept.id, `old1`);
  assert.deepEqual([kept.x, kept.y, kept.width, kept.height], [1, 2, 30, 20]);
  assert.equal(kept.shape, slots[3].shape);
  assert.equal(ensureZoneFrames(fixed), fixed);
  assert.equal(ensureZoneFrames(createEmptyDoc()).elements.length, 0);
});

test(`le numero d'emplacement d'un cadre est controle a la lecture`, () => {
  const make = (slot: unknown): unknown[] => [{ id: `c`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, slot, path: null }];
  assert.equal(readElements(make(3)).ok, true);
  assert.equal(readElements(make(undefined)).ok, true);
  for (const bad of [-1, 1.5, `2`, 5000, null, NaN]) assert.equal(readElements(make(bad)).ok, false, String(bad));
});
