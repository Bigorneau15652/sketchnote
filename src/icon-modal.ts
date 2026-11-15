// The window where an icon is chosen: a search bar, the themes, and the icons of the theme (Lucide and the drawings of the user). A click on an icon picks it.
import { App, Modal, setIcon } from "obsidian";
import { t } from "./i18n";
import type { IconData, IconWarning } from "./icon-svg";
import type { IconSource } from "./icon-store";
import { ICON_THEMES, IconEntry, listIcons, OTHER_THEME, themeLabel } from "./icon-themes";
import { svgEl } from "./svg";

// How many icons are drawn at first, and added by each click on the button that shows more.
const PAGE = 90;

// Returns the sentence that tells the user what was left out of a drawing.
export function warningText(warnings: IconWarning[]): string {
  const names: Record<IconWarning, string> = {
    transform: t(`transformations`),
    gradient: t(`dégradés`),
    text: t(`textes`),
    image: t(`images`),
    style: t(`feuilles de style`),
    use: t(`éléments répétés ou liés`),
    filter: t(`filtres`),
    clip: t(`masques et découpes`),
    unknown: t(`formes inconnues`),
  };
  return t(`Une partie du dessin n'a pas pu être reprise : {0}. Seules les formes en une seule couleur sont gardées.`, warnings.map((w) => names[w]).join(`, `));
}

// Draws the preview of a drawing of the user in a small picture, in the colour of the text.
function previewOf(parent: HTMLElement, data: IconData): void {
  const [x, y, w, h] = data.vb;
  const svg = svgEl(`svg`, { viewBox: `${x} ${y} ${w} ${h}`, class: `sketchnote-icon-preview`, preserveAspectRatio: `xMidYMid meet` }, parent);
  const line = Math.max(w, h) / 14;
  for (const shape of data.shapes) {
    svgEl(`path`, { d: shape.d, fill: shape.fill ? `currentColor` : `none`, stroke: shape.stroke ? `currentColor` : `none`, "stroke-width": line, "stroke-linecap": `round`, "stroke-linejoin": `round` }, svg);
  }
}

export class IconModal extends Modal {
  private theme: string | null = null;
  private query = ``;
  private shown = PAGE;
  private grid!: HTMLElement;
  private info!: HTMLElement;
  private more!: HTMLElement;
  private themes!: HTMLElement;
  private timer: number | null = null;
  private entries: IconEntry[] = [];

  // Creates the window with the icons that it offers and the function to call with the icon that is picked and its drawing.
  constructor(app: App, private source: IconSource, private onPick: (entry: IconEntry, data: IconData) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t(`Choisir une icône`));
    this.modalEl.addClass(`sketchnote-icons`);
    this.entries = this.source.entries();
    const { contentEl } = this;
    contentEl.empty();
    const search = contentEl.createEl(`input`, { cls: `sketchnote-icons-search`, type: `search` });
    search.placeholder = t(`Chercher : maison, flamme, flèche, bâtiment…`);
    search.setAttribute(`aria-label`, t(`Chercher une icône`));
    search.addEventListener(`input`, () => {
      this.query = search.value;
      // The list is drawn again a moment after the last key, so that typing stays smooth.
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.draw(true), 120);
    });
    this.themes = contentEl.createDiv({ cls: `sketchnote-icons-themes` });
    this.info = contentEl.createDiv({ cls: `sketchnote-icons-info` });
    this.grid = contentEl.createDiv({ cls: `sketchnote-icons-grid` });
    this.more = contentEl.createEl(`button`, { cls: `sketchnote-icons-more`, text: t(`Afficher plus d'icônes`) });
    this.more.addEventListener(`click`, () => {
      this.shown += PAGE;
      this.draw(false);
    });
    this.drawThemes();
    this.draw(true);
    window.setTimeout(() => search.focus(), 30);
  }

  onClose(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.contentEl.empty();
  }

  // Draws the buttons of the themes: all the icons, the themes of Lucide that have icons, the others, then the themes of the folder of the user.
  private drawThemes(): void {
    this.themes.empty();
    const count = (id: string | null): number => this.entries.filter((e) => id === null || e.themes.includes(id)).length;
    const own = [...new Set(this.entries.filter((e) => e.source === `custom`).flatMap((e) => e.themes))].sort((a, b) => a.localeCompare(b));
    const ids: (string | null)[] = [null, ...ICON_THEMES.map((th) => th.id).filter((id) => count(id) > 0), ...(count(OTHER_THEME.id) > 0 ? [OTHER_THEME.id] : []), ...own];
    for (const id of ids) {
      const button = this.themes.createEl(`button`, { cls: `sketchnote-icons-theme`, text: id === null ? t(`Toutes`) : themeLabel(id) });
      button.setAttribute(`title`, `${count(id)}`);
      if (id === this.theme) button.addClass(`is-active`);
      button.addEventListener(`click`, () => {
        this.theme = id;
        this.shown = PAGE;
        this.drawThemes();
        this.draw(true);
      });
    }
  }

  // Draws the icons that match the theme and the search.
  private draw(reset: boolean): void {
    if (reset) this.shown = PAGE;
    const { shown, total } = listIcons(this.entries, this.theme, this.query, this.shown);
    this.grid.empty();
    for (const entry of shown) {
      const cell = this.grid.createEl(`button`, { cls: `sketchnote-icons-cell` });
      cell.setAttribute(`aria-label`, entry.label);
      cell.setAttribute(`title`, entry.label);
      const holder = cell.createDiv({ cls: `sketchnote-icons-holder` });
      if (entry.source === `lucide`) setIcon(holder, `lucide-${entry.name}`);
      else {
        const data = this.source.dataOf(entry);
        if (data) previewOf(holder, data);
      }
      cell.createSpan({ cls: `sketchnote-icons-label`, text: entry.label });
      cell.addEventListener(`click`, () => this.pick(entry));
    }
    this.more.toggleClass(`sketchnote-hidden`, shown.length >= total);
    const bad = this.source.problems.length;
    const parts = [total === 0 ? t(`Aucune icône ne correspond.`) : t(`{0} icônes`, String(total))];
    if (bad > 0) parts.push(t(`{0} fichiers SVG du dossier {1} n'ont pas pu être utilisés : {2}`, String(bad), this.source.folder(), this.source.problems.slice(0, 3).join(` ; `) + (bad > 3 ? ` …` : ``)));
    this.info.setText(parts.join(` · `));
  }

  // Picks an icon: its drawing is read and given to the caller, and the window closes.
  private pick(entry: IconEntry): void {
    const data = this.source.dataOf(entry);
    if (!data) {
      this.info.setText(t(`Cette icône ne peut pas être lue.`));
      return;
    }
    this.close();
    this.onPick(entry, data);
  }
}
