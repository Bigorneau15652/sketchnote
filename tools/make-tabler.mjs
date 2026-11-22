// Builds src/tabler-data.ts: a selection of the outline icons of Tabler Icons (MIT licence, Copyright (c) 2020-2025 Pawel Kuna), made for sketchnotes. It is run by hand when the
// selection changes: node tools/make-tabler.mjs <folder of the package @tabler/icons>. Every icon becomes one line: name|theme|shapes, where shapes are path data separated by
// semicolons (a shape that starts with a star is filled). Nothing here is loaded when the plugin runs: the result is a plain text file in the sources.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node tools/make-tabler.mjs <folder of @tabler/icons>");
const meta = JSON.parse(readFileSync(join(dir, "icons.json"), "utf8"));
const version = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;

// category of Tabler -> theme of the plugin, and how many icons of the category are kept at most (the simplest names first)
const CATEGORIES = {
  Buildings: ["building", 70], Vehicles: ["transport", 60], Health: ["health", 50], Weather: ["weather", 50], Nature: ["nature", 20], Animals: ["nature", 20],
  Food: ["food", 60], Mood: ["people", 50], Gestures: ["people", 20], Electrical: ["energy", 20], Charts: ["data", 30], Database: ["data", 25], Math: ["data", 15],
  Communication: ["communication", 80], Document: ["office", 110], Text: ["office", 20], Shapes: ["shapes", 100], Symbols: ["shapes", 30], Badges: ["shapes", 15],
  Sport: ["sport", 55], Games: ["sport", 25], "E-commerce": ["commerce", 70], Currencies: ["commerce", 20], Media: ["devices", 70], Devices: ["devices", 110],
  Computers: ["devices", 20], Photography: ["devices", 15], Map: ["places", 130], Arrows: ["arrows", 130], System: ["interface", 90], Design: ["tools", 50], Laundry: ["building", 8],
  Development: ["tools", 8], "": ["other", 220],
};
const SKIP = /-off$|^brand-|-filled$|-\d+$|-(plus|minus|check|x|cancel|exclamation|question|share|pause|star|code|cog|dollar|down|up|bolt|heart|search|pin|spark)$/;

const number = (v) => Number(v);
const r = (n) => Math.round(n * 100) / 100;
function circle(cx, cy, rad) { return `M${r(cx - rad)},${r(cy)}a${r(rad)},${r(rad)} 0 1,0 ${r(rad * 2)},0a${r(rad)},${r(rad)} 0 1,0 ${r(-rad * 2)},0z`; }
function attrs(tag) { const o = {}; for (const m of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) o[m[1]] = m[2]; return o; }

function shapesOf(svg) {
  const out = [];
  for (const m of svg.matchAll(/<(path|circle|rect)\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.stroke === "none" && a.fill === "none") continue;
    const filled = a.fill === "currentColor";
    let d = null;
    if (m[1] === "path") d = (a.d ?? "").replace(/\s+/g, " ").trim();
    else if (m[1] === "circle") d = circle(number(a.cx), number(a.cy), number(a.r));
    else if (m[1] === "rect") {
      const [x, y, w, h] = [number(a.x ?? 0), number(a.y ?? 0), number(a.width), number(a.height)];
      d = `M${x},${y}h${w}v${h}h${-w}z`;
    }
    if (!d || /[";`$\\|]/.test(d)) continue;
    out.push((filled ? "*" : "") + d);
  }
  return out;
}

const byCategory = new Map();
for (const [name, info] of Object.entries(meta)) {
  if (!info.styles?.outline || SKIP.test(name)) continue;
  const category = info.category ?? "";
  if (!(category in CATEGORIES)) continue;
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category).push(name);
}
const lines = [];
const seen = new Set();
for (const [category, names] of byCategory) {
  const [theme, cap] = CATEGORIES[category];
  names.sort((a, b) => a.split("-").length - b.split("-").length || a.length - b.length || a.localeCompare(b));
  for (const name of names.slice(0, cap)) {
    const shapes = shapesOf(readFileSync(join(dir, "icons", "outline", `${name}.svg`), "utf8"));
    if (shapes.length === 0) continue;
    const signature = shapes.join(";");
    if (seen.has(signature)) continue;
    seen.add(signature);
    lines.push(`${name}|${theme}|${signature}`);
  }
}
lines.sort();
const header = `// A selection of ${lines.length} outline icons of Tabler Icons ${version} (https://tabler.io/icons), MIT licence, Copyright (c) 2020-2025 Pawel Kuna (licences/MIT-tabler-icons.txt).
// Built by tools/make-tabler.mjs: one line per icon, name|theme|shapes (path data separated by semicolons, a star in front of a filled shape). Do not edit by hand.
// The text is read once, when the window of the icons opens.
`;
writeFileSync("src/tabler-data.ts", `${header}export const TABLER_VERSION = \`${version}\`;\n\nexport const TABLER_TEXT = \`\n${lines.join("\n")}\n\`;\n`);
console.log(lines.length, "icons");
