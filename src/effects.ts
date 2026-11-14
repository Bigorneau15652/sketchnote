// The effects of an element that the panel offers as choices: the shadow, the opacity, the reflection, the line style and the border. Pure module.
import type { Border, LineStyle, Shadow } from "./elements";
import { MIN_OPACITY } from "./elements";

// A border as a choice of the menu: `simple` is no particular border (a plain line).
export type BorderKind = `simple` | Border;
export const BORDER_KINDS: BorderKind[] = [`simple`, `none`, `double`, `double-reverse`, `frame`, `mat`];

// The corners of a rectangle as the buttons offer them: square, slightly rounded, rounded and very rounded (as round as the shortest side allows).
export const CORNER_RADII = { square: 0, slight: 14, round: 40, pill: 1000 };

// The shadow is set by two sliders: its size (0 for no shadow) and its strength. The size gives the distance of the shadow (down and to the right) and its blur together.
export const SHADOW_MAX = 40;
export const DEFAULT_SHADOW_OPACITY = 0.4;
// The reflection: its depth (the part of the height of the element that it takes) and how much it fades, with the values that an element has when it does not say.
export const DEFAULT_REFLECT_DEPTH = 0.6;
export const DEFAULT_REFLECT_FADE = 1;

const tenth = (n: number): number => Math.round(n * 10) / 10;

// Returns the shadow for a size and a strength, or undefined when the size is 0. A size of 8 gives the soft shadow (4 right, 6 down, a blur of about 10).
export function shadowFrom(size: number, opacity: number): Shadow | undefined {
  const k = Math.min(SHADOW_MAX, Math.max(0, size));
  if (k <= 0) return undefined;
  return { x: tenth(k * 0.5), y: tenth(k * 0.75), blur: tenth(k * 1.2), color: `#000000`, opacity: Math.min(1, Math.max(0.05, Math.round(opacity * 100) / 100)) };
}

// Returns the size of a shadow, as the slider shows it (0 for no shadow).
export function shadowSizeOf(shadow: Shadow | undefined): number {
  return shadow ? Math.min(SHADOW_MAX, Math.max(1, Math.round(shadow.y / 0.75))) : 0;
}

// Returns the strength of a shadow, or the usual one when there is no shadow.
export function shadowOpacityOf(shadow: Shadow | undefined): number {
  return shadow ? shadow.opacity : DEFAULT_SHADOW_OPACITY;
}

// Brings an opacity into the range an element accepts, rounded to a hundredth.
export function cleanOpacity(value: number): number {
  return Math.min(1, Math.max(MIN_OPACITY, Math.round(value * 100) / 100));
}

// The fields of effects that a style gives to a new element: only the ones that differ from the defaults, so that a plain element stays as short as before.
export interface StyleEffects {
  opacity: number;
  shadowSize: number;
  shadowOpacity: number;
  reflection: boolean;
  reflectionDepth: number;
  reflectionFade: number;
}

export function effectFields(style: StyleEffects): { opacity?: number; shadow?: Shadow; reflection?: true; reflectDepth?: number; reflectFade?: number } {
  const shadow = shadowFrom(style.shadowSize, style.shadowOpacity);
  return {
    ...(style.opacity < 1 ? { opacity: cleanOpacity(style.opacity) } : {}),
    ...(shadow ? { shadow } : {}),
    ...(style.reflection ? { reflection: true as const } : {}),
    ...(style.reflection && style.reflectionDepth !== DEFAULT_REFLECT_DEPTH ? { reflectDepth: style.reflectionDepth } : {}),
    ...(style.reflection && style.reflectionFade !== DEFAULT_REFLECT_FADE ? { reflectFade: style.reflectionFade } : {}),
  };
}

// Returns the line style field of a new element: only when it is not continuous.
export function lineStyleField(style: LineStyle): { lineStyle?: LineStyle } {
  return style === `solid` ? {} : { lineStyle: style };
}
