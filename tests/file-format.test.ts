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

test(`une structure et des elements s'ecrivent puis se relisent a l'identique`, () => {
  const doc = createEmptyDoc();
  doc.layout = { type: `modular`, count: 3, rows: 2 };
  doc.elements = [{ id: `s1`, group: `structure`, type: `line`, points: [[1, 2], [3, 4]], stroke: `#000000`, strokeWidth: 3 }];
  const result = parseSketchnote(serializeSketchnote(doc));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.doc, doc);
});

test(`une structure inconnue est refusee et ses nombres sont bornes`, () => {
  assert.equal(parseSketchnote(fileWith((d) => (d.layout = { type: `spirale`, count: 3 }))).ok, false);
  assert.equal(parseSketchnote(fileWith((d) => (d.layout = `radial`))).ok, false);
  const r = parseSketchnote(fileWith((d) => (d.layout = { type: `radial`, count: 999 })));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.doc.layout?.count, 12);
});

test(`un element invalide refuse le fichier avec son numero`, () => {
  const r = parseSketchnote(fileWith((d) => (d.elements = [{ id: `a`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000`, strokeWidth: 1 }, { id: `b`, type: `rect` }])));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes(`2`));
});

test(`un fichier 0.2 sans structure ni element se relit`, () => {
  const r = parseSketchnote(fileWith((d) => { delete d.layout; delete d.elements; }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.doc.layout, null);
    assert.deepEqual(r.doc.elements, []);
  }
});

test(`la palette de la page est lue, controlee et prend une valeur par defaut pour les anciens fichiers`, () => {
  const old = parseSketchnote(fileWith((d) => delete (d.page as Record<string, unknown>).palette));
  assert.equal(old.ok, true);
  if (old.ok) assert.equal(old.doc.page.palette.length, 5);
  const dark = parseSketchnote(fileWith((d) => { const page = d.page as Record<string, unknown>; delete page.palette; page.pattern = `chalkboard`; page.ink = `#ffffff`; }));
  if (dark.ok) assert.equal(dark.doc.page.palette[0], `#ffffff`);
  for (const bad of [[`#000000`], [`#000000`, `#111111`, `x`], `#000000`, [`#1`, `#2`, `#3`], null]) {
    assert.equal(parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).palette = bad))).ok, false, JSON.stringify(bad));
  }
  const ok = parseSketchnote(fileWith((d) => ((d.page as Record<string, unknown>).palette = [`#111111`, `#222222`, `#333333`])));
  assert.equal(ok.ok, true);
});
