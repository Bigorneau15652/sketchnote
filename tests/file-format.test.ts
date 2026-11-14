import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDoc, isSafeColor, MAX_FILE_CHARS, parseSketchnote, serializeSketchnote } from "../src/file-format";
import { setLanguage } from "../src/i18n";

setLanguage(`fr`);

// Returns the text of a valid file, with some fields replaced.
function fileWith(patch: (doc: Record<string, unknown>) => void): string {
  const doc = JSON.parse(serializeSketchnote(createEmptyDoc())) as Record<string, unknown>;
  patch(doc);
  return JSON.stringify(doc);
}

test(`un document vide s'ecrit puis se relit a l'identique`, () => {
  const doc = createEmptyDoc();
  const result = parseSketchnote(serializeSketchnote(doc));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.doc, doc);
});

test(`un texte vide ou qui n'est pas du JSON est refuse`, () => {
  assert.equal(parseSketchnote(``).ok, false);
  assert.equal(parseSketchnote(`   `).ok, false);
  assert.equal(parseSketchnote(`{pas du json`).ok, false);
});

test(`un JSON qui n'est pas un sketchnote est refuse`, () => {
  assert.equal(parseSketchnote(`[]`).ok, false);
  assert.equal(parseSketchnote(`null`).ok, false);
  assert.equal(parseSketchnote(`{"format":"autre"}`).ok, false);
});

test(`une version inconnue est refusee`, () => {
  assert.equal(parseSketchnote(fileWith((d) => (d.version = 99))).ok, false);
});

test(`une page invalide est refusee`, () => {
  assert.equal(parseSketchnote(fileWith((d) => delete d.page)).ok, false);
  assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).width = -5))).ok, false);
  assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).width = 1e9))).ok, false);
  assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).width = `800`))).ok, false);
  assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).orientation = `diagonal`))).ok, false);
  assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).pattern = `zebra`))).ok, false);
});

test(`une couleur de fond qui n'est pas de la forme #rrggbb est refusee`, () => {
  for (const bad of [`red`, `url(javascript:alert(1))`, `#ggg`, `#12345`, `"><script>`, ``]) {
    assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).background = bad))).ok, false, bad);
  }
  for (const good of [`#fff`, `#FFFFFF`, `#ffffff80`]) assert.equal(isSafeColor(good), true, good);
});

test(`les champs inconnus du fichier ne sont pas recopies`, () => {
  const result = parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).evil = `x`)));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(`evil` in result.doc.page, false);
});

test(`un fichier trop volumineux est refuse`, () => {
  assert.equal(parseSketchnote(` `.repeat(MAX_FILE_CHARS + 1)).ok, false);
});

test(`un fichier de la version 0.1.0 sans couleur de trait se relit avec le trait par defaut`, () => {
  const result = parseSketchnote(fileWith((d) => delete (d.page as Record<string, unknown>).ink));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.doc.page.ink, `#000000`);
  const board = parseSketchnote(
    fileWith((d) => {
      const page = d.page as Record<string, unknown>;
      delete page.ink;
      page.pattern = `chalkboard`;
    }),
  );
  assert.equal(board.ok, true);
  if (board.ok) assert.equal(board.doc.page.ink, `#ffffff`);
});

test(`le papier craft et le tableau noir sont des fonds valides`, () => {
  for (const pattern of [`craft`, `chalkboard`]) {
    assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).pattern = pattern))).ok, true, pattern);
  }
});

test(`une couleur de trait invalide est refusee`, () => {
  for (const bad of [`black`, `url(x)`, `#12`, 5, null]) {
    assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).ink = bad))).ok, false, String(bad));
  }
});
