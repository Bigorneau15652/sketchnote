// The view that opens a .sketchnote file: the page, its structure, its elements and the drawings that live in the dotted zones of the structure.
// The engine (zoom, selection, undo...) is in CanvasView; this file adds what is specific to a page.
import { Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import { CanvasView, Tool } from "./canvas-view";
import { ConfirmModal } from "./confirm-modal";
import { applySettings, ensureZoneFrames, structureEdited, zoneFrame } from "./doc-ops";
import { contentBox, DrawingGuide, fitInFrame, makeGuide } from "./drawing-file";
import { drawElements } from "./element-render";
import { DrawingElement, SketchElement } from "./elements";
import { isLocked } from "./lock";
import { createEmptyDoc, PageSettings, parseSketchnote, serializeSketchnote, SketchnoteDoc } from "./file-format";
import { Box } from "./geometry";
import { t } from "./i18n";
import { addZone, buildStructure, LayoutSettings, sameLayout, Slot } from "./layout";
import { PageModal } from "./page-modal";
import { renderPage, RenderedPage } from "./page-render";
import type { ExportServices } from "./export-service";
import { PluginApi } from "./plugin-api";
import { defaultStyle } from "./style";

export const VIEW_TYPE = `sketchnote-view`;

export class SketchnoteView extends CanvasView<SketchnoteDoc> {
  private readonly api: PluginApi;
  private slots: Slot[] = [];
  private showZones = true;
  private zonesButton: HTMLElement | null = null;
  private zenButton: HTMLElement | null = null;
  private addButton: HTMLButtonElement | null = null;

  // Creates the view inside a workspace leaf, with the services of the plugin.
  constructor(leaf: WorkspaceLeaf, api: PluginApi) {
    super(leaf, createEmptyDoc());
    this.api = api;
    this.style = defaultStyle(`#000000`);
    this.register(this.api.drawings.onChange((path) => this.onDrawingChanged(path)));
  }

  // Returns the identifier of the view type.
  getViewType(): string {
    return VIEW_TYPE;
  }

  // Returns the title shown in the tab.
  getDisplayText(): string {
    return this.file ? this.file.basename : t(`Nouveau sketchnote`);
  }

  // Returns the icon shown in the tab.
  getIcon(): string {
    return `pencil`;
  }

  // ---------------------------------------------------------------------------------------------------------------- what the engine asks

  protected elementsOf(doc: SketchnoteDoc): SketchElement[] {
    return doc.elements;
  }

  protected withElements(doc: SketchnoteDoc, elements: SketchElement[]): SketchnoteDoc {
    return { ...doc, elements };
  }

  protected parseDoc(data: string): { ok: true; doc: SketchnoteDoc } | { ok: false; error: string } {
    const result = parseSketchnote(data);
    // A page made by an earlier version may lack the frame of some zones: they are added when the file is read.
    return result.ok ? { ok: true, doc: ensureZoneFrames(result.doc) } : result;
  }

  protected serializeDoc(doc: SketchnoteDoc): string {
    return serializeSketchnote(doc);
  }

  protected emptyDoc(): SketchnoteDoc {
    return createEmptyDoc();
  }

  protected surfaceSize(): { w: number; h: number } {
    return { w: this.doc.page.width, h: this.doc.page.height };
  }

  protected fitBox(): Box {
    return { x: 0, y: 0, w: this.doc.page.width, h: this.doc.page.height };
  }

  // Draws the page, and keeps the slots of its structure (the dotted zones) for the overlay, the magnetism and the double click.
  protected renderSurface(zoom: number): RenderedPage {
    this.slots = this.doc.layout ? buildStructure(this.doc.layout, this.doc.page).slots : [];
    return renderPage(this.doc.page, zoom);
  }

  // Draws the elements of the page: the drawings shown in the frames of the zones, and the dotted outline of the empty zones unless the eye hid them.
  protected drawContent(group: SVGElement): void {
    drawElements(this.doc.elements, group, { lookup: (path) => this.api.drawings.lookup(path), showZones: this.showZones, background: this.doc.page.background, ink: this.doc.page.ink });
  }

  protected exportBoxAll(): Box | null {
    return this.doc.elements.length === 0 ? null : { x: 0, y: 0, w: this.doc.page.width, h: this.doc.page.height };
  }

  // The drawings shown in the frames are drawn, and the dotted outline of the empty zones is not.
  protected drawExport(list: SketchElement[], group: SVGElement): void {
    drawElements(list, group, { lookup: (path) => this.api.drawings.lookup(path), showZones: false, background: this.doc.page.background, ink: this.doc.page.ink });
  }

  protected exportPartName(): string {
    return t(`Page`);
  }

  protected exportServices(): ExportServices {
    return this.api.exports;
  }

  protected extraSnapTargets(): Box[] {
    return this.slots.map((s) => ({ x: s.x, y: s.y, w: s.width, h: s.height }));
  }

  protected toolKeys(): Record<string, Tool> {
    return { v: `select`, h: `hand` };
  }

  // Adds the buttons of the page at the start of the bottom bar: the menu of the page settings, the add zone button and the eye that shows or hides the zones.
  protected buildBarStart(bar: HTMLElement): void {
    this.button(bar, `menu`, t(`Réglages de la page`), () => this.openPageSettings());
    this.addButton = this.button(bar, `plus`, t(`Ajouter une zone`), () => this.addZone());
    this.zenButton = this.button(bar, `focus`, t(`Mode zen`), () => {
      void this.api.zen.toggle().then(() => this.updateBar());
    });
    this.zonesButton = this.button(bar, `eye`, t(`Masquer les zones`), () => {
      this.showZones = !this.showZones;
      this.renderContent();
      this.updateBar();
    });
  }

  // Keeps the add zone button and the eye in step with the structure: the first is off when there is no structure or it is at its largest.
  protected onSelectionChanged(): void {
    this.zenButton?.toggleClass(`is-active`, this.api.zen.active());
    const layout = this.doc.layout;
    if (this.addButton) this.addButton.disabled = layout === null || addZone(layout) === null;
    if (this.zonesButton) {
      setIcon(this.zonesButton, this.showZones ? `eye` : `eye-off`);
      const label = this.showZones ? t(`Masquer les zones`) : t(`Afficher les zones`);
      this.zonesButton.setAttribute(`aria-label`, label);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- page settings

  // Opens the window of page settings.
  private openPageSettings(): void {
    new PageModal(
      this.app,
      this.doc.page,
      this.doc.layout,
      (page, layout) => this.commit(applySettings(this.doc, page, layout), true),
      (page, layout) => this.replacesEditedStructure(page, layout),
    ).open();
  }

  // Tells whether new page settings would redraw a structure that the user has edited.
  private replacesEditedStructure(page: PageSettings, layout: LayoutSettings | null): boolean {
    if (!structureEdited(this.doc)) return false;
    return page.width !== this.doc.page.width || page.height !== this.doc.page.height || !sameLayout(this.doc.layout, layout);
  }

  // Adds one zone to the structure (one more column, bubble, step...), as if the number had been raised in the page settings. Asks first when the user has edited
  // what the structure drew.
  private addZone(): void {
    const layout = this.doc.layout;
    const next = layout ? addZone(layout) : null;
    if (!next) return;
    const run = (): void => this.commit(applySettings(this.doc, this.doc.page, next), true);
    if (this.replacesEditedStructure(this.doc.page, next)) {
      new ConfirmModal(
        this.app,
        t(`Remplacer la structure ?`),
        t(`Vous avez modifié ce que la structure avait dessiné (séparations, flèches ou liens). Ce changement la redessine et ces modifications sont perdues. Le bouton Annuler de la barre du bas permet de les retrouver.`),
        run,
        () => undefined,
      ).open();
    } else {
      run();
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- drawings

  // Double click on a frame (a zone): opens its drawing, created the first time.
  protected onActivate(el: SketchElement): void {
    if (el.type === `drawing`) void this.openDrawing(el);
  }

  // Returns the guide that the drawing of a frame shows: the proportions and the shape of its zone, or of the frame itself when it has no zone.
  private guideOf(frame: DrawingElement): DrawingGuide | null {
    const zone = frame.slot !== undefined ? this.slots[frame.slot] : undefined;
    return zone ? makeGuide(zone.width, zone.height, zone.shape) : makeGuide(frame.width, frame.height, frame.shape ?? `rect`);
  }

  // Deletes the selection. A zone frame that holds a drawing becomes an empty zone again (the drawing note stays in the vault); an empty zone frame stays, because the
  // zones belong to the structure; every other element is removed.
  protected deleteSelection(): void {
    if (this.selected.size === 0) return;
    const elements: SketchElement[] = [];
    for (const el of this.doc.elements) {
      if (!this.selected.has(el.id) || isLocked(el)) {
        elements.push(el);
      } else if (el.type === `drawing` && el.slot !== undefined) {
        const zone = this.slots[el.slot];
        elements.push(el.path !== null && zone ? zoneFrame(zone, el.slot, el.id) : el);
      }
    }
    this.selected.clear();
    this.commitElements(elements);
  }

  // Opens the drawing of a frame in its own tab. A frame without a drawing note gets a new one; a frame whose note is gone asks first.
  private async openDrawing(el: DrawingElement): Promise<void> {
    try {
      const store = this.api.drawings;
      if (el.path === null) {
        const file = await store.createDrawing(this.file ? this.file.basename : `Sketchnote`, this.doc.page.ink, this.doc.page.palette, this.guideOf(el));
        this.commitElements(this.doc.elements.map((e) => (e.id === el.id && e.type === `drawing` ? { ...e, path: file.path } : e)));
        await this.openNote(file);
      } else if (store.exists(el.path)) {
        const file = this.app.vault.getAbstractFileByPath(el.path);
        await store.setGuide(el.path, this.guideOf(el));
        if (file instanceof TFile) await this.openNote(file);
      } else {
        new ConfirmModal(
          this.app,
          t(`Dessin introuvable`),
          t(`Le fichier de dessin {0} n'existe plus. En créer un nouveau, vide ?`, el.path),
          () => void this.recreateDrawing(el),
          () => undefined,
        ).open();
      }
    } catch (e) {
      new Notice(t(`Impossible d'ouvrir le dessin : {0}`, e instanceof Error ? e.message : String(e)));
    }
  }

  // Creates a new empty drawing note at the path a frame points to, and opens it.
  private async recreateDrawing(el: DrawingElement): Promise<void> {
    if (el.path === null) return;
    try {
      const file = await this.api.drawings.createDrawing(this.file ? this.file.basename : `Sketchnote`, this.doc.page.ink, this.doc.page.palette, this.guideOf(el), el.path);
      await this.openNote(file);
    } catch (e) {
      new Notice(t(`Impossible d'ouvrir le dessin : {0}`, e instanceof Error ? e.message : String(e)));
    }
  }

  // What an open drawing needs to show the other drawings of the page behind it: the frames that hold a drawing, and the colours that those drawings are drawn with.
  backdropSource(): { frames: DrawingElement[]; background: string; ink: string } | null {
    const frames = this.doc.elements.filter((e): e is DrawingElement => e.type === `drawing` && e.path !== null);
    return frames.length === 0 ? null : { frames, background: this.doc.page.background, ink: this.doc.page.ink };
  }

  // Opens a drawing note in a new tab, and remembers this tab so that the Back button of the drawing returns here.
  private async openNote(file: TFile): Promise<void> {
    this.api.origins.set(file.path, this.leaf);
    // In zen mode the drawing opens in the main window (this page is in the floating window), in the place of the drawing that was there.
    const leaf = this.api.zen.drawLeaf() ?? this.app.workspace.getLeaf(`tab`);
    await leaf.openFile(file);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  // Frames that show a drawing take its proportions (the width stays, the height follows, around the same centre). Returns true when a frame changed.
  private syncFrames(): boolean {
    let changed = false;
    const elements = this.doc.elements.map((el) => {
      if (el.type !== `drawing` || el.path === null) return el;
      const doc = this.api.drawings.lookup(el.path);
      const box = doc ? contentBox(doc) : null;
      if (!box) return el;
      const height = Math.round(fitInFrame(el.x, el.y, el.width, box).height * 100) / 100;
      if (Math.abs(height - el.height) < 0.5 || height < 1) return el;
      changed = true;
      return { ...el, height, y: Math.round((el.y + (el.height - height) / 2) * 100) / 100 };
    });
    if (changed) this.doc = this.withElements(this.doc, elements);
    return changed;
  }

  // After a change of the elements, lets the frames take the proportions of their drawings.
  protected onElementsChanged(): void {
    if (this.syncFrames()) {
      this.renderContent();
      this.renderUi();
      this.requestSave();
    }
  }

  // A drawing was loaded or modified: the frames that show it are drawn again.
  private onDrawingChanged(path: string): void {
    if (!this.content || !this.doc.elements.some((e) => e.type === `drawing` && e.path === path)) return;
    this.syncFrames();
    this.renderContent();
    this.renderUi();
  }

  // Copies the drawing notes of duplicated or pasted frames, so that each copy has its own independent drawing. A copy leaves its slot: it is a free frame.
  protected async adaptClones(copies: SketchElement[]): Promise<SketchElement[]> {
    const out: SketchElement[] = [];
    for (const el of copies) {
      if (el.type === `drawing`) {
        const { slot: _s, ...free } = el;
        void _s;
        const copy = el.path !== null ? await this.api.drawings.copyDrawing(el.path, this.file ? this.file.basename : `Sketchnote`) : null;
        out.push({ ...free, path: copy });
      } else {
        out.push(el);
      }
    }
    return out;
  }
}
