// The themes of the icons and their search, in French and in English. Obsidian gives the names of the Lucide icons (house, zap, battery-charging) but no theme: the themes are made
// here from the words of the names, and the search understands French words for the usual icons and the English names and words of Lucide for all the others. Pure module.

import { t } from "./i18n";

// A theme: its identifier, its name, and the English words (a word of the name of an icon, which is made of words joined by hyphens) that put an icon in it. An icon can be in
// several themes.
export interface IconTheme {
  id: string;
  name: string;
  words: string[];
}

const w = (list: string): string[] => list.split(` `);

export const ICON_THEMES: IconTheme[] = [
  { id: `building`, name: `Bâtiment et habitat`, words: w(`house home building buildings castle factory warehouse school hospital hotel store landmark church tent fence door bed bath bathtub sofa armchair toilet shower stairs brick wall construction blinds lamp-ceiling lamp-floor lamp-desk columns`) },
  { id: `energy`, name: `Énergie et environnement`, words: w(`zap battery plug power sun solar flame fuel lightbulb lamp thermometer wind droplet droplets leaf leafy-green tree trees sprout recycle atom gauge fan radiation waves flower plant factory unplug cable`) },
  { id: `weather`, name: `Météo`, words: w(`cloud clouds snowflake rain umbrella rainbow sunrise sunset tornado moon haze fog lightning sun sun-dim sun-medium thermometer-sun thermometer-snowflake wind waves droplet`) },
  { id: `people`, name: `Personnes`, words: w(`user users person baby accessibility contact smile frown meh laugh angry annoyed hand handshake footprints ear eye brain bone skull venus mars hand-heart group`) },
  { id: `arrows`, name: `Flèches et directions`, words: w(`arrow arrows chevron chevrons corner undo redo rotate refresh repeat shuffle navigation compass move trending route signpost split merge forward reply`) },
  { id: `shapes`, name: `Formes et symboles`, words: w(`circle square triangle diamond hexagon octagon pentagon star heart plus minus x check equal percent hash asterisk infinity shapes badge bookmark flag pin tag sparkle sparkles crown gem`) },
  { id: `communication`, name: `Communication`, words: w(`mail message messages phone send megaphone bell rss wifi radio podcast share at-sign inbox voicemail video speech`) },
  { id: `office`, name: `Documents et bureau`, words: w(`file files folder folders book books notebook clipboard paperclip pen pencil scroll sticky newspaper library archive printer scan calendar clock timer hourglass alarm watch table sheet presentation ruler scissors stapler eraser highlighter signature`) },
  { id: `data`, name: `Données et graphiques`, words: w(`chart bar-chart line-chart pie-chart trending database server table gauge activity percent calculator sigma binary`) },
  { id: `tools`, name: `Outils et travaux`, words: w(`wrench hammer screwdriver drill saw pickaxe shovel axe ruler paintbrush paint bucket brush settings cog sliders toolbox tool hard-hat construction plug cable magnet anvil`) },
  { id: `transport`, name: `Transport`, words: w(`car bus train tram bike bicycle plane ship sailboat truck tractor rocket helicopter fuel parking traffic cable-car ambulance forklift motorbike scooter caravan anchor`) },
  { id: `nature`, name: `Nature et animaux`, words: w(`tree trees leaf flower sprout mountain bird cat dog fish rabbit turtle bug worm squirrel rat snail shell paw feather egg palmtree bird`) },
  { id: `food`, name: `Alimentation`, words: w(`coffee cup utensils pizza sandwich wine beer apple banana cherry grape carrot salad soup ice-cream cake cookie milk egg wheat beef candy croissant popcorn donut citrus martini glass bottle chef-hat cooking-pot refrigerator microwave`) },
  { id: `health`, name: `Santé et science`, words: w(`heart-pulse stethoscope pill syringe bandage cross ambulance hospital microscope flask test-tube atom dna brain thermometer biohazard radiation activity hand-heart dumbbell bone tablets`) },
  { id: `devices`, name: `Multimédia et appareils`, words: w(`camera image video film music mic headphones speaker volume play pause tv monitor laptop smartphone tablet mouse keyboard gamepad printer cpu usb bluetooth webcam projector radio cast airplay disc save hard-drive router wifi qr-code scan`) },
  { id: `commerce`, name: `Commerce et finance`, words: w(`shopping-cart shopping-bag credit-card wallet banknote coins receipt euro dollar pound bitcoin piggy-bank landmark store tag ticket gift package handshake scale percent calculator`) },
  { id: `places`, name: `Lieux et cartes`, words: w(`map map-pin globe compass navigation locate earth route mountain flag tent tree-pine signpost`) },
  { id: `interface`, name: `Interface et actions`, words: w(`search settings menu more plus minus x check trash edit save download upload lock unlock key eye share copy paste filter link bookmark log-in log-out power toggle info help circle-help alert triangle-alert ban bell`) },
  { id: `sport`, name: `Sport et loisirs`, words: w(`dumbbell trophy medal gamepad dice puzzle drama palette guitar piano drum volleyball tennis football basketball golf bike swords sword target goal shield crown`) },
];

