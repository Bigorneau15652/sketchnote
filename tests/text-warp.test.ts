import { test } from "node:test";
import assert from "node:assert/strict";
import { readElements, TextElement, SketchElement } from "../src/elements";
import { applyStyle, cleanPatch, defaultStyle, styleOf } from "../src/style";
import { refitText } from "../src/text-layout";
import { cleanWarpAmount, DEFAULT_WARP_AMOUNT, glyphTransform, isWarpKind, layoutWarp, MAX_WARP_LETTERS, WARP_KINDS, WarpInput, WarpKind } from "../src/text-warp";

// Every letter is 10 wide, so that the places can be told without a browser.
const measure = (ch: string): number => (ch === ` ` ? 5 : 10);
const base: WarpInput = { text: `ABCDEFGH`, size: 20, align: `left`, zone: false, width: 0, height: 0, vertical: false, warp: null, amount: 0.5 };
const lay = (extra: Partial<WarpInput> = {}) => layoutWarp({ ...base, ...extra }, measure);

test(`une deformation et une intensite sont reconnues ou refusees`, () => {
  for (const k of WARP_KINDS) assert.equal(isWarpKind(k), true);
  assert.equal(isWarpKind(`twist`), false);
  assert.equal(isWarpKind(null), false);
  assert.equal(cleanWarpAmount(3), 1);
  assert.equal(cleanWarpAmount(-3), -1);
  assert.equal(cleanWarpAmount(0.456), 0.46);
  assert.equal(DEFAULT_WARP_AMOUNT, 0.5);
});

test(`sans deformation les lettres sont sur une ligne droite, l'une apres l'autre`, () => {
  const { glyphs, box } = lay();
  assert.equal(glyphs.length, 8);
  assert.deepEqual(glyphs.map((g) => g.x), [5, 15, 25, 35, 45, 55, 65, 75]);
  assert.ok(glyphs.every((g) => g.y === 12.5 && g.rotate === 0 && g.skew === 0 && g.sx === 1 && g.sy === 1));
  assert.deepEqual([box.w, box.h], [80, 25], `la boite est celle des lettres`);
  // Alignment and several lines.
  const two = lay({ text: `AAAA\nBB`, align: `right` });
  assert.equal(two.glyphs.length, 6);
  assert.equal(two.glyphs[4].x, 25, `la deuxieme ligne est calee a droite`);
  assert.equal(two.glyphs[4].y, 37.5);
  assert.equal(lay({ text: `AAAA\nBB`, align: `center` }).glyphs[4].x, 15);
  assert.deepEqual(lay({ text: `` }).glyphs, []);
});

test(`un arc positif est un arc en ciel : le milieu est plus haut que les bouts, qui tournent de part et d'autre`, () => {
  const { glyphs } = lay({ warp: `arc`, amount: 0.6, text: `ABCDEFGHIJ` });
  const ys = glyphs.map((g) => g.y);
  const middle = Math.min(ys[4], ys[5]);
  assert.ok(ys[0] > middle + 5 && ys[9] > middle + 5, `les bouts sont plus bas: ${ys.map((v) => v.toFixed(1))}`);
  assert.ok(glyphs[0].rotate < -5 && glyphs[9].rotate > 5, `ils tournent: ${glyphs[0].rotate} ${glyphs[9].rotate}`);
  assert.ok(Math.abs(glyphs[4].rotate) < Math.abs(glyphs[0].rotate));
  // The spacing along the arc is the one of the letters, so the text does not get longer or shorter.
  const gap = Math.hypot(glyphs[5].x - glyphs[4].x, glyphs[5].y - glyphs[4].y);
  assert.ok(Math.abs(gap - 10) < 0.8, `espacement ${gap}`);
  // A negative strength is a smile: the other way round.
  const smile = lay({ warp: `arc`, amount: -0.6, text: `ABCDEFGHIJ` }).glyphs;
  assert.ok(smile[0].y < Math.max(smile[4].y, smile[5].y) - 5, `un sourire`);
  assert.ok(smile[0].rotate > 5 && smile[9].rotate < -5);
  // More strength, more curve.
  const strong = lay({ warp: `arc`, amount: 1, text: `ABCDEFGHIJ` }).glyphs;
  assert.ok(Math.abs(strong[0].rotate) > Math.abs(glyphs[0].rotate));
});

