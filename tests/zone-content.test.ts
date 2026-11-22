import { test } from "node:test";
import assert from "node:assert/strict";
import { DrawingElement, LineElement, readElements, RectElement, SketchElement } from "../src/elements";
import { createEmptyDrawing } from "../src/drawing-file";
import { elementBounds } from "../src/geometry";
import { Slot } from "../src/layout";
import { elementsOfZone, expandToZones, framesToInline, inlineDrawing, remapZoneElements, withoutFrames, withZone, zoneBounds, zoneIsEmpty } from "../src/zone-content";

const rect = (id: string, x: number, y: number, w: number, h: number, extra: object = {}): RectElement => ({ id, type: `rect`, x, y, width: w, height: h, stroke: `#000000`, strokeWidth: 4, ...extra });
const slot = (x: number, y: number, w: number, h: number): Slot => ({ x, y, width: w, height: h, shape: `ellipse` });

test(`un element garde le numero de sa zone dans un fichier, et un numero faux refuse le fichier`, () => {
  const ok = readElements([rect(`a`, 0, 0, 10, 10, { slot: 3 })]);
  assert.equal(ok.ok, true);
  assert.equal((ok as { elements: RectElement[] }).elements[0].slot, 3);
  for (const bad of [-1, 1.5, 64, `2`, null, NaN]) assert.equal(readElements([rect(`a`, 0, 0, 10, 10, { slot: bad })]).ok, false, String(bad));
  assert.equal(withZone(rect(`a`, 0, 0, 5, 5), 2).slot, 2);
  assert.equal(`slot` in withZone(rect(`a`, 0, 0, 5, 5, { slot: 2 }), undefined), false);
});

test(`on retrouve les elements d une zone, ses limites, et une zone vide`, () => {
  const els: SketchElement[] = [rect(`a`, 0, 0, 10, 10, { slot: 0 }), rect(`b`, 50, 50, 10, 10, { slot: 0 }), rect(`c`, 200, 0, 10, 10, { slot: 1 }), rect(`d`, 0, 300, 10, 10)];
  assert.deepEqual(elementsOfZone(els, 0).map((e) => e.id), [`a`, `b`]);
  assert.equal(zoneIsEmpty(els, 2), true);
  assert.equal(zoneIsEmpty(els, 1), false);
  const b = zoneBounds(els, 0);
  assert.ok(b && b.x <= 0 && b.y <= 0 && b.x + b.w >= 60 && b.y + b.h >= 60);
  assert.equal(zoneBounds(els, 2), null);
});

test(`un clic sur un dessin de la zone selectionne toute la zone et rien d autre`, () => {
  const els: SketchElement[] = [rect(`a`, 0, 0, 10, 10, { slot: 0 }), rect(`b`, 50, 50, 10, 10, { slot: 0 }), rect(`c`, 200, 0, 10, 10, { slot: 1 }), rect(`d`, 0, 300, 10, 10)];
  assert.deepEqual([...expandToZones(els, new Set([`a`]))].sort(), [`a`, `b`]);
  assert.deepEqual([...expandToZones(els, new Set([`d`]))], [`d`]);
  assert.deepEqual([...expandToZones(els, new Set([`a`, `c`]))].sort(), [`a`, `b`, `c`]);
});

