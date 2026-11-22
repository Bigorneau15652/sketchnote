// The values of the fields of the menu: a field shows a number with its unit, offers a list of usual values, and takes a number typed by hand. Pure module: no page, no application.

// Returns the usual values to offer for a range: all of them when there are few, otherwise about nine values spread over the range and each one on a step.
export function presetValues(min: number, max: number, step: number): number[] {
  if (!(max > min) || !(step > 0)) return [min];
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  if (count <= 12) return Array.from({ length: count }, (_, i) => round(min + i * step, step));
  const out = new Set<number>();
  for (let i = 0; i <= 8; i++) out.add(round(min + Math.round(((max - min) / step) * (i / 8)) * step, step));
  return [...out];
}

// Rounds a number to the precision of a step (so that 0.1 + 0.2 does not show as 0.30000000000000004).
function round(value: number, step: number): number {
  const decimals = step >= 1 && Number.isInteger(step) ? 0 : 4;
  const k = 10 ** decimals;
  return Math.round(value * k) / k;
}

// Reads what the user typed in a field: a number (a comma is a decimal point; a unit or spaces after it are ignored), kept inside the range and on the step. Returns null when the text is
// not a number.
export function parseFieldValue(text: string, min: number, max: number, step: number): number | null {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)/.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(`,`, `.`));
  if (!Number.isFinite(n)) return null;
  const snapped = min + Math.round((n - min) / step) * step;
  return round(Math.min(max, Math.max(min, snapped)), step);
}

// Writes a value for a field, with its unit.
export function showFieldValue(value: number, unit: string): string {
  return `${Number.isInteger(value) ? value : Math.round(value * 100) / 100}${unit}`;
}

// The usual values of the zoom, in percent.
export const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400];
