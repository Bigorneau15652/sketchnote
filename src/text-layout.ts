// The layout of a text: its lines and the size of its box. The width of a line comes from a function given by the caller (the browser measures it), so that this
// module does not need the page and can be tested.
import type { TextElement } from "./elements";

// Height of a line, as a multiple of the font size.
export const LINE_HEIGHT = 1.25;
// Smallest width of the box of a text, as a multiple of the font size (an empty line still has a box).
const MIN_WIDTH_EM = 0.5;

// Splits a text into its lines. A final line break gives a final empty line, which is kept.
export function textLines(text: string): string[] {
  return text.replace(/\r\n?/g, `\n`).split(`\n`);
}

// Returns the size of the box that holds a text at a font size.
export function layoutText(text: string, size: number, measure: (line: string) => number): { width: number; height: number } {
  const lines = textLines(text);
  let width = size * MIN_WIDTH_EM;
  for (const line of lines) width = Math.max(width, measure(line));
  return { width: Math.round(width * 100) / 100, height: Math.round(lines.length * size * LINE_HEIGHT * 100) / 100 };
}

// Returns a text with the size of its box measured again (after a change of its text, its font or its size). Its top left corner stays where it is.
export function refitText(el: TextElement, measure: (line: string, font: string, size: number) => number): TextElement {
  // A text zone keeps the size that the user gave it: only its lines wrap again.
  if (el.zone === true) return el;
  const box = layoutText(el.text, el.size, (line) => measure(line, el.font, el.size));
  return { ...el, width: box.width, height: box.height };
}

// Returns the vertical position of the middle of a line of a text, from the top of its box.
export function lineMiddle(index: number, size: number): number {
  return (index + 0.5) * size * LINE_HEIGHT;
}

// Cuts a text into lines no wider than a width: the lines of the text are kept, a line that is too long is cut at its spaces, and a word that is wider than the width on its own
// is cut between its letters. `measure` gives the width of a piece of text.
export function wrapLines(text: string, maxWidth: number, measure: (line: string) => number): string[] {
  const out: string[] = [];
  const room = Math.max(1, maxWidth);
  for (const paragraph of textLines(text)) {
    let line = ``;
    for (const word of paragraph.split(` `)) {
      const candidate = line === `` ? word : `${line} ${word}`;
      if (measure(candidate) <= room) {
        line = candidate;
        continue;
      }
      if (line !== ``) out.push(line);
      // The word starts a new line; when it is wider than the room it is cut between its letters.
      let piece = ``;
      for (const ch of Array.from(word)) {
        if (piece !== `` && measure(piece + ch) > room) {
          out.push(piece);
          piece = ch;
        } else piece += ch;
      }
      line = piece;
    }
    out.push(line);
  }
  return out;
}
