// The look of the lines and fills that the user chooses, and how a choice is applied to elements. Pure module.
import { canFill, FILL_STYLES, FreedrawElement, FillStyle, MAX_ROUGHNESS, Head, HEADS, headOf, isFontId, isShape, isStroked, LineStyle, MAX_FONT_SIZE, MIN_FILL_OPACITY, MIN_FONT_SIZE, SketchElement, TEXT_ALIGNS, TextAlign } from "./elements";
import { DEFAULT_FONT } from "./fonts";
import { BORDER_KINDS, BorderKind, cleanOpacity, CORNER_RADII, DEFAULT_REFLECT_DEPTH, DEFAULT_REFLECT_FADE, DEFAULT_REFLECT_GAP, DEFAULT_SHADOW, SHADOW_MAX_BLUR, SHADOW_MAX_DISTANCE, shadowFrom, shadowSettingsOf } from "./effects";
import { isSafeColor } from "./color";
import { BrushKind, cleanParam, fieldsOf, isBrush, paramsFromFields, paramsOf, sparseParams } from "./brushes";
import { cleanStampSize, DEFAULT_STAMP_SIZE, isStampId, StampId } from "./stamps";
import { cleanEraseDensity, cleanEraseSize, DEFAULT_ERASE_SIZE, EraseShape, isEraseShape } from "./erase-data";
import { BubbleForm, FestoonForm, isBubbleForm, isFestoonForm } from "./shape-forms";
import { MAX_REGULARITY } from "./tidy";
import { cleanWarpAmount, DEFAULT_WARP_AMOUNT, isWarpKind, WarpKind } from "./text-warp";

export interface ToolStyle {
  stroke: string;
  // Fill colour, or null for no fill.
  fill: string | null;
  fillStyle: FillStyle;
  // Opacity of the fill, from MIN_FILL_OPACITY (almost transparent) to 1 (opaque).
  fillOpacity: number;
  strokeWidth: number;
  // 0 for clean lines, 1 for the hand drawn look.
  roughness: number;
  // How much a pen stroke is tidied, from 0 (as drawn) to MAX_REGULARITY (the clean shape: line, circle, rectangle, triangle).
  regularity: number;
  // The brush of the pen and its settings: the flow, the hardness, the spacing, the form, the rotation of the tip in degrees (brushAngle), the grain and the dynamics.
  brush: BrushKind;
  flow: number;
  hardness: number;
  spacing: number;
  form: number;
  brushAngle: number;
  grain: number;
  dynamics: number;
  // Rounded edges for lines and arrows, and the heads of arrows.
  rounded: boolean;
  startHead: Head;
  endHead: Head;
  // The font, its size and the alignment of texts.
  font: string;
  fontSize: number;
  align: TextAlign;
  // How transparent the element is (0 to 1): the transparency of the fill for a shape (its border stays sharp), the transparency of the whole element for anything else.
  transparency: number;
  // The effects of every element: its opacity, its shadow and its reflection. The line style, the border and the corners of the shapes.
  opacity: number;
  // The shadow (whether there is one, its distance, its blur, its density and its colour) and the reflection (whether there is one, how deep it is, how much it fades and how far it is).
  shadow: boolean;
  shadowDistance: number;
  shadowBlur: number;
  shadowOpacity: number;
  shadowColor: string;
  reflection: boolean;
  reflectionDepth: number;
  reflectionFade: number;
  reflectionGap: number;
  // The distortion of a text (`none` for no distortion), its strength from -1 to 1, and whether it is written vertically.
  warp: WarpKind | `none`;
  warpAmount: number;
  vertical: boolean;
  // How much lines and arrows are tapered, from 0 (constant width) to 1.
  taper: number;
  lineStyle: LineStyle;
  border: BorderKind;
  radius: number;
  // The form of the next comic bubble and of the next festoon (or the form of the one that is selected).
  bubbleForm: BubbleForm;
  festoonForm: FestoonForm;
  // The eraser: its tip, its size in page units and how much it erases (from 0.1 to 1). They belong to the tool and are kept for the next passes.
  eraseShape: EraseShape;
  eraseSize: number;
  eraseDensity: number;
  // The shape that the Point tool puts and its size in page units. They belong to the tool and are kept for the next points.
  stamp: StampId;
  stampSize: number;
}

