# Working notes for Claude Code sessions

Sketchnote is an Obsidian plugin (TypeScript, one bundled `main.js`, desktop and mobile). It draws sketchnotes: one page that mixes hand-drawn pictures and handwritten text, organised by one of seven structures (linear, radial, vertical, path, modular, skyscraper, popcorn). The maintainer is not a programmer.

## Dialogue

- Talk to the maintainer in French, in plain words, without flattery. Explain every step that the maintainer has to do on GitHub or in Obsidian (merging a pull request, publishing a release, updating the plugin), with the exact names of the buttons.
- Before programming, ask the questions that remove ambiguity, in small groups, with a recommendation. Work by small versions that the maintainer can test one by one.
- Texts meant to be pasted into Word contain no emoji, no horizontal rules and no needless bullets. In French, never put a comma before "et" and avoid long dashes in the middle of a sentence. French quotation marks are written with non-breaking spaces.

## Code rules

- All strings are written as template literals (backticks), never with single or double quotes, so that French apostrophes cause no syntax error. A test checks it.
- Code identifiers are in English. Comments are written in English: one short block above every function, method, class and file, in the present tense. Messages shown to the user go through `t()` in `src/i18n.ts` with their English text in `src/i18n-en.ts` (French text is the key; a French text must not be translated twice).
- Never turn text into code or markup (`eval`, `new Function`, `innerHTML`, `DOMParser`): a test forbids it. SVG is built with the DOM (`src/svg.ts`). No network access in the plugin (no `fetch`, `XMLHttpRequest`, `requestUrl`, `WebSocket`): a test forbids it.
- Everything read from a file, a note, the clipboard or an import is validated before use (see `src/file-format.ts`): colours as `#hex` only, numbers in a range, unknown fields dropped, SVG cleaned.
- The plugin works on desktop and on mobile: use pointer events (mouse, touch, stylus), no Node or Electron API.
- No new dependency, font or data file without the agreement of the maintainer. Each one is recorded with its licence in `docs/DEPENDANCES.md` and `NOTICE`.

## Decisions of the maintainer

- File: one `.sketchnote` file (JSON) holds the page, the structure and all the elements, including the mini drawing of each graphic element.
- Drawing: own engine rendering SVG, with the data model inspired by Excalidraw. Accepted dependencies: roughjs and perfect-freehand (MIT), to add when the drawing tools are built (version 0.5.0).
- Library of pictures: Lucide (ISC) and Tabler icons (MIT), drawn through the sketchy renderer. The maintainer can also import banks and own pictures.
- Fonts: 3 or 4 handwritten fonts under the SIL Open Font License are bundled in `main.js`; others are imported from a .ttf or .otf file (no download by the plugin).
- Structures are guides: elements snap to the slots and everything can be moved afterwards. The skyscraper structure also creates separators that can be moved or deleted.
- Page palette: 3 to 5 colours chosen at creation, offered first in the tools, next to a free colour picker.
- Interface in French and English. Manifest: id `sketchnote`, name `Sketchnote`, author `Bigorneau`, licence MIT (copyright holder: Olivier Holweck). Desktop and mobile (`isDesktopOnly: false`).

## Plan of the versions

0.1.0 skeleton and BRAT, 0.2.0 page (size, orientation, background, pattern), 0.3.0 the seven structures, 0.4.0 drawing engine core (selection, handles, undo), 0.5.0 shape tools, 0.6.0 text and fonts, 0.7.0 nested graphic element with double click, 0.8.0 library and images, 0.9.0 exports and embedding in notes, 0.10.0 performance and security audit, 1.0.0 publication in the community directory.

## Tests and checks

- `npm test` bundles every `tests/*.test.ts` and runs it with `node --test`; `npm run build` type-checks (unused variables and parameters are errors) and writes `main.js`. No test is disabled or weakened to get a green result.
- A test checks that `manifest.json`, `package.json`, `package-lock.json` (two places) and `versions.json` carry the same version, and that `CHANGELOG.md` has a section for it.

## Versions, commits and releases

- One small version at a time. Commit message: `Version 0.2.0 : short description in French`.
- Every version has a section `## X.Y.Z` in `CHANGELOG.md` with an `English` part then a `Français` part (a test checks it). The release workflow copies it onto the GitHub release page.
- To change the version, edit `manifest.json`, `package.json`, `package-lock.json` (the `version` at the top and the one under `packages[""]`) and add a line to `versions.json` with the minimum Obsidian version.
- A release is a GitHub release whose tag is the version number without `v`, with `main.js`, `manifest.json` and `styles.css` attached (the workflow `release.yml` does it when the tag is pushed). Never a pre-release: the community directory does not count it. The maintainer publishes it from GitHub after merging the pull request.
- Work on the branch given by the session, push, and open a draft pull request.
