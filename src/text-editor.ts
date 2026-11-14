// The writing of a text on the surface of a drawing: a text area placed over the place of the text, in its font, at its size on the screen and in its colour. The text
// area holds plain text only. Enter makes a new line; Escape, Ctrl+Enter (Cmd+Enter) or a click elsewhere ends the writing. No dependency on Obsidian.
import type { TextAlign } from "./elements";
import { LINE_HEIGHT, textLines } from "./text-layout";

export interface TextEditorOptions {
  // Where the text area goes, in pixels of the window (the top left corner of the text), and the zoom of the surface.
  left: number;
  top: number;
  zoom: number;
  font: string;
  size: number;
  color: string;
  align: TextAlign;
  initial: string;
  // Gives the width in drawing units of a line of text, to size the text area.
  measure: (line: string) => number;
  // Writing in a zone (a text zone, or the inside of a shape): the text area has the size of the zone (in drawing units) and the text wraps to its width. When `centered` is
  // true the text is centred in height too, like the text of a shape; `lineCount` gives the number of lines of a text once wrapped, to do so.
  zone?: { width: number; height: number; centered: boolean; lineCount: (text: string) => number };
  // Called once with the text when the writing ends.
  onDone: (text: string) => void;
}

// Opens the text area and gives focus to it. Returns a function that ends the writing from the outside (for example when the tool changes).
export function openTextEditor(doc: Document, o: TextEditorOptions): () => void {
  const area = doc.createElement(`textarea`);
  area.className = `sketchnote-text-editor`;
  area.value = o.initial;
  area.rows = 1;
  area.spellcheck = false;
  area.setAttribute(`wrap`, o.zone ? `soft` : `off`);
  if (o.zone) area.classList.add(`is-zone`);
  area.style.left = `${o.left}px`;
  area.style.top = `${o.top}px`;
  area.style.fontFamily = o.font;
  area.style.fontSize = `${o.size * o.zoom}px`;
  area.style.lineHeight = `${LINE_HEIGHT}`;
  area.style.color = o.color;
  area.style.textAlign = o.align;
  let done = false;
  // Fits the text area to its text: the widest line and one row for each line.
  const fit = (): void => {
    if (o.zone) {
      area.style.width = `${Math.ceil(o.zone.width * o.zoom)}px`;
      area.style.height = `${Math.ceil(o.zone.height * o.zoom)}px`;
      const free = o.zone.height - o.zone.lineCount(area.value) * o.size * LINE_HEIGHT;
      area.style.paddingTop = o.zone.centered && free > 0 ? `${Math.floor((free / 2) * o.zoom)}px` : `0px`;
      return;
    }
    const lines = textLines(area.value);
    let width = o.size * 0.5;
    for (const line of lines) width = Math.max(width, o.measure(line));
    area.style.width = `${Math.ceil((width + o.size * 0.3) * o.zoom)}px`;
    area.style.height = `${Math.ceil(lines.length * o.size * LINE_HEIGHT * o.zoom)}px`;
  };
  // A press anywhere but on the text area ends the writing first, before the press starts a gesture on the drawing.
  const outside = (e: Event): void => {
    if (e.target !== area) finish();
  };
  const finish = (): void => {
    if (done) return;
    done = true;
    doc.removeEventListener(`pointerdown`, outside, true);
    const text = area.value;
    area.remove();
    o.onDone(text);
  };
  area.addEventListener(`input`, fit);
  area.addEventListener(`blur`, finish);
  area.addEventListener(`keydown`, (e) => {
    // The keys typed here are for the text, not for the shortcuts of the drawing.
    e.stopPropagation();
    if (e.key === `Escape` || (e.key === `Enter` && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      finish();
    }
  });
  doc.addEventListener(`pointerdown`, outside, true);
  doc.body.appendChild(area);
  fit();
  area.focus();
  area.select();
  return finish;
}
