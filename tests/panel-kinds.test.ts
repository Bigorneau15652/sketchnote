import { test } from "node:test";
import assert from "node:assert/strict";
import type { SketchElement } from "../src/elements";
import { panelKinds, PanelSection, sectionShown } from "../src/panel-kinds";

const make = (type: string): SketchElement => ({ id: type, type, stroke: `#000000`, strokeWidth: 3, points: [[0, 0], [1, 1]], x: 0, y: 0, width: 1, height: 1, cx: 0, cy: 0, rx: 1, ry: 1, text: `a`, font: `caveat`, size: 20, path: null }) as unknown as SketchElement;

const ALL: PanelSection[] = [`colour`, `fill`, `width`, `look`, `edges`, `heads`, `text`];
const shown = (tool: string, types: string[]): PanelSection[] => ALL.filter((s) => sectionShown(s, panelKinds(tool, types.map(make))));

test(`un trait ou une fleche n'ont pas de remplissage`, () => {
  assert.deepEqual(shown(`select`, [`line`]), [`colour`, `width`, `look`, `edges`, `heads`]);
  assert.deepEqual(shown(`select`, [`arrow`]), [`colour`, `width`, `look`, `edges`, `heads`]);
});

test(`une forme a un remplissage mais ni bords ni pointes`, () => {
  for (const type of [`rect`, `diamond`, `ellipse`]) assert.deepEqual(shown(`select`, [type]), [`colour`, `fill`, `width`, `look`], type);
});

test(`un texte n'a que sa couleur et ses reglages de texte, un cadre de dessin rien`, () => {
  assert.deepEqual(shown(`select`, [`text`]), [`colour`, `text`]);
  assert.deepEqual(shown(`select`, [`drawing`]), []);
  assert.deepEqual(shown(`select`, [`freedraw`]), [`colour`, `width`, `look`]);
});

test(`une selection de plusieurs sortes montre les sections de chacune`, () => {
  assert.deepEqual(shown(`select`, [`rect`, `arrow`]), [`colour`, `fill`, `width`, `look`, `edges`, `heads`]);
  assert.deepEqual(shown(`select`, [`rect`, `text`]), [`colour`, `fill`, `width`, `look`, `text`]);
});

test(`sans selection le panneau suit l'outil, et sans outil il montre les choix generaux`, () => {
  assert.deepEqual(shown(`select`, []), [`colour`, `width`, `look`]);
  assert.deepEqual(shown(`hand`, []), [`colour`, `width`, `look`]);
  assert.deepEqual(shown(`rect`, []), [`colour`, `fill`, `width`, `look`]);
  assert.deepEqual(shown(`arrow`, []), [`colour`, `width`, `look`, `edges`, `heads`]);
  // A line about to be drawn has no heads: it becomes an arrow once one is chosen.
  assert.deepEqual(shown(`line`, []), [`colour`, `width`, `look`, `edges`]);
  assert.deepEqual(shown(`pen`, []), [`colour`, `width`, `look`]);
  assert.deepEqual(shown(`point`, []), [`colour`, `width`, `look`]);
  assert.deepEqual(shown(`text`, []), [`colour`, `text`]);
  // The tool wins over a selection left behind.
  assert.deepEqual(shown(`text`, [`rect`]), [`colour`, `text`]);
});
