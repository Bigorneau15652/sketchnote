// The settings page of the plugin: the folder that holds the drawing notes. The field suggests the folders of the vault, and a folder that does not exist is created.
import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
import type SketchnotePlugin from "./main";
import { t } from "./i18n";
import { AddFontModal } from "./add-font-modal";
import { AddImageModal } from "./add-image-modal";
import { renderDrawButtonList } from "./draw-buttons-list";
import { importImages } from "./image-import";
import { importFonts } from "./font-import";
import { DEFAULT_SETTINGS, normalizeFolder } from "./settings";

// Suggests the folders of the vault under a text field.
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private readonly onPick: (path: string) => void;

  // Creates the suggestions for a field, with the function to call when a folder is picked.
  constructor(app: App, input: HTMLInputElement, onPick: (path: string) => void) {
    super(app, input);
    this.onPick = onPick;
  }

  // Returns the folders whose path holds what was typed (all the folders when nothing is typed), in alphabetical order.
  getSuggestions(query: string): TFolder[] {
    const q = query.trim().toLowerCase().replace(/^\/+/, ``);
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder && f.path !== `/` && f.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  // Draws one suggestion.
  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  // Puts the picked folder in the field and keeps it.
  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.onPick(folder.path);
    this.close();
  }
}

export class SketchnoteSettingTab extends PluginSettingTab {
  private readonly plugin: SketchnotePlugin;

