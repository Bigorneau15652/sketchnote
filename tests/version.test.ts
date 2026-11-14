import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads a JSON file of the project root (tests run from the root).
function json(name: string): Record<string, any> {
  return JSON.parse(readFileSync(join(process.cwd(), name), `utf8`));
}

test(`manifest, package, package-lock et versions portent la meme version`, () => {
  const v = json(`manifest.json`).version;
  assert.match(v, /^\d+\.\d+\.\d+$/);
  assert.equal(json(`package.json`).version, v);
  const lock = json(`package-lock.json`);
  assert.equal(lock.version, v);
  assert.equal(lock.packages[``].version, v);
  assert.ok(json(`versions.json`)[v], `versions.json doit avoir une ligne pour ${v}`);
});

test(`le manifeste respecte les regles du repertoire communautaire`, () => {
  const m = json(`manifest.json`);
  assert.equal(m.id, `sketchnote`);
  assert.ok(!/obsidian/i.test(m.id) && !/obsidian/i.test(m.name));
  assert.ok(m.description.length <= 250);
  assert.ok(/[.?!)]$/.test(m.description));
});

test(`le journal des versions a une section pour la version courante, en anglais puis en francais`, () => {
  const v = json(`manifest.json`).version;
  const text = readFileSync(join(process.cwd(), `CHANGELOG.md`), `utf8`);
  const start = text.indexOf(`## ${v}\n`);
  assert.ok(start >= 0, `section ## ${v} absente`);
  const rest = text.slice(start + v.length + 4);
  const next = rest.search(/^## /m);
  const section = next < 0 ? rest : rest.slice(0, next);
  const en = section.indexOf(`English`);
  const fr = section.indexOf(`Français`);
  assert.ok(en >= 0 && fr > en, `la section doit contenir English puis Français`);
});
