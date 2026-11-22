# Sketchnote

Sketchnote est un plugin Obsidian pour dessiner des sketchnotes : une page unique qui mêle dessins faits à la main et texte manuscrit, organisée selon l'une des sept structures. Tout reste dans votre coffre, dans un seul fichier d'extension `.sketchnote`.

## Ce que fait le plugin

Un sketchnote est une page de la taille que vous choisissez (A5, A4, A3, large, carrée ou une taille libre), organisée selon l'une des sept structures : linéaire, radiale, verticale, chemin, modulaire, gratte-ciel ou pop-corn. Chaque structure donne des zones, et l'on dessine directement dans une zone par un double clic. La page montre alors le sketchnote entier et le mode dessin zoome sur une zone.

Les outils de dessin sont des formes à l'aspect dessiné à la main (rectangle, losange, ellipse, triangle), des bulles de bande dessinée et des festons de plusieurs formes, des lignes et des flèches avec têtes, un stylo à main levée avec dix-sept pinceaux (crayon, feutre, encre, plume, aquarelle, gouache, pastel, fusain et d'autres) montrés dans un menu flottant, de petites formes à tamponner, une gomme qui ne détruit jamais rien (les passages peuvent être retirés) et du texte en polices manuscrites avec des déformations comme l'arc ou la vague.

Les pictogrammes viennent de deux jeux d'icônes (Lucide, que fournit Obsidian, et environ 1 500 icônes de contour de Tabler) et de vos propres fichiers SVG. Les images de votre coffre peuvent être placées sur la page. Deux fenêtres flottantes construisent un bonhomme (huit poses, quinze expressions, trente objets à tenir, des habits) et un personnage en portrait robot (formes de visage, cheveux, chapeaux, barbes, lunettes, couleurs de peau et de cheveux). Une bibliothèque garde les dessins à réutiliser.

Chaque élément peut être déplacé, redimensionné, tourné, retourné, groupé, verrouillé, et recevoir une ombre, un reflet ou une opacité. Une page s'exporte en PNG, JPG, SVG ou PDF, avec un fond transparent, blanc ou coloré et en couleur, en niveaux de gris ou en noir et blanc, ou s'envoie à une imprimante en A4 ou en A3.

## Installer

Sketchnote n'est pas encore dans la liste des plugins de la communauté. Pour l'installer avec BRAT :

1. Dans Obsidian, ouvrez Paramètres, Modules communautaires, puis installez et activez BRAT.
2. Ouvrez les paramètres de BRAT, cliquez sur Add beta plugin, collez `Bigorneau15652/sketchnote`, puis cliquez sur Add plugin.
3. Activez Sketchnote dans les modules communautaires.

## Utiliser

Lancez la commande Créer un sketchnote dans la palette de commandes, ou cliquez sur le crayon du ruban : un sketchnote vide s'ouvre. Le bouton Réglages de la page choisit la structure et la taille de la page. Double-cliquez ensuite sur une zone pour y dessiner. Échap quitte le mode dessin. La colonne de boutons à droite du dessin choisit l'outil ; chaque outil a une touche (par exemple G pour la gomme et P pour le stylo dans la version française), que vous pouvez changer dans les réglages du plugin. Les fonctions qui ne sont pas des outils (icônes, images, bibliothèque, affichage, export, bonhomme, personnage) sont des commandes de la palette : vous pouvez donner un raccourci à chacune dans les réglages d'Obsidian.

## Langues et réglages

Le plugin est en français et en anglais, et suit la langue d'Obsidian (français quand Obsidian est en français, anglais sinon). Les réglages contiennent les dossiers des polices, des icônes, des images, de la bibliothèque et des exports, le mode zen, ainsi que l'ordre et l'affichage des boutons.

## Confidentialité

Le plugin ne fait aucune requête réseau et n'envoie rien nulle part. Les polices, les icônes et les autres données dont il a besoin sont dans le plugin ou dans votre coffre.

## Développement

Lancez `npm install`, puis `npm test` pour les tests et `npm run build` pour fabriquer `main.js`. Les changements de chaque version sont dans CHANGELOG.md, et les licences des œuvres embarquées sont dans NOTICE et dans le dossier licences.

## Licence

MIT. Version anglaise : README.md.
