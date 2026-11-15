// Adding pictures to the images folder of the vault from files chosen anywhere on the computer, dropped on a drawing or pasted from the clipboard. A file is only accepted when its first
// bytes are those of a picture (PNG, JPEG, GIF, WebP or SVG without script): its name is not trusted. A file that has the name of a different picture already in the folder is kept
// under a new name, so that the drawings that show the first one do not change. The plugin never downloads anything. Pure of the page except for the vault.
import { App, normalizePath, TFile } from "obsidian";
import { t } from "./i18n";
import { ensureFolder, safeName, sameBytes } from "./font-import";
import { extensionOf, freeName, IMAGE_MAX_BYTES, pastedName, sniffImage } from "./image-files";

export interface ImageImportReport {
  // Names of the files copied to the vault.
  added: string[];
  // Files already in the vault with the same content: nothing is written.
  unchanged: string[];
  // Files left out (not a picture, name repeated in the import).
  skipped: string[];
  // Files refused (too big) or whose copy failed.
  failed: string[];
  // The paths in the vault of every picture that can be used (the copied ones and the identical ones that were already there), in the order of the files.
  paths: string[];
}

// Copies the files into the images folder and tells what was done with each one.
export async function importImages(app: App, folder: string, files: File[]): Promise<ImageImportReport> {
  const report: ImageImportReport = { added: [], unchanged: [], skipped: [], failed: [], paths: [] };
  await ensureFolder(app, folder);
  const inFolder = (): Set<string> => {
    const out = new Set<string>();
    for (const f of app.vault.getFiles()) if (f.path.startsWith(`${folder}/`) && !f.path.slice(folder.length + 1).includes(`/`)) out.add(f.name);
    return out;
  };
  const used = inFolder();
  const seen = new Set<string>();
  for (const file of files) {
    try {
      if (file.size > IMAGE_MAX_BYTES) {
        report.failed.push(file.name);
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = sniffImage(bytes);
      if (type === null) {
        report.skipped.push(file.name);
        continue;
      }
      let name = safeName(file.name === `` || file.name === `image.png` ? pastedName(new Date(), type) : file.name);
      if (name.startsWith(`.`)) name = pastedName(new Date(), type);
      // The extension follows the real type of the file.
      const ext = extensionOf(name);
      if (ext !== type && !(type === `jpg` && ext === `jpeg`)) name = `${name.replace(/\.[^.]*$/, ``)}.${type}`;
      if (seen.has(name.toLowerCase())) {
        report.skipped.push(`${file.name} (${t(`nom en double`)})`);
        continue;
      }
      seen.add(name.toLowerCase());
      const existing = app.vault.getAbstractFileByPath(normalizePath(`${folder}/${name}`));
      if (existing instanceof TFile) {
        if (sameBytes(await app.vault.readBinary(existing), bytes)) {
          report.unchanged.push(name);
          report.paths.push(existing.path);
          continue;
        }
        name = freeName(name, used);
      }
      const path = normalizePath(`${folder}/${name}`);
      await app.vault.createBinary(path, bytes.slice().buffer);
      used.add(name);
      report.added.push(name);
      report.paths.push(path);
    } catch {
      report.failed.push(file.name);
    }
  }
  return report;
}
