# CLAUDE.md : socle commun des projets d'Olivier

Lis ce fichier avant d'écrire la moindre ligne de code. Applique chaque règle. Si une règle semble en conflit avec la demande, signale-le avant de coder. Les règles propres à un type de projet sont dans les skills du dossier .claude/skills : ouvre celui qui correspond au projet (widget-grist, plugin-obsidian, automatisation-python).

## Utilisateur
- Olivier Holweck, chargé de mission bâtiment durable et décarbonation à l'Université de Montpellier Paul Valéry (UMPV). Écrire « UMPV », jamais « Paul Valéry Montpellier 3 ».
- Non-informaticien. Il ne connaît ni le code ni les bibliothèques : choisis toi-même les techniques en lisant le dépôt, ne lui pose jamais de question technique.
- Pose seulement des questions de besoin, par petits groupes, avec une recommandation. Travaille par petites versions testables une par une.
- Réponds en français, ton professionnel et factuel, sans flatterie ni emoji.
- Texte destiné à Word : pas de trait horizontal, pas de puces inutiles, jamais de virgule devant « et », pas de tiret long au milieu d'une phrase.
- Quand tu produis un texte suivi de commentaires, sépare-les par un trait horizontal.
- Les sessions sont des sessions Claude Code sur le web : les changements arrivent en pull request en brouillon qu'Olivier valide sur GitHub. Pour chaque étape GitHub, donne le nom exact des boutons (skill etapes-github).

## Règles de code communes
- Toutes les chaînes de caractères en template literals (backticks), jamais d'apostrophes ni de guillemets : l'apostrophe française provoque « Unexpected token, expected ; ». Vérifie les caractères spéciaux avant de livrer.
- Identifiants et commentaires en anglais, un court bloc au-dessus de chaque fichier et de chaque fonction. Textes affichés en français avec traduction anglaise, via le fichier de traductions du projet.
- Aucun code ni bibliothèque chargés depuis un CDN : copie le nécessaire dans le dépôt avec sa licence. Aucun `eval`, aucun `new Function`. Données de l'utilisateur insérées comme texte, jamais comme HTML.
- Liens https sans identifiants seulement. Content-Security-Policy aussi stricte que possible.
- Aucune dépendance, police ou fichier de données sans accord d'Olivier ; enregistre-les avec leur licence. Aucune bibliothèque payante sans accord explicite.
- Jamais de clé d'API, mot de passe ou identifiant réel dans un fichier : utilise les variables d'environnement ou les secrets GitHub.
- Dans un dépôt public, aucun vrai nom de table ou de colonne, chiffre ou lien d'Olivier : données inventées dans le code, les tests, les commentaires, les commits et les pull requests.
- Logique dans des modules purs (sans accès à la page ni à l'application) testés avec `node --test`. Un test par comportement. Ne désactive et n'affaiblis jamais un test pour obtenir un résultat vert.
- Valide toute valeur lue dans un réglage, une note ou une configuration avant usage.
- Ne renomme pas une clé d'option, une classe CSS ou un identifiant déjà publié : des réglages enregistrés en dépendent. Migration versionnée pour changer un format.
- Messages lisibles à 340 px de large et en mode sombre : couleurs explicites, texte à la ligne, pas de texte tronqué.
- Avant de créer un fichier, vérifie que le nom n'existe pas.

## Versions et pull requests
- Nouvelle fonction : dizaine suivante (0.15.0 puis 0.16.0). Correction : dernier chiffre (0.16.1).
- Commit : `Version 0.16.1 : description courte en français`. Travaille sur la branche imposée, pousse, ouvre une pull request en brouillon, abonne-toi à son suivi. Après fusion, repars de la branche principale.
- Journal des modifications CHANGELOG.md : une section par version, en anglais puis en français.
- Annonce à Olivier le nom exact de la release : numéro de version sans « v », identique au titre de la pull request.

## Fin de session
Applique le skill fin-de-session : relis ce qui a été durablement appris, propose les ajouts à ce fichier, ne modifie jamais une règle sans le signaler à Olivier.

## Erreurs à ne jamais reproduire
- Question technique posée à Olivier : trouve l'information dans les dépôts avant de demander.
- Release publiée sous un mauvais numéro : annonce toujours le nom exact.
- Fichier de test existant écrasé : vérifie l'existence avant de créer.
- Boucle infinie dans un parcours de texte par lignes : teste exhaustivement.
- Rendu d'une liste d'éléments cassé par un élément `undefined` : protège chaque élément par try/catch et enregistre l'erreur.
- Aperçu limité en hauteur qui coupe un cadre : ne limite pas la hauteur d'un aperçu qui contient un trait.

## Journal des mises à jour
- [2026-10-31] Création du socle.

## Projet Sketchnote
Plugin Obsidian de sketchnotes. Lis docs/PROJET.md : décisions d'Olivier, règles techniques propres au projet et plan des versions.
