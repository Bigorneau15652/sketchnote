import { test } from "node:test";
import assert from "node:assert/strict";
import { ImageElement, isCrop, isSafeImagePath, readElements, SketchElement } from "../src/elements";
import { boxOf, hitElement, visibleSides } from "../src/geometry";
import { extensionOf, freeName, isImageName, matchesName, pastedName, sniffImage } from "../src/image-files";
import { imageUrl, setImageResolver } from "../src/image-registry";
import { imageSites } from "../src/image-sites";
import { panelKinds, sectionShown } from "../src/panel-kinds";
import { elementPaths } from "../src/shape-paths";
import { resizeElement, resizeSide } from "../src/transform";
import { applyStyle, styleOf } from "../src/style";
import { flipElements } from "../src/flip";
import { reorderStep } from "../src/selection-ops";

const picture = (extra: Record<string, unknown> = {}): unknown => ({ id: `p`, type: `image`, x: 100, y: 50, width: 200, height: 100, path: `Images/photo.png`, stroke: `#000000`, strokeWidth: 2, seed: 3, ...extra });
const make = (extra: Record<string, unknown> = {}): ImageElement => (readElements([picture(extra)]) as { ok: true; elements: SketchElement[] }).elements[0] as ImageElement;

test(`un element image relit son chemin, son rognage, sa bordure et ses coins, et refuse le reste`, () => {
  const el = make({ crop: [0.1, 0, 0.2, 0.3], frame: true, border: `double`, radius: 14, angle: 30 });
  assert.deepEqual([el.type, el.path, el.crop, el.frame, el.border, el.radius, el.angle], [`image`, `Images/photo.png`, [0.1, 0, 0.2, 0.3], true, `double`, 14, 30]);
  assert.equal(make({ crop: [0, 0, 0, 0] }).crop, undefined, `un rognage vide n'est pas gardé`);
  for (const bad of [{ path: undefined }, { path: `` }, { crop: [0.95, 0, 0, 0] }, { crop: [0.5, 0, 0.5, 0] }, { crop: [0, 0, 0] }, { crop: `x` }, { frame: `oui` }, { border: `simple` }, { width: 0 }, { stroke: `url(#x)` }]) {
    assert.equal(readElements([picture(bad)]).ok, false, JSON.stringify(bad));
  }
});

test(`le chemin d'une image reste dans le coffre : pas de adresse, pas de remontée, une extension d'image`, () => {
  for (const ok of [`a.png`, `Images/photo.JPG`, `Dossier/sous dossier/x.webp`, `a/b.svg`, `a/b.gif`, `a/b.jpeg`]) assert.equal(isSafeImagePath(ok), true, ok);
  for (const bad of [``, `../a.png`, `a/../b.png`, `/a.png`, `\\a.png`, `C:/a.png`, `https://site.org/a.png`, `data:image/png;base64,AAAA`, `a/b.exe`, `a/b`, `.png`, `a//b.png`, `a/./b.png`, `a/b.png\u0000`, `a`.repeat(5000) + `.png`, 5, null]) {
    assert.equal(isSafeImagePath(bad), false, String(bad));
  }
  assert.equal(isCrop([0, 0, 0.9, 0]), true);
  assert.equal(isCrop([0, 0, 0.91, 0]), false);
});

