// Entry point of the plugin: registers the views of a sketchnote and of a drawing, the commands, the settings and the follow-up of the drawing notes.
import { Notice, Plugin, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { CanvasView } from "./canvas-view";
import { DRAW_VIEW_TYPE, SketchdrawView } from "./draw-view";
import { DrawingStore } from "./drawings";
import { registerIcons } from "./custom-icons";
import { createEmptyDoc, serializeSketchnote } from "./file-format";
import { setLanguage, t } from "./i18n";
import { PluginApi } from "./plugin-api";
import { DEFAULT_SETTINGS, readSettings, SketchnoteSettings } from "./settings";
import { SketchnoteSettingTab } from "./settings-tab";
import { SketchnoteView, VIEW_TYPE } from "./view";

export default class SketchnotePlugin extends Plugin {
  settingsData: SketchnoteSettings = { ...DEFAULT_SETTINGS };
  drawings!: DrawingStore;
  private readonly origins = new Map<string, WorkspaceLeaf>();

  // Starts the plugin: settings, language, views, file extensions, commands, settings page and vault events.
  async onload(): Promise<void> {
    this.settingsData = readSettings(await this.loadData());
    setLanguage(`auto`);
    registerIcons();
    this.drawings = new DrawingStore(this.app, () => this.settingsData.drawingsFolder);
    const api: PluginApi = { drawings: this.drawings, settings: () => this.settingsData, origins: this.origins };
    this.registerView(VIEW_TYPE, (leaf) => new SketchnoteView(leaf, api));
    this.registerView(DRAW_VIEW_TYPE, (leaf) => new SketchdrawView(leaf, api));
    this.registerExtensions([`sketchnote`], VIEW_TYPE);
    this.registerExtensions([`sketchdraw`], DRAW_VIEW_TYPE);
    this.addCommand({ id: `create-sketchnote`, name: t(`Créer un sketchnote`), callback: () => void this.createSketchnote() });
    this.addCommand({
      id: `duplicate-selection`,
      name: t(`Dupliquer la sélection`),
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(SketchnoteView) ?? this.app.workspace.getActiveViewOfType(SketchdrawView);
        if (!(view instanceof CanvasView)) return false;
        if (!checking) void view.duplicateSelection();
        return true;
      },
    });
    this.addGroupCommand(`group-selection`, t(`Grouper la sélection`), (view) => view.groupSelection());
    this.addGroupCommand(`ungroup-selection`, t(`Dégrouper la sélection`), (view) => view.ungroupSelection());
    this.addRibbonIcon(`pencil`, t(`Créer un sketchnote`), () => void this.createSketchnote());
    this.addSettingTab(new SketchnoteSettingTab(this.app, this));
    this.registerEvent(this.app.vault.on(`modify`, (file) => this.drawings.handleModify(file)));
    this.registerEvent(this.app.vault.on(`rename`, (file, oldPath) => void this.drawings.handleRename(file, oldPath)));
    this.registerEvent(this.app.vault.on(`delete`, (file) => this.drawings.handleDelete(file)));
  }

  // Adds a command of the palette that works on the selection of the active sketchnote or drawing. It has no default keyboard shortcut (Ctrl+G belongs to Obsidian): the
  // user gives it one in the settings of Obsidian.
  private addGroupCommand(id: string, name: string, run: (view: CanvasView<unknown>) => void): void {
    this.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(SketchnoteView) ?? this.app.workspace.getActiveViewOfType(SketchdrawView);
        if (!(view instanceof CanvasView)) return false;
        if (!checking) run(view as CanvasView<unknown>);
        return true;
      },
    });
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
