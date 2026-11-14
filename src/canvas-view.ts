// The engine shared by the view of a page and the view of a drawing: zoom and pan, selection, move, resize, rotate, creation of elements with the tools,
// undo and redo, keyboard shortcuts, and the bottom bar. A subclass says what the document is, how its surface is drawn and which tools it offers.
import { setIcon, TextFileView, WorkspaceLeaf } from "obsidian";
import { newId, SketchElement } from "./elements";
import { Box, boxesIntersect, boxOf, centerOf, elementBounds, hitHandle, hitTop, unionBox } from "./geometry";
import { History } from "./history";
import { t } from "./i18n";
import { RenderedPage } from "./page-render";
import { drawUi } from "./selection-render";
import { cloneElements, moveElements, reorder, removeElements } from "./selection-ops";
import { snapBox } from "./snap";
import { ToolStyle } from "./style";
import { addPenPoint, CREATION_TOOLS, CreationTool, elementFromDrag, penElement, pointElement } from "./tools";
import { normalizeAngle, resizeElement, rotateBy, translate } from "./transform";
import { MAX_FREEDRAW_POINTS } from "./elements";
import { clampZoom, fitZoom, pinchZoom, sliderToZoom, stepZoom, zoomToSlider } from "./viewport";

export type Tool = `select` | `hand` | CreationTool;
export type Point = [number, number];

type Gesture =
  | { kind: `pan`; pointerId: number; lastX: number; lastY: number }
  | { kind: `move`; pointerId: number; start: Point; startClient: Point; ids: Set<string>; box: Box; moved: boolean }
  | { kind: `resize`; pointerId: number; orig: SketchElement; corner: 0 | 1 | 2 | 3; moved: boolean }
  | { kind: `rotate`; pointerId: number; orig: SketchElement; center: Point; startAngle: number; moved: boolean }
  | { kind: `marquee`; pointerId: number; start: Point; current: Point; base: Set<string> }
  | { kind: `create`; pointerId: number; tool: CreationTool; start: Point; pen: Point[]; made: SketchElement | null };

// Elements copied with Copy, shared by every sketchnote and drawing of the session.
let clipboard: SketchElement[] = [];
let pasteCount = 0;

export abstract class CanvasView<D> extends TextFileView {
  protected doc: D;
  protected error: string | null = null;
  protected zoom = 1;
  // True while the content is fitted to the window: it stays fitted when the window or the content changes size.
  protected fitted = true;
  protected tool: Tool = `select`;
  protected toolLocked = false;
  protected spaceDown = false;
  protected selected = new Set<string>();
  protected readonly history = new History<D>(200);
  protected gesture: Gesture | null = null;
  // The document as it was when the current gesture started: it is restored when the gesture is cancelled and stored in the history when it ends.
  protected baseDoc: D | null = null;
  protected guideX: number[] = [];
  protected guideY: number[] = [];
  protected marquee: Box | null = null;
  // The style of new elements. Only a view that offers creation tools sets it.
  protected style: ToolStyle | null = null;

  protected scroller: HTMLElement | null = null;
  protected svg: SVGElement | null = null;
  protected content: SVGElement | null = null;
  protected ui: SVGElement | null = null;
  private zoomLabel: HTMLElement | null = null;
  private zoomSlider: HTMLInputElement | null = null;
  private readonly toolButtons = new Map<Tool, HTMLElement[]>();
  private undoButton: HTMLButtonElement | null = null;
  private redoButton: HTMLButtonElement | null = null;
  private selectionActions: HTMLElement | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch: { distance: number; zoom: number } | null = null;
  private lastClick: { id: string; time: number; x: number; y: number } | null = null;

  // Creates the view inside a workspace leaf, with the document it starts from.
  constructor(leaf: WorkspaceLeaf, initial: D) {
    super(leaf);
    this.doc = initial;
  }

  // ---------------------------------------------------------------------------------------------------------------- what a subclass provides