test(`une image se reconnaît à ses premiers octets, pas à son nom`, () => {
  const bytes = (...n: number[]): Uint8Array => Uint8Array.from(n);
  assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a)), `png`);
  assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)), `jpg`);
  assert.equal(sniffImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), `gif`);
  assert.equal(sniffImage(Uint8Array.from([...`RIFF`].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...`WEBP`].map((c) => c.charCodeAt(0))))), `webp`);
  const text = (s: string): Uint8Array => new TextEncoder().encode(s);
  assert.equal(sniffImage(text(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>`)), `svg`);
  assert.equal(sniffImage(text(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)), null, `un svg avec un script est refusé`);
  assert.equal(sniffImage(text(`<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>`)), null);
  assert.equal(sniffImage(text(`<svg><a href="javascript:x"/></svg>`)), null);
  assert.equal(sniffImage(text(`MZ programme`)), null);
  assert.equal(sniffImage(bytes()), null);
});

test(`les noms de fichiers d'image : extension, nom libre, nom d'une image collée, recherche sans accents`, () => {
  assert.equal(extensionOf(`a.b.PNG`), `png`);
  assert.equal(isImageName(`x.webp`) && !isImageName(`x.md`) && !isImageName(`png`), true);
  assert.equal(freeName(`a.png`, new Set([`b.png`])), `a.png`);
  assert.equal(freeName(`a.png`, new Set([`A.png`, `a 2.png`])), `a 3.png`);
  assert.equal(pastedName(new Date(2026, 10, 5, 9, 8, 7), `png`), `Image 2026-11-05 09-08-07.png`);
  assert.equal(matchesName(`Dossier/Énergie solaire.png`, `energie SOLAIRE`), true);
  assert.equal(matchesName(`Dossier/a.png`, `b`), false);
});

test(`une image est dessinée dans sa boîte : sa bordure seulement quand elle en a une, et le résolveur donne son adresse`, () => {
  const el = make();
  assert.deepEqual(boxOf(el), { box: { x: 100, y: 50, w: 200, h: 100 }, angle: 0 });
  assert.equal(elementPaths(el).pieces.length, 0, `sans bordure aucun tracé`);
  assert.ok(elementPaths(make({ frame: true })).pieces.length > 0, `avec une bordure`);
  assert.equal(elementPaths(make({ angle: 20 })).transform, `rotate(20 200 100)`);
  assert.equal(imageUrl(`Images/photo.png`), null, `sans résolveur`);
  setImageResolver((p) => (p === `Images/photo.png` ? `app://x/photo.png` : null));
  assert.equal(imageUrl(`Images/photo.png`), `app://x/photo.png`);
  assert.equal(imageUrl(`Images/autre.png`), null);
  setImageResolver(() => {
    throw new Error(`boom`);
  });
  assert.equal(imageUrl(`Images/photo.png`), null, `une erreur du résolveur donne rien`);
  setImageResolver(() => null);
});

test(`une image se touche dans toute sa boîte et a quatre poignées de côté`, () => {
  const el = make();
  assert.equal(hitElement(el, [200, 100], 3), true);
  assert.equal(hitElement(el, [50, 100], 3), false);
  assert.deepEqual(visibleSides(el), [0, 1, 2, 3]);
});

test(`le panneau d'une image montre la couleur, l'épaisseur, la bordure, les coins, l'image et les effets, et pas le remplissage`, () => {
  const ALL = [`colour`, `fill`, `width`, `dash`, `look`, `border`, `corners`, `regularity`, `brush`, `edges`, `heads`, `text`, `warp`, `icon`, `image`, `effects`] as const;
  const shown = ALL.filter((s) => sectionShown(s, panelKinds(`select`, [make()])));
  assert.deepEqual(shown, [`colour`, `width`, `dash`, `look`, `border`, `corners`, `image`, `effects`]);
});

test(`depuis un coin une image garde ses proportions, depuis un côté elle s'étire`, () => {
  const el = make();
  const corner = resizeElement(el, 2, [400, 300], false) as ImageElement;
  assert.ok(Math.abs(corner.width / corner.height - 2) < 0.01);
  const side = resizeSide(el, 1, [400, 100], false) as ImageElement;
  assert.deepEqual([side.width, side.height], [300, 100]);
  assert.equal(side.crop, undefined);
});

test(`en mode rogner les côtés coupent l'image au lieu de l'étirer, sans dépasser l'image entière`, () => {
  const el = make();
  // The right side moved inward by 50: a quarter of the width is cut.
  const cut = resizeSide(el, 1, [250, 100], false, true) as ImageElement;
  assert.deepEqual([cut.x, cut.width, cut.height], [100, 150, 100]);
  assert.deepEqual(cut.crop, [0, 0, 0.25, 0]);
  // The left side moved inward by 40: the crop of the left follows and the right edge stays.
  const left = resizeSide(cut, 3, [140, 100], false, true) as ImageElement;
  assert.equal(left.x + left.width, 250);
  assert.ok(Math.abs((left.crop?.[0] ?? 0) - 40 / 200) < 0.001);
  assert.equal(left.crop?.[2], 0.25);
  // Pulling the right side outward gives back the cut part, and no more than the whole picture.
  const back = resizeSide(cut, 1, [900, 100], false, true) as ImageElement;
  assert.equal(back.width, 200);
  assert.equal(back.crop, undefined, `plus rien n'est coupé : le champ disparaît`);
  // At most nine tenths can be cut: a tenth stays visible.
  const most = resizeSide(el, 1, [101, 100], false, true) as ImageElement;
  assert.ok(Math.abs(most.width - 20) < 0.01 && Math.abs((most.crop?.[2] ?? 0) - 0.9) < 0.001);
  // A corner cuts two sides at once, with the opposite corner fixed.
  const corner = resizeElement(el, 0, [150, 75], false, true) as ImageElement;
  assert.equal(corner.x + corner.width, 300);
  assert.equal(corner.y + corner.height, 150);
  assert.deepEqual(corner.crop, [0.25, 0.25, 0, 0]);
  // Not in crop mode, the same drag only stretches.
  assert.equal((resizeSide(el, 1, [250, 100], false) as ImageElement).crop, undefined);
});

test(`le style d'une image : la bordure du menu (aucune, simple ou autre), les coins et les effets`, () => {
  const el = make();
  assert.equal(styleOf(el)?.border, `none`);
  const simple = applyStyle(el, { border: `simple` }) as ImageElement;
  assert.deepEqual([simple.frame, simple.border], [true, undefined]);
  assert.equal(styleOf(simple)?.border, `simple`);
  const double = applyStyle(simple, { border: `double` }) as ImageElement;
  assert.deepEqual([double.frame, double.border], [true, `double`]);
  const none = applyStyle(double, { border: `none` }) as ImageElement;
  assert.deepEqual([none.frame, none.border], [undefined, undefined]);
  assert.equal((applyStyle(el, { radius: 40 }) as ImageElement).radius, 40);
  assert.equal((applyStyle(el, { opacity: 0.5 }) as ImageElement).opacity, 0.5);
  assert.equal((applyStyle(make({ locked: true }), { radius: 40 }) as ImageElement).radius, undefined, `verrouillée : rien ne change`);
});

test(`une image se retourne et change de niveau comme les autres éléments`, () => {
  const list = [make({ id: `a` }), make({ id: `b`, x: 150 })];
  const flipped = flipElements(list, new Set([`a`]), `x`)[0] as ImageElement;
  assert.equal(flipped.flipX, true);
  assert.deepEqual(reorderStep(list, new Set([`a`]), `up`).map((e) => e.id), [`b`, `a`]);
});

test(`les sites d'images proposés sont des adresses https sans identifiants`, () => {
  const sites = imageSites();
  assert.ok(sites.length >= 7);
  for (const s of sites) {
    const url = new URL(s.url);
    assert.equal(url.protocol, `https:`);
    assert.equal(url.username + url.password, ``);
  }
});