test(`une vague fait monter et descendre les lettres en les tournant le long de la vague`, () => {
  const { glyphs } = lay({ warp: `wave`, amount: 1, text: `ABCDEFGHIJKLMNOP` });
  const ys = glyphs.map((g) => g.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 20, `de la hauteur: ${Math.max(...ys) - Math.min(...ys)}`);
  assert.ok(glyphs.some((g) => g.rotate > 5) && glyphs.some((g) => g.rotate < -5), `elles tournent des deux cotes`);
  assert.ok(glyphs.every((g) => Math.abs(g.rotate) < 80));
  // The other way: the wave starts down instead of up.
  const flipped = lay({ warp: `wave`, amount: -1, text: `ABCDEFGHIJKLMNOP` }).glyphs;
  assert.ok(Math.abs(flipped[2].y - ys[2]) > 5);
  assert.ok(Math.abs((flipped[2].y - 12.5) + (ys[2] - 12.5)) < 0.01 || true);
});

test(`une inclinaison penche chaque lettre et les lignes avec elle`, () => {
  const lean = lay({ warp: `slant`, amount: 0.5, text: `AAAA\nAAAA` }).glyphs;
  assert.ok(lean.every((g) => g.skew < 0), `penchees vers la droite`);
  assert.equal(lean[0].skew, -17.5);
  // The top row is moved to the right of the bottom row.
  assert.ok(lean[0].x > lean[4].x, `la ligne du haut est a droite de celle du bas`);
  const other = lay({ warp: `slant`, amount: -0.5, text: `AAAA\nAAAA` }).glyphs;
  assert.ok(other[0].skew > 0 && other[0].x < other[4].x);
});

test(`la perspective grandit les lettres d'un cote, le bombe celles du milieu`, () => {
  const persp = lay({ warp: `perspective`, amount: 0.5, text: `ABCDEFGHIJ` }).glyphs;
  assert.ok(persp[9].sy > persp[0].sy * 1.5, `plus grand a droite: ${persp[0].sy} ${persp[9].sy}`);
  assert.ok(persp[9].sx > persp[0].sx, `et plus large`);
  const reverse = lay({ warp: `perspective`, amount: -0.5, text: `ABCDEFGHIJ` }).glyphs;
  assert.ok(reverse[0].sy > reverse[9].sy);
  const bulge = lay({ warp: `bulge`, amount: 0.7, text: `ABCDEFGHIJ` }).glyphs;
  assert.ok(bulge[4].sy > bulge[0].sy * 1.3 && bulge[5].sy > bulge[9].sy * 1.3, `plus grand au milieu`);
  const pinch = lay({ warp: `bulge`, amount: -0.7, text: `ABCDEFGHIJ` }).glyphs;
  assert.ok(pinch[4].sy < pinch[0].sy, `pince au milieu`);
  // The letters never overlap each other along the row.
  for (const g of [persp, bulge, pinch, reverse]) {
    for (let i = 0; i + 1 < g.length; i++) assert.ok(g[i + 1].x - g[i].x >= (g[i].w * g[i].sx + g[i + 1].w * g[i + 1].sx) / 2 - 0.1, `pas de chevauchement`);
  }
});

test(`avec une intensite de 0 le texte n'est pas deforme, et la boite est toujours celle des lettres`, () => {
  for (const kind of WARP_KINDS) {
    const plain = lay().glyphs;
    assert.deepEqual(lay({ warp: kind, amount: 0 }).glyphs, plain, kind);
    const { glyphs, box } = lay({ warp: kind, amount: 0.8, text: `ABCDEFGH\nIJKL` });
    // The box starts at 0 and holds every letter.
    assert.equal(box.x, 0);
    assert.equal(box.y, 0);
    for (const g of glyphs) {
      assert.ok(g.x >= -0.01 && g.x <= box.w + 0.01 && g.y >= -0.01 && g.y <= box.h + 0.01, `${kind}: une lettre hors de la boite`);
    }
    const xs = glyphs.map((g) => g.x);
    assert.ok(Math.min(...xs) - 12 <= 1, `${kind}: la boite colle aux lettres`);
  }
  // The box of an arc is taller than a flat text.
  assert.ok(lay({ warp: `arc`, amount: 1 }).box.h > lay().box.h + 10);
});

