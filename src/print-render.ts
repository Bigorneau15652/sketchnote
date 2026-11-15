// Prints an SVG with the print dialog of the system: a hidden frame is filled with one block for each sheet (made with the DOM, never from a text of markup), the page rules give it the
// paper and its margin, and the frame is printed. The picture is shown from its data (fonts and pictures are written into it), so that nothing is loaded from outside.
import { PRINT_MARGIN_MM, PrintPlan, Paper } from "./print-plan";
import { svgDataUrl } from "./export-render";

// How long the frame stays in the page after the print was asked (the dialog of some systems answers late), in milliseconds.
const KEEP_MS = 90_000;

// Prints the picture of an SVG on the sheets of a plan. Throws when the frame or the print is not available.
export async function printSvg(svgText: string, plan: PrintPlan, paper: Paper): Promise<void> {
  for (const old of Array.from(document.querySelectorAll(`iframe.sketchnote-print-frame`))) old.remove();
  const frame = document.createElement(`iframe`);
  frame.className = `sketchnote-print-frame`;
  frame.setAttribute(`aria-hidden`, `true`);
  frame.setAttribute(`tabindex`, `-1`);
  // The frame is outside of the screen but has the size of the paper (a hidden frame would be printed blank).
  frame.style.cssText = `position:fixed;left:-10000px;top:0;border:0;width:${plan.paperMm[0]}mm;height:${plan.paperMm[1]}mm;`;
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) {
    frame.remove();
    throw new Error(`frame`);
  }
  doc.title = `Sketchnote`;
  const style = doc.createElement(`style`);
  style.textContent = `@page{size:${paper.toUpperCase()} ${plan.orientation};margin:${PRINT_MARGIN_MM}mm}html,body{margin:0;padding:0;background:#ffffff}.sheet{position:relative;width:${plan.innerW}px;height:${plan.innerH}px;overflow:hidden;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}.sheet img{position:absolute;display:block;max-width:none;max-height:none}`;
  doc.head.appendChild(style);
  const url = svgDataUrl(svgText);
  const images: HTMLImageElement[] = [];
  for (const sheet of plan.sheets) {
    const block = doc.createElement(`div`);
    block.className = `sheet`;
    const img = doc.createElement(`img`);
    img.alt = ``;
    img.style.width = `${plan.imageW}px`;
    img.style.height = `${plan.imageH}px`;
    img.style.left = `${plan.offsetX - sheet.col * plan.innerW}px`;
    img.style.top = `${plan.offsetY - sheet.row * plan.innerH}px`;
    img.src = url;
    block.appendChild(img);
    doc.body.appendChild(block);
    images.push(img);
  }
  // The pictures must be ready before the dialog opens.
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
  window.setTimeout(() => frame.remove(), KEEP_MS);
  win.focus();
  win.print();
}
