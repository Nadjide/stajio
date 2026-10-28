# Mot de passe et suppression du compte

## Depuis le profil

Le changement de mot de passe demande le mot de passe actuel. Un nouveau mot de passe doit contenir au moins 8 caractères et au plus 72 octets UTF-8 ; certains caractères accentués et emoji occupent plusieurs octets. Les mots de passe ne sont jamais inclus dans les exports JSON.

Le changement révoque les anciennes sessions. Le navigateur qui effectue l'opération reçoit une nouvelle session. Les autres appareils ou onglets utilisant l'ancienne session doivent se reconnecter.

Deux suppressions sont proposées après saisie du mot de passe actuel et confirmation `SUPPRIMER` :

- **Données du stage :** efface le journal, les échéances et l'historique IA ; remet les informations de stage à configurer ; conserve le compte, son nom, son adresse et son mot de passe.
- **Compte :** efface le compte et ses données et termine sa session.

L'interface propose d'exporter les données avant de confirmer. Une suppression ne détruit pas les exports ou sauvegardes de migration déjà créés : leur propriétaire les gère séparément.

## Récupération locale par le propriétaire de la machine

Cette procédure s'adresse à la personne disposant de l'accès local au fichier SQLite ou au volume Docker. Elle ne passe par aucune route web et ne nécessite pas l'ancien mot de passe. L'accès au fichier donne déjà accès aux données : conserver les bases et sauvegardes dans un emplacement privé.

1. Arrêter Stajio et conserver une sauvegarde de la base. Pour récupérer un instantané sur une nouvelle copie, suivre [DATA_RECOVERY.md](DATA_RECOVERY.md).
2. Indiquer explicitement le chemin de la base existante et l'adresse du compte. Depuis la racine du projet :

   ```bash
   npm run account:reset-password -- --db "/chemin/absolu/stajio.db" --email "etudiant@exemple.fr"
   ```

   Avec PowerShell :

   ```powershell
   npm run account:reset-password -- --db "C:\chemin\stajio.db" --email "etudiant@exemple.fr"
   ```

   `STAJIO_DB_PATH` peut remplacer `--db` s'il est explicitement défini dans le terminal. Le script ne charge pas automatiquement `.env` et n'utilise pas le fichier `stajio.db` du dossier courant par défaut.

3. Vérifier la base et le compte affichés, puis saisir deux fois le nouveau mot de passe dans le terminal. La saisie est cachée ; ne placer le mot de passe ni dans les arguments ni dans une variable d'environnement.
4. Redémarrer Stajio et se connecter avec le nouveau mot de passe. Toutes les anciennes sessions du compte sont invalidées. Les notes, les échéances et les générations sont conservées, ainsi que les autres comptes.

La commande refuse de créer une base absente et vérifie le schéma Stajio avant toute écriture ou migration. Une ancienne base Stajio reconnue est migrée avec une sauvegarde préalable. Un changement concurrent de mot de passe ou de version de session fait échouer l'opération plutôt que d'écraser ce changement.

## Avec Docker

L'image contient le script. Arrêter le service et utiliser un conteneur ponctuel sur le même volume :

```bash
docker compose stop app
docker compose run --rm --no-deps app node scripts/reset-password.mjs --db /app/data/stajio.db --email "etudiant@exemple.fr"
docker compose start app
```

Adapter le chemin si `STAJIO_DB_PATH` cible une copie récupérée. Le terminal doit rester interactif pour cacher la saisie.

## Entrée standard pour tests et outils locaux

L'option explicite `--stdin` accepte exactement deux lignes identiques depuis un flux non interactif : nouveau mot de passe puis confirmation. Ce mode permet aux tests automatisés d'utiliser uniquement des bases temporaires et à un outil local de confiance de fournir un secret via un pipe protégé. Sans cette option, le script refuse un flux non interactif.

Ne pas écrire de commande contenant le mot de passe dans l'historique du shell ; ne pas le stocker dans des arguments, variables d'environnement, journaux ou fichiers temporaires. Utiliser la saisie interactive pour la récupération manuelle.
