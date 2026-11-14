// Colour maths of the colour window: #hex colours, hue, saturation and luminance (HSL), and the position of a colour on the colour wheel. No dependency on Obsidian:
// tested without the application.
export type Rgb = [number, number, number];
export interface Hsl {
  // Hue in degrees, 0 to 359.
  h: number;
  // Saturation in percent, 0 to 100.
  s: number;
  // Luminance in percent, 0 (black) to 100 (white); 50 gives the pure colour.
  l: number;
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

// Reads a hexadecimal colour typed or stored by the plugin (#rgb, #rrggbb or #rrggbbaa, with or without the #, in any case) as red, green and blue from 0 to 255.
// Anything else gives null.
export function hexToRgb(text: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(text.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split(``).map((c) => c + c).join(``);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Writes red, green and blue as #rrggbb in lowercase.
export function rgbToHex(rgb: Rgb): string {
  return `#` + rgb.map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, `0`)).join(``);
}

// Returns the colour written #rrggbb for a text typed by the user, or null when it is not a colour.
export function normalizeHex(text: string): string | null {
  const rgb = hexToRgb(text);
  return rgb ? rgbToHex(rgb) : null;
}

// Turns red, green and blue (0 to 255) into hue, saturation and luminance.
export function rgbToHsl(rgb: Rgb): Hsl {
  const [r, g, b] = rgb.map((n) => clamp(n, 0, 255) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h: h % 360, s: s * 100, l: l * 100 };
}

// Turns hue, saturation and luminance into red, green and blue (0 to 255, not rounded).
export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60);
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector % 6];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export const hslToHex = (hsl: Hsl): string => rgbToHex(hslToRgb(hsl));

// Reads a colour as hue, saturation and luminance. A text that is not a colour gives black.
export function hexToHsl(text: string): Hsl {
  return rgbToHsl(hexToRgb(text) ?? [0, 0, 0]);
}

// Returns the hue and the saturation that match a point of the colour wheel, from its offset (dx to the right, dy downwards) from the centre and the radius of the wheel.
// The hue is the angle counter-clockwise from the right, the saturation is the distance from the centre (0 at the centre, 100 at the edge and beyond).
export function wheelToHs(dx: number, dy: number, radius: number): { h: number; s: number } {
  const angle = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const h = (angle + 360) % 360;
  const s = radius <= 0 ? 0 : clamp((Math.hypot(dx, dy) / radius) * 100, 0, 100);
  return { h, s };
}

// Returns the offset (to the right and downwards) from the centre of the wheel of the point that shows a hue and a saturation. The opposite of wheelToHs.
export function hsToWheel(h: number, s: number, radius: number): [number, number] {
  const a = (h * Math.PI) / 180;
  const d = (clamp(s, 0, 100) / 100) * radius;
  return [d * Math.cos(a), -d * Math.sin(a)];
}

// The luminance slider goes from -100 to 100 with 0 in the middle (the pure colour), like the sliders of photo editors; the luminance is 0 to 100 with 50 in the middle.
export const sliderToLuminance = (v: number): number => clamp(50 + v / 2, 0, 100);
export const luminanceToSlider = (l: number): number => Math.round(clamp((l - 50) * 2, -100, 100));

// Returns the luminance to use when the user chooses a hue or a saturation: a colour at the very bottom (black) or the very top (white) of the luminance shows neither a hue nor
// a saturation, so the luminance goes back to the middle, where the colours are pure. Any other luminance is kept.
export function usableLuminance(l: number): number {
  return l < 4 || l > 96 ? 50 : l;
}
