import { test } from "node:test";
import assert from "node:assert/strict";
import { expandWord, ICON_THEMES, IconEntry, listIcons, lucideEntries, lucideId, matchesSearch, OTHER_THEME, plain, themeName, themesOf } from "../src/icon-themes";

const IDS = [`lucide-house`, `lucide-building-2`, `lucide-zap`, `lucide-battery-charging`, `lucide-flame`, `lucide-arrow-up-right`, `lucide-user-round-plus`, `lucide-cloud-rain`, `lucide-thermometer`, `lucide-wrench`, `lucide-car`, `lucide-banana`, `lucide-chart-pie`, `lucide-mail`, `lucide-ghost`, `sketchnote-border-simple`, `search`, `obsidian-something`];
const entries = lucideEntries(IDS);

test(`les accents et les majuscules ne comptent pas, cœur et coeur sont le meme mot`, () => {
  assert.equal(plain(`Énergie`), `energie`);
  assert.equal(plain(`CŒUR`), `coeur`);
  assert.equal(plain(`  Bâtiment `), `batiment`);
  assert.deepEqual(expandWord(`Cœur`), [`coeur`, `heart`]);
  assert.deepEqual(expandWord(`zap`), [`zap`], `un mot anglais reste tel quel`);
  assert.ok(expandWord(`maison`).includes(`house`));
  assert.deepEqual(expandWord(`constructor`), [`constructor`], `pas de mot herite de l'objet`);
  assert.deepEqual(expandWord(`__proto__`), [`__proto__`]);
});

test(`les icones de Lucide viennent des identifiants d'Obsidian, sans celles du plugin ni d'Obsidian`, () => {
  assert.equal(entries.length, 15);
  assert.ok(entries.every((e) => e.source === `lucide` && e.name === e.label));
  assert.ok(!entries.some((e) => e.name.startsWith(`sketchnote`) || e.name === `search`));
  assert.ok(entries.some((e) => e.name === `building-2`));
  // A version of Obsidian that does not prefix the names.
  const bare = lucideEntries([`house`, `zap`, `sketchnote-fill-solid`, `plugin:thing`, `BAD NAME`]);
  assert.deepEqual(bare.map((e) => e.name), [`house`, `zap`]);
  assert.equal(lucideId(`house`, IDS), `lucide-house`);
  assert.equal(lucideId(`house`, [`house`]), `house`);
});

test(`chaque icone est dans un ou plusieurs themes, ou dans Autres`, () => {
  assert.ok(themesOf(`house`).includes(`building`));
  assert.ok(themesOf(`building-2`).includes(`building`));
  assert.ok(themesOf(`battery-charging`).includes(`energy`));
  assert.ok(themesOf(`zap`).includes(`energy`));
  assert.ok(themesOf(`arrow-up-right`).includes(`arrows`));
  assert.ok(themesOf(`user-round-plus`).includes(`people`));
  assert.ok(themesOf(`cloud-rain`).includes(`weather`));
  // An icon can be in several themes.
  assert.ok(themesOf(`thermometer`).length >= 2 && themesOf(`thermometer`).includes(`energy`) && themesOf(`thermometer`).includes(`health`));
  assert.ok(themesOf(`sun`).includes(`energy`) && themesOf(`sun`).includes(`weather`));
  assert.deepEqual(themesOf(`ghost`), [OTHER_THEME.id]);
  // A word counts as a whole: the word bed is not in bedroom, and shower is not in showers-of-things.
  assert.ok(!themesOf(`embed`).includes(`building`));
  assert.ok(themesOf(`cooking-pot`).includes(`food`), `un mot compose`);
  assert.equal(themeName(`energy`), `Énergie et environnement`);
  assert.equal(themeName(OTHER_THEME.id), `Autres`);
  assert.equal(themeName(`mon-dossier`), `mon-dossier`);
  // The themes have names, words, and no two with the same identifier.
  assert.equal(new Set(ICON_THEMES.map((t) => t.id)).size, ICON_THEMES.length);
  assert.ok(ICON_THEMES.every((t) => t.name !== `` && t.words.length > 5));
  assert.ok(ICON_THEMES.length >= 15);
});

test(`la recherche comprend les mots francais courants et les noms anglais de Lucide`, () => {
  const found = (q: string): string[] => listIcons(entries, null, q, 50).shown.map((e) => e.name);
  assert.deepEqual(found(`maison`), [`house`]);
  assert.deepEqual(found(`Maison`), [`house`]);
  assert.ok(found(`batiment`).includes(`building-2`));
  assert.ok(found(`bâtiment`).includes(`building-2`), `avec l'accent`);
  assert.ok(found(`flamme`).includes(`flame`));
  assert.ok(found(`éclair`).includes(`zap`));
  assert.ok(found(`pile`).includes(`battery-charging`));
  assert.ok(found(`voiture`).includes(`car`));
  assert.ok(found(`pluie`).includes(`cloud-rain`));
  assert.ok(found(`camembert`).includes(`chart-pie`));
  assert.ok(found(`chaleur`).includes(`flame`) && found(`chaleur`).includes(`thermometer`));
  // The English names work too, whole or begun.
  assert.deepEqual(found(`ghost`), [`ghost`]);
  assert.ok(found(`batt`).includes(`battery-charging`));
  // Every word of the search must be found.
  assert.deepEqual(found(`fleche haut`), [`arrow-up-right`]);
  assert.deepEqual(found(`maison voiture`), []);
  assert.equal(found(``).length, 15);
  assert.equal(found(`   `).length, 15);
  assert.deepEqual(found(`zzzz`), []);
});

test(`le nom d'un theme cherche toutes ses icones`, () => {
  const found = (q: string): string[] => listIcons(entries, null, q, 50).shown.map((e) => e.name);
  assert.ok(found(`energie`).includes(`zap`) && found(`energie`).includes(`flame`) && found(`energie`).includes(`battery-charging`));
  assert.ok(found(`meteo`).includes(`cloud-rain`));
  assert.ok(found(`fleches`).includes(`arrow-up-right`));
  // A word of a theme name that is too short is not used (de, et).
  assert.ok(!matchesSearch(`ghost`, [`building`], `et`));
});

test(`la liste montre un theme, trie, limite, et dit combien il y en a`, () => {
  const all = listIcons(entries, null, ``, 5);
  assert.equal(all.shown.length, 5);
  assert.equal(all.total, 15);
  assert.deepEqual(all.shown.map((e) => e.name), [...all.shown.map((e) => e.name)].sort((a, b) => a.localeCompare(b)));
  const energy = listIcons(entries, `energy`, ``, 50);
  assert.ok(energy.shown.every((e) => e.themes.includes(`energy`)));
  assert.ok(energy.total >= 4);
  // A theme and a search together.
  const both = listIcons(entries, `energy`, `pile`, 50);
  assert.deepEqual(both.shown.map((e) => e.name), [`battery-charging`]);
  assert.deepEqual(listIcons(entries, `nothing`, ``, 50), { shown: [], total: 0 });
  assert.deepEqual(listIcons(entries, null, ``, 0).shown, []);
  // The icons of the user come with their own theme (their folder) and are found by their file name.
  const mine: IconEntry[] = [{ name: `Icones/Chantier/grue.svg`, source: `custom`, label: `grue`, themes: [`Chantier`] }];
  assert.deepEqual(listIcons([...entries, ...mine], `Chantier`, ``, 10).shown.map((e) => e.label), [`grue`]);
  assert.deepEqual(listIcons([...entries, ...mine], null, `grue`, 10).shown.map((e) => e.label), [`grue`]);
});
