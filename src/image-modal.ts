// The window where a picture of the vault is chosen: a search bar, two buttons to look in the images folder or in the whole vault, and the pictures as small views. A click on a
// picture picks it. A button opens the window that imports new pictures.
import { App, Modal, setIcon, TFile } from "obsidian";
import { t } from "./i18n";
import { AddImageModal } from "./add-image-modal";
import { IMAGE_MAX_BYTES, IMAGE_MAX_LISTED, isImageName, matchesName } from "./image-files";
import { importImages } from "./image-import";

// How many pictures are drawn at first, and added by each click on the button that shows more.
const PAGE = 48;

export class ImageModal extends Modal {
  private everywhere = false;
  private query = ``;
  private shown = PAGE;
  private grid!: HTMLElement;
  private info!: HTMLElement;
  private more!: HTMLElement;
  private places!: HTMLElement;
  private timer: number | null = null;
  private files: TFile[] = [];

  // Creates the window with the folder of the images, the function to call with the path of the picture that is picked, and the function that gives the folder when it changes.
  constructor(app: App, private folder: () => string, private onPick: (path: string) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t(`Choisir une image`));
    this.modalEl.addClass(`sketchnote-icons`);
    this.modalEl.addClass(`sketchnote-images`);
    const { contentEl } = this;
    contentEl.empty();
    const bar = contentEl.createDiv({ cls: `sketchnote-images-bar` });
    const search = bar.createEl(`input`, { cls: `sketchnote-icons-search`, type: `search` });
    search.placeholder = t(`Chercher une image par son nom`);
    search.setAttribute(`aria-label`, t(`Chercher une image`));
    search.addEventListener(`input`, () => {
      this.query = search.value;
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.draw(true), 120);
    });
    const add = bar.createEl(`button`, { cls: `sketchnote-images-add` });
    setIcon(add, `image-plus`);
    add.setAttribute(`aria-label`, t(`Ajouter une image`));
    add.setAttribute(`title`, t(`Ajouter une image`));
    add.addEventListener(`click`, () => this.openAdd());
    this.places = contentEl.createDiv({ cls: `sketchnote-icons-themes` });
    this.info = contentEl.createDiv({ cls: `sketchnote-icons-info` });
    this.grid = contentEl.createDiv({ cls: `sketchnote-icons-grid sketchnote-images-grid` });
    this.more = contentEl.createEl(`button`, { cls: `sketchnote-icons-more`, text: t(`Afficher plus d'images`) });
    this.more.addEventListener(`click`, () => {
      this.shown += PAGE;
      this.draw(false);
    });
    this.read();
    this.drawScope();
    this.draw(true);
    window.setTimeout(() => search.focus(), 30);
  }

  onClose(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.contentEl.empty();
  }

  // Reads the list of the pictures of the vault.
  private read(): void {
    this.files = this.app.vault.getFiles().filter((f) => isImageName(f.name) && f.stat.size <= IMAGE_MAX_BYTES).slice(0, IMAGE_MAX_LISTED);
  }

  // The pictures that are in the images folder.
  private inFolder(): TFile[] {
    const folder = this.folder();
    return this.files.filter((f) => f.path.startsWith(`${folder}/`));
  }

  // Draws the two buttons that choose where to look.
  private drawScope(): void {
    this.places.empty();
    const entries: [boolean, string, number][] = [[false, t(`Dossier des images`), this.inFolder().length], [true, t(`Tout le coffre`), this.files.length]];
    for (const [everywhere, label, count] of entries) {
      const button = this.places.createEl(`button`, { cls: `sketchnote-icons-theme`, text: label });
      button.setAttribute(`title`, `${count}`);
      if (everywhere === this.everywhere) button.addClass(`is-active`);
      button.addEventListener(`click`, () => {
        this.everywhere = everywhere;
        this.drawScope();
        this.draw(true);
      });
    }
  }

  // Draws the pictures that match the search, the most recent first.
  private draw(reset: boolean): void {
    if (reset) this.shown = PAGE;
    const list = (this.everywhere ? this.files : this.inFolder()).filter((f) => this.query.trim() === `` || matchesName(f.path, this.query)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    this.grid.empty();
    for (const file of list.slice(0, this.shown)) {
      const cell = this.grid.createEl(`button`, { cls: `sketchnote-icons-cell sketchnote-images-cell` });
      cell.setAttribute(`aria-label`, file.path);
      cell.setAttribute(`title`, file.path);
      const holder = cell.createDiv({ cls: `sketchnote-icons-holder sketchnote-images-holder` });
      const img = holder.createEl(`img`, { attr: { alt: ``, loading: `lazy`, decoding: `async`, src: this.app.vault.getResourcePath(file) } });
      img.draggable = false;
      cell.createSpan({ cls: `sketchnote-icons-label`, text: file.basename });
      cell.addEventListener(`click`, () => {
        this.close();
        this.onPick(file.path);
      });
    }
    this.more.toggleClass(`sketchnote-hidden`, list.length <= this.shown);
    this.info.setText(list.length === 0 ? (this.everywhere ? t(`Aucune image dans le coffre. Le bouton Ajouter une image les importe.`) : t(`Aucune image dans le dossier des images. Le bouton Ajouter une image les importe, ou choisissez Tout le coffre.`)) : t(`{0} images`, String(list.length)));
  }

  // Opens the window that imports pictures; the list is read again when it closes, and a picture that was imported is picked at once when it is the only one.
  private openAdd(): void {
    const folder = (): string => this.folder();
    new AddImageModal(this.app, { folder, importFiles: (files) => importImages(this.app, folder(), files) }, (paths) => {
      this.read();
      this.drawScope();
      this.draw(true);
      if (paths.length === 1) {
        this.close();
        this.onPick(paths[0]);
      }
    }).open();
  }
}
