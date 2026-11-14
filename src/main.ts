// Entry point of the plugin: registers the .sketchnote view and the command that creates a new sketchnote.
import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { createEmptyDoc, serializeSketchnote } from "./file-format";
import { setLanguage, t } from "./i18n";
import { SketchnoteView, VIEW_TYPE } from "./view";

export default class SketchnotePlugin extends Plugin {
  // Starts the plugin: language, view, file extension, command and ribbon button.
  async onload(): Promise<void> {
    setLanguage(`auto`);
    this.registerView(VIEW_TYPE, (leaf) => new SketchnoteView(leaf));
    this.registerExtensions([`sketchnote`], VIEW_TYPE);
    this.addCommand({ id: `create-sketchnote`, name: t(`Créer un sketchnote`), callback: () => void this.createSketchnote() });
    this.addRibbonIcon(`pencil`, t(`Créer un sketchnote`), () => void this.createSketchnote());
  }

  // Returns a free path for a new sketchnote, next to the active note or at the root of the vault.
  private freePath(): string {
    const active = this.app.workspace.getActiveFile();
    const folder = this.app.fileManager.getNewFileParent(active ? active.path : ``).path;
    const base = t(`Nouveau sketchnote`);
    for (let n = 0; n < 1000; n++) {
      const name = n === 0 ? base : `${base} ${n}`;
      const path = normalizePath(`${folder}/${name}.sketchnote`);
      if (!this.app.vault.getAbstractFileByPath(path)) return path;
    }
    return normalizePath(`${folder}/${base} ${Date.now()}.sketchnote`);
  }

  // Creates an empty sketchnote file and opens it in a new tab.
  private async createSketchnote(): Promise<void> {
    try {
      const file: TFile = await this.app.vault.create(this.freePath(), serializeSketchnote(createEmptyDoc()));
      await this.app.workspace.getLeaf(`tab`).openFile(file);
      new Notice(t(`Sketchnote créé : {0}`, file.path));
    } catch (e) {
      new Notice(t(`Impossible de créer le sketchnote : {0}`, e instanceof Error ? e.message : String(e)));
    }
  }
}
