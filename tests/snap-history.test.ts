import { test } from "node:test";
import assert from "node:assert/strict";
import { History } from "../src/history";
import { snapBox } from "../src/snap";
import { cloneElements, moveElements, removeElements, reorder } from "../src/selection-ops";
import { SketchElement } from "../src/elements";
import { createEmptyDoc } from "../src/file-format";
import { sliderToZoom, zoomToSlider, MAX_ZOOM, MIN_ZOOM } from "../src/viewport";
import { buildStructure, defaultLayout } from "../src/layout";
import { structureEdited, applySettings } from "../src/doc-ops";
import { translate } from "../src/transform";
import { parseSketchnote, serializeSketchnote } from "../src/file-format";

const base = { stroke: `#000000`, strokeWidth: 2 };
const rect = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): SketchElement => ({ id, type: `rect`, x, y, width: 10, height: 10, ...base, ...extra }) as SketchElement;

test(`un bord proche d'une cible s'y colle et le trait repere est donne`, () => {
  const r = snapBox({ x: 97, y: 10, w: 20, h: 20 }, [{ x: 100, y: 200, w: 50, h: 50 }], 6);
  assert.equal(r.dx, 3);
  assert.deepEqual(r.guideX, [100]);
  assert.equal(r.dy, 0);
  assert.deepEqual(r.guideY, []);
});

test(`le milieu d'une boite se colle au milieu d'une cible`, () => {
  const r = snapBox({ x: 0, y: 0, w: 40, h: 40 }, [{ x: 100, y: 100, w: 100, h: 100 }], 6);
  assert.equal(r.dx, 0);
  const r2 = snapBox({ x: 128, y: 0, w: 40, h: 40 }, [{ x: 100, y: 100, w: 100, h: 100 }], 6);
  assert.equal(r2.dx, 2);
  assert.deepEqual(r2.guideX, [150]);
});

test(`rien ne bouge si aucune cible n'est assez proche ou s'il n'y en a pas`, () => {
  assert.deepEqual(snapBox({ x: 0, y: 0, w: 10, h: 10 }, [{ x: 500, y: 500, w: 10, h: 10 }], 6), { dx: 0, dy: 0, guideX: [], guideY: [] });
  assert.deepEqual(snapBox({ x: 0, y: 0, w: 10, h: 10 }, [], 6), { dx: 0, dy: 0, guideX: [], guideY: [] });
});

test(`l'aimantation corrige les deux axes a la fois`, () => {
  const r = snapBox({ x: 98, y: 203, w: 20, h: 20 }, [{ x: 100, y: 200, w: 50, h: 50 }], 6);
  assert.equal(r.dx, 2);
  // The bottom edge (223) is closer to the target middle (225) than the top edge (203) is to the target top (200): the smallest shift wins.
  assert.equal(r.dy, 2);
});

test(`l'historique annule puis retablit dans le bon ordre`, () => {
  const h = new History<string>();
  assert.equal(h.canUndo(), false);
  assert.equal(h.undo(`c`), null);
  h.push(`a`);
  h.push(`b`);
  assert.equal(h.undo(`c`), `b`);
  assert.equal(h.undo(`b`), `a`);
  assert.equal(h.canUndo(), false);
  assert.equal(h.redo(`a`), `b`);
  assert.equal(h.redo(`b`), `c`);
  assert.equal(h.redo(`c`), null);
});

test(`une nouvelle modification efface les etats retablissables`, () => {
  const h = new History<string>();
  h.push(`a`);
  h.undo(`b`);
  assert.equal(h.canRedo(), true);
  h.push(`x`);
  assert.equal(h.canRedo(), false);
});

test(`l'historique ne garde que le nombre d'etats fixe`, () => {
  const h = new History<number>(3);
  for (let i = 0; i < 10; i++) h.push(i);
  let count = 0;
  let cur = 99;
  for (;;) {
    const prev = h.undo(cur);
    if (prev === null) break;
    cur = prev;
    count++;
  }
  assert.equal(count, 3);
  assert.equal(cur, 7);
  h.clear();
  assert.equal(h.canUndo(), false);
});