  // Creates the settings page for the plugin.
  constructor(app: App, plugin: SketchnotePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Keeps a folder as the folder of the drawings, then creates it if it does not exist yet.
  private async keepFolder(folder: string): Promise<void> {
    this.plugin.settingsData.drawingsFolder = folder;
    await this.plugin.saveData(this.plugin.settingsData);
    if (await this.plugin.drawings.ensureFolder(folder)) new Notice(t(`Dossier créé : {0}`, folder));
  }

  // Keeps a folder as the fonts folder, creates it when it does not exist and reads it.
  private async keepFontsFolder(folder: string): Promise<void> {
    this.plugin.settingsData.fontsFolder = folder;
    await this.plugin.saveData(this.plugin.settingsData);
    if (await this.plugin.drawings.ensureFolder(folder)) new Notice(t(`Dossier créé : {0}`, folder));
    await this.plugin.fonts.refresh(true);
  }

  // Keeps a folder as the folder of the icons of the user and creates it when it does not exist.
  private async keepIconsFolder(folder: string): Promise<void> {
    this.plugin.settingsData.iconsFolder = folder;
    await this.plugin.saveData(this.plugin.settingsData);
    if (await this.plugin.drawings.ensureFolder(folder)) new Notice(t(`Dossier créé : {0}`, folder));
    await this.plugin.icons.refresh();
  }

  // Keeps a folder as the folder of the images and creates it when it does not exist.
  private async keepImagesFolder(folder: string): Promise<void> {
    this.plugin.settingsData.imagesFolder = folder;
    await this.plugin.saveData(this.plugin.settingsData);
    if (await this.plugin.drawings.ensureFolder(folder)) new Notice(t(`Dossier créé : {0}`, folder));
  }

  // Keeps a folder as the folder of the library of drawings and creates it when it does not exist.
  private async keepLibraryFolder(folder: string): Promise<void> {
    this.plugin.settingsData.libraryFolder = folder;
    await this.plugin.saveData(this.plugin.settingsData);
    if (await this.plugin.drawings.ensureFolder(folder)) new Notice(t(`Dossier créé : {0}`, folder));
  }

  // Keeps a folder as the folder of the exports and creates it when it does not exist.
  private async keepExportsFolder(folder: string): Promise<void> {
    this.plugin.settingsData.exportsFolder = folder;
    await this.plugin.saveData(this.plugin.settingsData);
    if (await this.plugin.drawings.ensureFolder(folder)) new Notice(t(`Dossier créé : {0}`, folder));
  }

  // Draws the settings page.
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const warning = containerEl.createEl(`p`, { cls: `setting-item-description mod-warning`, text: t(`Dossier non valide : pas de « .. », pas de lettre de lecteur et aucun des caractères interdits dans un nom de fichier.`) });
    warning.hide();
    new Setting(containerEl)
      .setName(t(`Dossier des dessins`))
      .setDesc(t(`Dossier du coffre qui contient toutes les notes de dessin. Cliquez dans la cellule pour choisir un dossier existant, ou tapez un nouveau nom : il est créé s'il n'existe pas. Les dessins déjà créés ne sont pas déplacés.`))
      .addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.drawingsFolder).setValue(this.plugin.settingsData.drawingsFolder);
        text.onChange((value) => {
          const folder = normalizeFolder(value);
          text.inputEl.toggleClass(`mod-error`, folder === null);
          if (folder === null) warning.show();
          else warning.hide();
        });
        text.inputEl.addEventListener(`change`, () => {
          const folder = normalizeFolder(text.getValue());
          if (folder !== null) void this.keepFolder(folder);
        });
        new FolderSuggest(this.app, text.inputEl, (path) => {
          text.inputEl.removeClass(`mod-error`);
          warning.hide();
          void this.keepFolder(path);
        });
      });

    const fontsSetting = new Setting(containerEl)
      .setName(t(`Dossier des polices`))
      .setDesc(t(`Dossier du coffre où sont rangées les polices ajoutées (fichiers .ttf et .otf). Une police déposée dans ce dossier apparaît dans la liste de l'outil Texte. Le bouton Nouvelle police ouvre la fenêtre qui explique où trouver des polices libres et les importe.`));
    fontsSetting.settingEl.addClass(`sketchnote-setting-stack`);
    fontsSetting
      .addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.fontsFolder).setValue(this.plugin.settingsData.fontsFolder);
        text.inputEl.addEventListener(`change`, () => {
          const folder = normalizeFolder(text.getValue());
          text.inputEl.toggleClass(`mod-error`, folder === null);
          if (folder !== null) void this.keepFontsFolder(folder);
        });
        new FolderSuggest(this.app, text.inputEl, (path) => {
          text.inputEl.removeClass(`mod-error`);
          void this.keepFontsFolder(path);
        });
      })
      .addButton((button) =>
        button
          .setButtonText(t(`Nouvelle police`))
          .setTooltip(t(`Ajouter une police`))
          .onClick(() => {
            const folder = (): string => this.plugin.settingsData.fontsFolder;
            new AddFontModal(this.app, { folder, importFiles: async (files) => {
              const report = await importFonts(this.app, folder(), files);
              await this.plugin.fonts.refresh(true);
              return report;
            } }, () => undefined).open();
          }),
      );

    new Setting(containerEl)
      .setName(t(`Dossier des icônes`))
      .setDesc(t(`Dossier du coffre où vous rangez vos propres dessins au format SVG. Ils apparaissent dans la fenêtre des icônes, avec celles de Lucide : un sous-dossier est un thème (par exemple Chantier ou Énergie). Seules les formes sont lues, en une seule couleur : les dégradés, les images et les textes d'un SVG sont ignorés, et la fenêtre dit ce qui n'a pas pu être utilisé. Le dossier est créé s'il n'existe pas.`))
      .addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.iconsFolder).setValue(this.plugin.settingsData.iconsFolder);
        text.inputEl.addEventListener(`change`, () => {
          const folder = normalizeFolder(text.getValue());
          text.inputEl.toggleClass(`mod-error`, folder === null);
          if (folder !== null) void this.keepIconsFolder(folder);
        });
        new FolderSuggest(this.app, text.inputEl, (path) => {
          text.inputEl.removeClass(`mod-error`);
          void this.keepIconsFolder(path);
        });
      });

    const imagesSetting = new Setting(containerEl)
      .setName(t(`Dossier des images`))
      .setDesc(t(`Dossier du coffre où sont rangées les images ajoutées à un dessin : celles que vous importez, que vous glissez sur un dessin ou que vous collez. Le dessin ne garde que le chemin de l'image : si vous la déplacez ou la supprimez, le dessin la signale introuvable. Le bouton Nouvelle image ouvre la fenêtre qui explique où trouver des images libres et les importe. Le dossier est créé s'il n'existe pas.`));
    imagesSetting.settingEl.addClass(`sketchnote-setting-stack`);
    imagesSetting
      .addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.imagesFolder).setValue(this.plugin.settingsData.imagesFolder);
        text.inputEl.addEventListener(`change`, () => {
          const folder = normalizeFolder(text.getValue());
          text.inputEl.toggleClass(`mod-error`, folder === null);
          if (folder !== null) void this.keepImagesFolder(folder);
        });
        new FolderSuggest(this.app, text.inputEl, (path) => {
          text.inputEl.removeClass(`mod-error`);
          void this.keepImagesFolder(path);
        });
      })
      .addButton((button) =>
        button
          .setButtonText(t(`Nouvelle image`))
          .setTooltip(t(`Ajouter une image`))
          .onClick(() => {
            const folder = (): string => this.plugin.settingsData.imagesFolder;
            new AddImageModal(this.app, { folder, importFiles: (files) => importImages(this.app, folder(), files) }, () => undefined).open();
          }),
      );

    new Setting(containerEl)
      .setName(t(`Dossier de la bibliothèque de dessins`))
      .setDesc(t(`Dossier du coffre où sont enregistrés les dessins que vous mettez dans la bibliothèque (une sélection de la page, avec le bouton Enregistrer dans la bibliothèque) et où le bouton Dessins va les chercher pour les remettre sur la page. Chaque dessin est une note .sketchdraw que vous pouvez renommer, déplacer ou supprimer dans Obsidian. Le dossier est créé s'il n'existe pas.`))
      .addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.libraryFolder).setValue(this.plugin.settingsData.libraryFolder);
        text.inputEl.addEventListener(`change`, () => {
          const folder = normalizeFolder(text.getValue());
          text.inputEl.toggleClass(`mod-error`, folder === null);
          if (folder !== null) void this.keepLibraryFolder(folder);
        });
        new FolderSuggest(this.app, text.inputEl, (path) => {
          text.inputEl.removeClass(`mod-error`);
          void this.keepLibraryFolder(path);
        });
      });

    new Setting(containerEl)
      .setName(t(`Dossier des exports`))
      .setDesc(t(`Dossier du coffre où sont enregistrés les exports (PNG, SVG et PDF) faits avec le bouton Exporter de la barre du bas d'une page ou d'un dessin. Le dossier est créé s'il n'existe pas.`))
      .addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.exportsFolder).setValue(this.plugin.settingsData.exportsFolder);
        text.inputEl.addEventListener(`change`, () => {
          const folder = normalizeFolder(text.getValue());
          text.inputEl.toggleClass(`mod-error`, folder === null);
          if (folder !== null) void this.keepExportsFolder(folder);
        });
        new FolderSuggest(this.app, text.inputEl, (path) => {
          text.inputEl.removeClass(`mod-error`);
          void this.keepExportsFolder(path);
        });
      });

    new Setting(containerEl).setName(t(`Mode zen`)).setHeading();
    new Setting(containerEl)
      .setName(t(`Plein écran en mode zen`))
      .setDesc(t(`La fenêtre passe aussi en plein écran. Le mode zen se lance avec le bouton Mode zen de la page ou avec la commande du même nom de la palette de commandes (donnez-lui un raccourci dans les réglages d'Obsidian).`))
      .addToggle((toggle) => toggle.setValue(this.plugin.settingsData.zenFullscreen).onChange((value) => void this.plugin.changeSettings({ zenFullscreen: value })));

    new Setting(containerEl).setName(t(`Dessinateur`)).setHeading();
    new Setting(containerEl)
      .setName(t(`Position du menu`))
      .setDesc(t(`Le menu du bouton choisi à droite du dessin se place au-dessus ou en dessous du dessin.`))
      .addDropdown((d) =>
        d
          .addOption(`bottom`, t(`En bas`))
          .addOption(`top`, t(`En haut`))
          .setValue(this.plugin.settingsData.contextPosition)
          .onChange((value) => void this.plugin.changeSettings({ contextPosition: value === `top` ? `top` : `bottom` })),
      );
    new Setting(containerEl).setName(t(`Boutons à droite du dessin`)).setDesc(t(`Cochez les boutons à afficher, glissez la poignée d'une ligne pour changer l'ordre et ajoutez des séparations entre les groupes. Le même réglage est dans la fenêtre du premier bouton de la colonne.`));
    renderDrawButtonList(containerEl, {
      app: this.app,
      order: () => this.plugin.settingsData.drawButtonsOrder,
      hidden: () => this.plugin.settingsData.drawButtonsHidden,
      save: (order, hidden) => this.plugin.changeSettings({ drawButtonsOrder: order, drawButtonsHidden: hidden }),
    });
  }
}