  protected abstract elementsOf(doc: D): SketchElement[];
  protected abstract withElements(doc: D, elements: SketchElement[]): D;
  protected abstract parseDoc(data: string): { ok: true; doc: D } | { ok: false; error: string };
  protected abstract serializeDoc(doc: D): string;
  protected abstract emptyDoc(): D;
  // Size of the surface in page units.
  protected abstract surfaceSize(): { w: number; h: number };
  // The part of the surface that "fit" brings into view.
  protected abstract fitBox(): Box;
  // Draws the surface (background and groups) at a zoom.
  protected abstract renderSurface(zoom: number): RenderedPage;
  // Draws the elements into their group.
  protected abstract drawContent(group: SVGElement): void;

  // Extra places where a moved element sticks (the slots of a structure).
  protected extraSnapTargets(): Box[] {
    return [];
  }

  // The tools of creation that this view offers.
  protected creationTools(): CreationTool[] {
    return [];
  }

  // Keys that choose a tool.
  protected toolKeys(): Record<string, Tool> {
    return { v: `select`, h: `hand` };
  }

  // Adds the buttons that are specific to the view at the start of the bottom bar.
  protected buildBarStart(_bar: HTMLElement): void {
    void _bar;
  }

  // Tells whether the Select and Hand buttons are in the bottom bar (the drawing view has them in its toolbar instead).
  protected selectToolsInBar(): boolean {
    return true;
  }

  // Adds a column next to the page (the toolbar of the drawing view).
  protected buildSide(_main: HTMLElement): void {
    void _main;
  }

  // Called when the selection or the buttons need to be shown again.
  protected onSelectionChanged(): void {}

  // Called when an element is double clicked (or double tapped) with the selection tool.
  protected onActivate(_el: SketchElement): void {
    void _el;
  }

  // Lets a subclass change copies before they are added (a frame of a drawing needs a copy of its drawing note).
  protected async adaptClones(copies: SketchElement[]): Promise<SketchElement[]> {
    return copies;
  }

  // Called after the elements of the document changed, so that a subclass can follow (for example to load drawings).
  protected onElementsChanged(): void {}

  // Called after a file was read and drawn. By default it does what a change of the elements does.
  protected onLoaded(): void {
    this.onElementsChanged();
  }

  // ---------------------------------------------------------------------------------------------------------------- file

  // Returns the text to write in the file.
  getViewData(): string {
    return this.serializeDoc(this.doc);
  }

  // Receives the text of the file, reads it and draws it. An unreadable file shows its error and is never overwritten by the view.
  setViewData(data: string, clear: boolean): void {
    if (clear) this.clear();
    const result = this.parseDoc(data);
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
    this.onLoaded();
  }

  // Resets the view to an empty document.
  clear(): void {
    this.doc = this.emptyDoc();
    this.error = null;
    this.svg = null;
    this.content = null;
    this.ui = null;
    this.scroller = null;
    this.zoomLabel = null;
    this.zoomSlider = null;
    this.toolButtons.clear();
    this.selected.clear();
    this.history.clear();
    this.contentEl.empty();
  }

  // Fits the content again when the window changes size and it is still fitted.
  onResize(): void {
    if (this.fitted) this.applyFit();
  }

  // ---------------------------------------------------------------------------------------------------------------- frame and bar

  // Builds the frame once: the scrollable surface, the column of the subclass, and the bottom bar.
  protected ensureFrame(): HTMLElement {
    if (this.scroller) return this.scroller;
    const host = this.contentEl;
    host.empty();
    host.addClass(`sketchnote-host`);
    host.tabIndex = 0;
    const main = host.createDiv({ cls: `sketchnote-main` });
    const scroller = main.createDiv({ cls: `sketchnote-scroller` });
    this.buildSide(main);
    this.buildBar(host);
    this.bindPointer(scroller);
    this.bindKeys(host);
    this.scroller = scroller;
    return scroller;
  }

  // Adds a button with an icon to a parent. The label is a tooltip and a name for screen readers.
  protected button(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
    const b = parent.createEl(`button`, { cls: `sketchnote-bar-button` });
    setIcon(b, icon);
    b.setAttribute(`aria-label`, label);
    b.setAttribute(`title`, label);
    b.addEventListener(`click`, onClick);
    return b;
  }