export type StylePatch = Partial<ToolStyle>;

// Widths proposed by the buttons: thin, medium and thick.
export const STROKE_WIDTHS = { thin: 3, medium: 5, thick: 9 };
export const MIN_WIDTH = 1;
export const MAX_WIDTH = 24;
// Sizes of text proposed by the buttons: small, medium, large and very large.
export const TEXT_SIZES = { small: 20, medium: 32, large: 52, huge: 84 };

// The effects of an element that has none: opaque, no shadow, no reflection, a continuous line, a simple border and square corners.
const PLAIN_EFFECTS = { transparency: 0, opacity: 1, shadow: false, shadowDistance: DEFAULT_SHADOW.distance, shadowBlur: DEFAULT_SHADOW.blur, shadowOpacity: DEFAULT_SHADOW.opacity, shadowColor: DEFAULT_SHADOW.color, reflection: false, reflectionDepth: DEFAULT_REFLECT_DEPTH, reflectionFade: DEFAULT_REFLECT_FADE, reflectionGap: DEFAULT_REFLECT_GAP, taper: 0, warp: `none` as WarpKind | `none`, warpAmount: DEFAULT_WARP_AMOUNT, vertical: false, lineStyle: `solid` as LineStyle, border: `simple` as BorderKind, radius: 0, bubbleForm: `oval` as BubbleForm, festoonForm: `ribbon` as FestoonForm, eraseShape: `soft` as EraseShape, eraseSize: DEFAULT_ERASE_SIZE, eraseDensity: 1, stamp: `disc` as StampId, stampSize: DEFAULT_STAMP_SIZE };

// Returns the settings of a brush in the names of the style: the usual ones of the brush, replaced by those that are given.
export function brushStyle(brush: BrushKind, stored: Partial<Record<`flow` | `hardness` | `spacing` | `form` | `rotation` | `grain` | `dynamics`, number>>): Pick<ToolStyle, `flow` | `hardness` | `spacing` | `form` | `brushAngle` | `grain` | `dynamics`> {
  const p = paramsOf(brush, stored);
  return { flow: p.flow, hardness: p.hardness, spacing: p.spacing, form: p.form, brushAngle: p.rotation, grain: p.grain, dynamics: p.dynamics };
}

// Returns the settings that make a brush start from its usual ones (what a choice of brush sets).
export function brushDefaultsPatch(brush: BrushKind): StylePatch {
  return brushStyle(brush, {});
}

// Returns the style of a new drawing: a thin hand drawn line in the ink colour of the page, with no fill.
export function defaultStyle(ink: string): ToolStyle {
  return { stroke: isSafeColor(ink) ? ink : `#000000`, fill: null, fillStyle: `solid`, fillOpacity: 1, strokeWidth: STROKE_WIDTHS.thin, roughness: 1, regularity: 0, brush: `round`, ...brushStyle(`round`, {}), rounded: false, startHead: `none`, endHead: `arrow`, font: DEFAULT_FONT, fontSize: TEXT_SIZES.medium, align: `left`, ...PLAIN_EFFECTS };
}

