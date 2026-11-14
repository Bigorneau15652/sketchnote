// The view that opens a .sketchdraw file: a drawing kept in its own note. A toolbar on the right holds the tools and the properties of the lines and fills;
// the engine (zoom, selection, undo...) is in CanvasView.
import { setIcon, WorkspaceLeaf } from "obsidian";
import { CanvasView, Tool } from "./canvas-view";
import { toHex6 } from "./page-background";
import { CANVAS_HEIGHT, CANVAS_WIDTH, contentBox, createEmptyDrawing, parseSketchdraw, serializeSketchdraw, SketchdrawDoc } from "./drawing-file";
import { drawElements } from "./element-render";
import { SketchElement } from "./elements";
import { Box } from "./geometry";
import { brightness } from "./page-background";
import { t } from "./i18n";
import { PluginApi } from "./plugin-api";
import { renderCanvas, RenderedPage } from "./page-render";
import { applyStyleToIds, cleanPatch, defaultStyle, MAX_WIDTH, MIN_WIDTH, StylePatch, STROKE_WIDTHS, styleOf, ToolStyle } from "./style";
import { CreationTool } from "./tools";
import { VIEW_TYPE as PAGE_VIEW_TYPE } from "./view";

export const DRAW_VIEW_TYPE = `sketchdraw-view`;

export class SketchdrawView extends CanvasView<SketchdrawDoc> {
  private readonly api: PluginApi;
  private props: HTMLElement | null = null;
  private lastPanel = ``;
  private readonly strokeSwatches: HTMLElement[] = [];
  private readonly fillSwatches: HTMLElement[] = [];
  private readonly panelButtons: { el: HTMLElement; test: (s: ToolStyle) => boolean }[] = [];
  private widthInput: HTMLInputElement | null = null;
  private strokeColor: HTMLInputElement | null = null;
  private fillColor: HTMLInputElement | null = null;
  private lockButton: HTMLElement | null = null;

