// Measures the width of a line of text in a font at a size, with a canvas of the browser. The font must be registered under its CSS family (see font-store.ts).
import { cssFamily } from "./fonts";

let context: CanvasRenderingContext2D | null | undefined;

// Returns the width in pixels of a line of text. A line without a letter still has the width of a space.
export function measureLine(line: string, font: string, size: number): number {
  if (context === undefined) context = document.createElement(`canvas`).getContext(`2d`);
  if (!context) return line.length * size * 0.5;
  context.font = `${size}px ${cssFamily(font)}, cursive`;
  return context.measureText(line === `` ? ` ` : line).width;
}
