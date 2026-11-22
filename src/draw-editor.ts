// The editor of drawings, shared by the view of a drawing note and by the view of a page: a column of buttons on the right, the menu of the active button (tools and properties of the
// lines and fills), text, pictures and icons. The engine (zoom, selection, undo...) is in CanvasView; what depends on the document is given by the view that extends this class.
import { Menu, Notice, setIcon, WorkspaceLeaf } from "obsidian";
import { CanvasView, Tool } from "./canvas-view";
import { ColorChoice, ColorModal } from "./color-modal";
import { ConfirmModal } from "./confirm-modal";
import { ImageModal } from "./image-modal";
import { imageUrl } from "./image-registry";
import { importImages } from "./image-import";
import { IconModal, warningText } from "./icon-modal";
import { iconData } from "./icon-registry";
import { iconToElements, strokeCount } from "./icon-strokes";
import type { IconData } from "./icon-svg";
import type { IconEntry } from "./icon-themes";
import { DrawButtonsModal } from "./draw-buttons-list";
import { DrawFunction, drawFunctions, DrawFunctionId, functionOfTool, railItems } from "./draw-functions";
import { swatchBackground } from "./swatches";
import { toHex6 } from "./page-background";
import { BORDER_KINDS, BorderKind, CORNER_RADII, SHADOW_MAX_BLUR, SHADOW_MAX_DISTANCE } from "./effects";
import { ArrowElement, IconElement, ImageElement, MAX_ROUGHNESS, Head, HEADS, LineElement, Point, SketchElement, TextElement } from "./elements";
import { fontStack } from "./fonts";
import { openTextEditor } from "./text-editor";
import { refitText, wrapLines } from "./text-layout";
import { Box, rotatePoint } from "./geometry";
import { brightness } from "./page-background";
import { currentLang, t } from "./i18n";
import { panelKinds, PanelSection, sectionShown } from "./panel-kinds";
import { BRUSH_DEFS, BRUSH_KINDS, BrushKind, BrushParam, brushMake, paramsOf, previewPoints } from "./brushes";
import { eraserCursor, penCursor } from "./cursors";
import { allLocked, isLocked } from "./lock";
import { MAX_REGULARITY } from "./tidy";
import { WARP_KINDS, WarpKind } from "./text-warp";
import { PluginApi } from "./plugin-api";
import { FIELD_KINDS, presetValues } from "./field-values";
import { valueField } from "./value-field";
import { firstFreePath } from "./free-path";
import { LibraryModal, SaveDrawingModal } from "./library-modal";
import { drawingFromSelection, libraryElements, libraryName, libraryPath, PLACE_SHARE, placeDrawing } from "./library-file";
import { serializeSketchdraw, SketchdrawDoc } from "./drawing-file";
import { svgEl } from "./svg";
import { applyStyleToIds, brushDefaultsPatch, cleanPatch, defaultStyle, MAX_WIDTH, MIN_WIDTH, StylePatch, styleOf, TEXT_SIZES, ToolStyle } from "./style";
import { CreationTool, textElement, zoneElement, zoneFontSize } from "./tools";
import { isLabeledShape, labelBox, labelColor, LabeledShape, pathMiddle } from "./labels";
import { hitTop } from "./geometry";
import { newId } from "./elements";
import { MIN_ERASE_SIZE } from "./erase-data";
import { effectiveToolKeys, isFunctionKeyId, isKeyTool, KEY_TOOLS, keyTable, ToolKeys } from "./tool-keys";
import { commandHotkeyText, functionCommandId } from "./hotkeys";
import { MIN_STAMP_SIZE, STAMP_IDS, stampName, StampId } from "./stamps";
import { DEFAULT_PORTRAIT, DEFAULT_PORTRAIT_LOOK, DEFAULT_PORTRAIT_SIZE, PortraitData, portraitElement, withPortrait } from "./portrait";
import { PortraitWindow } from "./portrait-window";
import { BUILD_IDS, buildName, LOOK_IDS, LookId, lookName, faceName, FACE_IDS, FaceId, BuildId, figureName, MIN_FIGURE_SIZE, MAX_FIGURE_SIZE, PoseId, POSE_IDS } from "./figure";
import { BUBBLE_FORMS, BubbleForm, FESTOON_FORMS, FestoonForm, ShapeForm } from "./shape-forms";

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

export abstract class DrawEditor<D> extends CanvasView<D> {
  protected readonly api: PluginApi;
  protected lastPanel = ``;
  // The two round swatches of the colours: the border and the fill. Each one shows the colour that applies and opens the window of the colours.
  protected strokePastille: HTMLElement | null = null;
  protected fillPastille: HTMLElement | null = null;
  protected readonly panelButtons: { el: HTMLElement; test: (s: ToolStyle) => boolean }[] = [];
  // The text being written (hidden while the text area is over it) and the function that ends the writing.
  protected editingText: string | null = null;
  // The shape whose text is being written (its text is hidden while the text area is over it).
  protected editingLabel: string | null = null;
  protected finishEditor: (() => void) | null = null;
  protected unsubscribeFonts: (() => void) | null = null;

  // Creates the view inside a workspace leaf, with the services of the plugin.
  constructor(leaf: WorkspaceLeaf, api: PluginApi, empty: D) {
    super(leaf, empty);
    this.api = api;
    // A tool stays chosen after each shape, as the pen does, until Escape or another tool.
    this.toolLocked = true;
    this.style = defaultStyle(`#000000`);
  }

  // Ends a text being written and stops following the list of fonts when the view closes.
  async onClose(): Promise<void> {
    this.finishEditor?.();
    this.unsubscribeFonts?.();
    this.unsubscribeFonts = null;
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    this.cancelPendingContent();
    this.portraitWindow?.close();
    this.flyout?.remove();
    this.flyout = null;
    this.shortcutsBox?.remove();
    this.shortcutsBox = null;
    await super.onClose();
  }

