// The window of the export: what is exported (everything or the selection), the format (PNG, SVG or PDF), the size and the background, a preview, and three buttons: save in the vault,
// copy, and put the link in the note. Every button is a pictogram whose name is its tooltip.
import { App, Modal, Notice, setIcon } from "obsidian";
import { t } from "./i18n";
import { EXPORT_BACKGROUNDS, EXPORT_FORMATS, EXPORT_SCALES, ExportBackground, ExportFormat, exportFileName, ExportScope, fitSize } from "./export-plan";
import { canvasToPdf, canvasToPng, ExportSource, finishSvg, svgDataUrl, svgToCanvas } from "./export-render";
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
  build(scope: ExportScope, background: ExportBackground): ExportSource | null;
  services: ExportServices;
}

// The choices of the last export, kept while the application runs.
const last = { format: `png` as ExportFormat, scale: 2, background: `white` as ExportBackground, paper: `a4` as Paper, printScale: `fit` as PrintScale };

export class ExportModal extends Modal {
  private part: ExportScope;
  private format: ExportFormat = last.format;
  private scale = last.scale;
  private background: ExportBackground = last.background;
  private paper: Paper = last.paper;
  private printScale: PrintScale = last.printScale;
  private body!: HTMLElement;
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

  // The key of the choices (the file that is saved depends on all of them).
  private key(): string {
    return `${this.part}|${this.format}|${this.scale}|${this.effectiveBackground()}`;
  }

  // A PDF has no transparency: the transparent background is white there.
  private effectiveBackground(): ExportBackground {
    return this.format === `pdf` && this.background === `transparent` ? `white` : this.background;
  }

  // Draws a row of buttons that choose one value.
  private chips<V extends string | number>(label: string, items: [V, string][], current: V, pick: (v: V) => void): void {
    const row = this.body.createDiv({ cls: `sketchnote-export-row` });
    row.createSpan({ cls: `sketchnote-export-label`, text: label });
    const group = row.createDiv({ cls: `sketchnote-icons-themes sketchnote-export-chips` });
    for (const [value, text] of items) {
      const button = group.createEl(`button`, { cls: `sketchnote-icons-theme`, text });
      if (value === current) button.addClass(`is-active`);
      button.addEventListener(`click`, () => pick(value));
    }
  }

