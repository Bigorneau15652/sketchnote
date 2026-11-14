import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDoc, PageSettings } from "../src/file-format";
import { readElements } from "../src/elements";
import { buildStructure, defaultLayout, LAYOUT_LIMITS, LAYOUT_TYPES, LayoutSettings, normalizeLayout, readLayout, ROW_LIMITS, sameLayout, Slot } from "../src/layout";

// Pages of several formats and orientations, from the smallest custom size to a large one.
const PAGES: [number, number][] = [[794, 1123], [1123, 794], [1280, 720], [720, 1280], [1000, 1000], [559, 794], [1587, 1123], [300, 300]];

const pageOf = (w: number, h: number): PageSettings => ({ ...createEmptyDoc().page, width: w, height: h });

// Returns every layout setting that exists: each type with each count, and each number of rows for the modular one.
function allLayouts(): LayoutSettings[] {
  const out: LayoutSettings[] = [];
  for (const type of LAYOUT_TYPES) {
    const l = LAYOUT_LIMITS[type];
    for (let count = l.min; count <= l.max; count++) {
      if (type === `modular`) for (let rows = ROW_LIMITS.min; rows <= ROW_LIMITS.max; rows++) out.push({ type, count, rows });
      else out.push({ type, count, rows: ROW_LIMITS.default });
    }
  }
  return out;
}

// Tells whether two slots overlap by more than one pixel.
function overlap(a: Slot, b: Slot): boolean {
  return a.x + 1 < b.x + b.width && b.x + 1 < a.x + a.width && a.y + 1 < b.y + b.height && b.y + 1 < a.y + a.height;
}

test(`chaque structure, avec chaque nombre et sur chaque format, tient dans la page`, () => {
  for (const layout of allLayouts()) {
    for (const [w, h] of PAGES) {
      const { slots, elements } = buildStructure(layout, pageOf(w, h));
      const label = `${layout.type} ${layout.count}x${layout.rows} sur ${w}x${h}`;
      assert.ok(slots.length > 0, label);
      for (const s of slots) {
        assert.ok(s.width > 0 && s.height > 0, label);
        assert.ok(s.x >= -0.5 && s.y >= -0.5 && s.x + s.width <= w + 0.5 && s.y + s.height <= h + 0.5, `${label} : emplacement hors page`);
      }
      for (const el of elements) {
        if (el.type !== `line` && el.type !== `arrow`) continue;
        for (const [x, y] of el.points) assert.ok(x >= -0.5 && y >= -0.5 && x <= w + 0.5 && y <= h + 0.5, `${label} : trait hors page`);
      }
    }
  }
});

test(`les emplacements d'une structure ne se chevauchent pas`, () => {
  for (const layout of allLayouts()) {
    for (const [w, h] of PAGES) {
      const { slots } = buildStructure(layout, pageOf(w, h));
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          assert.ok(!overlap(slots[i], slots[j]), `${layout.type} ${layout.count}x${layout.rows} sur ${w}x${h} : ${i} et ${j}`);
        }
      }
    }
  }
});

test(`les elements produits sont valides, de la structure et d'identifiants uniques`, () => {
  for (const layout of allLayouts()) {
    const { elements } = buildStructure(layout, pageOf(794, 1123));
    const r = readElements(JSON.parse(JSON.stringify(elements)));
    assert.equal(r.ok, true, `${layout.type} ${layout.count}`);
    for (const el of elements) assert.equal(el.group, `structure`);
  }
});

test(`les elements et les emplacements dessinent la structure attendue`, () => {
  const page = pageOf(794, 1123);
  const count = (layout: LayoutSettings, type: string): number => buildStructure(layout, page).elements.filter((e) => e.type === type).length;
  const slots = (layout: LayoutSettings): number => buildStructure(layout, page).slots.length;
  assert.equal(count({ type: `linear`, count: 3, rows: 2 }, `arrow`), 3);
  assert.equal(count({ type: `linear`, count: 3, rows: 2 }, `line`), 2);
  assert.equal(slots({ type: `linear`, count: 3, rows: 2 }), 1 + 3 * 4);
  assert.equal(count({ type: `vertical`, count: 4, rows: 2 }, `arrow`), 4);
  assert.equal(count({ type: `vertical`, count: 4, rows: 2 }, `line`), 0);
  assert.equal(count({ type: `skyscraper`, count: 5, rows: 2 }, `line`), 4);
  assert.equal(slots({ type: `skyscraper`, count: 5, rows: 2 }), 1 + 5);
  // Modular: the line under the title, then the separators between columns and between rows.
  assert.equal(count({ type: `modular`, count: 3, rows: 2 }, `line`), 1 + 2 + 1);
  assert.equal(slots({ type: `modular`, count: 3, rows: 2 }), 1 + 6);
  assert.equal(count({ type: `path`, count: 6, rows: 2 }, `arrow`), 1);
  assert.equal(slots({ type: `path`, count: 6, rows: 2 }), 1 + 6);
  assert.equal(slots({ type: `radial`, count: 8, rows: 2 }), 1 + 8);
  assert.equal(slots({ type: `popcorn`, count: 9, rows: 2 }), 1 + 9);
});

test(`le resultat ne depend que des arguments`, () => {
  for (const layout of allLayouts()) {
    assert.deepEqual(buildStructure(layout, pageOf(794, 1123)), buildStructure(layout, pageOf(794, 1123)));
  }
});

test(`les traits de la structure prennent la couleur de trait de la page`, () => {
  const page = { ...pageOf(794, 1123), ink: `#ffffff` };
  for (const el of buildStructure(defaultLayout(`modular`), page).elements) assert.equal(el.stroke, `#ffffff`);
});

test(`les nombres sont ramenes dans les limites`, () => {
  assert.deepEqual(normalizeLayout({ type: `linear`, count: 99, rows: 99 }), { type: `linear`, count: 4, rows: 4 });
  assert.deepEqual(normalizeLayout({ type: `popcorn`, count: -3, rows: 0 }), { type: `popcorn`, count: 4, rows: 1 });
  assert.equal(normalizeLayout({ type: `radial`, count: 5.6, rows: 2 }).count, 6);
  assert.equal(normalizeLayout({ type: `radial`, count: NaN, rows: 2 }).count, LAYOUT_LIMITS.radial.default);
});

test(`la structure d'un fichier est lue avec controle`, () => {
  assert.equal(readLayout(null), null);
  assert.deepEqual(readLayout({ type: `skyscraper`, count: 4 }), { type: `skyscraper`, count: 4, rows: ROW_LIMITS.default });
  assert.deepEqual(readLayout({ type: `linear`, count: 40, rows: `x` }), { type: `linear`, count: 4, rows: ROW_LIMITS.default });
  for (const bad of [`radial`, 5, [], { type: `autre` }, { type: 7 }, {}]) assert.equal(readLayout(bad), undefined, JSON.stringify(bad));
});

test(`deux reglages sont identiques si le type et le nombre sont les memes`, () => {
  assert.equal(sameLayout(null, null), true);
  assert.equal(sameLayout(null, defaultLayout(`linear`)), false);
  assert.equal(sameLayout(defaultLayout(`linear`), defaultLayout(`linear`)), true);
  assert.equal(sameLayout({ type: `linear`, count: 2, rows: 1 }, { type: `linear`, count: 2, rows: 4 }), true);
  assert.equal(sameLayout({ type: `modular`, count: 2, rows: 1 }, { type: `modular`, count: 2, rows: 4 }), false);
  assert.equal(sameLayout(defaultLayout(`linear`), defaultLayout(`vertical`)), false);
});