// The theme of the icons that are in none of the others, and of the icons that the user adds (a theme for each folder).
export const OTHER_THEME: IconTheme = { id: `other`, name: `Autres`, words: [] };

// French words of the usual icons and the English words of Lucide that they mean.
const FRENCH: Record<string, string> = {
  maison: `house home`, habitat: `house home`, batiment: `building`, immeuble: `building buildings`, usine: `factory`, ecole: `school`, hopital: `hospital`, eglise: `church`, chateau: `castle`,
  porte: `door`, fenetre: `blinds window`, lit: `bed`, bain: `bath bathtub`, douche: `shower`, escalier: `stairs`, mur: `wall brick`, brique: `brick`, cloture: `fence`, tente: `tent`, chantier: `construction`,
  energie: `zap battery plug power`, electricite: `zap plug cable`, eclair: `zap lightning`, batterie: `battery`, pile: `battery`, prise: `plug`, soleil: `sun`, solaire: `sun solar`,
  flamme: `flame`, feu: `flame`, chaleur: `flame thermometer`, froid: `snowflake thermometer`, temperature: `thermometer`, thermometre: `thermometer`, ampoule: `lightbulb`, lampe: `lamp`,
  vent: `wind`, eau: `droplet droplets waves`, goutte: `droplet`, feuille: `leaf`, arbre: `tree`, foret: `trees tree`, plante: `sprout flower plant`, recyclage: `recycle`, dechet: `trash recycle`,
  poubelle: `trash`, atome: `atom`, jauge: `gauge`, compteur: `gauge`, ventilateur: `fan`, nuage: `cloud`, pluie: `rain`, neige: `snowflake`, parapluie: `umbrella`, lune: `moon`, orage: `lightning`,
  personne: `user person`, utilisateur: `user`, groupe: `users group`, equipe: `users`, bebe: `baby`, main: `hand`, oeil: `eye`, oreille: `ear`, cerveau: `brain`, coeur: `heart`, sourire: `smile`,
  fleche: `arrow`, fleches: `arrow arrows`, direction: `arrow navigation compass`, boussole: `compass`, haut: `up`, bas: `down`, gauche: `left`, droite: `right`, retour: `undo corner`, rafraichir: `refresh rotate`,
  cercle: `circle`, carre: `square`, triangle: `triangle`, etoile: `star`, plus: `plus`, moins: `minus`, croix: `x cross`, coche: `check`, valider: `check`, drapeau: `flag`, epingle: `pin`, etiquette: `tag`, couronne: `crown`,
  courrier: `mail`, email: `mail`, message: `message`, telephone: `phone`, envoyer: `send`, cloche: `bell`, partage: `share`, fichier: `file`, dossier: `folder`, livre: `book`, carnet: `notebook`,
  trombone: `paperclip`, stylo: `pen`, crayon: `pencil`, journal: `newspaper`, imprimante: `printer`, calendrier: `calendar`, horloge: `clock`, heure: `clock`, temps: `clock timer`, minuteur: `timer`, sablier: `hourglass`,
  tableau: `table`, regle: `ruler`, ciseaux: `scissors`, graphique: `chart`, courbe: `line-chart chart-line trending`, statistiques: `chart`, histogramme: `bar-chart chart-bar chart-column`, camembert: `pie-chart chart-pie`, serveur: `server`, calculatrice: `calculator`,
  cle: `key`, cadenas: `lock`, outil: `wrench hammer tool`, outils: `wrench hammer toolbox`, marteau: `hammer`, tournevis: `screwdriver`, perceuse: `drill`, scie: `saw`, pelle: `shovel`, peinture: `paint paintbrush`, pinceau: `paintbrush brush`,
  reglage: `settings sliders`, parametre: `settings`, engrenage: `cog settings`, aimant: `magnet`, voiture: `car`, bus: `bus`, train: `train`, velo: `bike`, avion: `plane`, bateau: `ship sailboat`, camion: `truck`, fusee: `rocket`,
  helicoptere: `helicopter`, carburant: `fuel`, chien: `dog`, chat: `cat`, oiseau: `bird`, poisson: `fish`, lapin: `rabbit`, tortue: `turtle`, insecte: `bug`, escargot: `snail`, montagne: `mountain`, fleur: `flower`,
  cafe: `coffee`, tasse: `cup coffee`, fourchette: `utensils`, repas: `utensils`, vin: `wine`, biere: `beer`, pomme: `apple`, cerise: `cherry`, carotte: `carrot`, salade: `salad`, gateau: `cake`, pain: `croissant sandwich`, lait: `milk`,
  oeuf: `egg`, ble: `wheat`, bouteille: `bottle`, frigo: `refrigerator`, sante: `heart-pulse stethoscope`, medicament: `pill`, pilule: `pill`, seringue: `syringe`, pansement: `bandage`, fiole: `flask`,
  camera: `camera`, image: `image`, photo: `camera image`, video: `video`, musique: `music`, micro: `mic`, casque: `headphones`, volume: `volume`, lecture: `play`, tele: `tv`, ecran: `monitor`, ordinateur: `laptop monitor`,
  tablette: `tablet`, souris: `mouse`, clavier: `keyboard`, manette: `gamepad`, processeur: `cpu`, disque: `hard-drive disc`, panier: `shopping-cart shopping-bag`, sac: `shopping-bag backpack`, portefeuille: `wallet`,
  billet: `banknote ticket`, piece: `coins`, recu: `receipt`, tirelire: `piggy-bank`, cadeau: `gift`, colis: `package`, paquet: `package`, balance: `scale`, carte: `map`, globe: `globe`, monde: `globe earth`, terre: `earth`,
  lieu: `map-pin`, localisation: `map-pin locate`, itineraire: `route`, chercher: `search`, recherche: `search`, loupe: `search`, supprimer: `trash`, modifier: `edit pencil`, enregistrer: `save`, sauvegarder: `save`,
  telecharger: `download`, copier: `copy`, coller: `clipboard paste`, filtre: `filter`, lien: `link`, connexion: `log-in`, deconnexion: `log-out`, interrupteur: `toggle power`, aide: `help circle-help`,
  alerte: `alert triangle-alert`, attention: `triangle-alert`, danger: `triangle-alert`, interdit: `ban`, trophee: `trophy`, medaille: `medal`, palette: `palette`, guitare: `guitar`, tambour: `drum`,
  ballon: `volleyball football basketball`, cible: `target`, epee: `sword swords`, bouclier: `shield`, diamant: `gem diamond`, gemme: `gem`, paillette: `sparkles`,
};