// Returns a style patch with every value checked: unknown or invalid values are dropped.
export function cleanPatch(patch: StylePatch): StylePatch {
  const out: StylePatch = {};
  if (patch.stroke !== undefined && isSafeColor(patch.stroke)) out.stroke = patch.stroke;
  if (patch.fill !== undefined && (patch.fill === null || isSafeColor(patch.fill))) out.fill = patch.fill;
  if (patch.fillStyle !== undefined && FILL_STYLES.includes(patch.fillStyle)) out.fillStyle = patch.fillStyle;
  if (typeof patch.fillOpacity === `number` && Number.isFinite(patch.fillOpacity)) out.fillOpacity = Math.min(1, Math.max(MIN_FILL_OPACITY, Math.round(patch.fillOpacity * 100) / 100));
  if (typeof patch.strokeWidth === `number` && Number.isFinite(patch.strokeWidth)) out.strokeWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, patch.strokeWidth));
  if (isBrush(patch.brush)) out.brush = patch.brush;
  for (const key of [`flow`, `hardness`, `spacing`, `form`, `grain`, `dynamics`] as const) {
    const v = patch[key];
    if (typeof v === `number` && Number.isFinite(v)) out[key] = cleanParam(key, v);
  }
  if (typeof patch.brushAngle === `number` && Number.isFinite(patch.brushAngle)) out.brushAngle = cleanParam(`rotation`, patch.brushAngle);
  if (patch.warp === `none` || isWarpKind(patch.warp)) out.warp = patch.warp;
  if (typeof patch.warpAmount === `number` && Number.isFinite(patch.warpAmount)) out.warpAmount = cleanWarpAmount(patch.warpAmount);
  if (typeof patch.vertical === `boolean`) out.vertical = patch.vertical;
  if (typeof patch.regularity === `number` && Number.isFinite(patch.regularity)) out.regularity = Math.min(MAX_REGULARITY, Math.max(0, Math.round(patch.regularity * 10) / 10));
  if (typeof patch.roughness === `number` && Number.isFinite(patch.roughness)) out.roughness = Math.min(MAX_ROUGHNESS, Math.max(0, Math.round(patch.roughness * 10) / 10));
  if (typeof patch.rounded === `boolean`) out.rounded = patch.rounded;
  if (patch.startHead !== undefined && HEADS.includes(patch.startHead)) out.startHead = patch.startHead;
  if (patch.endHead !== undefined && HEADS.includes(patch.endHead)) out.endHead = patch.endHead;
  if (isFontId(patch.font)) out.font = patch.font;
  if (typeof patch.fontSize === `number` && Number.isFinite(patch.fontSize)) out.fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(patch.fontSize)));
  if (patch.align !== undefined && TEXT_ALIGNS.includes(patch.align)) out.align = patch.align;
  if (typeof patch.opacity === `number` && Number.isFinite(patch.opacity)) out.opacity = cleanOpacity(patch.opacity);
  if (typeof patch.transparency === `number` && Number.isFinite(patch.transparency)) out.transparency = Math.min(1, Math.max(0, Math.round(patch.transparency * 100) / 100));
  if (typeof patch.shadow === `boolean`) out.shadow = patch.shadow;
  if (typeof patch.shadowDistance === `number` && Number.isFinite(patch.shadowDistance)) out.shadowDistance = Math.min(SHADOW_MAX_DISTANCE, Math.max(0, Math.round(patch.shadowDistance)));
  if (typeof patch.shadowBlur === `number` && Number.isFinite(patch.shadowBlur)) out.shadowBlur = Math.min(SHADOW_MAX_BLUR, Math.max(0, Math.round(patch.shadowBlur)));
  if (isSafeColor(patch.shadowColor)) out.shadowColor = patch.shadowColor;
  if (typeof patch.reflectionGap === `number` && Number.isFinite(patch.reflectionGap)) out.reflectionGap = Math.min(1, Math.max(0, Math.round(patch.reflectionGap * 100) / 100));
  if (typeof patch.shadowOpacity === `number` && Number.isFinite(patch.shadowOpacity)) out.shadowOpacity = Math.min(1, Math.max(0.05, Math.round(patch.shadowOpacity * 100) / 100));
  if (typeof patch.reflectionDepth === `number` && Number.isFinite(patch.reflectionDepth)) out.reflectionDepth = Math.min(1, Math.max(0.1, Math.round(patch.reflectionDepth * 100) / 100));
  if (typeof patch.reflectionFade === `number` && Number.isFinite(patch.reflectionFade)) out.reflectionFade = Math.min(1, Math.max(0, Math.round(patch.reflectionFade * 100) / 100));
  if (typeof patch.taper === `number` && Number.isFinite(patch.taper)) out.taper = Math.min(1, Math.max(0, Math.round(patch.taper * 100) / 100));
  if (typeof patch.reflection === `boolean`) out.reflection = patch.reflection;
  if (patch.lineStyle === `solid` || patch.lineStyle === `dashed` || patch.lineStyle === `dotted`) out.lineStyle = patch.lineStyle;
  if (patch.border !== undefined && BORDER_KINDS.includes(patch.border)) out.border = patch.border;
  if (isStampId(patch.stamp)) out.stamp = patch.stamp;
  if (typeof patch.stampSize === `number` && Number.isFinite(patch.stampSize)) out.stampSize = cleanStampSize(patch.stampSize);
  if (isEraseShape(patch.eraseShape)) out.eraseShape = patch.eraseShape;
  if (typeof patch.eraseSize === `number` && Number.isFinite(patch.eraseSize)) out.eraseSize = cleanEraseSize(patch.eraseSize);
  if (typeof patch.eraseDensity === `number` && Number.isFinite(patch.eraseDensity)) out.eraseDensity = cleanEraseDensity(patch.eraseDensity);
  if (isBubbleForm(patch.bubbleForm)) out.bubbleForm = patch.bubbleForm;
  if (isFestoonForm(patch.festoonForm)) out.festoonForm = patch.festoonForm;
  if (typeof patch.radius === `number` && Number.isFinite(patch.radius)) out.radius = Math.min(CORNER_RADII.pill, Math.max(0, Math.round(patch.radius)));
  return out;
}

