// The effects of an element that the panel offers as choices: the shadow, the opacity, the reflection, the line style and the border. Pure module.
import type { Border, LineStyle, Shadow } from "./elements";
import { MIN_OPACITY } from "./elements";

// A border as a choice of the menu: `simple` is no particular border (a plain line).
export type BorderKind = `simple` | Border;
export const BORDER_KINDS: BorderKind[] = [`simple`, `none`, `double`, `double-reverse`, `frame`, `mat`];

// The corners of a rectangle as the buttons offer them: square, slightly rounded, rounded and very rounded (as round as the shortest side allows).
export const CORNER_RADII = { square: 0, slight: 14, round: 40, pill: 1000 };

// The shadow is set by its distance from the element (down and to the right), its blur, its density (how dark it is) and its colour.
export const SHADOW_MAX_DISTANCE = 60;
export const SHADOW_MAX_BLUR = 40;
export const DEFAULT_SHADOW = { distance: 10, blur: 10, opacity: 0.4, color: `#000000` };
// The reflection: its depth (the part of the height of the element that it takes), how much it fades and how far it is from the element (as a part of the height; 0 means edge to
// edge), with the values that an element has when it does not say.
export const DEFAULT_REFLECT_DEPTH = 0.6;
export const DEFAULT_REFLECT_FADE = 1;
export const DEFAULT_REFLECT_GAP = 0;

const tenth = (n: number): number => Math.round(n * 10) / 10;
// The direction of the shadow: down and to the right, as a unit vector.
const DIRECTION: [number, number] = [0.55, 0.835];

export interface ShadowSettings {
  distance: number;
  blur: number;
  opacity: number;
  color: string;
}

// Returns the shadow for a set of settings. The settings are brought into their ranges.
export function shadowFrom(settings: ShadowSettings): Shadow {
  const d = Math.min(SHADOW_MAX_DISTANCE, Math.max(0, settings.distance));
  return {
    x: tenth(d * DIRECTION[0]),
    y: tenth(d * DIRECTION[1]),
    blur: tenth(Math.min(SHADOW_MAX_BLUR, Math.max(0, settings.blur))),
    color: settings.color,
    opacity: Math.min(1, Math.max(0.05, Math.round(settings.opacity * 100) / 100)),
  };
}

// Returns the settings of a shadow, or the usual ones when there is no shadow.
export function shadowSettingsOf(shadow: Shadow | undefined): ShadowSettings {
  if (!shadow) return { ...DEFAULT_SHADOW };
  return { distance: Math.min(SHADOW_MAX_DISTANCE, Math.round(Math.hypot(shadow.x, shadow.y))), blur: Math.min(SHADOW_MAX_BLUR, Math.round(shadow.blur)), opacity: shadow.opacity, color: shadow.color };
}

// Brings an opacity into the range an element accepts, rounded to a hundredth.
export function cleanOpacity(value: number): number {
  return Math.min(1, Math.max(MIN_OPACITY, Math.round(value * 100) / 100));
}

// The fields of effects that a style gives to a new element: only the ones that differ from the defaults, so that a plain element stays as short as before.
export interface StyleEffects {
  opacity: number;
  shadow: boolean;
  shadowDistance: number;
  shadowBlur: number;
  shadowOpacity: number;
  shadowColor: string;
  reflection: boolean;
  reflectionDepth: number;
  reflectionFade: number;
  reflectionGap: number;
}

export function effectFields(style: StyleEffects): { opacity?: number; shadow?: Shadow; reflection?: true; reflectDepth?: number; reflectFade?: number; reflectGap?: number } {
  return {
    ...(style.opacity < 1 ? { opacity: cleanOpacity(style.opacity) } : {}),
    ...(style.shadow ? { shadow: shadowFrom({ distance: style.shadowDistance, blur: style.shadowBlur, opacity: style.shadowOpacity, color: style.shadowColor }) } : {}),
    ...(style.reflection ? { reflection: true as const } : {}),
    ...(style.reflection && style.reflectionDepth !== DEFAULT_REFLECT_DEPTH ? { reflectDepth: style.reflectionDepth } : {}),
    ...(style.reflection && style.reflectionFade !== DEFAULT_REFLECT_FADE ? { reflectFade: style.reflectionFade } : {}),
    ...(style.reflection && style.reflectionGap !== DEFAULT_REFLECT_GAP ? { reflectGap: style.reflectionGap } : {}),
  };
}

// Returns the line style field of a new element: only when it is not continuous.
export function lineStyleField(style: LineStyle): { lineStyle?: LineStyle } {
  return style === `solid` ? {} : { lineStyle: style };
}
