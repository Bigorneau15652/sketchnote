// Reading of a zip archive, to find the font files (.ttf and .otf) that a font site gives. A file is stored as it is or compressed (deflate); the decompression is given
// by the caller (DecompressionStream in Obsidian). Same method as the font import of the plugin Bigorneau of the same author. No dependency on Obsidian.
export interface ZipEntry {
  // The name of the file without its folder.
  name: string;
  // The full path in the archive.
  path: string;
  data: Uint8Array;
}

// Decompression given by the caller. It must stop and throw as soon as the result would be longer than `limit` bytes, because the size declared in the header of an
// archive can lie.
export type Inflate = (data: Uint8Array, limit: number) => Promise<Uint8Array>;

// Limits of an archive of fonts: size of one file, size of all the files together, number of entries of the directory that are read.
export const ZIP_MAX_ENTRY = 50 * 1024 * 1024;
export const ZIP_MAX_TOTAL = 150 * 1024 * 1024;
export const ZIP_MAX_ENTRIES = 500;

const u16 = (b: Uint8Array, at: number): number => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number): number => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

const FONT_FILE = /\.(ttf|otf)$/i;

// Returns the font files of an archive. Hidden files (__MACOSX, ._name, .name) are ignored. A damaged archive gives an empty list. A file that goes over the limits is not
// extracted: its name is added to `refused` when that list is given.
export async function fontFilesOfZip(bytes: Uint8Array, inflate: Inflate, refused?: string[]): Promise<ZipEntry[]> {
  // End of the central directory: signature 0x06054b50, at most 65557 bytes before the end of the file.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return [];
  const count = Math.min(u16(bytes, end + 10), ZIP_MAX_ENTRIES);
  let at = u32(bytes, end + 16);
  const out: ZipEntry[] = [];
  let total = 0;
  const decoder = new TextDecoder();
  for (let n = 0; n < count && at + 46 <= bytes.length && u32(bytes, at) === 0x02014b50; n++) {
    const method = u16(bytes, at + 10);
    const compressed = u32(bytes, at + 20);
    const declared = u32(bytes, at + 24);
    const nameLength = u16(bytes, at + 28);
    const extraLength = u16(bytes, at + 30);
    const commentLength = u16(bytes, at + 32);
    const local = u32(bytes, at + 42);
    const path = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    const name = path.split(`/`).pop() ?? path;
    if (!FONT_FILE.test(name) || path.startsWith(`__MACOSX/`) || name.startsWith(`.`)) continue;
    if (compressed > ZIP_MAX_ENTRY || declared > ZIP_MAX_ENTRY || total + Math.min(declared, ZIP_MAX_ENTRY) > ZIP_MAX_TOTAL) {
      refused?.push(name);
      continue;
    }
    if (local + 30 > bytes.length || u32(bytes, local) !== 0x04034b50) continue;
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const raw = bytes.subarray(start, start + compressed);
    try {
      let data: Uint8Array | null = null;
      if (method === 0) data = raw.slice();
      else if (method === 8) data = await inflate(raw, ZIP_MAX_ENTRY);
      if (data && (data.length > ZIP_MAX_ENTRY || total + data.length > ZIP_MAX_TOTAL)) {
        refused?.push(name);
      } else if (data) {
        total += data.length;
        out.push({ name, path, data });
      }
    } catch {
      // A damaged file of the archive, or one bigger than the limit: it is ignored.
      refused?.push(name);
    }
  }
  return out;
}
