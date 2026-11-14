// The window that sets up the page: format, orientation, size, background style, background colour and default ink.
import { App, Modal, Setting } from "obsidian";
import { MAX_PAGE_SIZE, MIN_PAGE_SIZE, PageSettings, Pattern } from "./file-format";
import { t } from "./i18n";
import { toHex6 } from "./page-background";
import { changeBackground, changeInk, changeOrientation, changePreset, changeSize, changeStyle, detectPreset, PresetId } from "./page-settings";

export class PageModal extends Modal {
  private page: PageSettings;
  private readonly onChange: (page: PageSettings) => void;

  // Creates the window with the current page settings and a function called after each change.
  constructor(app: App, page: PageSettings, onChange: (page: PageSettings) => void) {
    super(app);
    this.page = page;
    this.onChange = onChange;
  }

  // Draws the window when it opens.
  onOpen(): void {
    this.build();
  }

  // Empties the window when it closes.
  onClose(): void {
    this.contentEl.empty();
  }

  // Stores a new version of the page, tells the view and draws the window again so that every field shows the new values.
  private apply(page: PageSettings): void {
    this.page = page;
    this.onChange(page);
    this.build();
  }

  // Builds every field of the window.
  private build(): void {
    const el = this.contentEl;
    el.empty();
    this.setTitle(t(`Réglages de la page`));
    const preset = detectPreset(this.page);

    new Setting(el)
      .setName(t(`Format`))
      .addDropdown((d) => {
        const labels: Record<PresetId, string> = { a5: `A5`, a4: `A4`, a3: `A3`, wide: `16/9`, square: t(`Carré`), custom: t(`Libre`) };
        for (const id of Object.keys(labels) as PresetId[]) d.addOption(id, labels[id]);
        d.setValue(preset).onChange((v) => this.apply(changePreset(this.page, v as PresetId)));
      });

    new Setting(el)
      .setName(t(`Orientation`))
      .addDropdown((d) => {
        d.addOption(`portrait`, t(`Portrait`)).addOption(`landscape`, t(`Paysage`));
        d.setValue(this.page.orientation).onChange((v) => this.apply(changeOrientation(this.page, v === `landscape` ? `landscape` : `portrait`)));
      });

    new Setting(el)
      .setName(t(`Dimensions`))
      .setDesc(t(`En pixels, entre {0} et {1}. Une dimension modifiée à la main passe le format en libre.`, MIN_PAGE_SIZE, MAX_PAGE_SIZE))
      .addText((x) => this.sizeField(x.inputEl, `width`))
      .addText((x) => this.sizeField(x.inputEl, `height`));

    new Setting(el)
      .setName(t(`Fond`))
      .addDropdown((d) => {
        const styles: [Pattern, string][] = [
          [`blank`, t(`Blanc`)],
          [`lines`, t(`Lignes`)],
          [`grid`, t(`Quadrillage`)],
          [`dots`, t(`Points`)],
          [`craft`, t(`Papier craft`)],
          [`chalkboard`, t(`Tableau noir`)],
        ];
        for (const [id, label] of styles) d.addOption(id, label);
        d.setValue(this.page.pattern).onChange((v) => this.apply(changeStyle(this.page, v as Pattern)));
      });

    new Setting(el)
      .setName(t(`Couleur du fond`))
      .addColorPicker((c) => c.setValue(toHex6(this.page.background)).onChange((v) => this.apply(changeBackground(this.page, v))));

    new Setting(el)
      .setName(t(`Couleur du trait par défaut`))
      .setDesc(t(`Couleur proposée pour écrire et dessiner. Sur le tableau noir, elle passe au blanc.`))
      .addColorPicker((c) => c.setValue(toHex6(this.page.ink)).onChange((v) => this.apply(changeInk(this.page, v))));
  }

  // Fills a number field with a page dimension and applies the typed value when the field loses focus or Enter is pressed.
  private sizeField(input: HTMLInputElement, side: `width` | `height`): void {
    input.type = `number`;
    input.min = String(MIN_PAGE_SIZE);
    input.max = String(MAX_PAGE_SIZE);
    input.value = String(this.page[side]);
    input.setAttribute(`aria-label`, side === `width` ? t(`Largeur`) : t(`Hauteur`));
    input.addEventListener(`change`, () => {
      const n = Number(input.value);
      if (!Number.isFinite(n)) return this.build();
      this.apply(side === `width` ? changeSize(this.page, n, this.page.height) : changeSize(this.page, this.page.width, n));
    });
  }
}
