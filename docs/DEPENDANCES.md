# Dépendances, polices et données

Embarquées dans main.js depuis la version 0.5.0 (accord d'Olivier), toutes sous licence MIT, textes dans le dossier licences :

roughjs 4.6.6 (Preet Shihn) pour l'aspect dessiné à la main des traits, avec ses quatre petits paquets hachure-fill, path-data-parser, points-on-curve et points-on-path. perfect-freehand 1.2.3 (Stephen Ruiz Ltd) pour le stylo libre. Ces bibliothèques ne font aucun accès réseau et ne manipulent que des nombres : leurs sorties (données de tracé) sont vérifiées par une expression régulière avant d'être écrites dans la page (src/shape-paths.ts), et le test tests/safety.test.ts garde l'interdiction de tout accès réseau dans les sources du plugin.

Outils de développement seulement : TypeScript, esbuild, tslib, types Node et types Obsidian.

Polices manuscrites embarquées depuis la version 0.9.0 (accord d'Olivier du 14 novembre 2026), toutes sous licence SIL Open Font License 1.1, textes dans le dossier licences : Caveat (The Caveat Project Authors, licences/OFL-Caveat.txt), Patrick Hand (Patrick Wagesreiter, licences/OFL-PatrickHand.txt), Gloria Hallelujah (Kimberly Geswein, licences/OFL-GloriaHallelujah.txt) et Architects Daughter (Kimberly Geswein, licences/OFL-ArchitectsDaughter.txt). Source : dossier ofl du dépôt https://github.com/google/fonts. L'outil tools/make-fonts.py réduit chaque police au latin (lettres de base, Latin-1, Latin étendu A, ponctuation, euro, quelques flèches et signes), fixe Caveat à sa graisse normale et écrit src/fonts-builtin.ts (WOFF2 en base 64, environ 130 Ko). Cet outil emploie les bibliothèques fonttools et brotli (licence MIT) uniquement pour la fabrication : elles ne sont pas livrées avec le plugin. Aucune de ces polices ne porte de nom réservé. Le plugin les enregistre dans le navigateur au démarrage (src/font-store.ts), sans accès réseau.

Polices ajoutées par l'utilisateur (version 0.9.0) : fichiers .ttf et .otf déposés dans un dossier du coffre (réglage Dossier des polices), ou importés depuis un zip, comme dans le plugin Bigorneau du même auteur. Le plugin ne livre aucune de ces polices et ne télécharge rien : la fenêtre Ajouter une police donne seulement des liens vers des sites de polices libres, que l'utilisateur ouvre dans son navigateur. Le plugin lit lui-même le nom de la famille de chaque fichier (src/font-file.ts) et lit les archives zip (src/zip.ts) sans bibliothèque. La licence de chaque police importée reste de la responsabilité de l'utilisateur.

À venir, avec leur licence au moment voulu : Lucide (ISC) et Tabler icons (MIT) en version 0.10.0.

Avis pour l'audit : npm audit signale esbuild (serveur de développement, non utilisé) et moment (dépendance interne du paquet obsidian, non embarquée dans main.js).
