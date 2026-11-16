import { test } from "node:test";
import assert from "node:assert/strict";
import { firstFreePath } from "../src/free-path";

const numbered = (taken: Set<string>): string => {
  for (let n = 0; n < 50; n++) {
    const path = `Dossier/Nouveau ${n}.sketchnote`;
    if (!taken.has(path)) return path;
  }
  return `Dossier/Nouveau fin.sketchnote`;
};

test(`un chemin libre sur le disque est pris tout de suite`, async () => {
  assert.equal(await firstFreePath(numbered, async () => false), `Dossier/Nouveau 0.sketchnote`);
});

test(`un fichier que l index ne connait pas mais que le disque a est saute`, async () => {
  const onDisk = new Set([`Dossier/Nouveau 0.sketchnote`, `Dossier/Nouveau 1.sketchnote`]);
  assert.equal(await firstFreePath(numbered, async (p) => onDisk.has(p)), `Dossier/Nouveau 2.sketchnote`);
});

test(`une erreur du disque ne bloque pas la creation`, async () => {
  assert.equal(await firstFreePath(numbered, async () => { throw new Error(`disque`); }), `Dossier/Nouveau 0.sketchnote`);
});

test(`la recherche s arrete apres sa limite`, async () => {
  let asked = 0;
  const path = await firstFreePath(numbered, async () => { asked++; return true; }, 5);
  assert.equal(asked, 5);
  assert.equal(path, `Dossier/Nouveau 5.sketchnote`);
});
