// The hotkeys that the user gave to the commands of the plugin in the settings of Obsidian (Hotkeys): they are read to be shown next to the functions, never set here. Obsidian says
// itself when a hotkey is already used, so the plugin does not keep any of its own for the functions that are commands of the palette.
import type { App } from "obsidian";

export interface HotkeyData {
  modifiers: string[];
  key: string;
}

// Writes one hotkey as text: the modifiers in the usual order, then the key (a letter in capitals). Mod is Ctrl, or Cmd on a Mac.
export function formatHotkey(hotkey: HotkeyData, mac: boolean, shiftLabel = `Shift`): string {
  const names: Record<string, string> = { Mod: mac ? `Cmd` : `Ctrl`, Ctrl: `Ctrl`, Alt: mac ? `Option` : `Alt`, Shift: shiftLabel, Meta: mac ? `Cmd` : `Win` };
  const order = [`Mod`, `Ctrl`, `Alt`, `Shift`, `Meta`];
  const mods = order.filter((m) => hotkey.modifiers.includes(m)).map((m) => names[m]);
  const key = hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key;
  return [...mods, key].join(`+`);
}

// Writes the hotkeys of a command (none gives an empty text).
export function formatHotkeys(list: HotkeyData[], mac: boolean, shiftLabel = `Shift`): string {
  return list
    .filter((h) => typeof h.key === `string` && h.key !== `` && Array.isArray(h.modifiers))
    .map((h) => formatHotkey(h, mac, shiftLabel))
    .join(`, `);
}

interface HotkeyManagerLike {
  getHotkeys?: (id: string) => HotkeyData[] | undefined;
  getDefaultHotkeys?: (id: string) => HotkeyData[] | undefined;
}

// Returns the hotkeys of a command as they are set in Obsidian: the ones the user chose, else the ones the command comes with. Nothing is written when the application does not give
// them (the text is then empty).
export function commandHotkeyText(app: App, commandId: string, shiftLabel = `Shift`): string {
  try {
    const manager = (app as unknown as { hotkeyManager?: HotkeyManagerLike }).hotkeyManager;
    if (!manager) return ``;
    const chosen = manager.getHotkeys?.(commandId);
    const list = chosen !== undefined ? chosen : manager.getDefaultHotkeys?.(commandId) ?? [];
    const mac = typeof navigator !== `undefined` && /mac/i.test(navigator.platform);
    return formatHotkeys(list, mac, shiftLabel);
  } catch {
    return ``;
  }
}

// The identifier that Obsidian gives to a command of the drawer for a function.
export function functionCommandId(id: string): string {
  return `sketchnote:draw-function-${id}`;
}
