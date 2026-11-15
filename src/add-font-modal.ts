// The window to add a font: it explains the steps (choose a font on a site, download it, import it), opens the sites and imports the downloaded files from any folder of the
// computer. Every button is a pictogram whose name is its tooltip. Same steps as the plugin Bigorneau of the same author.
import { App, Modal, setIcon } from "obsidian";
import { t } from "./i18n";
import type { ImportReport } from "./font-import";

export interface AddFontHost {
  folder(): string;
  // Copies the files into the fonts folder, then reads it again.
  importFiles(files: File[]): Promise<ImportReport>;
}

// The font sites: address and advice for each one.
export function fontSites(): { name: string; url: string; note: string }[] {
  return [
    { name: `Google Fonts`, url: `https://fonts.google.com`, note: t(`Libres. Bouton Get font, puis Download all : prenez les fichiers du dossier static.`) },
    { name: `Font Squirrel`, url: `https://www.fontsquirrel.com`, note: t(`Libres pour tout usage, y compris professionnel. Bouton Download TTF.`) },
    { name: `Fontshare`, url: `https://www.fontshare.com`, note: t(`Libres pour tout usage. Bouton Download family.`) },
    { name: `Open Font Library`, url: `https://fontlibrary.org`, note: t(`Libres, sous licence ouverte.`) },
    { name: `Velvetyne`, url: `https://velvetyne.fr/fonts`, note: t(`Libres, création contemporaine.`) },
    { name: `DaFont`, url: `https://www.dafont.com`, note: t(`Attention : beaucoup de polices sont gratuites pour un usage personnel seulement. Choisissez les catégories 100% Free ou Public domain.`) },
  ];
}

export class AddFontModal extends Modal {
  // Creates the window with what it needs from the plugin and the function to call when it closes.
  constructor(app: App, private host: AddFontHost, private done: () => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t(`Ajouter une police`));
    this.modalEl.addClass(`sketchnote-addfont`);
    this.render();
  }

  onClose(): void {
    this.done();
  }

  // Draws the steps, the list of sites, the drop zone and, after an import, its report.
  private render(report?: ImportReport): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl(`h4`, { text: t(`1. Choisir une police`) });
    contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Ouvrez l'un de ces sites dans votre navigateur et choisissez une police. Vérifiez sa licence : elle doit autoriser l'usage dans un document diffusé.`) });
    for (const site of fontSites()) {
      const row = contentEl.createDiv({ cls: `sketchnote-addfont-site` });
      row.createEl(`a`, { text: site.name, href: site.url, attr: { target: `_blank`, rel: `noopener` } });
      row.createSpan({ cls: `sketchnote-addfont-note`, text: site.note });
    }
    contentEl.createEl(`h4`, { text: t(`2. Télécharger`) });
    contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Le site fournit un fichier zip ou des fichiers .ttf et .otf, que votre navigateur place le plus souvent dans le dossier Téléchargements. Les formats WOFF et les collections .ttc ne sont pas utilisables.`) });
    contentEl.createEl(`h4`, { text: t(`3. Importer dans le coffre`) });
    contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Importez le zip ou les fichiers depuis n'importe quel dossier de votre ordinateur : ils sont copiés dans le dossier des polices du coffre ({0}). Vous pouvez aussi les glisser dans le cadre ci-dessous, ou les copier vous-même dans ce dossier.`, this.host.folder()) });

    const drop = contentEl.createDiv({ cls: `sketchnote-addfont-drop` });
    drop.createSpan({ text: t(`Glissez ici des fichiers .zip, .ttf ou .otf`) });
    const choose = drop.createEl(`button`, { cls: `mod-cta sketchnote-addfont-choose` });
    setIcon(choose, `upload`);
    choose.setAttribute(`aria-label`, t(`Importer des fichiers`));
    const input = drop.createEl(`input`, { type: `file`, attr: { multiple: `true`, accept: `.zip,.ttf,.otf`, hidden: `true` } });
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
    if (report.replaced.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Fichiers remplacés (même nom, contenu différent) : {0}`, report.replaced.join(`, `)) });
    if (report.unchanged.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Fichiers déjà présents et identiques : {0}`, report.unchanged.join(`, `)) });
    if (report.failed.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-problem`, text: t(`Fichiers refusés (trop volumineux, illisibles ou copie impossible) : {0}`, report.failed.join(`, `)) });
    if (report.skipped.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-problem`, text: t(`Fichiers ignorés (aucune police .ttf ou .otf) : {0}`, report.skipped.join(`, `)) });
    if (report.added.length > 0) contentEl.createDiv({ cls: `sketchnote-addfont-note`, text: t(`Les polices apparaissent dans la liste des polices de l'outil Texte.`) });
  }

  // Imports the chosen files and shows the report.
  private async take(files: File[]): Promise<void> {
    if (files.length === 0) return;
    this.render(await this.host.importFiles(files));
  }
}
