// The view that opens a .sketchnote file: the page, its structure and everything drawn on it. It has two modes. In the structure mode the whole page is shown with the dotted places of the
// structure and the menus of the page; a zone is selected, moved, resized and turned as one block. A double click on a zone enters the drawing mode: the view zooms on that zone, the tools
// and the menus of the drawing appear, the rest of the page stays visible but faded, and what is drawn belongs to the zone. Escape or the back button returns to the structure.
// The editing (tools, menus, properties) is in DrawEditor and the engine (zoom, selection, undo...) in CanvasView; this file adds what is specific to a page.
import { Notice, setIcon, WorkspaceLeaf } from "obsidian";
import { Tool } from "./canvas-view";
import { backdropOpacity, BACKDROP_MAX_FADE, BackdropSettings, cleanBackdrop, DEFAULT_BACKDROP } from "./backdrop";
import { ConfirmModal } from "./confirm-modal";
import { DrawEditor } from "./draw-editor";
import { applySettings, structureEdited } from "./doc-ops";
import { drawElements } from "./element-render";
import { DrawingElement, SketchElement } from "./elements";
import { createEmptyDoc, PageSettings, parseSketchnote, serializeSketchnote, SketchnoteDoc } from "./file-format";
import { Box, unionBox } from "./geometry";
import { t } from "./i18n";
import { addZone, buildStructure, LayoutSettings, sameLayout, Slot, slotIndexAt } from "./layout";
import { PageModal } from "./page-modal";
import { slotStyle } from "./page-background";
import { renderPage, RenderedPage } from "./page-render";
import type { ExportServices } from "./export-service";
import { PluginApi } from "./plugin-api";
import type { PanelSection } from "./panel-kinds";
import { CreationTool } from "./tools";
import { svgEl } from "./svg";
import { expandToZones, framesToInline, inlineDrawing, withoutFrames, withZone, zoneBounds, zoneIsEmpty } from "./zone-content";
import { expandToGroups } from "./groups";

export const VIEW_TYPE = `sketchnote-view`;

// The room kept around a zone when the view zooms on it, as a part of its size.
const ZONE_MARGIN = 0.08;
// The drawing mode of the free part of the page: what is drawn outside the zones (annotations, arrows between zones, a page that has no structure). It belongs to no zone.
const FREE_ZONE = -1;

export class SketchnoteView extends DrawEditor<SketchnoteDoc> {
  private slots: Slot[] = [];
  private showZones = true;
  private zonesButton: HTMLElement | null = null;
  private zenButton: HTMLElement | null = null;
  private addButton: HTMLButtonElement | null = null;
  private wholeButton: HTMLElement | null = null;
  // The number of the zone that is being drawn, or null in the structure mode.
  private drawZone: number | null = null;
  // In the drawing mode: whether the whole page is shown (the fit button) instead of the zone.
  private wholePage = false;
  // The display of the rest of the page while a zone is drawn (shown or not, and how faded), kept while the application runs.
  private static display: BackdropSettings = { ...DEFAULT_BACKDROP, others: true };
  private displayBox: HTMLElement | null = null;
  private migrating = false;

