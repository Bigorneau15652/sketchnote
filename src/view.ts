// The view that opens a .sketchnote file: the page in a scrollable frame, the selection and editing of elements, and a bar of buttons at the bottom
// (page settings, tools, undo and redo, zoom, and the actions on the selection).
import { setIcon, TextFileView, WorkspaceLeaf } from "obsidian";
import { applySettings, structureEdited } from "./doc-ops";
import { SketchElement } from "./elements";
import { createEmptyDoc, PageSettings, parseSketchnote, serializeSketchnote, SketchnoteDoc } from "./file-format";
import { Box, boxesIntersect, boxOf, centerOf, elementBounds, hitHandle, hitTop, unionBox } from "./geometry";
import { History } from "./history";
import { t } from "./i18n";
import { buildStructure, LayoutSettings, sameLayout } from "./layout";
import { PageModal } from "./page-modal";
import { drawElements, renderPage } from "./page-render";
import { drawUi } from "./selection-render";
import { cloneElements, moveElements, reorder, removeElements } from "./selection-ops";
import { snapBox } from "./snap";
import { normalizeAngle, resizeElement, rotateBy, translate } from "./transform";
import { clampZoom, fitZoom, pinchZoom, sliderToZoom, stepZoom, zoomToSlider } from "./viewport";

export const VIEW_TYPE = `sketchnote-view`;

type Tool = `select` | `hand`;
type Point = [number, number];

type Gesture =
  | { kind: `pan`; pointerId: number; lastX: number; lastY: number }
  | { kind: `move`; pointerId: number; start: Point; startClient: Point; ids: Set<string>; box: Box; moved: boolean }
  | { kind: `resize`; pointerId: number; orig: SketchElement; corner: 0 | 1 | 2 | 3; moved: boolean }
  | { kind: `rotate`; pointerId: number; orig: SketchElement; center: Point; startAngle: number; moved: boolean }
  | { kind: `marquee`; pointerId: number; start: Point; current: Point; base: Set<string> };

// Elements copied with Copy, shared by every sketchnote of the session.
let clipboard: SketchElement[] = [];
let pasteCount = 0;

export class SketchnoteView extends TextFileView {
  private doc: SketchnoteDoc = createEmptyDoc();
  private error: string | null = null;
  private zoom = 1;
  // True while the page is fitted to the window: it stays fitted when the window or the page changes size.
  private fitted = true;
  private tool: Tool = `select`;
  private spaceDown = false;
  private selected = new Set<string>();
  private readonly history = new History<SketchnoteDoc>(200);
  private gesture: Gesture | null = null;
  // The document as it was when the current gesture started: it is restored when the gesture is cancelled and stored in the history when it ends.
  private baseDoc: SketchnoteDoc | null = null;
  private guideX: number[] = [];
  private guideY: number[] = [];
  private marquee: Box | null = null;
  private slotBoxes: Box[] = [];

