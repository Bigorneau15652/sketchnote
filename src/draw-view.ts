// The view that opens a .sketchdraw file: a drawing kept in its own note.
import { setIcon, WorkspaceLeaf } from "obsidian";
import { DrawEditor } from "./draw-editor";
import { backdropOpacity, BACKDROP_MAX_FADE, BackdropSettings, cleanBackdrop, DEFAULT_BACKDROP, pageToDrawing } from "./backdrop";
import { CANVAS_HEIGHT, CANVAS_WIDTH, contentBox, createEmptyDrawing, guideBox, parseSketchdraw, serializeSketchdraw, SketchdrawDoc } from "./drawing-file";
import { drawElement, drawElements, PLAIN } from "./element-render";
import { DrawingElement, SketchElement } from "./elements";
import { Box, unionBox as unionBoxes } from "./geometry";
import { brightness } from "./page-background";
import { t } from "./i18n";
import { elementsBox } from "./export-plan";
import type { ExportServices } from "./export-service";
import { PluginApi } from "./plugin-api";
import { renderCanvas, RenderedPage } from "./page-render";
import { svgEl } from "./svg";
import { SketchnoteView, VIEW_TYPE as PAGE_VIEW_TYPE } from "./view";

export const DRAW_VIEW_TYPE = `sketchdraw-view`;

// The view that opens a .sketchdraw file: a drawing kept in its own note. All the editing (tools, menus, properties) is in DrawEditor; this class is the surface of a drawing note: its
// canvas, its guide, the drawings of the page shown faded behind it, and the way back to the page.
export class SketchdrawView extends DrawEditor<SketchdrawDoc> {
  constructor(leaf: WorkspaceLeaf, api: PluginApi) {
    super(leaf, api, createEmptyDrawing());
  }

  protected inkOf(): string {
    return this.doc.ink;
  }

  protected paletteOf(): string[] {
    return this.doc.palette;
  }

  // Returns the identifier of the view type.
  getViewType(): string {
    return DRAW_VIEW_TYPE;
  }

  // Returns the title shown in the tab.
  getDisplayText(): string {
    return this.file ? this.file.basename : t(`Nouveau dessin`);
  }

  // Returns the icon shown in the tab.
  getIcon(): string {
    return `pen-tool`;
  }


  protected elementsOf(doc: SketchdrawDoc): SketchElement[] {
    return doc.elements;
  }

  protected withElements(doc: SketchdrawDoc, elements: SketchElement[]): SketchdrawDoc {
    return { ...doc, elements };
  }

  protected parseDoc(data: string): { ok: true; doc: SketchdrawDoc } | { ok: false; error: string } {
    return parseSketchdraw(data);
  }

  protected serializeDoc(doc: SketchdrawDoc): string {
    return serializeSketchdraw(doc);
  }

  protected emptyDoc(): SketchdrawDoc {
    return createEmptyDrawing();
  }

