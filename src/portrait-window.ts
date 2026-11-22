// The window of the character: a floating window, in the drawing, that can be moved by its top bar. On its left all the choices of the character, each one a large pictogram, grouped by
// kind; on its right the result, drawn as it will be on the page, which changes as soon as a choice is made. The button OK puts the character on the page (or changes the one that
// is being edited), Cancel closes the window.
import { setIcon } from "obsidian";
import { drawElement, PLAIN } from "./element-render";
import { faceName, FACE_IDS, LOOK_IDS, lookName } from "./figure";
import { t } from "./i18n";
import { hairColorName, hatColorName, HAIR_COLOR_IDS, HAT_COLOR_IDS, partLabel, partName, PARTS, PortraitData, portraitElement, PortraitKey, SKIN_IDS, skinName } from "./portrait";
import { svgEl } from "./svg";

export interface PortraitWindowOptions {
  // The element of the drawing that holds the window.
  parent: HTMLElement;
  // The choices at the start, and whether an existing character is being changed.
  initial: PortraitData;
  editing: boolean;
  // The colour of the line, and the seed of the wobble (so that the character on the page looks like the one in the window).
  ink: string;
  seed: number;
  // Called with the choices when OK is pressed, and when the window closes.
  onOk: (data: PortraitData) => void;
  onClose: () => void;
}

// Where the user left the window (kept while the application runs).
let lastPosition: { left: number; top: number } | null = null;

interface Group {
  key: PortraitKey;
  title: string;
  ids: readonly string[];
  icon: (id: string) => string;
  name: (id: string) => string;
  // A group of colours is drawn with larger round discs.
  disc?: boolean;
}

function groups(): Group[] {
  const part = (key: PortraitKey): Group => {
    const found = PARTS.find((p) => p.key === key);
    return { key, title: partLabel(key), ids: found ? found.ids : [], icon: (id) => `sketchnote-part-${key}-${id}`, name: (id) => partName(key, id) };
  };
  return [
    { key: `face`, title: t(`Expression`), ids: FACE_IDS, icon: (id) => `sketchnote-face-${id}`, name: (id) => faceName(id as never) },
    { key: `look`, title: partLabel(`look`), ids: LOOK_IDS, icon: (id) => `sketchnote-look-${id}`, name: (id) => lookName(id as never) },
    part(`sex`),
    { key: `skin`, title: partLabel(`skin`), ids: SKIN_IDS, icon: (id) => `sketchnote-skin-${id}`, name: (id) => skinName(id as never), disc: true },
    part(`shape`),
    part(`hair`),
    { key: `haircolor`, title: partLabel(`haircolor`), ids: HAIR_COLOR_IDS, icon: (id) => `sketchnote-haircolor-${id}`, name: (id) => hairColorName(id as never), disc: true },
    part(`hat`),
    { key: `hatcolor`, title: partLabel(`hatcolor`), ids: HAT_COLOR_IDS, icon: (id) => `sketchnote-hatcolor-${id}`, name: (id) => hatColorName(id as never), disc: true },
    part(`beard`),
    part(`nose`),
    part(`glasses`),
    part(`earrings`),
  ];
}

export class PortraitWindow {
  private el: HTMLElement | null = null;
  private data: PortraitData;
  private preview: SVGGElement | null = null;
  private readonly buttons: { key: PortraitKey; id: string; el: HTMLElement }[] = [];

  constructor(private opts: PortraitWindowOptions) {
    this.data = { ...opts.initial };
  }

