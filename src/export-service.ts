// What the exports need from the application: the folder where they are saved, the saving of a file, the fonts and the pictures to write into an exported file.
import { App, normalizePath, TFile } from "obsidian";
import type { FontFaceData } from "./export-plan";
import type { FontStore } from "./font-store";
import { ensureFolder } from "./font-import";
import { IMAGE_MAX_BYTES, sniffImage } from "./image-files";
import { isSafeImagePath } from "./elements";

export interface ExportServices {
  folder(): string;
  // The names of the files that are already in the folder.
  usedNames(): Set<string>;
  // Saves a file in the folder under a name and returns its path in the vault.
  save(name: string, bytes: Uint8Array): Promise<string>;
  fontData(id: string): Promise<FontFaceData | null>;
  // Reads a picture of the vault to write it into an exported file (null when it is missing, too big or not a picture), with its media type.
  readImage(path: string): Promise<{ mime: string; bytes: Uint8Array } | null>;
}

const MIME: Record<string, string> = { png: `image/png`, jpg: `image/jpeg`, gif: `image/gif`, webp: `image/webp`, svg: `image/svg+xml` };

export class ExportServiceImpl implements ExportServices {
  constructor(private app: App, private folderOf: () => string, private fonts: FontStore) {}

  folder(): string {
    return this.folderOf();
  }

  usedNames(): Set<string> {
    const folder = this.folderOf();
    return new Set(this.app.vault.getFiles().filter((f) => f.path.startsWith(`${folder}/`)).map((f) => f.name));
  }

  async save(name: string, bytes: Uint8Array): Promise<string> {
    const folder = this.folderOf();
    await ensureFolder(this.app, folder);
    const path = normalizePath(`${folder}/${name}`);
    await this.app.vault.createBinary(path, bytes.slice().buffer);
    return path;
  }

  fontData(id: string): Promise<FontFaceData | null> {
    return this.fonts.fontData(id);
  }

  async readImage(path: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
    if (!isSafeImagePath(path)) return null;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile) || file.stat.size > IMAGE_MAX_BYTES) return null;
    try {
      const bytes = new Uint8Array(await this.app.vault.readBinary(file));
      const type = sniffImage(bytes);
      return type === null ? null : { mime: MIME[type], bytes };
    } catch {
      return null;
    }
  }
}
