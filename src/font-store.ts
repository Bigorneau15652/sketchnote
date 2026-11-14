// The fonts of the texts, on the Obsidian side: the four built-in fonts and the fonts that the user put in the fonts folder of the vault. Each one is registered in the
// browser under its CSS family (sk- and its identifier), so that the texts of the pages and of the drawings show it. The folder is read again only when it changes.
import { App, normalizePath, TFile } from "obsidian";
import { BUILTIN_FONTS } from "./fonts-builtin";
import { fontKind, isPlainStyle, readFontNames } from "./font-file";
import { cssFamily, FontEntry, userFontId } from "./fonts";

const FONT_EXTENSIONS = [`ttf`, `otf`];
const MAX_FONT_BYTES = 50 * 1024 * 1024;

// Gives control back to Obsidian between two files: reading many fonts in one go would freeze the interface.
const pause = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

// Decodes a text in base 64 (the built-in fonts are kept that way in the code).
function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export class FontStore {
  private user: FontEntry[] = [];
  // Files of the fonts folder that cannot be used (collection, WOFF, damaged file), with the reason.
  problems: string[] = [];
  private faces: FontFace[] = [];
  private signature = ``;
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private destroyed = false;
  private measurer: CanvasRenderingContext2D | null = null;

  constructor(private app: App, private folder: () => string) {}

  // Every font that a text can use: the built-in ones, then the imported ones in alphabetical order.
  entries(): FontEntry[] {
    return [...BUILTIN_FONTS.map((f): FontEntry => ({ id: f.id, name: f.name, builtin: true })), ...this.user];
  }

  // Registers a function to call when the list of fonts changes. Returns the function that removes it.
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Tells whether a path is a font file of the fonts folder.
  isFontPath(path: string): boolean {
    const folder = normalizePath(this.folder());
    return folder !== `` && path.startsWith(`${folder}/`) && FONT_EXTENSIONS.includes(path.slice(path.lastIndexOf(`.`) + 1).toLowerCase());
  }

  // Registers the built-in fonts, then reads the fonts folder.
  async start(): Promise<void> {
    for (const f of BUILTIN_FONTS) await this.register(cssFamily(f.id), fromBase64(f.data));
    await this.refresh(true);
  }

  // Reads the fonts folder again when its content changed (or when forced).
  refresh(force = false): Promise<void> {
    if (this.running) return this.running;
    this.running = this.scan(force).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  // Adds a font to the browser under a CSS family. Returns true when the browser accepted it.
  private async register(family: string, bytes: Uint8Array): Promise<boolean> {
    try {
      const face = new FontFace(family, bytes as unknown as BufferSource);
      await face.load();
      if (this.destroyed) return false;
      document.fonts.add(face);
      this.faces.push(face);
      return true;
    } catch {
      return false;
    }
  }

  // Reads the fonts folder: one font for each family (the plain style when there are several files), registered in the browser.
  private async scan(force: boolean): Promise<void> {
    const folder = normalizePath(this.folder());
    const files = this.app.vault.getFiles().filter((f) => folder !== `` && f.path.startsWith(`${folder}/`) && FONT_EXTENSIONS.includes(f.extension.toLowerCase()));
    const signature = files.map((f) => `${f.path}|${f.stat.mtime}|${f.stat.size}`).sort().join(`\n`);
    if (!force && signature === this.signature) return;
    this.signature = signature;
    // The faces of the imported fonts are removed (they are made again below); the built-in ones stay.
    const imported = this.faces.filter((f) => f.family.startsWith(`sk-u-`));
    for (const face of imported) document.fonts.delete(face);
    this.faces = this.faces.filter((f) => !imported.includes(f));
    const best = new Map<string, { entry: FontEntry; file: TFile; plain: boolean; bytes: Uint8Array }>();
    const problems: string[] = [];
    for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
      try {
        if (file.stat.size > MAX_FONT_BYTES) throw new Error(`size`);
        const bytes = new Uint8Array(await this.app.vault.readBinary(file));
        const kind = fontKind(bytes);
        const names = kind === `font` ? readFontNames(bytes) : null;
        if (!names) {
          problems.push(`${file.path} : ${kind === `collection` ? `collection` : kind === `woff` ? `woff` : `unreadable`}`);
        } else {
          const id = userFontId(names.family);
          const plain = isPlainStyle(names.style);
          const old = best.get(id);
          if (!old || (plain && !old.plain)) best.set(id, { entry: { id, name: names.family, builtin: false }, file, plain, bytes });
        }
      } catch {
        problems.push(`${file.path} : unreadable`);
      }
      await pause();
    }
    if (this.destroyed) return;
    const list: FontEntry[] = [];
    for (const [id, found] of best) {
      if (BUILTIN_FONTS.some((b) => b.id === id)) continue;
      if (await this.register(cssFamily(id), found.bytes)) list.push(found.entry);
      else problems.push(`${found.file.path} : unreadable`);
      await pause();
    }
    this.user = list.sort((a, b) => a.name.localeCompare(b.name));
    this.problems = problems;
    for (const l of this.listeners) l();
  }

  // Waits until a font is loaded at a size, so that a measure made right after is right.
  async ensureLoaded(font: string, size: number): Promise<void> {
    try {
      await document.fonts.load(`${Math.max(8, Math.round(size))}px ${cssFamily(font)}`);
    } catch {
      // A font that cannot be loaded is measured with the fallback of the browser.
    }
  }

  // Measures the width of a line of text in a font at a size, in pixels (the unit of the drawing).
  measure = (line: string, font: string, size: number): number => {
    if (!this.measurer) this.measurer = document.createElement(`canvas`).getContext(`2d`);
    const ctx = this.measurer;
    if (!ctx) return line.length * size * 0.5;
    ctx.font = `${size}px ${cssFamily(font)}, cursive`;
    return ctx.measureText(line === `` ? ` ` : line).width;
  };

  // Removes the fonts from the browser when the plugin stops.
  destroy(): void {
    this.destroyed = true;
    for (const face of this.faces) document.fonts.delete(face);
    this.faces = [];
    this.listeners.clear();
  }
}
