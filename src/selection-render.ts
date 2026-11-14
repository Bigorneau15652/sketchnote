// Draws the editor overlay: selection frames, handles, the selection rectangle and the magnetism guide lines.
// Everything is drawn with the DOM into the group `ui` of the page and styled by CSS classes; none of it is part of the drawing.
import type { SketchElement } from "./elements";
import { Box, boxCorners, boxOf, centerOf, elementBounds, ROTATE_OFFSET, rotateHandlePos, rotatePoint, unionBox } from "./geometry";
import type { Slot } from "./layout";
import { slotStyle } from "./page-background";
import { svgEl } from "./svg";

export interface UiState {
  selected: SketchElement[];
  zoom: number;
  pageWidth: number;
  pageHeight: number;
  // Rectangle being dragged to select, in page coordinates.
  marquee: Box | null;
  // Positions of the magnetism guide lines.
  guideX: number[];
  guideY: number[];
  // The dotted zones of a page structure, and which ones already hold a drawing (the others show a pencil that invites a double click).
  zones: { slots: Slot[]; occupied: boolean[]; background: string } | null;
}

// Empties a group.
function clear(group: Element): void {
  while (group.firstChild) group.removeChild(group.firstChild);
}

// Turns a list of points into the text of an SVG points attribute.
function pointsText(points: [number, number][]): string {
  return points.map((p) => `${p[0]},${p[1]}`).join(` `);
}

// Returns the box of an element made a little larger, so that a line without width or height still has a visible frame.
function padded(box: Box, pad: number): Box {
  return { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
}

// Path of the pencil pictogram, on a 24 by 24 grid.
const PENCIL = `M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z M15 5l4 4`;

// Draws the dotted zones of a structure, with a pencil in the empty ones. They help to place the drawings while editing and are never part of the page.
function drawZones(ui: Element, zones: NonNullable<UiState[`zones`]>): void {
  const style = slotStyle(zones.background);
  const look = { fill: style.color, "fill-opacity": style.fillOpacity, stroke: style.color, "stroke-opacity": style.strokeOpacity, "stroke-width": 1.5, "stroke-dasharray": `8 6` };
  zones.slots.forEach((s, i) => {
    if (s.shape === `ellipse`) svgEl(`ellipse`, { cx: s.x + s.width / 2, cy: s.y + s.height / 2, rx: s.width / 2, ry: s.height / 2, ...look }, ui);
    else svgEl(`rect`, { x: s.x, y: s.y, width: s.width, height: s.height, rx: 6, ...look }, ui);
    if (zones.occupied[i]) return;
    const size = Math.max(22, Math.min(48, Math.min(s.width, s.height) * 0.3));
    const k = size / 24;
    svgEl(
      `path`,
      {
        d: PENCIL,
        transform: `translate(${s.x + s.width / 2 - size / 2} ${s.y + s.height / 2 - size / 2}) scale(${k})`,
        fill: `none`,
        stroke: style.color,
        "stroke-opacity": Math.min(1, style.strokeOpacity + 0.15),
        "stroke-width": 1.6,
        "stroke-linecap": `round`,
        "stroke-linejoin": `round`,
      },
      ui,
    );
  });
}

// Draws the overlay into the group. One selected element gets its frame, four corner handles and a rotation handle; several get one frame around all of them.
export function drawUi(ui: Element, st: UiState): void {
  clear(ui);
  const z = st.zoom;
  if (st.zones) drawZones(ui, st.zones);
  for (const x of st.guideX) svgEl(`line`, { class: `sketchnote-snap-guide`, x1: x, y1: 0, x2: x, y2: st.pageHeight }, ui);
  for (const y of st.guideY) svgEl(`line`, { class: `sketchnote-snap-guide`, x1: 0, y1: y, x2: st.pageWidth, y2: y }, ui);
  if (st.selected.length === 1) {
    const el = st.selected[0];
    const { box, angle } = boxOf(el);
    const thin = el.type === `line` || el.type === `arrow`;
    const frame = thin ? boxCorners(padded(box, 5 / z), 0) : boxCorners(box, angle);
    svgEl(`polygon`, { class: `sketchnote-sel-outline`, points: pointsText(frame) }, ui);
    const corners = boxCorners(box, angle);
    const top = rotatePoint([centerOf(box)[0], box.y], centerOf(box), angle);
    const rot = rotateHandlePos(box, angle, z);
    svgEl(`line`, { class: `sketchnote-sel-outline`, x1: top[0], y1: top[1], x2: rot[0], y2: rot[1] }, ui);
    svgEl(`circle`, { class: `sketchnote-handle sketchnote-rotate-handle`, cx: rot[0], cy: rot[1], r: 6 / z }, ui);
    const s = 10 / z;
    for (const [x, y] of corners) svgEl(`rect`, { class: `sketchnote-handle`, x: x - s / 2, y: y - s / 2, width: s, height: s }, ui);
  } else if (st.selected.length > 1) {
    for (const el of st.selected) {
      const { box, angle } = boxOf(el);
      svgEl(`polygon`, { class: `sketchnote-sel-outline sketchnote-sel-thin`, points: pointsText(boxCorners(padded(box, el.type === `line` || el.type === `arrow` ? 3 / z : 0), el.type === `line` || el.type === `arrow` ? 0 : angle)) }, ui);
    }
    const all = unionBox(st.selected.map(elementBounds));
    if (all) {
      const b = padded(all, 6 / z);
      svgEl(`rect`, { class: `sketchnote-sel-outline`, x: b.x, y: b.y, width: b.w, height: b.h }, ui);
    }
  }
  if (st.marquee) svgEl(`rect`, { class: `sketchnote-marquee`, x: st.marquee.x, y: st.marquee.y, width: st.marquee.w, height: st.marquee.h }, ui);
}

// Distance in screen pixels of the rotation handle, exported for the tests and the CSS comments.
export const ROTATE_DISTANCE = ROTATE_OFFSET;
