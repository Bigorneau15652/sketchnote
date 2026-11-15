// The shapes of the Point tool: a click puts a small shape (a disc, a cross, a star, a note of music, a sun...) instead of only a dot. A shape is drawn on a grid of 100 by 100: it is
// put on the page as an icon element that keeps its own shapes, so it can be moved, resized, turned, coloured and mirrored like any other icon. Pure module.
import type { IconElement, IconShapeData, Point } from "./elements";
import { t } from "./i18n";

export const STAMP_IDS = [
  `disc`,
  `circle`,
  `cross`,
  `plus`,
  `star`,
  `star4`,
  `diamond`,
  `square`,
  `triangle`,
  `heart`,
  `sharp`,
  `flat`,
  `note`,
  `check`,
  `bolt`,
  `arrow`,
  `chevron`,
  `sun`,
  `cloud`,
  `drop`,
  `moon`,
  `shooting`,
] as const;
export type StampId = (typeof STAMP_IDS)[number];

export function isStampId(value: unknown): value is StampId {
  return typeof value === `string` && (STAMP_IDS as readonly string[]).includes(value);
}

export const MIN_STAMP_SIZE = 6;
export const MAX_STAMP_SIZE = 150;
export const DEFAULT_STAMP_SIZE = 20;

export function cleanStampSize(size: number): number {
  return Math.round(Math.min(MAX_STAMP_SIZE, Math.max(MIN_STAMP_SIZE, size)));
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

// The data of a closed path through points.
function polygon(points: Point[]): string {
  return `${points.map((p, i) => `${i === 0 ? `M` : `L`}${r1(p[0])},${r1(p[1])}`).join(` `)} Z`;
}

// The points of a star with a number of branches, the first one pointing up.
function starPoints(cx: number, cy: number, outer: number, inner: number, branches: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < branches * 2; i++) {
    const a = (i / (branches * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// The data of a circle as two arcs.
function circle(cx: number, cy: number, r: number): string {
  return `M${cx + r},${cy} A${r},${r} 0 1 1 ${cx - r},${cy} A${r},${r} 0 1 1 ${cx + r},${cy} Z`;
}

const solid = (d: string): IconShapeData => ({ d, fill: true, stroke: false, closed: true });
const outline = (d: string, closed = false): IconShapeData => ({ d, fill: false, stroke: true, closed });

// The shapes of each stamp: the filled ones take the colour of the line, the others are drawn with the line.
const SHAPES: Record<StampId, IconShapeData[]> = {
  disc: [solid(circle(50, 50, 42))],
  circle: [outline(circle(50, 50, 38), true)],
  cross: [outline(`M22,22 L78,78 M78,22 L22,78`)],
  plus: [outline(`M50,14 L50,86 M14,50 L86,50`)],
  star: [solid(polygon(starPoints(50, 54, 46, 19, 5)))],
  star4: [solid(polygon(starPoints(50, 50, 46, 14, 4)))],
  diamond: [solid(`M50,8 L90,50 L50,92 L10,50 Z`)],
  square: [solid(`M12,12 L88,12 L88,88 L12,88 Z`)],
  triangle: [solid(`M50,10 L92,88 L8,88 Z`)],
  heart: [solid(`M50,90 C8,60 6,30 28,18 C40,12 50,20 50,32 C50,20 60,12 72,18 C94,30 92,60 50,90 Z`)],
  sharp: [outline(`M38,10 L34,90 M66,10 L62,90 M16,36 L88,28 M12,72 L84,64`)],
  flat: [outline(`M32,8 L32,90 M32,62 C54,46 80,54 76,72 C72,84 52,88 32,90`)],
  note: [solid(`M18,76 C18,66 30,62 40,66 C50,70 50,80 42,86 C34,92 20,88 18,76 Z`), outline(`M46,72 L46,14 C60,24 78,30 72,56`)],
  check: [outline(`M14,54 L38,78 L88,22`)],
  bolt: [solid(`M58,6 L22,56 L46,56 L38,94 L80,40 L54,40 Z`)],
  arrow: [outline(`M12,50 L88,50 M62,24 L88,50 L62,76`)],
  chevron: [outline(`M34,12 L72,50 L34,88`)],
  sun: [outline(circle(50, 50, 20), true), outline(`M50,6 L50,20 M50,80 L50,94 M6,50 L20,50 M80,50 L94,50 M19,19 L29,29 M71,71 L81,81 M81,19 L71,29 M29,71 L19,81`)],
  cloud: [outline(`M26,76 C8,76 6,52 24,48 C22,30 44,22 54,36 C66,24 88,34 82,52 C96,54 94,76 78,76 Z`, true)],
  drop: [solid(`M50,8 C50,8 18,46 18,64 C18,82 32,92 50,92 C68,92 82,82 82,64 C82,46 50,8 50,8 Z`)],
  moon: [solid(`M62,10 C34,16 20,40 26,64 C32,84 54,94 76,88 C54,80 44,58 52,34 C54,24 58,16 62,10 Z`)],
  shooting: [solid(polygon(starPoints(70, 34, 24, 10, 5))), outline(`M50,52 L10,90 M42,36 L8,56 M64,58 L38,92`)],
};

// Returns the shapes of a stamp (a copy: the caller may keep them in an element).
export function stampShapes(id: StampId): IconShapeData[] {
  return SHAPES[id].map((s) => ({ ...s }));
}

// Builds the element that a click with the Point tool puts at a point: a disc is the ellipse that the tool always made, the other shapes are icons that keep their own shapes. The line
// is not thicker than a part of the size of the shape, so that a small shape stays readable.
export function stampElement(id: StampId, center: Point, size: number, name: string, look: { stroke: string; strokeWidth: number; roughness: number; seed: number }, elementId: string): IconElement {
  const side = cleanStampSize(size);
  return {
    id: elementId,
    type: `icon`,
    x: r1(center[0] - side / 2),
    y: r1(center[1] - side / 2),
    width: side,
    height: side,
    name,
    vb: [0, 0, 100, 100],
    shapes: stampShapes(id),
    stroke: look.stroke,
    strokeWidth: Math.max(1, Math.min(look.strokeWidth, side / 8)),
    roughness: look.roughness,
    seed: look.seed,
  };
}

// The name of a stamp, shown in the menu and kept as the name of the element.
export function stampName(id: StampId): string {
  const names: Record<StampId, string> = {
    disc: t(`Disque`),
    circle: t(`Cercle`),
    cross: t(`Croix`),
    plus: t(`Plus`),
    star: t(`Étoile`),
    star4: t(`Étoile à quatre branches`),
    diamond: t(`Losange plein`),
    square: t(`Carré plein`),
    triangle: t(`Triangle plein`),
    heart: t(`Cœur`),
    sharp: t(`Dièse`),
    flat: t(`Bémol`),
    note: t(`Note de musique`),
    check: t(`Coche`),
    bolt: t(`Éclair`),
    arrow: t(`Flèche droite`),
    chevron: t(`Chevron`),
    sun: t(`Soleil`),
    cloud: t(`Nuage`),
    drop: t(`Goutte`),
    moon: t(`Croissant de lune`),
    shooting: t(`Étoile filante`),
  };
  return names[id];
}
