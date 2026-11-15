// The functions of the buttons on the right of the drawing: what each one is called, its pictogram, what it explains, which tools and which parts of the properties its menu shows, and the
// rules that order them, hide them and separate them. The first button of the column opens the list where the user checks the functions, orders them and adds separations (the same idea
// as the plugin Bigorneau). Pure module: no page, no application.
import { t } from "./i18n";
import type { PanelSection } from "./panel-kinds";

export type DrawFunctionId = `select` | `hand` | `rect` | `diamond` | `ellipse` | `triangle` | `arrow` | `line` | `pen` | `point` | `text` | `icons` | `images` | `colours` | `stroke` | `effects` | `display` | `export`;

export interface DrawFunction {
  id: DrawFunctionId;
  // The pictogram (Obsidian, or one drawn for the plugin).
  icon: string;
  name: () => string;
  // What the function does, in short paragraphs, for the window opened by the question mark.
  help: () => string[];
  // The tools that its menu offers (the first one is chosen when the function is chosen); none for a function that is not a tool.
  tools: string[];
  // The parts of the properties that its menu shows (the ones that do not concern the selection or the tool are left out).
  sections: PanelSection[];
  // A function that opens a window when it is clicked instead of showing a menu.
  opens?: `icons` | `images` | `export`;
}

const CONTENT: PanelSection[] = [`colour`, `fill`, `brush`, `width`, `dash`, `look`, `regularity`, `border`, `corners`, `edges`, `taper`, `heads`, `text`, `warp`, `icon`, `image`, `effects`];

