// The view that opens a .sketchdraw file: a drawing kept in its own note. A toolbar on the right holds the tools and the properties of the lines and fills;
// the engine (zoom, selection, undo...) is in CanvasView.
import { Menu, setIcon, WorkspaceLeaf } from "obsidian";
import { CanvasView, Tool } from "./canvas-view";
import { addCustomPastille } from "./color-modal";
import { toHex6 } from "./page-background";
import { CANVAS_HEIGHT, CANVAS_WIDTH, contentBox, createEmptyDrawing, guideBox, parseSketchdraw, serializeSketchdraw, SketchdrawDoc } from "./drawing-file";
import { drawElements, PLAIN } from "./element-render";
import { BORDER_KINDS, BorderKind, CORNER_RADII, SHADOW_KINDS, ShadowKind } from "./effects";
import { Head, HEADS, Point, SketchElement, TextElement } from "./elements";
import { fontStack } from "./fonts";
import { openTextEditor } from "./text-editor";
import { refitText } from "./text-layout";
import { Box, unionBox as unionBoxes } from "./geometry";
import { brightness } from "./page-background";
import { t } from "./i18n";
import { panelKinds, PanelSection, sectionShown } from "./panel-kinds";
import { PluginApi } from "./plugin-api";
import { renderCanvas, RenderedPage } from "./page-render";
import { applyStyleToIds, cleanPatch, defaultStyle, MAX_WIDTH, MIN_WIDTH, StylePatch, STROKE_WIDTHS, styleOf, TEXT_SIZES, ToolStyle } from "./style";
import { CreationTool, textElement } from "./tools";
import { hitTop } from "./geometry";
import { newId } from "./elements";
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
  private transparencyInput: HTMLInputElement | null = null;
  private strokeCustom: { sync: (color: string | null) => void } | null = null;
  private fillCustom: { sync: (color: string | null) => void } | null = null;
  private lockButton: HTMLElement | null = null;
  // The text being written (hidden while the text area is over it) and the function that ends the writing.
  private editingText: string | null = null;
  private finishEditor: (() => void) | null = null;
  private unsubscribeFonts: (() => void) | null = null;

  // Creates the view inside a workspace leaf, with the services of the plugin.
  constructor(leaf: WorkspaceLeaf, api: PluginApi) {
    super(leaf, createEmptyDrawing());
    this.api = api;
    this.style = defaultStyle(`#000000`);
  }

  // Ends a text being written and stops following the list of fonts when the view closes.
  async onClose(): Promise<void> {
    this.finishEditor?.();
    this.unsubscribeFonts?.();
    this.unsubscribeFonts = null;
    await super.onClose();
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
    drawElements(this.editingText === null ? this.doc.elements : this.doc.elements.filter((e) => e.id !== this.editingText), group, PLAIN);
  }

  protected creationTools(): CreationTool[] {
    return [`rect`, `diamond`, `ellipse`, `arrow`, `line`, `pen`, `point`];
  }

  protected toolKeys(): Record<string, Tool> {
    return { v: `select`, h: `hand`, r: `rect`, d: `diamond`, o: `ellipse`, a: `arrow`, l: `line`, p: `pen`, t: `text`, [`.`]: `point` };
  }

  // The Text tool: a click on a text edits it, a click elsewhere starts a new text there.
  protected writeText(p: Point): void {
    const hit = hitTop(this.doc.elements, p, 6 / this.zoom);
    if (hit && hit.type === `text`) this.editText(hit, p);
    else this.editText(null, p);
  }

  // A double click on a text, or Enter on a selected text, edits it.
  protected onActivate(el: SketchElement): void {
    if (el.type === `text`) this.editText(el, [el.x, el.y]);
  }

  // Opens the writing of a text over the surface: a new one at a point, or the text of an element, which is hidden while it is written. The writing ends with Escape, Ctrl+Enter
  // or a click elsewhere: the text is then kept, changed or (when empty) removed, as one change that can be undone.
  private editText(el: TextElement | null, at: Point): void {
    if (!this.svg) return;
    this.finishEditor?.();
    const style = this.currentStyle();
    const font = el ? el.font : style.font;
    const size = el ? el.size : style.fontSize;
    const color = el ? el.stroke : style.stroke;
    const align = el ? el.align ?? `left` : style.align;
    const x = el ? el.x : at[0];
    const y = el ? el.y : at[1] - (size * 1.25) / 2;
    const box = this.svg.getBoundingClientRect();
    this.editingText = el ? el.id : null;
    this.selected = el ? new Set([el.id]) : new Set();
    this.renderContent();
    this.renderUi();
    this.finishEditor = openTextEditor(this.contentEl.ownerDocument, {
      left: box.left + x * this.zoom,
      top: box.top + y * this.zoom,
      zoom: this.zoom,
      font: fontStack(font),
      size,
      color,
      align,
      initial: el ? el.text : ``,
      measure: (line) => this.api.fonts.measure(line, font, size),
      onDone: (text) => this.endText(el, [x, y], text, style),
    });
  }

  // Keeps the result of the writing of a text.
  private endText(el: TextElement | null, at: Point, text: string, style: ToolStyle): void {
    this.finishEditor = null;
    this.editingText = null;
    const clean = text.replace(/\s+$/, ``);
    const measure = this.api.fonts.measure;
    if (el) {
      if (clean === ``) {
        this.selected = new Set();
        this.commitElements(this.doc.elements.filter((e) => e.id !== el.id));
      } else if (clean !== el.text) this.commitElements(this.doc.elements.map((e) => (e.id === el.id ? refitText({ ...el, text: clean }, measure) : e)));
      else this.renderContent();
    } else if (clean !== ``) {
      const made = textElement(at, clean, style, newId(this.doc.elements), measure);
      this.commitElements([...this.doc.elements, made]);
      this.selected = new Set([made.id]);
      if (!this.toolLocked) this.tool = `select`;
    } else this.renderContent();
    this.renderUi();
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
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
    this.button(bar, `arrow-left`, t(`Retour au sketchnote`), () => void this.goBack());
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
    this.toolButton(tools, `text`, `type`, t(`Texte`));
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
    this.unsubscribeFonts = this.api.fonts.onChange(() => this.refreshFontList());
  }

  // Builds the properties panel. It is made of sections, each one shown only for the elements it concerns (the edges for lines and arrows, the heads for arrows, the font for
  // texts, the fill and the width for everything but texts). Every choice is a pictogram; its name is the tooltip.
  private buildProps(props: HTMLElement): void {
    this.panelButtons.length = 0;
    this.sections.length = 0;
    this.strokeSwatches.length = 0;
    this.fillSwatches.length = 0;

    const colour = this.section(props, `colour`);
    this.sectionIcon(colour, `pencil-line`, t(`Couleur du trait`));
    const strokeRow = colour.createDiv({ cls: `sketchdraw-swatches` });

    const fillSec = this.section(props, `fill`);
    this.sectionIcon(fillSec, `paint-bucket`, t(`Remplissage`));
    const fillKinds = fillSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(fillKinds, `sketchnote-fill-none`, t(`Aucun remplissage`), (s) => s.fill === null, () => this.change({ fill: null }));
    this.panelButton(fillKinds, `sketchnote-fill-solid`, t(`Remplissage uni`), (s) => s.fill !== null && s.fillStyle === `solid`, () => this.change({ fill: this.style?.fill ?? this.doc.palette[1], fillStyle: `solid` }));
    this.panelButton(fillKinds, `sketchnote-fill-hachure`, t(`Remplissage hachuré`), (s) => s.fill !== null && s.fillStyle === `hachure`, () => this.change({ fill: this.style?.fill ?? this.doc.palette[1], fillStyle: `hachure` }));
    const fillRow = fillSec.createDiv({ cls: `sketchdraw-swatches` });
    // The transparency of the fill: 0 is opaque, the line keeps its colour and stays opaque.
    const alpha = fillSec.createEl(`input`, { cls: `sketchdraw-range sketchdraw-alpha`, type: `range` });
    alpha.min = `0`;
    alpha.max = `95`;
    alpha.step = `5`;
    alpha.setAttribute(`aria-label`, t(`Transparence du remplissage`));
    alpha.setAttribute(`title`, t(`Transparence du remplissage`));
    alpha.addEventListener(`input`, () => this.change({ fillOpacity: 1 - Number(alpha.value) / 100 }));
    this.transparencyInput = alpha;

    const widthSec = this.section(props, `width`);
    this.sectionIcon(widthSec, `sketchnote-width-medium`, t(`Épaisseur`));
    const widths = widthSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(widths, `sketchnote-width-thin`, t(`Trait fin`), (s) => s.strokeWidth === STROKE_WIDTHS.thin, () => this.change({ strokeWidth: STROKE_WIDTHS.thin }));
    this.panelButton(widths, `sketchnote-width-medium`, t(`Trait moyen`), (s) => s.strokeWidth === STROKE_WIDTHS.medium, () => this.change({ strokeWidth: STROKE_WIDTHS.medium }));
    this.panelButton(widths, `sketchnote-width-thick`, t(`Trait épais`), (s) => s.strokeWidth === STROKE_WIDTHS.thick, () => this.change({ strokeWidth: STROKE_WIDTHS.thick }));
    const range = widthSec.createEl(`input`, { cls: `sketchdraw-range`, type: `range` });
    range.min = String(MIN_WIDTH);
    range.max = String(MAX_WIDTH);
    range.step = `1`;
    range.setAttribute(`aria-label`, t(`Épaisseur`));
    range.addEventListener(`input`, () => this.change({ strokeWidth: Number(range.value) }));
    this.widthInput = range;

    const dashSec = this.section(props, `dash`);
    this.sectionIcon(dashSec, `sketchnote-line-dashed`, t(`Type de trait`));
    const dashes = dashSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(dashes, `sketchnote-line-solid`, t(`Trait continu`), (s) => s.lineStyle === `solid`, () => this.change({ lineStyle: `solid` }));
    this.panelButton(dashes, `sketchnote-line-dashed`, t(`Tirets`), (s) => s.lineStyle === `dashed`, () => this.change({ lineStyle: `dashed` }));
    this.panelButton(dashes, `sketchnote-line-dotted`, t(`Pointillés`), (s) => s.lineStyle === `dotted`, () => this.change({ lineStyle: `dotted` }));

    const lookSec = this.section(props, `look`);
    this.sectionIcon(lookSec, `brush`, t(`Style`));
    const looks = lookSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(looks, `sketchnote-style-sketch`, t(`Dessiné à la main`), (s) => s.roughness > 0, () => this.change({ roughness: 1 }));
    this.panelButton(looks, `sketchnote-style-clean`, t(`Net`), (s) => s.roughness === 0, () => this.change({ roughness: 0 }));

    // The border of the shapes: one drop-down menu, then the corners of a rectangle.
    const borderSec = this.section(props, `border`);
    this.sectionIcon(borderSec, `sketchnote-border-double`, t(`Bordure`));
    const borderRow = borderSec.createDiv({ cls: `sketchdraw-row` });
    this.dropdown(borderRow, t(`Bordure`), BORDER_KINDS, (v) => `sketchnote-border-${v}`, borderName, (s) => s.border, (v) => ({ border: v }));
    const cornerSec = this.section(props, `corners`);
    this.sectionIcon(cornerSec, `sketchnote-corner-round`, t(`Coins`));
    const corners = cornerSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(corners, `sketchnote-corner-square`, t(`Coins carrés`), (s) => s.radius === 0, () => this.change({ radius: CORNER_RADII.square }));
    this.panelButton(corners, `sketchnote-corner-slight`, t(`Coins légèrement arrondis`), (s) => s.radius > 0 && s.radius <= 20, () => this.change({ radius: CORNER_RADII.slight }));
    this.panelButton(corners, `sketchnote-corner-round`, t(`Coins arrondis`), (s) => s.radius > 20 && s.radius <= 100, () => this.change({ radius: CORNER_RADII.round }));
    this.panelButton(corners, `sketchnote-corner-pill`, t(`Coins très arrondis`), (s) => s.radius > 100, () => this.change({ radius: CORNER_RADII.pill }));

    // Sections shown only for lines and arrows: the edges, then the head at each end of an arrow.
    const edgeSec = this.section(props, `edges`);
    this.sectionIcon(edgeSec, `sketchnote-edge-round`, t(`Bords`));
    const edges = edgeSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(edges, `sketchnote-edge-sharp`, t(`Bords droits`), (s) => !s.rounded, () => this.change({ rounded: false }));
    this.panelButton(edges, `sketchnote-edge-round`, t(`Bords arrondis`), (s) => s.rounded, () => this.change({ rounded: true }));
    // The heads: one drop-down menu for each end, each one showing the head that is chosen and listing the six shapes.
    const headSec = this.section(props, `heads`);
    this.sectionIcon(headSec, `sketchnote-head-arrow`, t(`Pointes`));
    const headRow = headSec.createDiv({ cls: `sketchdraw-row` });
    this.dropdown(headRow, t(`Pointe au début`), HEADS, (v) => headIcon(`start`, v), headName, (s) => s.startHead, (v) => ({ startHead: v }));
    this.dropdown(headRow, t(`Pointe à la fin`), HEADS, (v) => headIcon(`end`, v), headName, (s) => s.endHead, (v) => ({ endHead: v }));

    // The section of the texts: the font (a list, each name written in its own font), the size and the alignment.
    const textSec = this.section(props, `text`);
    this.sectionIcon(textSec, `type`, t(`Police`));
    const select = textSec.createEl(`select`, { cls: `dropdown sketchdraw-font` });
    select.setAttribute(`aria-label`, t(`Police`));
    select.setAttribute(`title`, t(`Police`));
    select.addEventListener(`change`, () => this.change({ font: select.value }));
    this.fontSelect = select;
    this.refreshFontList();
    const sizes = textSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(sizes, `sketchnote-size-small`, t(`Texte petit`), (s) => s.fontSize === TEXT_SIZES.small, () => this.change({ fontSize: TEXT_SIZES.small }));
    this.panelButton(sizes, `sketchnote-size-medium`, t(`Texte moyen`), (s) => s.fontSize === TEXT_SIZES.medium, () => this.change({ fontSize: TEXT_SIZES.medium }));
    this.panelButton(sizes, `sketchnote-size-large`, t(`Texte grand`), (s) => s.fontSize === TEXT_SIZES.large, () => this.change({ fontSize: TEXT_SIZES.large }));
    this.panelButton(sizes, `sketchnote-size-huge`, t(`Texte très grand`), (s) => s.fontSize === TEXT_SIZES.huge, () => this.change({ fontSize: TEXT_SIZES.huge }));
    const aligns = textSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(aligns, `align-left`, t(`Aligné à gauche`), (s) => s.align === `left`, () => this.change({ align: `left` }));
    this.panelButton(aligns, `align-center`, t(`Centré`), (s) => s.align === `center`, () => this.change({ align: `center` }));
    this.panelButton(aligns, `align-right`, t(`Aligné à droite`), (s) => s.align === `right`, () => this.change({ align: `right` }));

    // The effects of every element: the shadow (one drop-down menu), the reflection and the opacity of the whole element.
    const effectSec = this.section(props, `effects`);
    this.sectionIcon(effectSec, `sketchnote-shadow-soft`, t(`Effets`));
    const effectRow = effectSec.createDiv({ cls: `sketchdraw-row` });
    this.dropdown(effectRow, t(`Ombre`), SHADOW_KINDS, (v) => `sketchnote-shadow-${v}`, shadowName, (s) => (s.shadow === `custom` ? `soft` : s.shadow), (v) => ({ shadow: v }));
    this.panelButton(effectRow, `sketchnote-reflection`, t(`Reflet`), (s) => s.reflection, () => this.change({ reflection: !this.currentStyle().reflection }));
    const opacity = effectSec.createEl(`input`, { cls: `sketchdraw-range sketchdraw-opacity`, type: `range` });
    opacity.min = `5`;
    opacity.max = `100`;
    opacity.step = `5`;
    opacity.setAttribute(`aria-label`, t(`Opacité de l'élément`));
    opacity.setAttribute(`title`, t(`Opacité de l'élément`));
    opacity.addEventListener(`input`, () => this.change({ opacity: Number(opacity.value) / 100 }));
    this.opacityInput = opacity;

    this.swatchRows = { stroke: strokeRow, fill: fillRow };
    this.refreshSwatches();
  }

  // The sections of the panel, each with the test that tells for which kind of element it is shown.
  private readonly sections: { el: HTMLElement; name: PanelSection }[] = [];
  private readonly dropdowns: { el: HTMLElement; label: string; icon: (s: ToolStyle) => string; name: (s: ToolStyle) => string }[] = [];
  private opacityInput: HTMLInputElement | null = null;
  private fontSelect: HTMLSelectElement | null = null;

  // Adds a section to the panel.
  private section(props: HTMLElement, name: PanelSection): HTMLElement {
    const el = props.createDiv({ cls: `sketchdraw-section` });
    this.sections.push({ el, name });
    return el;
  }

  // Adds a drop-down menu: a button that shows the choice that is made (its pictogram, its name as the tooltip) and opens the list of choices, each with its pictogram. The
  // fewer menus the better: only the choices that have too many shapes for buttons go into a menu.
  private dropdown<V extends string>(parent: HTMLElement, label: string, values: V[], icon: (v: V) => string, name: (v: V) => string, read: (s: ToolStyle) => V, write: (v: V) => StylePatch): void {
    const button = parent.createEl(`button`, { cls: `sketchdraw-chip sketchdraw-menu` });
    button.addEventListener(`click`, (e) => {
      const current = read(this.currentStyle());
      const menu = new Menu();
      for (const value of values) {
        menu.addItem((item) =>
          item
            .setTitle(name(value))
            .setIcon(icon(value))
            .setChecked(value === current)
            .onClick(() => {
              this.change(write(value));
              this.contentEl.focus({ preventScroll: true });
            }),
        );
      }
      menu.showAtMouseEvent(e);
    });
    this.dropdowns.push({ el: button, label, icon: (s) => icon(read(s)), name: (s) => `${label} : ${name(read(s))}` });
  }

  // Fills the list of fonts: the built-in fonts, then the imported ones, each name in its own font.
  private refreshFontList(): void {
    const select = this.fontSelect;
    if (!select) return;
    select.empty();
    for (const f of this.api.fonts.entries()) {
      const option = select.createEl(`option`, { text: f.name });
      option.value = f.id;
      option.style.fontFamily = fontStack(f.id);
    }
    select.value = this.currentStyle().font;
  }

  // Shows the sections that concern the kind of element selected or about to be drawn.
  private syncSections(): void {
    const kinds = panelKinds(this.tool, this.selectedElements());
    for (const sec of this.sections) sec.el.toggleClass(`sketchdraw-hidden`, !sectionShown(sec.name, kinds));
  }

  private swatchRows: { stroke: HTMLElement; fill: HTMLElement } | null = null;

  // Adds a small pictogram that heads a section of the panel. Its name is the tooltip.
  private sectionIcon(parent: HTMLElement, icon: string, label: string): HTMLElement {
    const head = parent.createDiv({ cls: `sketchdraw-title` });
    setIcon(head, icon);
    head.createSpan({ cls: `sketchdraw-title-text`, text: label });
    head.setAttribute(`aria-label`, label);
    head.setAttribute(`title`, label);
    return head;
  }

  // Adds a pictogram button of the panel that shows as active when its test is true for the current style.
  private panelButton(parent: HTMLElement, icon: string, label: string, test: (s: ToolStyle) => boolean, onClick: () => void): void {
    const b = parent.createEl(`button`, { cls: `sketchdraw-chip` });
    setIcon(b, icon);
    b.setAttribute(`aria-label`, label);
    b.setAttribute(`title`, label);
    b.addEventListener(`click`, () => {
      onClick();
      // The focus goes back to the drawing, so that the keyboard shortcuts keep working after a click on the panel.
      this.contentEl.focus({ preventScroll: true });
    });
    this.panelButtons.push({ el: b, test });
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
    // The multicolour pastille at the end of each row opens the colour window.
    this.strokeCustom = addCustomPastille(this.swatchRows.stroke, this.app, t(`Autre couleur`), () => this.currentStyle().stroke, (c) => this.change({ stroke: c }));
    this.fillCustom = addCustomPastille(this.swatchRows.fill, this.app, t(`Autre couleur`), () => this.currentStyle().fill ?? this.doc.palette[1] ?? `#ffffff`, (c) => this.change({ fill: c }));
    this.lastPanel = ``;
    this.syncPanel();
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
      // A text takes the size of its box again when its font or its size changed.
      const next = applyStyleToIds(this.doc.elements, this.selected, clean).map((e) => (e.type === `text` ? refitText(e, this.api.fonts.measure) : e));
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
    this.syncSections();
    const key = JSON.stringify(s);
    if (key === this.lastPanel) return;
    this.lastPanel = key;
    for (const b of this.panelButtons) b.el.toggleClass(`is-active`, b.test(s));
    for (const d of this.dropdowns) {
      d.el.empty();
      setIcon(d.el, d.icon(s));
      d.el.setAttribute(`aria-label`, d.name(s));
      d.el.setAttribute(`title`, d.name(s));
    }
    for (const sw of this.strokeSwatches) sw.toggleClass(`is-active`, sw.dataset.color === toHex6(s.stroke));
    for (const sw of this.fillSwatches) sw.toggleClass(`is-active`, s.fill !== null && sw.dataset.color === toHex6(s.fill));
    if (this.widthInput) this.widthInput.value = String(Math.round(s.strokeWidth));
    if (this.fontSelect) this.fontSelect.value = s.font;
    if (this.opacityInput) this.opacityInput.value = String(Math.round(s.opacity * 100));
    if (this.transparencyInput) this.transparencyInput.value = String(Math.round((1 - s.fillOpacity) * 20) * 5);
    this.strokeCustom?.sync(s.stroke);
    this.fillCustom?.sync(s.fill);
  }
}

