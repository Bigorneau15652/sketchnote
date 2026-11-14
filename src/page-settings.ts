// Pure rules for the settings of a page: formats, orientation, size limits and background styles.
// Every function returns a new page and never changes its argument, so the view can compare and undo changes later.
import { isSafeColor, MAX_PAGE_SIZE, MIN_PAGE_SIZE, Orientation, PageSettings, Pattern } from "./file-format";

export type PresetId = `a5` | `a4` | `a3` | `wide` | `square` | `custom`;
export const PRESET_IDS: PresetId[] = [`a5`, `a4`, `a3`, `wide`, `square`, `custom`];

// Size in pixels (96 per inch) of each format, in portrait orientation.
const PORTRAIT_SIZES: Record<Exclude<PresetId, `custom`>, [number, number]> = {
  a5: [559, 794],
  a4: [794, 1123],
  a3: [1123, 1587],
  wide: [720, 1280],
  square: [1000, 1000],
};

// Default colours of each background style.
export const STYLE_DEFAULTS: Record<Pattern, { background: string; ink: string }> = {
  blank: { background: `#ffffff`, ink: `#000000` },
  lines: { background: `#ffffff`, ink: `#000000` },
  grid: { background: `#ffffff`, ink: `#000000` },
  dots: { background: `#ffffff`, ink: `#000000` },
  craft: { background: `#c8a678`, ink: `#000000` },
  chalkboard: { background: `#2f3b36`, ink: `#ffffff` },
};

// Returns the orientation that matches a width and a height. A square keeps the given fallback.
export function orientationOf(width: number, height: number, fallback: Orientation): Orientation {
  if (width === height) return fallback;
  return width > height ? `landscape` : `portrait`;
}

// Returns a page dimension rounded to a whole number and kept inside the allowed range.
export function clampSize(value: number): number {
  if (!Number.isFinite(value)) return MIN_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.round(value)));
}

// Returns the width and height of a format in an orientation. The custom format has no fixed size: it returns null.
export function presetSize(id: PresetId, orientation: Orientation): [number, number] | null {
  if (id === `custom`) return null;
  const [w, h] = PORTRAIT_SIZES[id];
  return orientation === `landscape` && w !== h ? [h, w] : [w, h];
}

// Finds the format that matches the size of a page, in either orientation. A size that matches none is custom.
export function detectPreset(page: PageSettings): PresetId {
  for (const id of PRESET_IDS) {
    if (id === `custom`) continue;
    const [w, h] = PORTRAIT_SIZES[id];
    if ((page.width === w && page.height === h) || (page.width === h && page.height === w)) return id;
  }
  return `custom`;
}

// Applies a format, keeping the current orientation. Choosing custom changes nothing.
export function changePreset(page: PageSettings, id: PresetId): PageSettings {
  const size = presetSize(id, page.orientation);
  return size === null ? page : { ...page, width: size[0], height: size[1] };
}

// Changes the orientation and swaps width and height when needed.
export function changeOrientation(page: PageSettings, orientation: Orientation): PageSettings {
  const current = orientationOf(page.width, page.height, orientation);
  if (current === orientation) return { ...page, orientation };
  return { ...page, orientation, width: page.height, height: page.width };
}

// Sets a free size. The orientation follows the new size.
export function changeSize(page: PageSettings, width: number, height: number): PageSettings {
  const w = clampSize(width);
  const h = clampSize(height);
  return { ...page, width: w, height: h, orientation: orientationOf(w, h, page.orientation) };
}

// Tells whether a background style carries its own colours (craft paper and chalkboard).
function hasOwnColors(pattern: Pattern): boolean {
  return pattern === `craft` || pattern === `chalkboard`;
}

// Changes the background style. Craft paper and chalkboard bring their own colours and ink (white on the chalkboard); going back to a
// plain style restores white paper and black ink. Switching between plain styles keeps the colours chosen by the user.
export function changeStyle(page: PageSettings, pattern: Pattern): PageSettings {
  if (pattern === page.pattern) return page;
  if (hasOwnColors(pattern) || hasOwnColors(page.pattern)) {
    const d = STYLE_DEFAULTS[pattern];
    return { ...page, pattern, background: d.background, ink: d.ink };
  }
  return { ...page, pattern };
}

// Changes the background colour. A value that is not a #hex colour is ignored.
export function changeBackground(page: PageSettings, color: string): PageSettings {
  return isSafeColor(color) ? { ...page, background: color } : page;
}

// Changes the default ink colour. A value that is not a #hex colour is ignored.
export function changeInk(page: PageSettings, color: string): PageSettings {
  return isSafeColor(color) ? { ...page, ink: color } : page;
}
