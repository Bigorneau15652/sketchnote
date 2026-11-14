// Pure magnetism: when a box is moved, it sticks to the edges and centres of other boxes within a small distance.
import type { Box } from "./geometry";

export interface SnapResult {
  // Correction to add to the movement.
  dx: number;
  dy: number;
  // Positions of the guide lines to show: x of vertical lines and y of horizontal lines.
  guideX: number[];
  guideY: number[];
}

// Returns the three useful positions of a box on one axis: start, middle and end.
function axis(start: number, size: number): number[] {
  return [start, start + size / 2, start + size];
}

// Finds the smallest correction that brings one of the positions of the moving box onto one of the target positions, within a threshold.
// Returns 0 when nothing is close enough.
function bestShift(mine: number[], candidates: number[], threshold: number): number {
  let best = 0;
  let bestDist = threshold + 1e-9;
  for (const m of mine) {
    for (const c of candidates) {
      const d = Math.abs(c - m);
      if (d < bestDist) {
        bestDist = d;
        best = c - m;
      }
    }
  }
  return bestDist <= threshold ? best : 0;
}

// Returns the correction that makes a moving box stick to the targets, and the guide lines that explain it. The threshold is in page units.
export function snapBox(box: Box, targets: Box[], threshold: number): SnapResult {
  const xs = targets.flatMap((t) => axis(t.x, t.w));
  const ys = targets.flatMap((t) => axis(t.y, t.h));
  const dx = bestShift(axis(box.x, box.w), xs, threshold);
  const dy = bestShift(axis(box.y, box.h), ys, threshold);
  const nx = axis(box.x + dx, box.w);
  const ny = axis(box.y + dy, box.h);
  const near = (list: number[], mine: number[]): number[] => [...new Set(list.filter((c) => mine.some((m) => Math.abs(c - m) < 0.01)))];
  return { dx, dy, guideX: near(xs, nx), guideY: near(ys, ny) };
}
