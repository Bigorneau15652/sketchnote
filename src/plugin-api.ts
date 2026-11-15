// What the views need from the plugin, as an interface (so that the views do not import the plugin file, which imports them).
import type { WorkspaceLeaf } from "obsidian";
import type { DrawingStore } from "./drawings";
import type { ExportServices } from "./export-service";
import type { FontStore } from "./font-store";
import type { IconSource } from "./icon-store";
import type { SketchnoteSettings } from "./settings";

export interface PluginApi {
  drawings: DrawingStore;
  // The fonts of the texts.
  fonts: FontStore;
  // The icons that can be inserted: Lucide, and the SVG drawings of the user.
  icons: IconSource;
  // What the exports need: the folder, saving, the link in a note, the fonts and the pictures.
  exports: ExportServices;
  settings(): SketchnoteSettings;
  // For each drawing note that was opened from a page, the tab of that page, so that the Back button of the drawing can return to it.
  origins: Map<string, WorkspaceLeaf>;
}
