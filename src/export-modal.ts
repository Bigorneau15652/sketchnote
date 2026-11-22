// The window of the export, in the style of a print window: on the left menus to choose what is exported (everything or the selection), where it goes (printer, PNG, JPG, PDF or SVG), the
// size, the background (with a box for transparency), the colours (colour, shades of grey, black and white) and, for the printer, the paper and the scale; on the right the preview and the
// buttons (save in the vault, copy, put the link in the note, or print). Every button is a pictogram whose name is its tooltip.
import { App, Modal, Notice, setIcon } from "obsidian";
import { t } from "./i18n";
import { canBeTransparent, DEFAULT_BACKGROUND_COLOR, DEFAULT_JPEG_QUALITY, EXPORT_SCALES, EXPORT_TARGETS, EXPORT_TONES, ExportBackground, ExportFormat, exportFileName, ExportScope, ExportTarget, ExportTone, fitSize, isHexColor, JPEG_QUALITIES } from "./export-plan";
import { applyTone, canvasToJpeg, canvasToPdf, canvasToPng, ExportSource, finishSvg, svgDataUrl, svgToCanvas } from "./export-render";
import type { ExportServices } from "./export-service";
import { Paper, PAPERS, planPrint, PRINT_SCALES, PrintScale } from "./print-plan";
import { printSvg } from "./print-render";

export interface ExportHost {
  // The name of the note, to name the files.
  name: string;
  // What an export of everything is called ("Page" or "Dessin"), whether something is selected and whether there is anything to export.
  allLabel: string;
  hasSelection: boolean;
  hasContent: boolean;
  // Draws what is exported (null when there is nothing).
  build(scope: ExportScope, background: ExportBackground, color: string): ExportSource | null;
  services: ExportServices;
}

// The choices of the last export, kept while the application runs.
const last = { target: `png` as ExportTarget, scale: 2, background: `white` as `white` | `page` | `color`, color: DEFAULT_BACKGROUND_COLOR, transparent: false, tone: `color` as ExportTone, quality: DEFAULT_JPEG_QUALITY, paper: `a4` as Paper, printScale: `fit` as PrintScale };

export class ExportModal extends Modal {
  private part: ExportScope;
  private target: ExportTarget = last.target;
  private scale = last.scale;
  private background = last.background;
  private color = last.color;
  private transparent = last.transparent;
  private tone: ExportTone = last.tone;
  private quality = last.quality;
  private paper: Paper = last.paper;
  private printScale: PrintScale = last.printScale;
  private body!: HTMLElement;
  private form!: HTMLElement;
  private preview!: HTMLImageElement;
  private info!: HTMLElement;
  private status!: HTMLElement;
  private buttons: HTMLButtonElement[] = [];
  private timer: number | null = null;
  private busy = false;
  // The file saved for the choices that are shown, so that the link does not save it a second time.
  private saved: { key: string; path: string } | null = null;

  constructor(app: App, private host: ExportHost) {
    super(app);
    this.part = host.hasSelection ? `selection` : `all`;
  }

  onOpen(): void {
    this.titleEl.setText(t(`Exporter`));
    this.modalEl.addClass(`sketchnote-export`);
    this.render();
  }

  onClose(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.contentEl.empty();
  }

  // The format of the file that is made (the printer prints a picture that is made as an SVG).
  private get format(): ExportFormat {
    return this.target === `printer` ? `svg` : this.target;
  }

  // The key of the choices (the file that is saved depends on all of them).
  private key(): string {
    return `${this.part}|${this.target}|${this.scale}|${this.effectiveBackground()}|${this.color}|${this.tone}|${this.quality}`;
  }

  // Only a PNG or an SVG can be transparent: for the others the background chosen is used.
  private effectiveBackground(): ExportBackground {
    return this.transparent && canBeTransparent(this.target) ? `transparent` : this.background;
  }

