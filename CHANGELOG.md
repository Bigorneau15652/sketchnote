# Changelog

## 0.4.0

English

Selecting and editing elements. A click on an element selects it (Shift adds or removes one, a rectangle drawn on the empty page selects what it touches, Ctrl or Cmd with A selects all). Dragging moves it, with magnetism on the slots of the structure, the page edges and the other elements (hold Alt to switch it off). Four corner handles resize it (Shift keeps the proportions) and a round handle above it turns it (Shift turns by steps of 15 degrees). Delete removes, Ctrl or Cmd with D duplicates, with C and V copies and pastes, with the bracket keys brings to the front or sends to the back, the arrow keys nudge by 1 pixel (10 with Shift). Undo and Redo (Ctrl or Cmd with Z and Y, and two buttons of the bottom bar) cover every change, including the page settings. To move the page: hold Space and drag, use the Hand button, the middle mouse button, or two fingers on a touch screen. The zoom has a slider in the bottom bar, in addition to the buttons, Ctrl or Cmd with the wheel and the pinch gesture. Changing the structure or the page size asks for confirmation when you edited what the structure drew. With several elements selected, move, copy, order and delete are available; resizing and turning work on one element at a time.

Français

Sélection et modification des éléments. Un clic sur un élément le sélectionne (Maj ajoute ou retire un élément, un rectangle tracé sur la page vide sélectionne ce qu'il touche, Ctrl ou Cmd avec A sélectionne tout). Le glisser le déplace, avec une aimantation sur les emplacements de la structure, les bords de la page et les autres éléments (maintenir Alt pour la suspendre). Quatre poignées d'angle le redimensionnent (Maj garde les proportions) et une poignée ronde au-dessus le fait pivoter (Maj pivote par pas de 15 degrés). Suppr supprime, Ctrl ou Cmd avec D duplique, avec C et V copie et colle, avec les touches crochets met devant ou derrière, les flèches du clavier décalent de 1 pixel (10 avec Maj). Annuler et Rétablir (Ctrl ou Cmd avec Z et Y, et deux boutons de la barre du bas) couvrent toutes les modifications, réglages de la page compris. Pour déplacer la page : maintenir Espace et glisser, utiliser le bouton Main, le bouton du milieu de la souris ou deux doigts sur un écran tactile. Le zoom a une réglette dans la barre du bas, en plus des boutons, de Ctrl ou Cmd avec la molette et du pincement. Changer la structure ou la taille de la page demande une confirmation quand vous avez modifié ce que la structure avait dessiné. Avec plusieurs éléments sélectionnés, le déplacement, la copie, l'ordre et la suppression sont disponibles ; le redimensionnement et la rotation se font sur un élément à la fois.

## 0.3.0

English

The seven page structures. The page settings window has a new Structure section: Linear, Radial, Vertical, Path, Modular or Skyscraper, with the number of columns, arrows, steps, items or bubbles (and rows for Modular). A structure draws its separators, arrows and links on the page: they are real parts of the drawing, printed with it. It also shows dotted frames where to place the contents (title, columns, cells, bubbles): they help while editing and are never printed. Changing the structure or the page size replaces what the structure drew; the page colour and the default stroke colour carry over to its strokes (white on the chalkboard). The file format now stores the structure and the elements of the page. Files of versions 0.1 and 0.2 open without change. Moving and deleting the separators comes with the selection tools in version 0.4.0.

Français

Les sept structures de page. La fenêtre des réglages de la page a une nouvelle section Structure : Linear, Radial, Vertical, Path, Modular ou Skyscraper, avec le nombre de colonnes, de flèches, d'étapes, d'éléments ou de bulles (et de lignes pour Modular). Une structure dessine ses séparations, ses flèches et ses liens sur la page : ce sont de vraies parties du dessin, imprimées avec lui. Elle montre aussi en pointillés où placer les contenus (titre, colonnes, cases, bulles) : ces cadres aident pendant l'édition et ne sont jamais imprimés. Changer la structure ou la taille de la page remplace ce que la structure avait dessiné ; la couleur de la page et la couleur de trait par défaut se reportent sur ses traits (blanc sur le tableau noir). Le format de fichier enregistre désormais la structure et les éléments de la page. Les fichiers des versions 0.1 et 0.2 s'ouvrent sans changement. Le déplacement et la suppression des séparations arrivent avec les outils de sélection en version 0.4.0.

## 0.2.1

English

The chalkboard background looks like a real chalkboard: a fine grain, a few very soft wide marks of the eraser and slightly darker borders, instead of a repeating pattern of oval stains. The default chalkboard colour is a little darker. Pages already saved keep their colour.

Français

Le fond tableau noir ressemble à un vrai tableau noir : un grain fin, quelques larges traces d'effaceur très douces et des bords un peu plus sombres, à la place d'un motif répété de taches ovales. La couleur par défaut du tableau noir est un peu plus sombre. Les pages déjà enregistrées gardent leur couleur.

## 0.2.0

English

The page. A button Page at the bottom of the view opens the page settings: format (A5, A4, A3, 16/9, square or custom size in pixels), orientation, background style (blank, lines, grid, dots, craft paper or chalkboard), background colour and default stroke colour. The chalkboard sets a white stroke. The page can be zoomed with the buttons of the bottom bar, with Ctrl or Cmd and the wheel or by pinching, and dragged with the mouse or one finger. Files of version 0.1.0 open without change.

Français

La page. Un bouton Page en bas de la vue ouvre les réglages de la page : format (A5, A4, A3, 16/9, carré ou dimensions libres en pixels), orientation, style de fond (blanc, lignes, quadrillage, points, papier craft ou tableau noir), couleur du fond et couleur du trait par défaut. Le tableau noir passe le trait en blanc. La page se zoome avec les boutons de la barre du bas, avec Ctrl ou Cmd et la molette ou en pinçant avec deux doigts, et se déplace à la souris ou avec un doigt. Les fichiers de la version 0.1.0 s'ouvrent sans changement.

## 0.1.0

English

First version. Creates a .sketchnote file (one JSON document holding the page and all its elements), opens it in its own view and shows an empty A4 page. The command and the ribbon button Create a sketchnote make a new file next to the active note. The file is read with strict checks (size, version, page, colours). Works on desktop and on mobile. Interface in English and French. Tests, build and release workflow are in place.

Français

Première version. Crée un fichier .sketchnote (un seul document JSON qui contient la page et tous ses éléments), l'ouvre dans sa propre vue et affiche une page A4 vide. La commande et le bouton du ruban Créer un sketchnote créent un nouveau fichier à côté de la note active. Le fichier est lu avec des contrôles stricts (taille, version, page, couleurs). Fonctionne sur ordinateur et sur mobile. Interface en français et en anglais. Les tests, la construction et le workflow de publication sont en place.
