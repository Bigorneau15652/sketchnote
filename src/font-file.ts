// Reading of the names of a font file (.ttf or .otf): its family and its style, to list it and to choose its face. No dependency on Obsidian: tested without the application.
export type FontKind = `font` | `collection` | `woff` | `unknown`;

export interface FontNames {
  family: string;
  // The style: Regular, Bold, Italic...
  style: string;
}

const u16 = (b: Uint8Array, at: number): number => (b[at] << 8) | b[at + 1];
const u32 = (b: Uint8Array, at: number): number => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const tag = (b: Uint8Array, at: number): string => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

// Tells what a file is from its first four bytes, whatever its extension: a font that the browser can load, a collection or a WOFF (not accepted) or something else.
export function fontKind(bytes: Uint8Array): FontKind {
  if (bytes.length < 12) return `unknown`;
  const head = tag(bytes, 0);
  if (head === `ttcf`) return `collection`;
  if (head === `wOFF` || head === `wOF2`) return `woff`;
  if (u32(bytes, 0) === 0x00010000 || head === `OTTO` || head === `true`) return `font`;
  return `unknown`;
}

// Decodes a string of the name table: UTF-16 big endian for the Windows and Unicode platforms, one byte per character for the others.
function decodeName(bytes: Uint8Array, platform: number): string {
  if (platform === 0 || platform === 3) {
    let out = ``;
    for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode(u16(bytes, i));
    return out;
  }
  return Array.from(bytes, (b) => String.fromCharCode(b)).join(``);
}

// Returns the family and the style of a font, or null when the file is not a readable font. Reads only the `name` table and checks every offset against the file.
export function readFontNames(bytes: Uint8Array): FontNames | null {
  if (fontKind(bytes) !== `font`) return null;
  const tables = u16(bytes, 4);
  let nameAt = -1;
  for (let i = 0; i < tables && 12 + i * 16 + 16 <= bytes.length; i++) {
    if (tag(bytes, 12 + i * 16) === `name`) nameAt = u32(bytes, 12 + i * 16 + 8);
  }
  if (nameAt < 0 || nameAt + 6 > bytes.length) return null;
  const count = u16(bytes, nameAt + 2);
  const strings = nameAt + u16(bytes, nameAt + 4);
  const found = new Map<number, string>();
  for (let i = 0; i < count && nameAt + 6 + i * 12 + 12 <= bytes.length; i++) {
    const rec = nameAt + 6 + i * 12;
    const platform = u16(bytes, rec);
    const id = u16(bytes, rec + 6);
    const length = u16(bytes, rec + 8);
    const start = strings + u16(bytes, rec + 10);
    if (![1, 2, 16, 17].includes(id) || start + length > bytes.length) continue;
    const text = decodeName(bytes.subarray(start, start + length), platform).trim();
    // The Windows names win over the others.
    if (text !== `` && (!found.has(id) || platform === 3)) found.set(id, text);
  }
  const family = found.get(16) ?? found.get(1);
  if (!family) return null;
  return { family: family.slice(0, 80), style: (found.get(17) ?? found.get(2) ?? `Regular`).slice(0, 40) };
}

// Tells whether a style is the plain one (Regular, Normal, Roman, Book), the one that a text uses when a family has several files.
export function isPlainStyle(style: string): boolean {
  return /^(regular|normal|roman|book|medium)$/i.test(style.trim());
}