  // Draws what is exported with the background and the colours chosen.
  private source(): ExportSource | null {
    const source = this.host.build(this.part, this.effectiveBackground(), this.color);
    if (source) applyTone(source.svg, this.tone);
    return source;
  }

  // Adds a menu (a list that drops down) with its label to the column of choices.
  private menu<V extends string | number>(label: string, items: [V, string][], current: V, pick: (v: V) => void): HTMLSelectElement {
    const row = this.form.createDiv({ cls: `sketchnote-export-row` });
    row.createEl(`label`, { cls: `sketchnote-export-label`, text: label });
    const select = row.createEl(`select`, { cls: `dropdown sketchnote-export-select` });
    for (const [value, text] of items) {
      const option = select.createEl(`option`, { text });
      option.value = String(value);
      if (value === current) option.selected = true;
    }
    select.addEventListener(`change`, () => {
      const found = items.find(([value]) => String(value) === select.value);
      if (found) pick(found[0]);
    });
    return select;
  }

  // Draws the window: the menus on the left, the preview and the buttons on the right.
  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.body = contentEl.createDiv({ cls: `sketchnote-export-body` });
    if (!this.host.hasContent && !this.host.hasSelection) {
      this.body.createDiv({ cls: `sketchnote-icons-info`, text: t(`Il n'y a rien à exporter pour l'instant.`) });
      return;
    }
    this.form = this.body.createDiv({ cls: `sketchnote-export-form` });
    const side = this.body.createDiv({ cls: `sketchnote-export-side` });
    const parts: [ExportScope, string][] = [[`all`, this.host.allLabel]];
    if (this.host.hasSelection) parts.push([`selection`, t(`Sélection`)]);
    this.menu(t(`Partie`), parts, this.part, (v) => this.set(() => (this.part = v)));
    const targetNames: Record<ExportTarget, string> = { printer: t(`Imprimante`), png: `PNG`, jpg: `JPG`, pdf: `PDF`, svg: `SVG` };
    this.menu(t(`Type d'export`), EXPORT_TARGETS.map((x): [ExportTarget, string] => [x, targetNames[x]]), this.target, (v) => this.set(() => (this.target = v)));
    if (this.target === `printer`) {
      this.menu(t(`Papier`), PAPERS.map((p): [Paper, string] => [p, p.toUpperCase()]), this.paper, (v) => this.set(() => (this.paper = v)));
      this.menu(t(`Échelle`), PRINT_SCALES.map((s): [PrintScale, string] => [s, s === `fit` ? t(`Ajustée à la feuille`) : t(`Taille réelle`)]), this.printScale, (v) => this.set(() => (this.printScale = v)));
    } else if (this.target !== `svg`) {
      this.menu(t(`Taille`), EXPORT_SCALES.map((s): [number, string] => [s, `×${s}`]), this.scale, (v) => this.set(() => (this.scale = v)));
    }
    if (this.target === `jpg`) this.menu(t(`Qualité`), JPEG_QUALITIES.map((q): [number, string] => [q, `${q} %`]), this.quality, (v) => this.set(() => (this.quality = v)));
    // The background: a menu, a colour when it is the one to choose, and a box for transparency (PNG and SVG only).
    const backgrounds: [`white` | `page` | `color`, string][] = [[`white`, t(`Blanc`)], [`page`, t(`Fond d'origine`)], [`color`, t(`Couleur au choix`)]];
    const fond = this.menu(t(`Fond`), backgrounds, this.background, (v) => this.set(() => (this.background = v)));
    const transparentOn = this.transparent && canBeTransparent(this.target);
    fond.disabled = transparentOn;
    if (this.background === `color` && !transparentOn) {
      const picker = fond.parentElement?.createEl(`input`, { cls: `sketchnote-export-color`, attr: { type: `color`, value: this.color, "aria-label": t(`Couleur du fond`) } });
      picker?.addEventListener(`input`, () => {
        if (!isHexColor(picker.value)) return;
        this.color = picker.value;
        last.color = this.color;
        this.refreshPreview();
      });
    }
    if (canBeTransparent(this.target)) {
      const row = this.form.createDiv({ cls: `sketchnote-export-check` });
      const box = row.createEl(`input`, { attr: { type: `checkbox`, id: `sketchnote-export-transparent` } });
      box.checked = this.transparent;
      row.createEl(`label`, { text: t(`Fond transparent`), attr: { for: `sketchnote-export-transparent` } });
      box.addEventListener(`change`, () => this.set(() => (this.transparent = box.checked)));
    }
    const toneNames: Record<ExportTone, string> = { color: t(`Couleur`), gray: t(`Niveaux de gris`), bw: t(`Noir et blanc`) };
    this.menu(t(`Couleurs`), EXPORT_TONES.map((x): [ExportTone, string] => [x, toneNames[x]]), this.tone, (v) => this.set(() => (this.tone = v)));
    this.preview = side.createEl(`img`, { cls: `sketchnote-export-preview`, attr: { alt: t(`Aperçu de l'export`) } });
    this.info = side.createDiv({ cls: `sketchnote-icons-info` });
    const bar = side.createDiv({ cls: `sketchnote-export-actions` });
    this.buttons = [];
    if (this.target === `printer`) {
      this.action(bar, `printer`, t(`Imprimer`), () => this.print());
    } else {
      this.action(bar, `save`, t(`Enregistrer dans le coffre`), async () => {
        await this.save();
      });
      this.action(bar, `clipboard-copy`, t(`Copier dans le presse-papiers`), () => this.copy(), this.target === `pdf`);
      this.action(bar, `link`, t(`Enregistrer et copier le lien`), () => this.link());
    }
    this.status = side.createDiv({ cls: `sketchnote-export-status` });
    this.refreshPreview();
  }

  // Adds a pictogram button to the row of actions.
  private action(parent: HTMLElement, icon: string, label: string, run: () => Promise<void>, disabled = false): void {
    const b = parent.createEl(`button`, { cls: `sketchnote-export-button` });
    setIcon(b, icon);
    b.setAttribute(`aria-label`, label);
    b.disabled = disabled;
    b.addEventListener(`click`, () => void this.guard(run));
    this.buttons.push(b);
  }

  // Changes a choice, keeps it for the next export and draws the window again.
  private set(change: () => void): void {
    change();
    last.target = this.target;
    last.scale = this.scale;
    last.background = this.background;
    last.color = this.color;
    last.transparent = this.transparent;
    last.tone = this.tone;
    last.quality = this.quality;
    last.paper = this.paper;
    last.printScale = this.printScale;
    this.render();
  }

  // Runs an action while the buttons are off, and tells a failure.
  private async guard(run: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    for (const b of this.buttons) b.disabled = true;
    this.status.setText(t(`Export en cours…`));
    try {
      await run();
    } catch {
      this.status.setText(t(`L'export a échoué : l'image est peut-être trop grande. Essayez une taille plus petite.`));
    } finally {
      this.busy = false;
      this.buttons.forEach((b, i) => (b.disabled = this.target === `pdf` && i === 1));
    }
  }

  // Draws the preview (small, always as an SVG) and the size of the file.
  private refreshPreview(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.drawPreview(), 80);
  }

  private async drawPreview(): Promise<void> {
    const source = this.source();
    if (!source) {
      this.info.setText(t(`Il n'y a rien à exporter pour l'instant.`));
      return;
    }
    try {
      const small = await finishSvg({ svg: source.svg, box: source.box }, 1, this.host.services);
      this.preview.src = svgDataUrl(small.text);
      const size = fitSize(source.box.w, source.box.h, this.format === `svg` ? 1 : this.scale);
      const sheets = planPrint(source.box.w, source.box.h, this.paper, this.printScale);
      const printed = t(`Impression : {0} sur {1} {2}`, sheets.sheets.length === 1 ? t(`1 feuille`) : t(`{0} feuilles`, String(sheets.sheets.length)), this.paper.toUpperCase(), sheets.orientation === `portrait` ? t(`portrait`) : t(`paysage`));
      const file = this.format === `svg` ? t(`Image vectorielle, qui reste nette à toute taille`) : t(`{0} × {1} pixels`, String(size.width), String(size.height)) + (size.reduced ? ` · ${t(`taille réduite : l'image serait trop grande`)}` : ``);
      this.info.setText(`${file} · ${printed}`);
    } catch {
      this.info.setText(t(`L'aperçu n'a pas pu être fait.`));
    }
  }

  // Makes the file of the export with the choices that are shown: its name, its bytes and its type.
  private async make(format: ExportFormat = this.format): Promise<{ name: string; bytes: Uint8Array; mime: string; text: string } | null> {
    const source = this.source();
    if (!source) return null;
    // The name of the note already says what is exported when everything is; a selection says so.
    const part = this.part === `selection` ? t(`sélection`) : ``;
    const name = exportFileName(this.host.name, part, format, new Date(), this.host.services.usedNames());
    const done = await finishSvg(source, format === `svg` ? 1 : this.scale, this.host.services);
    if (format === `svg`) return { name, bytes: new TextEncoder().encode(done.text), mime: `image/svg+xml`, text: done.text };
    const canvas = await svgToCanvas(done.text, done.width, done.height);
    if (format === `png`) return { name, bytes: await canvasToPng(canvas), mime: `image/png`, text: `` };
    if (format === `jpg`) return { name, bytes: await canvasToJpeg(canvas, this.quality), mime: `image/jpeg`, text: `` };
    return { name, bytes: await canvasToPdf(canvas, done.width / Math.max(1, source.box.w), name), mime: `application/pdf`, text: `` };
  }

  // Saves the file in the folder of the exports.
  private async save(): Promise<string | null> {
    const made = await this.make();
    if (!made) return null;
    const path = await this.host.services.save(made.name, made.bytes);
    this.saved = { key: this.key(), path };
    this.status.setText(t(`Enregistré : {0}`, path));
    new Notice(t(`Export enregistré : {0}`, path));
    return path;
  }

  // Prints what is chosen with the print dialog of the system: the picture is fitted on one sheet, or kept at its real size on several sheets to put side by side.
  private async print(): Promise<void> {
    const source = this.source();
    if (!source) return;
    const done = await finishSvg(source, 1, this.host.services);
    const plan = planPrint(source.box.w, source.box.h, this.paper, this.printScale);
    if (plan.tooBig) new Notice(t(`À taille réelle, l'image demanderait trop de feuilles : elle est ajustée à une feuille.`));
    await printSvg(done.text, plan, this.paper);
    this.status.setText(t(`Envoyé à l'impression : {0}`, plan.sheets.length === 1 ? t(`1 feuille`) : t(`{0} feuilles`, String(plan.sheets.length))));
  }

  // Copies the picture (PNG) or the text of the SVG.
  private async copy(): Promise<void> {
    // The clipboard takes a PNG, not a JPG: the picture is copied as a PNG.
    const made = await this.make(this.format === `jpg` ? `png` : this.format);
    if (!made) return;
    if (this.format === `svg`) await navigator.clipboard.writeText(made.text);
    else await navigator.clipboard.write([new ClipboardItem({ [made.mime]: new Blob([made.bytes.slice().buffer], { type: made.mime }) })]);
    this.status.setText(t(`Copié dans le presse-papiers`));
  }

  // Saves the file (once) and copies the link that shows it in a note, to paste where it is wanted.
  private async link(): Promise<void> {
    const path = this.saved && this.saved.key === this.key() ? this.saved.path : await this.save();
    if (!path) return;
    const link = `![[${path}]]`;
    await navigator.clipboard.writeText(link);
    this.status.setText(t(`Lien copié : {0}`, link));
  }
}