  // Adds a button that chooses a tool; it shows as active while the tool is chosen.
  protected toolButton(parent: HTMLElement, tool: Tool, icon: string, label: string): HTMLButtonElement {
    const b = this.button(parent, icon, label, () => this.setTool(tool));
    this.toolButtons.set(tool, [...(this.toolButtons.get(tool) ?? []), b]);
    return b;
  }

  // Builds the bottom bar: what the subclass adds, the select and hand tools, undo and redo, the zoom, and the actions on the selection.
  private buildBar(host: HTMLElement): void {
    const bar = host.createDiv({ cls: `sketchnote-bar` });
    this.buildBarStart(bar);
    if (this.selectToolsInBar()) {
      this.toolButton(bar, `select`, `mouse-pointer-2`, t(`Sélectionner`));
      this.toolButton(bar, `hand`, `hand`, t(`Main : déplacer la page`));
    }
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
    this.button(bar, `maximize`, t(`Ajuster à la fenêtre`), () => this.fitView());
    this.zoomLabel = bar.createSpan({ cls: `sketchnote-zoom-text` });

    const actions = bar.createDiv({ cls: `sketchnote-selection-actions` });
    this.button(actions, `copy`, t(`Dupliquer`), () => void this.duplicateSelection());
    this.button(actions, `bring-to-front`, t(`Mettre devant`), () => this.reorderSelection(`front`));
    this.button(actions, `send-to-back`, t(`Mettre derrière`), () => this.reorderSelection(`back`));
    this.button(actions, `trash-2`, t(`Supprimer`), () => this.deleteSelection());
    this.selectionActions = actions;
    this.updateBar();
  }

  // Updates the buttons of the bar: active tool, undo and redo availability, and the actions on the selection.
  protected updateBar(): void {
    for (const [tool, list] of this.toolButtons) for (const b of list) b.toggleClass(`is-active`, this.tool === tool);
    if (this.undoButton) this.undoButton.disabled = !this.history.canUndo();
    if (this.redoButton) this.redoButton.disabled = !this.history.canRedo();
    this.selectionActions?.toggleClass(`is-visible`, this.selected.size > 0);
    this.updateCursor();
    this.onSelectionChanged();
  }

  // Chooses the mouse cursor: an open hand when the surface can be dragged, a cross when a tool creates elements.
  private updateCursor(): void {
    const panning = this.spaceDown || this.tool === `hand`;
    this.scroller?.toggleClass(`is-panning`, panning);
    this.scroller?.toggleClass(`is-dragging`, this.gesture?.kind === `pan`);
    this.scroller?.toggleClass(`is-creating`, !panning && this.tool !== `select`);
  }

