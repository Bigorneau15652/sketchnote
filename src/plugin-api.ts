// What the views need from the plugin, as an interface (so that the views do not import the plugin file, which imports them).
import type { WorkspaceLeaf } from "obsidian";
import type { DrawingStore } from "./drawings";
import type { ExportServices } from "./export-service";
import type { FontStore } from "./font-store";
import type { IconSource } from "./icon-store";
import type { SketchnoteSettings } from "./settings";

// Zen mode, as the views see it.
export interface ZenApi {
  active(): boolean;
  // The leaf of the main window where the drawings open while the mode is on (null when it is off).
  drawLeaf(): WorkspaceLeaf | null;
  toggle(): Promise<void>;
}

export interface PluginApi {
  drawings: DrawingStore;
  // The fonts of the texts.
  fonts: FontStore;
  // The icons that can be inserted: Lucide, and the SVG drawings of the user.
  icons: IconSource;
  // What the exports need: the folder, saving, the link in a note, the fonts and the pictures.
  exports: ExportServices;
  // Zen mode: the page in a floating window, everything else for the drawing.
  zen: ZenApi;
  settings(): SketchnoteSettings;
  // Changes some settings and saves them; every open drawing is told (to draw its buttons again).
  updateSettings(patch: Partial<SketchnoteSettings>): Promise<void>;
  onSettings(listener: () => void): () => void;
  // For each drawing note that was opened from a page, the tab of that page, so that the Back button of the drawing can return to it.
  origins: Map<string, WorkspaceLeaf>;
}