// Applies a style patch to one element. A drawing frame has no style and is returned as it is. The fill only applies to shapes; a line keeps its stroke only.
export function applyStyle(el: SketchElement, patch: StylePatch): SketchElement {
  // A locked element keeps its look.
  if (el.locked === true) return el;
  if (el.type === `text`) {
    const clean = cleanPatch(patch);
    return applyEffects(applyTextStyle(el, clean), clean.transparency !== undefined ? { ...clean, opacity: cleanOpacity(1 - clean.transparency) } : clean);
  }
  if (!isStroked(el)) return el;
  const p = cleanPatch(patch);
  let next = { ...applyEffects(el, p) } as typeof el;
  if (p.lineStyle !== undefined && next.type !== `freedraw`) {
    const { lineStyle: _l, ...rest } = next;
    void _l;
    next = (p.lineStyle === `solid` ? rest : { ...rest, lineStyle: p.lineStyle }) as typeof el;
  }
  if ((isShape(next) || next.type === `line` || next.type === `arrow`) && next.label && (p.font !== undefined || p.fontSize !== undefined || p.align !== undefined)) {
    // The font, the size and the alignment of the panel apply to the text written inside a shape.
    const { align: _a, ...label } = next.label;
    void _a;
    const align = p.align !== undefined ? p.align : next.label.align;
    next = { ...next, label: { ...label, ...(p.font !== undefined ? { font: p.font } : {}), ...(p.fontSize !== undefined ? { size: p.fontSize } : {}), ...(align !== undefined && align !== `center` ? { align } : {}) } } as typeof el;
  }
  if (isShape(next) || next.type === `image`) {
    if (p.border !== undefined) {
      const { border: _b, ...rest } = next;
      void _b;
      if (next.type === `image`) {
        // A picture has a border only when it is given one: none removes it, the simple one is the usual style, the others are stored.
        const { frame: _f, ...bare } = rest as typeof rest & { frame?: true };
        void _f;
        next = (p.border === `none` ? bare : p.border === `simple` ? { ...bare, frame: true } : { ...bare, frame: true, border: p.border }) as typeof el;
      } else next = (p.border === `simple` ? rest : { ...rest, border: p.border }) as typeof el;
    }
    if (p.radius !== undefined && (next.type === `rect` || next.type === `image`)) {
      const { radius: _r, ...rest } = next;
      void _r;
      next = (p.radius === 0 ? rest : { ...rest, radius: p.radius }) as typeof el;
    }
  }
  // The form of a bubble or of a festoon that is selected.
  if (next.type === `rect` && next.form !== undefined) {
    if (isBubbleForm(next.form) && p.bubbleForm !== undefined) next = { ...next, form: p.bubbleForm } as typeof el;
    else if (isFestoonForm(next.form) && p.festoonForm !== undefined) next = { ...next, form: p.festoonForm } as typeof el;
  }
  if (p.stroke !== undefined) next.stroke = p.stroke;
  if (p.strokeWidth !== undefined) next.strokeWidth = p.strokeWidth;
  if (p.roughness !== undefined) next.roughness = p.roughness;
  if (next.type === `freedraw`) {
    // A new brush starts from its usual settings; a setting that is given replaces the stored one; only what is not the usual value of the brush is kept.
    const given: Partial<Record<`flow` | `hardness` | `spacing` | `form` | `rotation` | `grain` | `dynamics`, number>> = {};
    for (const key of [`flow`, `hardness`, `spacing`, `form`, `grain`, `dynamics`] as const) if (p[key] !== undefined) given[key] = p[key];
    if (p.brushAngle !== undefined) given.rotation = p.brushAngle;
    if (p.brush !== undefined || Object.keys(given).length > 0) {
      const cur = next as FreedrawElement;
      const brush = p.brush ?? cur.brush ?? `round`;
      const merged = { ...(p.brush !== undefined ? {} : paramsFromFields(cur)), ...given };
      const { brush: _b, flow: _f, hardness: _h, spacing: _s, form: _o, nibAngle: _n, grain: _g, dynamics: _d, ...rest } = cur;
      void [_b, _f, _h, _s, _o, _n, _g, _d];
      next = { ...rest, ...(brush === `round` ? {} : { brush }), ...fieldsOf(sparseParams(brush, merged)) } as typeof el;
    }
  }
  if (next.type === `freedraw` && p.regularity !== undefined) {
    const { regularity: _g, ...rest } = next;
    void _g;
    next = (p.regularity > 0 ? { ...rest, regularity: p.regularity } : rest) as typeof el;
  }
  if ((next.type === `line` || next.type === `arrow`) && p.taper !== undefined) {
    const { taper: _t, ...rest } = next;
    void _t;
    next = (p.taper > 0 ? { ...rest, taper: p.taper } : rest) as typeof el;
  }
  if (next.type === `line` || next.type === `arrow`) {
    if (p.rounded !== undefined) {
      const { rounded: _r, ...rest } = next;
      void _r;
      next = (p.rounded ? { ...rest, rounded: true } : rest) as typeof el;
    }
  }
  // A line that is given a head becomes an arrow. Its other end keeps no head (an arrow without a choice has an open head at its end).
  if (next.type === `line` && ((p.startHead !== undefined && p.startHead !== `none`) || (p.endHead !== undefined && p.endHead !== `none`))) {
    next = { ...next, type: `arrow`, startHead: p.startHead ?? `none`, endHead: p.endHead ?? `none` } as typeof el;
  } else if (next.type === `arrow`) {
    if (p.startHead !== undefined) next = { ...next, startHead: p.startHead } as typeof el;
    if (p.endHead !== undefined) next = { ...next, endHead: p.endHead } as typeof el;
  }
  if (canFill(next)) {
    if (p.fill === null) {
      const { fill: _f, ...rest } = next;
      void _f;
      next = rest as typeof el;
    } else if (p.fill !== undefined) {
      next = { ...next, fill: p.fill, fillStyle: next.fillStyle ?? p.fillStyle ?? `solid` } as typeof el;
    }
    if (p.fillStyle !== undefined && canFill(next) && next.fill !== undefined) next = { ...next, fillStyle: p.fillStyle } as typeof el;
    if (p.fillOpacity !== undefined && canFill(next)) {
      if (p.fillOpacity >= 1) {
        const { fillOpacity: _o, ...rest } = next;
        void _o;
        next = rest as typeof el;
      } else {
        next = { ...next, fillOpacity: p.fillOpacity } as typeof el;
      }
    }
  }
  // The transparency of the panel: the fill of a shape (its border stays sharp), the whole element for anything else.
  if (p.transparency !== undefined) {
    if (isShape(next)) {
      const opacity = Math.max(MIN_FILL_OPACITY, 1 - p.transparency);
      const { fillOpacity: _f, ...bare } = next;
      void _f;
      next = (opacity >= 1 ? bare : { ...bare, fillOpacity: opacity }) as typeof el;
    } else {
      next = applyEffects(next, { opacity: cleanOpacity(1 - p.transparency) });
    }
  }
  return next;
}

