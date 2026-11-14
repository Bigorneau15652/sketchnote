// Colour checks shared by every module that reads a colour from a file. Only #hex colours are accepted, so a colour can never carry code.

// Tells whether a value is a CSS colour written as #rgb, #rrggbb or #rrggbbaa.
export function isSafeColor(value: unknown): value is string {
  return typeof value === `string` && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}
