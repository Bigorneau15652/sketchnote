// The mouse cursor of the pen: a ring as large as the stroke when the stroke is large enough to be seen, and a small target when it is small, made of four short lines (above,
// below, left and right) that do not touch, so that the stroke starts in the small empty space where they would meet. Every line has a white edge under its dark line, so that it
// can be seen on any background. Pure module: it only builds the value of the CSS property cursor, from constants of this file and from a number.

// The most that a browser accepts for the side of the image of a cursor is 128 pixels.
const MAX_RING = 118;
// The stroke is shown as a ring from this diameter (in pixels of the screen), and as a target below it.
const RING_FROM = 14;
const TARGET = 33;

const Q = String.fromCharCode(34);

const r1 = (n: number): number => Math.round(n * 10) / 10;

// Writes one SVG element from its name and its attributes (a helper, so that this file holds no quote character).
function tag(name: string, attrs: Record<string, string | number>): string {
  return `<${name} ${Object.entries(attrs).map(([k, v]) => `${k}=${Q}${v}${Q}`).join(` `)}/>`;
}

// A line drawn twice: a wide white one, then a thin dark one over it.
function marked(shape: (width: number, colour: string) => string): string {
  return shape(3.6, `#ffffff`) + shape(1.4, `#111111`);
}

// Returns the picture of the cursor for a stroke of a diameter in pixels of the screen, with the point of the cursor (its hot spot) at the middle of it.
export function penCursorImage(diameter: number): { svg: string; size: number; centre: number; ring: boolean } {
  const d = Number.isFinite(diameter) ? Math.max(0, diameter) : 0;
  if (d >= RING_FROM) {
    const ring = Math.min(MAX_RING, d);
    const size = Math.ceil(ring) + 8;
    const centre = size / 2;
    const body = marked((w, colour) => tag(`circle`, { cx: centre, cy: centre, r: r1(ring / 2), fill: `none`, stroke: colour, "stroke-width": w }));
    return { svg: `<svg xmlns=${Q}http://www.w3.org/2000/svg${Q} width=${Q}${size}${Q} height=${Q}${size}${Q} viewBox=${Q}0 0 ${size} ${size}${Q}>${body}</svg>`, size, centre, ring: true };
  }
  // The empty space in the middle is as wide as the stroke, and at least 6 pixels wide, so that the stroke is drawn inside it.
  const gap = Math.max(3, d / 2 + 2);
  const length = 6;
  const c = TARGET / 2;
  const ticks = [
    [c - gap - length, c, c - gap, c],
    [c + gap, c, c + gap + length, c],
    [c, c - gap - length, c, c - gap],
    [c, c + gap, c, c + gap + length],
  ];
  const body = marked((w, colour) => ticks.map(([x1, y1, x2, y2]) => tag(`line`, { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: colour, "stroke-width": w, "stroke-linecap": `butt` })).join(``));
  return { svg: `<svg xmlns=${Q}http://www.w3.org/2000/svg${Q} width=${Q}${TARGET}${Q} height=${Q}${TARGET}${Q} viewBox=${Q}0 0 ${TARGET} ${TARGET}${Q}>${body}</svg>`, size: TARGET, centre: c, ring: false };
}

// Returns the value of the CSS property cursor for a stroke of a diameter in pixels of the screen. The picture is written in the value itself (a data address), so that no file
// and no network are involved; the cross is the cursor that shows when the picture cannot be used.
export function penCursor(diameter: number): string {
  const image = penCursorImage(diameter);
  return `url(${Q}data:image/svg+xml,${encodeURIComponent(image.svg)}${Q}) ${r1(image.centre)} ${r1(image.centre)}, crosshair`;
}

// Returns the value of the CSS property cursor for the eraser: a ring as large as its tip (a square for a square tip) when the tip is large enough to be seen, and the small target
// of the pen otherwise. The diameter is in pixels of the screen.
export function eraserCursor(diameter: number, square: boolean): string {
  const d = Number.isFinite(diameter) ? Math.max(0, diameter) : 0;
  if (!square || d < RING_FROM) return penCursor(d);
  const side = Math.min(MAX_RING, d);
  const size = Math.ceil(side) + 8;
  const c = size / 2;
  const body = marked((w, colour) => tag(`rect`, { x: r1(c - side / 2), y: r1(c - side / 2), width: r1(side), height: r1(side), fill: `none`, stroke: colour, "stroke-width": w }));
  const svg = `<svg xmlns=${Q}http://www.w3.org/2000/svg${Q} width=${Q}${size}${Q} height=${Q}${size}${Q} viewBox=${Q}0 0 ${size} ${size}${Q}>${body}</svg>`;
  return `url(${Q}data:image/svg+xml,${encodeURIComponent(svg)}${Q}) ${r1(c)} ${r1(c)}, crosshair`;
}
