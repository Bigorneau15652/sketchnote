// The view that opens a .sketchnote file: the page in a scrollable frame, and a bar of buttons at the bottom (page settings and zoom).
import { setIcon, TextFileView, WorkspaceLeaf } from "obsidian";
import { applySettings } from "./doc-ops";
import { createEmptyDoc, parseSketchnote, serializeSketchnote, SketchnoteDoc } from "./file-format";
import { t } from "./i18n";
import { buildStructure, LayoutSettings } from "./layout";
import { PageSettings } from "./file-format";
import { PageModal } from "./page-modal";
import { renderPage } from "./page-render";
import { clampZoom, fitZoom, pinchZoom, stepZoom } from "./viewport";

export const VIEW_TYPE = `sketchnote-view`;

export class SketchnoteView extends TextFileView {
  private doc: SketchnoteDoc = createEmptyDoc();
  private error: string | null = null;
  private zoom = 1;
  // True while the page is fitted to the window: it stays fitted when the window or the page changes size.
  private fitted = true;
  private scroller: HTMLElement | null = null;
  private svg: SVGElement | null = null;
  private zoomLabel: HTMLElement | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch: { distance: number; zoom: number } | null = null;

  // Creates the view inside a workspace leaf.
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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

  // Returns the text to write in the file.
  getViewData(): string {
    return serializeSketchnote(this.doc);
  }

  // Receives the text of the file, reads it and draws the page. An unreadable file shows its error and is never overwritten by the view.
  setViewData(data: string, clear: boolean): void {
    if (clear) this.clear();
    const result = parseSketchnote(data);
    if (result.ok) {
      this.doc = result.doc;
      this.error = null;
      this.fitted = true;
    } else {
      this.error = result.error;
    }
    this.render();
  }

  // Resets the view to an empty document.
  clear(): void {
    this.doc = createEmptyDoc();
    this.error = null;
    this.svg = null;
    this.scroller = null;
    this.zoomLabel = null;
    this.contentEl.empty();
  }

  // Fits the page again when the window changes size and the page is still fitted.
  onResize(): void {
    if (this.fitted) this.applyFit();
  }

  // Builds the frame once: the scrollable area that holds the page, and the bottom bar.
  private ensureFrame(): HTMLElement {
    if (this.scroller) return this.scroller;
    const host = this.contentEl;
    host.empty();
    host.addClass(`sketchnote-host`);
    const scroller = host.createDiv({ cls: `sketchnote-scroller` });
    this.buildBar(host);
    this.bindGestures(scroller);
    this.scroller = scroller;
    return scroller;
  }

  // Builds the bottom bar: page settings, zoom out, zoom level (a click fits the page), zoom in.
  private buildBar(host: HTMLElement): void {
    const bar = host.createDiv({ cls: `sketchnote-bar` });
    const page = bar.createEl(`button`, { cls: `sketchnote-bar-button` });
    setIcon(page.createSpan({ cls: `sketchnote-bar-icon` }), `file-cog`);
    page.createSpan({ cls: `sketchnote-bar-label`, text: t(`Page`) });
    page.setAttribute(`aria-label`, t(`Réglages de la page`));
    page.addEventListener(`click`, () => this.openPageSettings());

    const out = bar.createEl(`button`, { cls: `sketchnote-bar-button` });
    setIcon(out, `zoom-out`);
    out.setAttribute(`aria-label`, t(`Zoom arrière`));
    out.addEventListener(`click`, () => this.setZoom(stepZoom(this.zoom, -1)));

    const level = bar.createEl(`button`, { cls: `sketchnote-bar-button sketchnote-zoom-level` });
    level.setAttribute(`aria-label`, t(`Ajuster la page à la fenêtre`));
    level.addEventListener(`click`, () => this.fitPage());
    this.zoomLabel = level;

    const zin = bar.createEl(`button`, { cls: `sketchnote-bar-button` });
    setIcon(zin, `zoom-in`);
    zin.setAttribute(`aria-label`, t(`Zoom avant`));
    zin.addEventListener(`click`, () => this.setZoom(stepZoom(this.zoom, 1)));
  }

