# Sauvegardes et récupération de la base

Stajio applique les migrations SQLite au démarrage. Leur historique est enregistré dans `schema_migrations`.

Avant de modifier une base existante, Stajio crée une sauvegarde SQLite autonome dans `backups/`, à côté de la base configurée par `STAJIO_DB_PATH`. Avec Docker, ce dossier est dans le volume persistant `/app/data/backups`. Une installation neuve ou une base en mémoire n'a pas de données à sauvegarder.

Une sauvegarde est créée avant toute écriture de migration. Si sa création échoue, la migration est abandonnée. Les modifications de schéma sont transactionnelles : un échec les annule. Les sauvegardes contiennent les données privées et les mots de passe hashés ; conserver ce dossier sur le poste et l'inclure dans les sauvegardes du volume. Il n'est pas versionné dans Git.

## Vérifier une récupération sans écraser la base

1. Arrêter Stajio. Conserver la base courante et les éventuels fichiers associés.
2. Choisir un fichier autonome créé dans `backups/` avant la migration concernée.
3. Créer une copie récupérée dans un **nouveau fichier** :

   ```bash
   npm run db:recover -- --backup "backups/stajio.db.v0-to-3.EXEMPLE.sqlite" --output "recovery/stajio-recovered.db"
   ```

4. La commande vérifie l'intégrité SQLite et refuse d'écraser un fichier existant. Elle ne migre pas la copie.
5. Définir `STAJIO_DB_PATH` avec le chemin absolu de cette copie, puis démarrer une version compatible de Stajio. Une version récente pourra y appliquer ses migrations ; conserver le fichier de sauvegarde original pour revenir à une version antérieure.
6. Vérifier le profil, les notes, les échéances et l'historique. Ne sélectionner la copie comme base habituelle qu'après cette vérification.

Pour Docker, les scripts d'administration sont disponibles dans l'image sous `/app/scripts`. Arrêter l'application, puis lancer la commande dans un conteneur ponctuel utilisant le même volume :

```bash
docker compose stop app
docker compose run --rm --no-deps app node scripts/db-recover.mjs --backup /app/data/backups/FICHIER.sqlite --output /app/data/recovery/stajio-recovered.db
```

Configurer ensuite `STAJIO_DB_PATH` pour utiliser `/app/data/recovery/stajio-recovered.db` avant de redémarrer. Les sauvegardes de migration sont des instantanés de toute la base ; l'export JSON depuis le profil sert à transférer les seules données métier du compte connecté.
