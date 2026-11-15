// Adding fonts to the fonts folder of the vault from files chosen anywhere on the computer: .ttf and .otf files, or the .zip archives that the font sites give. The files are
// only copied: the plugin never downloads anything. Same method as the font import of the plugin Bigorneau of the same author.
import { App, normalizePath, TFile } from "obsidian";
import { t } from "./i18n";
import { fontFilesOfZip, Inflate, ZIP_MAX_ENTRY } from "./zip";

export interface ImportReport {
  // Names of the font files copied to the vault.
  added: string[];
  // Among them, the ones that replaced a different file of the same name.
  replaced: string[];
  // Files already in the vault with the same content: nothing is written.
  unchanged: string[];
  // Files left out (format not supported, archive without font, name repeated in the import).
  skipped: string[];
  // Files refused (too big, damaged archive) or whose copy failed.
  failed: string[];
}

// Decompresses data with the browser (deflate without header, as in a zip file). Reads piece by piece and stops beyond `limit`: the size an archive announces may be false.
export const inflate: Inflate = async (data, limit) => {
  const g = window as unknown as { DecompressionStream?: new (format: string) => { readable: ReadableStream; writable: WritableStream } };
  if (!g.DecompressionStream) throw new Error(`no decompression`);
  const stream = new Blob([data.slice().buffer]).stream().pipeThrough(new g.DecompressionStream(`deflate-raw`));
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`too big`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};

// Returns a file name without the characters that a path cannot hold.
export const safeName = (name: string): string => name.replace(/[\\/:*?"<>|]/g, `_`);

// Creates a folder and the folders above it when they do not exist.
export async function ensureFolder(app: App, folder: string): Promise<void> {
  let path = ``;
  for (const part of normalizePath(folder).split(`/`)) {
    path = path === `` ? part : `${path}/${part}`;
    if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
  }
}

export const sameBytes = (a: ArrayBuffer, b: Uint8Array): boolean => {
  if (a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  for (let i = 0; i < x.length; i++) if (x[i] !== b[i]) return false;
  return true;
};

// Copies the chosen files into the fonts folder and tells what was done with each one.
export async function importFonts(app: App, folder: string, files: File[]): Promise<ImportReport> {
  const report: ImportReport = { added: [], replaced: [], unchanged: [], skipped: [], failed: [] };
  await ensureFolder(app, folder);
  // The names written during this import: a second file with the same name must not overwrite the first one.
  const seen = new Set<string>();
  const write = async (name: string, data: Uint8Array): Promise<void> => {
    const clean = safeName(name);
    if (clean.startsWith(`.`)) {
      report.skipped.push(name);
      return;
    }
    if (seen.has(clean.toLowerCase())) {
      report.skipped.push(`${name} (${t(`nom en double`)})`);
      return;
    }
    seen.add(clean.toLowerCase());
    const path = normalizePath(`${folder}/${clean}`);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      if (sameBytes(await app.vault.readBinary(existing), data)) {
        report.unchanged.push(clean);
        return;
      }
      await app.vault.modifyBinary(existing, data.slice().buffer);
      report.replaced.push(clean);
    } else await app.vault.createBinary(path, data.slice().buffer);
    report.added.push(clean);
  };
  for (const file of files) {
    const lower = file.name.toLowerCase();
    try {
      const isZip = lower.endsWith(`.zip`);
      if (file.size > (isZip ? ZIP_MAX_ENTRY * 3 : ZIP_MAX_ENTRY)) {
        report.failed.push(file.name);
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (isZip) {
        const refused: string[] = [];
        const inside = await fontFilesOfZip(bytes, inflate, refused);
        if (inside.length === 0 && refused.length === 0) report.skipped.push(file.name);
        report.failed.push(...refused.map((name) => `${file.name} : ${name}`));
        for (const entry of inside) await write(entry.name, entry.data);
      } else if (lower.endsWith(`.ttf`) || lower.endsWith(`.otf`)) await write(file.name, bytes);
      else report.skipped.push(file.name);
    } catch {
      report.failed.push(file.name);
    }
  }
  return report;
}
