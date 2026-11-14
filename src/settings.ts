// Settings of the plugin, and the rules to name and place the drawing notes. Pure module.
export interface SketchnoteSettings {
  // Folder of the vault that holds every drawing note.
  drawingsFolder: string;
}

export const DEFAULT_SETTINGS: SketchnoteSettings = { drawingsFolder: `Sketchnote dessins` };

// Returns a folder path of the vault in its clean form (slashes, no slash at the ends), or null when it is not acceptable: empty, absolute,
// with `..`, or with characters that a file name cannot hold.
export function normalizeFolder(value: unknown): string | null {
  if (typeof value !== `string`) return null;
  const parts = value.trim().replace(/\\/g, `/`).split(`/`).map((p) => p.trim()).filter((p) => p !== ``);
  if (parts.length === 0 || value.trim().startsWith(`/`) || value.length > 200) return null;
  for (const part of parts) {
    if (part === `.` || part === `..` || /[<>:"|?*\u0000-\u001f]/.test(part)) return null;
  }
  return parts.join(`/`);
}

// Reads the saved settings, keeping the default of anything that is missing or not acceptable.
export function readSettings(raw: unknown): SketchnoteSettings {
  const r = typeof raw === `object` && raw !== null ? (raw as Record<string, unknown>) : {};
  return { drawingsFolder: normalizeFolder(r.drawingsFolder) ?? DEFAULT_SETTINGS.drawingsFolder };
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