  // Chooses the active tool.
  protected setTool(tool: Tool): void {
    this.tool = tool;
    this.updateBar();
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing

  // Draws everything again: the surface, the elements and the editor overlay. Used when the surface itself changes.
  protected renderAll(): void {
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
    const rendered = this.renderSurface(this.zoom);
    scroller.appendChild(rendered.svg);
    this.svg = rendered.svg;
    this.content = rendered.content;
    this.ui = rendered.ui;
    this.drawContent(this.content);
    this.showZoom();
    this.renderUi();
    this.updateBar();
    if (this.fitted) this.centerOnFit();
  }

  // Draws the elements again, without touching the surface.
  protected renderContent(): void {
    if (!this.content) return;
    while (this.content.firstChild) this.content.removeChild(this.content.firstChild);
    this.drawContent(this.content);
  }

  // Draws the editor overlay: selection frames and handles, selection rectangle, magnetism guide lines.
  protected renderUi(): void {
    if (!this.ui) return;
    const size = this.surfaceSize();
    drawUi(this.ui, {
      selected: this.elementsOf(this.doc).filter((e) => this.selected.has(e.id)),
      zoom: this.zoom,
      pageWidth: size.w,
      pageHeight: size.h,
      marquee: this.marquee,
      guideX: this.guideX,
      guideY: this.guideY,
    });
  }

  // ---------------------------------------------------------------------------------------------------------------- changes and history

  // Applies a change of the document: stores the previous state for undo, draws, and asks Obsidian to save. A change of the surface redraws everything.
  protected commit(next: D, surfaceChanged = false): void {
    if (next === this.doc) return;
    this.history.push(this.doc);
    this.doc = next;
    this.afterChange(surfaceChanged);
  }

  // Draws after a change of the document and keeps the selection valid.
  protected afterChange(surfaceChanged: boolean): void {
    const ids = new Set(this.elementsOf(this.doc).map((e) => e.id));
    for (const id of [...this.selected]) if (!ids.has(id)) this.selected.delete(id);
    if (surfaceChanged) this.renderAll();
    else {
      this.renderContent();
      this.renderUi();
      this.updateBar();
    }
    this.onElementsChanged();
    this.requestSave();
  }

  // Undoes the last change.
  protected undo(): void {
    this.cancelGesture();
    const previous = this.history.undo(this.doc);
    if (!previous) return;
    this.doc = previous;
    this.afterChange(true);
  }

  // Redoes the last undone change.
  protected redo(): void {
    this.cancelGesture();
    const next = this.history.redo(this.doc);
    if (!next) return;
    this.doc = next;
    this.afterChange(true);
  }

  // Returns the selected elements, in drawing order.
  protected selectedElements(): SketchElement[] {
    return this.elementsOf(this.doc).filter((e) => this.selected.has(e.id));
  }

  // Replaces the elements of the document as one change that can be undone.
  protected commitElements(elements: SketchElement[]): void {
    this.commit(this.withElements(this.doc, elements));
  }

  // Deletes the selected elements.
  protected deleteSelection(): void {
    if (this.selected.size === 0) return;
    this.commitElements(removeElements(this.elementsOf(this.doc), this.selected));
  }

  // Duplicates the selected elements, a little lower and to the right, and selects the copies. Public: the command of the palette calls it.
  async duplicateSelection(): Promise<void> {
    const source = this.selectedElements();
    if (source.length === 0) return;
    await this.pasteElements(source, 20);
  }

  // Adds copies of elements to the page, moved by an offset, and selects them.
  private async pasteElements(source: SketchElement[], offset: number): Promise<void> {
    const copies = await this.adaptClones(cloneElements(this.elementsOf(this.doc), source, offset, offset));
    this.selected = new Set(copies.map((c) => c.id));
    this.commitElements([...this.elementsOf(this.doc), ...copies]);
  }

  // Copies the selected elements into the clipboard of the plugin.
  private copySelection(): void {
    const source = this.selectedElements();
    if (source.length === 0) return;
    clipboard = source;
    pasteCount = 0;
  }

  // Pastes the copied elements, each time a little further.
  private async pasteClipboard(): Promise<void> {
    const source = clipboard.filter((e) => this.acceptsElement(e));
    if (source.length === 0) return;
    pasteCount += 1;
    await this.pasteElements(source, 20 * pasteCount);
  }

  // Tells whether an element can live in this document (a drawing cannot hold a frame of a drawing).
  protected acceptsElement(_el: SketchElement): boolean {
    void _el;
    return true;
  }

  // Brings the selection to the front or sends it to the back.
  protected reorderSelection(where: `front` | `back`): void {
    if (this.selected.size === 0) return;
    this.commitElements(reorder(this.elementsOf(this.doc), this.selected, where));
  }

  // Moves the selection by a distance (arrow keys).
  private nudge(dx: number, dy: number): void {
    if (this.selected.size === 0) return;
    this.commitElements(moveElements(this.elementsOf(this.doc), this.selected, dx, dy));
  }

  // ---------------------------------------------------------------------------------------------------------------- keyboard

  // Binds the keyboard: Space to drag the surface, Delete, Escape, undo and redo, copy and paste, arrows, and the letters of the tools.
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
    const letter = !mod && !e.altKey ? this.toolKeys()[key] : undefined;
    if (key === ` `) {
      this.spaceDown = true;
      this.updateCursor();
    } else if (mod && key === `z`) {
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && key === `y`) this.redo();
    else if (mod && key === `c`) this.copySelection();
    else if (mod && key === `v`) void this.pasteClipboard();
    else if (mod && key === `d`) void this.duplicateSelection();
    else if (mod && key === `a`) {
      this.selected = new Set(this.elementsOf(this.doc).map((x) => x.id));
      this.renderUi();
      this.updateBar();
    } else if (mod && key === `]`) this.reorderSelection(`front`);
    else if (mod && key === `[`) this.reorderSelection(`back`);
    else if (key === `delete` || key === `backspace`) this.deleteSelection();
    else if (key === `escape`) {
      this.cancelGesture();
      this.selected.clear();
      this.tool = `select`;
      this.renderUi();
      this.updateBar();
    } else if (letter) this.setTool(letter);
    else if (key === `arrowleft`) this.nudge(-step, 0);
    else if (key === `arrowright`) this.nudge(step, 0);
    else if (key === `arrowup`) this.nudge(0, -step);
    else if (key === `arrowdown`) this.nudge(0, step);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  // ---------------------------------------------------------------------------------------------------------------- pointer

  // Returns the position of a pointer event on the surface, in page units.
  protected pagePoint(e: PointerEvent | WheelEvent): Point {
    const r = this.svg ? this.svg.getBoundingClientRect() : { left: 0, top: 0 };
    return [(e.clientX - r.left) / this.zoom, (e.clientY - r.top) / this.zoom];
  }

  // Returns the distance in pixels between the first two pointers that touch the surface.
  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  // Binds the pointer: mouse, finger and pen. One pointer acts on the elements or drags the surface; two fingers pinch to zoom; Ctrl or Cmd with the wheel zooms.
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

  // Returns a random seed for the hand drawn look of a new element.
  private newSeed(): number {
    return 1 + Math.floor(Math.random() * 2147483646);
  }

  // Starts a gesture: pan, pinch, create, move, resize, rotate or selection rectangle, depending on the tool, on what is under the pointer and on the keys held.
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
    const p = this.pagePoint(e);
    if (this.tool !== `select` && CREATION_TOOLS.includes(this.tool as CreationTool) && this.creationTools().includes(this.tool as CreationTool)) {
      this.startCreation(e, p);
      return;
    }
    this.startSelection(e, p);
  }