// The name of an arrow head, shown as a tooltip.
function headName(kind: Head): string {
  const names: Record<Head, string> = {
    none: t(`Aucune`),
    arrow: t(`Flèche`),
    triangle: t(`Triangle`),
    dot: t(`Point`),
    bar: t(`Barre`),
    diamond: t(`Losange`),
  };
  return names[kind];
}

// Returns the name of the pictogram of a head at one end of an arrow.
function headIcon(side: `start` | `end`, kind: Head): string {
  return side === `start` ? `sketchnote-head-start-${kind}` : `sketchnote-head-${kind}`;
}

// The name of a border, shown as a tooltip and in the menu.
function borderName(kind: BorderKind): string {
  const names: Record<BorderKind, string> = {
    simple: t(`Bordure simple`),
    none: t(`Sans bordure`),
    double: t(`Bordure double`),
    "double-reverse": t(`Bordure double inversée`),
    frame: t(`Cadre de tableau`),
    mat: t(`Cadre avec marie-louise`),
  };
  return names[kind];
}

// The name of a shadow, shown as a tooltip and in the menu.
function shadowName(kind: ShadowKind): string {
  const names: Record<ShadowKind, string> = {
    none: t(`Aucune ombre`),
    soft: t(`Ombre douce`),
    strong: t(`Ombre marquée`),
    offset: t(`Ombre décalée`),
    custom: t(`Ombre personnalisée`),
  };
  return names[kind];
}
