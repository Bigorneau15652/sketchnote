// Rules for the picture files of the vault: which types are accepted, how a file is recognised from its first bytes (the name of a file is not trusted), and the limits. Pure module.
import { IMAGE_EXTENSIONS } from "./elements";

export type ImageType = `png` | `jpg` | `gif` | `webp` | `svg`;

// The biggest picture file that is imported or shown (in bytes), and the most pictures that the choice window lists.
export const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_MAX_LISTED = 5000;

// Returns the extension of a file name in lowercase, without the dot, or an empty text.
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(`.`);
  return dot < 0 ? `` : name.slice(dot + 1).toLowerCase();
}

// Tells whether a file name has the extension of a picture that can be shown.
export function isImageName(name: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

// Recognises the type of a picture from its first bytes: PNG, JPEG, GIF, WebP, or an SVG text (which must not hold a script). Returns null for anything else.
export function sniffImage(bytes: Uint8Array): ImageType | null {
  const at = (i: number): number => bytes[i] ?? -1;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return `png`;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return `jpg`;
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return `gif`;
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return `webp`;
  // An SVG is text: it holds an svg tag near its start and no script.
  const head = new TextDecoder(`utf-8`, { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 4096))).toLowerCase();
  if (head.includes(`<svg`) && !/<script|javascript:|\bon[a-z]+\s*=/.test(new TextDecoder(`utf-8`, { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 400000))).toLowerCase())) return `svg`;
  return null;
}

// Returns the extension that goes with a type of picture.
export function extensionFor(type: ImageType): string {
  return type;
}

// Returns a name for a picture that has none (a picture pasted from the clipboard): a date and time, without characters that a file name cannot hold.
export function pastedName(now: Date, type: ImageType): string {
  const p = (n: number): string => String(n).padStart(2, `0`);
  return `Image ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}.${extensionFor(type)}`;
}

// Returns a name that is not in the set of names already used (compared in lowercase): the name itself, then the name followed by 2, 3...
export function freeName(name: string, used: Set<string>): string {
  const lower = new Set([...used].map((n) => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(`.`);
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : ``;
  for (let n = 2; n < 100000; n++) if (!lower.has(`${stem} ${n}${ext}`.toLowerCase())) return `${stem} ${n}${ext}`;
  return `${stem} ${Date.now()}${ext}`;
}

// Tells whether a text matches a search: every word of the search is in the path, without caring for capitals or accents.
export function matchesName(path: string, query: string): boolean {
  const plain = (s: string): string => s.toLowerCase().normalize(`NFD`).replace(/[̀-ͯ]/g, ``);
  const hay = plain(path);
  return plain(query).split(/\s+/).filter((w) => w !== ``).every((w) => hay.includes(w));
}