test(`un ancien dessin entre dans la page a la place et a l echelle de son cadre`, () => {
  const drawing = createEmptyDrawing();
  const line: LineElement = { id: `l1`, type: `line`, points: [[1000, 1000], [1200, 1000]], stroke: `#000000`, strokeWidth: 6 };
  const box = rect(`r1`, 1000, 1000, 200, 100, { groups: [`g1`] });
  const doc = { ...drawing, elements: [line, box, rect(`r2`, 1050, 1020, 20, 20, { groups: [`g1`] })] };
  const frame: DrawingElement = { id: `f1`, type: `drawing`, x: 300, y: 200, width: 100, height: 50, slot: 4, path: `D/x.sketchdraw` };
  const page: SketchElement[] = [rect(`e1`, 0, 0, 5, 5, { groups: [`g1`] }), rect(`e2`, 0, 0, 5, 5)];
  const out = inlineDrawing(frame, doc, page);
  assert.equal(out.length, 3);
  assert.ok(out.every((e) => e.slot === 4));
  const ids = new Set([...page, ...out].map((e) => e.id));
  assert.equal(ids.size, 5, `les identifiants sont nouveaux`);
  // The group of the drawing has a name that the page does not use, and both members share it.
  const grouped = out.filter((e) => (e.groups ?? []).length > 0);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].groups?.[0], grouped[1].groups?.[0]);
  assert.notEqual(grouped[0].groups?.[0], `g1`);
  // The drawing fills the width of its frame, from its left edge.
  const bounds = out.map(elementBounds);
  const left = Math.min(...bounds.map((b) => b.x));
  const right = Math.max(...bounds.map((b) => b.x + b.w));
  assert.ok(left >= 300 - 1 && right <= 400 + 1, `dans le cadre : ${left} ${right}`);
  assert.ok(right - left > 70, `elle remplit le cadre`);
  // The lines are scaled with the drawing (the frame is smaller than the drawing).
  const scaled = out.find((e) => e.type === `line`) as LineElement;
  assert.ok(scaled.strokeWidth < 6);
  // A frame that is not in a zone gives free elements, and an empty drawing gives nothing.
  assert.ok(inlineDrawing({ ...frame, slot: undefined }, doc, []).every((e) => e.slot === undefined));
  assert.deepEqual(inlineDrawing(frame, drawing, []), []);
});

test(`les cadres a faire entrer dans la page, et ceux qu on retire`, () => {
  const els: SketchElement[] = [{ id: `f1`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, slot: 0, path: `D/a.sketchdraw` }, { id: `f2`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, slot: 1, path: null }, rect(`r`, 0, 0, 5, 5)];
  assert.deepEqual(framesToInline(els).map((e) => e.id), [`f1`]);
  assert.deepEqual(withoutFrames(els, new Set([`f1`])).map((e) => e.id), [`r`]);
  assert.deepEqual(withoutFrames(els, new Set()).map((e) => e.id), [`f1`, `r`], `un cadre dont le dessin n a pas pu etre lu reste`);
});

test(`le dessin d une zone suit sa zone quand elle change`, () => {
  const el = rect(`a`, 150, 150, 40, 20, { slot: 0 });
  const old = [slot(100, 100, 200, 100)];
  // The zone moves: the drawing moves with it.
  const moved = remapZoneElements([el], old, [slot(300, 400, 200, 100)])[0] as RectElement;
  assert.deepEqual([moved.x, moved.y, moved.width, moved.height], [350, 450, 40, 20]);
  // The zone is twice as large: the drawing is twice as large, from the same relative place.
  const grown = remapZoneElements([el], old, [slot(100, 100, 400, 200)])[0] as RectElement;
  assert.deepEqual([grown.width, grown.height], [80, 40]);
  assert.ok(Math.abs(grown.x + grown.width / 2 - (300 + (170 - 200) * 2)) < 0.01);
  assert.equal(grown.strokeWidth, 8);
  // The zone is more elongated: one factor for both directions, so nothing is distorted.
  const long = remapZoneElements([el], old, [slot(100, 100, 400, 100)])[0] as RectElement;
  assert.equal(long.width / long.height, 2);
  // The zone is gone: the drawing stays, free.
  const gone = remapZoneElements([el], old, [])[0];
  assert.equal(gone.slot, undefined);
  // An element of no zone, and a zone that did not change, are left as they are.
  const free = rect(`b`, 5, 5, 5, 5);
  assert.equal(remapZoneElements([free], old, [slot(0, 0, 9, 9)])[0], free);
  assert.equal(remapZoneElements([el], old, old)[0], el);
});
