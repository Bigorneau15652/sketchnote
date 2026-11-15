// The list of the buttons on the right of a drawing: for each function a handle to move it, its pictogram, its name, a question mark that opens a short explanation and a box to show or
// hide it; separations can be added between two groups and removed. It is used by the window of the first button of the column and by the settings of the plugin, and every change is
// saved at once (the open drawings draw their column again). Same idea as the list of buttons of the plugin Bigorneau.
import { App, Modal, setIcon } from "obsidian";
import { t } from "./i18n";
import { addSeparator, drawFunctions, DrawFunction, isSeparator, moveEntry, removeEntry, setHidden } from "./draw-functions";

export interface ButtonsHost {
  app: App;
  order(): string[];
  hidden(): string[];
  save(order: string[], hidden: string[]): Promise<void>;
}

// The window that explains what a function does.
export class ButtonHelpModal extends Modal {
  constructor(app: App, private fn: DrawFunction) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.fn.name());
    this.modalEl.addClass(`sketchnote-function-help`);
    const head = this.contentEl.createDiv({ cls: `sketchnote-function-help-icon` });
    setIcon(head, this.fn.icon);
    for (const paragraph of this.fn.help()) this.contentEl.createEl(`p`, { text: paragraph });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// Draws the list in an element. It draws itself again after each change.
export function renderDrawButtonList(el: HTMLElement, host: ButtonsHost): void {
  const list = el.createDiv({ cls: `sketchnote-buttons-list` });
  const functions = drawFunctions();
  const draw = (): void => {
    list.empty();
    const order = host.order();
    const hidden = host.hidden();
    const rows: { id: string; el: HTMLElement }[] = [];
    for (const id of order) {
      const fn = functions.find((f) => f.id === id);
      const separator = isSeparator(id);
      if (!separator && !fn) continue;
      const row = list.createDiv({ cls: `sketchnote-buttons-row` });
      rows.push({ id, el: row });
      const handle = row.createDiv({ cls: `sketchnote-buttons-handle` });
      setIcon(handle, `grip-vertical`);
      handle.setAttribute(`aria-label`, t(`Glisser pour déplacer`));
      grab(handle, row, id, rows, list, host, draw);
      if (separator || !fn) {
        row.addClass(`is-separator`);
        row.createSpan({ cls: `sketchnote-buttons-name`, text: t(`Séparation`) });
        const remove = row.createEl(`button`, { cls: `sketchnote-buttons-help` });
        setIcon(remove, `trash-2`);
        remove.setAttribute(`aria-label`, t(`Supprimer la séparation`));
        remove.addEventListener(`click`, () => void host.save(removeEntry(order, id), hidden).then(draw));
        continue;
      }
      const icon = row.createDiv({ cls: `sketchnote-buttons-icon` });
      setIcon(icon, fn.icon);
      row.createSpan({ cls: `sketchnote-buttons-name`, text: fn.name() });
      const help = row.createEl(`button`, { cls: `sketchnote-buttons-help`, text: `?` });
      help.setAttribute(`aria-label`, t(`Que fait cette fonction ?`));
      help.addEventListener(`click`, () => new ButtonHelpModal(host.app, fn).open());
      const box = row.createEl(`input`, { cls: `sketchnote-buttons-check`, type: `checkbox` });
      box.checked = !hidden.includes(id);
      box.setAttribute(`aria-label`, t(`Afficher ce bouton`));
      box.addEventListener(`change`, () => void host.save(order, setHidden(hidden, id, !box.checked)).then(draw));
    }
    const add = list.createEl(`button`, { cls: `sketchnote-buttons-add` });
    setIcon(add, `separator-horizontal`);
    add.createSpan({ text: t(`Ajouter une séparation`) });
    add.addEventListener(`click`, () => void host.save(addSeparator(order), hidden).then(draw));
  };
  draw();
}

// A row is moved with the pointer: it follows the pointer, a line shows where it will be dropped, and the new order is saved when it is released.
function grab(handle: HTMLElement, row: HTMLElement, id: string, rows: { id: string; el: HTMLElement }[], list: HTMLElement, host: ButtonsHost, redraw: () => void): void {
  let startY = 0;
  let target = 0;
  let moving = false;
  const others = (): { id: string; el: HTMLElement }[] => rows.filter((r) => r.id !== id);
  const clear = (): void => {
    for (const r of rows) r.el.removeClasses([`is-drop-before`, `is-drop-after`]);
  };
  handle.addEventListener(`pointerdown`, (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    moving = true;
    startY = e.clientY;
    target = host.order().indexOf(id);
    handle.setPointerCapture(e.pointerId);
    row.addClass(`is-moving`);
  });
  handle.addEventListener(`pointermove`, (e) => {
    if (!moving) return;
    row.style.transform = `translateY(${e.clientY - startY}px)`;
    const rest = others();
    target = rest.filter((r) => {
      const box = r.el.getBoundingClientRect();
      return box.top + box.height / 2 < e.clientY;
    }).length;
    clear();
    if (rest.length === 0) return;
    if (target < rest.length) rest[target].el.addClass(`is-drop-before`);
    else rest[rest.length - 1].el.addClass(`is-drop-after`);
  });
  const finish = (commit: boolean): void => {
    if (!moving) return;
    moving = false;
    clear();
    row.removeClass(`is-moving`);
    row.style.removeProperty(`transform`);
    if (!commit) return;
    const order = host.order();
    // The target counts the rows of the list; the order has the same entries in the same sequence, so the index is the same.
    const next = moveEntry(order, id, target);
    if (next.join() !== order.join()) void host.save(next, host.hidden()).then(redraw);
  };
  handle.addEventListener(`pointerup`, () => finish(true));
  handle.addEventListener(`pointercancel`, () => finish(false));
  void list;
}

// The window of the first button of the column.
export class DrawButtonsModal extends Modal {
  constructor(app: App, private host: ButtonsHost) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t(`Boutons du dessinateur`));
    this.modalEl.addClass(`sketchnote-buttons-modal`);
    this.contentEl.createEl(`p`, { cls: `sketchnote-icons-info`, text: t(`Cochez les boutons à afficher à droite du dessin. Glissez la poignée d'une ligne pour changer l'ordre, ajoutez des séparations entre les groupes, et ouvrez le point d'interrogation pour savoir ce que fait une fonction.`) });
    renderDrawButtonList(this.contentEl, this.host);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
