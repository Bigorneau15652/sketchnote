// The colour window: a single colour wheel (the hue is the angle, the saturation is the distance from the centre, and a small triangle on the edge shows the hue), sliders and fields for the hue, the saturation and the luminance,
// a field for the hexadecimal code and an eyedropper that takes a colour anywhere on the screen. Every button is a pictogram whose name is its tooltip. The colour is
// given back only when the check mark is used.
import { App, Modal, setIcon, Setting } from "obsidian";
import { t } from "./i18n";
import { Hsl, hexToHsl, hslToHex, hslToRgb, hsToWheel, luminanceToSlider, normalizeHex, sliderToLuminance, usableLuminance, wheelToHs } from "./hsl";
import { toHex6 } from "./page-background";
import { FILL_STYLES, FillStyle } from "./elements";
import { swatchBackground } from "./swatches";

// Size of the wheel in pixels, and the part of its radius that the colours fill: the margin around is where the triangle of the hue turns.
const SIZE = 240;
const RADIUS = SIZE / 2;
const DISC = 0.88;

// The eyedropper of the browser, present on the computer versions of Obsidian.
type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperCtor | undefined => (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

// What the window gives back: the colour (null for no colour) and the pattern of a fill.
export interface ColorChoice {
  color: string | null;
  style: FillStyle;
}

// What the window offers besides the colour: the patterns of a fill (solid, hatching, dots, grid) and a button for no colour, and the choice it starts from.
export interface ColorOptions {
  fill?: boolean;
  style?: FillStyle;
  none?: boolean;
}

export class ColorModal extends Modal {
  private hsl: Hsl;
  private readonly initial: string;
  private readonly onPick: (choice: ColorChoice) => void;
  private readonly options: ColorOptions;
  private style: FillStyle;
  private none: boolean;
  private wheelDrawn = false;
  private patternButtons: { style: FillStyle; el: HTMLElement }[] = [];
  private noneButton: HTMLElement | null = null;
  private wheel: HTMLCanvasElement | null = null;
  private handle: HTMLElement | null = null;
  private tick: HTMLElement | null = null;
  private hex: HTMLInputElement | null = null;
  private fresh: HTMLElement | null = null;
  private readonly sliders: { hue: HTMLInputElement | null; sat: HTMLInputElement | null; lum: HTMLInputElement | null } = { hue: null, sat: null, lum: null };
  private readonly numbers: { hue: HTMLInputElement | null; sat: HTMLInputElement | null; lum: HTMLInputElement | null } = { hue: null, sat: null, lum: null };

  // Creates the window with the colour to start from, the function called with the choice when the check mark is used, and what the window offers besides the colour.
  constructor(app: App, initial: string, onPick: (choice: ColorChoice) => void, options: ColorOptions = {}) {
    super(app);
    this.initial = toHex6(initial);
    this.hsl = hexToHsl(this.initial);
    this.onPick = onPick;
    this.options = options;
    this.style = options.style ?? `solid`;
    this.none = options.none === true;
  }

  // Draws the window.
  onOpen(): void {
    this.setTitle(t(`Couleur`));
    this.modalEl.addClass(`sketchnote-color-modal`);
    const el = this.contentEl;
    const stage = el.createDiv({ cls: `sketchnote-wheel` });
    const canvas = stage.createEl(`canvas`, { cls: `sketchnote-wheel-canvas` });
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.setAttribute(`aria-label`, t(`Cercle chromatique`));
    this.wheel = canvas;
    this.tick = stage.createDiv({ cls: `sketchnote-wheel-tick` });
    this.handle = stage.createDiv({ cls: `sketchnote-wheel-handle` });
    this.listenWheel(canvas);

    this.slider(el, `hue`, t(`Teinte`), 0, 359, (v) => this.set({ ...this.hsl, h: v, l: usableLuminance(this.hsl.l) }));
    this.slider(el, `sat`, t(`Saturation`), 0, 100, (v) => this.set({ ...this.hsl, s: v, l: usableLuminance(this.hsl.l) }));
    this.slider(el, `lum`, t(`Luminance`), -100, 100, (v) => this.set({ ...this.hsl, l: sliderToLuminance(v) }));

    const row = el.createDiv({ cls: `sketchnote-color-row` });
    row.createSpan({ cls: `sketchnote-color-label`, text: t(`Hexadécimal`) });
    const hex = row.createEl(`input`, { cls: `sketchnote-color-hex`, type: `text` });
    hex.maxLength = 9;
    hex.spellcheck = false;
    hex.addEventListener(`input`, () => {
      const ok = normalizeHex(hex.value);
      hex.toggleClass(`mod-error`, ok === null);
      if (ok) this.set(hexToHsl(ok), false);
    });
    hex.addEventListener(`change`, () => this.refresh());
    this.hex = hex;
    const Dropper = eyeDropper();
    if (Dropper) {
      const pipette = row.createEl(`button`, { cls: `sketchnote-color-pipette` });
      setIcon(pipette, `pipette`);
      pipette.setAttribute(`aria-label`, t(`Pipette : prendre une couleur à l'écran`));
      pipette.setAttribute(`title`, t(`Pipette : prendre une couleur à l'écran`));
      pipette.addEventListener(`click`, () => void this.pickFromScreen(Dropper));
    }
    const preview = row.createDiv({ cls: `sketchnote-color-preview` });
    const old = preview.createDiv({ cls: `sketchnote-color-old` });
    old.style.background = this.initial;
    old.setAttribute(`title`, t(`Couleur de départ`));
    this.fresh = preview.createDiv({ cls: `sketchnote-color-new` });
    this.fresh.setAttribute(`title`, t(`Nouvelle couleur`));

    if (this.options.fill) this.buildFillRow(el);

    new Setting(el)
      .addButton((b) => b.setIcon(`x`).setTooltip(t(`Annuler`)).onClick(() => this.close()))
      .addButton((b) =>
        b
          .setIcon(`check`)
          .setTooltip(t(`Confirmer`))
          .setCta()
          .onClick(() => {
            const choice: ColorChoice = { color: this.none ? null : hslToHex(this.hsl), style: this.style };
            this.close();
            this.onPick(choice);
          }),
      );
    this.refresh();
  }

  // Adds the row of the fill: the four patterns and the button that takes the colour away.
  private buildFillRow(parent: HTMLElement): void {
    const row = parent.createDiv({ cls: `sketchnote-color-row sketchnote-color-patterns` });
    const names: Record<FillStyle, string> = { solid: t(`Remplissage uni`), hachure: t(`Hachures`), dots: t(`Points`), grid: t(`Quadrillage`) };
    for (const style of FILL_STYLES) {
      const b = row.createEl(`button`, { cls: `sketchdraw-chip` });
      setIcon(b, `sketchnote-fill-${style}`);
      b.setAttribute(`aria-label`, names[style]);
      b.setAttribute(`title`, names[style]);
      b.addEventListener(`click`, () => {
        this.style = style;
        this.none = false;
        this.refresh();
      });
      this.patternButtons.push({ style, el: b });
    }
    const none = row.createEl(`button`, { cls: `sketchdraw-chip sketchnote-color-none` });
    setIcon(none, `ban`);
    none.setAttribute(`aria-label`, t(`Sans couleur`));
    none.setAttribute(`title`, t(`Sans couleur`));
    none.addEventListener(`click`, () => {
      this.none = true;
      this.refresh();
    });
    this.noneButton = none;
  }

  // Empties the window when it closes.
  onClose(): void {
    this.contentEl.empty();
  }

  // Adds a row with a label, a slider and a number field that follow each other.
  private slider(parent: HTMLElement, key: `hue` | `sat` | `lum`, label: string, min: number, max: number, onValue: (v: number) => void): void {
    const row = parent.createDiv({ cls: `sketchnote-color-row` });
    row.createSpan({ cls: `sketchnote-color-label`, text: label });
    const range = row.createEl(`input`, { cls: `sketchnote-color-range`, type: `range` });
    range.min = String(min);
    range.max = String(max);
    range.step = `1`;
    range.setAttribute(`aria-label`, label);
    const number = row.createEl(`input`, { cls: `sketchnote-color-number`, type: `number` });
    number.min = String(min);
    number.max = String(max);
    number.setAttribute(`aria-label`, label);
    const take = (value: string): void => {
      const v = Number(value);
      if (value.trim() !== `` && Number.isFinite(v)) onValue(Math.min(max, Math.max(min, Math.round(v))));
    };
    range.addEventListener(`input`, () => take(range.value));
    number.addEventListener(`input`, () => take(number.value));
    this.sliders[key] = range;
    this.numbers[key] = number;
  }

  // Follows the pointer on the wheel: a press on the colours sets the hue and the saturation, a press in the margin around them (where the triangle turns) sets the hue only.
  private listenWheel(canvas: HTMLCanvasElement): void {
    let mode: `ring` | `disc` | null = null;
    const at = (e: PointerEvent): void => {
      const box = canvas.getBoundingClientRect();
      const k = SIZE / Math.max(1, box.width);
      const dx = (e.clientX - box.left) * k - RADIUS;
      const dy = (e.clientY - box.top) * k - RADIUS;
      const { h, s } = wheelToHs(dx, dy, RADIUS * DISC);
      const l = usableLuminance(this.hsl.l);
      if (mode === `ring`) this.set({ ...this.hsl, h, l });
      else this.set({ ...this.hsl, h, s, l });
    };
    canvas.addEventListener(`pointerdown`, (e) => {
      const box = canvas.getBoundingClientRect();
      const k = SIZE / Math.max(1, box.width);
      const r = Math.hypot((e.clientX - box.left) * k - RADIUS, (e.clientY - box.top) * k - RADIUS);
      mode = r > RADIUS * DISC ? `ring` : `disc`;
      canvas.setPointerCapture(e.pointerId);
      at(e);
    });
    canvas.addEventListener(`pointermove`, (e) => {
      if (mode) at(e);
    });
    const stop = (): void => {
      mode = null;
    };
    canvas.addEventListener(`pointerup`, stop);
    canvas.addEventListener(`pointercancel`, stop);
  }

  // Takes a colour from the screen with the eyedropper of the browser. A press on Escape gives no colour and changes nothing.
  private async pickFromScreen(Dropper: EyeDropperCtor): Promise<void> {
    try {
      const result = await new Dropper().open();
      const hex = normalizeHex(result.sRGBHex);
      if (hex) this.set(hexToHsl(hex));
    } catch {
      // Cancelled by the user.
    }
  }

  // Takes a new colour and shows it everywhere. `updateHex` is false while the user types in the hexadecimal field, so that the field is not rewritten under the cursor.
  private set(hsl: Hsl, updateHex = true): void {
    this.none = false;
    this.hsl = { h: ((hsl.h % 360) + 360) % 360, s: Math.min(100, Math.max(0, hsl.s)), l: Math.min(100, Math.max(0, hsl.l)) };
    this.refresh(updateHex);
  }

  // Draws the wheel when the luminance changed, then places the marks, the sliders, the fields and the preview.
  private refresh(updateHex = true): void {
    const { h, s, l } = this.hsl;
    // The wheel is always drawn in full colour (at the middle luminance), whatever the luminance slider says: the colour in use is shown by the round mark, the preview and
    // the hexadecimal code.
    if (this.wheel && !this.wheelDrawn) {
      this.wheelDrawn = true;
      this.drawWheel(this.wheel, 50);
    }
    const [hx, hy] = hsToWheel(h, s, RADIUS * DISC);
    const hex = hslToHex(this.hsl);
    if (this.handle) {
      this.handle.style.left = `${((RADIUS + hx) / SIZE) * 100}%`;
      this.handle.style.top = `${((RADIUS + hy) / SIZE) * 100}%`;
      this.handle.style.background = hex;
    }
    if (this.tick) {
      // The triangle sits just outside the edge of the colours and points to the centre.
      const [tx, ty] = hsToWheel(h, 100, RADIUS * DISC + 10);
      this.tick.style.left = `${((RADIUS + tx) / SIZE) * 100}%`;
      this.tick.style.top = `${((RADIUS + ty) / SIZE) * 100}%`;
      this.tick.style.transform = `rotate(${90 - h}deg)`;
    }
    const values = { hue: Math.round(h) % 360, sat: Math.round(s), lum: luminanceToSlider(l) };
    for (const key of [`hue`, `sat`, `lum`] as const) {
      const range = this.sliders[key];
      const number = this.numbers[key];
      if (range) range.value = String(values[key]);
      if (number && document.activeElement !== number) number.value = String(values[key]);
    }
    // The bars of the hue and of the saturation are always in full colour too, so that a black or a white colour is never a dead end.
    if (this.sliders.hue) this.sliders.hue.style.background = `linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))`;
    if (this.sliders.sat) this.sliders.sat.style.background = `linear-gradient(to right, hsl(${h},0%,50%), hsl(${h},100%,50%))`;
    if (this.sliders.lum) this.sliders.lum.style.background = `linear-gradient(to right, #000000, hsl(${h},${s}%,50%), #ffffff)`;
    if (this.hex && updateHex) {
      this.hex.value = hex;
      this.hex.removeClass(`mod-error`);
    }
    if (this.fresh) this.fresh.style.background = this.options.fill ? swatchBackground(this.none ? null : { color: hex, style: this.style }) : hex;
    for (const b of this.patternButtons) b.el.toggleClass(`is-active`, !this.none && b.style === this.style);
    this.noneButton?.toggleClass(`is-active`, this.none);
  }

  // Draws the colour wheel at a luminance: the hue (angle) and the saturation (distance) at that luminance.
  private drawWheel(canvas: HTMLCanvasElement, luminance: number): void {
    const ctx = canvas.getContext(`2d`);
    if (!ctx) return;
    const image = ctx.createImageData(SIZE, SIZE);
    const disc = RADIUS * DISC;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x + 0.5 - RADIUS;
        const dy = y + 0.5 - RADIUS;
        const r = Math.hypot(dx, dy);
        if (r > disc) continue;
        const { h, s } = wheelToHs(dx, dy, disc);
        const rgb = hslToRgb({ h, s, l: luminance });
        const at = (y * SIZE + x) * 4;
        image.data[at] = rgb[0];
        image.data[at + 1] = rgb[1];
        image.data[at + 2] = rgb[2];
        image.data[at + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
}

// Adds a button that shows a colour and opens the colour window when it is used. Returns the button and a function that changes the colour it shows.
export function addColorSwatch(parent: HTMLElement, app: App, value: string, label: string, onPick: (hex: string) => void): { el: HTMLButtonElement; show: (color: string) => void } {
  const el = parent.createEl(`button`, { cls: `sketchnote-color-swatch` });
  el.setAttribute(`aria-label`, label);
  el.setAttribute(`title`, label);
  let current = toHex6(value);
  const show = (color: string): void => {
    current = toHex6(color);
    el.style.background = current;
    el.dataset.color = current;
  };
  show(value);
  el.addEventListener(`click`, () =>
    new ColorModal(app, current, (choice) => {
      if (choice.color === null) return;
      show(choice.color);
      onPick(choice.color);
    }).open(),
  );
  return { el, show };
}