  // Draws the window: the choices, the preview and the buttons.
  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.body = contentEl.createDiv({ cls: `sketchnote-export-body` });
    if (!this.host.hasContent && !this.host.hasSelection) {
      this.body.createDiv({ cls: `sketchnote-icons-info`, text: t(`Il n'y a rien à exporter pour l'instant.`) });
      return;
    }
    const parts: [ExportScope, string][] = [[`all`, this.host.allLabel]];
    if (this.host.hasSelection) parts.push([`selection`, t(`Sélection`)]);
    this.chips(t(`Partie`), parts, this.part, (v) => this.set(() => (this.part = v)));
    this.chips(t(`Format`), EXPORT_FORMATS.map((f): [ExportFormat, string] => [f, f.toUpperCase()]), this.format, (v) => this.set(() => (this.format = v)));
    if (this.format !== `svg`) this.chips(t(`Taille`), EXPORT_SCALES.map((s): [number, string] => [s, `×${s}`]), this.scale, (v) => this.set(() => (this.scale = v)));
    const backgrounds: [ExportBackground, string][] = EXPORT_BACKGROUNDS.filter((b) => !(this.format === `pdf` && b === `transparent`)).map((b) => [b, b === `transparent` ? t(`Transparent`) : b === `white` ? t(`Blanc`) : t(`Fond d'origine`)]);
    this.chips(t(`Fond`), backgrounds, this.effectiveBackground(), (v) => this.set(() => (this.background = v)));
    // The paper and the scale are used by the print only.
    this.chips(t(`Papier`), PAPERS.map((p): [Paper, string] => [p, p.toUpperCase()]), this.paper, (v) => this.set(() => (this.paper = v)));
    this.chips(t(`Échelle`), PRINT_SCALES.map((s): [PrintScale, string] => [s, s === `fit` ? t(`Ajustée à la feuille`) : t(`Taille réelle`)]), this.printScale, (v) => this.set(() => (this.printScale = v)));
    this.preview = this.body.createEl(`img`, { cls: `sketchnote-export-preview`, attr: { alt: t(`Aperçu de l'export`) } });
    this.info = this.body.createDiv({ cls: `sketchnote-icons-info` });
    const bar = this.body.createDiv({ cls: `sketchnote-export-actions` });
    this.buttons = [];
    this.action(bar, `save`, t(`Enregistrer dans le coffre`), async () => {
      await this.save();
    });
    this.action(bar, `clipboard-copy`, t(`Copier dans le presse-papiers`), () => this.copy(), this.format === `pdf`);
    this.action(bar, `link`, t(`Enregistrer et insérer le lien dans la note ouverte`), () => this.link());
    this.action(bar, `printer`, t(`Imprimer`), () => this.print());
    this.status = this.body.createDiv({ cls: `sketchnote-export-status` });
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
    last.format = this.format;
    last.scale = this.scale;
    last.background = this.background;
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
      this.buttons.forEach((b, i) => (b.disabled = this.format === `pdf` && i === 1));
    }
  }

  // Draws the preview (small, always as an SVG) and the size of the file.
  private refreshPreview(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.drawPreview(), 80);
  }

  private async drawPreview(): Promise<void> {
    const source = this.host.build(this.part, this.effectiveBackground());
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
  private async make(): Promise<{ name: string; bytes: Uint8Array; mime: string; text: string } | null> {
    const source = this.host.build(this.part, this.effectiveBackground());
    if (!source) return null;
    // The name of the note already says what is exported when everything is; a selection says so.
    const part = this.part === `selection` ? t(`sélection`) : ``;
    const name = exportFileName(this.host.name, part, this.format, new Date(), this.host.services.usedNames());
    const done = await finishSvg(source, this.format === `svg` ? 1 : this.scale, this.host.services);
    if (this.format === `svg`) return { name, bytes: new TextEncoder().encode(done.text), mime: `image/svg+xml`, text: done.text };
    const canvas = await svgToCanvas(done.text, done.width, done.height);
    if (this.format === `png`) return { name, bytes: await canvasToPng(canvas), mime: `image/png`, text: `` };
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
    const source = this.host.build(this.part, this.effectiveBackground());
    if (!source) return;
    const done = await finishSvg(source, 1, this.host.services);
    const plan = planPrint(source.box.w, source.box.h, this.paper, this.printScale);
    if (plan.tooBig) new Notice(t(`À taille réelle, l'image demanderait trop de feuilles : elle est ajustée à une feuille.`));
    await printSvg(done.text, plan, this.paper);
    this.status.setText(t(`Envoyé à l'impression : {0}`, plan.sheets.length === 1 ? t(`1 feuille`) : t(`{0} feuilles`, String(plan.sheets.length))));
  }

  // Copies the picture (PNG) or the text of the SVG.
  private async copy(): Promise<void> {
    const made = await this.make();
    if (!made) return;
    if (this.format === `svg`) await navigator.clipboard.writeText(made.text);
    else await navigator.clipboard.write([new ClipboardItem({ [made.mime]: new Blob([made.bytes.slice().buffer], { type: made.mime }) })]);
    this.status.setText(t(`Copié dans le presse-papiers`));
  }

  // Saves the file (once) and puts the link that shows it in the note that was last open.
  private async link(): Promise<void> {
    const path = this.saved && this.saved.key === this.key() ? this.saved.path : await this.save();
    if (!path) return;
    const note = this.host.services.insertLink(path);
    this.status.setText(note ? t(`Lien inséré dans la note {0}`, note) : t(`Aucune note n'est ouverte dans un éditeur : le fichier est enregistré, ouvrez une note puis recommencez.`));
  }
}
