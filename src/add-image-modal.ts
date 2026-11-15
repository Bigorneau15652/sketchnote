// The window to add pictures: it explains the steps (choose a picture on a site, download it, import it), opens the sites and imports the downloaded files from any folder of the
// computer. Every button is a pictogram whose name is its tooltip. Same steps as the window of the fonts.
import { App, Modal, setIcon } from "obsidian";
import { t } from "./i18n";
import { imageSites } from "./image-sites";
import type { ImageImportReport } from "./image-import";

export interface AddImageHost {
  folder(): string;
  // Copies the files into the images folder.
  importFiles(files: File[]): Promise<ImageImportReport>;
}

export class AddImageModal extends Modal {
  // Creates the window with what it needs from the plugin and the function to call when it closes, with the paths of the pictures that were imported.
  constructor(app: App, private host: AddImageHost, private done: (paths: string[]) => void) {
    super(app);
  }

  // The pictures imported while the window was open.
  private imported: string[] = [];

  onOpen(): void {
    this.titleEl.setText(t(`Ajouter une image`));
    this.modalEl.addClass(`sketchnote-addfont`);
    this.render();
  }

  onClose(): void {
    this.done(this.imported);
  }

  // Draws the steps, the list of sites, the drop zone and, after an import, its report.
  private render(report?: ImageImportReport): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl(`h4`, { text: t(`1. Choisir une image`) });
    contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Ouvrez l'un de ces sites dans votre navigateur et choisissez une image. Vérifiez sa licence : elle doit autoriser l'usage dans un document diffusé.`) });
    for (const site of imageSites()) {
      const row = contentEl.createDiv({ cls: `sketchnote-addfont-site` });
      row.createEl(`a`, { text: site.name, href: site.url, attr: { target: `_blank`, rel: `noopener` } });
      row.createSpan({ cls: `sketchnote-addfont-note`, text: site.note });
    }
    contentEl.createEl(`h4`, { text: t(`2. Télécharger`) });
    contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Le site fournit un fichier d'image (PNG, JPEG, WebP, GIF ou SVG), que votre navigateur place le plus souvent dans le dossier Téléchargements.`) });
    contentEl.createEl(`h4`, { text: t(`3. Importer dans le coffre`) });
    contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Importez les fichiers depuis n'importe quel dossier de votre ordinateur : ils sont copiés dans le dossier des images du coffre ({0}). Vous pouvez aussi les glisser dans le cadre ci-dessous, ou les copier vous-même dans ce dossier.`, this.host.folder()) });

    const drop = contentEl.createDiv({ cls: `sketchnote-addfont-drop` });
    drop.createSpan({ text: t(`Glissez ici des fichiers d'image`) });
    const choose = drop.createEl(`button`, { cls: `mod-cta sketchnote-addfont-choose` });
    setIcon(choose, `upload`);
    choose.setAttribute(`aria-label`, t(`Importer des fichiers`));
    choose.setAttribute(`title`, t(`Importer des fichiers`));
    const input = drop.createEl(`input`, { type: `file`, attr: { multiple: `true`, accept: `.png,.jpg,.jpeg,.webp,.gif,.svg`, hidden: `true` } });
    choose.addEventListener(`click`, () => input.click());
    input.addEventListener(`change`, () => void this.take(Array.from(input.files ?? [])));
    drop.addEventListener(`dragover`, (e) => {
      e.preventDefault();
      drop.addClass(`is-over`);
    });
    drop.addEventListener(`dragleave`, () => drop.removeClass(`is-over`));
    drop.addEventListener(`drop`, (e) => {
      e.preventDefault();
      drop.removeClass(`is-over`);
      void this.take(Array.from(e.dataTransfer?.files ?? []));
    });

    if (!report) return;
    if (report.added.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-ok`, text: t(`Fichiers copiés : {0}`, report.added.join(`, `)) });
    if (report.unchanged.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Fichiers déjà présents et identiques : {0}`, report.unchanged.join(`, `)) });
    if (report.failed.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-problem`, text: t(`Fichiers refusés (trop volumineux, illisibles ou copie impossible) : {0}`, report.failed.join(`, `)) });
    if (report.skipped.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-problem`, text: t(`Fichiers ignorés (ce ne sont pas des images PNG, JPEG, WebP, GIF ou SVG) : {0}`, report.skipped.join(`, `)) });
    if (report.added.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Les images sont dans la fenêtre Image de la barre d'outils d'un dessin.`) });
  }

  // Imports the chosen files and shows the report.
  private async take(files: File[]): Promise<void> {
    if (files.length === 0) return;
    const report = await this.host.importFiles(files);
    this.imported.push(...report.paths);
    this.render(report);
  }
}