// Applies the effects of a style patch that every element has: its opacity, its shadow and its reflection. A value that is the default is removed from the element.
function applyEffects<T extends SketchElement>(el: T, p: StylePatch): T {
  let next: SketchElement = el;
  if (p.opacity !== undefined) {
    const { opacity: _o, ...rest } = next;
    void _o;
    next = (p.opacity >= 1 ? rest : { ...rest, opacity: p.opacity }) as SketchElement;
  }
  if (p.shadow === false) {
    const { shadow: _s, ...rest } = next;
    void _s;
    next = rest as SketchElement;
  } else if (p.shadow === true || (next.shadow !== undefined && (p.shadowDistance !== undefined || p.shadowBlur !== undefined || p.shadowOpacity !== undefined || p.shadowColor !== undefined))) {
    // Turning the shadow on gives the usual one; each setting keeps the value it has when only the others are given. Settings alone put no shadow on an element that has none.
    const now = shadowSettingsOf(next.shadow);
    next = {
      ...next,
      shadow: shadowFrom({ distance: p.shadowDistance ?? now.distance, blur: p.shadowBlur ?? now.blur, opacity: p.shadowOpacity ?? now.opacity, color: p.shadowColor ?? now.color }),
    } as SketchElement;
  }
  if (p.reflection !== undefined) {
    const { reflection: _f, ...rest } = next;
    void _f;
    next = (p.reflection ? { ...rest, reflection: true } : rest) as SketchElement;
  }
  if (p.reflectionDepth !== undefined) {
    const { reflectDepth: _d, ...rest } = next;
    void _d;
    next = (p.reflectionDepth === DEFAULT_REFLECT_DEPTH ? rest : { ...rest, reflectDepth: p.reflectionDepth }) as SketchElement;
  }
  if (p.reflectionFade !== undefined) {
    const { reflectFade: _e, ...rest } = next;
    void _e;
    next = (p.reflectionFade === DEFAULT_REFLECT_FADE ? rest : { ...rest, reflectFade: p.reflectionFade }) as SketchElement;
  }
  if (p.reflectionGap !== undefined) {
    const { reflectGap: _g, ...rest } = next;
    void _g;
    next = (p.reflectionGap === DEFAULT_REFLECT_GAP ? rest : { ...rest, reflectGap: p.reflectionGap }) as SketchElement;
  }
  return next as T;
}

