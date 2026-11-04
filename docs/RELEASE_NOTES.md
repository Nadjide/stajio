# Notes de version

## Version 1.0.0 (4 novembre 2026)

Première version diffusée. Elle couvre les lots 0 à 7 de la [roadmap V1](ROADMAP_V1.md) ; la recette par des étudiants (V1-705) se fera sur cette version et ses retours alimenteront les versions 1.0.x.

### Nouveautés

- **Configuration en deux étapes** : profil puis échéances proposées (mi-parcours calculé, remise du rapport), chacune facultative et à confirmer. Une configuration interrompue reprend où elle s'était arrêtée.
- **Journal utilisable sans IA** : date choisie librement, avertissement et confirmation hors période, brouillon enregistré automatiquement, recherche et filtre de dates, correction manuelle des champs structurés. La structuration IA devient une proposition à relire ; le texte d'origine n'est jamais remplacé.
- **Compétences** : nouvel onglet avec niveaux déclarés, preuves reliées aux notes, fusion des doublons et suggestions issues du journal. Le tableau de bord présente les objectifs et preuves au lieu de fréquences.
- **Échéances** : alertes à l'ouverture (en retard, sous sept jours), invitation à écrire une note dans la semaine, export calendrier `.ics`.
- **Rapport révisable** : nouvel onglet avec brief, plan modifiable, rédaction et régénération par section, enregistrement automatique, versions et restauration, provenance, validation finale, export Markdown et PDF.
- **Assistant** : conversations et simulations de soutenance enregistrées et reprenables ; réponses interrompues conservées et relançables ; critères d'évaluation visibles.
- **Points CV** : sélection des expériences, correction et sauvegarde des formulations, export texte ou Markdown.
- **Diagnostic IA** dans le profil et route publique `/api/health`.
- **Accessibilité** : lien « Aller au contenu », focus clavier visible partout, menu mobile qui reçoit le focus et se ferme avec Échap, contrastes relevés au niveau WCAG AA dans les deux thèmes, champs du profil reliés à leur libellé. Un audit axe-core automatisé couvre tous les écrans (clair, sombre, 360 px).
- **Docker** : `OLLAMA_HOST_PORT` permet de publier Ollama sur un autre port quand un Ollama local occupe déjà `11434`.
- **Vidéo de présentation** : [docs/demo](demo/README.md) contient une vidéo du parcours complet, son aperçu animé pour le README et les scripts qui les régénèrent à partir du jeu de données fictif.

### Changements de comportement

- Les routes IA chargent elles-mêmes le profil et les notes du compte à partir d'identifiants ; elles n'acceptent plus de notes envoyées par le navigateur.
- `/api/ai/stream` renvoie des événements NDJSON (`meta`, `delta`, `done`, `error`) au lieu de texte brut. Les tâches `generateReport`, `chat` et `evaluateAnswer` sont remplacées par `/api/reports`, `/api/conversations/{id}/messages` et `/api/simulations/{id}/answer`.
- Une sélection trop grande pour le contexte du modèle (`OLLAMA_NUM_CTX`, 8192 par défaut) est refusée avec une explication au lieu d'être tronquée.
- Le format de sauvegarde passe en **version 3**. Les exports v1 et v2 restent restaurables (voir [BACKUP_FORMAT.md](BACKUP_FORMAT.md)).
- « Deadlines » devient « Échéances » dans l'interface.

### Corrections

- L'export PDF rendait illisible toute ligne contenant un caractère hors Latin-1 (apostrophe typographique, tiret long, « œ ») ; le texte est désormais normalisé.
- Le dernier fragment d'une réponse en flux n'était pas transmis s'il n'était pas suivi d'un saut de ligne.
- Les échéances initiales imposaient la fin du stage comme date de soutenance et dataient la mi-parcours du jour de l'inscription.
- `next build` n'ouvre plus la base SQLite de l'utilisateur (ouverture à la première requête).
- La proposition de plan de rapport échouait avec phi4-mini, qui renvoie les sections dans un tableau imbriqué ; la préparation de soutenance échouait quand il renvoyait les questions en simples chaînes ou ajoutait une question vide. Ces formes sont désormais normalisées.
- Une section générée qui recommence par son propre titre ne le duplique plus dans le rapport.
- Consignes IA `v2-2026-10` : points CV au participe passé et limités aux réalisations, questions de jury vouvoyées sans civilité ni date ISO, reformulation de soutenance invitée à ne pas ajouter de résultat.
- Les échéances terminées étaient affichées en transparence, rendant leur texte et leurs étiquettes illisibles (contraste 2,3:1).
- Sur ordinateur, la barre de navigation défilait avec les pages longues ; elle reste désormais affichée.

### Maintenance

- Dépendances mises à jour pour corriger les vulnérabilités signalées par `npm audit`, dont une critique dans Next.js (passage à Next.js 16.4, zod 4.6 et Vitest 5, `postcss-selector-parser` forcé en 6.1.5). `npm audit --omit=dev` ne signale plus rien ; seule reste une alerte modérée sur `minimatch`, utilisé par les outils ESLint et absent de l'application.
- Fichiers et dépendances hérités du premier modèle Vite supprimés (`src/main.tsx`, `src/index.css`, `metadata.json`, `dotenv`, `github-markdown-css`, `autoprefixer`).
- La CI vérifie aussi le formatage Prettier.

### Mise à jour

1. Exporter ses données depuis Mon Profil.
2. Mettre à jour le dépôt, puis `npm install` et `npm run build`, ou `docker compose up -d --build`.
3. Au premier démarrage, les migrations 4 à 7 créent les nouvelles tables après un instantané automatique dans `backups/` ; voir [DATA_RECOVERY.md](DATA_RECOVERY.md) en cas de problème.
4. Facultatif : ajouter `OLLAMA_NUM_CTX` et `OLLAMA_TIMEOUT_MS` au `.env`.

### Limites connues

- Pas de notification lorsque l'application est fermée ; exporter les échéances vers un calendrier.
- La note des simulations est indicative et dépend du modèle local.
- Un seul stage par compte.
- Avec phi4-mini sur processeur, une section de rapport prend 2 à 3 minutes et une structuration de note 10 à 45 secondes sur la machine de référence ([mesures](AI_REFERENCE_EXAMPLES.md#mesures-sur-la-machine-de-référence)).
- phi4-mini pose rarement les marqueurs `[À compléter : …]` et peut ajouter un gain non mentionné dans la reformulation d'une réponse de soutenance : relire chaque proposition ([relecture](AI_REFERENCE_EXAMPLES.md#relecture-du-31-octobre-au-3-novembre-2026-phi4-mini)).
- Pas encore de recette par des étudiants ni de passage au lecteur d'écran ; l'import du `.ics` est vérifié par un analyseur, pas dans un agenda réel.
