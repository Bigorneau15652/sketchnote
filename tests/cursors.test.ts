import { test } from "node:test";
import assert from "node:assert/strict";
import { penCursor, penCursorImage } from "../src/cursors";

// Returns the numbers of an attribute of an element of the picture.
const numbers = (svg: string, tag: string, attr: string): number[] => [...svg.matchAll(new RegExp(`<${tag} [^>]*?${attr}="(-?[0-9.]+)"`, `g`))].map((m) => Number(m[1]));

test(`un petit trait donne une cible de quatre traits qui ne se touchent pas`, () => {
  const img = penCursorImage(4);
  assert.equal(img.ring, false);
  // Four marks, each drawn twice (a white edge then a dark line).
  assert.equal((img.svg.match(/<line /g) ?? []).length, 8);
  const x1 = numbers(img.svg, `line`, `x1`);
  const x2 = numbers(img.svg, `line`, `x2`);
  const y1 = numbers(img.svg, `line`, `y1`);
  const y2 = numbers(img.svg, `line`, `y2`);
  const c = img.centre;
  // The left mark ends before the middle, the right one starts after it: an empty space is left in the middle.
  const left = [x1[0], x2[0]];
  const right = [x1[1], x2[1]];
  assert.ok(Math.max(...left) < c - 2, `le trait de gauche s'arrete avant le milieu: ${left}`);
  assert.ok(Math.min(...right) > c + 2, `le trait de droite commence apres le milieu: ${right}`);
  const top = [y1[2], y2[2]];
  const bottom = [y1[3], y2[3]];
  assert.ok(Math.max(...top) < c - 2 && Math.min(...bottom) > c + 2);
  // The four marks stay inside the picture.
  for (const v of [...x1, ...x2, ...y1, ...y2]) assert.ok(v >= 0 && v <= img.size, `dans l'image: ${v}`);
  assert.equal(img.centre, img.size / 2);
});

test(`l'espace du milieu grandit avec le trait mais reste dans l'image`, () => {
  const gapOf = (d: number): number => {
    const img = penCursorImage(d);
    return img.centre - Math.max(numbers(img.svg, `line`, `x2`)[0], numbers(img.svg, `line`, `x1`)[0]);
  };
  assert.ok(gapOf(12) > gapOf(2), `${gapOf(2)} puis ${gapOf(12)}`);
  assert.ok(gapOf(0) >= 3 - 0.01, `au moins 3 pixels de chaque cote`);
  for (const d of [0, 1, 5, 9, 13.9]) {
    const img = penCursorImage(d);
    for (const v of [...numbers(img.svg, `line`, `x1`), ...numbers(img.svg, `line`, `x2`)]) assert.ok(v >= 0 && v <= img.size, `d=${d}: ${v}`);
  }
});

test(`un gros trait donne un rond de la taille du trait`, () => {
  const img = penCursorImage(40);
  assert.equal(img.ring, true);
  assert.equal((img.svg.match(/<line /g) ?? []).length, 0);
  assert.deepEqual(numbers(img.svg, `circle`, `r`), [20, 20], `le rond a le diametre du trait (blanc dessous, sombre dessus)`);
  assert.ok(img.size >= 40 && img.size <= 128);
  assert.equal(img.centre, img.size / 2);
  assert.equal(penCursorImage(14).ring, true, `le rond commence a 14 pixels`);
  assert.equal(penCursorImage(13.9).ring, false);
});

test(`le rond ne depasse jamais les 128 pixels qu'un navigateur accepte`, () => {
  for (const d of [118, 119, 300, 5000, Infinity]) {
    const img = penCursorImage(d);
    assert.ok(img.size <= 128, `${d}: ${img.size}`);
  }
  assert.equal(penCursorImage(NaN).ring, false, `une valeur fausse donne la cible`);
  assert.equal(penCursorImage(-5).ring, false);
});

test(`la valeur du curseur est une adresse de donnees sans guillemet ni caractere a risque, avec la croix en secours`, () => {
  for (const d of [2, 8, 30, 90]) {
    const css = penCursor(d);
    assert.match(css, /^url\("data:image\/svg\+xml,[A-Za-z0-9%_.!~*'()-]+"\) [0-9.]+ [0-9.]+, crosshair$/, css.slice(0, 60));
    // Decoded, the picture holds only the shapes of the cursor.
    const decoded = decodeURIComponent(css.slice(css.indexOf(`,`) + 1, css.indexOf(`")`)));
    assert.ok(decoded.startsWith(`<svg `) && decoded.endsWith(`</svg>`));
    assert.ok(!/script|href|onload|javascript|<image|<use|<style/i.test(decoded));
  }
  // The hot spot is the middle of the picture.
  const css = penCursor(40);
  const size = penCursorImage(40).size;
  assert.ok(css.includes(`) ${size / 2} ${size / 2}, crosshair`));
});