// Applies the parts of a style patch that concern a text: its colour, its font, its size and its alignment. The size of its box is measured again by the caller.
function applyTextStyle(el: Extract<SketchElement, { type: `text` }>, p: StylePatch): SketchElement {
  let next = { ...el };
  if (p.stroke !== undefined) next.stroke = p.stroke;
  if (p.font !== undefined) next.font = p.font;
  if (p.fontSize !== undefined) next.size = p.fontSize;
  if (p.align !== undefined) {
    const { align: _a, ...rest } = next;
    void _a;
    next = (p.align === `left` ? rest : { ...rest, align: p.align }) as typeof next;
  }
  // The distortion and the strength: choosing `none` takes both away; a strength only counts with a distortion, and the usual one is not kept.
  if (p.warp !== undefined || p.warpAmount !== undefined) {
    const kind: WarpKind | undefined = p.warp === `none` ? undefined : p.warp ?? next.warp;
    const amount = p.warpAmount ?? (p.warp !== undefined ? DEFAULT_WARP_AMOUNT : next.warpAmount ?? DEFAULT_WARP_AMOUNT);
    const { warp: _w, warpAmount: _m, ...rest } = next;
    void [_w, _m];
    next = (kind === undefined ? rest : { ...rest, warp: kind, ...(amount !== DEFAULT_WARP_AMOUNT ? { warpAmount: amount } : {}) }) as typeof next;
  }
  if (p.vertical !== undefined) {
    const { vertical: _v, ...rest } = next;
    void _v;
    next = (p.vertical ? { ...rest, vertical: true } : rest) as typeof next;
  }
  return next;
}

// Applies a style patch to the selected elements of a list. The other elements are returned as they are.
export function applyStyleToIds(elements: SketchElement[], ids: Set<string>, patch: StylePatch): SketchElement[] {
  return elements.map((e) => (ids.has(e.id) ? applyStyle(e, patch) : e));
}

