// The windows of the library of drawings: the one that asks the name of a drawing to keep, and the one that lists the drawings of the library as small views and puts one on the page.
import { App, Modal, TFile } from "obsidian";
import { PLAIN, drawElements } from "./element-render";
import { contentBox, parseSketchdraw, SketchdrawDoc } from "./drawing-file";
import { t } from "./i18n";
import { brightness } from "./page-background";
import { matchesName } from "./image-files";
import { svgEl } from "./svg";

// How many drawings are drawn at first, and added by each click on the button that shows more.
const PAGE = 36;

// The window that asks the name under which a drawing is kept.
export class SaveDrawingModal extends Modal {
  constructor(app: App, private proposed: string, private onSave: (name: string) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t(`Enregistrer dans la bibliothèque`));
    const { contentEl } = this;
    contentEl.empty();
    const input = contentEl.createEl(`input`, { cls: `sketchnote-library-name`, type: `text` });
    input.value = this.proposed;
    input.setAttribute(`aria-label`, t(`Nom du dessin`));
    const row = contentEl.createDiv({ cls: `modal-button-container` });
    const save = row.createEl(`button`, { cls: `mod-cta`, text: t(`Enregistrer`) });
    const cancel = row.createEl(`button`, { text: t(`Annuler`) });
    const done = (): void => {
      this.close();
      this.onSave(input.value);
    };
    save.addEventListener(`click`, done);
    cancel.addEventListener(`click`, () => this.close());
    input.addEventListener(`keydown`, (e) => {
      if (e.key === `Enter`) done();
    });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// The window that lists the drawings of the library: a search bar and the drawings as small views. A click on a drawing picks it.
export class LibraryModal extends Modal {
  private query = ``;
  private shown = PAGE;
  private grid!: HTMLElement;
  private info!: HTMLElement;
  private more!: HTMLElement;
  private timer: number | null = null;
  private files: TFile[] = [];
  // Counts the drawings of the list that was drawn last, so that a view that arrives late is not put in a list that was drawn again.
  private generation = 0;

  constructor(app: App, private folder: () => string, private onPick: (doc: SketchdrawDoc, file: TFile) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t(`Dessins de la bibliothèque`));
    this.modalEl.addClass(`sketchnote-icons`);
    this.modalEl.addClass(`sketchnote-images`);
    const { contentEl } = this;
    contentEl.empty();
    const search = contentEl.createEl(`input`, { cls: `sketchnote-icons-search`, type: `search` });
    search.placeholder = t(`Chercher un dessin par son nom`);
    search.setAttribute(`aria-label`, t(`Chercher un dessin`));
    search.addEventListener(`input`, () => {
      this.query = search.value;
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.draw(true), 120);
    });
    this.info = contentEl.createDiv({ cls: `sketchnote-icons-info` });
    this.grid = contentEl.createDiv({ cls: `sketchnote-icons-grid sketchnote-images-grid` });
    this.more = contentEl.createEl(`button`, { cls: `sketchnote-icons-more`, text: t(`Afficher plus de dessins`) });
    this.more.addEventListener(`click`, () => {
      this.shown += PAGE;
      this.draw(false);
    });
    const folder = this.folder();
    this.files = this.app.vault.getFiles().filter((f) => f.extension === `sketchdraw` && f.path.startsWith(`${folder}/`));
    this.draw(true);
    window.setTimeout(() => search.focus(), 30);
  }

  onClose(): void {
    this.generation++;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.contentEl.empty();
  }

  // Draws the drawings that match the search, the most recent first. Each one is read when its cell is drawn.
  private draw(reset: boolean): void {
    if (reset) this.shown = PAGE;
    const list = this.files.filter((f) => this.query.trim() === `` || matchesName(f.path, this.query)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    const generation = ++this.generation;
    this.grid.empty();
    for (const file of list.slice(0, this.shown)) {
      const cell = this.grid.createEl(`button`, { cls: `sketchnote-icons-cell sketchnote-images-cell` });
      cell.setAttribute(`aria-label`, file.basename);
      const holder = cell.createDiv({ cls: `sketchnote-icons-holder sketchnote-images-holder` });
      cell.createSpan({ cls: `sketchnote-icons-label`, text: file.basename });
      void this.fill(file, holder, cell, generation);
    }
    this.more.toggleClass(`sketchnote-hidden`, list.length <= this.shown);
    this.info.setText(list.length === 0 ? t(`Aucun dessin dans la bibliothèque. Sélectionnez des éléments sur une page, puis utilisez le bouton Enregistrer dans la bibliothèque.`) : ``);
  }

  // Reads a drawing, shows it in its cell and makes the cell pick it. A drawing that cannot be read is dimmed and cannot be picked.
  private async fill(file: TFile, holder: HTMLElement, cell: HTMLElement, generation: number): Promise<void> {
    let doc: SketchdrawDoc | null = null;
    try {
      const result = parseSketchdraw(await this.app.vault.cachedRead(file));
      doc = result.ok ? result.doc : null;
    } catch {
      doc = null;
    }
    if (generation !== this.generation) return;
    const box = doc ? contentBox(doc) : null;
    if (!doc || !box) {
      cell.addClass(`is-unreadable`);
      return;
    }
    const svg = svgEl(`svg`, { viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`, preserveAspectRatio: `xMidYMid meet`, class: `sketchnote-library-thumb` }, holder);
    if (brightness(doc.ink) > 0.5) holder.addClass(`is-dark`);
    try {
      drawElements(doc.elements, svgEl(`g`, {}, svg), { ...PLAIN, ink: doc.ink });
    } catch {
      cell.addClass(`is-unreadable`);
      return;
    }
    const picked = doc;
    cell.addEventListener(`click`, () => {
      this.close();
      this.onPick(picked, file);
    });
  }
}