// Returns the functions in their usual order. The names and the explanations are translated when they are asked for. Each tool has its own button.
export function drawFunctions(): DrawFunction[] {
  const shape = (id: `rect` | `diamond` | `ellipse` | `triangle`, icon: string, name: () => string, what: () => string): DrawFunction => ({
    id,
    icon,
    name,
    help: () => [what(), t(`Le menu règle les couleurs, le remplissage, le trait, la bordure et les coins.`)],
    tools: [id],
    sections: [`colour`, `fill`, `width`, `dash`, `look`, `border`, `corners`],
  });
  return [
    {
      id: `select`,
      icon: `mouse-pointer-2`,
      name: () => t(`Sélectionner`),
      help: () => [
        t(`Choisit les éléments du dessin pour les déplacer, les redimensionner, les tourner ou changer leur aspect.`),
        t(`Le menu montre tout ce que les éléments sélectionnés peuvent avoir : couleurs, trait, texte, effets.`),
      ],
      tools: [`select`],
      sections: CONTENT,
    },
    {
      id: `hand`,
      icon: `hand`,
      name: () => t(`Main : déplacer la page`),
      help: () => [t(`Déplace la page dans la fenêtre en tirant dessus, sans rien sélectionner ni dessiner. La barre d'espace fait la même chose le temps qu'on la tient.`)],
      tools: [`hand`],
      sections: [],
    },
    shape(`rect`, `square`, () => t(`Rectangle`), () => t(`Trace un rectangle, aux coins carrés ou arrondis, en tirant sur le dessin.`)),
    shape(`diamond`, `diamond`, () => t(`Losange`), () => t(`Trace un losange en tirant sur le dessin.`)),
    shape(`ellipse`, `circle`, () => t(`Ellipse`), () => t(`Trace une ellipse ou un cercle en tirant sur le dessin.`)),
    shape(`triangle`, `triangle`, () => t(`Triangle`), () => t(`Trace un triangle en tirant sur le dessin.`)),
    {
      id: `arrow`,
      icon: `arrow-right`,
      name: () => t(`Flèche`),
      help: () => [
        t(`Trace une flèche, droite ou arrondie : un clic par point, Entrée ou Échap pour finir.`),
        t(`Le menu règle la couleur, l'épaisseur, les pointillés, l'imperfection du tracé, les bords, le fuselage et les pointes aux deux bouts.`),
      ],
      tools: [`arrow`],
      sections: [`colour`, `width`, `dash`, `look`, `edges`, `taper`, `heads`],
    },
    {
      id: `line`,
      icon: `minus`,
      name: () => t(`Trait`),
      help: () => [
        t(`Trace un trait, droit ou arrondi : un clic par point, Entrée ou Échap pour finir.`),
        t(`Le menu règle la couleur, l'épaisseur, les pointillés, l'imperfection du tracé, les bords et le fuselage.`),
      ],
      tools: [`line`],
      sections: [`colour`, `width`, `dash`, `look`, `edges`, `taper`],
    },
    {
      id: `pen`,
      icon: `pencil`,
      name: () => t(`Stylo libre`),
      help: () => [
        t(`Dessine à main levée avec le stylo.`),
        t(`Le menu règle le pinceau, la peinture qu'il met, la régularité du tracé (de la main levée à la forme parfaite), la couleur, l'épaisseur et l'opacité.`),
      ],
      tools: [`pen`],
      sections: [`colour`, `fill`, `brush`, `width`, `regularity`],
    },
    {
      id: `point`,
      icon: `dot`,
      name: () => t(`Point`),
      help: () => [t(`Pose un point d'un clic. Le menu règle sa couleur et sa taille.`)],
      tools: [`point`],
      sections: [`colour`, `width`, `look`],
    },
    {
      id: `text`,
      icon: `type`,
      name: () => t(`Texte`),
      help: () => [
        t(`Écrit un texte : un clic pour une ligne, un glissement pour une zone où le texte passe à la ligne.`),
        t(`Le menu règle la police, la taille, l'alignement, la couleur et les déformations (arc, vague, inclinaison, perspective, bombé) ou l'écriture verticale.`),
      ],
      tools: [`text`],
      sections: [`text`, `warp`, `colour`],
    },
    {
      id: `icons`,
      icon: `shapes`,
      name: () => t(`Icônes`),
      help: () => [
        t(`Ouvre la bibliothèque d'icônes, classées par thèmes avec une recherche, et vos propres dessins SVG.`),
        t(`Une icône insérée se déplace, se retourne et se colorie comme une forme. Le menu de l'icône permet de la transformer en traits modifiables un par un.`),
      ],
      tools: [],
      sections: [`icon`, `colour`, `fill`, `width`, `look`],
      opens: `icons`,
    },
    {
      id: `images`,
      icon: `image-plus`,
      name: () => t(`Images`),
      help: () => [
        t(`Ouvre le choix d'une image du coffre, avec un bouton pour en ajouter depuis des sites d'images libres ou depuis votre ordinateur. Vous pouvez aussi glisser ou coller une image sur le dessin.`),
        t(`Le menu de l'image permet de la rogner, de lui donner une bordure et des coins arrondis, ou de choisir un autre fichier.`),
      ],
      tools: [],
      sections: [`image`, `border`, `corners`, `colour`, `width`, `dash`, `look`],
      opens: `images`,
    },
    {
      id: `colours`,
      icon: `palette`,
      name: () => t(`Couleurs`),
      help: () => [
        t(`Règle les couleurs des éléments sélectionnés, ou des prochains éléments si rien n'est sélectionné.`),
        t(`Une pastille pour la bordure et une pour le remplissage : chacune ouvre la fenêtre des couleurs, avec la pipette et les motifs de remplissage.`),
      ],
      tools: [],
      sections: [`colour`, `fill`],
    },
    {
      id: `stroke`,
      icon: `sketchnote-width-medium`,
      name: () => t(`Aspect du trait`),
      help: () => [
        t(`Règle l'aspect du trait : épaisseur, pointillés, imperfection du tracé à main levée, bordure, coins, bords, fuselage et pointes de flèche.`),
      ],
      tools: [],
      sections: [`width`, `dash`, `look`, `border`, `corners`, `edges`, `taper`, `heads`],
    },
    {
      id: `effects`,
      icon: `sparkles`,
      name: () => t(`Effets`),
      help: () => [
        t(`Règle l'opacité de l'élément, son ombre (éloignement, flou, densité, couleur) et son reflet (profondeur, dégradé, éloignement).`),
      ],
      tools: [],
      sections: [`effects`],
    },
    {
      id: `display`,
      icon: `eye`,
      name: () => t(`Affichage`),
      help: () => [
        t(`Montre ce dessin seul, ou avec les dessins des autres zones de la page, estompés derrière lui, pour voir comment ils se placent autour.`),
        t(`Les autres dessins sont sur un autre calque : on ne peut pas les modifier depuis ce dessin.`),
      ],
      tools: [],
      sections: [`display`],
    },
    {
      id: `export`,
      icon: `download`,
      name: () => t(`Exporter`),
      help: () => [
        t(`Ouvre la fenêtre d'export : image PNG, SVG ou PDF, de tout le dessin ou de la sélection, avec enregistrement dans le coffre, copie et lien dans la note, ou impression.`),
      ],
      tools: [],
      sections: [],
      opens: `export`,
    },
  ];
}