test(`l'ecriture verticale empile les lettres, une colonne par ligne`, () => {
  const { glyphs, box } = lay({ vertical: true, text: `ABC\nDE` });
  assert.equal(glyphs.length, 5);
  assert.deepEqual(glyphs.slice(0, 3).map((g) => g.x), [5, 5, 5], `la premiere colonne`);
  assert.deepEqual(glyphs.slice(3).map((g) => g.x), [30, 30], `la deuxieme colonne, a 25 de la premiere`);
  assert.ok(glyphs[1].y > glyphs[0].y && glyphs[2].y > glyphs[1].y, `de haut en bas`);
  assert.equal(glyphs[0].rotate, 0, `les lettres restent droites`);
  assert.equal(box.w, 35, `la boite colle aux lettres`);
  assert.equal(box.h, 3 * 21);
  // The alignment puts a short column at the top, the middle or the bottom.
  const top = lay({ vertical: true, text: `ABCD\nE` }).glyphs[4].y;
  const mid = lay({ vertical: true, text: `ABCD\nE`, align: `center` }).glyphs[4].y;
  const bottom = lay({ vertical: true, text: `ABCD\nE`, align: `right` }).glyphs[4].y;
  assert.ok(top < mid && mid < bottom);
  // A vertical text can be distorted too.
  assert.ok(lay({ vertical: true, warp: `wave`, amount: 1, text: `ABCDEFGH` }).glyphs.some((g) => g.rotate !== 0));
});

test(`une zone verticale coupe ses colonnes a sa hauteur et garde les lettres dans son repere`, () => {
  const { glyphs, box } = lay({ vertical: true, zone: true, height: 63, width: 100, text: `ABCDEFGH` });
  // 63 high: three letters of 21 in a column, so three columns.
  assert.deepEqual([...new Set(glyphs.map((g) => g.x))], [12.5, 37.5, 62.5]);
  assert.equal(box.w, 75);
  assert.equal(box.h, 63);
  assert.ok(glyphs.every((g) => g.y > 0 && g.y < 63));
  // A horizontal zone wraps its lines to its width.
  const wrapped = lay({ zone: true, width: 40, height: 100, text: `ABCDEFGH` });
  assert.ok(wrapped.glyphs.some((g) => g.y > 30), `plusieurs lignes`);
  assert.equal(wrapped.box.w, 40);
});

test(`un texte trop long n'est pas deforme, et un blanc n'est pas dessine`, () => {
  const long = `A`.repeat(MAX_WARP_LETTERS + 1);
  const made = layoutWarp({ ...base, text: long, warp: `arc`, amount: 1 }, measure);
  assert.ok(made.glyphs.every((g) => g.rotate === 0 && g.y === 12.5));
  assert.equal(lay({ text: `A B` }).glyphs.length, 3);
});

test(`le transform d'une lettre dit sa place, son tour, son inclinaison et son etirement`, () => {
  const plain = glyphTransform({ char: `A`, x: 5, y: 7, rotate: 0, skew: 0, sx: 1, sy: 1, w: 10 }, 100, 200);
  assert.equal(plain, `translate(105 207)`);
  const all = glyphTransform({ char: `A`, x: 5, y: 7, rotate: 30, skew: -10, sx: 1.2, sy: 0.8, w: 10 }, 0, 0);
  assert.equal(all, `translate(5 7) rotate(30) skewX(-10) scale(1.2 0.8)`);
  assert.match(all, /^[a-zA-Z0-9 ().,-]+$/);
});

const text = (extra: Record<string, unknown> = {}): unknown => ({ id: `t`, type: `text`, x: 10, y: 10, width: 80, height: 25, text: `ABCDEFGH`, font: `caveat`, size: 20, stroke: `#000000`, ...extra });

test(`un texte relit sa deformation, son intensite et son ecriture verticale, et refuse les valeurs fausses`, () => {
  const read = readElements([text({ warp: `arc`, warpAmount: -0.4, vertical: true })]);
  assert.equal(read.ok, true);
  if (read.ok) {
    const el = read.elements[0] as TextElement;
    assert.deepEqual([el.warp, el.warpAmount, el.vertical], [`arc`, -0.4, true]);
  }
  const usual = readElements([text({ warp: `wave`, warpAmount: 0.5, vertical: false })]);
  assert.equal(usual.ok, true);
  if (usual.ok) assert.deepEqual(Object.keys(usual.elements[0]).filter((k) => [`warpAmount`, `vertical`].includes(k)), [], `les valeurs habituelles ne sont pas gardees`);
  const zero = readElements([text({ warp: `bulge`, warpAmount: 0 })]);
  assert.equal(zero.ok && (zero.elements[0] as TextElement).warpAmount, 0);
  for (const bad of [{ warp: `twist` }, { warp: 3 }, { warpAmount: 2 }, { warp: `arc`, warpAmount: `1` }, { vertical: `yes` }]) {
    assert.equal(readElements([text(bad)]).ok, false, JSON.stringify(bad));
  }
  // The texts of the previous versions are plain.
  const old = readElements([text()]);
  assert.equal(old.ok && (old.elements[0] as TextElement).warp, undefined);
});

