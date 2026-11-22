import test from "node:test";
import assert from "node:assert/strict";
import { formatHotkey, formatHotkeys, functionCommandId } from "../src/hotkeys";

test(`un raccourci s ecrit avec ses touches dans l ordre habituel`, () => {
  assert.equal(formatHotkey({ modifiers: [`Shift`, `Mod`], key: `i` }, false), `Ctrl+Shift+I`);
  assert.equal(formatHotkey({ modifiers: [`Mod`, `Shift`], key: `i` }, true), `Cmd+Shift+I`);
  assert.equal(formatHotkey({ modifiers: [`Mod`, `Shift`], key: `i` }, false, `Maj`), `Ctrl+Maj+I`);
  assert.equal(formatHotkey({ modifiers: [`Alt`], key: `F2` }, false), `Alt+F2`);
});

test(`plusieurs raccourcis sont separes et aucun donne un texte vide`, () => {
  assert.equal(formatHotkeys([], false), ``);
  assert.equal(formatHotkeys([{ modifiers: [`Mod`], key: `e` }, { modifiers: [`Alt`], key: `x` }], false), `Ctrl+E, Alt+X`);
  assert.equal(formatHotkeys([{ modifiers: [`Mod`], key: `` }], false), ``);
});

test(`l identifiant de la commande d une fonction`, () => {
  assert.equal(functionCommandId(`export`), `sketchnote:draw-function-export`);
});
