// Entry point of the plugin: registers the views of a sketchnote and of a drawing, the commands, the settings and the follow-up of the drawing notes.
import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { CanvasView } from "./canvas-view";
import { DRAW_VIEW_TYPE, SketchdrawView } from "./draw-view";
import { DrawingStore } from "./drawings";
import { registerIcons } from "./custom-icons";
import { FontStore } from "./font-store";
import { ExportServiceImpl } from "./export-service";
import { IconStore } from "./icon-store";
import { isImageName } from "./image-files";
import { setImageResolver } from "./image-registry";
import { createEmptyDoc, serializeSketchnote } from "./file-format";
import { setLanguage, t } from "./i18n";
import { PluginApi } from "./plugin-api";
import { DEFAULT_SETTINGS, readSettings, SketchnoteSettings } from "./settings";
import { SketchnoteSettingTab } from "./settings-tab";
import { SketchnoteView, VIEW_TYPE } from "./view";

export default class SketchnotePlugin extends Plugin {
  settingsData: SketchnoteSettings = { ...DEFAULT_SETTINGS };
  drawings!: DrawingStore;
  fonts!: FontStore;
  icons!: IconStore;
  private readonly origins = new Map<string, WorkspaceLeaf>();

  // Starts the plugin: settings, language, views, file extensions, commands, settings page and vault events.
  async onload(): Promise<void> {
    this.settingsData = readSettings(await this.loadData());
    setLanguage(`auto`);
    registerIcons();
    this.drawings = new DrawingStore(this.app, () => this.settingsData.drawingsFolder);
    this.fonts = new FontStore(this.app, () => this.settingsData.fontsFolder);
    this.icons = new IconStore(this.app, () => this.settingsData.iconsFolder);
    this.icons.start();
    // The pictures of the drawings are found in the vault by their path.
    setImageResolver((path) => {
      const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
      return file instanceof TFile ? this.app.vault.getResourcePath(file) : null;
    });
    // The note that was last open in an editor: the exports put their link in it.
    let lastNote: MarkdownView | null = null;
    this.registerEvent(this.app.workspace.on(`active-leaf-change`, (leaf) => {
      if (leaf && leaf.view instanceof MarkdownView) lastNote = leaf.view;
    }));
    const exportServices = new ExportServiceImpl(this.app, () => this.settingsData.exportsFolder, this.fonts, () => (lastNote && lastNote.file && this.app.workspace.getLeavesOfType(`markdown`).some((l) => l.view === lastNote) ? lastNote : null));
    const api: PluginApi = { drawings: this.drawings, fonts: this.fonts, icons: this.icons, exports: exportServices, settings: () => this.settingsData, origins: this.origins };
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
    this.addGroupCommand(`lock-selection`, t(`Verrouiller ou déverrouiller la sélection`), (view) => view.toggleLock());
    this.addGroupCommand(`ungroup-selection`, t(`Dégrouper la sélection`), (view) => view.ungroupSelection());
    this.addRibbonIcon(`pencil`, t(`Créer un sketchnote`), () => void this.createSketchnote());
    this.addSettingTab(new SketchnoteSettingTab(this.app, this));
    this.registerEvent(this.app.vault.on(`modify`, (file) => this.drawings.handleModify(file)));
    // The fonts folder is read again when a font file is added, changed, renamed or deleted in it.
    const fontsChanged = (path: string): void => {
      if (this.fonts.isFontPath(path)) void this.fonts.refresh();
    };
    this.registerEvent(this.app.vault.on(`create`, (file) => fontsChanged(file.path)));
    this.registerEvent(this.app.vault.on(`modify`, (file) => fontsChanged(file.path)));
    this.registerEvent(this.app.vault.on(`delete`, (file) => fontsChanged(file.path)));
    this.registerEvent(this.app.vault.on(`rename`, (file, oldPath) => {
      fontsChanged(file.path);
      fontsChanged(oldPath);
    }));
    this.app.workspace.onLayoutReady(() => void this.fonts.start());
    this.registerEvent(this.app.vault.on(`rename`, (file, oldPath) => void this.drawings.handleRename(file, oldPath)));
    // The open drawings and pages are drawn again (a moment after the last change) when a picture is added, moved or deleted.
    let imageTimer: number | null = null;
    const imagesChanged = (path: string): void => {
      if (!isImageName(path)) return;
      if (imageTimer !== null) window.clearTimeout(imageTimer);
      imageTimer = window.setTimeout(() => {
        for (const type of [VIEW_TYPE, DRAW_VIEW_TYPE]) for (const leaf of this.app.workspace.getLeavesOfType(type)) if (leaf.view instanceof CanvasView) leaf.view.refreshImages();
      }, 300);
    };
    this.registerEvent(this.app.vault.on(`create`, (file) => imagesChanged(file.path)));
    this.registerEvent(this.app.vault.on(`delete`, (file) => imagesChanged(file.path)));
    this.registerEvent(this.app.vault.on(`rename`, (file, oldPath) => {
      imagesChanged(file.path);
      imagesChanged(oldPath);
    }));
    this.registerEvent(this.app.vault.on(`delete`, (file) => this.drawings.handleDelete(file)));
  }

  // Stops the plugin: the fonts leave the browser.
  onunload(): void {
    this.fonts.destroy();
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