  // Binds the pointer gestures: one finger or the mouse drags the page, two fingers pinch to zoom, Ctrl or Cmd with the wheel zooms.
  private bindGestures(scroller: HTMLElement): void {
    this.registerDomEvent(scroller, `pointerdown`, (e: PointerEvent) => {
      try {
        scroller.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone: nothing to capture.
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pinch = this.pointers.size === 2 ? { distance: this.pointerDistance(), zoom: this.zoom } : null;
    });
    this.registerDomEvent(scroller, `pointermove`, (e: PointerEvent) => {
      const previous = this.pointers.get(e.pointerId);
      if (!previous) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        scroller.scrollLeft -= e.clientX - previous.x;
        scroller.scrollTop -= e.clientY - previous.y;
      } else if (this.pointers.size === 2 && this.pinch) {
        this.setZoom(pinchZoom(this.pinch.zoom, this.pinch.distance, this.pointerDistance()));
      }
    });
    const release = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
      this.pinch = null;
    };
    this.registerDomEvent(scroller, `pointerup`, release);
    this.registerDomEvent(scroller, `pointercancel`, release);
    this.registerDomEvent(
      scroller,
      `wheel`,
      (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        this.setZoom(stepZoom(this.zoom, e.deltaY < 0 ? 1 : -1));
      },
      { passive: false },
    );
  }

  // Returns the distance in pixels between the first two pointers that touch the page.
  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  // Opens the window of page settings.
  private openPageSettings(): void {
    new PageModal(this.app, this.doc.page, this.doc.layout, (page, layout) => this.updatePage(page, layout)).open();
  }

  // Stores new page settings and structure, draws the page again and asks Obsidian to save the file.
  private updatePage(page: PageSettings, layout: LayoutSettings | null): void {
    this.doc = applySettings(this.doc, page, layout);
    this.render();
    this.requestSave();
  }

  // Draws the page, or the error message when the file cannot be read.
  private render(): void {
    const scroller = this.ensureFrame();
    this.svg?.remove();
    scroller.querySelector(`.sketchnote-error`)?.remove();
    this.svg = null;
    if (this.error !== null) {
      scroller.createDiv({ cls: `sketchnote-error`, text: t(`Ce fichier sketchnote est illisible : {0}`, this.error) });
      return;
    }
    if (this.fitted) this.zoom = this.computeFit();
    const slots = this.doc.layout ? buildStructure(this.doc.layout, this.doc.page).slots : [];
    const { svg } = renderPage(this.doc.page, this.zoom, this.doc.elements, slots);
    scroller.appendChild(svg);
    this.svg = svg;
    this.showZoom();
  }

  // Returns the zoom that fits the page in the window, or the current zoom while the window has no size yet.
  private computeFit(): number {
    const s = this.scroller;
    if (!s || s.clientWidth === 0 || s.clientHeight === 0) return this.zoom;
    return fitZoom(this.doc.page.width, this.doc.page.height, s.clientWidth, s.clientHeight);
  }

  // Fits the page in the window and keeps it fitted.
  private fitPage(): void {
    this.fitted = true;
    this.applyFit();
  }

  // Applies the zoom that fits the page.
  private applyFit(): void {
    this.zoom = this.computeFit();
    this.resizeSvg();
    if (this.scroller) {
      this.scroller.scrollLeft = 0;
      this.scroller.scrollTop = 0;
    }
  }

  // Sets a zoom chosen by the user, keeping the centre of the window on the same point of the page.
  private setZoom(value: number): void {
    const zoom = clampZoom(value);
    const s = this.scroller;
    if (zoom === this.zoom || !s || !this.svg) return;
    const oldWidth = this.doc.page.width * this.zoom;
    const oldHeight = this.doc.page.height * this.zoom;
    const cx = (s.scrollLeft + s.clientWidth / 2) / oldWidth;
    const cy = (s.scrollTop + s.clientHeight / 2) / oldHeight;
    this.fitted = false;
    this.zoom = zoom;
    this.resizeSvg();
    s.scrollLeft = cx * this.doc.page.width * zoom - s.clientWidth / 2;
    s.scrollTop = cy * this.doc.page.height * zoom - s.clientHeight / 2;
  }

  // Gives the page its size on screen for the current zoom.
  private resizeSvg(): void {
    if (!this.svg) return;
    this.svg.setAttribute(`width`, String(this.doc.page.width * this.zoom));
    this.svg.setAttribute(`height`, String(this.doc.page.height * this.zoom));
    this.showZoom();
  }

  // Shows the zoom level in the bottom bar.
  private showZoom(): void {
    if (this.zoomLabel) this.zoomLabel.setText(`${Math.round(this.zoom * 100)} %`);
  }
}