test(`supprimer, mettre devant et derriere`, () => {
  const list = [rect(`a`, 0, 0), rect(`b`, 0, 0), rect(`c`, 0, 0)];
  assert.deepEqual(removeElements(list, new Set([`b`])).map((e) => e.id), [`a`, `c`]);
  assert.deepEqual(reorder(list, new Set([`a`]), `front`).map((e) => e.id), [`b`, `c`, `a`]);
  assert.deepEqual(reorder(list, new Set([`c`]), `back`).map((e) => e.id), [`c`, `a`, `b`]);
  assert.deepEqual(reorder(list, new Set([`a`, `c`]), `front`).map((e) => e.id), [`b`, `a`, `c`]);
});

test(`dupliquer cree des copies decalees, avec de nouveaux identifiants, hors de la structure`, () => {
  const list = [rect(`e1`, 0, 0, { group: `structure` }), rect(`e2`, 50, 50)];
  const copies = cloneElements(list, list, 20, 20);
  assert.equal(copies.length, 2);
  const ids = [...list, ...copies].map((e) => e.id);
  assert.equal(new Set(ids).size, 4);
  assert.equal(copies[0].group, undefined);
  assert.equal((copies[0] as { x: number }).x, 20);
  assert.equal((copies[1] as { x: number }).x, 70);
});

test(`deplacer plusieurs elements ne touche pas les autres`, () => {
  const list = [rect(`a`, 0, 0), rect(`b`, 5, 5)];
  const next = moveElements(list, new Set([`a`]), 3, 4);
  assert.equal((next[0] as { x: number }).x, 3);
  assert.equal(next[1], list[1]);
});

test(`la reglette de zoom est logarithmique et revient au meme zoom`, () => {
  assert.equal(sliderToZoom(0), MIN_ZOOM);
  assert.equal(sliderToZoom(100), MAX_ZOOM);
  assert.ok(Math.abs(zoomToSlider(MIN_ZOOM)) < 1e-9);
  assert.ok(Math.abs(zoomToSlider(MAX_ZOOM) - 100) < 1e-9);
  for (const z of [0.25, 0.5, 1, 2, 3]) assert.ok(Math.abs(sliderToZoom(zoomToSlider(z)) - z) < 0.002, String(z));
  assert.equal(sliderToZoom(NaN), MIN_ZOOM);
  assert.equal(sliderToZoom(500), MAX_ZOOM);
});

test(`la structure est detectee comme modifiee des qu'un de ses traits a bouge`, () => {
  const doc = applySettings(createEmptyDoc(), createEmptyDoc().page, defaultLayout(`modular`));
  assert.equal(structureEdited(doc), false);
  assert.equal(structureEdited(createEmptyDoc()), false);
  const moved = { ...doc, elements: doc.elements.map((e, i) => (i === 0 ? translate(e, 5, 0) : e)) };
  assert.equal(structureEdited(moved), true);
  const deleted = { ...doc, elements: doc.elements.slice(1) };
  assert.equal(structureEdited(deleted), true);
  // A content element changes nothing.
  const withContent = { ...doc, elements: [...doc.elements, rect(`u1`, 3, 3)] };
  assert.equal(structureEdited(withContent), false);
  assert.equal(buildStructure(doc.layout!, doc.page).elements.length, doc.elements.filter((e) => e.group === `structure`).length);
});

test(`une structure non modifiee n'est pas vue comme modifiee apres ecriture et relecture du fichier`, () => {
  for (const type of [`linear`, `radial`, `vertical`, `path`, `modular`, `skyscraper`, `popcorn`] as const) {
    const doc = applySettings(createEmptyDoc(), createEmptyDoc().page, defaultLayout(type));
    const r = parseSketchnote(serializeSketchnote(doc));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(structureEdited(r.doc), false, type);
  }
});
