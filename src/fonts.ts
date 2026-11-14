// The fonts of the texts: names, CSS families and the identifiers kept in the files. No dependency on Obsidian: tested without the application.
// A font is known by an identifier (lowercase letters, digits, hyphens): the four built-in fonts have a fixed one, an imported font gets `u-` and its family name.
export const DEFAULT_FONT = `caveat`;

export interface FontEntry {
  id: string;
  name: string;
  // True for the fonts shipped with the plugin, false for the fonts imported by the user.
  builtin: boolean;
}

// Returns the CSS family name that the plugin registers for a font. It is a plain identifier, so it needs no quotes in a CSS value.
export function cssFamily(id: string): string {
  return `sk-${id}`;
}

// Returns the value of a font-family property for a font, with a generic handwriting fallback for the time the font loads or when it is gone.
export function fontStack(id: string): string {
  return `${cssFamily(id)}, cursive`;
}

// Turns the family name of a font file into an identifier: accents removed, lowercase, anything but letters and digits replaced by a hyphen, prefixed with `u-`.
export function userFontId(familyName: string): string {
  const slug = familyName
    .normalize(`NFD`)
    .replace(/[̀-ͯ]/g, ``)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, `-`)
    .replace(/^-+|-+$/g, ``)
    .slice(0, 50);
  return `u-${slug === `` ? `police` : slug}`;
}

// Tells whether a font identifier is in a list of fonts.
export function hasFont(fonts: FontEntry[], id: string): boolean {
  return fonts.some((f) => f.id === id);
}