  // Starts the creation of an element with a tool. The Point tool creates its element at once.
  private startCreation(e: PointerEvent, p: Point): void {
    const tool = this.tool as CreationTool;
    this.selected.clear();
    this.gesture = { kind: `create`, pointerId: e.pointerId, tool, start: p, pen: tool === `pen` ? [p] : [], made: null };
    this.updateCreation(this.gesture as Extract<Gesture, { kind: `create` }>, p, e);
  }

  // Builds the element of a creation gesture for the current pointer position and shows it.
  private updateCreation(g: Extract<Gesture, { kind: `create` }>, p: Point, e: { shiftKey: boolean; altKey: boolean }): void {
    if (!this.baseDoc || !this.style) return;
    const base = this.elementsOf(this.baseDoc);
    const id = g.made ? g.made.id : newId(base);
    const seed = g.made && `seed` in g.made && g.made.seed ? g.made.seed : this.newSeed();
    let made: SketchElement | null = null;
    if (g.tool === `pen`) {
      g.pen = addPenPoint(g.pen, p, 1.5 / this.zoom);
      made = penElement(g.pen, this.style, id, seed, MAX_FREEDRAW_POINTS);
    } else if (g.tool === `point`) {
      made = pointElement(p, this.style, id, seed);
    } else {
      made = elementFromDrag(g.tool, g.start, p, { shift: e.shiftKey, alt: e.altKey }, this.style, id, seed);
    }
    g.made = made;
    this.doc = this.withElements(this.baseDoc, made ? [...base, made] : base);
    this.renderContent();
    this.renderUi();
  }

