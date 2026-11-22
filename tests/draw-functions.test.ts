import { test } from "node:test";
import assert from "node:assert/strict";
import { addSeparator, DEFAULT_ORDER, drawFunctions, functionOfTool, isSeparator, moveEntry, railItems, readHidden, readOrder, removeEntry, setHidden, shortWord } from "../src/draw-functions";
import { DEFAULT_SETTINGS, readSettings } from "../src/settings";
import { sectionShown } from "../src/panel-kinds";

const ids = drawFunctions().map((f) => f.id as string);

test(`chaque fonction a un identifiant unique, un nom, un picto et une aide, et chaque outil appartient a une seule fonction`, () => {
  assert.equal(new Set(ids).size, ids.length);
  for (const f of drawFunctions()) {
    assert.ok(f.name() !== `` && f.icon !== `` && f.help().length >= 1 && f.help().every((p) => p.length > 10), f.id);
  }
  const tools = drawFunctions().flatMap((f) => f.tools);
  assert.equal(new Set(tools).size, tools.length, `un outil dans une seule fonction`);
  for (const tool of [`select`, `hand`, `rect`, `diamond`, `ellipse`, `triangle`, `line`, `arrow`, `pen`, `point`, `text`]) assert.ok(functionOfTool(tool) !== null, tool);
  // Each tool has its own button: the function of a tool is the tool itself.
  for (const tool of [`select`, `hand`, `rect`, `diamond`, `ellipse`, `triangle`, `line`, `arrow`, `pen`, `point`, `text`]) assert.equal(functionOfTool(tool), tool);
  assert.deepEqual(drawFunctions().filter((f) => f.tools.length > 1).map((f) => f.id), [], `aucun bouton ne regroupe plusieurs outils`);
  const names = drawFunctions().map((f) => f.name());
  assert.equal(new Set(names).size, names.length, `deux boutons ne portent jamais le meme nom`);
  for (const gone of [`colours`, `stroke`, `effects`]) assert.ok(!ids.includes(gone), `${gone} n'a plus de bouton : ses reglages sont dans le menu de l'outil ou de la selection`);
  assert.equal(functionOfTool(`unknown`), null);
});

test(`l'ordre habituel contient chaque fonction une fois, avec des separations entre les groupes`, () => {
  assert.deepEqual(DEFAULT_ORDER.filter((id) => !isSeparator(id)).sort(), [...ids].sort());
  assert.equal(DEFAULT_ORDER.filter(isSeparator).length, 4);
  assert.equal(DEFAULT_ORDER[0], `select`);
});

test(`les fonctions qui s'ouvrent en fenetre sont les icones, les images, la bibliotheque et l'export, et les autres montrent des parties du menu`, () => {
  const opens = drawFunctions().filter((f) => f.opens).map((f) => `${f.id}:${f.opens}`);
  assert.deepEqual(opens, [`icons:icons`, `images:images`, `library:library`, `export:export`]);
  for (const f of drawFunctions()) if (f.id !== `export` && f.id !== `hand` && f.id !== `library`) assert.ok(f.sections.length > 0, f.id);
  assert.equal(sectionShown(`organise`, new Set()), true);
  assert.equal(sectionShown(`display`, new Set([`rect`])), true);
});

test(`un ordre enregistre est relu : inconnus et doublons retires, fonctions manquantes ajoutees a la fin, valeur fausse = ordre habituel`, () => {
  assert.deepEqual(readOrder(undefined, ids), DEFAULT_ORDER);
  assert.deepEqual(readOrder(`x`, ids), DEFAULT_ORDER);
  // An order saved when the tools were grouped is replaced by the usual one.
  assert.deepEqual(readOrder([`select`, `draw`, `shapes`, `lines`, `text`], ids), DEFAULT_ORDER);
  const order = readOrder([`export`, `inconnue`, `select`, `select`, `sep:1`, `sep:1`, `sep:99999999999`, 5, null], ids);
  assert.deepEqual(order.slice(0, 3), [`export`, `select`, `sep:1`]);
  assert.ok(ids.every((id) => order.includes(id)), `toutes les fonctions sont la`);
  assert.equal(order.filter((id) => id === `select`).length, 1);
  assert.ok(!order.includes(`inconnue`) && !order.includes(`sep:99999999999`));
  assert.deepEqual(readHidden([`icons`, `icons`, `nimporte`, 4], ids), [`icons`]);
  assert.deepEqual(readHidden(`x`, ids), []);
  assert.equal(readOrder(new Array(500).fill(`select`), ids).length <= ids.length + 2, true);
});

