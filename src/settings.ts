// Settings of the plugin, and the rules to name and place the drawing notes. Pure module.
import { DEFAULT_ORDER, drawFunctions, readHidden, readOrder } from "./draw-functions";

export interface SketchnoteSettings {
  // Folder of the vault that holds every drawing note.
  drawingsFolder: string;
  // Folder of the vault where the fonts imported by the user are kept (.ttf and .otf files).
  fontsFolder: string;
  // Folder of the vault where the user puts the SVG drawings that are offered with the icons: a sub folder is a theme.
  iconsFolder: string;
  // Folder of the vault where the pictures that are imported, dropped or pasted into a drawing are kept.
  imagesFolder: string;
  // Folder of the vault where the exported pictures (PNG, SVG, PDF) are saved.
  exportsFolder: string;
  // The buttons on the right of a drawing: their order (with the separations), the functions that are hidden, where the menu of the active button is (above or under the drawing) and
  // whether its buttons show a word next to their pictogram.
  drawButtonsOrder: string[];
  drawButtonsHidden: string[];
  contextPosition: `top` | `bottom`;
  contextLabels: boolean;
  // Zen mode: whether the main window also goes full screen, and the place and size of the floating window of the page (kept from one time to the next, null for the usual ones).
  zenFullscreen: boolean;
  zenWindow: ZenWindow | null;
}

export interface ZenWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The size of the floating window of the page the first time, and the smallest and the largest that is accepted when it is read.
export const ZEN_DEFAULT_SIZE = { width: 640, height: 460 };
export const ZEN_MIN_SIZE = { width: 320, height: 240 };
export const ZEN_MAX_SIZE = { width: 6000, height: 4000 };

// Reads the saved place of the floating window: four numbers in a sensible range, or null.
export function readZenWindow(value: unknown): ZenWindow | null {
  if (typeof value !== `object` || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const num = (n: unknown, min: number, max: number): n is number => typeof n === `number` && Number.isFinite(n) && n >= min && n <= max;
  if (!num(v.x, -20000, 20000) || !num(v.y, -20000, 20000) || !num(v.width, ZEN_MIN_SIZE.width, ZEN_MAX_SIZE.width) || !num(v.height, ZEN_MIN_SIZE.height, ZEN_MAX_SIZE.height)) return null;
  return { x: Math.round(v.x), y: Math.round(v.y), width: Math.round(v.width), height: Math.round(v.height) };
}

export const DEFAULT_SETTINGS: SketchnoteSettings = { drawingsFolder: `Sketchnote dessins`, fontsFolder: `Sketchnote polices`, iconsFolder: `Sketchnote icônes`, imagesFolder: `Sketchnote images`, exportsFolder: `Sketchnote exports`, drawButtonsOrder: [...DEFAULT_ORDER], drawButtonsHidden: [], contextPosition: `bottom`, contextLabels: false, zenFullscreen: false, zenWindow: null };

// Returns a folder path of the vault in its clean form (slashes, no slash at the ends), or null when it is not acceptable: empty, with `..`, with a drive
// letter, or with characters that a file name cannot hold. A leading slash (`/dessin`) is accepted and means the root of the vault.
export function normalizeFolder(value: unknown): string | null {
  if (typeof value !== `string`) return null;
  const parts = value.trim().replace(/\\/g, `/`).split(`/`).map((p) => p.trim()).filter((p) => p !== ``);
  if (parts.length === 0 || value.length > 200 || /^[A-Za-z]:/.test(parts[0])) return null;
  for (const part of parts) {
    if (part === `.` || part === `..` || /[<>:"|?*\u0000-\u001f]/.test(part)) return null;
  }
  return parts.join(`/`);
}

// Reads the saved settings, keeping the default of anything that is missing or not acceptable.
export function readSettings(raw: unknown): SketchnoteSettings {
  const r = typeof raw === `object` && raw !== null ? (raw as Record<string, unknown>) : {};
  const known = drawFunctions().map((f) => f.id as string);
  return { drawingsFolder: normalizeFolder(r.drawingsFolder) ?? DEFAULT_SETTINGS.drawingsFolder, fontsFolder: normalizeFolder(r.fontsFolder) ?? DEFAULT_SETTINGS.fontsFolder, iconsFolder: normalizeFolder(r.iconsFolder) ?? DEFAULT_SETTINGS.iconsFolder, imagesFolder: normalizeFolder(r.imagesFolder) ?? DEFAULT_SETTINGS.imagesFolder, exportsFolder: normalizeFolder(r.exportsFolder) ?? DEFAULT_SETTINGS.exportsFolder,
    drawButtonsOrder: readOrder(r.drawButtonsOrder, known),
    drawButtonsHidden: readHidden(r.drawButtonsHidden, known),
    contextPosition: r.contextPosition === `top` ? `top` : `bottom`,
    contextLabels: r.contextLabels === true,
    zenFullscreen: r.zenFullscreen === true,
    zenWindow: readZenWindow(r.zenWindow),
  };
}

// Removes from a name the characters that a file name cannot hold, and shortens it.
export function cleanName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ``).replace(/\s+/g, ` `).trim();
  return (clean === `` ? `Sketchnote` : clean).slice(0, 60).trim();
}

// Returns a free path for a new drawing note: the folder, the name of the sketchnote and a number. `existing` holds the paths already used.
export function uniqueDrawingPath(folder: string, sketchnoteName: string, existing: Set<string>): string {
  const taken = new Set([...existing].map((p) => p.toLowerCase()));
  const base = cleanName(sketchnoteName);
  for (let n = 1; n < 100000; n++) {
    const path = `${folder}/${base} - dessin ${n}.sketchdraw`;
    if (!taken.has(path.toLowerCase())) return path;
  }
  return `${folder}/${base} - dessin ${Date.now()}.sketchdraw`;
}
