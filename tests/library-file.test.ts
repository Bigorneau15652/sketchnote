import { test } from "node:test";
import assert from "node:assert/strict";
import { RectElement, readElements, SketchElement } from "../src/elements";
import { CANVAS_HEIGHT, CANVAS_WIDTH, contentBox, parseSketchdraw, serializeSketchdraw } from "../src/drawing-file";
import { elementBounds, unionBox } from "../src/geometry";
import { drawingFromSelection, isLibraryElement, libraryElements, libraryName, placeDrawing } from "../src/library-file";

const rect = (id: string, x: number, y: number, w: number, h: number, extra: object = {}): RectElement => ({ id, type: `rect`, x, y, width: w, height: h, stroke: `#000000`, strokeWidth: 4, ...extra });

test(`seuls les dessins de l utilisateur vont dans la bibliotheque, pas les traits de la structure ni les anciens cadres`, () => {
  const els: SketchElement[] = [rect(`a`, 0, 0, 10, 10), rect(`s`, 0, 0, 10, 10, { group: `structure` }), { id: `f`, type: `drawing`, x: 0, y: 0, width: 10, height: 10, path: `D/a.sketchdraw` }];
  assert.deepEqual(els.map(isLibraryElement), [true, false, false]);
  assert.deepEqual(libraryElements(els, new Set([`a`, `s`, `f`])).map((e) => e.id), [`a`]);
  assert.deepEqual(libraryElements(els, new Set()), []);
});

test(`une selection devient une note de dessin au milieu de la surface, sans numero de zone`, () => {
  const els = [rect(`a`, 100, 200, 40, 20, { slot: 3 }), rect(`b`, 300, 400, 60, 30, { slot: 3, groups: [`g1`] })];
  const doc = drawingFromSelection(els, `#112233`, [`#000000`, `#111111`, `#222222`, `#333333`, `#444444`]);
  assert.ok(doc);
  assert.equal(doc.ink, `#112233`);
  assert.ok(doc.elements.every((e) => e.slot === undefined));
  const box = unionBox(doc.elements.map(elementBounds));
  assert.ok(box);
  assert.ok(Math.abs(box.x + box.w / 2 - CANVAS_WIDTH / 2) < 1.5 && Math.abs(box.y + box.h / 2 - CANVAS_HEIGHT / 2) < 1.5, `au milieu : ${box.x + box.w / 2}`);
  // The note is written and read again as it is.
  const back = parseSketchdraw(serializeSketchdraw(doc));
  assert.equal(back.ok, true);
  assert.equal(drawingFromSelection([], `#000000`, []), null);
  // The elements keep their groups and their sizes.
  assert.deepEqual(doc.elements[1].groups, [`g1`]);
  assert.equal((doc.elements[1] as RectElement).width, 60);
});

test(`un dessin de la bibliotheque est remis sur la page, centre, avec de nouveaux identifiants et un groupe`, () => {
  const doc = drawingFromSelection([rect(`a`, 0, 0, 100, 50), rect(`b`, 20, 10, 20, 20, { groups: [`g1`] })], `#000000`, [])!;
  const page: SketchElement[] = [rect(`e1`, 0, 0, 5, 5, { groups: [`g1`] }), rect(`e2`, 0, 0, 5, 5)];
  const placed = placeDrawing(doc, [500, 300], 1000, page);
  assert.equal(placed.length, 2);
  const ids = new Set([...page, ...placed].map((e) => e.id));
  assert.equal(ids.size, 4, `des identifiants nouveaux`);
  assert.ok(placed.every((e) => (e.groups ?? []).length >= 1));
  // All the elements share one new group (the last of their groups): the drawing moves as a block.
  const last = placed.map((e) => (e.groups ?? [])[(e.groups ?? []).length - 1]);
  assert.equal(new Set(last).size, 1);
  assert.notEqual(last[0], `g1`);
  const box = unionBox(placed.map(elementBounds));
  assert.ok(box && Math.abs(box.x + box.w / 2 - 500) < 3 && Math.abs(box.y + box.h / 2 - 300) < 3, `centre sur le point`);
  // The page reads them.
  assert.equal(readElements(JSON.parse(JSON.stringify(placed))).ok, true);
  // A drawing wider than the room is made smaller to that width; an empty one gives nothing.
  const narrow = placeDrawing(doc, [0, 0], 50, []);
  const nb = unionBox(narrow.map(elementBounds));
  assert.ok(nb && nb.w <= 56, `reduit : ${nb?.w}`);
  assert.deepEqual(placeDrawing({ ...doc, elements: [] }, [0, 0], 100, []), []);
  assert.ok(contentBox(doc) !== null);
});

test(`le nom d un dessin est nettoye, ou remplace par le nom propose quand il est vide`, () => {
  assert.equal(libraryName(`Mon / dessin: 1`, `Dessin du jour`), `Mon dessin 1`);
  assert.equal(libraryName(`   `, `Dessin du jour`), `Dessin du jour`);
  assert.equal(libraryName(``, `Dessin du jour`), `Dessin du jour`);
});
