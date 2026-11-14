import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), `src`);

// Returns the text of every source file, with its name.
function sources(): [string, string][] {
  return readdirSync(SRC)
    .filter((f) => f.endsWith(`.ts`))
    .map((f) => [f, readFileSync(join(SRC, f), `utf8`)]);
}

test(`le plugin n'a aucun acces reseau`, () => {
  const banned = /\b(fetch\s*\(|XMLHttpRequest|requestUrl|WebSocket|sendBeacon|EventSource)/;
  for (const [f, text] of sources()) assert.ok(!banned.test(text), `acces reseau dans ${f}`);
});

test(`le plugin ne transforme jamais du texte en code ni en balisage`, () => {
  const banned = /\b(eval\s*\(|new\s+Function|innerHTML|outerHTML|insertAdjacentHTML|document\.write|DOMParser)/;
  for (const [f, text] of sources()) assert.ok(!banned.test(text), `code dynamique ou balisage dans ${f}`);
});

test(`toutes les chaines des sources sont ecrites entre backticks`, () => {
  // Quotes are allowed only for import paths, inside comments and for object keys that are not valid identifiers (for example "text-anchor":).
  for (const [f, text] of sources()) {
    for (const line of text.split(`\n`)) {
      const code = line.trim();
      if (code.startsWith(`//`) || code.startsWith(`import `)) continue;
      assert.ok(!/(^|[=(,:\[ ])(["'])[^"'\n]*\2/.test(code.replace(/\/\/.*$/, ``).replace(/"[\w-]+":/g, ``)), `guillemet droit dans ${f} : ${code}`);
    }
  }
});