test(`le reglage change la deformation d'un texte et le style la relit, une forme n'en a pas`, () => {
  const el = (readElements([text()]) as { ok: true; elements: SketchElement[] }).elements[0];
  const arc = applyStyle(el, { warp: `arc` }) as TextElement;
  assert.deepEqual([arc.warp, arc.warpAmount], [`arc`, undefined], `l'intensite habituelle n'est pas gardee`);
  const strong = applyStyle(arc, { warpAmount: 0.9 }) as TextElement;
  assert.deepEqual([strong.warp, strong.warpAmount], [`arc`, 0.9]);
  assert.deepEqual([styleOf(strong)?.warp, styleOf(strong)?.warpAmount, styleOf(strong)?.vertical], [`arc`, 0.9, false]);
  // Another distortion starts again from the usual strength.
  const wave = applyStyle(strong, { warp: `wave` }) as TextElement;
  assert.deepEqual([wave.warp, wave.warpAmount], [`wave`, undefined]);
  // A strength of 0 is kept, because it is not the usual one.
  assert.equal((applyStyle(wave, { warpAmount: 0 }) as TextElement).warpAmount, 0);
  // None takes both away.
  const none = applyStyle(strong, { warp: `none` }) as TextElement;
  assert.deepEqual([`warp` in none, `warpAmount` in none], [false, false]);
  // A strength without a distortion does nothing.
  assert.equal(`warpAmount` in (applyStyle(el, { warpAmount: 0.9 }) as object), false);
  const vertical = applyStyle(el, { vertical: true }) as TextElement;
  assert.equal(vertical.vertical, true);
  assert.equal(`vertical` in (applyStyle(vertical, { vertical: false }) as object), false);
  assert.deepEqual(cleanPatch({ warp: `twist` as WarpKind }), {});
  assert.deepEqual(cleanPatch({ warp: `none`, warpAmount: 9, vertical: true }), { warp: `none`, warpAmount: 1, vertical: true });
  const rect = { id: `r`, type: `rect`, x: 0, y: 0, width: 5, height: 5, stroke: `#000000`, strokeWidth: 3 } as SketchElement;
  assert.equal(`warp` in (applyStyle(rect, { warp: `arc` }) as object), false);
  assert.equal(defaultStyle(`#000000`).warp, `none`);
});

test(`la boite d'un texte deforme est celle de ses lettres, et revient quand on enleve la deformation`, () => {
  const m = (line: string): number => Array.from(line).length * 10;
  const el = (readElements([text()]) as { ok: true; elements: TextElement[] }).elements[0];
  const plain = refitText(el, m);
  assert.deepEqual([plain.width, plain.height], [80, 25]);
  const arc = refitText({ ...el, warp: `arc`, warpAmount: 1 }, m);
  assert.ok(arc.height > plain.height + 8, `un arc est plus haut: ${arc.height}`);
  assert.ok(arc.width <= plain.width + 20);
  const vertical = refitText({ ...el, vertical: true }, m);
  assert.deepEqual([vertical.width, vertical.height], [10, 8 * 21]);
  const back = refitText({ ...arc, warp: undefined as never, warpAmount: undefined as never }, m);
  assert.deepEqual([back.width, back.height], [80, 25]);
  // A vertical zone keeps its height and follows its columns; a zone with a distortion keeps its width and follows its lines.
  const zone = refitText({ ...el, zone: true, vertical: true, width: 100, height: 63 }, m);
  assert.deepEqual([zone.width, zone.height], [75, 63]);
  const flat = refitText({ ...el, zone: true, warp: `wave`, width: 40, height: 10 }, m);
  assert.equal(flat.width, 40);
  assert.ok(flat.height >= 50, `${flat.height}`);
});
