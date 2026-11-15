// The other drawings of a page shown behind the drawing that is being edited, to see how they sit around it. The guide of the drawing is the zone it was opened from, so the frame of that zone
// on the page and the guide give the way to carry a place of the page into the drawing. Pure module.
import type { Box } from "./geometry";

// The settings of the display of a drawing: whether the other drawings of the page are shown, and how much they are faded (0 is not at all, up to the most).
export interface BackdropSettings {
  others: boolean;
  fade: number;
}

export const BACKDROP_MAX_FADE = 90;
export const DEFAULT_BACKDROP: BackdropSettings = { others: false, fade: 60 };

// Returns the settings with the fade in its range (a wrong value gives the usual one).
export function cleanBackdrop(value: Partial<BackdropSettings>): BackdropSettings {
  const fade = typeof value.fade === `number` && Number.isFinite(value.fade) ? Math.min(BACKDROP_MAX_FADE, Math.max(0, Math.round(value.fade))) : DEFAULT_BACKDROP.fade;
  return { others: value.others === true, fade };
}

// Returns the opacity of the other drawings for a fade: no fade is fully visible.
export function backdropOpacity(fade: number): number {
  return Math.round((1 - Math.min(BACKDROP_MAX_FADE, Math.max(0, fade)) / 100) * 100) / 100;
}

// Returns the transform that carries the page into the drawing: the frame of the zone of the drawing (in page units) goes onto the guide of the drawing (in drawing units), with the same
// proportions. Null when either box has no size.
export function pageToDrawing(frame: Box, guide: Box): string | null {
  if (!(frame.w > 0) || !(guide.w > 0) || !Number.isFinite(frame.w + guide.w + frame.x + frame.y + guide.x + guide.y)) return null;
  const k = Math.round((guide.w / frame.w) * 1e6) / 1e6;
  return `translate(${Math.round(guide.x * 100) / 100} ${Math.round(guide.y * 100) / 100}) scale(${k}) translate(${-frame.x} ${-frame.y})`;
}
