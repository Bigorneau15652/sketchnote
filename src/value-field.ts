// A field of the menu, like those of the bar of Affinity: a pictogram, the value with its unit, and a small arrow that opens a list of usual values. A double click on the value lets
// the user type the value by hand (Enter keeps it, Escape leaves it). The name of the field is its tooltip, written once.
import { Menu, setIcon } from "obsidian";
import { parseFieldValue, showFieldValue } from "./field-values";

export interface ValueFieldOptions {
  parent: HTMLElement;
  // The pictogram of the field, or an empty text for none.
  icon: string;
  // The tooltip (the only text of the field).
  tooltip: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  presets: number[];
  // Called with the new value when the user chooses one in the list or types one.
  onChange: (value: number) => void;
  className?: string;
  // Two small buttons, a minus on the left and a plus on the right, that take the value down or up by one step.
  stepButtons?: boolean;
}

export interface ValueField {
  el: HTMLElement;
  input: HTMLInputElement;
  // Shows a value (unless the user is typing in the field).
  set(value: number): void;
}

export function valueField(o: ValueFieldOptions): ValueField {
  const el = o.parent.createDiv({ cls: `sketchdraw-field${o.className ? ` ${o.className}` : ``}` });
  el.setAttribute(`aria-label`, o.tooltip);
  const minus = o.stepButtons ? el.createEl(`button`, { cls: `sketchdraw-field-step` }) : null;
  if (minus) {
    setIcon(minus, `minus`);
    minus.setAttribute(`aria-label`, `${o.tooltip} : -`);
  }
  if (o.icon !== ``) {
    const icon = el.createSpan({ cls: `sketchdraw-field-icon` });
    setIcon(icon, o.icon);
  }
  const input = el.createEl(`input`, { cls: `sketchdraw-field-input`, type: `text` });
  input.readOnly = true;
  input.setAttribute(`aria-label`, o.tooltip);
  const arrow = el.createEl(`button`, { cls: `sketchdraw-field-arrow` });
  setIcon(arrow, `chevron-down`);
  arrow.setAttribute(`aria-label`, o.tooltip);
  const plus = o.stepButtons ? el.createEl(`button`, { cls: `sketchdraw-field-step` }) : null;
  if (plus) {
    setIcon(plus, `plus`);
    plus.setAttribute(`aria-label`, `${o.tooltip} : +`);
  }
  let current = o.min;
  let editing = false;
  const show = (): void => {
    input.value = showFieldValue(current, o.unit);
  };
  const stopEditing = (keep: boolean): void => {
    if (!editing) return;
    editing = false;
    input.readOnly = true;
    input.removeClass(`is-editing`);
    if (keep) {
      const v = parseFieldValue(input.value, o.min, o.max, o.step);
      if (v !== null && v !== current) {
        current = v;
        o.onChange(v);
      }
    }
    show();
  };
  input.addEventListener(`dblclick`, () => {
    editing = true;
    input.readOnly = false;
    input.addClass(`is-editing`);
    input.value = String(current);
    input.select();
  });
  input.addEventListener(`keydown`, (e) => {
    if (!editing) return;
    e.stopPropagation();
    if (e.key === `Enter`) {
      e.preventDefault();
      stopEditing(true);
    } else if (e.key === `Escape`) {
      e.preventDefault();
      stopEditing(false);
    }
  });
  input.addEventListener(`blur`, () => stopEditing(true));
  // The buttons take the value down or up by one step, inside its limits.
  const nudge = (direction: number): void => {
    if (editing) stopEditing(true);
    const next = Math.round(Math.min(o.max, Math.max(o.min, current + direction * o.step)) * 10000) / 10000;
    if (next === current) return;
    current = next;
    show();
    o.onChange(next);
  };
  minus?.addEventListener(`click`, () => nudge(-1));
  plus?.addEventListener(`click`, () => nudge(1));
  arrow.addEventListener(`click`, (e) => {
    const menu = new Menu();
    for (const value of o.presets) {
      menu.addItem((item) =>
        item
          .setTitle(showFieldValue(value, o.unit))
          .setChecked(value === current)
          .onClick(() => {
            current = value;
            show();
            o.onChange(value);
          }),
      );
    }
    menu.showAtMouseEvent(e);
  });
  show();
  return {
    el,
    input,
    set(value: number) {
      current = value;
      if (!editing) show();
    },
  };
}
