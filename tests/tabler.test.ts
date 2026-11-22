import test from "node:test";
import assert from "node:assert/strict";
import { readTabler, tablerData, tablerEntries, tablerKey } from "../src/tabler";
import { TABLER_TEXT } from "../src/tabler-data";
import { ICON_THEMES, IconEntry, listIcons, matchesSearch, mergeSamePictures, OTHER_THEME } from "../src/icon-themes";
import { isSafePath } from "../src/svg-path";

test(`la selection de Tabler est bien formee`, () => {
  const rows = readTabler(TABLER_TEXT);
  assert.ok(rows.length >= 1000, `assez d icones : ${rows.length}`);
  assert.equal(new Set(rows.map((r) => r.name)).size, rows.length, `noms uniques`);
  const themes = new Set([...ICON_THEMES.map((t) => t.id), OTHER_THEME.id]);
  for (const r of rows) {
    assert.ok(themes.has(r.theme), `theme connu : ${r.name} ${r.theme}`);
    assert.ok(r.shapes.length > 0 && r.shapes.length <= 40, `formes : ${r.name}`);
    for (const s of r.shapes) assert.ok(isSafePath(s.startsWith(`*`) ? s.slice(1) : s), `trace sur : ${r.name}`);
  }
});

test(`deux icones de Tabler n ont jamais le meme dessin`, () => {
  const seen = new Set<string>();
  for (const r of readTabler(TABLER_TEXT)) {
    const key = r.shapes.join(`;`);
    assert.ok(!seen.has(key), `dessin en double : ${r.name}`);
    seen.add(key);
  }
});

test(`les entrees de Tabler ont un identifiant propre, un theme et un dessin`, () => {
  const entries = tablerEntries();
  assert.ok(entries.length >= 1000);
  const house = entries.find((e) => e.label === `home`) ?? entries.find((e) => e.label.includes(`home`));
  assert.ok(house, `une maison`);
  assert.equal(house.source, `tabler`);
  assert.ok(house.name.startsWith(`tabler:`));
  const data = tablerData(house.name);
  assert.ok(data && data.shapes.length > 0);
  assert.deepEqual(data.vb, [0, 0, 24, 24]);
  assert.equal(tablerData(`tabler:inconnu-total`), null);
  assert.equal(tablerKey(`x`), `tabler:x`);
});

test(`une ligne mal formee est ignoree`, () => {
  const rows = readTabler(`ok|data|M0 0h5\nmauvais\nA B|data|M0 0\nvide|data|\nx|data|*M1 1l2 2;M3 3`);
  assert.deepEqual(rows.map((r) => r.name), [`ok`, `x`]);
  assert.deepEqual(rows[1].shapes, [`*M1 1l2 2`, `M3 3`]);
});

const lucide = (name: string): IconEntry => ({ name, source: `lucide`, label: name, themes: [`building`] });

test(`deux noms du meme dessin ne font qu une icone, trouvee par les deux noms`, () => {
  const sigs: Record<string, string> = { home: `A`, house: `A`, zap: `B`, plug: `C` };
  const merged = mergeSamePictures([lucide(`home`), lucide(`house`), lucide(`zap`), lucide(`plug`)], (e) => sigs[e.name]);
  assert.equal(merged.length, 3);
  const house = merged.find((e) => e.label === `house`);
  assert.ok(house && house.aliases && house.aliases.includes(`home`));
  assert.equal(merged.find((e) => e.label === `home`), undefined);
  assert.equal(matchesSearch(`house`, [`building`], `home`, house.aliases), true);
  assert.equal(listIcons(merged, null, `home`, 50).total, 1);
  assert.equal(listIcons(merged, null, `maison`, 50).total, 1);
});

test(`une icone sans signature est gardee telle quelle et deux sources ne se melangent pas`, () => {
  const mixed: IconEntry[] = [lucide(`a`), { ...lucide(`b`), source: `tabler` }, lucide(`c`)];
  const merged = mergeSamePictures(mixed, (e) => (e.name === `c` ? null : `same`));
  assert.equal(merged.length, 3);
});