// The tools and the function that has them: the function that is active when a tool is chosen (by the keyboard too).
export function functionOfTool(tool: string): DrawFunctionId | null {
  for (const f of drawFunctions()) if (f.tools.includes(tool)) return f.id;
  return null;
}

// A separation between two groups of buttons: an identifier like sep:3, put in the order like a button.
export const isSeparator = (id: string): boolean => /^sep:\d+$/.test(id);

// The usual order: the tools (each one its own button), then the windows, then the settings, then what acts on the drawing.
export const DEFAULT_ORDER: string[] = [`select`, `hand`, `sep:1`, `rect`, `diamond`, `ellipse`, `triangle`, `sep:2`, `arrow`, `line`, `pen`, `point`, `text`, `sep:3`, `icons`, `images`, `sep:4`, `colours`, `stroke`, `effects`, `sep:5`, `display`, `export`];

// Tells whether a value can be an entry of a saved order: a known function or a separation.
export function isOrderEntry(value: unknown, known: string[]): value is string {
  return typeof value === `string` && (known.includes(value) || (isSeparator(value) && value.length <= 8));
}

// Reads a saved order: the entries that are known, once each, then the functions that are missing (a function added by a later version) after the others. A wrong value gives the usual order.
export function readOrder(value: unknown, known: string[]): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_ORDER];
  // An order saved when the tools were grouped (Draw, Shapes, Lines and arrows) has nothing to keep: each tool has its own button now, so the usual order is used.
  if (value.some((id) => id === `draw` || id === `shapes` || id === `lines` || id === `organise`)) return [...DEFAULT_ORDER];
  const out: string[] = [];
  for (const entry of value.slice(0, 80)) {
    if (!isOrderEntry(entry, known) || (!isSeparator(entry) && out.includes(entry)) || (isSeparator(entry) && out.includes(entry))) continue;
    out.push(entry);
  }
  for (const id of known) if (!out.includes(id)) out.push(id);
  return out;
}

// Reads the saved list of the hidden functions: only known functions, once each.
export function readHidden(value: unknown, known: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === `string` && known.includes(id)))];
}

// The order with one separation more, at a place (at the end when none is given).
export function addSeparator(order: string[], at?: number): string[] {
  const used = order.filter(isSeparator).map((id) => Number(id.slice(4)));
  const id = `sep:${(used.length > 0 ? Math.max(...used) : 0) + 1}`;
  const out = [...order];
  out.splice(at === undefined ? out.length : Math.max(0, Math.min(out.length, at)), 0, id);
  return out;
}

export const removeEntry = (order: string[], id: string): string[] => order.filter((x) => x !== id);

// The order with an entry moved to a place (an index in the list without that entry).
export function moveEntry(order: string[], id: string, to: number): string[] {
  const rest = order.filter((x) => x !== id);
  rest.splice(Math.max(0, Math.min(rest.length, to)), 0, id);
  return rest;
}

// The hidden list with a function hidden or shown.
export function setHidden(hidden: string[], id: string, isHidden: boolean): string[] {
  const rest = hidden.filter((x) => x !== id);
  return isHidden ? [...rest, id] : rest;
}

// What is drawn in the column: the entries in order, without the hidden functions, and with the separations only between two buttons (not first, not last, not two in a row).
export function railItems(order: string[], hidden: string[]): string[] {
  const shown = order.filter((id) => isSeparator(id) || !hidden.includes(id));
  const out: string[] = [];
  for (const id of shown) {
    if (isSeparator(id) && (out.length === 0 || isSeparator(out[out.length - 1]))) continue;
    out.push(id);
  }
  while (out.length > 0 && isSeparator(out[out.length - 1])) out.pop();
  return out;
}

// The one word that stands for a button when the menu shows a word with its pictogram: the last word of its name.
export function shortWord(label: string): string {
  const apostrophe = String.fromCharCode(39);
  const words = label.split(apostrophe).join(` `).replace(/[()]/g, ` `).split(/\s+/).filter((w) => w !== ``);
  return words.length === 0 ? `` : words[words.length - 1];
}
