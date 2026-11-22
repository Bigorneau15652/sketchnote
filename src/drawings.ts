// The drawing notes of the vault: loading and keeping up to date the .sketchdraw files that the pages still point to (the old frames of a page are read from them), and following their
// renaming. The notes are not opened in a view of their own any more: the drawings are made on the page.
import { App, TFile, TAbstractFile } from "obsidian";
import { parseSketchdraw, renameReferences, SketchdrawDoc } from "./drawing-file";

export class DrawingStore {
  private readonly cache = new Map<string, SketchdrawDoc>();
  private readonly loading = new Set<string>();
  private readonly listeners = new Set<(path: string) => void>();
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
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
