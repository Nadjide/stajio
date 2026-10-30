# Spécification Stajio V1

Fiche de référence du périmètre V1 (lot 0 de la [roadmap](ROADMAP_V1.md)). Elle décrit ce que l'application doit faire et comment le vérifier.

## 1. Contrat produit (V1-001)

**Cible.** Un étudiant en stage ou en alternance qui utilise Stajio sur son propre ordinateur.

**Promesse.** Transformer ses notes d'activité en preuves de compétences et en livrables adaptés à son école, avec des données et une IA locales.

**Parcours central.** Configurer son stage → noter ses activités → organiser ses compétences et échéances → préparer un rapport → le corriger → l'exporter. L'assistant, les points CV et l'entraînement à la soutenance complètent ce parcours.

**Inclus en V1.**

| Domaine       | Fonctionnalités                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Compte        | Inscription, connexion, changement et récupération locale du mot de passe, suppression des données ou du compte              |
| Configuration | Profil du stage, échéances initiales proposées et confirmées, reprise d'une configuration interrompue                        |
| Journal       | Notes datées sans IA, brouillon automatique, recherche, filtre de période, correction manuelle, structuration IA facultative |
| Compétences   | Liste validée, niveau déclaré, preuves liées aux notes, fusion et renommage, suggestions IA                                  |
| Échéances     | Liste, rappels à l'ouverture, export `.ics`                                                                                  |
| Rapport       | Brief, plan modifiable, rédaction par section, versions, provenance, validation, export Markdown et PDF                      |
| Assistant     | Conversations enregistrées et reprenables, simulations de soutenance sauvegardées, points CV corrigés                        |
| Données       | Export JSON complet et restauration par remplacement, isolation des comptes                                                  |

**Exclus de la V1.** Synchronisation cloud, abonnement, application mobile native, portail tuteur ou école, collaboration, plusieurs stages par compte, mapping RNCP automatique, pièces jointes, éditeur bureautique, notifications quand l'application est fermée, analyse de progression entre simulations.

## 2. Règles métier (V1-002)

- **Une période active par compte.** Le profil porte une date de début et une date de fin valides (`AAAA-MM-JJ`, date calendaire réelle). La fin est postérieure ou égale au début.
- **Convention de semaine.** La semaine 1 commence le premier jour du stage et dure sept jours ; chaque semaine suivante dure sept jours. Le calcul est en jours calendaires UTC, indépendant des changements d'heure. Le serveur recalcule toujours la semaine à partir de la date ; un numéro envoyé par un client est ignoré.
- **Notes hors période.** Une note datée avant le début est classée « Avant le stage » (semaine 0) ; après la fin, « Après le stage (semaine n) ». L'interface signale la situation et exige une confirmation explicite avant l'enregistrement. Changer les dates du stage recalcule les semaines de toutes les notes.
- **Mi-période.** Le point mi-parcours proposé est le jour calendaire situé au milieu de la période (arrondi vers le début). La soutenance n'est jamais datée automatiquement à la fin du stage.
- **Texte brut.** Le texte saisi par l'étudiant n'est jamais remplacé par l'IA. Les champs structurés (résumé, missions, technologies, compétences repérées) sont des propositions modifiables.
- **Propositions IA.** Toute génération est une proposition : elle est relue avant d'être appliquée, et une erreur, une annulation ou une réponse invalide ne modifie aucune donnée existante.
- **Brouillons.** Les brouillons sont enregistrés côté serveur pour le compte connecté, proposés à la reconnexion, jamais visibles depuis un autre compte, inclus dans la sauvegarde et supprimés quand leur contenu est enregistré.
- **Versions de rapport.** Une version est créée sur demande, avant chaque remplacement d'une section par l'IA, avant le remplacement du plan et avant chaque restauration. Corriger un rapport validé le repasse en brouillon.
- **Contexte IA.** La taille envoyée au modèle est estimée avant l'appel ; une sélection trop grande est refusée avec une explication plutôt que tronquée.

## 3. Vocabulaire de l'interface (V1-004)

