// Zen mode: everything that distracts goes away. The menus of Obsidian are hidden (a style that depends on the class `sketchnote-zen` of the page of each window), the page of the sketchnote
// moves to a small floating window (a window of Obsidian of its own, that can be resized by its corners and moved to another screen, with its bottom bar), and the main window is left to
// the drawing: a double click on a zone in the floating window opens its drawing there. The same button, or the command Mode zen, brings everything back. Same idea as the mode zen of the
// plugin Bigorneau.
import { App, EventRef, Notice, Platform, TFile, WorkspaceLeaf } from "obsidian";
import { t } from "./i18n";
import { DRAW_VIEW_TYPE, SketchdrawView } from "./draw-view";
import type { ZenApi } from "./plugin-api";
import { readZenWindow, SketchnoteSettings, ZEN_DEFAULT_SIZE } from "./settings";
import { SketchnoteView, VIEW_TYPE } from "./view";

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
  private pageLeaf: WorkspaceLeaf | null = null;
  private pageFile: TFile | null = null;
  private target: WorkspaceLeaf | null = null;
  private watch: EventRef | null = null;
  private timer: number | null = null;
  private busy = false;

  constructor(private host: ZenHost) {}

  active(): boolean {
    return this.on;
  }

  // The leaf of the main window where the drawings open: the one that was chosen when the mode started, or the one that was used last in the main window.
  drawLeaf(): WorkspaceLeaf | null {
    if (!this.on) return null;
    const ws = this.host.app.workspace;
    const t0 = this.target;
    if (t0 && ws.getLeavesOfType(DRAW_VIEW_TYPE).includes(t0)) return t0;
    if (t0 && t0.getRoot() === ws.rootSplit) return t0;
    this.target = ws.getMostRecentLeaf(ws.rootSplit) ?? null;
    return this.target;
  }

  async toggle(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (this.on) await this.exit();
      else await this.enter();
    } finally {
      this.busy = false;
      // The buttons that show the mode are drawn again (the open drawings listen to the settings).
      void this.host.changeSettings({}).catch(() => undefined);
    }
  }

  // Starts the mode from a page, or from a drawing that was opened from a page.
  private async enter(): Promise<void> {
    const ws = this.host.app.workspace;
    if (Platform.isMobile) {
      new Notice(t(`Le mode zen n'est disponible que sur ordinateur.`));
      return;
    }
    const active = ws.getActiveViewOfType(SketchnoteView) ?? ws.getActiveViewOfType(SketchdrawView);
    let pageLeaf: WorkspaceLeaf | null = null;
    let drawLeaf: WorkspaceLeaf | null = null;
    if (active instanceof SketchnoteView) pageLeaf = active.leaf;
    else if (active instanceof SketchdrawView && active.file) {
      drawLeaf = active.leaf;
      pageLeaf = this.host.origins.get(active.file.path) ?? null;
    }
    const pageView = pageLeaf ? pageLeaf.view : null;
    if (!pageLeaf || !(pageView instanceof SketchnoteView) || !pageView.file || !ws.getLeavesOfType(VIEW_TYPE).includes(pageLeaf)) {
      new Notice(t(`Ouvrez une page sketchnote, ou un de ses dessins, pour passer en mode zen.`));
      return;
    }
    const file = pageView.file;
    await pageView.save();
    // The page goes to a floating window of its own, at the place and the size of the last time. A page that is already in a window of its own stays where it is.
    if (pageLeaf.getRoot() === ws.rootSplit) {
      const saved = readZenWindow(this.host.settings().zenWindow);
      try {
        ws.moveLeafToPopout(pageLeaf, saved ? { x: saved.x, y: saved.y, size: { width: saved.width, height: saved.height } } : { size: ZEN_DEFAULT_SIZE });
      } catch {
        new Notice(t(`La fenêtre flottante n'a pas pu s'ouvrir : le mode zen n'est pas disponible.`));
        return;
      }
    }
    this.pageLeaf = pageLeaf;
    this.pageFile = file;
    // The main window keeps the drawing that was open, or the leaf that the page left.
    this.target = drawLeaf ?? ws.getMostRecentLeaf(ws.rootSplit) ?? ws.createLeafInParent(ws.rootSplit, 0);
    this.on = true;
    this.setClass(true);
    if (this.host.settings().zenFullscreen) void this.host.app.workspace.containerEl.ownerDocument.documentElement.requestFullscreen().catch(() => undefined);
    // The mode ends by itself when the floating window is closed.
    this.watch = ws.on(`layout-change`, () => this.check());
    this.host.registerEvent(this.watch);
    if (drawLeaf) ws.setActiveLeaf(drawLeaf, { focus: true });
    else new Notice(t(`Mode zen : double-cliquez une zone dans la fenêtre flottante pour la dessiner ici.`));
  }

  // After a change of the layout: when the floating window was closed by hand, the mode ends.
  private check(): void {
    if (!this.on) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      const leaf = this.pageLeaf;
      if (this.on && leaf && !this.host.app.workspace.getLeavesOfType(VIEW_TYPE).includes(leaf)) void this.toggle();
    }, 400);
  }

  // Adds or removes the class that hides the menus of Obsidian, in the main window and in the floating one.
  private setClass(on: boolean): void {
    const docs = new Set<Document>([this.host.app.workspace.containerEl.ownerDocument]);
    const leaf = this.pageLeaf;
    if (leaf) docs.add(leaf.view.containerEl.ownerDocument);
    for (const doc of docs) doc.body.toggleClass(ZEN_CLASS, on);
  }

  // Ends the mode: the menus come back, the place of the floating window is kept, and the page opens again in the main window.
  private async exit(): Promise<void> {
    const ws = this.host.app.workspace;
    const leaf = this.pageLeaf;
    const file = this.pageFile;
    const draw = this.drawLeaf();
    this.on = false;
    if (this.watch) ws.offref(this.watch);
    this.watch = null;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.setClass(false);
    const doc = ws.containerEl.ownerDocument;
    if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => undefined);
    if (leaf && ws.getLeavesOfType(VIEW_TYPE).includes(leaf)) {
      // The place and the size of the floating window are kept for the next time.
      const win = leaf.view.containerEl.ownerDocument.defaultView;
      if (win && win !== doc.defaultView) {
        const found = readZenWindow({ x: win.screenX, y: win.screenY, width: win.outerWidth, height: win.outerHeight });
        if (found) void this.host.changeSettings({ zenWindow: found }).catch(() => undefined);
      }
      const view = leaf.view;
      if (view instanceof SketchnoteView) await view.save();
      leaf.detach();
    }
    this.pageLeaf = null;
    this.pageFile = null;
    this.target = null;
    if (file) {
      if (draw) ws.setActiveLeaf(draw, { focus: true });
      const back = ws.getLeaf(`tab`);
      await back.openFile(file);
      ws.setActiveLeaf(back, { focus: true });
    }
  }

  // Called when the plugin stops: the menus come back.
  stop(): void {
    if (this.on) void this.exit();
  }
}
