// Draws the editor overlay: selection frames, handles, the selection rectangle and the magnetism guide lines.
// Everything is drawn with the DOM into the group `ui` of the page and styled by CSS classes; none of it is part of the drawing.
import type { SketchElement } from "./elements";
import { blockBox, Box, boxCorners, boxOf, centerOf, hasRotateHandle, ROTATE_OFFSET, rotateHandlePos, rotatePoint, sidePoint, tailPagePoint, visibleCorners, visibleSides } from "./geometry";
import { isBubbleForm } from "./shape-forms";
import { svgEl } from "./svg";
import { visibleMidpoints } from "./linear";

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
  // Index of the point of a selected line or arrow that is active (to be removed with Delete), or null.
  activePoint?: number | null;
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

// Draws a small padlock next to a point (the top right corner of a locked element). It does not scale with the zoom.
function lockMark(ui: Element, at: [number, number], z: number): void {
  const g = svgEl(`g`, { class: `sketchnote-lock-mark`, transform: `translate(${at[0] + 3 / z} ${at[1] - 17 / z}) scale(${1 / z})` }, ui);
  svgEl(`path`, { class: `sketchnote-lock-shackle`, d: `M3 7 V4.5 a3.5 3.5 0 0 1 7 0 V7` }, g);
  svgEl(`rect`, { class: `sketchnote-lock-body`, x: 0, y: 6, width: 13, height: 10, rx: 2 }, g);
}

// Returns the top right corner of the frame of an element (turned with it).
function cornerOf(el: SketchElement): [number, number] {
  const { box, angle } = boxOf(el);
  return boxCorners(el.type === `line` || el.type === `arrow` ? padded(box, 3) : box, el.type === `line` || el.type === `arrow` ? 0 : angle)[1];
}

// Draws the overlay into the group. One selected element gets its frame, four corner handles and a rotation handle; several get one frame around all of them.
export function drawUi(ui: Element, st: UiState): void {
  clear(ui);
  const z = st.zoom;
  for (const x of st.guideX) svgEl(`line`, { class: `sketchnote-snap-guide`, x1: x, y1: 0, x2: x, y2: st.pageHeight }, ui);
  for (const y of st.guideY) svgEl(`line`, { class: `sketchnote-snap-guide`, x1: 0, y1: y, x2: st.pageWidth, y2: y }, ui);
  if (st.selected.length === 1 && st.selected[0].locked === true) {
    // A locked element has a frame and a padlock but no handle: nothing can be done to it until it is unlocked.
    const el = st.selected[0];
    const { box, angle } = boxOf(el);
    const linear = el.type === `line` || el.type === `arrow`;
    svgEl(`polygon`, { class: `sketchnote-sel-outline`, points: pointsText(boxCorners(linear ? padded(box, 3 / z) : box, linear ? 0 : angle)) }, ui);
    lockMark(ui, cornerOf(el), z);
  } else if (st.selected.length === 1) {
    const el = st.selected[0];
    if (el.type === `line` || el.type === `arrow`) {
      // A line has no frame: only its points (square handles) and the middle of its segments (small round handles) are shown.
      const r = 10 / z;
      const mids = visibleMidpoints(el.points, r);
      for (const m of mids) svgEl(`circle`, { class: `sketchnote-handle sketchnote-mid-handle`, cx: m.pos[0], cy: m.pos[1], r: 4 / z }, ui);
      const hs = 10 / z;
      el.points.forEach((pt, i) => {
        const active = st.activePoint === i ? ` sketchnote-handle-active` : ``;
        svgEl(`rect`, { class: `sketchnote-handle${active}`, x: pt[0] - hs / 2, y: pt[1] - hs / 2, width: hs, height: hs }, ui);
      });
      if (st.marquee) svgEl(`rect`, { class: `sketchnote-marquee`, x: st.marquee.x, y: st.marquee.y, width: st.marquee.w, height: st.marquee.h }, ui);
      return;
    }
    const { box, angle } = boxOf(el);
    const thin = false;
    const frame = thin ? boxCorners(padded(box, 5 / z), 0) : boxCorners(box, angle);
    svgEl(`polygon`, { class: `sketchnote-sel-outline`, points: pointsText(frame) }, ui);
    const corners = boxCorners(box, angle);
    if (hasRotateHandle(el)) {
      const top = rotatePoint([centerOf(box)[0], box.y], centerOf(box), angle);
      const rot = rotateHandlePos(box, angle, z);
      svgEl(`line`, { class: `sketchnote-sel-outline`, x1: top[0], y1: top[1], x2: rot[0], y2: rot[1] }, ui);
      svgEl(`circle`, { class: `sketchnote-handle sketchnote-rotate-handle`, cx: rot[0], cy: rot[1], r: 6 / z }, ui);
    }
    // The tip of the tail of a bubble: a round handle that points the tail at the speaker.
    if (el.type === `rect` && isBubbleForm(el.form)) {
      const tip = tailPagePoint(el);
      svgEl(`circle`, { class: `sketchnote-handle sketchnote-tail-handle`, cx: tip[0], cy: tip[1], r: 7 / z }, ui);
    }
    const s = 10 / z;
    for (const i of visibleCorners(el)) svgEl(`rect`, { class: `sketchnote-handle`, x: corners[i][0] - s / 2, y: corners[i][1] - s / 2, width: s, height: s }, ui);
    // The middle of the sides: small handles that stretch or squash the element.
    const h = 8 / z;
    for (const side of visibleSides(el)) {
      const at = sidePoint(box, angle, side);
      svgEl(`rect`, { class: `sketchnote-handle sketchnote-side-handle`, x: at[0] - h / 2, y: at[1] - h / 2, width: h, height: h, rx: h / 4 }, ui);
    }
  } else if (st.selected.length > 1) {
    for (const el of st.selected) {
      const { box, angle } = boxOf(el);
      svgEl(`polygon`, { class: `sketchnote-sel-outline sketchnote-sel-thin`, points: pointsText(boxCorners(padded(box, el.type === `line` || el.type === `arrow` ? 3 / z : 0), el.type === `line` || el.type === `arrow` ? 0 : angle)) }, ui);
    }
    for (const el of st.selected) if (el.locked === true) lockMark(ui, cornerOf(el), z);
    // The block handles only exist when every selected element is free.
    const b = st.selected.some((x) => x.locked === true) ? null : blockBox(st.selected, z);
    if (b) {
      // One frame around all the selected elements, with four corner handles and a rotation handle: they are moved, resized and turned as one block.
      svgEl(`rect`, { class: `sketchnote-sel-outline`, x: b.x, y: b.y, width: b.w, height: b.h }, ui);
      const rot = rotateHandlePos(b, 0, z);
      svgEl(`line`, { class: `sketchnote-sel-outline`, x1: b.x + b.w / 2, y1: b.y, x2: rot[0], y2: rot[1] }, ui);
      svgEl(`circle`, { class: `sketchnote-handle sketchnote-rotate-handle`, cx: rot[0], cy: rot[1], r: 6 / z }, ui);
      const hs = 10 / z;
      for (const [x, y] of boxCorners(b, 0)) svgEl(`rect`, { class: `sketchnote-handle`, x: x - hs / 2, y: y - hs / 2, width: hs, height: hs }, ui);
    }
  }
  if (st.marquee) svgEl(`rect`, { class: `sketchnote-marquee`, x: st.marquee.x, y: st.marquee.y, width: st.marquee.w, height: st.marquee.h }, ui);
}

// Distance in screen pixels of the rotation handle, exported for the tests and the CSS comments.
export const ROTATE_DISTANCE = ROTATE_OFFSET;
