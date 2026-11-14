// The effects of an element that the panel offers as choices: the shadows (a few presets), the opacity, the reflection, the line style and the border. Pure module.
import type { Border, LineStyle, Shadow } from "./elements";
import { MIN_OPACITY } from "./elements";

// The shadows the menu offers. `custom` is a shadow read from a file that matches none of them.
export type ShadowKind = `none` | `soft` | `strong` | `offset` | `custom`;
export const SHADOW_KINDS: ShadowKind[] = [`none`, `soft`, `strong`, `offset`];

// A border as a choice of the menu: `simple` is no particular border (a plain line).
export type BorderKind = `simple` | Border;
export const BORDER_KINDS: BorderKind[] = [`simple`, `none`, `double`, `double-reverse`, `frame`, `mat`];

// The corners of a rectangle as the buttons offer them: square, slightly rounded, rounded and very rounded (as round as the shortest side allows).
export const CORNER_RADII = { square: 0, slight: 14, round: 40, pill: 1000 };

const PRESETS: Record<`soft` | `strong` | `offset`, Shadow> = {
  soft: { x: 4, y: 6, blur: 10, color: `#000000`, opacity: 0.3 },
  strong: { x: 6, y: 10, blur: 16, color: `#000000`, opacity: 0.55 },
  offset: { x: 8, y: 8, blur: 0, color: `#000000`, opacity: 0.4 },
};

// Returns the shadow of a preset, or undefined for no shadow.
export function shadowOf(kind: ShadowKind): Shadow | undefined {
  return kind === `soft` || kind === `strong` || kind === `offset` ? { ...PRESETS[kind] } : undefined;
}

// Returns which preset a shadow is: none when there is no shadow, `custom` when it matches none of them.
export function kindOfShadow(shadow: Shadow | undefined): ShadowKind {
  if (!shadow) return `none`;
  for (const kind of [`soft`, `strong`, `offset`] as const) {
    const p = PRESETS[kind];
    if (p.x === shadow.x && p.y === shadow.y && p.blur === shadow.blur && p.opacity === shadow.opacity && p.color.toLowerCase() === shadow.color.toLowerCase()) return kind;
  }
  return `custom`;
}

// Brings an opacity into the range an element accepts, rounded to a hundredth.
export function cleanOpacity(value: number): number {
  return Math.min(1, Math.max(MIN_OPACITY, Math.round(value * 100) / 100));
}

// The fields of effects that a style gives to a new element: only the ones that differ from the defaults, so that a plain element stays as short as before.
export interface StyleEffects {
  opacity: number;
  shadow: ShadowKind;
  reflection: boolean;
}

export function effectFields(style: StyleEffects): { opacity?: number; shadow?: Shadow; reflection?: true } {
  const shadow = shadowOf(style.shadow);
  return { ...(style.opacity < 1 ? { opacity: cleanOpacity(style.opacity) } : {}), ...(shadow ? { shadow } : {}), ...(style.reflection ? { reflection: true as const } : {}) };
}

// Returns the line style field of a new element: only when it is not continuous.
export function lineStyleField(style: LineStyle): { lineStyle?: LineStyle } {
  return style === `solid` ? {} : { lineStyle: style };
}
