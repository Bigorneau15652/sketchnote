import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDoc, MAX_PAGE_SIZE, MIN_PAGE_SIZE, PageSettings } from "../src/file-format";
import { changeBackground, changeInk, changeOrientation, changePalette, changePreset, changeSize, changeStyle, clampSize, detectPreset, presetSize } from "../src/page-settings";

// Returns a fresh A4 portrait page (the base of the rules below).
const page = (): PageSettings => ({ ...createEmptyDoc().page, width: 794, height: 1123, orientation: `portrait` });

test(`la page par defaut d'un nouveau sketchnote est un A4 paysage`, () => {
  const fresh = createEmptyDoc().page;
  assert.equal(detectPreset(fresh), `a4`);
  assert.equal(fresh.orientation, `landscape`);
  assert.equal(fresh.width, 1123);
  assert.equal(fresh.height, 794);
});

test(`chaque format garde sa taille en portrait et la retourne en paysage`, () => {
  assert.deepEqual(presetSize(`a4`, `portrait`), [794, 1123]);
  assert.deepEqual(presetSize(`a4`, `landscape`), [1123, 794]);
  assert.deepEqual(presetSize(`wide`, `landscape`), [1280, 720]);
  assert.deepEqual(presetSize(`square`, `landscape`), [1000, 1000]);
  assert.equal(presetSize(`custom`, `portrait`), null);
});

test(`choisir un format respecte l'orientation courante`, () => {
  const landscape = changeOrientation(page(), `landscape`);
  const a3 = changePreset(landscape, `a3`);
  assert.equal(a3.width, 1587);
  assert.equal(a3.height, 1123);
  assert.equal(detectPreset(a3), `a3`);
  assert.deepEqual(changePreset(page(), `custom`), page());
});

test(`changer l'orientation echange la largeur et la hauteur une seule fois`, () => {
  const landscape = changeOrientation(page(), `landscape`);
  assert.equal(landscape.width, 1123);
  assert.equal(landscape.height, 794);
  assert.deepEqual(changeOrientation(landscape, `landscape`), landscape);
  assert.deepEqual(changeOrientation(landscape, `portrait`), page());
});

test(`une taille libre donne le format libre et l'orientation suit`, () => {
  const p = changeSize(page(), 900, 500);
  assert.equal(detectPreset(p), `custom`);
  assert.equal(p.orientation, `landscape`);
  assert.equal(changeSize(page(), 500, 900).orientation, `portrait`);
});

test(`les tailles sont arrondies et bornees`, () => {
  assert.equal(clampSize(1), MIN_PAGE_SIZE);
  assert.equal(clampSize(1e9), MAX_PAGE_SIZE);
  assert.equal(clampSize(300.6), 301);
  assert.equal(clampSize(NaN), MIN_PAGE_SIZE);
  const p = changeSize(page(), -5, 99999);
  assert.equal(p.width, MIN_PAGE_SIZE);
  assert.equal(p.height, MAX_PAGE_SIZE);
});

test(`le tableau noir passe le trait en blanc et le retour restaure papier blanc et trait noir`, () => {
  const board = changeStyle(page(), `chalkboard`);
  assert.equal(board.ink, `#ffffff`);
  assert.notEqual(board.background, `#ffffff`);
  const back = changeStyle(board, `grid`);
  assert.equal(back.background, `#ffffff`);
  assert.equal(back.ink, `#000000`);
  const craft = changeStyle(page(), `craft`);
  assert.equal(craft.ink, `#000000`);
  assert.notEqual(craft.background, `#ffffff`);
});

test(`passer d'un fond simple a un autre garde les couleurs choisies`, () => {
  const custom = changeInk(changeBackground(page(), `#fff3c4`), `#223344`);
  const dots = changeStyle(custom, `dots`);
  assert.equal(dots.background, `#fff3c4`);
  assert.equal(dots.ink, `#223344`);
  assert.equal(changeStyle(dots, `dots`), dots);
});

test(`une couleur invalide est ignoree`, () => {
  assert.deepEqual(changeBackground(page(), `red`), page());
  assert.deepEqual(changeInk(page(), `url(javascript:x)`), page());
});

test(`les fonctions ne modifient pas la page recue`, () => {
  const p = page();
  const copy = JSON.stringify(p);
  changeStyle(p, `chalkboard`);
  changeOrientation(p, `landscape`);
  changeSize(p, 300, 300);
  assert.equal(JSON.stringify(p), copy);
});

test(`la palette de la page est de 3 a 5 couleurs et suit le fond`, () => {
  assert.equal(page().palette.length, 5);
  const board = changeStyle(page(), `chalkboard`);
  assert.equal(board.palette[0], `#ffffff`);
  assert.equal(changeStyle(board, `grid`).palette[0], `#000000`);
  const three = changePalette(page(), [`#111111`, `#222222`, `#333333`]);
  assert.equal(three.palette.length, 3);
  assert.deepEqual(changePalette(page(), [`#111111`, `#222222`]), page());
  assert.deepEqual(changePalette(page(), [`#111111`, `#222222`, `#333333`, `#444444`, `#555555`, `#666666`]), page());
  assert.deepEqual(changePalette(page(), [`#111111`, `#222222`, `rouge`]), page());
});
