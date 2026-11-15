// Turns the SVG that a view drew into the files of an export: the SVG text with its fonts and pictures written into it (so that it shows alone, on any computer), a PNG and a PDF.
// Uses the page (an SVG element, a canvas), never the application. The SVG is built with the DOM and written with the serializer: no markup text is ever parsed.
import { EXPORT_MAX_PIXELS, fitSize, fontFaceCss, FontFaceData, pluginFamilies, toBase64 } from "./export-plan";
import type { Box } from "./geometry";
import { buildPdf } from "./pdf-writer";
import { svgEl } from "./svg";

export interface ExportSource {
  svg: SVGElement;
  // The part of the surface that is exported, in units of the drawing.
  box: Box;
}

export interface FinishedSvg {
  // The text of the SVG file.
  text: string;
  // The size in pixels of the picture that it makes at the scale.
  width: number;
  height: number;
  // True when the scale was lowered to keep the picture at a size that the browser can handle.
  reduced: boolean;
}

export interface EmbedServices {
  fontData(id: string): Promise<FontFaceData | null>;
  readImage(path: string): Promise<{ mime: string; bytes: Uint8Array } | null>;
}

// Writes the fonts and the pictures into the SVG, sets its size and returns its text. A picture that cannot be read is left out.
export async function finishSvg(source: ExportSource, scale: number, services: EmbedServices): Promise<FinishedSvg> {
  const { svg, box } = source;
  const size = fitSize(box.w, box.h, scale);
  svg.setAttribute(`viewBox`, `${box.x} ${box.y} ${box.w} ${box.h}`);
  svg.setAttribute(`width`, String(size.width));
  svg.setAttribute(`height`, String(size.height));
  svg.removeAttribute(`class`);
  // The fonts of the texts that are drawn: each one is written once, as data in a style sheet.
  const ids = new Set<string>();
  for (const el of Array.from(svg.querySelectorAll(`[font-family]`))) for (const family of pluginFamilies(el.getAttribute(`font-family`) ?? ``)) ids.add(family.slice(3));
  const fonts: FontFaceData[] = [];
  for (const id of ids) {
    const data = await services.fontData(id);
    if (data) fonts.push(data);
  }
  if (fonts.length > 0) {
    const defs = svgEl(`defs`, {});
    const style = svgEl(`style`, {}, defs);
    style.textContent = fontFaceCss(fonts);
    svg.insertBefore(defs, svg.firstChild);
  }
  // The pictures of the vault: their file is written into the SVG as data (the path stays out of the exported file).
  for (const img of Array.from(svg.querySelectorAll(`image[data-path]`))) {
    const path = img.getAttribute(`data-path`) ?? ``;
    img.removeAttribute(`data-path`);
    const file = await services.readImage(path);
    if (!file) {
      img.remove();
      continue;
    }
    const href = `data:${file.mime};base64,${toBase64(file.bytes)}`;
    img.setAttribute(`href`, href);
    img.setAttributeNS(`http://www.w3.org/1999/xlink`, `xlink:href`, href);
  }
  // The declaration of the file (its quotes are written with their code: the sources hold no straight quote).
  const q = String.fromCharCode(34);
  const text = `<?xml version=${q}1.0${q} encoding=${q}UTF-8${q}?>\n${new XMLSerializer().serializeToString(svg)}\n`;
  return { text, width: size.width, height: size.height, reduced: size.reduced };
}

// Returns the address that shows a text of SVG as a picture (no outside file is needed).
export function svgDataUrl(text: string): string {
  return `data:image/svg+xml;base64,${toBase64(new TextEncoder().encode(text))}`;
}

// Draws the SVG on a canvas of the given size (the SVG is shown as a picture: its fonts and pictures are the ones written into it).
export async function svgToCanvas(text: string, width: number, height: number): Promise<HTMLCanvasElement> {
  if (width * height > EXPORT_MAX_PIXELS * 1.01) throw new Error(`size`);
  const img = new Image();
  img.decoding = `sync`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`image`));
    img.src = svgDataUrl(text);
  });
  const canvas = document.createElement(`canvas`);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext(`2d`);
  if (!ctx) throw new Error(`canvas`);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

// Returns the bytes of the PNG file of a canvas.
export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/png`));
  if (!blob) throw new Error(`png`);
  return new Uint8Array(await blob.arrayBuffer());
}

// Compresses bytes in the zlib format, which a PDF reads (FlateDecode).
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.slice().buffer]).stream().pipeThrough(new CompressionStream(`deflate`));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Returns the bytes of a PDF of one page that shows the canvas. The transparent parts are made white (a PDF viewer shows them black otherwise). The page has the size of the picture
// at the usual screen resolution (a pixel of the drawing is 0.75 point), whatever the scale of the pixels.
export async function canvasToPdf(canvas: HTMLCanvasElement, scale: number, title: string): Promise<Uint8Array> {
  const ctx = canvas.getContext(`2d`);
  if (!ctx) throw new Error(`canvas`);
  const { width, height } = canvas;
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const a = rgba[i + 3] / 255;
    rgb[j] = Math.round(rgba[i] * a + 255 * (1 - a));
    rgb[j + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
    rgb[j + 2] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
  }
  const k = 0.75 / Math.max(scale, 0.01);
  return buildPdf(width, height, await deflate(rgb), width * k, height * k, title);
}
