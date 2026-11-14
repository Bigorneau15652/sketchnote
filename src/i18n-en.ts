// English translations: the French text is the key. Every text passed to t() in the code must be listed here (a test checks it).
// Variable values are written {0}, {1}... as in the French text.
const PAIRS: [string, string][] = [
  [`Créer un sketchnote`, `Create a sketchnote`],
  [`Nouveau sketchnote`, `New sketchnote`],
  [`Sketchnote créé : {0}`, `Sketchnote created: {0}`],
  [`Impossible de créer le sketchnote : {0}`, `Cannot create the sketchnote: {0}`],
  [`Ce fichier sketchnote est illisible : {0}`, `This sketchnote file cannot be read: {0}`],
  [`Le fichier n'est pas un sketchnote.`, `The file is not a sketchnote.`],
  [`Version de fichier non prise en charge : {0}.`, `Unsupported file version: {0}.`],
  [`Le fichier est vide ou n'est pas du JSON valide.`, `The file is empty or is not valid JSON.`],
  [`Le fichier est trop volumineux.`, `The file is too large.`],
  [`La page du sketchnote est invalide.`, `The sketchnote page is invalid.`],
  [`Page vide. Les outils de dessin arrivent dans les prochaines versions.`, `Empty page. The drawing tools come in the next versions.`],
];

export const EN: Record<string, string> = Object.fromEntries(PAIRS);
