import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A section of the properties panel that is hidden must really be hidden: a rule that gives the sections a display must not come after the rule that hides them with the
// same strength (this happened once, and the panel then showed the arrow heads for a rectangle).
test(`une section cachee du panneau reste cachee malgre la regle d'affichage des sections`, () => {
  const css = readFileSync(`styles.css`, `utf8`);
  const hide = css.indexOf(`.sketchdraw-section.sketchdraw-hidden`);
  const show = css.indexOf(`.sketchdraw-section {`);
  assert.ok(show >= 0 && hide >= 0, `both rules exist`);
  assert.ok(hide > show, `the rule that hides comes after the rule that shows`);
  const block = css.slice(hide, css.indexOf(`}`, hide));
  assert.ok(block.includes(`display: none`));
});