// Returns a text without its accents and capitals, with the ligature oe written out, so that cœur and coeur are the same word.
export function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, `oe`)
    .replace(/æ/g, `ae`)
    .normalize(`NFD`)
    .replace(/[̀-ͯ]/g, ``)
    .trim();
}

// Returns the themes of the icon of a name: all those that have one of its words, or the theme of the others.
export function themesOf(name: string): string[] {
  const words = new Set(name.toLowerCase().split(`-`));
  const found = ICON_THEMES.filter((t) => t.words.some((x) => (x.includes(`-`) ? name.toLowerCase().includes(x) : words.has(x)))).map((t) => t.id);
  return found.length > 0 ? found : [OTHER_THEME.id];
}

// Returns the name of a theme, from its identifier.
export function themeName(id: string): string {
  return ICON_THEMES.find((t) => t.id === id)?.name ?? (id === OTHER_THEME.id ? OTHER_THEME.name : id);
}

// Returns the English words that a French (or English) word of a search stands for: the word itself and what the dictionary says it means.
export function expandWord(word: string): string[] {
  const key = plain(word);
  const out = new Set<string>([key]);
  const meaning = Object.prototype.hasOwnProperty.call(FRENCH, key) ? FRENCH[key] : undefined;
  if (meaning) for (const m of meaning.split(` `)) out.add(m);
  return [...out];
}

// Tells whether an icon matches a search: every word of the search must be found, as it is written or as the French dictionary understands it, in the name of the icon, or be a word
// of the name of one of its themes. The name of an icon is its words joined by hyphens, and a word found in it counts even if it is only the beginning of a word of the name.
export function matchesSearch(name: string, themes: string[], query: string, aliases: string[] = []): boolean {
  const words = plain(query).split(/\s+/).filter((x) => x !== ``);
  if (words.length === 0) return true;
  const lower = [name, ...aliases].join(` `).toLowerCase();
  const themeWords = themes.flatMap((id) => plain(themeName(id)).split(/[\s,]+/).filter((x) => x.length >= 4));
  return words.every((word) => {
    if (themeWords.includes(word)) return true;
    return expandWord(word).some((alt) => lower.includes(alt));
  });
}

