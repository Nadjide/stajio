# Notes de version

## Version candidate V1 (non publiée)

Le numéro de diffusion reste à choisir (voir V1-706) : `1.0.0` dans `package.json` ne vaut pas validation de la roadmap.

### Nouveautés

- **Configuration en deux étapes** : profil puis échéances proposées (mi-parcours calculé, remise du rapport), chacune facultative et à confirmer. Une configuration interrompue reprend où elle s'était arrêtée.
- **Journal utilisable sans IA** : date choisie librement, avertissement et confirmation hors période, brouillon enregistré automatiquement, recherche et filtre de dates, correction manuelle des champs structurés. La structuration IA devient une proposition à relire ; le texte d'origine n'est jamais remplacé.
- **Compétences** : nouvel onglet avec niveaux déclarés, preuves reliées aux notes, fusion des doublons et suggestions issues du journal. Le tableau de bord présente les objectifs et preuves au lieu de fréquences.
- **Échéances** : alertes à l'ouverture (en retard, sous sept jours), invitation à écrire une note dans la semaine, export calendrier `.ics`.
- **Rapport révisable** : nouvel onglet avec brief, plan modifiable, rédaction et régénération par section, enregistrement automatique, versions et restauration, provenance, validation finale, export Markdown et PDF.
- **Assistant** : conversations et simulations de soutenance enregistrées et reprenables ; réponses interrompues conservées et relançables ; critères d'évaluation visibles.
- **Points CV** : sélection des expériences, correction et sauvegarde des formulations, export texte ou Markdown.
- **Diagnostic IA** dans le profil et route publique `/api/health`.

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

### Mise à jour

1. Exporter ses données depuis Mon Profil.
2. Mettre à jour le dépôt, puis `npm install` et `npm run build`, ou `docker compose up -d --build`.
3. Au premier démarrage, les migrations 4 à 7 créent les nouvelles tables après un instantané automatique dans `backups/` ; voir [DATA_RECOVERY.md](DATA_RECOVERY.md) en cas de problème.
4. Facultatif : ajouter `OLLAMA_NUM_CTX` et `OLLAMA_TIMEOUT_MS` au `.env`.

### Limites connues

- Pas de notification lorsque l'application est fermée ; exporter les échéances vers un calendrier.
- La note des simulations est indicative et dépend du modèle local.
- Un seul stage par compte.
- La qualité des générations n'a pas encore été relue sur un modèle réel avec les [exemples de référence](AI_REFERENCE_EXAMPLES.md), et les durées de génération ne sont pas encore mesurées.