  // Reads the file, then takes its ink as the colour of new lines and offers its palette.
  setViewData(data: string, clear: boolean): void {
    super.setViewData(data, clear);
    this.style = defaultStyle(this.inkOf());
    this.lastPanel = ``;
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // Tells whether a section of the menu may show (a view that is in a mode that has no use of some sections, as the page in its structure mode, keeps them out).
  protected sectionAllowed(_name: PanelSection): boolean {
    return true;
  }

  // The ink of the document (the colour of new lines), and its palette of colours.
  protected abstract inkOf(): string;
  protected abstract paletteOf(): string[];
  // The section of the display of the menu and what it needs to be drawn again: a view that has something to show there overrides them.
  protected buildDisplaySection(_sec: HTMLElement): void {
    void _sec;
  }
  protected refreshDisplay(): void {}

  // ---------------------------------------------------------------------------------------------------------------- what the engine asks

  // The elements to draw: all of them, without the text that is being written, and the shape being written in without its text.
  protected visibleElements(): SketchElement[] {
    if (this.editingText === null && this.editingLabel === null) return this.elementsOf(this.doc);
    return this.elementsOf(this.doc)
      .filter((e) => e.id !== this.editingText)
      .map((e) => {
        if (e.id !== this.editingLabel || !(isLabeledShape(e) || e.type === `line` || e.type === `arrow`)) return e;
        const { label: _l, ...rest } = e;
        void _l;
        return rest as SketchElement;
      });
  }


  protected creationTools(): CreationTool[] {
    return [`rect`, `diamond`, `ellipse`, `triangle`, `bubble`, `festoon`, `arrow`, `line`, `pen`, `point`, `figure`];
  }

  // Runs a function of the drawer: the same as a click on its button.
  runFunction(id: string): boolean {
    if (!this.functionsAvailable()) return false;
    const fn = drawFunctions().find((f) => f.id === id);
    if (!fn) return false;
    this.chooseFunction(fn);
    return true;
  }

  canRunFunction(): boolean {
    return this.functionsAvailable();
  }

  // Tells whether the functions of the drawer can be run now (a view that has a mode without them overrides it).
  protected functionsAvailable(): boolean {
    return true;
  }

  // The keys of the tools for the language of the plugin.
  protected toolKeyList(): ToolKeys {
    return effectiveToolKeys(this.api.settings().toolKeys, currentLang());
  }

  // The keys that choose a tool come from the settings.
  protected toolKeys(): Record<string, Tool> {
    return keyTable(this.toolKeyList());
  }

  // The Text tool: a click on a text edits it, a click elsewhere starts a text there, and a drag draws a text zone (a box that the text wraps to).
  protected writeText(p: Point, zone?: Box): void {
    const hit = hitTop(this.elementsOf(this.doc), p, 6 / this.zoom);
    if (hit && hit.type === `text`) this.editText(hit, p);
    else this.editText(null, p, zone);
  }

  // A double click on a text or on a shape, or Enter on a selected one, writes in it: the text of a text, or the text inside a shape.
  protected onActivate(el: SketchElement): void {
    // The text of a locked element cannot be changed.
    if (isLocked(el)) return;
    if (el.type === `text`) this.editText(el, [el.x, el.y]);
    else if (el.type === `icon` && el.portrait) this.openPortrait(el);
    else if (isLabeledShape(el)) this.editLabel(el);
    else if (el.type === `line` || el.type === `arrow`) this.editLineLabel(el);
  }

  // Opens the writing of a text over the surface: a new one at a point (or in a zone that was dragged), or the text of an element, which is hidden while it is written. The writing
  // ends with Escape, Ctrl+Enter or a click elsewhere: the text is then kept, changed or (when empty) removed, as one change that can be undone.
  protected editText(el: TextElement | null, at: Point, dragged?: Box): void {
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
  protected endText(el: TextElement | null, at: Point, text: string, style: ToolStyle, dragged?: Box): void {
    this.finishEditor = null;
    this.editingText = null;
    const clean = text.replace(/\s+$/, ``);
    const measure = this.api.fonts.measure;
    if (el) {
      if (clean === ``) {
        this.selected = new Set();
        this.commitElements(this.elementsOf(this.doc).filter((e) => e.id !== el.id));
      } else if (clean !== el.text) this.commitElements(this.elementsOf(this.doc).map((e) => (e.id === el.id ? refitText({ ...el, text: clean }, measure) : e)));
      else this.renderContent();
    } else if (clean !== ``) {
      const made = dragged ? refitText(zoneElement(dragged, clean, style, newId(this.elementsOf(this.doc))), measure) : textElement(at, clean, style, newId(this.elementsOf(this.doc)), measure);
      this.commitElements([...this.elementsOf(this.doc), made]);
      this.selected = new Set([made.id]);
      // A text ends with the Select tool, so that it can be moved right away (the shapes and the pen stay chosen).
      this.tool = `select`;
    } else this.renderContent();
    this.renderUi();
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // Opens the writing of the text inside a shape: the text area covers the part of the shape that holds the text, and the text of the shape is hidden while it is written. It
  // ends like any text; an empty text takes the text away from the shape.
  protected editLabel(shape: LabeledShape): void {
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
      color: labelColor(shape, this.inkOf()),
      align,
      initial: label ? label.text : ``,
      measure: (line) => this.api.fonts.measure(line, font, size),
      zone: { width: room.w, height: room.h, centered: true, lineCount: (text) => wrapLines(text, room.w, (line) => this.api.fonts.measure(line, font, size)).length },
      onDone: (text) => this.endLabel(shape.id, text, font, size),
    });
  }

  // Opens the writing of the text in the middle of a line or an arrow: the text area is centred on the middle of the line and takes the colour of the drawing, so that the line
  // seems cut under it. The text of the line is hidden while it is written.
  protected editLineLabel(line: LineElement | ArrowElement): void {
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
      around: { background: brightness(this.inkOf()) > 0.5 ? `#2a3631` : `#ffffff` },
      onDone: (text) => this.endLabel(line.id, text, font, size),
    });
  }

  // Keeps the result of the writing of the text inside a shape.
  protected endLabel(id: string, text: string, font: string, size: number): void {
    this.finishEditor = null;
    this.editingLabel = null;
    const clean = text.replace(/\s+$/, ``);
    const current = this.elementsOf(this.doc).find((e) => e.id === id);
    if (current && (isLabeledShape(current) || current.type === `line` || current.type === `arrow`)) {
      const old = current.label;
      if (clean === `` && old) {
        const { label: _l, ...rest } = current;
        void _l;
        this.commitElements(this.elementsOf(this.doc).map((e) => (e.id === id ? (rest as SketchElement) : e)));
      } else if (clean !== `` && (!old || old.text !== clean)) {
        const label = { text: clean, font: old ? old.font : font, size: old ? old.size : size, ...(old?.align ? { align: old.align } : {}) };
        this.commitElements(this.elementsOf(this.doc).map((e) => (e.id === id ? ({ ...current, label } as SketchElement) : e)));
      } else this.renderContent();
    } else this.renderContent();
    this.renderUi();
    this.updateBar();
    this.contentEl.focus({ preventScroll: true });
  }

  // Opens the window of the pictures of the vault (the images folder is created the first time).
  protected async openImages(): Promise<void> {
    try {
      await this.api.drawings.ensureFolder(this.api.settings().imagesFolder);
    } catch {
      // The folder is not available: the pictures of the vault can still be chosen.
    }
    new ImageModal(this.app, () => this.api.settings().imagesFolder, (path) => void this.insertImages([path])).open();
  }

  // Copies pictures dropped or pasted into the images folder, then puts them in the drawing.
  protected async takePictures(files: File[]): Promise<void> {
    const report = await importImages(this.app, this.api.settings().imagesFolder, files);
    if (report.paths.length > 0) await this.insertImages(report.paths);
    const bad = report.skipped.length + report.failed.length;
    if (bad > 0) new Notice(t(`Fichiers non utilisables comme images (type inconnu, trop volumineux ou copie impossible) : {0}`, [...report.skipped, ...report.failed].join(`, `)));
  }

  // Returns the size that a picture of the vault has once loaded, or null when it cannot be read within a few seconds.
  protected measurePicture(path: string): Promise<[number, number] | null> {
    const url = imageUrl(path);
    if (url === null) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => resolve(null), 4000);
      img.onload = () => {
        window.clearTimeout(timer);
        resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? [img.naturalWidth, img.naturalHeight] : null);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(null);
      };
      img.src = url;
    });
  }

  // Returns the middle of the part of the surface that is seen, in page units.
  protected viewCentre(): Point {
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
    return [cx, cy];
  }

  // Puts pictures of the vault in the middle of what is shown, as one change that can be undone: each one keeps its proportions (the longest side is at most 360), has no border
  // and the standard look, and is selected. Several pictures are placed one after the other, a little apart.
  protected async insertImages(paths: string[]): Promise<void> {
    if (!this.style) return;
    const made: SketchElement[] = [];
    const [cx, cy] = this.viewCentre();
    for (const path of paths) {
      const size = await this.measurePicture(path);
      const [nw, nh] = size ?? [4, 3];
      const k = Math.min(1, 360 / Math.max(nw, nh));
      const width = Math.max(24, Math.round(nw * k * (size ? 1 : 60)));
      const height = Math.max(24, Math.round(nh * k * (size ? 1 : 60)));
      const shift = made.length * 24;
      made.push({ id: newId([...this.elementsOf(this.doc), ...made]), type: `image`, x: Math.round(cx - width / 2 + shift), y: Math.round(cy - height / 2 + shift), width, height, path, stroke: this.style.stroke, strokeWidth: this.style.strokeWidth, roughness: this.style.roughness, seed: Math.floor(Math.random() * 1000000) + 1 });
    }
    if (made.length === 0) return;
    this.selected = new Set(made.map((m) => m.id));
    this.tool = `select`;
    this.commitElements([...this.elementsOf(this.doc), ...made]);
  }

  // The crop mode: the handles of the selected picture cut its sides. It stops by itself when the selection is no longer one picture.
  protected cropMode = false;

  protected isCropping(): boolean {
    const only = this.selectedElements();
    if (this.cropMode && !(only.length === 1 && only[0].type === `image` && !isLocked(only[0]))) this.cropMode = false;
    return this.cropMode;
  }

  // Changes the selected pictures that are not locked with a function (their path, their crop or their border), as one change that can be undone.
  protected editPictures(change: (el: ImageElement) => ImageElement): void {
    const ids = new Set(this.selectedElements().filter((e) => e.type === `image` && !isLocked(e)).map((e) => e.id));
    if (ids.size === 0) return;
    this.commitElements(this.elementsOf(this.doc).map((e) => (e.type === `image` && ids.has(e.id) ? change(e) : e)));
  }

  // The line of the panel that names the file of the picture that is selected.
  protected imageName: HTMLElement | null = null;

  // Returns a picture whose crop was removed with its box widened to show the whole picture at the same scale (the visible part keeps its size on the page).
  protected keepRatioAfterCrop(el: ImageElement, rest: ImageElement): ImageElement {
    const [cl, ct, cr, cb] = el.crop ?? [0, 0, 0, 0];
    const width = el.width / (1 - cl - cr);
    const height = el.height / (1 - ct - cb);
    // The new centre, in the frame of the picture (before its rotation), then on the page.
    const dx = -cl * width + width / 2 - el.width / 2;
    const dy = -ct * height + height / 2 - el.height / 2;
    const c: Point = [el.x + el.width / 2, el.y + el.height / 2];
    const moved = rotatePoint([c[0] + dx, c[1] + dy], c, el.angle ?? 0);
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    return { ...rest, x: r2(moved[0] - width / 2), y: r2(moved[1] - height / 2), width: r2(width), height: r2(height) };
  }

  // The line of the panel that names the icon that is selected.
  protected iconName: HTMLElement | null = null;

  // Opens the window of the icons: Lucide, and the SVG drawings that the user keeps in the folder of the icons (which is created the first time).
  // Opens the library of drawings: a click on a drawing puts it on the page, in the middle of the view.
  protected openLibrary(): void {
    void this.api.drawings.ensureFolder(this.api.settings().libraryFolder).catch(() => undefined);
    new LibraryModal(this.app, () => this.api.settings().libraryFolder, (doc) => this.insertLibraryDrawing(doc)).open();
  }

  // Puts a drawing of the library on the page: in the middle of the view, at its size (smaller when it is wider than half of the view), as one group, selected.
  protected insertLibraryDrawing(doc: SketchdrawDoc): void {
    const scroller = this.scroller;
    const room = scroller && scroller.clientWidth > 0 ? (scroller.clientWidth / this.zoom) * PLACE_SHARE : 400;
    const existing = this.elementsOf(this.doc);
    const placed = placeDrawing(doc, this.viewCentre(), room, existing);
    if (placed.length === 0) {
      new Notice(t(`Ce dessin est vide.`));
      return;
    }
    this.commitElements([...existing, ...placed]);
    this.tool = `select`;
    this.selected = new Set(placed.map((e) => e.id));
    this.renderUi();
    this.updateBar();
  }

  // Keeps the selection as a drawing of the library: asks its name, then writes the note in the folder of the library.
  protected saveSelectionToLibrary(): void {
    const kept = libraryElements(this.elementsOf(this.doc), this.selected);
    const doc = drawingFromSelection(kept, this.inkOf(), this.paletteOf());
    if (!doc) {
      new Notice(t(`Sélectionnez d'abord ce qu'il faut garder dans la bibliothèque.`));
      return;
    }
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, `0`);
    const proposed = `${t(`Dessin`)} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
    new SaveDrawingModal(this.app, proposed, (name) => void this.writeToLibrary(libraryName(name, proposed), doc)).open();
  }

  private async writeToLibrary(name: string, doc: SketchdrawDoc): Promise<void> {
    try {
      const folder = this.api.settings().libraryFolder;
      await this.api.drawings.ensureFolder(folder);
      const used = new Set(this.app.vault.getFiles().map((f) => f.path));
      const path = await firstFreePath((taken) => libraryPath(folder, name, new Set([...used, ...taken])), (p) => this.app.vault.adapter.exists(p));
      const file = await this.app.vault.create(path, serializeSketchdraw(doc));
      new Notice(t(`Dessin enregistré dans la bibliothèque : {0}`, file.path));
    } catch (e) {
      new Notice(t(`Impossible d'enregistrer le dessin : {0}`, e instanceof Error ? e.message : String(e)));
    }
  }

  protected async openIcons(): Promise<void> {
    try {
      await this.api.drawings.ensureFolder(this.api.icons.folder());
      await this.api.icons.refresh();
    } catch {
      // The folder of the user is not available: Lucide alone is offered.
    }
    new IconModal(this.app, this.api.icons, (entry, data) => this.insertIcon(entry, data)).open();
  }

  // The window of the character: it creates a character in the middle of what is shown, or changes the one that is given (a double click on a character opens it again). The choices are
  // remembered for the next character while the application runs.
  protected portraitWindow: PortraitWindow | null = null;
  private static lastPortrait: PortraitData = { ...DEFAULT_PORTRAIT };
  private static lastPortraitLine = { ...DEFAULT_PORTRAIT_LOOK };

  protected openPortrait(edit: IconElement | null): void {
    this.portraitWindow?.close();
    if (!this.style) return;
    const seed = edit?.seed ?? this.newSeed();
    const ink = edit?.stroke ?? this.style.stroke;
    const window = new PortraitWindow({
      parent: this.contentEl,
      initial: edit?.portrait ?? DrawEditor.lastPortrait,
      editing: edit !== null,
      ink,
      seed,
      roughness: edit ? edit.roughness ?? 0 : DrawEditor.lastPortraitLine.roughness,
      strokeWidth: edit ? edit.strokeWidth : DrawEditor.lastPortraitLine.strokeWidth,
      onOk: (data, line) => {
        DrawEditor.lastPortrait = data;
        DrawEditor.lastPortraitLine = line;
        if (edit) this.changePortrait(edit.id, data, line);
        else this.putPortrait(data, seed, line);
      },
      onClose: () => {
        this.portraitWindow = null;
        this.contentEl.focus({ preventScroll: true });
      },
    });
    this.portraitWindow = window;
    window.open();
  }

  // Puts a new character in the middle of what is shown, as one change that can be undone, and selects it.
  protected putPortrait(data: PortraitData, seed: number, line: { roughness: number; strokeWidth: number }): void {
    if (!this.style) return;
    const elements = this.elementsOf(this.doc);
    let cx = 200;
    let cy = 200;
    if (this.scroller && this.svg) {
      const sr = this.scroller.getBoundingClientRect();
      const r = this.svg.getBoundingClientRect();
      cx = ((Math.max(sr.left, r.left) + Math.min(sr.right, r.right)) / 2 - r.left) / this.zoom;
      cy = ((Math.max(sr.top, r.top) + Math.min(sr.bottom, r.bottom)) / 2 - r.top) / this.zoom;
    }
    const made = portraitElement(data, [cx, cy], DEFAULT_PORTRAIT_SIZE, { stroke: this.style.stroke, strokeWidth: line.strokeWidth, roughness: line.roughness, seed }, newId(elements));
    this.selected = new Set([made.id]);
    this.tool = `select`;
    this.commitElements([...elements, made]);
  }

  // Changes the choices of a character that is on the page, as one change that can be undone.
  protected changePortrait(id: string, data: PortraitData, line: { roughness: number; strokeWidth: number }): void {
    const elements = this.elementsOf(this.doc);
    const next = elements.map((e) => (e.id === id && e.type === `icon` && !isLocked(e) ? { ...withPortrait(e, data), roughness: line.roughness, strokeWidth: line.strokeWidth } : e));
    if (next.some((e, i) => e !== elements[i])) this.commitElements(next);
  }

  // Puts an icon in the middle of what is shown, as one change that can be undone. An icon of Lucide is kept by its name; a drawing of the user carries its shapes. It is made
  // with the standard look (a black line, no fill, no effect) like every new element, and selected so that the panel acts on it.
  protected insertIcon(entry: IconEntry, data: IconData): void {
    if (!this.style) return;
    const elements = this.elementsOf(this.doc);
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
  protected strokesFromIcons(onCancel: () => void = () => undefined): void {
    const icons = this.selectedElements().filter((e): e is IconElement => e.type === `icon` && !isLocked(e));
    if (icons.length === 0) {
      onCancel();
      return;
    }
    const data = icons.map((e) => ({ el: e, data: iconData(e) }));
    const missing = data.filter((d) => d.data === null).length;
    if (missing === data.length) {
      new Notice(t(`Cette icône est inconnue : elle ne peut pas être transformée en traits.`));
      onCancel();
      return;
    }
    const count = data.reduce((n, d) => n + (d.data ? strokeCount(d.data) : 0), 0);
    new ConfirmModal(
      this.app,
      t(`Transformer en traits`),
      t(`{0} deviendra {1} traits ordinaires, groupés, que vous pourrez modifier un par un. Elle ne pourra plus être remplacée par une autre icône ni retrouver sa forme d'origine, sauf en annulant tout de suite (Ctrl+Z). Continuer ?`, icons.length === 1 ? t(`L'icône`) : t(`Les {0} icônes`, String(icons.length)), String(count)),
      () => {
        let next: SketchElement[] = [...this.elementsOf(this.doc)];
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
      onCancel,
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

  // The column of buttons on the right, the menu of the active button above or under the drawing, and what is not a button: the drop of files and the paste of pictures.
  protected rail: HTMLElement | null = null;
  protected context: HTMLElement | null = null;
  protected activeFn: DrawFunctionId = `select`;
  protected lastTool: Tool = `select`;
  protected unsubscribeSettings: (() => void) | null = null;

  protected selectionActionsInBar(): boolean {
    return false;
  }

  protected exportInBar(): boolean {
    return false;
  }

  protected buildSide(main: HTMLElement): void {
    // Pictures are also dropped on the drawing from the computer or pasted from the clipboard.
    this.registerDomEvent(this.contentEl, `dragover`, (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes(`Files`)) e.preventDefault();
    });
    this.registerDomEvent(this.contentEl, `drop`, (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      e.preventDefault();
      void this.takePictures(files);
    });
    this.registerDomEvent(this.contentEl, `paste`, (e: ClipboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith(`image/`));
      if (files.length === 0) return;
      e.preventDefault();
      void this.takePictures(files);
    });
    this.contentEl.addClass(`sketchdraw-has-flyout`);
    this.rail = main.createDiv({ cls: `sketchdraw-rail` });
    // The bottom row: the menu on the left (it scrolls sideways like a ribbon when the window is narrow) and the bar of the undo and the zoom on the right, which never moves. When the
    // row is too narrow the bar goes under the menu. With the setting of the top, the menu is above the drawing and the row holds the bar only.
    const footer = createDiv({ cls: `sketchdraw-footer` });
    this.footer = footer;
    main.after(footer);
    this.mainEl = main;
    const context = createDiv({ cls: `sketchdraw-context` });
    this.context = context;
    this.placeContext(main);
    // The wheel moves the menu sideways (a menu that is wider than the window).
    this.registerDomEvent(context, `wheel`, (e: WheelEvent) => {
      if (context.scrollWidth <= context.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      context.scrollLeft += e.deltaY;
    });
    this.buildContext();
    this.renderRail();
    this.unsubscribeFonts = this.api.fonts.onChange(() => this.refreshFontList());
    // A change of the settings of the buttons draws the column again and moves the menu.
    this.unsubscribeSettings = this.api.onSettings(() => {
      if (this.rail && this.context) {
        this.placeContext(this.mainEl ?? main);
        this.renderRail();
        this.syncPanel();
      }
    });
  }

  // Puts the menu above or under the drawing, as the settings say.
  protected placeContext(main: HTMLElement): void {
    const context = this.context;
    const footer = this.footer;
    if (!context || !footer) return;
    const top = this.api.settings().contextPosition === `top`;
    if (top) main.parentElement?.insertBefore(context, main);
    else footer.insertBefore(context, footer.firstChild);
    context.toggleClass(`is-top`, top);
  }

  protected footer: HTMLElement | null = null;
  // The opacity of the effects: it is hidden while the brush is shown, which has its own.
  protected opacityBox: HTMLElement | null = null;
  protected mainEl: HTMLElement | null = null;

  // The bottom bar is in the row of the menu, at its right.
  protected barHost(host: HTMLElement): HTMLElement {
    return this.footer ?? host;
  }

  // Builds the content of the menu: the tools of each function, the pin that keeps the tool active, then the sections of the properties. It is built again when the setting of the words
  // changes (the words are written into the buttons).
  protected buildContext(): void {
    const context = this.context;
    if (!context) return;
    context.empty();
    this.dropdowns.length = 0;
    this.panelButtons.length = 0;
    this.sections.length = 0;

    this.toolButtons.clear();
    this.checks.length = 0;
    this.folds.length = 0;
    this.sliders.length = 0;
    this.syncers.length = 0;
    const props = context.createDiv({ cls: `sketchdraw-props` });
    this.buildProps(props);
    this.lastPanel = ``;
    this.updateBar();
  }

  // Draws the column of buttons: the button of the plugin first (it opens the list of the buttons), then the functions in the order of the settings, without the hidden ones and with
  // the separations. The name of a button is its tooltip, written once (a pictogram only).
  protected renderRail(): void {
    const rail = this.rail;
    if (!rail) return;
    rail.empty();
    const settings = this.api.settings();
    const menu = rail.createEl(`button`, { cls: `sketchnote-bar-button sketchdraw-rail-button sketchdraw-rail-menu` });
    setIcon(menu, `sketchnote-logo`);
    menu.setAttribute(`aria-label`, t(`Boutons du dessinateur`));
    menu.addEventListener(`click`, () => this.openButtonsWindow());
    const functions = drawFunctions();
    for (const id of railItems(settings.drawButtonsOrder, settings.drawButtonsHidden)) {
      if (id.startsWith(`sep:`)) {
        rail.createDiv({ cls: `sketchdraw-rail-separator` });
        continue;
      }
      const fn = functions.find((f) => f.id === id);
      if (!fn) continue;
      const button = rail.createEl(`button`, { cls: `sketchnote-bar-button sketchdraw-rail-button` });
      button.dataset.fn = fn.id;
      const variants = this.variantsOf(fn.id);
      const icon = variants && variants.showChoice ? variants.icon(variants.read(this.toolStyle())) : fn.icon;
      button.dataset.icon = icon;
      setIcon(button, icon);
      // The name and the shortcut: the key of a tool, or the hotkey that was given to the function in the settings of Obsidian. It is read again when the pointer comes over the button.
      const label = (): string => {
        const keyText = isKeyTool(fn.tools[0]) ? this.toolKeyList()[fn.tools[0]].toUpperCase() : isFunctionKeyId(fn.id) ? commandHotkeyText(this.app, functionCommandId(fn.id), t(`Maj`)) : ``;
        return keyText === `` ? fn.name() : `${fn.name()} (${keyText})`;
      };
      button.setAttribute(`aria-label`, label());
      button.addEventListener(`mouseover`, () => button.setAttribute(`aria-label`, label()));
      button.toggleClass(`is-active`, this.activeFn === fn.id);
      button.addEventListener(`click`, () => {
        // A second click on the active button of a function that has forms closes or opens its floating menu.
        if (variants && this.activeFn === fn.id && this.tool === fn.tools[0]) {
          this.flyoutHidden = !this.flyoutHidden;
          this.syncFlyout();
          this.contentEl.focus({ preventScroll: true });
          return;
        }
        this.chooseFunction(fn);
      });
    }
    this.syncFlyout();
  }

  // Whether the floating menu of the keys is shown (kept while the application runs, shared by the drawings that are open).
  protected static shortcutsShown = false;
  protected shortcutsBox: HTMLElement | null = null;
  protected shortcutsToggle: HTMLElement | null = null;
  protected shortcutsPos: { left: number; top: number } | null = null;

  // Shows the floating menu of the keys of the tools (a pictogram and the key of each tool, a click chooses the tool), or removes it. It is drawn again when the keys change.
  protected syncShortcuts(): void {
    this.shortcutsBox?.remove();
    this.shortcutsBox = null;
    this.shortcutsToggle?.toggleClass(`is-active`, DrawEditor.shortcutsShown);
    const rail = this.rail;
    if (!DrawEditor.shortcutsShown || !rail || rail.offsetParent === null) return;
    const keys = this.toolKeyList();
    const box = this.contentEl.createDiv({ cls: `sketchdraw-flyout sketchdraw-shortcuts` });
    this.shortcutsBox = box;
    const handle = box.createDiv({ cls: `sketchdraw-flyout-handle` });
    handle.setAttribute(`aria-label`, t(`Raccourcis clavier`));
    const list = box.createDiv({ cls: `sketchdraw-shortcuts-list` });
    const functions = drawFunctions();
    for (const tool of KEY_TOOLS) {
      const fn = functions.find((f) => f.tools[0] === tool);
      if (!fn) continue;
      const row = list.createEl(`button`, { cls: `sketchdraw-shortcut` });
      row.dataset.tool = tool;
      const variants = this.variantsOf(fn.id);
      const icon = row.createSpan({ cls: `sketchdraw-shortcut-icon` });
      setIcon(icon, variants && variants.showChoice ? variants.icon(variants.read(this.toolStyle())) : fn.icon);
      row.createSpan({ cls: `sketchdraw-shortcut-key`, text: keys[tool].toUpperCase() });
      row.setAttribute(`aria-label`, `${fn.name()} : ${keys[tool].toUpperCase()}`);
      row.toggleClass(`is-active`, this.tool === tool);
      row.addEventListener(`click`, () => this.chooseFunction(fn));
    }
    const host = this.contentEl.getBoundingClientRect();
    const pos = this.shortcutsPos ?? { left: host.width - box.offsetWidth - 70, top: 40 };
    this.placeFlyout(box, pos.left, pos.top);
    this.dragFlyout(handle, box, (left, top) => {
      this.shortcutsPos = { left, top };
    });
  }

  // Lights the tool that is active in the floating menu of the keys.
  protected refreshShortcuts(): void {
    if (!this.shortcutsBox) return;
    for (const row of Array.from(this.shortcutsBox.querySelectorAll<HTMLElement>(`.sketchdraw-shortcut`))) row.toggleClass(`is-active`, row.dataset.tool === this.tool);
  }

  // The style of the tool itself (the one of the next elements), not the one of the selection.
  protected toolStyle(): ToolStyle {
    return this.style ?? defaultStyle(`#000000`);
  }

  // The forms that a function offers in its floating menu (bubble, festoon, point and eraser), or null for a function that has none.
  protected variantsOf(id: DrawFunctionId): Variants | null {
    switch (id) {
      case `bubble`:
        return { showChoice: true, values: [...BUBBLE_FORMS], icon: (v) => bubbleFormIcon(v as ShapeForm), name: (v) => formName(v as ShapeForm), read: (s) => s.bubbleForm, write: (v) => ({ bubbleForm: v as BubbleForm }) };
      case `festoon`:
        return { showChoice: true, values: [...FESTOON_FORMS], icon: (v) => bubbleFormIcon(v as ShapeForm), name: (v) => formName(v as ShapeForm), read: (s) => s.festoonForm, write: (v) => ({ festoonForm: v as FestoonForm }) };
      case `point`:
        return { showChoice: true, values: [...STAMP_IDS], icon: (v) => `sketchnote-stamp-${v}`, name: (v) => stampName(v as StampId), read: (s) => s.stamp, write: (v) => ({ stamp: v as StampId }) };
      case `figure`:
        return { showChoice: true, values: [...POSE_IDS], icon: (v) => `sketchnote-pose-${v}`, name: (v) => figureName(v as PoseId), read: (s) => s.figure, write: (v) => ({ figure: v as PoseId }) };
      case `eraser`:
        return {
          showChoice: false,
          values: [`soft`, `round`, `square`],
          icon: (v) => `sketchnote-erase-${v}`,
          name: (v) => (v === `soft` ? t(`Pointe douce`) : v === `round` ? t(`Pointe ronde`) : t(`Pointe carrée`)),
          read: (s) => s.eraseShape,
          write: (v) => ({ eraseShape: v as StylePatch[`eraseShape`] }),
        };
      default:
        return null;
    }
  }

  protected flyout: HTMLElement | null = null;
  protected flyoutHidden = false;
  protected flyoutFn: DrawFunctionId | null = null;
  // Where the user dragged the floating menu to (relative to the view), kept while the view is open.
  protected flyoutPos: { left: number; top: number } | null = null;

  // Shows the floating menu of the active function (beside its button, on its left), or removes it. It stays while the tool is active; a second click on the button closes it.
  protected syncFlyout(): void {
    this.syncShortcuts();
    if (this.flyoutFn !== this.activeFn) {
      this.flyoutFn = this.activeFn;
      this.flyoutHidden = false;
    }
    this.flyout?.remove();
    this.flyout = null;
    const variants = this.variantsOf(this.activeFn);
    const fn = drawFunctions().find((f) => f.id === this.activeFn);
    const rail = this.rail;
    if (!variants || !fn || this.flyoutHidden || !rail || this.tool !== fn.tools[0]) return;
    const anchor = Array.from(rail.querySelectorAll<HTMLElement>(`.sketchdraw-rail-button`)).find((b) => b.dataset.fn === fn.id);
    if (!anchor || anchor.offsetParent === null) return;
    const box = this.contentEl.createDiv({ cls: `sketchdraw-flyout` });
    this.flyout = box;
    const handle = box.createDiv({ cls: `sketchdraw-flyout-handle` });
    handle.setAttribute(`aria-label`, fn.name());
    const list = box.createDiv({ cls: `sketchdraw-flyout-list` });
    for (const value of variants.values) {
      const b = list.createEl(`button`, { cls: `sketchnote-bar-button sketchdraw-flyout-button` });
      b.dataset.value = value;
      setIcon(b, variants.icon(value));
      b.setAttribute(`aria-label`, variants.name(value));
      b.toggleClass(`is-active`, variants.read(this.toolStyle()) === value);
      b.addEventListener(`click`, () => {
        this.change(variants.write(value));
        this.contentEl.focus({ preventScroll: true });
      });
    }
    // The column is as many columns as needed, eleven buttons high at most.
    list.style.gridTemplateRows = `repeat(${Math.min(11, variants.values.length)}, 30px)`;
    const host = this.contentEl.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const width = box.offsetWidth;
    const pos = this.flyoutPos ?? { left: rail.getBoundingClientRect().left - host.left - width - 4, top: a.top - host.top - 4 };
    this.placeFlyout(box, pos.left, pos.top);
    this.dragFlyout(handle, box);
  }

  // Puts the floating menu at a place, kept inside the view.
  protected placeFlyout(box: HTMLElement, left: number, top: number): void {
    const host = this.contentEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(host.width - box.offsetWidth, left));
    const y = Math.max(0, Math.min(host.height - box.offsetHeight, top));
    box.style.left = `${Math.round(x)}px`;
    box.style.top = `${Math.round(y)}px`;
  }

  // The top bar of the floating menu moves it.
  protected dragFlyout(handle: HTMLElement, box: HTMLElement, save?: (left: number, top: number) => void): void {
    handle.addEventListener(`pointerdown`, (e: PointerEvent) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX - box.offsetLeft;
      const startY = e.clientY - box.offsetTop;
      const move = (m: PointerEvent): void => {
        this.placeFlyout(box, m.clientX - startX, m.clientY - startY);
        if (save) save(box.offsetLeft, box.offsetTop);
        else this.flyoutPos = { left: box.offsetLeft, top: box.offsetTop };
      };
      const stop = (): void => {
        handle.removeEventListener(`pointermove`, move);
        handle.removeEventListener(`pointerup`, stop);
        handle.removeEventListener(`pointercancel`, stop);
      };
      handle.addEventListener(`pointermove`, move);
      handle.addEventListener(`pointerup`, stop);
      handle.addEventListener(`pointercancel`, stop);
    });
  }

  // Shows the form that is chosen: on the button of the function and in its floating menu.
  protected refreshVariants(s: ToolStyle): void {
    const rail = this.rail;
    if (!rail) return;
    for (const b of Array.from(rail.querySelectorAll<HTMLElement>(`.sketchdraw-rail-button`))) {
      const id = b.dataset.fn as DrawFunctionId | undefined;
      const variants = id ? this.variantsOf(id) : null;
      if (!variants) continue;
      if (!variants.showChoice) continue;
      const icon = variants.icon(variants.read(this.toolStyle()));
      if (b.dataset.icon !== icon) {
        b.dataset.icon = icon;
        b.empty();
        setIcon(b, icon);
      }
    }
    const variants = this.variantsOf(this.activeFn);
    if (this.flyout && variants) for (const b of Array.from(this.flyout.querySelectorAll<HTMLElement>(`.sketchdraw-flyout-button`))) b.toggleClass(`is-active`, variants.read(this.toolStyle()) === b.dataset.value);
    void s;
  }

  // Opens the list where the buttons are checked, ordered and separated.
  protected openButtonsWindow(): void {
    new DrawButtonsModal(this.app, {
      app: this.app,
      order: () => this.api.settings().drawButtonsOrder,
      hidden: () => this.api.settings().drawButtonsHidden,
      save: (order, hidden) => this.api.updateSettings({ drawButtonsOrder: order, drawButtonsHidden: hidden }),
      keys: () => this.toolKeyList(),
      saveKeys: (keys) => this.api.updateSettings({ toolKeys: keys }),
    }).open();
  }

  // A click on a button of the column: its menu shows, its first tool is chosen when it has tools, and a function that has a window opens it.
  protected chooseFunction(fn: DrawFunction): void {
    // The character has a window of its own and no menu: the active function and the tool stay as they were.
    if (fn.opens === `portrait`) {
      this.openPortrait(null);
      return;
    }
    this.activeFn = fn.id;
    if (fn.tools.length > 0 && !fn.tools.includes(this.tool)) this.setTool(fn.tools[0] as Tool);
    this.lastTool = this.tool;
    this.lastPanel = ``;
    this.renderRail();
    this.syncPanel();
    if (fn.id === `display`) this.refreshDisplay();
    if (fn.opens === `icons`) void this.openIcons();
    else if (fn.opens === `images`) void this.openImages();
    else if (fn.opens === `library`) this.openLibrary();
    else if (fn.opens === `export`) this.openExport();
    this.contentEl.focus({ preventScroll: true });
  }

  // Builds the properties panel. It is made of sections, each one shown only for the elements it concerns (the edges for lines and arrows, the heads for arrows, the font for
  // texts, the fill and the width for everything but texts). Every choice is a pictogram; its name is the tooltip.
  protected buildProps(props: HTMLElement): void {
    this.panelButtons.length = 0;
    this.sections.length = 0;
    this.compartments.length = 0;

    // The Point tool and the eraser: only the sizes are here, the shape of the point and the tip of the eraser are chosen in the floating menu of their button.
    const stampSec = this.section(props, `stamp`);
    this.sectionIcon(stampSec, `sketchnote-stamp-star`, t(`Forme du point`));
    this.slider(stampSec, t(`Taille`), t(`Taille de la forme`), MIN_STAMP_SIZE, 120, 1, (st) => st.stampSize, (v) => ({ stampSize: v }));

    // The articulated figure: its face (a menu of fifteen), its build (stick or thick), then its size. The pose is chosen in the floating menu of its button.
    const figureSec = this.section(props, `figure`);
    this.sectionIcon(figureSec, `sketchnote-pose-stand`, t(`Bonhomme`));
    const faces = figureSec.createDiv({ cls: `sketchdraw-row` });
    this.dropdown<FaceId>(faces, t(`Visage`), [...FACE_IDS], (v) => `sketchnote-face-${v}`, faceName, (st) => st.figureFace, (v) => ({ figureFace: v }), true);
    for (const build of BUILD_IDS) this.panelButton(faces, `sketchnote-build-${build}`, buildName(build), (st) => st.figureBuild === build, () => this.change({ figureBuild: build as BuildId }));
    for (const look of LOOK_IDS) this.panelButton(faces, `sketchnote-look-${look}`, lookName(look), (st) => st.figureLook === look, () => this.change({ figureLook: look as LookId }));
    const figureSizeSec = this.section(props, `figuresize`);
    this.sectionIcon(figureSizeSec, `ruler`, t(`Taille`));
    this.slider(figureSizeSec, t(`Taille`), t(`Taille du bonhomme`), MIN_FIGURE_SIZE, MAX_FIGURE_SIZE, 10, (st) => st.figureSize, (v) => ({ figureSize: v }));

    const eraserSec = this.section(props, `eraser`);
    this.sectionIcon(eraserSec, `sketchnote-eraser`, t(`Gomme`));
    this.slider(eraserSec, t(`Taille`), t(`Taille de la gomme`), MIN_ERASE_SIZE, 120, 1, (st) => st.eraseSize, (v) => ({ eraseSize: v }));
    this.slider(eraserSec, t(`Densité`), t(`Densité : de un effacement léger à un effacement complet`), 10, 100, 5, (st) => Math.round(st.eraseDensity * 100), (v) => ({ eraseDensity: v / 100 }));

    // The compartment of the colours: on its first row the round swatch of the border, the one of the fill and the three types of line (a click on the type that is on takes the border
    // away from a shape); under it, one thin slider of transparency. Each swatch opens the window of the colours.
    const compartment = props.createDiv({ cls: `sketchdraw-compartment` });
    this.compartments.push({ el: compartment, names: [`colour`, `fill`, `dash`, `transparency`] });
    const topRow = compartment.createDiv({ cls: `sketchdraw-compartment-row` });
    const colour = this.section(topRow, `colour`);
    this.sectionIcon(colour, `pencil-line`, t(`Couleur de la bordure`));
    this.strokePastille = this.pastille(colour, t(`Couleur de la bordure`), () => this.openStrokeColor());

    const fillSec = this.section(topRow, `fill`);
    this.sectionIcon(fillSec, `paint-bucket`, t(`Remplissage`));
    this.fillPastille = this.pastille(fillSec, t(`Couleur du remplissage`), () => this.openFillColor());

    const transparencySec = this.section(topRow, `transparency`);
    this.sectionIcon(transparencySec, `sketchnote-opacity`, t(`Transparence`));
    // 0 is opaque. For a shape it is the transparency of the fill (the border stays sharp), for anything else the transparency of the whole element.
    this.thinSlider(transparencySec, t(`Transparence`), 0, 100, 5, (s) => Math.round((s.transparency * 100) / 5) * 5, (v) => ({ transparency: v / 100 }));

    const dashSec = this.section(topRow, `dash`);
    this.sectionIcon(dashSec, `sketchnote-line-dashed`, t(`Type de trait`));
    const dashes = dashSec.createDiv({ cls: `sketchdraw-row` });
    this.panelButton(dashes, `sketchnote-line-solid`, t(`Trait continu`), (s) => s.border !== `none` && s.lineStyle === `solid`, () => this.chooseLine(`solid`));
    this.panelButton(dashes, `sketchnote-line-dashed`, t(`Tirets`), (s) => s.border !== `none` && s.lineStyle === `dashed`, () => this.chooseLine(`dashed`));
    this.panelButton(dashes, `sketchnote-line-dotted`, t(`Pointillés`), (s) => s.border !== `none` && s.lineStyle === `dotted`, () => this.chooseLine(`dotted`));

    // The brush of the pen: one menu, then how much paint it puts and, for the nib, its angle. The thickness is the one of every line.
    const brushSec = this.section(props, `brush`);
    this.sectionIcon(brushSec, `paintbrush`, t(`Pinceau`));
    this.brushPicker(brushSec);
    for (const def of BRUSH_SLIDERS) {
      this.slider(brushSec, brushSliderShort(def.param), brushSliderLabel(def.param), def.min, def.max, def.step, (s) => Math.round(s[def.field] * def.scale), (v) => ({ [def.field]: v / def.scale }), (s) => BRUSH_DEFS[s.brush].params.includes(def.param));
    }
    // Everything that makes the brush is in this one group: the thickness, the regularity and the opacity are here too, in the same order as the other sliders (the groups of the thickness,
    // of the regularity and of the opacity are left out while the brush is shown).
    this.slider(brushSec, t(`Épaisseur`), t(`Épaisseur`), MIN_WIDTH, MAX_WIDTH, 1, (s) => Math.round(s.strokeWidth), (v) => ({ strokeWidth: v }));
    this.slider(brushSec, t(`Régularité`), t(`Régularité du tracé : 0 pour un tracé à main levée, 5 pour une forme parfaite`), 0, MAX_REGULARITY * 10, 1, (s) => Math.round(s.regularity * 10), (v) => ({ regularity: v / 10 }));
    this.slider(brushSec, t(`Opacité`), t(`Opacité de l'élément`), 5, 100, 5, (s) => Math.round(s.opacity * 100), (v) => ({ opacity: v / 100 }));

    const widthSec = this.section(props, `width`);
    this.sectionIcon(widthSec, `sketchnote-width-medium`, t(`Épaisseur`));
    this.slider(widthSec, t(`Épaisseur`), t(`Épaisseur`), MIN_WIDTH, MAX_WIDTH, 1, (s) => Math.round(s.strokeWidth), (v) => ({ strokeWidth: v }));

    const lookSec = this.section(props, `look`);
    this.sectionIcon(lookSec, `brush`, t(`Style à main levée`));
    // From 0 (a clean line) to the most imperfect: the more it is, the less straight the lines are.
    this.slider(lookSec, t(`Imperfection`), t(`Imperfection du tracé : 0 pour un trait net`), 0, MAX_ROUGHNESS * 10, 1, (s) => Math.round(s.roughness * 10), (v) => ({ roughness: v / 10 }));

    // The pen: from a stroke as drawn (0) to the clean shape it was meant to be (a line, a circle, a rectangle, a triangle). It is the only choice made before drawing that is kept.
    const regularSec = this.section(props, `regularity`);
    this.sectionIcon(regularSec, `pencil-ruler`, t(`Régularité du tracé`));
    this.slider(regularSec, t(`Régularité`), t(`Régularité du tracé : 0 pour un tracé à main levée, 5 pour une forme parfaite`), 0, MAX_REGULARITY * 10, 1, (s) => Math.round(s.regularity * 10), (v) => ({ regularity: v / 10 }));

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
    this.slider(taperSec, t(`Fuselage`), t(`Fuselage : de pas fuselé à fin au bout de la flèche`), 0, 100, 1, (s) => Math.round(s.taper * 100), (v) => ({ taper: v / 100 }));
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
    // A button that turns the icon into strokes: it opens the warning first, and does nothing when the user cancels.
    this.panelButton(iconSec, `pen-line`, t(`Transformer en traits`), () => false, () => this.strokesFromIcons(() => undefined));

    // A picture: its file name, the crop mode (the handles cut the sides instead of stretching), the crop to undo and another file for the same picture.
    const imageSec = this.section(props, `image`);
    this.sectionIcon(imageSec, `image`, t(`Image`));
    this.imageName = imageSec.createDiv({ cls: `sketchdraw-slider-label` });
    this.panelButton(imageSec, `crop`, t(`Rogner : les poignées coupent les bords de l'image au lieu de l'étirer`), () => this.isCropping(), () => {
      this.cropMode = !this.cropMode;
      this.lastPanel = ``;
      this.renderUi();
      this.syncPanel();
    });
    const imageRow = imageSec.createDiv({ cls: `sketchdraw-row` });
    const whole = this.button(imageRow, `rotate-ccw`, t(`Rétablir l'image entière`), () => this.editPictures((el) => {
      const { crop: _c, ...rest } = el;
      void _c;
      return this.keepRatioAfterCrop(el, rest);
    }));
    whole.addClass(`sketchdraw-chip`);
    const other = this.button(imageRow, `replace`, t(`Choisir une autre image`), () => {
      new ImageModal(this.app, () => this.api.settings().imagesFolder, (path) => this.editPictures((el) => ({ ...el, path }))).open();
    });
    other.addClass(`sketchdraw-chip`);

    // The distortion of a text and its vertical writing: one menu, a slider for the strength (only with a distortion) and a box to check.
    const warpSec = this.section(props, `warp`);
    this.sectionIcon(warpSec, `sketchnote-warp-arc`, t(`Déformation du texte`));
    const warpRow = warpSec.createDiv({ cls: `sketchdraw-row` });
    this.dropdown(warpRow, t(`Déformation du texte`), [`none`, ...WARP_KINDS] as (WarpKind | `none`)[], (v) => `sketchnote-warp-${v}`, warpName, (s) => s.warp, (v) => ({ warp: v }), true);
    this.slider(warpSec, t(`Intensité`), t(`Intensité de la déformation : d'un sens à l'autre, 0 pour aucune`), -100, 100, 5, (s) => Math.round(s.warpAmount * 100), (v) => ({ warpAmount: v / 100 }), (s) => s.warp !== `none`);
    this.checkbox(warpSec, `align-vertical-space-around`, t(`Texte vertical`), (s) => s.vertical, (on) => ({ vertical: on }));

    // The effects of every element: the opacity, then the shadow and the reflection, which are checked to be used and then unfold their settings.
    const effectSec = this.section(props, `effects`);
    effectSec.addClass(`is-split`);
    const opacityBox = effectSec.createDiv({ cls: `sketchdraw-subgroup` });
    this.opacityBox = opacityBox;
    const shadowBox = effectSec.createDiv({ cls: `sketchdraw-subgroup` });
    const reflectBox = effectSec.createDiv({ cls: `sketchdraw-subgroup` });
    this.sectionIcon(effectSec, `sparkles`, t(`Effets`));
    this.slider(opacityBox, t(`Opacité de l'élément`), t(`Opacité de l'élément`), 5, 100, 5, (s) => Math.round(s.opacity * 100), (v) => ({ opacity: v / 100 }));
    this.checkbox(shadowBox, `sketchnote-shadow-soft`, t(`Ombre`), (s) => s.shadow, (on) => ({ shadow: on }));
    const shadowOn = (s: ToolStyle): boolean => s.shadow;
    this.slider(shadowBox, t(`Éloignement de l'ombre`), t(`Éloignement de l'ombre`), 0, SHADOW_MAX_DISTANCE, 1, (s) => s.shadowDistance, (v) => ({ shadowDistance: v }), shadowOn);
    this.slider(shadowBox, t(`Flou de l'ombre`), t(`Flou de l'ombre`), 0, SHADOW_MAX_BLUR, 1, (s) => s.shadowBlur, (v) => ({ shadowBlur: v }), shadowOn);
    this.slider(shadowBox, t(`Densité de l'ombre`), t(`Densité de l'ombre : plus ou moins sombre`), 5, 100, 5, (s) => Math.round(s.shadowOpacity * 100), (v) => ({ shadowOpacity: v / 100 }), shadowOn);
    this.shadowColorButton(shadowBox, shadowOn);
    this.checkbox(reflectBox, `sketchnote-reflection`, t(`Reflet`), (s) => s.reflection, (on) => ({ reflection: on }));
    const reflectOn = (s: ToolStyle): boolean => s.reflection;
    this.slider(reflectBox, t(`Profondeur du reflet`), t(`Profondeur du reflet : la part de l'élément reflétée`), 10, 100, 5, (s) => Math.round(s.reflectionDepth * 100), (v) => ({ reflectionDepth: v / 100 }), reflectOn);
    this.slider(reflectBox, t(`Dégradé du reflet`), t(`Dégradé du reflet : de pas de dégradé à un reflet qui disparaît`), 0, 100, 5, (s) => Math.round(s.reflectionFade * 100), (v) => ({ reflectionFade: v / 100 }), reflectOn);
    this.slider(reflectBox, t(`Éloignement du reflet`), t(`Éloignement du reflet : de bord à bord à un reflet éloigné`), 0, 100, 5, (s) => Math.round(s.reflectionGap * 100), (v) => ({ reflectionGap: v / 100 }), reflectOn);

    // The display of the drawing, then what acts on the selection (group, lock, duplicate, mirror, levels, delete): the last group of the ribbon, shown with every button as soon as
    // something is selected.
    const displaySec = this.section(props, `display`);
    this.buildDisplaySection(displaySec);
    // The keys of the tools: a button that shows or hides the small floating menu that lists them.
    const keysSec = this.section(props, `shortcuts`);
    this.sectionIcon(keysSec, `keyboard`, t(`Raccourcis clavier`));
    const keysButton = keysSec.createEl(`button`, { cls: `sketchdraw-chip` });
    setIcon(keysButton, `keyboard`);
    keysButton.setAttribute(`aria-label`, t(`Raccourcis clavier`));
    keysButton.toggleClass(`is-active`, DrawEditor.shortcutsShown);
    keysButton.addEventListener(`click`, () => {
      DrawEditor.shortcutsShown = !DrawEditor.shortcutsShown;
      this.syncShortcuts();
      this.contentEl.focus({ preventScroll: true });
    });
    this.shortcutsToggle = keysButton;
    const organise = this.section(props, `organise`);
    this.sectionIcon(organise, `layers`, t(`Organiser`));
    this.buildSelectionActions(organise).addClass(`sketchdraw-organise`);
    this.refreshPastilles();
  }

  // The compartments of the menu: a box that holds several sections and is hidden when none of them is shown.
  protected readonly compartments: { el: HTMLElement; names: PanelSection[] }[] = [];

  // Tells whether the menu is about shapes (a rectangle, an ellipse, a bubble, a picture...), whose border can be taken away.
  protected shapeContext(): boolean {
    const kinds = panelKinds(this.tool, this.selectedElements());
    return [...kinds].some((k) => [`rect`, `diamond`, `ellipse`, `triangle`, `bubble`, `festoon`, `image`].includes(k));
  }

  // A click on a type of line. For a shape, a click on the type that is on takes the border away, and a click on another type puts the border back; a line or an arrow only changes type.
  protected chooseLine(style: `solid` | `dashed` | `dotted`): void {
    const s = this.currentStyle();
    const shape = this.shapeContext();
    if (shape && s.border !== `none` && s.lineStyle === style) {
      this.change({ border: `none` });
      return;
    }
    this.change({ lineStyle: style, ...(shape && s.border === `none` ? { border: `simple` as const } : {}) });
  }

  // The sections of the panel, each with the test that tells for which kind of element it is shown.
  protected readonly sections: { el: HTMLElement; name: PanelSection }[] = [];
  // Functions that show the current style in parts of the panel that are drawn by hand.
  protected readonly syncers: ((s: ToolStyle) => void)[] = [];
  protected readonly dropdowns: { el: HTMLElement; label: string; icon: (s: ToolStyle) => string; name: (s: ToolStyle) => string; shown?: (s: ToolStyle) => string }[] = [];
  protected fontSelect: HTMLSelectElement | null = null;

  // Adds a section to the panel.
  // A group of the menu, like a group of a ribbon: its choices (the body, which the caller fills) and, under them, its name (added by sectionIcon).
  protected section(props: HTMLElement, name: PanelSection): HTMLElement {
    const el = props.createDiv({ cls: `sketchdraw-section` });
    this.sections.push({ el, name });
    return el.createDiv({ cls: `sketchdraw-group-body` });
  }

  // The boxes to check of the panel (the shadow and the reflection): each one reads its state from the style that the panel shows and changes the style when it is checked.
  protected readonly checks: { input: HTMLInputElement; read: (s: ToolStyle) => boolean }[] = [];
  // The parts of the panel that show only when a test is true for the style (the colour of the shadow).
  protected readonly folds: { el: HTMLElement; visible: (s: ToolStyle) => boolean }[] = [];
  protected shadowSwatch: HTMLElement | null = null;

  // Adds a button that is switched on and off (the shadow, the reflection): a pictogram, lit when it is on; its name is the tooltip.
  protected checkbox(parent: HTMLElement, icon: string, label: string, read: (s: ToolStyle) => boolean, write: (on: boolean) => StylePatch): void {
    this.panelButton(parent, icon, label, read, () => this.change(write(!read(this.currentStyle()))));
  }

  // Adds the colour of the shadow: a round swatch that shows it. A double click opens the colour window to change it.
  protected shadowColorButton(parent: HTMLElement, visible: (s: ToolStyle) => boolean): void {
    const row = parent.createDiv({ cls: `sketchdraw-row sketchdraw-shadow-colour` });
    const b = row.createEl(`button`, { cls: `sketchdraw-swatch` });
    b.setAttribute(`aria-label`, `${t(`Couleur de l'ombre`)} : ${t(`double clic pour changer`)}`);
    b.addEventListener(`dblclick`, () => {
      new ColorModal(this.app, this.currentStyle().shadowColor, (choice: ColorChoice) => {
        if (choice.color !== null) this.change({ shadowColor: choice.color });
      }).open();
    });
    this.shadowSwatch = b;
    this.folds.push({ el: row, visible });
  }

  // The fields and sliders of the panel. Each one reads its value from the style that the panel shows, and changes the style when it is changed; it can be hidden when it does not apply.
  protected readonly sliders: { wrap: HTMLElement; set: (v: number) => void; read: (s: ToolStyle) => number; visible?: (s: ToolStyle) => boolean }[] = [];

  // Adds a field, like those of the bar of Affinity: a pictogram, the value with its unit, a list of usual values and the possibility to type a value (double click). `label` tells which
  // pictogram and which unit the field has; `help` is its tooltip, the only text of the field.
  protected slider(parent: HTMLElement, label: string, help: string, min: number, max: number, step: number, read: (s: ToolStyle) => number, write: (v: number) => StylePatch, visible?: (s: ToolStyle) => boolean): void {
    const kind = FIELD_KINDS[label] ?? { icon: `sliders-horizontal`, unit: `` };
    const field = valueField({ parent, icon: kind.icon, tooltip: help, min, max, step, unit: kind.unit, presets: presetValues(min, max, step), stepButtons: true, onChange: (v) => this.change(write(v)) });
    this.sliders.push({ wrap: field.el, set: (v) => field.set(v), read, visible });
  }

  // Adds a thin slider (the transparency, under the two colours): the value is also its tooltip.
  protected thinSlider(parent: HTMLElement, help: string, min: number, max: number, step: number, read: (s: ToolStyle) => number, write: (v: number) => StylePatch): void {
    const wrap = parent.createDiv({ cls: `sketchdraw-thin` });
    const input = wrap.createEl(`input`, { cls: `sketchdraw-range`, type: `range` });
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute(`aria-label`, help);
    input.addEventListener(`input`, () => {
      input.setAttribute(`aria-label`, `${help} : ${input.value} %`);
      this.change(write(Number(input.value)));
    });
    this.sliders.push({ wrap, set: (v) => {
      input.value = String(v);
      input.setAttribute(`aria-label`, `${help} : ${v} %`);
    }, read });
  }

  // Adds the choice of the brush: a button that shows the pictogram of the brush (a stroke drawn with it, wide) and its name, which opens the list of the brushes, each with a stroke
  // drawn with it. The pictograms are drawn with the same code as the brushes themselves, so that they look like what the brush makes.
  protected brushPicker(parent: HTMLElement): void {
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
        close();
        this.change({ brush });
        this.contentEl.focus({ preventScroll: true });
      });
      rows.push({ brush, el: row });
    }
    // The list opens over the menu (fixed, next to the button), and closes with a click elsewhere or Escape.
    let stop: (() => void) | null = null;
    const close = (): void => {
      list.removeClass(`is-open`);
      stop?.();
      stop = null;
    };
    button.addEventListener(`click`, () => {
      if (list.classList.contains(`is-open`)) {
        close();
        return;
      }
      const at = button.getBoundingClientRect();
      const view = this.contentEl.ownerDocument.defaultView ?? window;
      list.style.left = `${Math.max(4, Math.min(at.left, view.innerWidth - 330))}px`;
      if (at.top > view.innerHeight / 2) {
        list.style.bottom = `${view.innerHeight - at.top + 4}px`;
        list.style.top = ``;
      } else {
        list.style.top = `${at.bottom + 4}px`;
        list.style.bottom = ``;
      }
      list.addClass(`is-open`);
      const away = (e: Event): void => {
        if (e.target instanceof Node && (list.contains(e.target) || button.contains(e.target))) return;
        close();
      };
      const key = (e: KeyboardEvent): void => {
        if (e.key === `Escape`) close();
      };
      const doc = this.contentEl.ownerDocument;
      doc.addEventListener(`pointerdown`, away, true);
      doc.addEventListener(`keydown`, key, true);
      stop = () => {
        doc.removeEventListener(`pointerdown`, away, true);
        doc.removeEventListener(`keydown`, key, true);
      };
    });
    this.syncers.push((s) => {
      button.empty();
      preview(button, s.brush);
      button.setAttribute(`aria-label`, `${t(`Pinceau`)} : ${brushName(s.brush)}`);
      for (const r of rows) r.el.toggleClass(`is-active`, r.brush === s.brush);
    });
  }

  // Adds a drop-down menu: a button that shows the choice that is made (its pictogram, its name as the tooltip) and opens the list of choices, each with its pictogram. The
  // fewer menus the better: only the choices that have too many shapes for buttons go into a menu.
  protected dropdown<V extends string>(parent: HTMLElement, label: string, values: V[], icon: (v: V) => string, name: (v: V) => string, read: (s: ToolStyle) => V, write: (v: V) => StylePatch, showName = false): void {
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
    void showName;
    this.dropdowns.push({ el: button, label, icon: (s) => icon(read(s)), name: (s) => `${label} : ${name(read(s))}` });
  }

  // Fills the list of fonts: the built-in fonts, then the imported ones, each name in its own font.
  protected refreshFontList(): void {
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
  protected syncSections(): void {
    const kinds = panelKinds(this.tool, this.selectedElements());
    const fn = drawFunctions().find((f) => f.id === this.activeFn);
    const allowed = new Set<string>(fn ? fn.sections : []);
    let any = false;
    const brushShown = allowed.has(`brush`) && sectionShown(`brush`, kinds);
    this.opacityBox?.toggleClass(`sketchdraw-hidden`, brushShown);
    for (const sec of this.sections) {
      // A section is shown when the active function has it and it concerns what is selected (or the tool).
      let shown = sec.name === `organise` ? this.selected.size > 0 : allowed.has(sec.name) && sectionShown(sec.name, kinds) && this.sectionAllowed(sec.name);
      // The group of the brush holds the thickness and the regularity: their own groups are left out while it is shown.
      if (brushShown && (sec.name === `width` || sec.name === `regularity`)) shown = false;
      sec.el.toggleClass(`sketchdraw-hidden`, !shown);
      if (shown) any = true;
      // With nothing selected the choices of the menu have nothing to apply to (a new shape is always standard): they are dimmed, except the settings of a text.
      sec.el.toggleClass(`sketchdraw-idle`, (this.selected.size === 0 && !this.usableBeforeDrawing(sec.name)) || (sec.name !== `display` && allLocked(this.elementsOf(this.doc), this.selected)));
    }
    for (const c of this.compartments) c.el.toggleClass(`sketchdraw-hidden`, !this.sections.some((sec) => c.names.includes(sec.name) && !sec.el.classList.contains(`sketchdraw-hidden`)));
    this.context?.toggleClass(`is-empty`, !any);
  }

  // Tells whether a section of the panel can be used before anything is drawn: the settings of a text, and the settings of the pen (its brush and its regularity, and with the pen
  // tool its colour and its thickness too), which are kept for the next strokes.
  protected usableBeforeDrawing(name: PanelSection): boolean {
    if (name === `text` || name === `regularity` || name === `brush` || name === `display` || name === `shortcuts` || name === `bubbleform` || name === `festoonform` || name === `eraser` || name === `stamp` || name === `figure` || name === `figuresize`) return true;
    return this.tool === `pen` && (name === `colour` || name === `width`);
  }

  // Adds a small pictogram that heads a section of the panel. Its name is the tooltip.
  protected sectionIcon(parent: HTMLElement, icon: string, label: string): HTMLElement {
    // The menu has no text: the name of a group is only the tooltip of the group.
    void icon;
    const group = parent.classList.contains(`sketchdraw-group-body`) && parent.parentElement ? parent.parentElement : parent;
    group.setAttribute(`aria-label`, label);
    return group;
  }

  // Adds a pictogram button of the panel that shows as active when its test is true for the current style.
  protected panelButton(parent: HTMLElement, icon: string, label: string, test: (s: ToolStyle) => boolean, onClick: () => void): void {
    const b = parent.createEl(`button`, { cls: `sketchdraw-chip` });
    setIcon(b, icon);
    b.setAttribute(`aria-label`, label);
    b.addEventListener(`click`, () => {
      onClick();
      // The focus goes back to the drawing, so that the keyboard shortcuts keep working after a click on the panel.
      this.contentEl.focus({ preventScroll: true });
    });
    this.panelButtons.push({ el: b, test });
  }

  // Adds a round swatch to a section: its name is the tooltip, and a click opens the window of the colours.
  protected pastille(parent: HTMLElement, label: string, open: () => void): HTMLElement {
    const b = parent.createEl(`button`, { cls: `sketchdraw-swatch sketchdraw-pastille` });
    b.setAttribute(`aria-label`, label);
    b.addEventListener(`click`, () => {
      open();
    });
    return b;
  }

  // Shows the colours that apply (the selection, or the next elements) in the two swatches.
  protected refreshPastilles(): void {
    const s = this.currentStyle();
    if (this.strokePastille) {
      // A shape without a border shows its swatch as a crossed circle.
      const none = s.border === `none` && this.shapeContext();
      this.strokePastille.style.background = none ? `` : toHex6(s.stroke);
      this.strokePastille.toggleClass(`is-none`, none);
    }
    if (this.fillPastille) {
      // No fill, or a fill that is fully transparent: a crossed circle.
      const none = s.fill === null || s.transparency >= 0.95;
      this.fillPastille.style.background = none || s.fill === null ? `` : swatchBackground({ color: s.fill, style: s.fillStyle });
      this.fillPastille.toggleClass(`is-none`, none);
    }
  }

  // Opens the window of the colours for the border (the line): the colour chosen is applied to the selection.
  protected openStrokeColor(): void {
    new ColorModal(this.app, this.currentStyle().stroke, (choice: ColorChoice) => {
      if (choice.color !== null) this.change({ stroke: choice.color });
    }).open();
  }

  // Opens the window of the colours for the fill, with the patterns and the button for no colour: the colour and its pattern (or no colour) are applied to the selection.
  protected openFillColor(): void {
    const s = this.currentStyle();
    new ColorModal(
      this.app,
      s.fill ?? this.paletteOf()[1] ?? `#c0392b`,
      (choice: ColorChoice) => this.change(choice.color === null ? { fill: null } : { fill: choice.color, fillStyle: choice.style }),
      { fill: true, style: s.fillStyle, none: s.fill === null },
    ).open();
  }


  // The colour and the thickness that the pen keeps from one stroke to the next (the other tools always start from the standard look).
  protected penLook: { stroke?: string; strokeWidth?: number } = {};

  // The style a new element is made with: the pen adds its own colour and thickness to the standard style.
  protected styleFor(tool: CreationTool): ToolStyle | null {
    return this.style && tool === `pen` ? { ...this.style, ...this.penLook } : this.style;
  }

  // The cursor of the pen: a ring as large as the stroke, or a small target when the stroke is small (see cursors.ts).
  protected creationCursor(): string | null {
    if (this.tool === `eraser` && this.style) return eraserCursor(this.style.eraseSize * this.zoom, this.style.eraseShape === `square`);
    const style = this.styleFor(`pen`);
    if (this.tool !== `pen` || !style) return null;
    const def = BRUSH_DEFS[style.brush];
    const diameter = style.strokeWidth * def.size * (def.shape === `spray` ? 2 : 1) * this.zoom;
    return penCursor(diameter);
  }

  // The style shown in the panel: the one of the first selected element that has one (several elements can be selected: a change then applies to all of them), otherwise the
  // standard style, which is the one of every new element.
  protected currentStyle(): ToolStyle {
    const base = this.style ?? defaultStyle(`#000000`);
    for (const el of this.selectedElements()) {
      const s = styleOf(el);
      // The settings of the eraser belong to the tool, not to the element that is selected.
      if (s) return { ...s, eraseShape: base.eraseShape, eraseSize: base.eraseSize, eraseDensity: base.eraseDensity, stamp: base.stamp, stampSize: base.stampSize, figure: base.figure, figureSize: base.figureSize };
    }
    return this.tool === `pen` ? { ...base, ...this.penLook } : base;
  }

  // Applies a change of style to the selected elements (one change that can be undone). It never changes the look of the next elements: every new element starts from the
  // standard look (a black line, no fill, a normal border, no effect). Only the settings of a text (font, size, alignment) are kept for the next texts.
  protected change(patch: StylePatch): void {
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
      if (clean.stamp !== undefined) keep.stamp = clean.stamp;
      if (clean.stampSize !== undefined) keep.stampSize = clean.stampSize;
      if (clean.figure !== undefined) keep.figure = clean.figure;
      if (clean.figureSize !== undefined) keep.figureSize = clean.figureSize;
      if (clean.figureFace !== undefined) keep.figureFace = clean.figureFace;
      if (clean.figureBuild !== undefined) keep.figureBuild = clean.figureBuild;
      if (clean.figureLook !== undefined) keep.figureLook = clean.figureLook;
      if (clean.eraseShape !== undefined) keep.eraseShape = clean.eraseShape;
      if (clean.eraseSize !== undefined) keep.eraseSize = clean.eraseSize;
      if (clean.eraseDensity !== undefined) keep.eraseDensity = clean.eraseDensity;
      if (clean.bubbleForm !== undefined) keep.bubbleForm = clean.bubbleForm;
      if (clean.festoonForm !== undefined) keep.festoonForm = clean.festoonForm;
      if (clean.regularity !== undefined) keep.regularity = clean.regularity;
      if (clean.brush !== undefined) keep.brush = clean.brush;
      for (const key of [`flow`, `hardness`, `spacing`, `form`, `brushAngle`, `grain`, `dynamics`] as const) if (clean[key] !== undefined) Object.assign(keep, { [key]: clean[key] });
      this.style = { ...this.style, ...keep };
    }
    if (this.selected.size > 0) {
      // A text takes the size of its box again when its font or its size changed.
      const next = applyStyleToIds(this.elementsOf(this.doc), this.selected, clean).map((e) => (e.type === `text` ? refitText(e, this.api.fonts.measure) : e));
      if (next.some((e, i) => e !== this.elementsOf(this.doc)[i])) this.commitElements(next);
    }
    this.lastPanel = ``;
    this.syncPanel();
    this.updateCursor();
  }

  // Called when the selection or the tool changes: the panel shows the style that applies.
  protected onSelectionChanged(): void {
    // A tool chosen another way (the keyboard, a shape that was just drawn) makes its function the active one.
    if (this.tool !== this.lastTool) {
      this.lastTool = this.tool;
      const fn = functionOfTool(this.tool);
      if (fn && fn !== this.activeFn) {
        this.activeFn = fn;
        this.renderRail();
      }
    }
    this.refreshShortcuts();
    this.syncPanel();
  }

  // Shows in the panel which choices are active. Does nothing when nothing changed since the last time.
  protected syncPanel(): void {
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
    }
    for (const f of this.syncers) f(s);
    this.refreshVariants(s);
    if (this.imageName) {
      const picture = this.selectedElements().find((e): e is ImageElement => e.type === `image`);
      this.imageName.setText(picture ? picture.path : ``);
    }
    if (this.iconName) {
      const icon = this.selectedElements().find((e): e is IconElement => e.type === `icon`);
      const iconText = icon ? (icon.icon ? `Lucide : ${icon.icon}` : icon.name ?? ``) : ``;
      this.iconName.setText(iconText);
    }
    this.refreshPastilles();
    for (const sl of this.sliders) {
      sl.set(sl.read(s));
      sl.wrap.toggleClass(`sketchdraw-hidden`, sl.visible ? !sl.visible(s) : false);
    }
    for (const c of this.checks) c.input.checked = c.read(s);
    for (const f of this.folds) f.el.toggleClass(`sketchdraw-hidden`, !f.visible(s));
    if (this.shadowSwatch) this.shadowSwatch.style.background = toHex6(s.shadowColor);
    if (this.fontSelect) this.fontSelect.value = s.font;
  }
}

