// The sites of free pictures that the window of the pictures offers. Pure module.
import { t } from "./i18n";

// The sites of free pictures: address and advice for each one.
export function imageSites(): { name: string; url: string; note: string }[] {
  return [
    { name: `Wikimedia Commons`, url: `https://commons.wikimedia.org`, note: t(`Images libres ou sous licence ouverte. Vérifiez la licence et la mention de l'auteur sur la page de chaque fichier.`) },
    { name: `Openverse`, url: `https://openverse.org`, note: t(`Moteur de recherche d'images sous licence ouverte (Creative Commons, domaine public). Il renvoie vers le site d'origine.`) },
    { name: `Unsplash`, url: `https://unsplash.com`, note: t(`Photographies libres d'usage. Bouton Download.`) },
    { name: `Pixabay`, url: `https://pixabay.com`, note: t(`Photographies, illustrations et dessins libres d'usage.`) },
    { name: `Pexels`, url: `https://www.pexels.com`, note: t(`Photographies libres d'usage.`) },
    { name: `Openclipart`, url: `https://openclipart.org`, note: t(`Dessins du domaine public, au format SVG.`) },
    { name: `SVG Repo`, url: `https://www.svgrepo.com`, note: t(`Pictogrammes au format SVG. La licence change d'un dessin à l'autre : vérifiez-la.`) },
  ];
}
