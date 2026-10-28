# Exemples de référence pour relire l'IA

Ces cas fictifs servent à relire les résultats d'un modèle réel (V1-307) après un changement de modèle, de consignes (`PROMPT_VERSION` dans `src/server/ai/prompts.ts`) ou de paramètres (`OLLAMA_NUM_CTX`). Les tests automatisés vérifient le format des réponses ; seule une relecture humaine vérifie leur fidélité.

Pour chaque cas : importer [le jeu de données fictif](fixtures/demo-backup.json) dans un compte de test, lancer la tâche, puis cocher la grille.

## Grille commune

- [ ] Aucun chiffre, pourcentage, durée, nom d'outil, de personne ou d'entreprise absent des notes.
- [ ] Les informations manquantes apparaissent sous la forme `[À compléter : …]`.
- [ ] Le texte est en français, sobre, sans formule promotionnelle.
- [ ] La réponse respecte le format attendu (JSON valide ou Markdown sans titre de section répété).

## Cas 1 — Structurer une note

Note : « Tests d'intégration de l'API d'historique. Découverte d'une requête lente ; ajout d'un index après analyse du plan d'exécution. »

Attendu : un résumé fidèle ; des missions du type « Écrire les tests d'intégration », « Optimiser une requête » ; technologies vides ou limitées à ce qui est cité (aucune base de données nommée si la note n'en cite pas) ; compétences du type « Tests automatisés », « Optimisation de performances ».

À refuser : un gain de performance chiffré (« requête 10 fois plus rapide »), un outil non cité.

## Cas 2 — Rédiger la section « Missions réalisées »

Brief : consignes « 20 à 25 pages, plan libre », problématique « Comment fiabiliser l'historique des réservations ? », toutes les notes.

Attendu : des sous-parties `###` reprenant l'API d'historique, l'export CSV, la CI et le déploiement, chacune rattachée à des notes datées ; un marqueur `[À compléter : …]` pour les résultats mesurables absents (volumes, délais).

À refuser : un nombre d'utilisateurs, un pourcentage de couverture de tests ou un retour de la tutrice qui ne figure pas dans les notes.

## Cas 3 — Points CV

Sources : notes 05, 06, 08 et 11 du jeu fictif.

Attendu : 4 à 8 puces commençant par un verbe d'action (« Développé… », « Optimisé… », « Déployé… »), chaque chiffre remplacé par `[À compléter : chiffre ou résultat mesurable]`.

## Cas 4 — Évaluer une réponse de soutenance

Question : « Quelle difficulté as-tu rencontrée et comment l'as-tu surmontée ? » Réponse : « La requête d'historique était lente, j'ai ajouté un index. »

Attendu : une note entre 4 et 7 (réponse pertinente mais brève), un retour qui cite les critères « Exemples concrets » ou « Recul », une formulation améliorée qui n'invente pas le gain obtenu.

## Cas 5 — Sélection trop grande

Avec `OLLAMA_NUM_CTX=2048`, demander un rapport sur toutes les notes : Stajio doit refuser avant l'appel, indiquer la taille estimée et proposer de réduire la période ou de générer par section.

## Mesures sur la machine de référence

Les durées dépendent du matériel ; noter ici les valeurs observées plutôt que de promettre un délai.

| Date        | Machine | Modèle    | Tâche               | Durée | Remarques |
| ----------- | ------- | --------- | ------------------- | ----- | --------- |
| à compléter |         | phi4-mini | Structurer une note |       |           |
| à compléter |         | phi4-mini | Section de rapport  |       |           |