  // Creates the view inside a workspace leaf, with the services of the plugin.
  constructor(leaf: WorkspaceLeaf, api: PluginApi) {
    super(leaf, api, createEmptyDoc());
    this.applyMode();
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

  protected inkOf(): string {
    return this.doc.page.ink;
  }

  protected paletteOf(): string[] {
    return this.doc.page.palette;
  }

  // Reads the file, then brings into the page the drawings that an earlier version kept in notes of their own.
  setViewData(data: string, clear: boolean): void {
    this.drawZone = null;
    this.wholePage = false;
    super.setViewData(data, clear);
    this.applyMode();
    void this.inlineFrames();
  }

  // ---------------------------------------------------------------------------------------------------------------- what the engine asks

  protected elementsOf(doc: SketchnoteDoc): SketchElement[] {
    return doc.elements;
  }

  // In the drawing mode every new element belongs to the zone that is being drawn.
  protected withElements(doc: SketchnoteDoc, elements: SketchElement[]): SketchnoteDoc {
    const zone = this.drawZone;
    if (zone === null || zone === FREE_ZONE) return { ...doc, elements };
    const known = new Set(doc.elements.map((e) => e.id));
    return { ...doc, elements: elements.map((e) => (!known.has(e.id) && e.slot === undefined && e.group !== `structure` && e.type !== `drawing` ? withZone(e, zone) : e)) };
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

  // The part of the page that fit shows: the whole page, or while a zone is drawn the zone (and what is drawn around it) with a margin.
  protected fitBox(): Box {
    const page: Box = { x: 0, y: 0, w: this.doc.page.width, h: this.doc.page.height };
    const index = this.drawZone;
    if (index === null || index === FREE_ZONE || this.wholePage) return page;
    const slot = this.slots[index];
    const parts: Box[] = [];
    if (slot) parts.push({ x: slot.x, y: slot.y, w: slot.width, h: slot.height });
    const drawn = zoneBounds(this.doc.elements, index);
    if (drawn) parts.push(drawn);
    const box = unionBox(parts);
    if (!box) return page;
    const mx = box.w * ZONE_MARGIN;
    const my = box.h * ZONE_MARGIN;
    return { x: box.x - mx, y: box.y - my, w: box.w + 2 * mx, h: box.h + 2 * my };
  }

  // Draws the page, and keeps the slots of its structure (the dotted zones) for the overlay, the magnetism and the double click.
  protected renderSurface(zoom: number): RenderedPage {
    this.slots = this.doc.layout ? buildStructure(this.doc.layout, this.doc.page).slots : [];
    return renderPage(this.doc.page, zoom);
  }

  // Draws the elements of the page. In the structure mode: everything, and the dotted outline of the empty zones unless the eye hid them. While a zone is drawn: the rest of the page,
  // faded and out of reach, then the dotted outline of the zone and what is drawn in it.
  protected drawContent(group: SVGElement): void {
    const options = { lookup: (path: string) => this.api.drawings.lookup(path), showZones: false, background: this.doc.page.background, ink: this.doc.page.ink };
    const elements = this.visibleElements();
    const index = this.drawZone;
    if (index === null) {
      drawElements(elements, group, options);
      if (this.showZones) this.drawEmptyZones(group, elements);
      return;
    }
    const mine = (e: SketchElement): boolean => (index === FREE_ZONE ? e.slot === undefined : e.slot === index) && e.group !== `structure` && e.type !== `drawing`;
    const shown = SketchnoteView.display;
    if (shown.others) {
      const layer = svgEl(`g`, { class: `sketchnote-faded`, opacity: backdropOpacity(shown.fade), "pointer-events": `none` }, group);
      drawElements(elements.filter((e) => !mine(e)), layer, options);
      this.drawEmptyZones(layer, elements, index);
    }
    if (index !== FREE_ZONE) this.drawZoneOutline(group, index);
    drawElements(elements.filter(mine), group, options);
  }

  // Draws the dotted outline of the zones that have nothing in them (except the one that is excluded).
  private drawEmptyZones(parent: Element, elements: SketchElement[], except: number | null = null): void {
    this.slots.forEach((slot, i) => {
      if (i === except || !zoneIsEmpty(elements, i) || elements.some((e) => e.type === `drawing` && e.slot === i)) return;
      this.outline(parent, slot, true);
    });
  }

  // Draws the dotted outline of the zone that is being drawn: a guide, with no fill.
  private drawZoneOutline(parent: Element, index: number): void {
    const slot = this.slots[index];
    if (slot) this.outline(parent, slot, false);
  }

  private outline(parent: Element, slot: Slot, filled: boolean): void {
    const style = slotStyle(this.doc.page.background);
    const look = { class: `sketchnote-frame-empty`, fill: filled ? style.color : `none`, "fill-opacity": style.fillOpacity, stroke: style.color, "stroke-opacity": style.strokeOpacity, "stroke-width": 1.5, "stroke-dasharray": `8 6`, "pointer-events": `none` };
    if (slot.shape === `ellipse`) svgEl(`ellipse`, { cx: slot.x + slot.width / 2, cy: slot.y + slot.height / 2, rx: slot.width / 2, ry: slot.height / 2, ...look }, parent);
    else svgEl(`rect`, { x: slot.x, y: slot.y, width: slot.width, height: slot.height, rx: 6, ...look }, parent);
  }

  protected exportBoxAll(): Box | null {
    return this.doc.elements.length === 0 ? null : { x: 0, y: 0, w: this.doc.page.width, h: this.doc.page.height };
  }

  // The zones are not drawn in an export.
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

  // ---------------------------------------------------------------------------------------------------------------- the two modes

  // In the structure mode only the tools that select and move exist; the tools that draw come with the drawing mode.
  protected creationTools(): CreationTool[] {
    return this.drawZone === null ? [] : super.creationTools();
  }

  protected toolKeys(): Record<string, Tool> {
    return this.drawZone === null ? { v: `select`, h: `hand` } : super.toolKeys();
  }

  // In the structure mode the menu holds the actions on the selection only (group, lock, duplicate, mirror, levels, delete).
  protected sectionAllowed(name: PanelSection): boolean {
    return this.drawZone !== null || name === `organise`;
  }

  // While a zone is drawn only what belongs to it can be touched: the rest of the page is out of reach.
  protected isSelectable(el: SketchElement): boolean {
    const index = this.drawZone;
    if (index === null) return true;
    return (index === FREE_ZONE ? el.slot === undefined : el.slot === index) && el.group !== `structure` && el.type !== `drawing`;
  }

  // A click on a drawing of a zone selects the whole zone, in the structure mode.
  protected expandSelection(ids: Set<string>, doc: SketchnoteDoc = this.doc): Set<string> {
    const grouped = expandToGroups(doc.elements, ids, this.editingGroup);
    return this.drawZone === null ? expandToZones(doc.elements, grouped) : grouped;
  }

  // The classes that show or hide the parts of the interface that belong to a mode.
  private applyMode(): void {
    this.contentEl.toggleClass(`sketchnote-mode-draw`, this.drawZone !== null);
    this.contentEl.toggleClass(`sketchnote-mode-structure`, this.drawZone === null);
  }

  // Enters the drawing mode on a zone: the view zooms on it and the tools appear.
  private enterZone(index: number): void {
    if (this.error !== null || index >= this.slots.length || index < FREE_ZONE) return;
    this.drawZone = index;
    this.wholePage = false;
    this.selected.clear();
    this.editingGroup = null;
    this.activeFn = `select`;
    this.tool = `select`;
    this.applyMode();
    this.renderRail();
    this.renderContent();
    this.fitView();
    this.renderUi();
    this.lastPanel = ``;
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // Leaves the drawing mode: the whole page is shown again.
  private leaveZone(): void {
    if (this.drawZone === null) return;
    this.cancelGesture();
    this.drawZone = null;
    this.wholePage = false;
    this.selected.clear();
    this.editingGroup = null;
    this.tool = `select`;
    this.applyMode();
    this.renderContent();
    this.fitView();
    this.renderUi();
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // Shows the whole page, or the zone again.
  private toggleWhole(): void {
    this.wholePage = !this.wholePage;
    this.fitView();
    this.updateBar();
  }

  // A double click on a drawing of a zone enters the drawing mode of that zone, even when the drawing is grouped; any other element does what it does in the editor (a text is
  // written, a line gets its text).
  protected activateFirst(el: SketchElement): boolean {
    if (this.drawZone !== null || el.slot === undefined || el.type === `drawing`) return false;
    this.enterZone(el.slot);
    return true;
  }

  // A double click on a dotted zone that has nothing in it enters the drawing mode of that zone; anywhere else on the page it enters the drawing mode of the free part of the page.
  protected onBlankDoubleClick(p: [number, number]): void {
    if (this.drawZone !== null) return;
    const index = slotIndexAt(this.slots, p);
    this.enterZone(index >= 0 ? index : FREE_ZONE);
  }

  // Escape with nothing to end leaves the zone.
  protected onEscapeIdle(): void {
    this.leaveZone();
  }

  // ---------------------------------------------------------------------------------------------------------------- bar and menu

  protected selectToolsInBar(): boolean {
    return false;
  }

  // The bottom bar at the start: in the structure mode the settings of the page, the add zone button, the eye that shows or hides the zones, the zen mode, the tools that select and move
  // and the export; in the drawing mode the back button and the button that shows the whole page.
  protected buildBarStart(bar: HTMLElement): void {
    const structure = bar.createDiv({ cls: `sketchnote-structure-buttons` });
    this.button(structure, `menu`, t(`Réglages de la page`), () => this.openPageSettings());
    this.addButton = this.button(structure, `plus`, t(`Ajouter une zone`), () => this.addZone());
    this.zenButton = this.button(structure, `sketchnote-zen`, t(`Mode zen`), () => {
      void this.api.zen.toggle().then(() => this.updateBar());
    });
    this.zonesButton = this.button(structure, `eye`, t(`Masquer les zones`), () => {
      this.showZones = !this.showZones;
      this.renderContent();
      this.updateBar();
    });
    this.toolButton(structure, `select`, `mouse-pointer-2`, t(`Sélectionner`));
    this.toolButton(structure, `hand`, `hand`, t(`Main : déplacer la page`));
    this.button(structure, `download`, t(`Exporter`), () => this.openExport());
    const draw = bar.createDiv({ cls: `sketchnote-draw-buttons` });
    this.button(draw, `arrow-left`, t(`Retour à la structure`), () => this.leaveZone());
    this.wholeButton = this.button(draw, `scan`, t(`Voir toute la page`), () => this.toggleWhole());
  }

  // Keeps the add zone button, the eye and the button of the whole page in step with the structure and the mode.
  protected onSelectionChanged(): void {
    super.onSelectionChanged();
    this.zenButton?.toggleClass(`is-active`, this.api.zen.active());
    const layout = this.doc.layout;
    if (this.addButton) this.addButton.disabled = layout === null || addZone(layout) === null;
    if (this.zonesButton) {
      setIcon(this.zonesButton, this.showZones ? `eye` : `eye-off`);
      const label = this.showZones ? t(`Masquer les zones`) : t(`Afficher les zones`);
      this.zonesButton.setAttribute(`aria-label`, label);
    }
    if (this.wholeButton) {
      const label = this.wholePage ? t(`Revenir à la zone`) : t(`Voir toute la page`);
      this.wholeButton.setAttribute(`aria-label`, label);
      this.wholeButton.toggleClass(`is-active`, this.wholePage);
    }
  }

  // The section of the display of the menu: the rest of the page, shown faded behind the zone, with a slider for the fading.
  protected buildDisplaySection(sec: HTMLElement): void {
    this.sectionIcon(sec, `eye`, t(`Affichage`));
    this.displayBox = sec.createDiv({ cls: `sketchdraw-display-box` });
    this.refreshDisplay();
  }

  protected refreshDisplay(): void {
    const box = this.displayBox;
    if (!box) return;
    box.empty();
    const shown = SketchnoteView.display;
    const row = box.createDiv({ cls: `sketchdraw-row` });
    const own = row.createEl(`button`, { cls: `sketchdraw-chip` });
    setIcon(own, `square`);
    own.setAttribute(`aria-label`, t(`Cette zone seule`));
    const others = row.createEl(`button`, { cls: `sketchdraw-chip` });
    setIcon(others, `layers-2`);
    others.setAttribute(`aria-label`, t(`Avec le reste de la page`));
    (shown.others ? others : own).addClass(`is-active`);
    own.addEventListener(`click`, () => {
      SketchnoteView.display = cleanBackdrop({ ...shown, others: false });
      this.renderContent();
      this.refreshDisplay();
    });
    others.addEventListener(`click`, () => {
      SketchnoteView.display = cleanBackdrop({ ...shown, others: true });
      this.renderContent();
      this.refreshDisplay();
    });
    if (!shown.others) return;
    const slider = box.createEl(`input`, { cls: `sketchdraw-range sketchdraw-display-slider`, type: `range` });
    slider.min = `0`;
    slider.max = String(BACKDROP_MAX_FADE);
    slider.step = `5`;
    slider.value = String(shown.fade);
    slider.setAttribute(`aria-label`, t(`Estompage du reste de la page`));
    slider.addEventListener(`input`, () => {
      SketchnoteView.display = cleanBackdrop({ ...SketchnoteView.display, fade: Number(slider.value) });
      this.renderContent();
    });
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

  // ---------------------------------------------------------------------------------------------------------------- drawings of earlier versions

  // A page of an earlier version holds frames that show drawings kept in notes of their own. They are brought into the page once, at the place and the scale where the frames showed them,
  // each one in its zone: the page then holds everything, and the notes of the drawings stay in the vault as they were. The empty frames of the zones are dropped (a zone is a slot of
  // the structure). A frame whose note cannot be read is left as it is.
  private async inlineFrames(): Promise<void> {
    if (this.migrating || this.error !== null) return;
    const frames = framesToInline(this.doc.elements);
    const empties = this.doc.elements.some((e) => e.type === `drawing` && e.path === null);
    if (frames.length === 0 && !empties) return;
    this.migrating = true;
    try {
      const added: SketchElement[] = [];
      const done = new Set<string>();
      for (const frame of frames as DrawingElement[]) {
        if (frame.path === null) continue;
        await this.api.drawings.load(frame.path);
        const drawing = this.api.drawings.lookup(frame.path);
        if (!drawing) continue;
        added.push(...inlineDrawing(frame, drawing, [...this.doc.elements, ...added]));
        done.add(frame.id);
      }
      const rest = withoutFrames(this.doc.elements, done);
      if (rest.length === this.doc.elements.length && added.length === 0) return;
      // The change is not an edit of the user: it is written without an entry of the history.
      this.doc = this.withElements(this.doc, [...rest, ...added]);
      this.history.clear();
      this.renderAll();
      this.requestSave();
      if (done.size > 0) new Notice(t(`Les dessins de la page sont maintenant dans la page : les anciennes notes de dessin restent dans le coffre.`));
    } catch (e) {
      new Notice(t(`Impossible d'intégrer les dessins à la page : {0}`, e instanceof Error ? e.message : String(e)));
    } finally {
      this.migrating = false;
    }
  }

  // A copy of a zone, or of a drawing of a zone, is free: it does not join the zone of the original.
  protected async adaptClones(copies: SketchElement[]): Promise<SketchElement[]> {
    return copies.map((e) => withZone(e, undefined));
  }

  // The frames that a page of an earlier version still holds (the note of a drawing could not be read), for the drawings that show the page behind them.
  backdropSource(): { frames: DrawingElement[]; background: string; ink: string } | null {
    const frames = this.doc.elements.filter((e): e is DrawingElement => e.type === `drawing` && e.path !== null);
    return frames.length === 0 ? null : { frames, background: this.doc.page.background, ink: this.doc.page.ink };
  }
}
