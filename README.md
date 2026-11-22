# Sketchnote

Sketchnote is an Obsidian plugin to draw sketchnotes: one page that mixes hand-drawn pictures and handwritten text, organised by one of seven structures. Everything stays in your vault, in a single file with the extension `.sketchnote`.

## What it does

A sketchnote is a page of a size you choose (A5, A4, A3, wide, square or your own), laid out by one of seven structures: linear, radial, vertical, path, modular, skyscraper or popcorn. Each structure gives zones, and each zone is drawn on directly, with a double click. The page then shows the whole sketchnote and the drawing mode zooms on one zone.

The drawing tools are a hand-drawn look for shapes (rectangle, diamond, ellipse, triangle), comic bubbles and festoons with several forms, lines and arrows with heads, a freehand pen with seventeen brushes (pencil, felt, ink, nib, watercolour, gouache, pastel, charcoal and more) shown in a floating menu, small shapes to stamp, an eraser that never destroys anything (the passes can be taken away again), and text in handwritten fonts with distortions such as an arc or a wave.

Pictograms come from two icon sets (Lucide, which Obsidian provides, and about 1,500 outline icons of Tabler) and from your own SVG files. Pictures of your vault can be placed on the page. Two floating windows build a little man (eight poses, fifteen expressions, thirty objects to hold, clothes) and a character in the style of an identikit portrait (face shapes, hair, hats, beards, glasses, skin and hair colours). A library keeps the drawings you want to reuse.

Every element can be moved, resized, turned, mirrored, grouped, locked, given a shadow, a reflection or an opacity. A page is exported as PNG, JPG, SVG or PDF, with a transparent, white or coloured background and in colour, shades of grey or black and white, or sent to a printer on A4 or A3.

## Install

Sketchnote is not yet in the list of community plugins. To install it with BRAT:

1. In Obsidian, open Settings, Community plugins, then install and enable BRAT.
2. Open the settings of BRAT, click Add beta plugin, paste `Bigorneau15652/sketchnote`, then click Add plugin.
3. Enable Sketchnote in Community plugins.

## Use

Run the command Create a sketchnote from the command palette, or click the pencil in the ribbon: an empty sketchnote opens. The Page settings button chooses the structure and the size of the page. Then double click a zone to draw in it. Escape leaves the drawing mode. The column of buttons on the right of the drawing chooses the tool; each tool has a key (for example G for the eraser and P for the pen in the French version, E and P in the English one), which you can change in the settings of the plugin. The functions that are not tools (icons, images, library, display, export, little man, character) are commands of the palette, so you can give each one a hotkey in the settings of Obsidian.

## Languages and settings

The plugin is in English and in French, and follows the language of Obsidian (French when Obsidian is in French, English otherwise). The settings hold the folders used for fonts, icons, pictures, the library and the exports, the zen mode, and the order and the visibility of the buttons.

## Privacy

The plugin makes no network request and sends nothing anywhere. Fonts, icons and the other data it needs are inside the plugin or in your vault.

## Development

Run `npm install`, then `npm test` for the tests and `npm run build` to make `main.js`. The changes of each version are in CHANGELOG.md, and the licences of the works the plugin bundles are in NOTICE and in the folder licences.

## Licence

MIT. French version: README.fr.md.
