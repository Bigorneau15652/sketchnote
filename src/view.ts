// The view that opens a .sketchnote file: the page, its structure, its elements and the drawings that live in the dotted zones of the structure.
// The engine (zoom, selection, undo...) is in CanvasView; this file adds what is specific to a page.
import { Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import { CanvasView, Point, Tool } from "./canvas-view";
import { ConfirmModal } from "./confirm-modal";
import { applySettings, structureEdited } from "./doc-ops";
import { contentBox, fitInFrame } from "./drawing-file";
import { drawElements } from "./element-render";
import { DrawingElement, newId, SketchElement } from "./elements";
import { createEmptyDoc, PageSettings, parseSketchnote, serializeSketchnote, SketchnoteDoc } from "./file-format";
import { Box } from "./geometry";
import { t } from "./i18n";
import { addZone, buildStructure, LayoutSettings, sameLayout, Slot, slotIndexAt } from "./layout";
import { PageModal } from "./page-modal";
import { renderPage, RenderedPage } from "./page-render";
import { PluginApi } from "./plugin-api";
import { defaultStyle } from "./style";

export const VIEW_TYPE = `sketchnote-view`;

export class SketchnoteView extends CanvasView<SketchnoteDoc> {
  private readonly api: PluginApi;
  private slots: Slot[] = [];
  private showZones = true;
  private zonesButton: HTMLElement | null = null;
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
    return parseSketchnote(data);
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

  // Draws the elements of the page, and the drawings shown in its frames.
  protected drawContent(group: SVGElement): void {
    drawElements(this.doc.elements, group, (path) => this.api.drawings.lookup(path));
  }

  protected extraSnapTargets(): Box[] {
    return this.slots.map((s) => ({ x: s.x, y: s.y, w: s.width, h: s.height }));
  }

  protected toolKeys(): Record<string, Tool> {
    return { v: `select`, h: `hand` };
  }

  // The dotted zones, unless the eye button hid them, and which ones already hold a drawing.
  protected zones(): { slots: Slot[]; occupied: boolean[]; background: string } | null {
    if (!this.showZones || this.slots.length === 0) return null;
    return { slots: this.slots, occupied: this.slots.map((_, i) => this.frameOfSlot(i) !== undefined), background: this.doc.page.background };
  }

  // Adds the buttons of the page at the start of the bottom bar: the menu of the page settings, the add zone button and the eye that shows or hides the zones.
  protected buildBarStart(bar: HTMLElement): void {
    this.button(bar, `menu`, t(`Réglages de la page`), () => this.openPageSettings());
    this.addButton = this.button(bar, `plus`, t(`Ajouter une zone`), () => this.addZone());
    this.zonesButton = this.button(bar, `eye`, t(`Masquer les zones`), () => {
      this.showZones = !this.showZones;
      this.renderUi();
      this.updateBar();
    });
  }

  // Keeps the add zone button and the eye in step with the structure: the first is off when there is no structure or it is at its largest.
  protected onSelectionChanged(): void {
    const layout = this.doc.layout;
    if (this.addButton) this.addButton.disabled = layout === null || addZone(layout) === null;
    if (this.zonesButton) {
      setIcon(this.zonesButton, this.showZones ? `eye` : `eye-off`);
      const label = this.showZones ? t(`Masquer les zones`) : t(`Afficher les zones`);
      this.zonesButton.setAttribute(`aria-label`, label);
      this.zonesButton.setAttribute(`title`, label);
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

  // Returns the frame of a drawing that belongs to a slot: the one that names the slot, or one whose centre is inside it.
  private frameOfSlot(index: number): DrawingElement | undefined {
    const s = this.slots[index];
    if (!s) return undefined;
    const frames = this.doc.elements.filter((e): e is DrawingElement => e.type === `drawing`);
    return (
      frames.find((f) => f.slot === index) ??
      frames.find((f) => f.slot === undefined && slotIndexAt([s], [f.x + f.width / 2, f.y + f.height / 2]) === 0)
    );
  }

  // Double click on a frame: opens its drawing.
  protected onActivate(el: SketchElement): void {
    if (el.type === `drawing`) void this.openDrawing(el);
  }

  // Double click on the empty page: in a dotted zone it opens the drawing of that zone, creating it the first time.
  protected onEmptyActivate(p: Point): void {
    const index = slotIndexAt(this.slots, p);
    if (index < 0) return;
    const frame = this.frameOfSlot(index);
    if (frame) void this.openDrawing(frame);
    else void this.openNewDrawing(index);
  }

  // Creates the drawing of an empty zone: a frame that fills the zone, its drawing note, and opens the note. Everything is one change that can be undone.
  private async openNewDrawing(index: number): Promise<void> {
    const slot = this.slots[index];
    if (!slot) return;
    try {
      const file = await this.api.drawings.createDrawing(this.file ? this.file.basename : `Sketchnote`, this.doc.page.ink, this.doc.page.palette);
      const frame: DrawingElement = { id: newId(this.doc.elements), type: `drawing`, x: slot.x, y: slot.y, width: slot.width, height: slot.height, slot: index, path: file.path };
      this.selected = new Set([frame.id]);
      this.commitElements([...this.doc.elements, frame]);
      await this.openNote(file);
    } catch (e) {
      new Notice(t(`Impossible d'ouvrir le dessin : {0}`, e instanceof Error ? e.message : String(e)));
    }
  }

  // Opens the drawing of a frame in its own tab. A frame without a drawing note gets a new one; a frame whose note is gone asks first.
  private async openDrawing(el: DrawingElement): Promise<void> {
    try {
      const store = this.api.drawings;
      if (el.path === null) {
        const file = await store.createDrawing(this.file ? this.file.basename : `Sketchnote`, this.doc.page.ink, this.doc.page.palette);
        this.commitElements(this.doc.elements.map((e) => (e.id === el.id && e.type === `drawing` ? { ...e, path: file.path } : e)));
        await this.openNote(file);
      } else if (store.exists(el.path)) {
        const file = this.app.vault.getAbstractFileByPath(el.path);
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
      const file = await this.api.drawings.createDrawing(this.file ? this.file.basename : `Sketchnote`, this.doc.page.ink, this.doc.page.palette, el.path);
      await this.openNote(file);
    } catch (e) {
      new Notice(t(`Impossible d'ouvrir le dessin : {0}`, e instanceof Error ? e.message : String(e)));
    }
  }

  // Opens a drawing note in a new tab, and remembers this tab so that the Back button of the drawing returns here.
  private async openNote(file: TFile): Promise<void> {
    this.api.origins.set(file.path, this.leaf);
    await this.app.workspace.getLeaf(`tab`).openFile(file);
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