  // Starts a selection gesture: a handle of the selected element, an element to select and move, or the empty surface (rectangle on a mouse, pan on a finger).
  private startSelection(e: PointerEvent, p: Point): void {
    const touch = e.pointerType === `touch`;
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
    const hit = hitTop(this.elementsOf(this.doc), p, (touch ? 12 : 6) / this.zoom);
    if (hit) {
      if (e.shiftKey) {
        if (this.selected.has(hit.id)) this.selected.delete(hit.id);
        else this.selected.add(hit.id);
        this.renderUi();
        this.updateBar();
        return;
      }
      if (!this.selected.has(hit.id)) this.selected = new Set([hit.id]);
      const box = unionBox(this.selectedElements().map(elementBounds));
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

  // Called when a click (a press and a release without any move) ends on an element. The second click of a double click, on the same element, close in time and
  // in place, activates it (opens the drawing of a frame). Any other click is remembered.
  private registerClick(el: SketchElement, e: PointerEvent): void {
    const now = Date.now();
    const last = this.lastClick;
    const same = last !== null && last.id === el.id && now - last.time < 400 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 10;
    this.lastClick = same ? null : { id: el.id, time: now, x: e.clientX, y: e.clientY };
    if (same) this.onActivate(el);
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
    } else if (g.kind === `create`) {
      if (g.tool !== `point`) this.updateCreation(g, p, e);
    } else if (g.kind === `move`) {
      this.dragMove(g, p, e);
    } else if (g.kind === `resize`) {
      g.moved = true;
      this.replaceElement(resizeElement(g.orig, g.corner, p, e.shiftKey));
    } else if (g.kind === `rotate`) {
      g.moved = true;
      let delta = this.angleTo(g.center, p) - g.startAngle;
      if (e.shiftKey) {
        const current = `angle` in g.orig ? (g.orig.angle ?? 0) : 0;
        delta = Math.round((current + delta) / 15) * 15 - current;
      }
      this.replaceElement(rotateBy(g.orig, normalizeAngle(delta)));
    } else if (g.kind === `marquee`) {
      g.current = p;
      this.marquee = { x: Math.min(g.start[0], p[0]), y: Math.min(g.start[1], p[1]), w: Math.abs(p[0] - g.start[0]), h: Math.abs(p[1] - g.start[1]) };
      const inside = this.elementsOf(this.baseDoc).filter((el) => this.marquee && boxesIntersect(this.marquee, elementBounds(el))).map((el) => el.id);
      this.selected = new Set([...g.base, ...inside]);
      this.renderUi();
      this.updateBar();
    }
  }

  // Moves the selected elements with the pointer, with magnetism on the extra targets, the surface and the other elements (the Alt key switches it off).
  private dragMove(g: Extract<Gesture, { kind: `move` }>, p: Point, e: PointerEvent): void {
    if (!this.baseDoc) return;
    if (!g.moved && Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1]) < 3) return;
    g.moved = true;
    let dx = p[0] - g.start[0];
    let dy = p[1] - g.start[1];
    this.guideX = [];
    this.guideY = [];
    const base = this.elementsOf(this.baseDoc);
    if (!e.altKey) {
      const others = base.filter((el) => !g.ids.has(el.id)).map(elementBounds);
      const size = this.surfaceSize();
      const moving: Box = { x: g.box.x + dx, y: g.box.y + dy, w: g.box.w, h: g.box.h };
      const snap = snapBox(moving, [...others, ...this.extraSnapTargets(), { x: 0, y: 0, w: size.w, h: size.h }], 6 / this.zoom);
      dx += snap.dx;
      dy += snap.dy;
      this.guideX = snap.guideX;
      this.guideY = snap.guideY;
    }
    this.doc = this.withElements(this.baseDoc, base.map((el) => (g.ids.has(el.id) ? translate(el, dx, dy) : el)));
    this.renderContent();
    this.renderUi();
  }

  // Replaces one element of the document during a gesture, without recording anything yet.
  private replaceElement(next: SketchElement): void {
    if (!this.baseDoc) return;
    this.doc = this.withElements(this.baseDoc, this.elementsOf(this.baseDoc).map((el) => (el.id === next.id ? next : el)));
    this.renderContent();
    this.renderUi();
  }

  // Ends a gesture: a move, resize, rotation or creation is stored in the history and saved; a selection rectangle just disappears.
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
    if (g.kind === `create`) {
      this.finishCreation(g, base);
      return;
    }
    if ((g.kind === `move` || g.kind === `resize` || g.kind === `rotate`) && g.moved && base) {
      this.history.push(base);
      this.onElementsChanged();
      this.requestSave();
    }
    if (g.kind === `move` && !g.moved && g.ids.size === 1) {
      const clicked = this.elementsOf(this.doc).find((el) => g.ids.has(el.id));
      if (clicked) this.registerClick(clicked, e);
    } else {
      this.lastClick = null;
    }
    this.renderUi();
    this.updateBar();
  }

  // Ends the creation of an element: it is kept and selected, or dropped when it is too small. The tool goes back to Select unless it is locked.
  private finishCreation(g: Extract<Gesture, { kind: `create` }>, base: D | null): void {
    if (base && g.made) {
      this.history.push(base);
      this.selected = new Set([g.made.id]);
      if (!this.toolLocked) this.tool = `select`;
      this.onElementsChanged();
      this.requestSave();
    } else if (base) {
      this.doc = base;
      this.renderContent();
    }
    this.renderUi();
    this.updateBar();
  }

  // Cancels the current gesture and puts back the document as it was when the gesture started.
  protected cancelGesture(): void {
    const had = this.gesture !== null;
    if (this.baseDoc && this.gesture && this.gesture.kind !== `pan` && this.gesture.kind !== `marquee`) this.doc = this.baseDoc;
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

  // Returns the zoom that fits the content in the window, or the current zoom while the window has no size yet.
  private computeFit(): number {
    const s = this.scroller;
    if (!s || s.clientWidth === 0 || s.clientHeight === 0) return this.zoom;
    const b = this.fitBox();
    return fitZoom(b.w, b.h, s.clientWidth, s.clientHeight);
  }

  // Fits the content in the window and keeps it fitted.
  protected fitView(): void {
    this.fitted = true;
    this.applyFit();
  }

  // Applies the zoom that fits the content and puts it in the middle of the window.
  private applyFit(): void {
    this.zoom = this.computeFit();
    this.resizeSvg();
    this.centerOnFit();
  }

  // Scrolls so that the middle of the fit box is in the middle of the window.
  private centerOnFit(): void {
    const s = this.scroller;
    const svg = this.svg;
    if (!s || !svg) return;
    const b = this.fitBox();
    const sr = s.getBoundingClientRect();
    const vr = svg.getBoundingClientRect();
    const left = vr.left - sr.left + s.scrollLeft;
    const top = vr.top - sr.top + s.scrollTop;
    s.scrollLeft = left + (b.x + b.w / 2) * this.zoom - s.clientWidth / 2;
    s.scrollTop = top + (b.y + b.h / 2) * this.zoom - s.clientHeight / 2;
  }

  // Sets a zoom chosen by the user, keeping the centre of the window on the same point.
  protected setZoom(value: number): void {
    const zoom = clampZoom(value);
    const s = this.scroller;
    if (zoom === this.zoom || !s || !this.svg) return;
    const size = this.surfaceSize();
    const oldWidth = size.w * this.zoom;
    const oldHeight = size.h * this.zoom;
    const cx = (s.scrollLeft + s.clientWidth / 2) / oldWidth;
    const cy = (s.scrollTop + s.clientHeight / 2) / oldHeight;
    this.fitted = false;
    this.zoom = zoom;
    this.resizeSvg();
    s.scrollLeft = cx * size.w * zoom - s.clientWidth / 2;
    s.scrollTop = cy * size.h * zoom - s.clientHeight / 2;
  }

  // Gives the surface its size on screen for the current zoom, and draws the overlay again because its handles keep a constant size on screen.
  private resizeSvg(): void {
    if (!this.svg) return;
    const size = this.surfaceSize();
    this.svg.setAttribute(`width`, String(size.w * this.zoom));
    this.svg.setAttribute(`height`, String(size.h * this.zoom));
    this.showZoom();
    this.renderUi();
  }

  // Shows the zoom level in the bottom bar and moves the slider.
  private showZoom(): void {
    if (this.zoomLabel) this.zoomLabel.setText(`${Math.round(this.zoom * 100)} %`);
    if (this.zoomSlider) this.zoomSlider.value = String(zoomToSlider(this.zoom));
  }
}
