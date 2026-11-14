// Pure rules of the zoom of the page: limits, steps, fitting the page in the window and pinch gestures.
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
const STEP_FACTOR = 1.25;

// Keeps a zoom inside its limits and rounds it to three decimals. A value that is not a number gives 1.
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 1000) / 1000;
}

// Returns the zoom that shows a whole page in a window, with a margin around it. A window of no size gives 1.
export function fitZoom(pageWidth: number, pageHeight: number, viewWidth: number, viewHeight: number, margin = 16): number {
  const w = viewWidth - 2 * margin;
  const h = viewHeight - 2 * margin;
  if (w <= 0 || h <= 0 || pageWidth <= 0 || pageHeight <= 0) return 1;
  return clampZoom(Math.min(w / pageWidth, h / pageHeight));
}

// Returns the zoom one step larger (direction 1) or smaller (direction -1).
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(direction === 1 ? zoom * STEP_FACTOR : zoom / STEP_FACTOR);
}

// Returns the zoom during a two finger gesture, from the zoom and the distance between fingers at the start and now.
export function pinchZoom(startZoom: number, startDistance: number, distance: number): number {
  if (startDistance <= 0 || distance <= 0) return clampZoom(startZoom);
  return clampZoom((startZoom * distance) / startDistance);
}
