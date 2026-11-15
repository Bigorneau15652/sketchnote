// The view that opens a .sketchdraw file: a drawing kept in its own note. A toolbar on the right holds the tools and the properties of the lines and fills;
// the engine (zoom, selection, undo...) is in CanvasView.
import { Menu, Notice, setIcon, WorkspaceLeaf } from "obsidian";
import { CanvasView, Tool } from "./canvas-view";
import { ColorChoice, ColorModal } from "./color-modal";
import { ConfirmModal } from "./confirm-modal";
import { IconModal, warningText } from "./icon-modal";
import { iconData } from "./icon-registry";
import { iconToElements, strokeCount } from "./icon-strokes";
import type { IconData } from "./icon-svg";
import type { IconEntry } from "./icon-themes";
import { defaultFillPalette, FillSwatch, swatchBackground, swatchMatches } from "./swatches";
import { toHex6 } from "./page-background";
import { CANVAS_HEIGHT, CANVAS_WIDTH, contentBox, createEmptyDrawing, guideBox, parseSketchdraw, serializeSketchdraw, SketchdrawDoc } from "./drawing-file";
import { drawElements, PLAIN } from "./element-render";
import { BORDER_KINDS, BorderKind, CORNER_RADII, SHADOW_MAX_BLUR, SHADOW_MAX_DISTANCE } from "./effects";
import { ArrowElement, IconElement, MAX_ROUGHNESS, Head, HEADS, LineElement, Point, SketchElement, TextElement } from "./elements";
import { fontStack } from "./fonts";
import { openTextEditor } from "./text-editor";
import { refitText, wrapLines } from "./text-layout";
import { Box, unionBox as unionBoxes } from "./geometry";
import { brightness } from "./page-background";
import { t } from "./i18n";
import { panelKinds, PanelSection, sectionShown } from "./panel-kinds";
import { BRUSH_DEFS, BRUSH_KINDS, BrushKind, BrushParam, brushMake, paramsOf, previewPoints } from "./brushes";
import { penCursor } from "./cursors";
import { allLocked, isLocked } from "./lock";
import { MAX_REGULARITY } from "./tidy";
import { WARP_KINDS, WarpKind } from "./text-warp";
import { PluginApi } from "./plugin-api";
import { renderCanvas, RenderedPage } from "./page-render";
import { svgEl } from "./svg";
import { applyStyleToIds, brushDefaultsPatch, cleanPatch, defaultStyle, MAX_WIDTH, MIN_WIDTH, StylePatch, styleOf, TEXT_SIZES, ToolStyle } from "./style";
import { CreationTool, textElement, zoneElement, zoneFontSize } from "./tools";
import { isLabeledShape, labelBox, labelColor, LabeledShape, pathMiddle } from "./labels";
import { hitTop } from "./geometry";
import { newId } from "./elements";
import { VIEW_TYPE as PAGE_VIEW_TYPE } from "./view";

export const DRAW_VIEW_TYPE = `sketchdraw-view`;

// Returns the name of a distortion of the texts in the language of the user.
function warpName(kind: WarpKind | `none`): string {
  const names: Record<WarpKind | `none`, string> = { none: t(`Sans déformation`), arc: t(`Arc`), wave: t(`Vague`), slant: t(`Inclinaison`), perspective: t(`Perspective`), bulge: t(`Bombé`) };
  return names[kind];
}

// A number that makes the identifiers of the filters of the pictograms different.
let previewCount = 0;

// Returns the name of a brush in the language of the user.
function brushName(brush: BrushKind): string {
  const names: Record<BrushKind, string> = {
    round: t(`Pinceau rond`),
    soft: t(`Pinceau rond souple`),
    pencil: t(`Crayon à grain`),
    felt: t(`Feutre`),
    square: t(`Marqueur carré`),
    ink: t(`Stylo encre BD`),
    nib: t(`Plume de calligraphie`),
    lino: t(`Pointe de linogravure`),
    airbrush: t(`Aérographe`),
    aerosol: t(`Aérosol`),
    watercolor: t(`Aquarelle`),
    gouache: t(`Gouache`),
    oil: t(`Huile`),
    drybrush: t(`Brosse sèche`),
    chalk: t(`Craie`),
    pastel: t(`Pastel`),
    charcoal: t(`Fusain`),
  };
  return names[brush];
}

// The settings that the panel offers for the brushes: their name, their help, the range and the step of their slider (in percent, or in degrees for the rotation).
const BRUSH_SLIDERS: { param: BrushParam; field: `flow` | `hardness` | `spacing` | `form` | `brushAngle` | `grain` | `dynamics`; min: number; max: number; step: number; scale: number }[] = [
  { param: `flow`, field: `flow`, min: 5, max: 100, step: 5, scale: 100 },
  { param: `hardness`, field: `hardness`, min: 0, max: 100, step: 5, scale: 100 },
  { param: `spacing`, field: `spacing`, min: 5, max: 200, step: 5, scale: 100 },
  { param: `form`, field: `form`, min: 10, max: 100, step: 5, scale: 100 },
  { param: `rotation`, field: `brushAngle`, min: 0, max: 180, step: 5, scale: 1 },
  { param: `grain`, field: `grain`, min: 0, max: 100, step: 5, scale: 100 },
  { param: `dynamics`, field: `dynamics`, min: 0, max: 100, step: 5, scale: 100 },
];

// Returns the word written above the slider of a setting of the brushes.
function brushSliderShort(param: BrushParam): string {
  switch (param) {
    case `flow`:
      return t(`Flux`);
    case `hardness`:
      return t(`Dureté`);
    case `spacing`:
      return t(`Espacement`);
    case `form`:
      return t(`Forme`);
    case `rotation`:
      return t(`Rotation`);
    case `grain`:
      return t(`Grain`);
    case `dynamics`:
      return t(`Dynamique`);
  }
}

