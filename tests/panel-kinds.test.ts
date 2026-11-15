import { test } from "node:test";
import assert from "node:assert/strict";
import type { SketchElement } from "../src/elements";
import { panelKinds, PanelSection, sectionShown } from "../src/panel-kinds";

const make = (type: string): SketchElement => ({ id: type, type, stroke: `#000000`, strokeWidth: 3, points: [[0, 0], [1, 1]], x: 0, y: 0, width: 1, height: 1, cx: 0, cy: 0, rx: 1, ry: 1, text: `a`, font: `caveat`, size: 20, path: null }) as unknown as SketchElement;

const ALL: PanelSection[] = [`colour`, `fill`, `brush`, `width`, `dash`, `look`, `regularity`, `border`, `corners`, `edges`, `heads`, `text`, `warp`, `icon`, `image`, `effects`];
const shown = (tool: string, types: string[]): PanelSection[] => ALL.filter((s) => sectionShown(s, panelKinds(tool, types.map(make))));

test(`un trait ou une fleche n'ont pas de remplissage ni de bordure`, () => {
  for (const type of [`line`, `arrow`]) assert.deepEqual(shown(`select`, [type]), [`colour`, `width`, `dash`, `look`, `edges`, `heads`, `effects`], type);
});

test(`une forme a un remplissage et une bordure mais ni bords ni pointes, et seul le rectangle a des coins`, () => {
  assert.deepEqual(shown(`select`, [`rect`]), [`colour`, `fill`, `width`, `dash`, `look`, `border`, `corners`, `effects`]);
  for (const type of [`diamond`, `ellipse`]) assert.deepEqual(shown(`select`, [type]), [`colour`, `fill`, `width`, `dash`, `look`, `border`, `effects`], type);
});

test(`un texte n'a que sa couleur, ses reglages de texte et les effets, un cadre de dessin rien`, () => {
  assert.deepEqual(shown(`select`, [`text`]), [`colour`, `text`, `warp`, `effects`]);
  assert.deepEqual(shown(`select`, [`drawing`]), []);
  assert.deepEqual(shown(`select`, [`freedraw`]), [`colour`, `brush`, `width`, `regularity`, `effects`]);
});

test(`une selection de plusieurs sortes montre les sections de chacune`, () => {
  assert.deepEqual(shown(`select`, [`rect`, `arrow`]), [`colour`, `fill`, `width`, `dash`, `look`, `border`, `corners`, `edges`, `heads`, `effects`]);
  assert.deepEqual(shown(`select`, [`ellipse`, `text`]), [`colour`, `fill`, `width`, `dash`, `look`, `border`, `text`, `warp`, `effects`]);
});

test(`sans selection le panneau suit l'outil, et sans outil il montre les choix generaux`, () => {
  assert.deepEqual(shown(`select`, []), [`colour`, `width`, `look`]);
  assert.deepEqual(shown(`hand`, []), [`colour`, `width`, `look`]);
  assert.deepEqual(shown(`rect`, []), [`colour`, `fill`, `width`, `dash`, `look`, `border`, `corners`, `effects`]);
  assert.deepEqual(shown(`arrow`, []), [`colour`, `width`, `dash`, `look`, `edges`, `heads`, `effects`]);
  // A line about to be drawn has no heads: it becomes an arrow once one is chosen.
  assert.deepEqual(shown(`line`, []), [`colour`, `width`, `dash`, `look`, `edges`, `effects`]);
  assert.deepEqual(shown(`pen`, []), [`colour`, `brush`, `width`, `regularity`, `effects`]);
  assert.deepEqual(shown(`point`, []), [`colour`, `width`, `look`, `effects`]);
  assert.deepEqual(shown(`text`, []), [`colour`, `text`, `effects`]);
  // The tool wins over a selection left behind.
  assert.deepEqual(shown(`text`, [`rect`]), [`colour`, `text`, `effects`]);
});

test(`une forme qui contient un texte montre aussi les reglages de texte`, () => {
  const labelled = { ...make(`rect`), label: { text: `a`, font: `caveat`, size: 20 } } as SketchElement;
  const kinds = panelKinds(`select`, [labelled]);
  assert.ok(sectionShown(`text`, kinds));
  assert.ok(sectionShown(`fill`, kinds) && sectionShown(`border`, kinds));
  assert.equal(sectionShown(`text`, panelKinds(`select`, [make(`rect`)])), false);
});

test(`un trait ou une fleche qui contient un texte montre aussi les reglages de texte`, () => {
  for (const type of [`line`, `arrow`]) {
    const labelled = { ...make(type), label: { text: `a`, font: `caveat`, size: 20 } } as SketchElement;
    assert.ok(sectionShown(`text`, panelKinds(`select`, [labelled])), type);
    assert.equal(sectionShown(`text`, panelKinds(`select`, [make(type)])), false, type);
  }
});

test(`un trait libre qui revient a son depart a un remplissage et des effets, un trait ouvert non`, () => {
  const ring = { ...make(`freedraw`), points: Array.from({ length: 41 }, (_, i): [number, number] => [100 + 50 * Math.cos((i * Math.PI) / 20), 100 + 50 * Math.sin((i * Math.PI) / 20)]) } as SketchElement;
  const open = { ...make(`freedraw`), points: Array.from({ length: 20 }, (_, i): [number, number] => [i * 10, (i % 2) * 8]) } as SketchElement;
  const of = (el: SketchElement): PanelSection[] => ALL.filter((s) => sectionShown(s, panelKinds(`select`, [el])));
  assert.deepEqual(of(ring), [`colour`, `fill`, `brush`, `width`, `regularity`, `effects`]);
  assert.deepEqual(of(open), [`colour`, `brush`, `width`, `regularity`, `effects`]);
});