| Terme                   | Définition                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Stage / alternance      | La période unique décrite dans le profil. L'interface emploie « stage » pour les deux.                            |
| Note (du journal)       | Ce que l'étudiant a fait à une date donnée, dans ses mots. C'est la source de toutes les preuves et générations.  |
| Notes sources           | Les notes sélectionnées pour une génération ; leur texte est copié dans la provenance au moment de la génération. |
| Compétence              | Un savoir-faire choisi par l'étudiant, avec un objectif facultatif.                                               |
| Niveau déclaré          | Auto-évaluation de l'étudiant : « À travailler », « En pratique », « Autonome ». Ce n'est pas une mesure.         |
| Preuve                  | Lien entre une compétence et une note qui la démontre.                                                            |
| Compétences repérées    | Libellés proposés par l'IA dans une note ; ils deviennent des compétences seulement si l'étudiant les ajoute.     |
| Échéance                | Date à respecter, de type « École » ou « Entreprise ».                                                            |
| Brouillon               | Saisie non encore enregistrée comme note, configuration ou modification.                                          |
| Brief                   | Consignes de l'école, problématique, longueur attendue, période et notes sources d'un rapport.                    |
| Version de rapport      | Copie nommée du titre et des sections, restaurable.                                                               |
| Passage « À compléter » | Marqueur `[À compléter : …]` laissé par l'IA à la place d'une information absente.                                |
| Note indicative         | Score de 0 à 10 d'une réponse de simulation, aide à l'entraînement sans valeur d'évaluation.                      |

## 4. Scénario de recette (V1-003)

À exécuter sur une installation propre, avec des données fictives (par exemple [demo-backup.json](fixtures/demo-backup.json), importable depuis Mon Profil, ou une saisie manuelle). Chaque étape renvoie aux tâches de la roadmap et aux vérifications automatisées existantes.

| #   | Étape                                                                             | Critère observable                                                                         | Tâches                  | Vérification automatisée                                      |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------- |
| 1   | Créer un compte, configurer le stage, confirmer les échéances                     | Seules les échéances cochées et datées sont créées ; une configuration interrompue reprend | V1-201, V1-202          | `tests/e2e/v1-journey.spec.ts`, `tests/api/workspace.test.ts` |
| 2   | Ollama arrêté : enregistrer une note datée, garder un brouillon, recharger        | La note et le brouillon sont retrouvés ; le brouillon n'apparaît pas dans un autre compte  | V1-203 à V1-205, V1-207 | `tests/e2e/v1-journey.spec.ts`                                |
| 3   | Ollama démarré : structurer la note, corriger, l'associer à une compétence        | Le texte brut est intact ; la compétence affiche la preuve                                 | V1-206, V1-501, V1-502  | E2E (structuration simulée), `workspace.test.ts`              |
| 4   | Retrouver ses échéances et importer le `.ics` dans un calendrier                  | Les événements apparaissent à la bonne date                                                | V1-504                  | `workspace.test.ts` (format) ; import manuel à vérifier       |
| 5   | Renseigner les consignes, choisir les notes, valider un plan, générer             | Les informations manquantes sont listées ; la génération est annulable                     | V1-401, V1-402, V1-303  | `ai-foundation.test.ts`                                       |
| 6   | Corriger, quitter, reprendre la bonne version, exporter un PDF                    | Le PDF contient les corrections, accents compris                                           | V1-403 à V1-405         | `tests/e2e/v1-journey.spec.ts`, `report-export.test.ts`       |
| 7   | Reprendre une conversation et une simulation ; sauvegarder des points CV corrigés | Les échanges et réponses sont retrouvés après rechargement                                 | V1-601 à V1-604         | `workspace.test.ts`                                           |
| 8   | Exporter puis restaurer toutes les données, deux fois                             | Profil, liens, contenus et versions identiques ; aucun doublon                             | V1-406, V1-505, V1-605  | `backup-restore.test.ts`, `demo-fixture.test.ts`              |
| 9   | Ouvrir un second compte                                                           | Aucun contenu du premier n'est accessible ; les routes IA refusent les appels anonymes     | V1-101, V1-605          | `workspace.test.ts`, `ai-auth.test.ts`, `isolation.test.ts`   |
| 10  | Provoquer erreurs de modèle, annulations et import invalide                       | Aucune donnée ni correction n'est perdue                                                   | V1-302 à V1-304         | `ai-foundation.test.ts`, `backup-restore.test.ts`             |

La génération réelle doit en plus être relue sur les [exemples de référence](AI_REFERENCE_EXAMPLES.md) avec le modèle conseillé, et la procédure de mise à jour et de récupération exécutée sur une copie de base.