  private scroller: HTMLElement | null = null;
  private svg: SVGElement | null = null;
  private content: SVGElement | null = null;
  private ui: SVGElement | null = null;
  private zoomLabel: HTMLElement | null = null;
  private zoomSlider: HTMLInputElement | null = null;
  private selectButton: HTMLElement | null = null;
  private handButton: HTMLElement | null = null;
  private undoButton: HTMLButtonElement | null = null;
  private redoButton: HTMLButtonElement | null = null;
  private selectionActions: HTMLElement | null = null;
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
    this.history.clear();
    this.selected.clear();
    this.gesture = null;
    this.renderAll();
  }

  // Resets the view to an empty document.
  clear(): void {
    this.doc = createEmptyDoc();
    this.error = null;
    this.svg = null;
    this.content = null;
    this.ui = null;
    this.scroller = null;
    this.zoomLabel = null;
    this.zoomSlider = null;
    this.selected.clear();
    this.history.clear();
    this.contentEl.empty();
  }

  // Fits the page again when the window changes size and the page is still fitted.
  onResize(): void {
    if (this.fitted) this.applyFit();
  }

  // ---------------------------------------------------------------------------------------------------------------- frame and bar

  // Builds the frame once: the scrollable area that holds the page, and the bottom bar.
  private ensureFrame(): HTMLElement {
    if (this.scroller) return this.scroller;
    const host = this.contentEl;
    host.empty();
    host.addClass(`sketchnote-host`);
    host.tabIndex = 0;
    const scroller = host.createDiv({ cls: `sketchnote-scroller` });
    this.buildBar(host);
    this.bindPointer(scroller);
    this.bindKeys(host);
    this.scroller = scroller;
    return scroller;
  }

  // Adds a button with an icon to a parent. The label is only a tooltip and a name for screen readers.
  private button(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
    const b = parent.createEl(`button`, { cls: `sketchnote-bar-button` });
    setIcon(b, icon);
    b.setAttribute(`aria-label`, label);
    b.setAttribute(`title`, label);
    b.addEventListener(`click`, onClick);
    return b;
  }

  // Builds the bottom bar: page settings, tools, undo and redo, zoom, then the actions on the selection (shown only when something is selected).
  private buildBar(host: HTMLElement): void {
    const bar = host.createDiv({ cls: `sketchnote-bar` });
    const page = bar.createEl(`button`, { cls: `sketchnote-bar-button` });
    setIcon(page.createSpan({ cls: `sketchnote-bar-icon` }), `file-cog`);
    page.createSpan({ cls: `sketchnote-bar-label`, text: t(`Page`) });
    page.setAttribute(`aria-label`, t(`Réglages de la page`));
    page.addEventListener(`click`, () => this.openPageSettings());

    this.selectButton = this.button(bar, `mouse-pointer-2`, t(`Sélectionner`), () => this.setTool(`select`));
    this.handButton = this.button(bar, `hand`, t(`Main : déplacer la page`), () => this.setTool(`hand`));
    this.undoButton = this.button(bar, `undo-2`, t(`Annuler`), () => this.undo());
    this.redoButton = this.button(bar, `redo-2`, t(`Rétablir`), () => this.redo());

    this.button(bar, `zoom-out`, t(`Zoom arrière`), () => this.setZoom(stepZoom(this.zoom, -1)));
    const slider = bar.createEl(`input`, { cls: `sketchnote-zoom-slider`, type: `range` });
    slider.min = `0`;
    slider.max = `100`;
    slider.step = `0.5`;
    slider.setAttribute(`aria-label`, t(`Zoom`));
    slider.addEventListener(`input`, () => this.setZoom(sliderToZoom(Number(slider.value))));
    this.zoomSlider = slider;
    this.button(bar, `zoom-in`, t(`Zoom avant`), () => this.setZoom(stepZoom(this.zoom, 1)));
    const level = bar.createEl(`button`, { cls: `sketchnote-bar-button sketchnote-zoom-level` });
    level.setAttribute(`aria-label`, t(`Ajuster la page à la fenêtre`));
    level.addEventListener(`click`, () => this.fitPage());
    this.zoomLabel = level;

    const actions = bar.createDiv({ cls: `sketchnote-selection-actions` });
    this.button(actions, `copy`, t(`Dupliquer`), () => this.duplicateSelection());
    this.button(actions, `bring-to-front`, t(`Mettre devant`), () => this.reorderSelection(`front`));
    this.button(actions, `send-to-back`, t(`Mettre derrière`), () => this.reorderSelection(`back`));
    this.button(actions, `trash-2`, t(`Supprimer`), () => this.deleteSelection());
    this.selectionActions = actions;
    this.updateBar();
  }

  // Updates the buttons of the bar: active tool, undo and redo availability, and the actions on the selection.
  private updateBar(): void {
    this.selectButton?.toggleClass(`is-active`, this.tool === `select`);
    this.handButton?.toggleClass(`is-active`, this.tool === `hand`);
    if (this.undoButton) this.undoButton.disabled = !this.history.canUndo();
    if (this.redoButton) this.redoButton.disabled = !this.history.canRedo();
    this.selectionActions?.toggleClass(`is-visible`, this.selected.size > 0);
    this.updateCursor();
  }

  // Chooses the mouse cursor: an open hand when the page can be dragged.
  private updateCursor(): void {
    const panning = this.spaceDown || this.tool === `hand`;
    this.scroller?.toggleClass(`is-panning`, panning);
    this.scroller?.toggleClass(`is-dragging`, this.gesture?.kind === `pan`);
  }

  // Chooses the active tool.
  private setTool(tool: Tool): void {
    this.tool = tool;
    this.updateBar();
  }

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

  // ---------------------------------------------------------------------------------------------------------------- drawing

  // Draws everything again: the page, its background and its structure frames, the elements and the editor overlay. Used when the page itself changes.
  private renderAll(): void {
    const scroller = this.ensureFrame();
    this.svg?.remove();
    scroller.querySelector(`.sketchnote-error`)?.remove();
    this.svg = null;
    this.content = null;
    this.ui = null;
    if (this.error !== null) {
      scroller.createDiv({ cls: `sketchnote-error`, text: t(`Ce fichier sketchnote est illisible : {0}`, this.error) });
      this.updateBar();
      return;
    }
    if (this.fitted) this.zoom = this.computeFit();
    const slots = this.doc.layout ? buildStructure(this.doc.layout, this.doc.page).slots : [];
    this.slotBoxes = slots.map((s) => ({ x: s.x, y: s.y, w: s.width, h: s.height }));
    const rendered = renderPage(this.doc.page, this.zoom, this.doc.elements, slots);
    scroller.appendChild(rendered.svg);
    this.svg = rendered.svg;
    this.content = rendered.content;
    this.ui = rendered.ui;
    this.showZoom();
    this.renderUi();
    this.updateBar();
  }

  // Draws the elements again, without touching the background.
  private renderContent(): void {
    if (!this.content) return;
    while (this.content.firstChild) this.content.removeChild(this.content.firstChild);
    drawElements(this.doc.elements, this.content);
  }

  // Draws the editor overlay: selection frames and handles, selection rectangle, magnetism guide lines.
  private renderUi(): void {
    if (!this.ui) return;
    const selected = this.doc.elements.filter((e) => this.selected.has(e.id));
    drawUi(this.ui, {
      selected,
      zoom: this.zoom,
      pageWidth: this.doc.page.width,
      pageHeight: this.doc.page.height,
      marquee: this.marquee,
      guideX: this.guideX,
      guideY: this.guideY,
    });
  }

  // ---------------------------------------------------------------------------------------------------------------- changes and history

  // Applies a change of the document: stores the previous state for undo, draws, and asks Obsidian to save. A change of the page itself redraws everything.
  private commit(next: SketchnoteDoc, pageChanged = false): void {
    if (next === this.doc) return;
    this.history.push(this.doc);
    this.doc = next;
    this.afterChange(pageChanged);
  }

  // Draws after a change of the document and keeps the selection valid.
  private afterChange(pageChanged: boolean): void {
    const ids = new Set(this.doc.elements.map((e) => e.id));
    for (const id of [...this.selected]) if (!ids.has(id)) this.selected.delete(id);
    if (pageChanged) this.renderAll();
    else {
      this.renderContent();
      this.renderUi();
      this.updateBar();
    }
    this.requestSave();
  }

  // Undoes the last change.
  private undo(): void {
    this.cancelGesture();
    const previous = this.history.undo(this.doc);
    if (!previous) return;
    this.doc = previous;
    this.afterChange(true);
  }

  // Redoes the last undone change.
  private redo(): void {
    this.cancelGesture();
    const next = this.history.redo(this.doc);
    if (!next) return;
    this.doc = next;
    this.afterChange(true);
  }

  // Returns the selected elements, in drawing order.
  private selectedElements(): SketchElement[] {
    return this.doc.elements.filter((e) => this.selected.has(e.id));
  }

  // Deletes the selected elements.
  private deleteSelection(): void {
    if (this.selected.size === 0) return;
    this.commit({ ...this.doc, elements: removeElements(this.doc.elements, this.selected) });
  }

  // Duplicates the selected elements, a little lower and to the right, and selects the copies.
  private duplicateSelection(): void {
    const source = this.selectedElements();
    if (source.length === 0) return;
    this.pasteElements(source, 20);
  }

  // Adds copies of elements to the page, moved by an offset, and selects them.
  private pasteElements(source: SketchElement[], offset: number): void {
    const copies = cloneElements(this.doc.elements, source, offset, offset);
    this.selected = new Set(copies.map((c) => c.id));
    this.commit({ ...this.doc, elements: [...this.doc.elements, ...copies] });
  }

  // Copies the selected elements into the clipboard of the plugin.
  private copySelection(): void {
    const source = this.selectedElements();
    if (source.length === 0) return;
    clipboard = source;
    pasteCount = 0;
  }

  // Pastes the copied elements, each time a little further.
  private pasteClipboard(): void {
    if (clipboard.length === 0) return;
    pasteCount += 1;
    this.pasteElements(clipboard, 20 * pasteCount);
  }

  // Brings the selection to the front or sends it to the back.
  private reorderSelection(where: `front` | `back`): void {
    if (this.selected.size === 0) return;
    this.commit({ ...this.doc, elements: reorder(this.doc.elements, this.selected, where) });
  }

  // Moves the selection by a distance (arrow keys).
  private nudge(dx: number, dy: number): void {
    if (this.selected.size === 0) return;
    this.commit({ ...this.doc, elements: moveElements(this.doc.elements, this.selected, dx, dy) });
  }

  // ---------------------------------------------------------------------------------------------------------------- keyboard

  // Binds the keyboard: Space to drag the page, Delete, Escape, undo and redo, copy and paste, arrows.
  private bindKeys(host: HTMLElement): void {
    this.registerDomEvent(host, `pointerdown`, () => host.focus({ preventScroll: true }));
    this.registerDomEvent(host, `blur`, () => {
      this.spaceDown = false;
      this.updateCursor();
    });
    this.registerDomEvent(host, `keyup`, (e: KeyboardEvent) => {
      if (e.key === ` `) {
        this.spaceDown = false;
        this.updateCursor();
      }
    });
    this.registerDomEvent(host, `keydown`, (e: KeyboardEvent) => this.onKeyDown(e));
  }

  // Handles one key press. Returns without doing anything when the key is typed in a field or is not a shortcut of the view.
  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const step = e.shiftKey ? 10 : 1;
    if (key === ` `) {
      this.spaceDown = true;
      this.updateCursor();
    } else if (mod && key === `z`) {
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && key === `y`) this.redo();
    else if (mod && key === `c`) this.copySelection();
    else if (mod && key === `v`) this.pasteClipboard();
    else if (mod && key === `d`) this.duplicateSelection();
    else if (mod && key === `a`) {
      this.selected = new Set(this.doc.elements.map((x) => x.id));
      this.renderUi();
      this.updateBar();
    } else if (mod && key === `]`) this.reorderSelection(`front`);
    else if (mod && key === `[`) this.reorderSelection(`back`);
    else if (key === `delete` || key === `backspace`) this.deleteSelection();
    else if (key === `escape`) {
      this.cancelGesture();
      this.selected.clear();
      this.renderUi();
      this.updateBar();
    } else if (key === `arrowleft`) this.nudge(-step, 0);
    else if (key === `arrowright`) this.nudge(step, 0);
    else if (key === `arrowup`) this.nudge(0, -step);
    else if (key === `arrowdown`) this.nudge(0, step);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  // ---------------------------------------------------------------------------------------------------------------- pointer

  // Returns the position of a pointer event on the page, in page units.
  private pagePoint(e: PointerEvent | WheelEvent): Point {
    const r = this.svg ? this.svg.getBoundingClientRect() : { left: 0, top: 0 };
    return [(e.clientX - r.left) / this.zoom, (e.clientY - r.top) / this.zoom];
  }

  // Returns the distance in pixels between the first two pointers that touch the page.
  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  // Binds the pointer: mouse, finger and pen. One pointer acts on the elements or drags the page; two fingers pinch to zoom; Ctrl or Cmd with the wheel zooms.
  private bindPointer(scroller: HTMLElement): void {
    this.registerDomEvent(scroller, `pointerdown`, (e: PointerEvent) => this.onPointerDown(e));
    this.registerDomEvent(scroller, `pointermove`, (e: PointerEvent) => this.onPointerMove(e));
    this.registerDomEvent(scroller, `pointerup`, (e: PointerEvent) => this.onPointerUp(e));
    this.registerDomEvent(scroller, `pointercancel`, (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.pinch = null;
      this.cancelGesture();
    });
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

  // Starts a gesture: pan, pinch, move, resize, rotate or selection rectangle, depending on what is under the pointer and on the keys held.
  private onPointerDown(e: PointerEvent): void {
    try {
      this.scroller?.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone: nothing to capture.
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      this.cancelGesture();
      this.pinch = { distance: this.pointerDistance(), zoom: this.zoom };
      return;
    }
    if (this.pointers.size > 2 || this.error !== null || !this.svg) return;
    if (e.button !== 0 && e.button !== 1) return;
    this.baseDoc = this.doc;
    if (e.button === 1 || this.spaceDown || this.tool === `hand`) {
      this.gesture = { kind: `pan`, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      this.updateCursor();
      return;
    }
    const touch = e.pointerType === `touch`;
    const p = this.pagePoint(e);
    if (this.selected.size === 1) {
      const el = this.selectedElements()[0];
      const handle = el ? hitHandle(el, p, this.zoom, touch ? 18 : 10) : null;
      if (el && handle) {
        if (handle.kind === `rotate`) {
          const center = centerOf(boxOf(el).box);
          this.gesture = { kind: `rotate`, pointerId: e.pointerId, orig: el, center, startAngle: this.angleTo(center, p), moved: false };
        } else {
          this.gesture = { kind: `resize`, pointerId: e.pointerId, orig: el, corner: handle.corner, moved: false };
        }
        return;
      }
    }
    const hit = hitTop(this.doc.elements, p, (touch ? 12 : 6) / this.zoom);
    if (hit) {
      if (e.shiftKey) {
        if (this.selected.has(hit.id)) this.selected.delete(hit.id);
        else this.selected.add(hit.id);
        this.renderUi();
        this.updateBar();
        return;
      }
      if (!this.selected.has(hit.id)) this.selected = new Set([hit.id]);
      const chosen = this.selectedElements();
      const box = unionBox(chosen.map(elementBounds));
      if (box) this.gesture = { kind: `move`, pointerId: e.pointerId, start: p, startClient: [e.clientX, e.clientY], ids: new Set(this.selected), box, moved: false };
      this.renderUi();
      this.updateBar();
      return;
    }
    const base = e.shiftKey ? new Set(this.selected) : new Set<string>();
    if (!e.shiftKey) this.selected.clear();
    if (touch) this.gesture = { kind: `pan`, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    else this.gesture = { kind: `marquee`, pointerId: e.pointerId, start: p, current: p, base };
    this.renderUi();
    this.updateBar();
  }

  // Returns the angle in degrees of the direction from a centre to a point.
  private angleTo(center: Point, p: Point): number {
    return (Math.atan2(p[1] - center[1], p[0] - center[0]) * 180) / Math.PI;
  }

  // Follows a pointer: pinch, then the current gesture.
  private onPointerMove(e: PointerEvent): void {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.pinch) {
      this.setZoom(pinchZoom(this.pinch.zoom, this.pinch.distance, this.pointerDistance()));
      return;
    }
    const g = this.gesture;
    if (!g || g.pointerId !== e.pointerId || !this.baseDoc) return;
    const p = this.pagePoint(e);
    if (g.kind === `pan` && this.scroller) {
      this.scroller.scrollLeft -= e.clientX - g.lastX;
      this.scroller.scrollTop -= e.clientY - g.lastY;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
    } else if (g.kind === `move`) {
      this.dragMove(g, p, e);
    } else if (g.kind === `resize`) {
      g.moved = true;
      this.replaceElement(resizeElement(g.orig, g.corner, p, e.shiftKey));
    } else if (g.kind === `rotate`) {
      g.moved = true;
      let delta = this.angleTo(g.center, p) - g.startAngle;
      if (e.shiftKey) {
        const current = g.orig.type === `line` || g.orig.type === `arrow` ? 0 : (g.orig.angle ?? 0);
        delta = Math.round((current + delta) / 15) * 15 - current;
      }
      this.replaceElement(rotateBy(g.orig, normalizeAngle(delta)));
    } else if (g.kind === `marquee`) {
      g.current = p;
      this.marquee = { x: Math.min(g.start[0], p[0]), y: Math.min(g.start[1], p[1]), w: Math.abs(p[0] - g.start[0]), h: Math.abs(p[1] - g.start[1]) };
      const inside = this.baseDoc.elements.filter((el) => this.marquee && boxesIntersect(this.marquee, elementBounds(el))).map((el) => el.id);
      this.selected = new Set([...g.base, ...inside]);
      this.renderUi();
      this.updateBar();
    }
  }

  // Moves the selected elements with the pointer, with magnetism on the slots, the page and the other elements (the Alt key switches it off).
  private dragMove(g: Extract<Gesture, { kind: `move` }>, p: Point, e: PointerEvent): void {
    if (!this.baseDoc) return;
    if (!g.moved && Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1]) < 3) return;
    g.moved = true;
    let dx = p[0] - g.start[0];
    let dy = p[1] - g.start[1];
    this.guideX = [];
    this.guideY = [];
    if (!e.altKey) {
      const others = this.baseDoc.elements.filter((el) => !g.ids.has(el.id)).map(elementBounds);
      const page: Box = { x: 0, y: 0, w: this.doc.page.width, h: this.doc.page.height };
      const moving: Box = { x: g.box.x + dx, y: g.box.y + dy, w: g.box.w, h: g.box.h };
      const snap = snapBox(moving, [...others, ...this.slotBoxes, page], 6 / this.zoom);
      dx += snap.dx;
      dy += snap.dy;
      this.guideX = snap.guideX;
      this.guideY = snap.guideY;
    }
    this.doc = { ...this.baseDoc, elements: this.baseDoc.elements.map((el) => (g.ids.has(el.id) ? translate(el, dx, dy) : el)) };
    this.renderContent();
    this.renderUi();
  }

  // Replaces one element of the document during a gesture, without recording anything yet.
  private replaceElement(next: SketchElement): void {
    if (!this.baseDoc) return;
    this.doc = { ...this.baseDoc, elements: this.baseDoc.elements.map((el) => (el.id === next.id ? next : el)) };
    this.renderContent();
    this.renderUi();
  }

  // Ends a gesture: a move, resize or rotation is stored in the history and saved; a selection rectangle just disappears.
  private onPointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const g = this.gesture;
    if (!g || g.pointerId !== e.pointerId) return;
    this.gesture = null;
    this.guideX = [];
    this.guideY = [];
    this.marquee = null;
    const base = this.baseDoc;
    this.baseDoc = null;
    if ((g.kind === `move` || g.kind === `resize` || g.kind === `rotate`) && g.moved && base) {
      this.history.push(base);
      this.requestSave();
    }
    this.renderUi();
    this.updateBar();
  }

  // Cancels the current gesture and puts back the document as it was when the gesture started.
  private cancelGesture(): void {
    const had = this.gesture !== null;
    if (this.baseDoc && this.gesture && (this.gesture.kind === `move` || this.gesture.kind === `resize` || this.gesture.kind === `rotate`)) this.doc = this.baseDoc;
    this.gesture = null;
    this.baseDoc = null;
    this.guideX = [];
    this.guideY = [];
    this.marquee = null;
    if (had) {
      this.renderContent();
      this.renderUi();
      this.updateBar();
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- zoom

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

  // Gives the page its size on screen for the current zoom, and draws the overlay again because its handles keep a constant size on screen.
  private resizeSvg(): void {
    if (!this.svg) return;
    this.svg.setAttribute(`width`, String(this.doc.page.width * this.zoom));
    this.svg.setAttribute(`height`, String(this.doc.page.height * this.zoom));
    this.showZoom();
    this.renderUi();
  }

  // Shows the zoom level in the bottom bar and moves the slider.
  private showZoom(): void {
    if (this.zoomLabel) this.zoomLabel.setText(`${Math.round(this.zoom * 100)} %`);
    if (this.zoomSlider) this.zoomSlider.value = String(zoomToSlider(this.zoom));
  }
}
