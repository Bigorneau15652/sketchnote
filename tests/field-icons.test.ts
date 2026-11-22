import test from "node:test";
import assert from "node:assert/strict";
import { FIELD_KINDS } from "../src/field-values";

test(`chaque champ du menu a un pictogramme qui lui est propre`, () => {
  const seen = new Map<string, string>();
  for (const [label, kind] of Object.entries(FIELD_KINDS)) {
    const other = seen.get(kind.icon);
    assert.equal(other, undefined, `${label} et ${other ?? ``} ont le meme pictogramme ${kind.icon}`);
    seen.set(kind.icon, label);
  }
});

test(`les reglages des pinceaux ont chacun un pictogramme`, () => {
  for (const label of [`Flux`, `Dureté`, `Espacement`, `Forme`, `Rotation`, `Grain`, `Dynamique`]) assert.ok(FIELD_KINDS[label], label);
});
