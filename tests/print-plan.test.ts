import { test } from "node:test";
import assert from "node:assert/strict";
import { isPaper, planPrint, PRINT_MARGIN_MM, PRINT_MAX_ENLARGE, PRINT_MAX_SHEETS } from "../src/print-plan";

const PX = 96 / 25.4;

test(`ajuste : une feuille, l'orientation suit la forme, l'image est centree et garde ses proportions`, () => {
  const wide = planPrint(1123, 794, `a4`, `fit`);
  assert.equal(wide.orientation, `landscape`);
  assert.equal(wide.sheets.length, 1);
  assert.deepEqual(wide.paperMm, [297, 210]);
  assert.ok(Math.abs(wide.innerW - (297 - 2 * PRINT_MARGIN_MM) * PX) < 1e-6);
  assert.ok(Math.abs(wide.imageW / wide.imageH - 1123 / 794) < 1e-9);
  assert.ok(wide.imageW <= wide.innerW + 1e-6 && wide.imageH <= wide.innerH + 1e-6);
  // Centred: the space left on both sides is the same.
  assert.ok(Math.abs(wide.offsetX * 2 + wide.imageW - wide.innerW) < 1e-6 && Math.abs(wide.offsetY * 2 + wide.imageH - wide.innerH) < 1e-6);
  const tall = planPrint(300, 900, `a3`, `fit`);
  assert.equal(tall.orientation, `portrait`);
  assert.deepEqual(tall.paperMm, [297, 420]);
  const tiny = planPrint(20, 10, `a4`, `fit`);
  assert.ok(Math.abs(tiny.imageW - 20 * PRINT_MAX_ENLARGE) < 1e-9, `un petit dessin n'est pas agrandi sans limite`);
});

test(`taille reelle : un dessin qui tient reste a sa taille sur une feuille, un grand est coupe en feuilles a assembler`, () => {
  const small = planPrint(400, 300, `a4`, `real`);
  assert.equal(small.sheets.length, 1);
  assert.deepEqual([small.imageW, small.imageH], [400, 300]);
  const big = planPrint(2000, 900, `a4`, `real`);
  assert.ok(big.sheets.length > 1 && big.sheets.length === big.columns * big.rows, `${big.columns} x ${big.rows}`);
  assert.equal(big.orientation, `portrait`, `trois feuilles en portrait contre quatre en paysage`);
  assert.equal(big.sheets.length, 3);
  assert.deepEqual([big.imageW, big.imageH], [2000, 900], `l'echelle est 1`);
  // Every part of the picture is on some sheet, and the sheets are in reading order.
  assert.ok(big.columns * big.innerW >= 2000 && big.rows * big.innerH >= 900);
  assert.ok((big.columns - 1) * big.innerW < 2000 && (big.rows - 1) * big.innerH < 900, `aucune feuille vide`);
  assert.deepEqual(big.sheets.slice(0, 2), [{ col: 0, row: 0 }, { col: 1, row: 0 }]);
  assert.equal(big.offsetX, 0);
  // The orientation that takes the fewest sheets is chosen.
  const tallBig = planPrint(700, 3000, `a4`, `real`);
  assert.equal(tallBig.orientation, `portrait`);
});

test(`a taille reelle une feuille est evitee quand il en faudrait trop : l'image est ajustee et le dit`, () => {
  const huge = planPrint(20000, 20000, `a4`, `real`);
  assert.equal(huge.tooBig, true);
  assert.equal(huge.sheets.length, 1);
  const edge = planPrint(2000, 900, `a3`, `real`);
  assert.ok(edge.sheets.length <= PRINT_MAX_SHEETS && !edge.tooBig);
  assert.equal(planPrint(0, 0, `a4`, `fit`).sheets.length, 1);
  assert.equal(isPaper(`a4`) && isPaper(`a3`) && !isPaper(`letter`) && !isPaper(4), true);
});
