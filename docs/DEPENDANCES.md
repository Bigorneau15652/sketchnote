# Dépendances, polices et données

Embarquées dans main.js depuis la version 0.5.0 (accord d'Olivier), toutes sous licence MIT, textes dans le dossier licences :

roughjs 4.6.6 (Preet Shihn) pour l'aspect dessiné à la main des traits, avec ses quatre petits paquets hachure-fill, path-data-parser, points-on-curve et points-on-path. perfect-freehand 1.2.3 (Stephen Ruiz Ltd) pour le stylo libre. Ces bibliothèques ne font aucun accès réseau et ne manipulent que des nombres : leurs sorties (données de tracé) sont vérifiées par une expression régulière avant d'être écrites dans la page (src/shape-paths.ts), et le test tests/safety.test.ts garde l'interdiction de tout accès réseau dans les sources du plugin.

Outils de développement seulement : TypeScript, esbuild, tslib, types Node et types Obsidian.

À venir, avec leur licence au moment voulu : Lucide (ISC) et Tabler icons (MIT) en version 0.8.0, trois ou quatre polices manuscrites sous licence SIL Open Font License en version 0.7.0.

Avis pour l'audit : npm audit signale esbuild (serveur de développement, non utilisé) et moment (dépendance interne du paquet obsidian, non embarquée dans main.js).
