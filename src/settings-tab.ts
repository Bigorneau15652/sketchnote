// The settings page of the plugin: the folder that holds the drawing notes. The field suggests the folders of the vault, and a folder that does not exist is created.
import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
import type SketchnotePlugin from "./main";
import { t } from "./i18n";
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
  }
}
