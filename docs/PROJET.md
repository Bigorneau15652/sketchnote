# Projet Sketchnote : décisions et plan

Ce fichier complète le socle commun (CLAUDE.md). Il décrit ce qui est propre au plugin Sketchnote.

## Objet

Plugin Obsidian (TypeScript, un seul fichier main.js, ordinateur et mobile) qui permet de dessiner des sketchnotes : une page unique qui mêle dessins faits à la main et texte manuscrit, organisée selon l'une des sept structures Linear, Radial, Vertical, Path, Modular, Skyscraper et Popcorn.

## Décisions d'Olivier

Fichier : un seul fichier .sketchnote (JSON) contient la page, la structure et tous les éléments, y compris le mini dessin de chaque élément graphique.

Dessin : moteur écrit pour le plugin, rendu en SVG, modèle de données inspiré d'Excalidraw. Dépendances acceptées : roughjs et perfect-freehand (MIT), à ajouter en version 0.5.0.

Bibliothèque de dessins : Lucide (ISC) et Tabler icons (MIT), passés dans le rendu crayonné. Olivier peut aussi importer des banques et ses propres dessins.

Polices : 3 ou 4 polices manuscrites sous licence SIL Open Font License embarquées dans main.js. Les autres s'importent depuis un fichier .ttf ou .otf, sans téléchargement par le plugin.

Structures : une structure produit deux choses. Les séparations, flèches et traits de liaison sont de vrais éléments du dessin : imprimés, déplaçables et supprimables, sans option de masquage. Les emplacements (cadres en pointillés pour le titre, les colonnes, les cases, les bulles) sont seulement une aide au placement pendant l'édition : jamais imprimés. Changer de structure ou de taille de page remplace les éléments que la structure a dessinés (avertir avant de remplacer des éléments déplacés quand la sélection existera, version 0.4.0). Réglages : Linear 2 à 4 colonnes, Radial 3 à 12 éléments autour du centre, Vertical 2 à 5 flèches, Path 3 à 10 étapes, Modular 1 à 4 colonnes et 1 à 4 lignes avec un bandeau de titre, Skyscraper 2 à 6 colonnes, Popcorn 4 à 14 bulles. La structure se choisit dans la section Structure de la fenêtre Page.

Palette : 3 à 5 couleurs choisies à la création de la page, proposées en premier dans les outils, à côté d'un sélecteur libre.

Interface en français et en anglais. Manifeste : id sketchnote, nom Sketchnote, auteur Bigorneau, licence MIT, copyright Olivier Holweck, isDesktopOnly à false. Un smartphone est visé : événements de pointeur (souris, tactile, stylet), aucune API Node ou Electron.

## Règles techniques propres au projet

Aucun accès réseau dans le plugin (fetch, XMLHttpRequest, requestUrl, WebSocket) et aucun innerHTML, DOMParser ni eval : des tests le vérifient (tests/safety.test.ts). Le SVG se construit avec le DOM (src/svg.ts). Tout ce qui est lu dans un fichier, le presse-papiers ou un import est validé avant usage (src/file-format.ts) : couleurs au format #hex seulement, nombres bornés, champs inconnus ignorés, SVG nettoyé.

Les textes affichés passent par t() (src/i18n.ts) avec leur traduction anglaise dans src/i18n-en.ts.

La commande npm test regroupe tous les fichiers tests/*.test.ts. La commande npm run build vérifie les types et produit main.js.

Version : manifest.json, package.json, package-lock.json (deux endroits) et versions.json portent le même numéro, et CHANGELOG.md a une section pour elle (un test le vérifie). La release est publiée avec une étiquette sans la lettre v, jamais en pré-version, avec main.js, manifest.json et styles.css (le workflow release.yml les joint).

## Décisions d'Olivier pour l'édition (version 0.4.0)

Déplacer la page : touche Espace maintenue avec glisser, bouton Main de la barre du bas (utile quand la page est très zoomée), clic molette, deux doigts sur écran tactile. Zoom : réglette dans la barre du bas, boutons, Ctrl ou Cmd avec la molette, pincement. Un clic sur un objet le sélectionne pour le déplacer ; poignées d'angle pour redimensionner ; poignée spécifique pour pivoter ; annuler et rétablir. Aimantation aux emplacements, aux bords de la page et aux autres éléments, active par défaut, suspendue avec Alt. La barre d'outils de dessin sera à droite dans le mode dessin (version 0.7.0), la barre du bas reste pour la page.

## Plan des versions

0.1.0 squelette et installation par BRAT. 0.2.0 la page (taille, orientation, fond, style de fond). 0.3.0 les sept structures (faite). 0.4.0 cœur du moteur de dessin : sélection, poignées, annuler (faite). 0.5.0 outils de formes. 0.6.0 texte et polices. 0.7.0 élément graphique imbriqué par double clic. 0.8.0 bibliothèque et images. 0.9.0 exports et intégration dans les notes. 0.10.0 audit de performance et de sécurité. 1.0.0 publication dans le répertoire communautaire.
