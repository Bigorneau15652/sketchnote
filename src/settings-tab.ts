// The settings page of the plugin: the folder that holds the drawing notes.
import { App, PluginSettingTab, Setting } from "obsidian";
import type SketchnotePlugin from "./main";
import { t } from "./i18n";
import { DEFAULT_SETTINGS, normalizeFolder } from "./settings";

export class SketchnoteSettingTab extends PluginSettingTab {
  private readonly plugin: SketchnotePlugin;

  // Creates the settings page for the plugin.
  constructor(app: App, plugin: SketchnotePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Draws the settings page.
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName(t(`Dossier des dessins`))
      .setDesc(t(`Dossier du coffre qui contient toutes les notes de dessin des sketchnotes. Il est créé au premier dessin. Un dossier déjà utilisé n'est pas déplacé : les dessins existants restent où ils sont.`))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.drawingsFolder)
          .setValue(this.plugin.settingsData.drawingsFolder)
          .onChange(async (value) => {
            const folder = normalizeFolder(value);
            text.inputEl.toggleClass(`mod-error`, folder === null);
            if (folder === null) return;
            this.plugin.settingsData.drawingsFolder = folder;
            await this.plugin.saveData(this.plugin.settingsData);
          }),
      );
    containerEl.createEl(`p`, { cls: `setting-item-description`, text: t(`Dossier non valide : pas de chemin absolu, pas de « .. » et aucun des caractères interdits dans un nom de fichier.`) });
  }
}
