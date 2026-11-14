import esbuild from "esbuild";
import process from "process";
import { builtinModules as builtins } from "node:module";

const production = process.argv[2] === "production";

// Licence notice written at the top of main.js. The plugin is installed as three files only (main.js, manifest.json, styles.css), so
// the notices of the bundled works must travel inside main.js. The full texts are in the licences folder and in NOTICE.
const LICENSE_BANNER = `/*!
Sketchnote, a plugin for Obsidian. Copyright (c) 2026 Olivier Holweck. MIT License (see LICENSE in the repository).
This file bundles the following works, all under the MIT License:
- roughjs 4.6.6, Copyright (c) 2019 Preet Shihn, https://github.com/rough-stuff/rough
  and its dependencies hachure-fill, path-data-parser, points-on-curve and points-on-path (same author).
- perfect-freehand 1.2.3, Copyright (c) 2021 Stephen Ruiz Ltd, https://github.com/steveruizok/perfect-freehand
Full license texts: folder "licences" and file NOTICE of https://github.com/Bigorneau15652/sketchnote
*/`;

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  banner: { js: LICENSE_BANNER },
  sourcemap: production ? false : "inline",
  minify: production,
  treeShaking: true,
  outfile: "main.js",
});

if (production) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
