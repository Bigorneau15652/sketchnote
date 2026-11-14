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

## Décisions d'Olivier pour les dessins (version 0.5.0)

Organisation comme dans Bigorneau : une page de travail et des pages de dessin. La page reste un fichier .sketchnote unique ; chaque élément graphique est un cadre qui renvoie vers une note de dessin séparée, un fichier .sketchdraw (JSON). Le sketchnote est donc composé de plusieurs notes de dessin (cette décision remplace l'idée de départ de tout mettre dans un seul fichier).

Les zones de dessin sont les emplacements en pointillés de la structure (versions 0.6.0 et 0.6.1). On ne trace pas de zone à la main. Chaque zone a son cadre dès la création de la structure : un clic sélectionne la zone (poignées pour la déplacer et la redimensionner), un double clic ouvre son dessin dans un autre onglet (créé la première fois), avec la barre d'outils à droite. Une zone vide est en pointillé (ovale pour un ovale). Quand elle contient un dessin, le pointillé disparaît ; un clic sur le dessin le sélectionne avec un cadre rectangulaire en pointillé autour du dessin, qui peut être déplacé et agrandi au-delà de la zone d'origine. Pas de crayon dans les zones. Dans la fenêtre de dessin, un grand guide en pointillé est centré, avec la forme et les proportions de la zone de la page : simple repère, on peut dessiner en dehors. Le bouton plus de la barre du bas ajoute une zone à la structure (comme augmenter le nombre dans les réglages de la page). Le bouton œil affiche ou masque le pointillé des zones vides. Un dessin suit sa zone quand la structure ou la taille de la page change. Suppr sur une zone qui contient un dessin la remet vide ; une zone vide ne se supprime pas. Une page sans structure n'a pas de zone de dessin. Page par défaut : A4 paysage.

Règle d'interface : aucun bouton avec du texte, seulement des pictogrammes (nom en infobulle). Le menu sandwich ouvre les réglages de la page, l'œil affiche ou masque, chaque bouton ou menu a son pictogramme.

Dossier des notes de dessin : un réglage du plugin (par défaut Sketchnote dessins), un dossier unique où retrouver tous les dessins. La cellule du réglage propose les dossiers du coffre et crée le dossier s'il n'existe pas. Un nom de dessin est « Nom du sketchnote - dessin N ». Supprimer un cadre ne supprime pas la note de dessin.

Dupliquer un cadre (Ctrl ou Cmd avec D, bouton Dupliquer de la barre du bas, commande de la palette Dupliquer la sélection à laquelle Olivier peut donner un raccourci) crée une copie indépendante de la note de dessin. Un cadre se redimensionne proportionnellement comme une image et prend les proportions du dessin après chaque modification (la largeur reste, la hauteur s'adapte).

Lignes et flèches : le même fonctionnement qu'Excalidraw, sans inventer une autre façon de faire (points multiples, courbes, coudes, pointes : version 0.6.0). Style par défaut : trait fin noir à main levée. Propriétés : couleur du trait, remplissage (aucun, uni, hachuré), épaisseur, style (dessin ou net). La palette de la page (3 à 5 couleurs) est dans la fenêtre Page et copiée dans chaque nouveau dessin.

## Décisions d'Olivier pour le dessin (version 0.7.0)

Cap : continuer notre éditeur et y ajouter les fonctions d'Excalidraw une à une en lisant son code (dépôt excalidraw/excalidraw, licence MIT, lu en lecture seule : groups.ts, resizeElements.ts, transformHandles.ts). Excalidraw n'est pas embarqué. Les règles sont réimplémentées, sans copie de code.

Transparence : un niveau de transparence du remplissage seul (le trait reste opaque). Groupes : sélection avec Maj ou Ctrl et clic ; un bouton grouper qui devient dégrouper quand un groupe est sélectionné ; deux commandes de la palette (Grouper la sélection, Dégrouper la sélection) sans raccourci par défaut car Ctrl+G est pris par Obsidian, Olivier choisit le raccourci dans Obsidian. Pas de poignée de rotation sur les traits et les flèches. Le cadenas des outils signifie : garder l'outil actif après chaque tracé.

## Décisions d'Olivier pour le texte (version 0.9.0)

Le texte se pose dans le dessin avec un outil Texte (touche T) ; le texte directement sur la page viendra plus tard. Polices intégrées : Caveat, Patrick Hand, Gloria Hallelujah, Architects Daughter (OFL). Import de polices comme dans le plugin Bigorneau : dossier du coffre choisi dans les réglages, fenêtre Ajouter une police avec liens vers des sites de polices libres et import de fichiers .ttf, .otf ou zip, détection automatique des fichiers déposés dans le dossier. Le plugin ne télécharge rien lui-même. Un texte garde sa boîte mesurée dans le fichier ; ses propriétés sont la police, quatre tailles, l'alignement et la couleur ; il grandit comme une image quand on tire un coin.

## Décisions d'Olivier pour les couleurs, les formes et le texte (à partir de la version 0.10.0)

Ordre retenu le 14 novembre 2026 : 0.10.0 fenêtre de couleur et pipette ; 0.11.0 ombre, miroir, bordures et transparence des formes et du texte ; 0.12.0 texte dans une forme ; 0.13.0 distorsions et orientations du texte. La bibliothèque de dessins, les images, les exports et l'audit sont décalés d'autant.

Fenêtre de couleur : un cercle chromatique où l'on attrape une poignée ; l'angle donne la teinte, la distance au centre donne la saturation ; trois curseurs Teinte, Saturation, Luminance (la luminance va de -100 à 100 avec 0 pour la couleur pure, comme sur les logiciels de retouche d'image) avec leurs champs numériques ; un champ hexadécimal ; une pipette pour prendre une couleur n'importe où à l'écran (pipette du navigateur, disponible sur ordinateur). La fenêtre sert partout où l'on choisit une couleur : trait, remplissage, fond de la page, trait par défaut, palette.

Miroir : deux boutons pour retourner l'élément horizontalement ou verticalement, et un effet de reflet. Bordures des formes : sans bordure, coins arrondis ou carrés, pointillés et tirets, cadre de tableau, bordure double (un filet simple et un filet plus épais) avec plusieurs types de cadre. Distorsions du texte : bibliothèque opentype.js (licence MIT, accord d'Olivier le 14 novembre 2026) pour lire les contours des lettres, à ajouter et à enregistrer avec sa licence en version 0.13.0.

Règle d'interface (14 novembre 2026) : limiter le nombre de menus dès que c'est possible ; le panneau des propriétés ne montre que ce qui concerne la sélection (ou l'outil actif) ; les pointes de flèche se choisissent dans deux menus déroulants, un par bout, et peuvent aussi être données à un trait, qui devient une flèche.

Pastilles de couleur (14 novembre 2026) : cinq pastilles rondes pour le trait et cinq pour le remplissage ; un clic choisit, un double clic ouvre la fenêtre de couleur pour changer la pastille. Pour le remplissage, la fenêtre propose quatre motifs (plein, hachures, points, quadrillage) gardés avec la couleur dans la pastille, et un bouton sans couleur (pastille blanche barrée de rouge). D'origine : rouge, bleu, vert, noir et sans couleur. Les pastilles sont gardées dans chaque dessin. Pas de transparence par défaut du remplissage.

## Plan des versions

0.1.0 squelette et installation par BRAT (faite). 0.2.0 la page (faite). 0.3.0 les sept structures (faite). 0.4.0 sélection, poignées, annuler (faite). 0.5.0 notes de dessin, éditeur avec outils de base, propriétés, palette (faite). 0.6.0 les zones de dessin sont les emplacements de la structure, bouton plus, œil, interface en pictogrammes, réglage du dossier amélioré (faite). 0.6.1 un cadre par zone, sélection en un clic, guide dans la fenêtre de dessin, pas de crayon, page paysage par défaut (faite). 0.7.0 groupes, transparence du remplissage, poignées de bloc, plus de rotation sur les traits (faite). 0.8.0 lignes et flèches comme sur Excalidraw : points libres sans rectangle, points multiples, bords arrondis, pointes (faite) ; flèches coudées à prévoir. 0.9.0 texte dans le dessin (outil Texte), quatre polices manuscrites intégrées et import de polices comme dans Bigorneau (faite). 0.10.0 fenêtre de couleur et pipette (faite). 0.10.1 panneau qui suit la sélection et menus de pointes (faite). 0.10.2 cercle chromatique unique (faite). 0.11.0 ombre, miroir, reflet, bordures, type de trait, opacité (faite). 0.11.1 et 0.11.2 corrections du panneau, curseur de déplacement (faites). 0.12.0 pastilles de couleur (cinq pour le trait, cinq pour le remplissage avec motif et sans couleur, double clic pour changer) (faite). 0.13.0 texte dans une forme. 0.14.0 distorsions du texte. 0.15.0 bibliothèque de dessins (Lucide et Tabler) et images. 0.16.0 exports (PNG, SVG, PDF) et intégration dans les notes. 0.17.0 audit de performance et de sécurité. 1.0.0 publication dans le répertoire communautaire.
