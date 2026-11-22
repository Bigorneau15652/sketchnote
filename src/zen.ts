// Zen mode: everything that distracts goes away. The menus of Obsidian are hidden (a style that depends on the class `sketchnote-zen` of the page of the window), and the window can go
// full screen. The page is one view where the whole page and the drawing of a zone are both at hand, so nothing else is needed: the same button, or the command Mode zen, brings
// everything back. Same idea as the mode zen of the plugin Bigorneau.
import { App, EventRef, Platform, WorkspaceLeaf } from "obsidian";
import type { ZenApi } from "./plugin-api";
import type { SketchnoteSettings } from "./settings";

// What the mode needs from the plugin.
export interface ZenHost {
  app: App;
  origins: Map<string, WorkspaceLeaf>;
  settings(): SketchnoteSettings;
  changeSettings(patch: Partial<SketchnoteSettings>): Promise<void>;
  registerEvent(ref: EventRef): void;
}

const ZEN_CLASS = `sketchnote-zen`;

export class ZenMode implements ZenApi {
  private on = false;

  constructor(private host: ZenHost) {}

  active(): boolean {
    return this.on;
  }

  async toggle(): Promise<void> {
    if (this.on) this.exit();
    else this.enter();
    // The buttons that show the mode are drawn again (the open views listen to the settings).
    void this.host.changeSettings({}).catch(() => undefined);
  }

  private enter(): void {
    // On a phone there is no window to isolate: the menus stay.
    if (Platform.isMobile) return;
    this.on = true;
    this.doc().body.toggleClass(ZEN_CLASS, true);
    if (this.host.settings().zenFullscreen) void this.doc().documentElement.requestFullscreen().catch(() => undefined);
  }

  private exit(): void {
    this.on = false;
    const doc = this.doc();
    doc.body.toggleClass(ZEN_CLASS, false);
    if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => undefined);
  }

  // The document of the main window.
  private doc(): Document {
    return this.host.app.workspace.containerEl.ownerDocument;
  }

  // Called when the plugin stops: the menus come back.
  stop(): void {
    if (this.on) this.exit();
  }
}
