// The icons that can be inserted in a drawing: the icons of Lucide that Obsidian holds, and the SVG drawings that the user keeps in a folder of the vault (a sub folder is a theme).
// The drawings of the folder are read when the window of the icons opens, and again only when a file changed.
import { App, getIcon, getIconIds, TFile } from "obsidian";
import { IconData, MAX_ICON_TEXT, parseIconSvg } from "./icon-svg";
import { lucideData, setLucideSource } from "./icon-registry";
import { IconEntry, lucideEntries } from "./icon-themes";

// What the window of the icons needs.
export interface IconSource {
  // Every icon that can be offered.
  entries(): IconEntry[];
  // The drawing of an icon, or null when it cannot be read.
  dataOf(entry: IconEntry): IconData | null;
  // Reads the folder of the user again.
  refresh(): Promise<void>;
  // The files of the folder of the user that cannot be used, with the reason.
  problems: string[];
  // The folder of the user.
  folder(): string;
}

// The theme of a drawing that is directly in the folder of the user.
export const OWN_THEME = `Mes dessins`;
// The most files that are read from the folder of the user.
const MAX_FILES = 1500;

// Reads an icon of Lucide from Obsidian: its SVG, as text, is read by the same reader as the files of the user.
function readLucide(name: string): IconData | null {
  const svg = getIcon(`lucide-${name}`) ?? getIcon(name);
  if (!svg) return null;
  return parseIconSvg(new XMLSerializer().serializeToString(svg));
}

export class IconStore implements IconSource {
  problems: string[] = [];
  private lucide: IconEntry[] | null = null;
  private mine: { entry: IconEntry; data: IconData; mtime: number }[] = [];
  private known = new Map<string, { mtime: number; entry: IconEntry | null; data: IconData | null; problem: string | null }>();

  constructor(private app: App, private folderOf: () => string) {}

  // Gives the reader of the icons of Lucide to the drawing of the elements.
  start(): void {
    setLucideSource(readLucide);
  }

  // The folder of the user.
  folder(): string {
    return this.folderOf();
  }

  // The icons of Lucide, then the ones of the user.
  entries(): IconEntry[] {
    if (!this.lucide) this.lucide = lucideEntries(getIconIds());
    return [...this.lucide, ...this.mine.map((m) => m.entry)];
  }

  // The drawing of an icon.
  dataOf(entry: IconEntry): IconData | null {
    if (entry.source === `lucide`) return lucideData(entry.name);
    return this.mine.find((m) => m.entry.name === entry.name)?.data ?? null;
  }

  // Reads the SVG files of the folder of the user: those that did not change since the last time are not read again.
  async refresh(): Promise<void> {
    const folder = this.folderOf();
    const files = this.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(`${folder}/`) && f.extension.toLowerCase() === `svg`)
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, MAX_FILES);
    const seen = new Set<string>();
    for (const file of files) {
      seen.add(file.path);
      const before = this.known.get(file.path);
      if (before && before.mtime === file.stat.mtime) continue;
      this.known.set(file.path, await this.read(file, folder));
    }
    for (const path of [...this.known.keys()]) if (!seen.has(path)) this.known.delete(path);
    this.mine = [];
    this.problems = [];
    for (const [path, k] of this.known) {
      if (k.entry && k.data) this.mine.push({ entry: k.entry, data: k.data, mtime: k.mtime });
      else if (k.problem) this.problems.push(`${path} : ${k.problem}`);
    }
  }

  // Reads one file of the folder of the user.
  private async read(file: TFile, folder: string): Promise<{ mtime: number; entry: IconEntry | null; data: IconData | null; problem: string | null }> {
    const mtime = file.stat.mtime;
    if (file.stat.size > MAX_ICON_TEXT) return { mtime, entry: null, data: null, problem: `fichier trop gros` };
    try {
      const data = parseIconSvg(await this.app.vault.cachedRead(file));
      if (!data || data.shapes.length === 0) return { mtime, entry: null, data: null, problem: `aucune forme que le plugin sache dessiner` };
      const relative = file.path.slice(folder.length + 1).split(`/`);
      const theme = relative.length > 1 ? relative[0] : OWN_THEME;
      const entry: IconEntry = { name: file.path, source: `custom`, label: file.basename, themes: [theme] };
      return { mtime, entry, data, problem: null };
    } catch {
      return { mtime, entry: null, data: null, problem: `fichier illisible` };
    }
  }
}
