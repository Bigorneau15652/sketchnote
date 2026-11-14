// The view that opens a .sketchnote file. In this version it shows the empty page; the tools come in the next versions.
import { TextFileView, WorkspaceLeaf } from "obsidian";
import { createEmptyDoc, parseSketchnote, serializeSketchnote, SketchnoteDoc } from "./file-format";
import { t } from "./i18n";
import { svgEl } from "./svg";

export const VIEW_TYPE = `sketchnote-view`;

export class SketchnoteView extends TextFileView {
  private doc: SketchnoteDoc = createEmptyDoc();
  private error: string | null = null;

  // Creates the view inside a workspace leaf.
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  // Returns the identifier of the view type.
  getViewType(): string {
    return VIEW_TYPE;
  }

  // Returns the title shown in the tab.
  getDisplayText(): string {
    return this.file ? this.file.basename : t(`Nouveau sketchnote`);
  }

  // Returns the icon shown in the tab.
  getIcon(): string {
    return `pencil`;
  }

  // Returns the text to write in the file.
  getViewData(): string {
    return serializeSketchnote(this.doc);
  }

  // Receives the text of the file, reads it and draws the page. An unreadable file shows its error and is never overwritten by the view.
  setViewData(data: string, clear: boolean): void {
    if (clear) this.clear();
    const result = parseSketchnote(data);
    if (result.ok) {
      this.doc = result.doc;
      this.error = null;
    } else {
      this.error = result.error;
    }
    this.render();
  }

  // Resets the view to an empty document.
  clear(): void {
    this.doc = createEmptyDoc();
    this.error = null;
    this.contentEl.empty();
  }

  // Draws the page, or the error message when the file cannot be read.
  private render(): void {
    const host = this.contentEl;
    host.empty();
    host.addClass(`sketchnote-host`);
    if (this.error !== null) {
      host.createDiv({ cls: `sketchnote-error`, text: t(`Ce fichier sketchnote est illisible : {0}`, this.error) });
      return;
    }
    const { width, height, background } = this.doc.page;
    const svg = svgEl(`svg`, { class: `sketchnote-page`, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: `xMidYMid meet` }, host);
    svgEl(`rect`, { x: 0, y: 0, width, height, fill: background, stroke: `#999999` }, svg);
    const label = svgEl(`text`, { x: width / 2, y: height / 2, "text-anchor": `middle`, fill: `#888888`, "font-size": 20 }, svg);
    label.textContent = t(`Page vide. Les outils de dessin arrivent dans les prochaines versions.`);
  }
}
