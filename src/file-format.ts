// The .sketchnote file format: one JSON document that holds the page, its structure and all its elements.
// This file has no dependency on Obsidian, so it is tested without the application.
import { isSafeColor } from "./color";
import { ElementsResult, readElements, SketchElement } from "./elements";
import { t } from "./i18n";
import { LayoutSettings, readLayout } from "./layout";

export const FORMAT_NAME = `sketchnote`;
export const FORMAT_VERSION = 1;
// Largest file read, in characters. A bigger file is refused instead of freezing the application.
export const MAX_FILE_CHARS = 50 * 1024 * 1024;
export const MIN_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 20000;

export type Orientation = `portrait` | `landscape`;
export type Pattern = `blank` | `lines` | `grid` | `dots` | `craft` | `chalkboard`;
export const PATTERNS: Pattern[] = [`blank`, `lines`, `grid`, `dots`, `craft`, `chalkboard`];

export interface PageSettings {
  width: number;
  height: number;
  orientation: Orientation;
  background: string;
  pattern: Pattern;
  // Default colour of strokes and text on this page (white on a chalkboard).
  ink: string;
}

export interface SketchnoteDoc {
  format: typeof FORMAT_NAME;
  version: number;
  page: PageSettings;
  // Structure of the page (linear, radial...), or null when the page has none.
  layout: LayoutSettings | null;
  // Elements of the page, drawn in this order (the first one is at the back).
  elements: SketchElement[];
}

export type ParseResult = { ok: true; doc: SketchnoteDoc } | { ok: false; error: string };

// Returns a new document with an A4 portrait white page and no element.
export function createEmptyDoc(): SketchnoteDoc {
  return {
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    page: { width: 794, height: 1123, orientation: `portrait`, background: `#ffffff`, pattern: `blank`, ink: `#000000` },
    layout: null,
    elements: [],
  };
}

// Tells whether a value is a plain object (not null, not an array).
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === `object` && value !== null && !Array.isArray(value);
}

export { isSafeColor };

// Tells whether a value is a page dimension in the allowed range.
function isPageSize(value: unknown): value is number {
  return typeof value === `number` && Number.isFinite(value) && value >= MIN_PAGE_SIZE && value <= MAX_PAGE_SIZE;
}

// Returns the default ink colour of a background style: white on a chalkboard, black elsewhere.
export function defaultInk(pattern: Pattern): string {
  return pattern === `chalkboard` ? `#ffffff` : `#000000`;
}

// Validates the page block and returns it, or null when a field is missing or out of range. The ink is optional (files of version 0.1.0 have none).
function readPage(value: unknown): PageSettings | null {
  if (!isRecord(value)) return null;
  const { width, height, orientation, background, pattern } = value;
  if (!isPageSize(width) || !isPageSize(height)) return null;
  if (orientation !== `portrait` && orientation !== `landscape`) return null;
  if (!isSafeColor(background)) return null;
  if (typeof pattern !== `string` || !PATTERNS.includes(pattern as Pattern)) return null;
  const style = pattern as Pattern;
  if (value.ink !== undefined && !isSafeColor(value.ink)) return null;
  const ink = value.ink === undefined ? defaultInk(style) : (value.ink as string);
  return { width, height, orientation, background, pattern: style, ink };
}

// Reads the text of a .sketchnote file. Every field is checked and copied, so nothing unchecked from the file reaches the rest of the plugin.
export function parseSketchnote(text: string): ParseResult {
  if (text.length > MAX_FILE_CHARS) return { ok: false, error: t(`Le fichier est trop volumineux.`) };
  if (text.trim() === ``) return { ok: false, error: t(`Le fichier est vide ou n'est pas du JSON valide.`) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t(`Le fichier est vide ou n'est pas du JSON valide.`) };
  }
  if (!isRecord(raw) || raw.format !== FORMAT_NAME) return { ok: false, error: t(`Le fichier n'est pas un sketchnote.`) };
  if (raw.version !== FORMAT_VERSION) return { ok: false, error: t(`Version de fichier non prise en charge : {0}.`, String(raw.version)) };
  const page = readPage(raw.page);
  if (page === null) return { ok: false, error: t(`La page du sketchnote est invalide.`) };
  const layout = raw.layout === undefined || raw.layout === null ? null : readLayout(raw.layout);
  if (layout === undefined) return { ok: false, error: t(`La structure du sketchnote est invalide.`) };
  const elements: ElementsResult = readElements(raw.elements);
  if (!elements.ok) {
    return { ok: false, error: `tooMany` in elements ? t(`Trop d'éléments sur la page.`) : t(`Élément {0} invalide.`, elements.index) };
  }
  return { ok: true, doc: { format: FORMAT_NAME, version: FORMAT_VERSION, page, layout, elements: elements.elements } };
}

// Writes a document as the text of a .sketchnote file.
export function serializeSketchnote(doc: SketchnoteDoc): string {
  return JSON.stringify(doc, null, 2) + `\n`;
}
