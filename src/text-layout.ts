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
  const box = layoutText(el.text, el.size, (line) => measure(line, el.font, el.size));
  return { ...el, width: box.width, height: box.height };
}

// Returns the vertical position of the middle of a line of a text, from the top of its box.
export function lineMiddle(index: number, size: number): number {
  return (index + 0.5) * size * LINE_HEIGHT;
}