// Returns the style an element currently has, or null for a drawing frame. A line has no fill.
export function styleOf(el: SketchElement): ToolStyle | null {
  if (el.type === `text`) return { ...defaultStyle(el.stroke), transparency: 1 - (el.opacity ?? 1), font: el.font, fontSize: el.size, align: el.align ?? `left`, warp: el.warp ?? `none`, warpAmount: el.warpAmount ?? DEFAULT_WARP_AMOUNT, vertical: el.vertical === true, ...effectsOfElement(el) };
  if (!isStroked(el)) return null;
  const fill = canFill(el) && el.fill !== undefined ? el.fill : null;
  const fillStyle: FillStyle = canFill(el) && el.fillStyle ? el.fillStyle : `solid`;
  const fillOpacity = canFill(el) && el.fillOpacity !== undefined ? el.fillOpacity : 1;
  const linear = el.type === `line` || el.type === `arrow`;
  const rounded = linear && el.rounded === true;
  const startHead: Head = el.type === `arrow` ? headOf(el, `start`) : `none`;
  const endHead: Head = el.type === `arrow` ? headOf(el, `end`) : `none`;
  return { transparency: isShape(el) ? 1 - fillOpacity : 1 - (el.opacity ?? 1), stroke: el.stroke, fill, fillStyle, fillOpacity, strokeWidth: el.strokeWidth, roughness: el.roughness ?? 0, regularity: el.type === `freedraw` ? el.regularity ?? 0 : 0, warp: `none`, warpAmount: DEFAULT_WARP_AMOUNT, vertical: false, brush: el.type === `freedraw` ? el.brush ?? `round` : `round`, ...(el.type === `freedraw` ? brushStyle(el.brush ?? `round`, paramsFromFields(el)) : brushStyle(`round`, {})), rounded, startHead, endHead, taper: el.type === `line` || el.type === `arrow` ? el.taper ?? 0 : 0, font: labelOf(el) ? labelOf(el)?.font ?? DEFAULT_FONT : DEFAULT_FONT, fontSize: labelOf(el)?.size ?? TEXT_SIZES.medium, align: labelOf(el) ? labelOf(el)?.align ?? `center` : `left`, ...effectsOfElement(el), lineStyle: el.type === `freedraw` ? `solid` : el.lineStyle ?? `solid`, border: el.type === `image` ? (el.frame === true ? el.border ?? `simple` : `none`) : isShape(el) ? el.border ?? `simple` : `simple`, radius: el.type === `rect` || el.type === `image` ? el.radius ?? 0 : 0, bubbleForm: el.type === `rect` && isBubbleForm(el.form) ? el.form : `oval`, festoonForm: el.type === `rect` && isFestoonForm(el.form) ? el.form : `ribbon`, eraseShape: `soft`, eraseSize: DEFAULT_ERASE_SIZE, eraseDensity: 1, stamp: `disc`, stampSize: DEFAULT_STAMP_SIZE };
}

// Returns the text written in a shape or in the middle of a line, or undefined.
function labelOf(el: SketchElement): { font: string; size: number; align?: TextAlign } | undefined {
  return el.type === `rect` || el.type === `ellipse` || el.type === `diamond` || el.type === `triangle` || el.type === `line` || el.type === `arrow` ? el.label : undefined;
}

// Returns the effects an element has, as the panel shows them.
function effectsOfElement(el: SketchElement): { opacity: number; shadow: boolean; shadowDistance: number; shadowBlur: number; shadowOpacity: number; shadowColor: string; reflection: boolean; reflectionDepth: number; reflectionFade: number; reflectionGap: number } {
  const sh = shadowSettingsOf(el.shadow);
  return {
    opacity: el.opacity ?? 1,
    shadow: el.shadow !== undefined,
    shadowDistance: sh.distance,
    shadowBlur: sh.blur,
    shadowOpacity: sh.opacity,
    shadowColor: sh.color,
    reflection: el.reflection === true,
    reflectionDepth: el.reflectDepth ?? DEFAULT_REFLECT_DEPTH,
    reflectionFade: el.reflectFade ?? DEFAULT_REFLECT_FADE,
    reflectionGap: el.reflectGap ?? DEFAULT_REFLECT_GAP,
  };
}
