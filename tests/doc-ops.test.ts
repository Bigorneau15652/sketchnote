import { test } from "node:test";
import assert from "node:assert/strict";
import { applySettings } from "../src/doc-ops";
import { SketchElement } from "../src/elements";
import { createEmptyDoc, SketchnoteDoc } from "../src/file-format";
import { buildStructure, defaultLayout } from "../src/layout";
import { changeInk, changeSize, changeStyle } from "../src/page-settings";

// A content element drawn by the user: it must never be touched by the structure.
const mine: SketchElement = { id: `u1`, type: `rect`, x: 10, y: 10, width: 50, height: 50, stroke: `#ff0000`, strokeWidth: 2 };

// Returns an empty document that holds one content element.
const withContent = (): SketchnoteDoc => ({ ...createEmptyDoc(), elements: [mine] });

test(`choisir une structure ajoute ses traits derriere les contenus, sans cadre de zone`, () => {
  const doc = withContent();
  const next = applySettings(doc, doc.page, defaultLayout(`linear`));
  assert.deepEqual(next.layout, defaultLayout(`linear`));
  const at = next.elements.indexOf(mine);
  assert.ok(at > 0, `content is kept`);
  assert.ok(next.elements.slice(0, at).every((e) => e.group === `structure`));
  assert.equal(next.elements.filter((e) => e.type === `drawing`).length, 0, `les zones sont les emplacements de la structure : elles n ont plus de cadre`);
});

test(`retirer la structure supprime ses elements et garde les contenus`, () => {
  const doc = withContent();
  const withLayout = applySettings(doc, doc.page, defaultLayout(`modular`));
  const without = applySettings(withLayout, withLayout.page, null);
  assert.equal(without.layout, null);
  assert.deepEqual(without.elements, [mine]);
});

test(`changer de structure remplace les elements de l'ancienne`, () => {
  const doc = withContent();
  const a = applySettings(doc, doc.page, defaultLayout(`skyscraper`));
  const b = applySettings(a, a.page, defaultLayout(`vertical`));
  assert.ok(b.elements.every((e) => e.group !== `structure` || e.type === `arrow`));
  assert.ok(b.elements.includes(mine));
  const ids = b.elements.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test(`changer la taille de la page refait la structure a la nouvelle taille`, () => {
  const doc = withContent();
  const a = applySettings(doc, doc.page, defaultLayout(`skyscraper`));
  const bigger = changeSize(a.page, 1200, 1700);
  const b = applySettings(a, bigger, a.layout);
  assert.notDeepEqual(b.elements, a.elements);
  assert.ok(b.elements.includes(mine));
});

test(`changer le trait par defaut recolore la structure sans la refaire`, () => {
  const doc = withContent();
  const a = applySettings(doc, doc.page, defaultLayout(`modular`));
  const b = applySettings(a, changeInk(a.page, `#00aa00`), a.layout);
  assert.equal(b.elements.length, a.elements.length);
  for (const e of b.elements) if (e.group === `structure`) assert.equal(e.stroke, `#00aa00`);
  assert.deepEqual(b.elements.find((e) => e.id === mine.id), mine);
});

test(`passer au tableau noir donne une structure blanche`, () => {
  const doc = withContent();
  const a = applySettings(doc, doc.page, defaultLayout(`linear`));
  const b = applySettings(a, changeStyle(a.page, `chalkboard`), a.layout);
  for (const e of b.elements) if (e.group === `structure`) assert.equal(e.stroke, `#ffffff`);
});

test(`les reglages inchanges ne modifient rien`, () => {
  const doc = withContent();
  const a = applySettings(doc, doc.page, defaultLayout(`path`));
  const b = applySettings(a, a.page, a.layout);
  assert.deepEqual(b, a);
});

test(`un element de l'utilisateur de la meme couleur que le trait n'est pas recolore`, () => {
  const doc: SketchnoteDoc = { ...createEmptyDoc(), elements: [{ ...mine, stroke: `#000000` }] };
  const a = applySettings(doc, doc.page, defaultLayout(`linear`));
  const b = applySettings(a, changeInk(a.page, `#123456`), a.layout);
  assert.equal((b.elements.find((e) => e.id === mine.id) as { stroke: string }).stroke, `#000000`);
});