  // Shows the window, in the middle of the drawing or where it was left.
  open(): void {
    const win = this.opts.parent.createDiv({ cls: `sketchnote-portrait-window` });
    this.el = win;
    win.setAttribute(`tabindex`, `-1`);
    win.setAttribute(`role`, `dialog`);
    // The keys typed in the window are its own: they never choose a tool of the drawing.
    win.addEventListener(`keydown`, (e) => {
      e.stopPropagation();
      if (e.key === `Escape`) {
        e.preventDefault();
        this.close();
      } else if (e.key === `Enter`) {
        e.preventDefault();
        this.ok();
      }
    });
    // What happens in the window stays in the window: the drawing under it does not see the clicks, the wheel or the keys.
    for (const type of [`pointerdown`, `pointerup`, `mousedown`, `mouseup`, `click`, `dblclick`, `wheel`, `contextmenu`, `paste`]) win.addEventListener(type, (e) => e.stopPropagation());
    const head = win.createDiv({ cls: `sketchnote-portrait-head` });
    head.createSpan({ cls: `sketchnote-portrait-title`, text: this.opts.editing ? t(`Modifier le personnage`) : t(`Créer un personnage`) });
    const closeButton = head.createEl(`button`, { cls: `sketchnote-portrait-close` });
    setIcon(closeButton, `x`);
    closeButton.setAttribute(`aria-label`, t(`Annuler`));
    closeButton.addEventListener(`click`, () => this.close());
    const body = win.createDiv({ cls: `sketchnote-portrait-body` });
    const options = body.createDiv({ cls: `sketchnote-portrait-options` });
    for (const group of groups()) this.drawGroup(options, group);
    const side = body.createDiv({ cls: `sketchnote-portrait-side` });
    const svg = svgEl(`svg`, { viewBox: `0 0 100 100`, class: `sketchnote-portrait-preview`, preserveAspectRatio: `xMidYMid meet` }, side);
    this.preview = svgEl(`g`, {}, svg) as SVGGElement;
    const foot = side.createDiv({ cls: `sketchnote-portrait-foot` });
    const cancel = foot.createEl(`button`, { text: t(`Annuler`) });
    cancel.addEventListener(`click`, () => this.close());
    const ok = foot.createEl(`button`, { cls: `mod-cta`, text: t(`OK`) });
    ok.addEventListener(`click`, () => this.ok());
    this.refresh();
    this.place(win);
    this.drag(head, win);
    win.focus({ preventScroll: true });
  }

  // Closes the window.
  close(): void {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    this.opts.onClose();
  }

  // The result is kept and the window closes.
  private ok(): void {
    const data = { ...this.data };
    this.opts.onOk(data);
    this.close();
  }

  // Draws a group of choices: its title, then a pictogram for each choice.
  private drawGroup(parent: HTMLElement, group: Group): void {
    const box = parent.createDiv({ cls: `sketchnote-portrait-group` });
    box.createDiv({ cls: `sketchnote-portrait-group-title`, text: group.title });
    const grid = box.createDiv({ cls: `sketchnote-portrait-grid${group.disc ? ` is-disc` : ``}` });
    for (const id of group.ids) {
      const b = grid.createEl(`button`, { cls: `sketchnote-portrait-option` });
      setIcon(b, group.icon(id));
      b.setAttribute(`aria-label`, group.name(id));
      b.setAttribute(`title`, group.name(id));
      b.addEventListener(`click`, () => {
        this.data = { ...this.data, [group.key]: id } as PortraitData;
        this.refresh();
      });
      this.buttons.push({ key: group.key, id, el: b });
    }
  }

  // Lights the choices that are made and draws the result again.
  private refresh(): void {
    for (const b of this.buttons) b.el.toggleClass(`is-active`, this.data[b.key] === b.id);
    const g = this.preview;
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const made = portraitElement(this.data, [50, 50], 100, { stroke: this.opts.ink, strokeWidth: 3, roughness: 1, seed: this.opts.seed }, `preview`);
    try {
      drawElement(made, g, { ...PLAIN, ink: this.opts.ink });
    } catch {
      // The preview is only a help: the window stays usable.
    }
  }

  // Puts the window in the middle of the drawing, or where it was left, inside the drawing.
  private place(win: HTMLElement): void {
    const host = this.opts.parent.getBoundingClientRect();
    const left = lastPosition ? lastPosition.left : Math.round((host.width - win.offsetWidth) / 2);
    const top = lastPosition ? lastPosition.top : Math.round((host.height - win.offsetHeight) / 2);
    this.move(win, left, top);
  }

  private move(win: HTMLElement, left: number, top: number): void {
    const host = this.opts.parent.getBoundingClientRect();
    const x = Math.max(0, Math.min(Math.max(0, host.width - win.offsetWidth), left));
    const y = Math.max(0, Math.min(Math.max(0, host.height - win.offsetHeight), top));
    win.style.left = `${Math.round(x)}px`;
    win.style.top = `${Math.round(y)}px`;
    lastPosition = { left: Math.round(x), top: Math.round(y) };
  }

  // The top bar moves the window.
  private drag(handle: HTMLElement, win: HTMLElement): void {
    handle.addEventListener(`pointerdown`, (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(`button`)) return;
      e.preventDefault();
      win.focus({ preventScroll: true });
      handle.setPointerCapture(e.pointerId);
      const dx = e.clientX - win.offsetLeft;
      const dy = e.clientY - win.offsetTop;
      const go = (m: PointerEvent): void => this.move(win, m.clientX - dx, m.clientY - dy);
      const stop = (): void => {
        handle.removeEventListener(`pointermove`, go);
        handle.removeEventListener(`pointerup`, stop);
        handle.removeEventListener(`pointercancel`, stop);
      };
      handle.addEventListener(`pointermove`, go);
      handle.addEventListener(`pointerup`, stop);
      handle.addEventListener(`pointercancel`, stop);
    });
  }
}
