import test from "node:test";
import assert from "node:assert/strict";
import { cleanKey, DEFAULT_TOOL_KEYS, effectiveToolKeys, ENGLISH_TOOL_KEYS, KEY_TOOLS, keyTable, readToolKeys, setToolKey } from "../src/tool-keys";

test(`les touches par defaut sont uniques et valides`, () => {
  const keys = KEY_TOOLS.map((t) => DEFAULT_TOOL_KEYS[t]);
  assert.equal(new Set(keys).size, KEY_TOOLS.length);
  for (const k of keys) assert.equal(cleanKey(k), k);
  assert.equal(DEFAULT_TOOL_KEYS.eraser, `g`);
  assert.equal(DEFAULT_TOOL_KEYS.pen, `p`);
  assert.equal(DEFAULT_TOOL_KEYS.rect, `c`);
  assert.equal(DEFAULT_TOOL_KEYS.ellipse, `r`);
  assert.equal(DEFAULT_TOOL_KEYS.line, `t`);
  assert.equal(DEFAULT_TOOL_KEYS.arrow, `f`);
});

test(`une touche est un seul caractere visible en minuscule`, () => {
  assert.equal(cleanKey(`G`), `g`);
  assert.equal(cleanKey(` k `), `k`);
  assert.equal(cleanKey(``), null);
  assert.equal(cleanKey(`ab`), null);
  assert.equal(cleanKey(` `), null);
  assert.equal(cleanKey(5), null);
  assert.equal(cleanKey(null), null);
});

test(`la lecture des reglages garde les touches valides et corrige le reste`, () => {
  assert.deepEqual(readToolKeys(undefined), DEFAULT_TOOL_KEYS);
  assert.deepEqual(readToolKeys(`x`), DEFAULT_TOOL_KEYS);
  const keys = readToolKeys({ eraser: `E`, pen: `zz`, rect: 4, bogus: `q` });
  assert.equal(keys.eraser, `e`);
  assert.equal(keys.pen, DEFAULT_TOOL_KEYS.pen);
  assert.equal(keys.rect, DEFAULT_TOOL_KEYS.rect);
  assert.equal(new Set(KEY_TOOLS.map((t) => keys[t])).size, KEY_TOOLS.length);
});

test(`une touche prise deux fois est refusee a la lecture et chaque outil a une touche`, () => {
  const keys = readToolKeys({ select: `g`, eraser: `g`, hand: `p` });
  assert.equal(keys.select, `g`);
  assert.notEqual(keys.eraser, `g`);
  assert.equal(new Set(KEY_TOOLS.map((t) => keys[t])).size, KEY_TOOLS.length);
  for (const tool of KEY_TOOLS) assert.equal(cleanKey(keys[tool]), keys[tool]);
});

test(`changer une touche refuse une touche deja prise`, () => {
  const ok = setToolKey(DEFAULT_TOOL_KEYS, `eraser`, `E`);
  assert.ok(`keys` in ok && ok.keys.eraser === `e`);
  const taken = setToolKey(DEFAULT_TOOL_KEYS, `eraser`, `p`);
  assert.deepEqual(taken, { taken: `pen` });
  assert.deepEqual(setToolKey(DEFAULT_TOOL_KEYS, `eraser`, `ab`), { invalid: true });
  const same = setToolKey(DEFAULT_TOOL_KEYS, `eraser`, `g`);
  assert.ok(`keys` in same);
});

test(`la table du clavier donne l outil de chaque touche`, () => {
  const table = keyTable(DEFAULT_TOOL_KEYS);
  assert.equal(table[`g`], `eraser`);
  assert.equal(table[`.`], `point`);
  assert.equal(Object.keys(table).length, KEY_TOOLS.length);
});

test(`les touches anglaises sont uniques et valides`, () => {
  const keys = KEY_TOOLS.map((t) => ENGLISH_TOOL_KEYS[t]);
  assert.equal(new Set(keys).size, KEY_TOOLS.length);
  for (const k of keys) assert.equal(cleanKey(k), k);
  assert.equal(ENGLISH_TOOL_KEYS.eraser, `e`);
  assert.equal(ENGLISH_TOOL_KEYS.pen, `p`);
  assert.equal(ENGLISH_TOOL_KEYS.rect, `r`);
});

test(`la version anglaise prend ses touches sauf celles que l utilisateur a changees`, () => {
  assert.deepEqual(effectiveToolKeys(DEFAULT_TOOL_KEYS, `fr`), DEFAULT_TOOL_KEYS);
  assert.deepEqual(effectiveToolKeys(DEFAULT_TOOL_KEYS, `en`), ENGLISH_TOOL_KEYS);
  const mine = effectiveToolKeys({ ...DEFAULT_TOOL_KEYS, pen: `k` }, `en`);
  assert.equal(mine.pen, `k`);
  assert.equal(mine.eraser, `e`);
  assert.equal(new Set(KEY_TOOLS.map((t) => mine[t])).size, KEY_TOOLS.length);
  // a changed key that is an English default of another tool takes it: the other tool gets a free key
  const clash = effectiveToolKeys({ ...DEFAULT_TOOL_KEYS, pen: `e` }, `en`);
  assert.equal(clash.pen, `e`);
  assert.notEqual(clash.eraser, `e`);
  assert.equal(new Set(KEY_TOOLS.map((t) => clash[t])).size, KEY_TOOLS.length);
});