  protected surfaceSize(): { w: number; h: number } {
    return { w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
  }

  // The part of the surface that fit shows: the guide of the zone (or the middle of the surface) and the drawing, with a margin, at least 1000 by 700 on a large window.
  protected fitBox(): Box {
    const content = contentBox(this.doc, 40);
    const g = this.doc.guide ? guideBox(this.doc.guide) : null;
    const guide = g ? { x: g.x - 60, y: g.y - 60, w: g.w + 120, h: g.h + 120 } : null;
    const parts = [content, guide].filter((b): b is Box => b !== null);
    const b = parts.length === 0 ? { x: CANVAS_WIDTH / 2 - 500, y: CANVAS_HEIGHT / 2 - 350, w: 1000, h: 700 } : unionBoxes(parts) as Box;
    // On a narrow window (a phone) the area shown is smaller, so that the drawing does not start at a tiny zoom.
    const s = this.scroller;
    const minW = s && s.clientWidth > 0 ? Math.min(1000, Math.max(320, s.clientWidth / 0.6)) : 1000;
    const minH = s && s.clientHeight > 0 ? Math.min(700, Math.max(220, s.clientHeight / 0.6)) : 700;
    const w = Math.max(b.w, minW);
    const h = Math.max(b.h, minH);
    return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
  }

  // The surface is dark when the ink is light, so that a white drawing made for a chalkboard stays visible.
  protected renderSurface(zoom: number): RenderedPage {
    return renderCanvas(CANVAS_WIDTH, CANVAS_HEIGHT, zoom, brightness(this.doc.ink) > 0.5, this.doc.guide ?? null);
  }

  protected drawContent(group: SVGElement): void {
    this.drawBackdrop(group);
    drawElements(this.visibleElements(), group, { ...PLAIN, ink: this.doc.ink });
  }

  // The display of the drawings, kept while the application runs and shared by the drawings that are open.
  private static display: BackdropSettings = { ...DEFAULT_BACKDROP };

  // Returns what shows the other drawings of the page behind this one: the frames of the page, and the transform that carries the page into this drawing. Null when this drawing was not
  // opened from a page, or when the page has no other drawing, or when the drawing has no guide (it was not made from a zone).
  private backdropPlan(): { frames: DrawingElement[]; transform: string; background: string; ink: string } | null {
    const path = this.file ? this.file.path : null;
    const origin = path ? this.api.origins.get(path) : undefined;
    const view = origin ? origin.view : null;
    if (!path || !(view instanceof SketchnoteView) || !this.doc.guide) return null;
    const source = view.backdropSource();
    const own = source ? source.frames.find((f) => f.path === path) : undefined;
    if (!source || !own) return null;
    const transform = pageToDrawing({ x: own.x, y: own.y, w: own.width, h: own.height }, guideBox(this.doc.guide));
    const frames = source.frames.filter((f) => f.path !== path);
    return transform && frames.length > 0 ? { frames, transform, background: source.background, ink: source.ink } : null;
  }

  // Draws the other drawings of the page under the elements of this one, faded and out of reach (they belong to other zones, which are not being edited).
  private drawBackdrop(group: SVGElement): void {
    if (!SketchdrawView.display.others) return;
    const plan = this.backdropPlan();
    if (!plan) return;
    const layer = svgEl(`g`, { class: `sketchdraw-backdrop`, transform: plan.transform, opacity: backdropOpacity(SketchdrawView.display.fade), "pointer-events": `none` }, group);
    for (const frame of plan.frames) {
      try {
        drawElement(frame, layer, { lookup: (p) => this.api.drawings.lookup(p), showZones: false, background: plan.background, ink: plan.ink });
      } catch {
        // A drawing that cannot be drawn is left out: the others stay.
      }
    }
  }

  // The section of the display of the drawing: this drawing alone, or with the other drawings of the page faded behind it, with a slider for the fading.
  private displayBox: HTMLElement | null = null;

  protected buildDisplaySection(sec: HTMLElement): void {
    this.sectionIcon(sec, `eye`, t(`Affichage`));
    this.displayBox = sec.createDiv({ cls: `sketchdraw-display-box` });
    this.refreshDisplay();
  }

  // Draws the choices of the display again (the other drawings are only available for a drawing opened from a zone of a page that holds others).
  protected refreshDisplay(): void {
    const box = this.displayBox;
    if (!box) return;
    box.empty();
    const available = this.backdropPlan() !== null;
    const shown = SketchdrawView.display;
    const row = box.createDiv({ cls: `sketchdraw-row` });
    const own = row.createEl(`button`, { cls: `sketchdraw-chip` });
    setIcon(own, `square`);
    own.setAttribute(`aria-label`, t(`Ce dessin seul`));
    const others = row.createEl(`button`, { cls: `sketchdraw-chip` });
    setIcon(others, `layers-2`);
    others.setAttribute(`aria-label`, t(`Avec les autres dessins`));
    (shown.others && available ? others : own).addClass(`is-active`);
    own.addEventListener(`click`, () => {
      SketchdrawView.display = cleanBackdrop({ ...shown, others: false });
      this.renderContent();
      this.refreshDisplay();
    });
    others.disabled = !available;
    others.addEventListener(`click`, () => {
      SketchdrawView.display = cleanBackdrop({ ...shown, others: true });
      this.renderContent();
      this.refreshDisplay();
    });
    if (!available) {
      box.createDiv({ cls: `sketchnote-icons-info`, text: t(`Les autres dessins ne sont disponibles que pour un dessin ouvert depuis une zone d'une page qui en contient d'autres.`) });
      return;
    }
    if (!shown.others) return;
    const slider = box.createEl(`input`, { cls: `sketchdraw-range sketchdraw-display-slider`, type: `range` });
    slider.min = `0`;
    slider.max = String(BACKDROP_MAX_FADE);
    slider.step = `5`;
    slider.value = String(shown.fade);
    slider.setAttribute(`aria-label`, t(`Estompage des autres dessins`));
    slider.addEventListener(`input`, () => {
      SketchdrawView.display = cleanBackdrop({ ...SketchdrawView.display, fade: Number(slider.value) });
      this.renderContent();
    });
  }

  protected exportBoxAll(): Box | null {
    return elementsBox(this.doc.elements);
  }

  protected drawExport(list: SketchElement[], group: SVGElement): void {
    drawElements(list, group, { ...PLAIN, ink: this.doc.ink });
  }

  protected exportPartName(): string {
    return t(`Dessin`);
  }

  protected exportServices(): ExportServices {
    return this.api.exports;
  }

  // Adds the Back button at the start of the bottom bar.
  protected buildBarStart(bar: HTMLElement): void {
    this.button(bar, `arrow-left`, t(`Retour au sketchnote`), () => void this.goBack());
  }

  // Saves the drawing, closes its tab and goes back to the tab of the page it was opened from.
  private async goBack(): Promise<void> {
    await this.save();
    const origin = this.file ? this.api.origins.get(this.file.path) : undefined;
    this.leaf.detach();
    if (origin && this.app.workspace.getLeavesOfType(PAGE_VIEW_TYPE).includes(origin)) this.app.workspace.setActiveLeaf(origin, { focus: true });
  }

  // Keeps the swatches of the drawing when an undo or a redo brings back an older state of its elements.
  protected restoreFrom(restored: SketchdrawDoc, current: SketchdrawDoc): SketchdrawDoc {
    return { ...restored, palette: current.palette, ...(current.fillPalette ? { fillPalette: current.fillPalette } : {}) };
  }
}