// Returns the help (the tooltip of the slider) of a setting of the brushes.
function brushSliderLabel(param: BrushParam): string {
  switch (param) {
    case `flow`:
      return t(`Flux : la quantité de peinture sur le pinceau (à 100 % le trait est plein, en dessous du blanc apparaît, de plus en plus vers la fin du trait)`);
    case `hardness`:
      return t(`Dureté : le contour du trait, net quand elle est forte, flou au départ, à l'arrivée et sur les bords quand elle est faible`);
    case `spacing`:
      return t(`Espacement : la distance entre deux touches du pinceau`);
    case `form`:
      return t(`Forme : d'une pointe plate à une pointe ronde`);
    case `rotation`:
      return t(`Rotation de la pointe`);
    case `grain`:
      return t(`Grain : de lisse à granuleux`);
    case `dynamics`:
      return t(`Dynamique : le trait s'amincit quand la souris va vite`);
  }
}

export class SketchdrawView extends CanvasView<SketchdrawDoc> {
  private readonly api: PluginApi;
  private props: HTMLElement | null = null;
  private lastPanel = ``;
  private readonly strokeSwatches: HTMLElement[] = [];
  private readonly fillSwatches: HTMLElement[] = [];
  private readonly panelButtons: { el: HTMLElement; test: (s: ToolStyle) => boolean }[] = [];
  private lockButton: HTMLElement | null = null;
  // The text being written (hidden while the text area is over it) and the function that ends the writing.
  private editingText: string | null = null;
  // The shape whose text is being written (its text is hidden while the text area is over it).
  private editingLabel: string | null = null;
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
    drawElements(this.visibleElements(), group, { ...PLAIN, ink: this.doc.ink });
  }

  // The elements to draw: all of them, without the text that is being written, and the shape being written in without its text.
  private visibleElements(): SketchElement[] {
    if (this.editingText === null && this.editingLabel === null) return this.doc.elements;
    return this.doc.elements
      .filter((e) => e.id !== this.editingText)
      .map((e) => {
        if (e.id !== this.editingLabel || !(isLabeledShape(e) || e.type === `line` || e.type === `arrow`)) return e;
        const { label: _l, ...rest } = e;
        void _l;
        return rest as SketchElement;
      });
  }

  protected creationTools(): CreationTool[] {
    return [`rect`, `diamond`, `ellipse`, `triangle`, `arrow`, `line`, `pen`, `point`];
  }

  protected toolKeys(): Record<string, Tool> {
    return { v: `select`, h: `hand`, r: `rect`, d: `diamond`, o: `ellipse`, g: `triangle`, a: `arrow`, l: `line`, p: `pen`, t: `text`, [`.`]: `point` };
  }

  // The Text tool: a click on a text edits it, a click elsewhere starts a text there, and a drag draws a text zone (a box that the text wraps to).
  protected writeText(p: Point, zone?: Box): void {
    const hit = hitTop(this.doc.elements, p, 6 / this.zoom);
    if (hit && hit.type === `text`) this.editText(hit, p);
    else this.editText(null, p, zone);
  }

  // A double click on a text or on a shape, or Enter on a selected one, writes in it: the text of a text, or the text inside a shape.
  protected onActivate(el: SketchElement): void {
    // The text of a locked element cannot be changed.
    if (isLocked(el)) return;
    if (el.type === `text`) this.editText(el, [el.x, el.y]);
    else if (isLabeledShape(el)) this.editLabel(el);
    else if (el.type === `line` || el.type === `arrow`) this.editLineLabel(el);
  }

  // Opens the writing of a text over the surface: a new one at a point (or in a zone that was dragged), or the text of an element, which is hidden while it is written. The writing
  // ends with Escape, Ctrl+Enter or a click elsewhere: the text is then kept, changed or (when empty) removed, as one change that can be undone.
  private editText(el: TextElement | null, at: Point, dragged?: Box): void {
    if (!this.svg) return;
    this.finishEditor?.();
    const style = this.currentStyle();
    const font = el ? el.font : style.font;
    // The height of a box that was dragged gives the size of the letters: one line fills it.
    const size = el ? el.size : dragged ? zoneFontSize(dragged.h) : style.fontSize;
    const color = el ? el.stroke : style.stroke;
    const align = el ? el.align ?? `left` : style.align;
    // A text zone is written in its own box; any other text starts at the point (the click is in the middle of the first line).
    const zoneBox: Box | undefined = el?.zone === true ? { x: el.x, y: el.y, w: el.width, h: el.height } : dragged;
    const x = zoneBox ? zoneBox.x : el ? el.x : at[0];
    const y = zoneBox ? zoneBox.y : el ? el.y : at[1] - (size * 1.25) / 2;
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
      zone: zoneBox ? { width: zoneBox.w, height: zoneBox.h, centered: false, autoHeight: true, lineCount: (text) => wrapLines(text, zoneBox.w, (line) => this.api.fonts.measure(line, font, size)).length } : undefined,
      onDone: (text) => this.endText(el, [x, y], text, style, dragged),
    });
  }

  // Keeps the result of the writing of a text.
  private endText(el: TextElement | null, at: Point, text: string, style: ToolStyle, dragged?: Box): void {
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
      const made = dragged ? refitText(zoneElement(dragged, clean, style, newId(this.doc.elements)), measure) : textElement(at, clean, style, newId(this.doc.elements), measure);
      this.commitElements([...this.doc.elements, made]);
      this.selected = new Set([made.id]);
      if (!this.toolLocked) this.tool = `select`;
    } else this.renderContent();
    this.renderUi();
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // Opens the writing of the text inside a shape: the text area covers the part of the shape that holds the text, and the text of the shape is hidden while it is written. It
  // ends like any text; an empty text takes the text away from the shape.
  private editLabel(shape: LabeledShape): void {
    if (!this.svg) return;
    this.finishEditor?.();
    const base = this.style ?? this.currentStyle();
    const label = shape.label;
    const font = label ? label.font : base.font;
    const size = label ? label.size : base.fontSize;
    const align = label ? label.align ?? `center` : `center`;
    const room = labelBox(shape);
    const origin = this.svg.getBoundingClientRect();
    this.editingLabel = shape.id;
    this.selected = new Set([shape.id]);
    this.renderContent();
    this.renderUi();
    this.finishEditor = openTextEditor(this.contentEl.ownerDocument, {
      left: origin.left + room.x * this.zoom,
      top: origin.top + room.y * this.zoom,
      zoom: this.zoom,
      font: fontStack(font),
      size,
      color: labelColor(shape, this.doc.ink),
      align,
      initial: label ? label.text : ``,
      measure: (line) => this.api.fonts.measure(line, font, size),
      zone: { width: room.w, height: room.h, centered: true, lineCount: (text) => wrapLines(text, room.w, (line) => this.api.fonts.measure(line, font, size)).length },
      onDone: (text) => this.endLabel(shape.id, text, font, size),
    });
  }

  // Opens the writing of the text in the middle of a line or an arrow: the text area is centred on the middle of the line and takes the colour of the drawing, so that the line
  // seems cut under it. The text of the line is hidden while it is written.
  private editLineLabel(line: LineElement | ArrowElement): void {
    if (!this.svg) return;
    this.finishEditor?.();
    const base = this.style ?? this.currentStyle();
    const label = line.label;
    const font = label ? label.font : base.font;
    const size = label ? label.size : base.fontSize;
    const align = label ? label.align ?? `center` : `center`;
    const { point } = pathMiddle(line);
    const origin = this.svg.getBoundingClientRect();
    this.editingLabel = line.id;
    this.selected = new Set([line.id]);
    this.renderContent();
    this.renderUi();
    this.finishEditor = openTextEditor(this.contentEl.ownerDocument, {
      left: origin.left + point[0] * this.zoom,
      top: origin.top + point[1] * this.zoom,
      zoom: this.zoom,
      font: fontStack(font),
      size,
      color: line.stroke,
      align,
      initial: label ? label.text : ``,
      measure: (l) => this.api.fonts.measure(l, font, size),
      around: { background: brightness(this.doc.ink) > 0.5 ? `#2a3631` : `#ffffff` },
      onDone: (text) => this.endLabel(line.id, text, font, size),
    });
  }

  // Keeps the result of the writing of the text inside a shape.
  private endLabel(id: string, text: string, font: string, size: number): void {
    this.finishEditor = null;
    this.editingLabel = null;
    const clean = text.replace(/\s+$/, ``);
    const current = this.doc.elements.find((e) => e.id === id);
    if (current && (isLabeledShape(current) || current.type === `line` || current.type === `arrow`)) {
      const old = current.label;
      if (clean === `` && old) {
        const { label: _l, ...rest } = current;
        void _l;
        this.commitElements(this.doc.elements.map((e) => (e.id === id ? (rest as SketchElement) : e)));
      } else if (clean !== `` && (!old || old.text !== clean)) {
        const label = { text: clean, font: old ? old.font : font, size: old ? old.size : size, ...(old?.align ? { align: old.align } : {}) };
        this.commitElements(this.doc.elements.map((e) => (e.id === id ? ({ ...current, label } as SketchElement) : e)));
      } else this.renderContent();
    } else this.renderContent();
    this.renderUi();
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // The line of the panel that names the icon that is selected.
  private iconName: HTMLElement | null = null;

  // Opens the window of the icons: Lucide, and the SVG drawings that the user keeps in the folder of the icons (which is created the first time).
  private async openIcons(): Promise<void> {
    try {
      await this.api.drawings.ensureFolder(this.api.icons.folder());
      await this.api.icons.refresh();
    } catch {
      // The folder of the user is not available: Lucide alone is offered.
    }
    new IconModal(this.app, this.api.icons, (entry, data) => this.insertIcon(entry, data)).open();
  }

  // Puts an icon in the middle of what is shown, as one change that can be undone. An icon of Lucide is kept by its name; a drawing of the user carries its shapes. It is made
  // with the standard look (a black line, no fill, no effect) like every new element, and selected so that the panel acts on it.
  private insertIcon(entry: IconEntry, data: IconData): void {
    if (!this.style) return;
    const elements = this.doc.elements;
    const [, , vw, vh] = data.vb;
    const width = 96;
    const height = Math.max(24, Math.min(160, Math.round((width * vh) / vw)));
    // The middle of the part of the surface that is seen, in page units.
    let cx = 200;
    let cy = 200;
    if (this.scroller && this.svg) {
      const sr = this.scroller.getBoundingClientRect();
      const r = this.svg.getBoundingClientRect();
      cx = (Math.max(sr.left, r.left) + Math.min(sr.right, r.right)) / 2 - r.left;
      cy = (Math.max(sr.top, r.top) + Math.min(sr.bottom, r.bottom)) / 2 - r.top;
      cx /= this.zoom;
      cy /= this.zoom;
    }
    const base = { id: newId(elements), type: `icon` as const, x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width, height, stroke: this.style.stroke, strokeWidth: this.style.strokeWidth, roughness: this.style.roughness, seed: Math.floor(Math.random() * 1000000) + 1 };
    const made: SketchElement = entry.source === `lucide` ? { ...base, icon: entry.name } : { ...base, name: entry.label, vb: data.vb, shapes: data.shapes.map((s) => ({ d: s.d, fill: s.fill, stroke: s.stroke, closed: s.closed })) };
    this.selected = new Set([made.id]);
    this.tool = `select`;
    this.commitElements([...elements, made]);
    if (data.warnings.length > 0) new Notice(warningText(data.warnings));
  }

  // Turns the selected icons into ordinary strokes, after a warning, as one change that can be undone: the icon becomes lines, ellipses and rectangles in a group.
  private strokesFromIcons(): void {
    const icons = this.selectedElements().filter((e): e is IconElement => e.type === `icon` && !isLocked(e));
    if (icons.length === 0) return;
    const data = icons.map((e) => ({ el: e, data: iconData(e) }));
    const missing = data.filter((d) => d.data === null).length;
    if (missing === data.length) {
      new Notice(t(`Cette icône est inconnue : elle ne peut pas être transformée en traits.`));
      return;
    }
    const count = data.reduce((n, d) => n + (d.data ? strokeCount(d.data) : 0), 0);
    new ConfirmModal(
      this.app,
      t(`Transformer en traits`),
      t(`{0} deviendra {1} traits ordinaires, groupés, que vous pourrez modifier un par un. Elle ne pourra plus être remplacée par une autre icône ni retrouver sa forme d'origine, sauf en annulant tout de suite (Ctrl+Z). Continuer ?`, icons.length === 1 ? t(`L'icône`) : t(`Les {0} icônes`, String(icons.length)), String(count)),
      () => {
        let next: SketchElement[] = [...this.doc.elements];
        const chosen: string[] = [];
        for (const { el, data: d } of data) {
          if (!d) continue;
          const index = next.findIndex((e) => e.id === el.id);
          if (index < 0) continue;
          const made = iconToElements(el, d, next);
          next = [...next.slice(0, index), ...made.elements, ...next.slice(index + 1)];
          chosen.push(...made.elements.map((e) => e.id));
        }
        this.selected = new Set(chosen);
        this.commitElements(next);
      },
      () => undefined,
    ).open();
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
    this.toolButton(tools, `triangle`, `triangle`, t(`Triangle`));
    this.toolButton(tools, `arrow`, `arrow-right`, t(`Flèche`));
    this.toolButton(tools, `line`, `minus`, t(`Trait`));
    this.toolButton(tools, `pen`, `pencil`, t(`Stylo libre`));
    this.toolButton(tools, `point`, `dot`, t(`Point`));
    this.toolButton(tools, `text`, `type`, t(`Texte`));
    this.button(tools, `shapes`, t(`Insérer une icône de la bibliothèque`), () => void this.openIcons());
    // The pin keeps the tool that is active after each stroke (it is not the lock of the elements, which is a button of the bar of the selection).
    const lock = this.button(tools, `pin-off`, t(`Garder l'outil actif après chaque tracé`), () => {
      this.toolLocked = !this.toolLocked;
      setIcon(lock, this.toolLocked ? `pin` : `pin-off`);
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
    const fillRow = fillSec.createDiv({ cls: `sketchdraw-swatches` });
    // The transparency of the fill: 0 is opaque, the line keeps its colour and stays opaque.
    this.slider(fillSec, ``, t(`Transparence du remplissage`), 0, 95, 5, (s) => Math.round(((1 - s.fillOpacity) * 100) / 5) * 5, (v) => ({ fillOpacity: 1 - v / 100 }));

    // The brush of the pen: one menu, then how much paint it puts and, for the nib, its angle. The thickness is the one of every line.
    const brushSec = this.section(props, `brush`);
    this.sectionIcon(brushSec, `paintbrush`, t(`Pinceau`));
    this.brushPicker(brushSec);
    for (const def of BRUSH_SLIDERS) {
      this.slider(brushSec, brushSliderShort(def.param), brushSliderLabel(def.param), def.min, def.max, def.step, (s) => Math.round(s[def.field] * def.scale), (v) => ({ [def.field]: v / def.scale }), (s) => BRUSH_DEFS[s.brush].params.includes(def.param));
    }

    const widthSec = this.section(props, `width`);
    this.sectionIcon(widthSec, `sketchnote-width-medium`, t(`Épaisseur`));
    this.slider(widthSec, ``, t(`Épaisseur`), MIN_WIDTH, MAX_WIDTH, 1, (s) => Math.round(s.strokeWidth), (v) => ({ strokeWidth: v }));

    const dashSec = this.section(props, `dash`);
    this.sectionIcon(dashSec, `sketchnote-line-dashed`, t(`Type de trait`));
    const dashes = dashSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(dashes, `sketchnote-line-solid`, t(`Trait continu`), (s) => s.lineStyle === `solid`, () => this.change({ lineStyle: `solid` }));
    this.panelButton(dashes, `sketchnote-line-dashed`, t(`Tirets`), (s) => s.lineStyle === `dashed`, () => this.change({ lineStyle: `dashed` }));
    this.panelButton(dashes, `sketchnote-line-dotted`, t(`Pointillés`), (s) => s.lineStyle === `dotted`, () => this.change({ lineStyle: `dotted` }));

    const lookSec = this.section(props, `look`);
    this.sectionIcon(lookSec, `brush`, t(`Style à main levée`));
    // From 0 (a clean line) to the most imperfect: the more it is, the less straight the lines are.
    this.slider(lookSec, ``, t(`Imperfection du tracé : 0 pour un trait net`), 0, MAX_ROUGHNESS * 10, 1, (s) => Math.round(s.roughness * 10), (v) => ({ roughness: v / 10 }));

    // The pen: from a stroke as drawn (0) to the clean shape it was meant to be (a line, a circle, a rectangle, a triangle). It is the only choice made before drawing that is kept.
    const regularSec = this.section(props, `regularity`);
    this.sectionIcon(regularSec, `pencil-ruler`, t(`Régularité du tracé`));
    this.slider(regularSec, ``, t(`Régularité du tracé : 0 pour un tracé à main levée, 5 pour une forme parfaite`), 0, MAX_REGULARITY * 10, 1, (s) => Math.round(s.regularity * 10), (v) => ({ regularity: v / 10 }));

    // The border of the shapes: one drop-down menu, then the corners of a rectangle.
    const borderSec = this.section(props, `border`);
    this.sectionIcon(borderSec, `sketchnote-border-double`, t(`Bordure`));
    const borderRow = borderSec.createDiv({ cls: `sketchdraw-row` });
    this.dropdown(borderRow, t(`Bordure`), BORDER_KINDS, (v) => `sketchnote-border-${v}`, borderName, (s) => s.border, (v) => ({ border: v }), true);
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
    // The taper of lines and arrows: from a line of constant width to one that is as wide as set at its start and ends in a point (the tip of an arrow).
    const taperSec = this.section(props, `taper`);
    this.sectionIcon(taperSec, `sketchnote-taper`, t(`Fuselage`));
    this.slider(taperSec, ``, t(`Fuselage : de pas fuselé à fin au bout de la flèche`), 0, 100, 1, (s) => Math.round(s.taper * 100), (v) => ({ taper: v / 100 }));
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

    // An icon: its name, and the button that turns it into ordinary strokes (with a warning: it cannot be replaced by another icon afterwards).
    const iconSec = this.section(props, `icon`);
    this.sectionIcon(iconSec, `shapes`, t(`Icône`));
    this.iconName = iconSec.createDiv({ cls: `sketchdraw-slider-label` });
    const strokes = iconSec.createEl(`button`, { cls: `sketchdraw-chip sketchdraw-menu has-name` });
    setIcon(strokes, `pencil-line`);
    strokes.createSpan({ cls: `sketchdraw-menu-name`, text: t(`Transformer en traits`) });
    strokes.setAttribute(`aria-label`, t(`Transformer en traits`));
    strokes.setAttribute(`title`, t(`Transformer l'icône en traits ordinaires, que l'on modifie un par un`));
    strokes.addEventListener(`click`, () => this.strokesFromIcons());

    // The distortion of a text and its vertical writing: one menu, a slider for the strength (only with a distortion) and a box to check.
    const warpSec = this.section(props, `warp`);
    this.sectionIcon(warpSec, `sketchnote-warp-arc`, t(`Déformation du texte`));
    const warpRow = warpSec.createDiv({ cls: `sketchdraw-row` });
    this.dropdown(warpRow, t(`Déformation du texte`), [`none`, ...WARP_KINDS] as (WarpKind | `none`)[], (v) => `sketchnote-warp-${v}`, warpName, (s) => s.warp, (v) => ({ warp: v }), true);
    this.slider(warpSec, ``, t(`Intensité de la déformation : d'un sens à l'autre, 0 pour aucune`), -100, 100, 5, (s) => Math.round(s.warpAmount * 100), (v) => ({ warpAmount: v / 100 }), (s) => s.warp !== `none`);
    this.checkbox(warpSec, t(`Texte vertical`), (s) => s.vertical, (on) => ({ vertical: on }));

    // The effects of every element: the opacity, then the shadow and the reflection, which are checked to be used and then unfold their settings.
    const effectSec = this.section(props, `effects`);
    this.sectionIcon(effectSec, `sketchnote-shadow-soft`, t(`Effets`));
    this.slider(effectSec, t(`Opacité de l'élément`), t(`Opacité de l'élément`), 5, 100, 5, (s) => Math.round(s.opacity * 100), (v) => ({ opacity: v / 100 }));
    this.checkbox(effectSec, t(`Ombre`), (s) => s.shadow, (on) => ({ shadow: on }));
    const shadowOn = (s: ToolStyle): boolean => s.shadow;
    this.slider(effectSec, t(`Éloignement de l'ombre`), t(`Éloignement de l'ombre`), 0, SHADOW_MAX_DISTANCE, 1, (s) => s.shadowDistance, (v) => ({ shadowDistance: v }), shadowOn);
    this.slider(effectSec, t(`Flou de l'ombre`), t(`Flou de l'ombre`), 0, SHADOW_MAX_BLUR, 1, (s) => s.shadowBlur, (v) => ({ shadowBlur: v }), shadowOn);
    this.slider(effectSec, t(`Densité de l'ombre`), t(`Densité de l'ombre : plus ou moins sombre`), 5, 100, 5, (s) => Math.round(s.shadowOpacity * 100), (v) => ({ shadowOpacity: v / 100 }), shadowOn);
    this.shadowColorButton(effectSec, shadowOn);
    this.checkbox(effectSec, t(`Reflet`), (s) => s.reflection, (on) => ({ reflection: on }));
    const reflectOn = (s: ToolStyle): boolean => s.reflection;
    this.slider(effectSec, t(`Profondeur du reflet`), t(`Profondeur du reflet : la part de l'élément reflétée`), 10, 100, 5, (s) => Math.round(s.reflectionDepth * 100), (v) => ({ reflectionDepth: v / 100 }), reflectOn);
    this.slider(effectSec, t(`Dégradé du reflet`), t(`Dégradé du reflet : de pas de dégradé à un reflet qui disparaît`), 0, 100, 5, (s) => Math.round(s.reflectionFade * 100), (v) => ({ reflectionFade: v / 100 }), reflectOn);
    this.slider(effectSec, t(`Éloignement du reflet`), t(`Éloignement du reflet : de bord à bord à un reflet éloigné`), 0, 100, 5, (s) => Math.round(s.reflectionGap * 100), (v) => ({ reflectionGap: v / 100 }), reflectOn);

    this.swatchRows = { stroke: strokeRow, fill: fillRow };
    this.refreshSwatches();
  }

  // The sections of the panel, each with the test that tells for which kind of element it is shown.
  private readonly sections: { el: HTMLElement; name: PanelSection }[] = [];
  // Functions that show the current style in parts of the panel that are drawn by hand.
  private readonly syncers: ((s: ToolStyle) => void)[] = [];
  private readonly dropdowns: { el: HTMLElement; label: string; icon: (s: ToolStyle) => string; name: (s: ToolStyle) => string; shown?: (s: ToolStyle) => string }[] = [];
  private fontSelect: HTMLSelectElement | null = null;

  // Adds a section to the panel.
  private section(props: HTMLElement, name: PanelSection): HTMLElement {
    const el = props.createDiv({ cls: `sketchdraw-section` });
    this.sections.push({ el, name });
    return el;
  }

  // The boxes to check of the panel (the shadow and the reflection): each one reads its state from the style that the panel shows and changes the style when it is checked.
  private readonly checks: { input: HTMLInputElement; read: (s: ToolStyle) => boolean }[] = [];
  // The parts of the panel that show only when a test is true for the style (the colour of the shadow).
  private readonly folds: { el: HTMLElement; visible: (s: ToolStyle) => boolean }[] = [];
  private shadowSwatch: HTMLElement | null = null;

  // Adds a box to check, with its name written next to it.
  private checkbox(parent: HTMLElement, label: string, read: (s: ToolStyle) => boolean, write: (on: boolean) => StylePatch): void {
    const wrap = parent.createEl(`label`, { cls: `sketchdraw-check` });
    const input = wrap.createEl(`input`, { type: `checkbox` });
    wrap.createSpan({ text: label });
    input.addEventListener(`change`, () => this.change(write(input.checked)));
    this.checks.push({ input, read });
  }

  // Adds the colour of the shadow: a round swatch that shows it. A double click opens the colour window to change it.
  private shadowColorButton(parent: HTMLElement, visible: (s: ToolStyle) => boolean): void {
    const row = parent.createDiv({ cls: `sketchdraw-row sketchdraw-shadow-colour` });
    row.createSpan({ cls: `sketchdraw-slider-label`, text: t(`Couleur de l'ombre`) });
    const b = row.createEl(`button`, { cls: `sketchdraw-swatch` });
    b.setAttribute(`aria-label`, t(`Couleur de l'ombre`));
    b.setAttribute(`title`, `${t(`Couleur de l'ombre`)} : ${t(`double clic pour changer`)}`);
    b.addEventListener(`dblclick`, () => {
      new ColorModal(this.app, this.currentStyle().shadowColor, (choice: ColorChoice) => {
        if (choice.color !== null) this.change({ shadowColor: choice.color });
      }).open();
    });
    this.shadowSwatch = b;
    this.folds.push({ el: row, visible });
  }

  // The sliders of the panel. Each one reads its value from the style that the panel shows, and changes the style when it is moved; it can be hidden when it does not apply.
  private readonly sliders: { wrap: HTMLElement; input: HTMLInputElement; read: (s: ToolStyle) => number; visible?: (s: ToolStyle) => boolean }[] = [];

  // Adds a slider as wide as the panel. `label` is a word above it (empty for none) and `help` its tooltip.
  private slider(parent: HTMLElement, label: string, help: string, min: number, max: number, step: number, read: (s: ToolStyle) => number, write: (v: number) => StylePatch, visible?: (s: ToolStyle) => boolean): void {
    const wrap = parent.createDiv({ cls: `sketchdraw-slider` });
    if (label !== ``) wrap.createSpan({ cls: `sketchdraw-slider-label`, text: label });
    const input = wrap.createEl(`input`, { cls: `sketchdraw-range`, type: `range` });
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute(`aria-label`, help);
    input.setAttribute(`title`, help);
    input.addEventListener(`input`, () => this.change(write(Number(input.value))));
    this.sliders.push({ wrap, input, read, visible });
  }

  // Adds the choice of the brush: a button that shows the pictogram of the brush (a stroke drawn with it, wide) and its name, which opens the list of the brushes, each with a stroke
  // drawn with it. The pictograms are drawn with the same code as the brushes themselves, so that they look like what the brush makes.
  private brushPicker(parent: HTMLElement): void {
    const wrap = parent.createDiv({ cls: `sketchdraw-brushes` });
    const button = wrap.createEl(`button`, { cls: `sketchdraw-brush-current` });
    button.setAttribute(`aria-label`, t(`Pinceau`));
    const list = wrap.createDiv({ cls: `sketchdraw-brush-list` });
    const rows: { brush: BrushKind; el: HTMLElement }[] = [];
    // Draws a stroke made with a brush in a small picture, in the colour of the text.
    const preview = (host: HTMLElement, brush: BrushKind): void => {
      const svg = svgEl(`svg`, { viewBox: `0 0 100 40`, class: `sketchdraw-brush-preview`, preserveAspectRatio: `xMidYMid meet` }, host);
      const params = paramsOf(brush, {});
      if (brush === `round`) {
        const pts = previewPoints();
        svgEl(`path`, { d: `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(` L`)}`, fill: `none`, stroke: `currentColor`, "stroke-width": 3.2, "stroke-linecap": `round`, "stroke-linejoin": `round` }, svg);
        return;
      }
      const made = brushMake({ brush, points: previewPoints(), width: BRUSH_DEFS[brush].previewWidth, color: `currentColor`, seed: 7, params, dynamic: true });
      // The gaps of a brush with little paint on it, as in the drawing.
      let masked: Element = svg;
      if (made.holes !== ``) {
        previewCount++;
        const mid = `skpm${previewCount}`;
        const mask = svgEl(`mask`, { id: mid, maskUnits: `userSpaceOnUse`, x: -10, y: -10, width: 120, height: 60 }, svgEl(`defs`, {}, svg));
        svgEl(`rect`, { x: -10, y: -10, width: 120, height: 60, fill: `#ffffff` }, mask);
        svgEl(`path`, { d: made.holes, fill: `#000000`, stroke: `none` }, mask);
        masked = svgEl(`g`, { mask: `url(#${mid})` }, svg);
      }
      for (const piece of made.pieces) {
        let into: Element = masked;
        if (piece.blur) {
          // A brush with a soft edge is drawn with its blur in the picture too.
          previewCount++;
          const id = `skpv${previewCount}`;
          const filter = svgEl(`filter`, { id, filterUnits: `userSpaceOnUse`, x: -10, y: -10, width: 120, height: 60 }, svgEl(`defs`, {}, svg));
          svgEl(`feGaussianBlur`, { stdDeviation: piece.blur }, filter);
          into = svgEl(`g`, { filter: `url(#${id})` }, masked);
        }
        svgEl(`path`, { d: piece.d, stroke: piece.stroke, "stroke-width": piece.strokeWidth, fill: piece.fill, opacity: piece.opacity, "stroke-linecap": `round` }, into);
      }
    };
    for (const brush of BRUSH_KINDS) {
      const row = list.createEl(`button`, { cls: `sketchdraw-brush-row` });
      preview(row, brush);
      row.createSpan({ cls: `sketchdraw-brush-name`, text: brushName(brush) });
      row.setAttribute(`aria-label`, brushName(brush));
      row.addEventListener(`click`, () => {
        list.removeClass(`is-open`);
        this.change({ brush });
        this.contentEl.focus({ preventScroll: true });
      });
      rows.push({ brush, el: row });
    }
    button.addEventListener(`click`, () => list.toggleClass(`is-open`, !list.classList.contains(`is-open`)));
    this.syncers.push((s) => {
      button.empty();
      preview(button, s.brush);
      button.createSpan({ cls: `sketchdraw-brush-name`, text: brushName(s.brush) });
      button.setAttribute(`title`, `${t(`Pinceau`)} : ${brushName(s.brush)}`);
      for (const r of rows) r.el.toggleClass(`is-active`, r.brush === s.brush);
    });
  }

  // Adds a drop-down menu: a button that shows the choice that is made (its pictogram, its name as the tooltip) and opens the list of choices, each with its pictogram. The
  // fewer menus the better: only the choices that have too many shapes for buttons go into a menu.
  private dropdown<V extends string>(parent: HTMLElement, label: string, values: V[], icon: (v: V) => string, name: (v: V) => string, read: (s: ToolStyle) => V, write: (v: V) => StylePatch, showName = false): void {
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
    if (showName) button.addClass(`has-name`);
    this.dropdowns.push({ el: button, label, icon: (s) => icon(read(s)), name: (s) => `${label} : ${name(read(s))}`, shown: showName ? (s) => name(read(s)) : undefined });
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
    for (const sec of this.sections) {
      sec.el.toggleClass(`sketchdraw-hidden`, !sectionShown(sec.name, kinds));
      // With nothing selected the choices of the panel have nothing to apply to (a new shape is always standard): they are dimmed, except the settings of a text.
      sec.el.toggleClass(`sketchdraw-idle`, (this.selected.size === 0 && !this.usableBeforeDrawing(sec.name)) || allLocked(this.elementsOf(this.doc), this.selected));
    }
  }

  // Tells whether a section of the panel can be used before anything is drawn: the settings of a text, and the settings of the pen (its brush and its regularity, and with the pen
  // tool its colour and its thickness too), which are kept for the next strokes.
  private usableBeforeDrawing(name: PanelSection): boolean {
    if (name === `text` || name === `regularity` || name === `brush`) return true;
    return this.tool === `pen` && (name === `colour` || name === `width`);
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

  // Returns the five fill swatches of the drawing.
  private fillSwatchList(): (FillSwatch | null)[] {
    return this.doc.fillPalette ?? defaultFillPalette(this.doc.ink);
  }

  // Draws the five round swatches of the stroke and the five of the fill. A click chooses a swatch, a double click opens the colour window to change it.
  private refreshSwatches(): void {
    if (!this.swatchRows) return;
    const make = (row: HTMLElement, index: number, label: string, background: string, empty: boolean, pick: () => void, edit: () => void): HTMLElement => {
      const b = row.createEl(`button`, { cls: `sketchdraw-swatch` });
      b.setAttribute(`aria-label`, label);
      b.setAttribute(`title`, `${label} : ${t(`double clic pour changer`)}`);
      b.style.background = background;
      b.dataset.index = String(index);
      b.toggleClass(`is-empty`, empty);
      b.addEventListener(`click`, () => {
        pick();
        this.contentEl.focus({ preventScroll: true });
      });
      b.addEventListener(`dblclick`, edit);
      return b;
    };
    this.swatchRows.stroke.empty();
    this.strokeSwatches.length = 0;
    this.doc.palette.forEach((color, i) => {
      this.strokeSwatches.push(make(this.swatchRows!.stroke, i, t(`Couleur du trait`), toHex6(color), false, () => this.change({ stroke: color }), () => this.editStrokeSwatch(i)));
    });
    this.swatchRows.fill.empty();
    this.fillSwatches.length = 0;
    this.fillSwatchList().forEach((entry, i) => {
      const pick = (): void => this.change(entry === null ? { fill: null } : { fill: entry.color, fillStyle: entry.style });
      this.fillSwatches.push(make(this.swatchRows!.fill, i, entry === null ? t(`Sans couleur`) : t(`Couleur du remplissage`), swatchBackground(entry), entry === null, pick, () => this.editFillSwatch(i)));
    });
    this.lastPanel = ``;
    this.syncPanel();
  }

  // Opens the colour window for a swatch of the stroke. The new colour replaces the swatch and is applied to the selection.
  private editStrokeSwatch(index: number): void {
    new ColorModal(this.app, this.doc.palette[index] ?? `#000000`, (choice: ColorChoice) => {
      if (choice.color === null) return;
      const palette = this.doc.palette.map((c, i) => (i === index ? choice.color as string : c));
      this.changePalettes({ palette });
      this.change({ stroke: choice.color });
    }).open();
  }

  // Opens the colour window for a swatch of the fill, with the patterns and the button for no colour. The colour and its pattern (or no colour) replace the swatch and are
  // applied to the selection.
  private editFillSwatch(index: number): void {
    const entry = this.fillSwatchList()[index] ?? null;
    new ColorModal(
      this.app,
      entry?.color ?? this.doc.palette[1] ?? `#c0392b`,
      (choice: ColorChoice) => {
        const next: FillSwatch | null = choice.color === null ? null : { color: choice.color, style: choice.style };
        this.changePalettes({ fillPalette: this.fillSwatchList().map((e, i) => (i === index ? next : e)) });
        this.change(next === null ? { fill: null } : { fill: next.color, fillStyle: next.style });
      },
      { fill: true, style: entry?.style ?? `solid`, none: entry === null },
    ).open();
  }

  // Changes the swatches of the drawing and saves it. This is not an undoable change of the drawing: the swatches are kept when something is undone.
  private changePalettes(change: { palette?: string[]; fillPalette?: (FillSwatch | null)[] }): void {
    this.doc = { ...this.doc, ...change };
    this.requestSave();
    this.refreshSwatches();
  }

  // Keeps the swatches of the drawing when an undo or a redo brings back an older state of its elements.
  protected restoreFrom(restored: SketchdrawDoc, current: SketchdrawDoc): SketchdrawDoc {
    return { ...restored, palette: current.palette, ...(current.fillPalette ? { fillPalette: current.fillPalette } : {}) };
  }

  // The colour and the thickness that the pen keeps from one stroke to the next (the other tools always start from the standard look).
  private penLook: { stroke?: string; strokeWidth?: number } = {};

  // The style a new element is made with: the pen adds its own colour and thickness to the standard style.
  protected styleFor(tool: CreationTool): ToolStyle | null {
    return this.style && tool === `pen` ? { ...this.style, ...this.penLook } : this.style;
  }

  // The cursor of the pen: a ring as large as the stroke, or a small target when the stroke is small (see cursors.ts).
  protected creationCursor(): string | null {
    const style = this.styleFor(`pen`);
    if (this.tool !== `pen` || !style) return null;
    const def = BRUSH_DEFS[style.brush];
    const diameter = style.strokeWidth * def.size * (def.shape === `spray` ? 2 : 1) * this.zoom;
    return penCursor(diameter);
  }

  // The style shown in the panel: the one of the first selected element that has one (several elements can be selected: a change then applies to all of them), otherwise the
  // standard style, which is the one of every new element.
  private currentStyle(): ToolStyle {
    for (const el of this.selectedElements()) {
      const s = styleOf(el);
      if (s) return s;
    }
    const base = this.style ?? defaultStyle(`#000000`);
    return this.tool === `pen` ? { ...base, ...this.penLook } : base;
  }

  // Applies a change of style to the selected elements (one change that can be undone). It never changes the look of the next elements: every new element starts from the
  // standard look (a black line, no fill, a normal border, no effect). Only the settings of a text (font, size, alignment) are kept for the next texts.
  private change(patch: StylePatch): void {
    const clean = cleanPatch(patch);
    // A new brush starts from its own usual settings.
    if (clean.brush !== undefined) Object.assign(clean, { ...brushDefaultsPatch(clean.brush), ...clean });
    if (this.style) {
      const keep: StylePatch = {};
      if (clean.font !== undefined) keep.font = clean.font;
      if (clean.fontSize !== undefined) keep.fontSize = clean.fontSize;
      if (clean.align !== undefined) keep.align = clean.align;
      // With the pen, the colour and the thickness are kept for the next strokes (and the cursor follows the thickness).
      if (this.tool === `pen`) {
        if (clean.stroke !== undefined) this.penLook.stroke = clean.stroke;
        if (clean.strokeWidth !== undefined) this.penLook.strokeWidth = clean.strokeWidth;
      }
      if (clean.regularity !== undefined) keep.regularity = clean.regularity;
      if (clean.brush !== undefined) keep.brush = clean.brush;
      for (const key of [`flow`, `hardness`, `spacing`, `form`, `brushAngle`, `grain`, `dynamics`] as const) if (clean[key] !== undefined) Object.assign(keep, { [key]: clean[key] });
      this.style = { ...this.style, ...keep };
    }
    if (this.selected.size > 0) {
      // A text takes the size of its box again when its font or its size changed.
      const next = applyStyleToIds(this.doc.elements, this.selected, clean).map((e) => (e.type === `text` ? refitText(e, this.api.fonts.measure) : e));
      if (next.some((e, i) => e !== this.doc.elements[i])) this.commitElements(next);
    }
    this.lastPanel = ``;
    this.syncPanel();
    this.updateCursor();
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
      // A menu that shows the name of its choice next to its pictogram, as the menu does when it is open.
      if (d.shown) d.el.createSpan({ cls: `sketchdraw-menu-name`, text: d.shown(s) });
      d.el.setAttribute(`aria-label`, d.name(s));
      d.el.setAttribute(`title`, d.name(s));
    }
    for (const f of this.syncers) f(s);
    if (this.iconName) {
      const icon = this.selectedElements().find((e): e is IconElement => e.type === `icon`);
      this.iconName.setText(icon ? (icon.icon ? `Lucide : ${icon.icon}` : icon.name ?? ``) : ``);
    }
    for (const sw of this.strokeSwatches) sw.toggleClass(`is-active`, this.doc.palette[Number(sw.dataset.index)] !== undefined && toHex6(this.doc.palette[Number(sw.dataset.index)]) === toHex6(s.stroke));
    const fills = this.fillSwatchList();
    for (const sw of this.fillSwatches) sw.toggleClass(`is-active`, swatchMatches(fills[Number(sw.dataset.index)] ?? null, s.fill, s.fillStyle));
    for (const sl of this.sliders) {
      sl.input.value = String(sl.read(s));
      sl.wrap.toggleClass(`sketchdraw-hidden`, sl.visible ? !sl.visible(s) : false);
    }
    for (const c of this.checks) c.input.checked = c.read(s);
    for (const f of this.folds) f.el.toggleClass(`sketchdraw-hidden`, !f.visible(s));
    if (this.shadowSwatch) this.shadowSwatch.style.background = toHex6(s.shadowColor);
    if (this.fontSelect) this.fontSelect.value = s.font;
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