// The name of the form of a bubble or of a festoon, shown as a tooltip and in the menu.
function formName(form: ShapeForm): string {
  const names: Record<ShapeForm, string> = {
    oval: t(`Bulle de dialogue ovale`),
    rounded: t(`Bulle de dialogue rectangulaire`),
    thought: t(`Nuage de pensée`),
    shout: t(`Bulle de cri`),
    ribbon: t(`Banderole`),
    notched: t(`Bandeau à bouts en V`),
    wave: t(`Bandeau ondulé`),
    scallop: t(`Feston à bords arrondis`),
    plaque: t(`Plaque à coins coupés`),
    tag: t(`Étiquette`),
    pennant: t(`Fanion`),
    pointer: t(`Bandeau flèche`),
    hexagon: t(`Hexagone`),
    flag: t(`Drapeau à queue d'aronde`),
    seal: t(`Sceau`),
  };
  return names[form];
}

// The forms that a function offers in its floating menu.
interface Variants {
  values: string[];
  // Whether the button of the function shows the pictogram of the choice that is made (the eraser keeps its own, the tips are only in the floating menu).
  showChoice: boolean;
  icon: (value: string) => string;
  name: (value: string) => string;
  read: (s: ToolStyle) => string;
  write: (value: string) => StylePatch;
}

// Returns the name of the pictogram of a form (registered by custom-icons.ts).
function bubbleFormIcon(form: ShapeForm): string {
  return `sketchnote-form-${form}`;
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
