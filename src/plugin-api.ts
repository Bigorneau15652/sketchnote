// What the views need from the plugin, as an interface (so that the views do not import the plugin file, which imports them).
import type { WorkspaceLeaf } from "obsidian";
import type { DrawingStore } from "./drawings";
import type { FontStore } from "./font-store";
import type { SketchnoteSettings } from "./settings";

export interface PluginApi {
  drawings: DrawingStore;
  // The fonts of the texts.
  fonts: FontStore;
  settings(): SketchnoteSettings;
  // For each drawing note that was opened from a page, the tab of that page, so that the Back button of the drawing can return to it.
  origins: Map<string, WorkspaceLeaf>;
}