// An icon that can be offered: its name, the themes it is in, and where it comes from (Lucide, or a file of the user).
export interface IconEntry {
  // The name: the one of Lucide (house), or the path of the file of the user.
  name: string;
  source: `lucide` | `tabler` | `custom`;
  // A name to show, and the folder of a file of the user (the name of its theme).
  label: string;
  themes: string[];
  // The other names of the same drawing (Lucide keeps old names for a drawing that was renamed: house and home): the search finds the icon by them too, and the window shows it once.
  aliases?: string[];
}

// Returns the icons of a theme (every icon for no theme) that match a search, in the order of their names, at most `limit` of them (and how many there are in all).
export function listIcons(entries: IconEntry[], theme: string | null, query: string, limit: number): { shown: IconEntry[]; total: number } {
  const found = entries.filter((e) => (theme === null || e.themes.includes(theme)) && matchesSearch(e.label, e.themes, query, e.aliases));
  found.sort((a, b) => a.label.localeCompare(b.label));
  return { shown: found.slice(0, Math.max(0, limit)), total: found.length };
}

// Returns the entries of the icons of Lucide, from the identifiers that Obsidian gives (lucide-house, lucide-zap...). The icons of the plugin and of Obsidian itself are left out.
export function lucideEntries(ids: string[]): IconEntry[] {
  const lucide = ids.filter((id) => id.startsWith(`lucide-`));
  // A version of Obsidian that does not prefix the names: everything but what belongs to the plugin.
  const names = lucide.length > 0 ? lucide.map((id) => id.slice(7)) : ids.filter((id) => !id.startsWith(`sketchnote-`) && !id.includes(`:`));
  return [...new Set(names)].filter((n) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(n)).map((name) => ({ name, source: `lucide` as const, label: name, themes: themesOf(name) }));
}

// Merges the entries that draw the same picture into one: the one with the longest name (then the first in the alphabet) is kept and the other names become its aliases. `signature`
// gives the text that is the same for the same picture, or null when it is not known (the entry is then kept as it is).
export function mergeSamePictures(entries: IconEntry[], signature: (entry: IconEntry) => string | null): IconEntry[] {
  const groups = new Map<string, IconEntry[]>();
  const out: IconEntry[] = [];
  for (const e of entries) {
    const sig = signature(e);
    if (sig === null) {
      out.push(e);
      continue;
    }
    const key = `${e.source}|${sig}`;
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => b.label.length - a.label.length || a.label.localeCompare(b.label));
    const [first, ...rest] = sorted;
    out.push(rest.length === 0 ? first : { ...first, aliases: rest.map((r) => r.label) });
  }
  return out;
}

// Returns the identifier that Obsidian knows an icon of Lucide by.
export function lucideId(name: string, ids: string[]): string {
  return ids.includes(`lucide-${name}`) ? `lucide-${name}` : name;
}

// Returns the name of a theme in the language of the user (the folders of the user keep the name of their folder).
export function themeLabel(id: string): string {
  switch (id) {
    case `building`:
      return t(`Bâtiment et habitat`);
    case `energy`:
      return t(`Énergie et environnement`);
    case `weather`:
      return t(`Météo`);
    case `people`:
      return t(`Personnes`);
    case `arrows`:
      return t(`Flèches et directions`);
    case `shapes`:
      return t(`Formes et symboles`);
    case `communication`:
      return t(`Communication`);
    case `office`:
      return t(`Documents et bureau`);
    case `data`:
      return t(`Données et graphiques`);
    case `tools`:
      return t(`Outils et travaux`);
    case `transport`:
      return t(`Transport`);
    case `nature`:
      return t(`Nature et animaux`);
    case `food`:
      return t(`Alimentation`);
    case `health`:
      return t(`Santé et science`);
    case `devices`:
      return t(`Multimédia et appareils`);
    case `commerce`:
      return t(`Commerce et finance`);
    case `places`:
      return t(`Lieux et cartes`);
    case `interface`:
      return t(`Interface et actions`);
    case `sport`:
      return t(`Sport et loisirs`);
    case `other`:
      return t(`Autres`);
    case `Mes dessins`:
      return t(`Mes dessins`);
    default:
      return id;
  }
}
