// The window of the little man: a floating window, in the drawing, that can be moved by its top bar. On its left all the choices of the character, each one a large pictogram, grouped by
// kind; on its right the result, drawn as it will be on the page, which changes as soon as a choice is made. The button OK puts the character on the page (or changes the one that
// is being edited), Cancel closes the window.
import { setIcon } from "obsidian";
import { drawElement, PLAIN } from "./element-render";
import { BUILD_IDS, buildName, DEFAULT_FIGURE_SIZE, extrasOf, FACE_IDS, faceName, figureElementOf, FigureData, figureName, LOOK_IDS, lookName, POSE_IDS, poseJoints, PoseId } from "./figure";
import { BOTTOM_IDS, bottomName, ITEM_IDS, itemName, TOP_IDS, topName } from "./figure-items";
import { t } from "./i18n";
import { partName } from "./portrait";
import { svgEl } from "./svg";
import { FIELD_KINDS, presetValues } from "./field-values";
import { valueField } from "./value-field";

export interface FigureWindowOptions {
  // The element of the drawing that holds the window.
  parent: HTMLElement;
  // The choices at the start, and whether an existing character is being changed.
  initial: FigureData;
  editing: boolean;
  // The colour of the line, and the seed of the wobble (so that the character on the page looks like the one in the window).
  ink: string;
  seed: number;
  // The imperfection (0 to 5) and the thickness of the line.
  roughness: number;
  strokeWidth: number;
  // Called with the choices and the line when OK is pressed, and when the window closes.
  onOk: (data: FigureData, pose: PoseId, line: { roughness: number; strokeWidth: number }) => void;
  onClose: () => void;
}

// Where the user left the window (kept while the application runs).
let lastPosition: { left: number; top: number } | null = null;

type FigureKey = `pose` | `face` | `look` | `sex` | `build` | `itemL` | `itemR` | `top` | `bottom`;

interface Group {
  key: FigureKey;
  title: string;
  ids: readonly string[];
  icon: (id: string) => string;
  name: (id: string) => string;
}

function groups(): Group[] {
  const items = (key: `itemL` | `itemR`, title: string): Group => ({ key, title, ids: ITEM_IDS, icon: (id) => `sketchnote-item-${id}`, name: (id) => itemName(id as never) });
  return [
    { key: `pose`, title: t(`Pose`), ids: POSE_IDS, icon: (id) => `sketchnote-pose-${id}`, name: (id) => figureName(id as never) },
    { key: `face`, title: t(`Expression`), ids: FACE_IDS, icon: (id) => `sketchnote-face-${id}`, name: (id) => faceName(id as never) },
    { key: `look`, title: t(`Direction du visage`), ids: LOOK_IDS, icon: (id) => `sketchnote-look-${id}`, name: (id) => lookName(id as never) },
    { key: `sex`, title: t(`Homme ou femme`), ids: [`man`, `woman`], icon: (id) => `sketchnote-part-sex-${id}`, name: (id) => partName(`sex`, id) },
    { key: `build`, title: t(`Corps`), ids: BUILD_IDS, icon: (id) => `sketchnote-build-${id}`, name: (id) => buildName(id as never) },
    items(`itemL`, t(`Objet dans la main gauche`)),
    items(`itemR`, t(`Objet dans la main droite`)),
    { key: `top`, title: t(`Habit du haut`), ids: TOP_IDS, icon: (id) => `sketchnote-top-${id}`, name: (id) => topName(id as never) },
    { key: `bottom`, title: t(`Habit du bas`), ids: BOTTOM_IDS, icon: (id) => `sketchnote-bottom-${id}`, name: (id) => bottomName(id as never) },
  ];
}

export class FigureWindow {
  private el: HTMLElement | null = null;
  private data: FigureData;
  // The pose that was clicked last (the joints are kept as they are until another pose is clicked).
  private pose: PoseId = `stand`;
  private roughness: number;
  private strokeWidth: number;
  private preview: SVGGElement | null = null;
  private readonly buttons: { key: FigureKey; id: string; el: HTMLElement }[] = [];

  constructor(private opts: FigureWindowOptions) {
    this.data = { ...opts.initial, ...extrasOf(opts.initial) };
    this.roughness = opts.roughness;
    this.strokeWidth = opts.strokeWidth;
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
    head.createSpan({ cls: `sketchnote-portrait-title`, text: this.opts.editing ? t(`Modifier le bonhomme`) : t(`Créer un bonhomme`) });
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
    // The line: its imperfection (0 for a clean line) and its thickness, with a minus and a plus.
    const line = side.createDiv({ cls: `sketchnote-portrait-line` });
    const rough = FIELD_KINDS[`Imperfection`];
    const width = FIELD_KINDS[`Épaisseur`];
    const roughField = valueField({ parent: line, icon: rough.icon, tooltip: t(`Imperfection du tracé : 0 pour un trait net`), min: 0, max: 50, step: 1, unit: rough.unit, presets: presetValues(0, 50, 1), stepButtons: true, onChange: (v) => { this.roughness = v / 10; this.refresh(); } });
    roughField.set(Math.round(this.roughness * 10));
    // The thickness is in tenths of a pixel: a character is a fine drawing, a line of 1 pixel is already a strong one (10 here), and the field goes from 2 to 40.
    const widthField = valueField({ parent: line, icon: width.icon, tooltip: t(`Épaisseur du trait, en dixièmes de pixel`), min: 2, max: 40, step: 1, unit: ``, presets: presetValues(2, 40, 1), stepButtons: true, onChange: (v) => { this.strokeWidth = v / 10; this.refresh(); } });
    widthField.set(Math.round(this.strokeWidth * 10));
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
    this.opts.onOk(data, this.pose, { roughness: this.roughness, strokeWidth: this.strokeWidth });
    this.close();
  }

  // Draws a group of choices: its title, then a pictogram for each choice.
  private drawGroup(parent: HTMLElement, group: Group): void {
    const box = parent.createDiv({ cls: `sketchnote-portrait-group` });
    box.createDiv({ cls: `sketchnote-portrait-group-title`, text: group.title });
    const grid = box.createDiv({ cls: `sketchnote-portrait-grid` });
    for (const id of group.ids) {
      const b = grid.createEl(`button`, { cls: `sketchnote-portrait-option` });
      setIcon(b, group.icon(id));
      b.setAttribute(`aria-label`, group.name(id));
      b.setAttribute(`title`, group.name(id));
      b.addEventListener(`click`, () => {
        if (group.key === `pose`) {
          this.pose = id as PoseId;
          this.data = { ...this.data, joints: poseJoints(this.pose) };
        } else if (group.key === `build`) this.data = { ...this.data, build: id as never };
        else this.data = { ...this.data, [group.key]: id } as FigureData;
        this.refresh();
      });
      this.buttons.push({ key: group.key, id, el: b });
    }
  }

  // Lights the choices that are made and draws the result again.
  private refresh(): void {
    for (const b of this.buttons) b.el.toggleClass(`is-active`, b.key === `pose` ? this.pose === b.id : this.data[b.key] === b.id);
    const g = this.preview;
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    // The preview is 100 wide where the figure is larger: its line is thinner in the same proportion.
    const made = figureElementOf(this.data, this.pose, [50, 50], 100, { stroke: this.opts.ink, strokeWidth: (this.strokeWidth * 100) / DEFAULT_FIGURE_SIZE, roughness: this.roughness, seed: this.opts.seed }, `preview`);
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
