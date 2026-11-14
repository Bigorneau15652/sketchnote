// Colour checks shared by every module that reads a colour from a file. Only #hex colours are accepted, so a colour can never carry code.

// Tells whether a value is a CSS colour written as #rgb, #rrggbb or #rrggbbaa.
export function isSafeColor(value: unknown): value is string {
  return typeof value === `string` && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export const MIN_PALETTE = 3;
export const MAX_PALETTE = 5;

// Tells whether a value is a palette: 3 to 5 safe colours.
export function isPalette(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= MIN_PALETTE && value.length <= MAX_PALETTE && value.every(isSafeColor);
}

// Returns the default palette for an ink colour: light colours on a dark page (white ink), usual colours otherwise.
export function defaultPaletteFor(ink: string): string[] {
  const dark = ink.toLowerCase() === `#ffffff` || ink.toLowerCase() === `#fff`;
  return dark ? [`#ffffff`, `#f6ad55`, `#63b3ed`, `#68d391`, `#fc8181`] : [`#000000`, `#c0392b`, `#2b6cb0`, `#2f855a`, `#d69e2e`];
}
