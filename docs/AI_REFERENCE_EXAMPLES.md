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

Machine de référence : portable Intel Core i7-1165G7 (4 cœurs, 8 threads), 16 Go de RAM, Intel Iris Xe sans carte graphique dédiée. Stajio et Ollama tournent dans Docker Desktop (8 vCPU, 7,7 Gio) : l'inférence se fait sur le processeur. `OLLAMA_NUM_CTX=8192`, jeu de données fictif complet (15 notes). « Premier mot » n'a de sens que pour les tâches en flux.

| Date              | Modèle    | Tâche                                  | Premier mot | Durée totale | Remarques                                 |
| ----------------- | --------- | -------------------------------------- | ----------- | ------------ | ----------------------------------------- |
| 31 oct. au 3 nov. | phi4-mini | Structurer une note (modèle à charger) | sans flux   | 16 à 46 s    | Premier appel après le démarrage d'Ollama |
| 31 oct. au 3 nov. | phi4-mini | Structurer une note (modèle chargé)    | sans flux   | 9 à 17 s     |                                           |
| 31 oct. au 3 nov. | phi4-mini | Proposer un plan de rapport (15 notes) | sans flux   | 39 à 76 s    |                                           |
| 31 oct. au 3 nov. | phi4-mini | Section de rapport (15 notes)          | 35 à 38 s   | 140 à 169 s  | Environ 600 mots générés                  |
| 31 oct. au 3 nov. | phi4-mini | Points CV (4 notes)                    | 13 à 15 s   | 26 à 40 s    |                                           |
| 31 oct. au 3 nov. | phi4-mini | Évaluer une réponse de soutenance      | sans flux   | 22 à 60 s    | Selon la longueur du retour               |
| 31 oct. au 3 nov. | phi4-mini | Préparer la soutenance (15 notes)      | sans flux   | 68 à 101 s   |                                           |
| 3 nov.            | phi4-mini | Sélection trop grande (contexte 2048)  | sans flux   | 0,01 s       | Refus avant tout appel au modèle (cas 5)  |

## Relecture du 31 octobre au 3 novembre 2026 (phi4-mini)

Trois passes : consignes `v1-2026-10`, puis `v2-2026-10` après correction des écarts relevés, puis validation de l'image finale. Les sorties brutes ne sont pas versionnées ; les relancer avec le jeu fictif pour comparer.

**Cas 1 : structurer une note.** Aucun chiffre ni base de données inventés. Écarts : une passe oublie l'écriture des tests d'intégration ; les technologies sont parfois remplies de libellés génériques (« outil d'analyse de plan d'exécution ») au lieu d'une liste vide ; une passe renvoie les technologies en une seule chaîne, désormais découpée en liste (4 structurations sur 4 réussies ensuite). Acceptable : la proposition est relue avant application.

**Cas 2 : section « Missions réalisées ».** Aucun chiffre, utilisateur, taux de couverture ou retour de tutrice inventé ; les notes sont reprises dans l'ordre avec leurs technologies. Écarts : le titre de la section est répété (désormais retiré automatiquement à l'application) et aucun marqueur `[À compléter : …]` n'est posé pour les résultats absents. Une consigne demandant de dater chaque mission a été essayée puis retirée : le modèle rattachait 4 missions sur 13 à une mauvaise date et ajoutait des « résultats » tautologiques. À relire systématiquement.

**Cas 3 : points CV.** 5 à 6 puces fidèles, sans chiffre inventé. Avec `v2-2026-10`, les puces commencent par un participe passé et ne mentionnent plus la tutrice ni les dates du stage.

**Cas 4 : évaluer une réponse.** Note de 6/10 à chaque passe, retour qui cite le manque d'exemples concrets et de résultat. Écart persistant malgré une consigne renforcée : la « meilleure formulation » affirme un gain (« a considérablement accéléré la récupération des données ») et précise l'index (« sur la colonne d'historique ») sans que la réponse le dise. Limite connue du modèle : l'étudiant doit relire la reformulation avant de la réutiliser.

**Cas 5 : sélection trop grande.** Avec `OLLAMA_NUM_CTX=2048`, `/api/ai/estimate` annonce environ 1 770 jetons pour une limite de 1 536 (`fits: false`) et la génération est refusée en 413 avant tout appel au modèle, avec la taille estimée et la suggestion de réduire la période ou le nombre de notes.

**Plan de rapport.** phi4-mini renvoie les sections dans un tableau imbriqué (`{"sections":[[…]]}`) : la proposition échouait à chaque essai. Après normalisation, 3 plans sur 3 sont acceptés (5 à 8 sections). Leur qualité varie : un plan sur trois propose des sections hors sujet (« Formation », « Tuteur ») à corriger dans l'éditeur.

**Préparation de soutenance.** La première passe formule les questions à la troisième personne avec des dates ISO et termine par une « question » réduite à `:` ; une autre renvoie les questions en simples chaînes ; une autre encore interpelle l'étudiante en « Madame Camille ». Ces formes sont désormais acceptées ou écartées, et la consigne demande de vouvoyer sans nommer ni employer de civilité : 2 préparations sur 2 conformes ensuite (6 et 9 questions).