  // Creates the view inside a workspace leaf, with the services of the plugin.
  constructor(leaf: WorkspaceLeaf, api: PluginApi) {
    super(leaf, createEmptyDrawing());
    this.api = api;
    this.style = defaultStyle(`#000000`);
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

  // Reads the drawing, then takes its ink as the colour of new lines and offers its palette.
  setViewData(data: string, clear: boolean): void {
    super.setViewData(data, clear);
    this.style = defaultStyle(this.doc.ink);
    this.lastPanel = ``;
    this.refreshSwatches();
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------------------------------------------- what the engine asks

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

  // The part of the surface that fit shows: the drawing with a margin, at least 1000 by 700, or the middle of the surface when the drawing is empty.
  protected fitBox(): Box {
    const b = contentBox(this.doc, 40);
    // On a narrow window (a phone) the area shown is smaller, so that the drawing does not start at a tiny zoom.
    const s = this.scroller;
    const minW = s && s.clientWidth > 0 ? Math.min(1000, Math.max(320, s.clientWidth / 0.6)) : 1000;
    const minH = s && s.clientHeight > 0 ? Math.min(700, Math.max(220, s.clientHeight / 0.6)) : 700;
    if (!b) return { x: CANVAS_WIDTH / 2 - minW / 2, y: CANVAS_HEIGHT / 2 - minH / 2, w: minW, h: minH };
    const w = Math.max(b.w, minW);
    const h = Math.max(b.h, minH);
    return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
  }

  // The surface is dark when the ink is light, so that a white drawing made for a chalkboard stays visible.
  protected renderSurface(zoom: number): RenderedPage {
    return renderCanvas(CANVAS_WIDTH, CANVAS_HEIGHT, zoom, brightness(this.doc.ink) > 0.5);
  }

  protected drawContent(group: SVGElement): void {
    drawElements(this.doc.elements, group, null);
  }

  protected creationTools(): CreationTool[] {
    return [`rect`, `diamond`, `ellipse`, `arrow`, `line`, `pen`, `point`];
  }

  protected toolKeys(): Record<string, Tool> {
    return { v: `select`, h: `hand`, r: `rect`, d: `diamond`, o: `ellipse`, a: `arrow`, l: `line`, p: `pen`, [`.`]: `point` };
  }

  // A drawing cannot hold a frame of a drawing.
  protected acceptsElement(el: SketchElement): boolean {
    return el.type !== `drawing`;
  }

  // The Select and Hand buttons are in the toolbar of the right side.
  protected selectToolsInBar(): boolean {
    return false;
  }

  // After an edit the view stays where the user is: it is not fitted again.
  protected onElementsChanged(): void {
    this.fitted = false;
  }

  // Loading a file is not an edit: the drawing is still fitted to the window, and centred, until the user moves or draws.
  protected onLoaded(): void {}

  // ---------------------------------------------------------------------------------------------------------------- bar and toolbar

  // Adds the Back button at the start of the bottom bar.
  protected buildBarStart(bar: HTMLElement): void {
    const back = bar.createEl(`button`, { cls: `sketchnote-bar-button` });
    setIcon(back.createSpan({ cls: `sketchnote-bar-icon` }), `arrow-left`);
    back.createSpan({ cls: `sketchnote-bar-label`, text: t(`Retour`) });
    back.setAttribute(`aria-label`, t(`Retour au sketchnote`));
    back.addEventListener(`click`, () => void this.goBack());
  }

  // Saves the drawing, closes its tab and goes back to the tab of the page it was opened from.
  private async goBack(): Promise<void> {
    await this.save();
    const origin = this.file ? this.api.origins.get(this.file.path) : undefined;
    this.leaf.detach();
    if (origin && this.app.workspace.getLeavesOfType(PAGE_VIEW_TYPE).includes(origin)) this.app.workspace.setActiveLeaf(origin, { focus: true });
  }

  // Builds the toolbar on the right: the tools, then the properties of the lines and fills.
  protected buildSide(main: HTMLElement): void {
    const side = main.createDiv({ cls: `sketchdraw-side` });
    const tools = side.createDiv({ cls: `sketchdraw-tools` });
    this.toolButton(tools, `select`, `mouse-pointer-2`, t(`Sélectionner`));
    this.toolButton(tools, `hand`, `hand`, t(`Main : déplacer la page`));
    this.toolButton(tools, `rect`, `square`, t(`Rectangle`));
    this.toolButton(tools, `diamond`, `diamond`, t(`Losange`));
    this.toolButton(tools, `ellipse`, `circle`, t(`Ellipse`));
    this.toolButton(tools, `arrow`, `arrow-right`, t(`Flèche`));
    this.toolButton(tools, `line`, `minus`, t(`Trait`));
    this.toolButton(tools, `pen`, `pencil`, t(`Stylo libre`));
    this.toolButton(tools, `point`, `dot`, t(`Point`));
    const lock = this.button(tools, `unlock`, t(`Garder l'outil actif après chaque tracé`), () => {
      this.toolLocked = !this.toolLocked;
      setIcon(lock, this.toolLocked ? `lock` : `unlock`);
      lock.toggleClass(`is-active`, this.toolLocked);
    });
    this.lockButton = lock;
    const toggle = this.button(tools, `sliders-horizontal`, t(`Propriétés`), () => this.props?.toggleClass(`is-open`, !this.props.classList.contains(`is-open`)));
    toggle.addClass(`sketchdraw-props-toggle`);

    const props = side.createDiv({ cls: `sketchdraw-props` });
    this.props = props;
    this.buildProps(props);
  }

  // Builds the properties panel: stroke colour, fill, width and style.
  private buildProps(props: HTMLElement): void {
    this.panelButtons.length = 0;
    this.section(props, t(`Trait`));
    const strokeRow = props.createDiv({ cls: `sketchdraw-swatches` });
    this.strokeSwatches.length = 0;
    this.strokeColor = this.colorInput(props, (c) => this.change({ stroke: c }));
    this.fillSwatches.length = 0;

    this.section(props, t(`Remplissage`));
    const fillKinds = props.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(fillKinds, t(`Aucun`), (s) => s.fill === null, () => this.change({ fill: null }));
    this.panelButton(fillKinds, t(`Uni`), (s) => s.fill !== null && s.fillStyle === `solid`, () => this.change({ fill: this.style?.fill ?? this.doc.palette[1], fillStyle: `solid` }));
    this.panelButton(fillKinds, t(`Hachuré`), (s) => s.fill !== null && s.fillStyle === `hachure`, () => this.change({ fill: this.style?.fill ?? this.doc.palette[1], fillStyle: `hachure` }));
    const fillRow = props.createDiv({ cls: `sketchdraw-swatches` });
    this.fillColor = this.colorInput(props, (c) => this.change({ fill: c }));

    this.section(props, t(`Épaisseur`));
    const widths = props.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(widths, t(`Fin`), (s) => s.strokeWidth === STROKE_WIDTHS.thin, () => this.change({ strokeWidth: STROKE_WIDTHS.thin }));
    this.panelButton(widths, t(`Moyen`), (s) => s.strokeWidth === STROKE_WIDTHS.medium, () => this.change({ strokeWidth: STROKE_WIDTHS.medium }));
    this.panelButton(widths, t(`Épais`), (s) => s.strokeWidth === STROKE_WIDTHS.thick, () => this.change({ strokeWidth: STROKE_WIDTHS.thick }));
    const range = props.createEl(`input`, { cls: `sketchdraw-range`, type: `range` });
    range.min = String(MIN_WIDTH);
    range.max = String(MAX_WIDTH);
    range.step = `1`;
    range.setAttribute(`aria-label`, t(`Épaisseur`));
    range.addEventListener(`input`, () => this.change({ strokeWidth: Number(range.value) }));
    this.widthInput = range;

    this.section(props, t(`Style`));
    const looks = props.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(looks, t(`Dessin`), (s) => s.roughness > 0, () => this.change({ roughness: 1 }));
    this.panelButton(looks, t(`Net`), (s) => s.roughness === 0, () => this.change({ roughness: 0 }));

    this.swatchRows = { stroke: strokeRow, fill: fillRow };
    this.refreshSwatches();
  }

  private swatchRows: { stroke: HTMLElement; fill: HTMLElement } | null = null;

  // Adds a small title to the panel.
  private section(parent: HTMLElement, title: string): void {
    parent.createDiv({ cls: `sketchdraw-title`, text: title });
  }

  // Adds a text button of the panel that shows as active when its test is true for the current style.
  private panelButton(parent: HTMLElement, label: string, test: (s: ToolStyle) => boolean, onClick: () => void): void {
    const b = parent.createEl(`button`, { cls: `sketchdraw-chip`, text: label });
    b.addEventListener(`click`, onClick);
    this.panelButtons.push({ el: b, test });
  }

  // Adds a free colour picker. The value is checked before use.
  private colorInput(parent: HTMLElement, onPick: (color: string) => void): HTMLInputElement {
    const input = parent.createEl(`input`, { cls: `sketchdraw-color`, type: `color` });
    input.setAttribute(`aria-label`, t(`Autre couleur`));
    input.addEventListener(`input`, () => onPick(input.value));
    return input;
  }

  // Draws the swatches of the palette of the drawing, for the stroke and for the fill.
  private refreshSwatches(): void {
    if (!this.swatchRows) return;
    const fill = (row: HTMLElement, list: HTMLElement[], pick: (c: string) => void): void => {
      row.empty();
      list.length = 0;
      for (const color of this.doc.palette) {
        const b = row.createEl(`button`, { cls: `sketchdraw-swatch` });
        b.setAttribute(`aria-label`, color);
        b.setAttribute(`style`, `background:${toHex6(color)}`);
        b.dataset.color = toHex6(color);
        b.addEventListener(`click`, () => pick(color));
        list.push(b);
      }
    };
    fill(this.swatchRows.stroke, this.strokeSwatches, (c) => this.change({ stroke: c }));
    fill(this.swatchRows.fill, this.fillSwatches, (c) => this.change({ fill: c }));
  }

  // The style shown in the panel: the one of the selected element when there is exactly one, otherwise the style of new elements.
  private currentStyle(): ToolStyle {
    const one = this.selected.size === 1 ? this.selectedElements()[0] : undefined;
    return (one ? styleOf(one) : null) ?? this.style ?? defaultStyle(`#000000`);
  }

  // Applies a change of style to the selected elements (one change that can be undone) and to the style of the next elements.
  private change(patch: StylePatch): void {
    const clean = cleanPatch(patch);
    if (this.style) this.style = { ...this.style, ...clean };
    if (this.selected.size > 0) {
      const next = applyStyleToIds(this.doc.elements, this.selected, clean);
      if (next.some((e, i) => e !== this.doc.elements[i])) this.commitElements(next);
    }
    this.lastPanel = ``;
    this.syncPanel();
  }

  // Called when the selection or the tool changes: the panel shows the style that applies.
  protected onSelectionChanged(): void {
    this.lockButton?.toggleClass(`is-active`, this.toolLocked);
    this.syncPanel();
  }

  // Shows in the panel which choices are active. Does nothing when nothing changed since the last time.
  private syncPanel(): void {
    const s = this.currentStyle();
    const key = JSON.stringify(s);
    if (key === this.lastPanel) return;
    this.lastPanel = key;
    for (const b of this.panelButtons) b.el.toggleClass(`is-active`, b.test(s));
    for (const sw of this.strokeSwatches) sw.toggleClass(`is-active`, sw.dataset.color === toHex6(s.stroke));
    for (const sw of this.fillSwatches) sw.toggleClass(`is-active`, s.fill !== null && sw.dataset.color === toHex6(s.fill));
    if (this.widthInput) this.widthInput.value = String(Math.round(s.strokeWidth));
    if (this.strokeColor) this.strokeColor.value = toHex6(s.stroke);
    if (this.fillColor) this.fillColor.value = toHex6(s.fill ?? `#ffffff`);
  }
}