test(`ajouter, retirer, deplacer une entree et masquer une fonction`, () => {
  const order = [`select`, `draw`, `sep:1`, `text`];
  assert.deepEqual(addSeparator(order), [`select`, `draw`, `sep:1`, `text`, `sep:2`]);
  assert.deepEqual(addSeparator(order, 1), [`select`, `sep:2`, `draw`, `sep:1`, `text`]);
  assert.deepEqual(addSeparator([`select`]), [`select`, `sep:1`]);
  assert.deepEqual(removeEntry(order, `sep:1`), [`select`, `draw`, `text`]);
  assert.deepEqual(moveEntry(order, `text`, 0), [`text`, `select`, `draw`, `sep:1`]);
  assert.deepEqual(moveEntry(order, `select`, 99), [`draw`, `sep:1`, `text`, `select`]);
  assert.deepEqual(setHidden([], `draw`, true), [`draw`]);
  assert.deepEqual(setHidden([`draw`], `draw`, false), []);
  assert.deepEqual(setHidden([`draw`], `draw`, true), [`draw`]);
});

test(`la colonne n'a de separation qu'entre deux boutons : ni en tete, ni en queue, ni deux de suite, meme quand un groupe est masque`, () => {
  assert.deepEqual(railItems([`sep:1`, `select`, `sep:2`, `draw`, `sep:3`], []), [`select`, `sep:2`, `draw`]);
  assert.deepEqual(railItems([`select`, `sep:1`, `draw`, `sep:2`, `text`], [`draw`]), [`select`, `sep:1`, `text`], `un groupe masque ne laisse pas deux separations`);
  assert.deepEqual(railItems([`select`, `sep:1`, `sep:2`, `draw`], []), [`select`, `sep:1`, `draw`]);
  assert.deepEqual(railItems(DEFAULT_ORDER, ids.filter((id) => id !== `select`)), railItems(DEFAULT_ORDER, ids.filter((id) => id !== `select`)));
  assert.deepEqual(railItems([`select`, `draw`], [`select`, `draw`]), []);
});

test(`le mot d'un bouton est le dernier mot de son nom`, () => {
  assert.equal(shortWord(`Trait continu`), `continu`);
  assert.equal(shortWord(`Aligné à gauche`), `gauche`);
  assert.equal(shortWord(`Rectangle`), `Rectangle`);
  assert.equal(shortWord(`Coins très arrondis`), `arrondis`);
  assert.equal(shortWord(`Bordure (double)`), `double`);
  assert.equal(shortWord(`Garder l'outil`), `outil`);
  assert.equal(shortWord(``), ``);
});

test(`les reglages du dessinateur : position du menu, mots, boutons, valeurs fausses remplacees`, () => {
  assert.equal(DEFAULT_SETTINGS.contextPosition, `bottom`);
  assert.equal(DEFAULT_SETTINGS.contextLabels, false);
  assert.deepEqual(DEFAULT_SETTINGS.drawButtonsOrder, DEFAULT_ORDER);
  assert.notEqual(DEFAULT_SETTINGS.drawButtonsOrder, DEFAULT_ORDER, `une copie : l'ordre habituel ne change pas`);
  const s = readSettings({ contextPosition: `top`, contextLabels: true, drawButtonsHidden: [`export`], drawButtonsOrder: [`text`, `select`] });
  assert.deepEqual([s.contextPosition, s.contextLabels, s.drawButtonsHidden], [`top`, true, [`export`]]);
  assert.deepEqual(s.drawButtonsOrder.slice(0, 2), [`text`, `select`]);
  const bad = readSettings({ contextPosition: `left`, contextLabels: `oui`, drawButtonsHidden: 5, drawButtonsOrder: { a: 1 } });
  assert.deepEqual([bad.contextPosition, bad.contextLabels, bad.drawButtonsHidden], [`bottom`, false, []]);
  assert.deepEqual(bad.drawButtonsOrder, DEFAULT_ORDER);
});

test(`l'ordre enregistre avant la suppression des boutons Couleurs, Trait et Effets les ignore sans rien perdre d'autre`, () => {
  const order = readOrder([`select`, `hand`, `colours`, `stroke`, `effects`, `sep:1`, `export`], ids);
  assert.ok(!order.includes(`colours`) && !order.includes(`stroke`) && !order.includes(`effects`));
  assert.deepEqual(order.slice(0, 4), [`select`, `hand`, `sep:1`, `export`]);
  assert.deepEqual(readHidden([`effects`, `export`], ids), [`export`]);
});
