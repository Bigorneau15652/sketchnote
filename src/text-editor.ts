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
  zone?: { width: number; height: number; centered: boolean; lineCount: (text: string) => number; autoHeight?: boolean };
  // The text of a line: the text area grows around the point (left and top) instead of from it, and it has a background of that colour, since the line is cut under the text.
  around?: { background: string };
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
  // The text written inside a shape has no frame at all, only the cursor; a text zone has its dotted frame.
  if (o.zone?.centered) area.classList.add(`is-label`);
  area.style.left = `${o.left}px`;
  area.style.top = `${o.top}px`;
  if (o.around) {
    area.classList.add(`is-around`);
    area.style.transform = `translate(-50%, -50%)`;
    area.style.setProperty(`background`, o.around.background, `important`);
    area.style.setProperty(`padding`, `${6 * o.zoom}px`, `important`);
  }
  area.style.fontFamily = o.font;
  area.style.fontSize = `${o.size * o.zoom}px`;
  area.style.lineHeight = `${LINE_HEIGHT}`;
  area.style.color = o.color;
  area.style.textAlign = o.align;
  let done = false;
  // Fits the text area to its text: the widest line and one row for each line.
  const fit = (): void => {
    if (o.zone) {
      const rows = Math.max(1, o.zone.lineCount(area.value));
      // A text zone has the height of its lines: the dotted frame grows when the text wraps to one more line.
      const height = o.zone.autoHeight ? rows * o.size * LINE_HEIGHT : o.zone.height;
      area.style.width = `${Math.ceil(o.zone.width * o.zoom)}px`;
      area.style.height = `${Math.ceil(height * o.zoom)}px`;
      const free = height - rows * o.size * LINE_HEIGHT;
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
  if (o.initial !== ``) area.select();
  return finish;
}
