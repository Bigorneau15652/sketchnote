// The drawing notes of the vault: creating, copying, loading and keeping up to date the .sketchdraw files, and following their renaming.
import { App, TFile, TAbstractFile } from "obsidian";
import { createEmptyDrawing, DrawingGuide, parseSketchdraw, renameReferences, serializeSketchdraw, SketchdrawDoc } from "./drawing-file";
import { firstFreePath } from "./free-path";
import { uniqueDrawingPath } from "./settings";

export class DrawingStore {
  private readonly cache = new Map<string, SketchdrawDoc>();
  private readonly loading = new Set<string>();
  private readonly listeners = new Set<(path: string) => void>();
  private readonly app: App;
  private readonly folder: () => string;

  // Creates the store. `folder` gives the folder of the drawing notes from the settings, at the time of each creation.
  constructor(app: App, folder: () => string) {
    this.app = app;
    this.folder = folder;
  }

  // Registers a function called with the path of a drawing each time it is loaded or changed. Returns a function that removes it.
  onChange(listener: (path: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Tells the listeners that a drawing changed.
  private notify(path: string): void {
    for (const l of this.listeners) l(path);
  }

  // Returns the content of a drawing note if it is loaded. Otherwise returns null and starts loading it: the listeners are called when it is ready.
  lookup(path: string): SketchdrawDoc | null {
    const known = this.cache.get(path);
    if (known) return known;
    void this.load(path);
    return null;
  }

  // Reads a drawing note and keeps it. A file that is missing or unreadable is not kept.
  async load(path: string): Promise<void> {
    if (this.loading.has(path)) return;
    this.loading.add(path);
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        this.cache.delete(path);
        return;
      }
      const result = parseSketchdraw(await this.app.vault.read(file));
      if (result.ok) {
        this.cache.set(path, result.doc);
        this.notify(path);
      }
    } catch {
      this.cache.delete(path);
    } finally {
      this.loading.delete(path);
    }
  }

  // Tells whether a drawing note exists in the vault.
  exists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  // Creates the folders of a path if they do not exist yet. Returns true when at least one folder was created.
  async ensureFolder(folder: string): Promise<boolean> {
    let created = false;
    let current = ``;
    for (const part of folder.split(`/`)) {
      current = current === `` ? part : `${current}/${part}`;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try {
          await this.app.vault.createFolder(current);
          created = true;
        } catch {
          // The folder appeared in the meantime: nothing to do.
        }
      }
    }
    return created;
  }

  // Returns a free path for a new drawing note named after a sketchnote.
  private async freePath(sketchnoteName: string): Promise<string> {
    const used = new Set(this.app.vault.getFiles().map((f) => f.path));
    // The disk is asked as well as the index of the vault, which does not always know every file of the disk.
    return firstFreePath((taken) => uniqueDrawingPath(this.folder(), sketchnoteName, new Set([...used, ...taken])), (path) => this.app.vault.adapter.exists(path));
  }

  // Creates an empty drawing note in the folder of the drawings, with the ink and the palette of the page, and returns its file.
  async createDrawing(sketchnoteName: string, ink: string, palette: string[], guide: DrawingGuide | null, path?: string): Promise<TFile> {
    await this.ensureFolder(this.folder());
    const target = path ?? (await this.freePath(sketchnoteName));
    const doc = createEmptyDrawing(ink, palette, guide ?? undefined);
    const file = await this.app.vault.create(target, serializeSketchdraw(doc));
    this.cache.set(file.path, doc);
    return file;
  }

  // Gives a drawing note the guide of its zone (the proportions of the zone of the page), when that changed. The note is only written when the guide is different.
  async setGuide(path: string, guide: DrawingGuide | null): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || guide === null) return;
    try {
      await this.app.vault.process(file, (data) => {
        const result = parseSketchdraw(data);
        const old = result.ok ? result.doc.guide : undefined;
        if (!result.ok || (old && old.shape === guide.shape && old.width === guide.width && old.height === guide.height)) return data;
        return serializeSketchdraw({ ...result.doc, guide });
      });
    } catch {
      // The note cannot be rewritten now: it keeps its old guide.
    }
  }

  // Copies a drawing note to a new note and returns the path of the copy, or null when the original cannot be read.
  async copyDrawing(path: string, sketchnoteName: string): Promise<string | null> {
    const source = this.app.vault.getAbstractFileByPath(path);
    if (!(source instanceof TFile)) return null;
    const text = await this.app.vault.read(source);
    if (!parseSketchdraw(text).ok) return null;
    await this.ensureFolder(this.folder());
    const copy = await this.app.vault.create(await this.freePath(sketchnoteName), text);
    return copy.path;
  }

  // Follows the vault: a modified drawing is loaded again, a renamed drawing keeps its frames, a deleted drawing is forgotten.
  handleModify(file: TAbstractFile): void {
    if (file instanceof TFile && file.extension === `sketchdraw`) void this.load(file.path);
  }

  // Called when a file is renamed or moved: the sketchnotes that point to a renamed drawing are rewritten to the new path.
  async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (!(file instanceof TFile) || file.extension !== `sketchdraw`) return;
    const doc = this.cache.get(oldPath);
    this.cache.delete(oldPath);
    if (doc) this.cache.set(file.path, doc);
    for (const note of this.app.vault.getFiles().filter((f) => f.extension === `sketchnote`)) {
      try {
        await this.app.vault.process(note, (data) => renameReferences(data, oldPath, file.path) ?? data);
      } catch {
        // A note that cannot be rewritten keeps its old path; the frame then offers to create the drawing again.
      }
    }
    this.notify(file.path);
  }

  // Called when a file is deleted.
  handleDelete(file: TAbstractFile): void {
    if (file instanceof TFile && file.extension === `sketchdraw`) {
      this.cache.delete(file.path);
      this.notify(file.path);
    }
  }
}
