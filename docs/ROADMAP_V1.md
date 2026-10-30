# Roadmap Stajio V1

Date : 27 octobre 2026. Proposition de périmètre et de séquencement fondée sur l'audit du dépôt.

## 1. Contrat produit proposé

**Promesse :** aider un étudiant à transformer ses notes d'activité en preuves de compétences et en livrables adaptés à son école, avec des données et une IA locales.

**Utilisateur principal :** un étudiant en stage ou en alternance, sur son propre ordinateur. Un stage ou une alternance active par compte en V1. Les comptes existants restent isolés.

**Parcours central :** configurer son stage → noter ses activités → organiser ses compétences et échéances → préparer un rapport → le corriger → l'exporter. L'assistant, les points CV et l'entraînement à la soutenance complètent ce parcours.

**Contraintes de V1 :**

- Les données restent utilisables et enregistrables quand Ollama est arrêté.
- L'étudiant conserve la maîtrise du texte brut et valide les propositions IA.
- Un rapport peut être repris et corrigé avant son export.
- Une sauvegarde restaure toutes les données métier du compte, sans doublons.
- L'installation et la mise à jour sont documentées et vérifiées.

**Périmètre reporté après la V1 :** synchronisation cloud, abonnement/paiement, application mobile native, portail tuteur/école, collaboration, plusieurs stages par compte, mapping RNCP automatique, pièces jointes et éditeur bureautique complet. Les preuves de compétences de V1 sont des liens vers les notes du journal. Les consignes d'école sont saisies ou collées en texte.

## 2. Règles d'exécution

- **P0 :** nécessaire à la fiabilité du parcours central.
- **P1 :** nécessaire pour terminer le périmètre V1 annoncé.
- **P2 :** amélioration prévue après V1.
- Exécuter les lots dans l'ordre ci-dessous. Tous les lots 0 à 7 sont requis pour la V1 proposée.
- Livrer et vérifier chaque lot avant de passer au suivant. Ajouter les tests de comportement utiles avec chaque changement.
- Découper les tâches pour qu'une livraison reste petite et vérifiable. Ne pas lancer une refonte globale du modèle de données : ajouter les migrations au moment où une fonctionnalité en a besoin.
- Recalibrer l'effort après les lots 1 et 2. Cette roadmap fixe un ordre de travail ; aucune date de livraison n'est engagée sans connaître le temps disponible.

## 3. Backlog dans l'ordre de priorité

### Lot 0 — Fixer la définition de la V1 · P0

Objectif : disposer d'un périmètre stable et d'une définition observable de « terminé ».

- [x] **V1-001** Reprendre le contrat produit ci-dessus dans une courte fiche de spécification : cible, promesse, parcours central, fonctionnalités incluses et exclusions.
- [x] **V1-002** Décrire les règles métier : une période active par compte, dates valides, convention unique de semaine et comportement des notes hors période. Proposition : semaine 1 du début du stage au sixième jour suivant, puis périodes de sept jours ; signaler une note hors période avant son enregistrement.
- [x] **V1-003** Écrire le scénario de recette final décrit en section 4 et préparer un jeu de données fictif couvrant plusieurs mois, sans données personnelles réelles.
- [x] **V1-004** Définir les termes affichés dans l'interface : stage/alternance, compétences, niveaux déclarés, notes sources, brouillon et version de rapport.

**Sortie du lot :** les règles de V1 sont écrites ; chaque fonctionnalité obligatoire est reliée à une tâche et à un critère de recette.

**État au 28 octobre 2026 : terminé.** Contrat, règles métier, vocabulaire et scénario de recette relié aux tâches et aux tests : [SPEC_V1.md](SPEC_V1.md). Jeu de données fictif sur six mois : [fixtures/demo-backup.json](fixtures/demo-backup.json), vérifié par `tests/api/demo-fixture.test.ts`.

### Lot 1 — Protéger et restaurer les données · P0

Dépendance : lot 0. Zones principales : `src/server`, `app/api/import`, `app/api/export`, configuration Docker et tests.

- [x] **V1-101** Isoler automatiquement les bases de tests unitaires/API et E2E ; aucun test ne doit ouvrir la base utilisateur ou réutiliser son serveur.
- [x] **V1-102** Introduire des migrations SQLite versionnées, avec sauvegarde avant migration et procédure de récupération vérifiée sur une copie.
- [x] **V1-103** Exiger un secret JWT dédié en production ; protéger les routes IA par authentification ; limiter par défaut l'exposition Docker de Stajio et Ollama à la machine locale. Documenter la configuration HTTPS pour les installations accessibles sur un réseau.
- [x] **V1-104** Valider les dates réelles et la cohérence début/fin ; centraliser le calcul de semaine utilisé par le journal, le tableau de bord et la timeline.
- [x] **V1-105** Définir un format d'export versionné. Inclure le profil et chaque collection métier livrée ensuite : notes, brouillons, échéances, compétences, rapports et versions, résultats CV, conversations et simulations. Exclure les mots de passe et secrets ; le compte connecté reçoit la restauration.
- [x] **V1-106** Livrer une seule opération d'import en V1 : **remplacer les données métier du compte courant par la sauvegarde**. Afficher un aperçu, proposer l'export préalable, demander confirmation, valider la version et appliquer le remplacement dans une transaction. Préserver les relations et ne modifier aucun autre compte.
- [x] **V1-107** Ajouter le changement de mot de passe et documenter une procédure locale de récupération réservée au propriétaire de la machine. Permettre la suppression de ses données/du compte après confirmation.

**Sortie du lot :** exporter puis restaurer retrouve le même profil et les mêmes contenus ; répéter la restauration ne crée aucun doublon ; un fichier invalide n'écrit rien ; les accès d'un autre compte sont refusés. Les migrations et la récupération sont vérifiées.

**État au 28 octobre 2026 : terminé.** Les sept tâches du lot sont implémentées. Validation : 152 tests unitaires/API, 10 tests navigateur, TypeScript, ESLint et build de production réussis ; la base utilisateur existante est restée inchangée. Le format JSON v2 couvre les collections actuellement livrées ; les prochains lots étendront explicitement le format pour leurs nouvelles collections. Les procédures sont décrites dans [DATA_RECOVERY.md](DATA_RECOVERY.md), [BACKUP_FORMAT.md](BACKUP_FORMAT.md) et [ACCOUNT_RECOVERY.md](ACCOUNT_RECOVERY.md).

### Lot 2 — Terminer l'onboarding et le journal · P0

Dépendance : lot 1. Zones principales : `ProfileSetupPage`, `JournalTab`, profil, logs et navigation.

- [x] **V1-201** Afficher les erreurs de configuration et l'état d'enregistrement ; empêcher les doubles soumissions ; permettre de reprendre une configuration interrompue.
- [x] **V1-202** Proposer des échéances initiales modifiables et facultatives. Faire confirmer leurs dates ; calculer réellement la mi-période ; ne pas imposer la date de fin du stage comme date de soutenance.
- [x] **V1-203** Enregistrer une nouvelle note brute sans appeler l'IA. Proposer ensuite une action facultative « Structurer avec l'IA » ; conserver le texte brut lors de toute régénération.
- [x] **V1-204** Conserver automatiquement les brouillons sur le poste, séparément par compte, avec un état de sauvegarde visible et un comportement explicite à la déconnexion. Les inclure dans l'export et la restauration du compte.
- [x] **V1-205** Permettre de choisir et corriger la date d'une note ; recalculer sa semaine selon la règle de V1. Ajouter recherche textuelle et filtre de période.
- [x] **V1-206** Permettre la correction manuelle du résumé, des missions, technologies et compétences extraites. Une erreur IA ne doit jamais effacer les données déjà saisies.
- [x] **V1-207** Distinguer chargement, liste vide et erreur de récupération, avec une action de réessai. Préserver la saisie lors d'un incident.

**Sortie du lot :** Ollama arrêté, l'étudiant peut configurer son stage, enregistrer une note à une date passée, la retrouver après rechargement et la modifier. Un brouillon survit à une fermeture et ne s'affiche pas dans un autre compte.

**État au 28 octobre 2026 : terminé.** Configuration en deux étapes enregistrée en une transaction (`/api/onboarding`), brouillons serveur par compte (`/api/drafts`, inclus dans la sauvegarde, vidés à la déconnexion), note brute sans IA puis structuration facultative relue avant application, date modifiable avec confirmation hors période, recherche et filtre, états chargement/vide/erreur avec réessai. Vérifié par `tests/e2e/v1-journey.spec.ts` (Ollama absent) et `tests/api/workspace.test.ts`.

### Lot 3 — Fiabiliser le socle IA commun · P0

Dépendance : lots 1 et 2. Zones principales : `src/server/ai`, routes IA, services et composants consommateurs.

- [x] **V1-301** Afficher un diagnostic simple : Ollama joignable, modèle disponible, modèle sélectionné. Fournir une instruction exploitable si le modèle manque.
- [x] **V1-302** Valider les entrées propres à chaque tâche et les sorties structurées avec des schémas : champs requis, types, tailles et note de soutenance entre 0 et 10. Traiter une réponse invalide sans casser l'écran.
- [x] **V1-303** Ajouter délai maximal, annulation depuis l'interface et propagation de l'annulation jusqu'à Ollama. Après interruption, identifier clairement un résultat incomplet.
- [x] **V1-304** Corriger le traitement du streaming : erreurs du modèle, flux interrompu et dernier fragment. Proposer une relance explicite sans dupliquer ni écraser un résultat existant.
- [x] **V1-305** Définir et tester une limite de contexte pour le modèle conseillé. Prévisualiser les notes sélectionnées ; proposer de réduire la période ou de générer par sections si la sélection est trop grande. Éviter toute troncature silencieuse.
- [x] **V1-306** Conserver avec chaque génération le modèle, la date, les consignes et les notes sources utilisées. Préserver un instantané des sources utiles pour qu'une modification ultérieure du journal n'efface pas la provenance du résultat.
- [x] **V1-307** Renforcer les consignes : utiliser les données fournies, signaler les informations manquantes, ne pas inventer de chiffres ou de réalisations. Constituer quelques exemples de référence pour relire les résultats d'un modèle réel.

**Sortie du lot :** un modèle absent, un JSON mal formé, une réponse hors schéma, une annulation et un flux interrompu donnent chacun un état compréhensible ; le texte utilisateur et les versions sauvegardées sont conservés. Une sélection trop grande est gérée explicitement.

**État au 28 octobre 2026 : terminé, sauf la relecture sur un modèle réel.** Diagnostic `/api/ai/status` et carte « IA locale » du profil, schémas d'entrée et de sortie par tâche, délai `OLLAMA_TIMEOUT_MS` et annulation propagée à Ollama, flux NDJSON (`meta`, `delta`, `done`, `error`) avec dernier fragment et interruption détectés, `num_ctx` explicite et refus d'une sélection trop grande (`/api/ai/estimate` pour la prévisualiser), provenance et instantané des sources, consignes « [À compléter : …] ». Vérifié par `tests/api/ai-foundation.test.ts`. Reste à exécuter la grille de [AI_REFERENCE_EXAMPLES.md](AI_REFERENCE_EXAMPLES.md) avec phi4-mini.

### Lot 4 — Construire un rapport révisable · P0

Dépendance : lots 2 et 3. Zones principales : outils, prompts, stockage des rapports et export PDF.

- [x] **V1-401** Ajouter un brief de rapport : consignes d'école en texte, problématique, longueur indicative, période et notes sources. Indiquer les informations manquantes avant la génération.
- [x] **V1-402** Proposer un plan modifiable avant la rédaction. Permettre de générer ou régénérer une section choisie sans remplacer les autres.
- [x] **V1-403** Ajouter un éditeur Markdown avec aperçu, enregistrement automatique et reprise après navigation/rechargement. Prévoir des versions explicites et la restauration d'une version antérieure.
- [x] **V1-404** Afficher les sources et paramètres de la génération. Marquer les passages à compléter et permettre une validation finale par l'étudiant.
- [x] **V1-405** Exporter le contenu corrigé en Markdown et PDF. Pour le PDF : page de titre, titres hiérarchisés, pagination et sauts de page lisibles ; vérifier accents, listes et document long. Reporter les styles académiques multiples et la mise en page bureautique avancée.
- [x] **V1-406** Intégrer rapports, versions et provenance à l'export/restauration du lot 1.

**Sortie du lot :** à partir de notes et de consignes fictives, l'étudiant valide un plan, génère un rapport, corrige une section, ferme l'application, reprend ses corrections et exporte exactement la version relue. Une ancienne version reste récupérable.

**État au 28 octobre 2026 : terminé.** Onglet Rapport : brief, plan modifiable ou proposé, rédaction et régénération par section (version créée avant remplacement), éditeur Markdown avec aperçu, enregistrement automatique avec contrôle de révision entre onglets, versions et restauration, provenance, validation finale, export Markdown et PDF (page de titre, sections sur nouvelle page, pagination, texte normalisé en Latin-1 pour les polices PDF). Inclus dans la sauvegarde v3. Vérifié par `tests/e2e/v1-journey.spec.ts`, `tests/api/report-export.test.ts` et `tests/api/workspace.test.ts`.

### Lot 5 — Donner de la valeur au suivi quotidien · P1

Dépendance : lots 1 et 2 ; lot 3 pour les suggestions IA. Zones principales : tableau de bord, compétences et échéances.

- [x] **V1-501** Créer une liste de compétences validées par l'étudiant : libellé, objectif éventuel et niveau déclaré simple (« à travailler », « en pratique », « autonome »).
- [x] **V1-502** Relier chaque compétence à des notes servant de preuves. Permettre de renommer ou fusionner les doublons ; traiter une extraction IA comme une suggestion.
- [x] **V1-503** Remplacer la présentation de fréquence comme progression par des objectifs et preuves consultables. Identifier explicitement les niveaux comme déclarés par l'étudiant.
- [x] **V1-504** Afficher à l'ouverture les échéances proches et en retard, ainsi qu'une invitation à compléter son journal si nécessaire. Ajouter un export calendrier `.ics` des échéances. La V1 ne promet pas de notification lorsque l'application est fermée.
- [x] **V1-505** Vérifier la cohérence de la timeline avec les notes datées et les échéances ; intégrer les compétences et leurs liens à la restauration.

**Sortie du lot :** une compétence renvoie à des expériences concrètes ; fusionner deux libellés conserve les liens. Une échéance est visible au bon moment et son export est importable dans un calendrier.

**État au 28 octobre 2026 : terminé, sauf l'import manuel du `.ics` dans un calendrier réel.** Onglet Compétences (niveaux déclarés, preuves, fusion, suggestions), tableau de bord centré sur les objectifs et preuves, alertes d'échéances en retard ou proches et invitation au journal à l'ouverture, export `/api/deadlines/calendar` conforme RFC 5545 (vérifié en test), timeline alignée sur la règle de semaine et sur les preuves.

### Lot 6 — Rendre l'assistant, le CV et la soutenance reprenables · P1

Dépendance : lots 1 et 3. Zones principales : assistant, outils, sessions persistantes et historique.

- [x] **V1-601** Sauvegarder les conversations et permettre de les retrouver, reprendre, renommer ou supprimer ; afficher les échanges interrompus et éviter les messages dupliqués après relance.
- [x] **V1-602** Sauvegarder les entraînements de soutenance : contexte, questions, réponses, évaluations et étape en cours. Permettre de reprendre une session et consulter son bilan.
- [x] **V1-603** Rendre les critères d'évaluation visibles et présenter les notes comme une aide à l'entraînement. Limiter la V1 au bilan par session ; reporter les analyses de progression avancées.
- [x] **V1-604** Permettre de sélectionner les expériences utilisées pour les points CV, puis corriger et sauvegarder les formulations. Demander les chiffres manquants au lieu de les inventer ; exporter en texte/Markdown.
- [x] **V1-605** Intégrer conversations, simulations et résultats CV corrigés à la sauvegarde complète ; vérifier leur isolation par compte.

**Sortie du lot :** changer d'onglet, recharger ou se reconnecter conserve une conversation et une simulation. Un point CV corrigé est sauvegardé et retrouve ses sources.

**État au 28 octobre 2026 : terminé.** Conversations stockées côté serveur (message utilisateur avant la réponse, réponse interrompue conservée et remplacée à la relance, renvoi idempotent), simulations sauvegardées à chaque étape (réponse enregistrée avant l'évaluation), critères visibles et note indicative, espace Points CV (sélection des notes, correction, sauvegarde, export). Inclus dans la sauvegarde v3 et isolés par compte. Vérifié par `tests/api/workspace.test.ts`.

### Lot 7 — Recette et diffusion de la V1 · P1, bloquant pour la sortie

Dépendance : tous les lots précédents. Les tests ciblés restent à réaliser dans chaque lot.

- [x] **V1-701** Automatiser les parcours essentiels : inscription/configuration, journal sans Ollama, structuration simulée, édition/reprise du rapport et restauration. Vérifier aussi l'isolation entre comptes et les principales erreurs IA.
- [ ] **V1-702** Tester le clavier, les libellés des formulaires, les boutons à icône, le mobile et les états chargement/vide/erreur sur les écrans essentiels.
- [x] **V1-703** Ajouter des diagnostics serveur utiles sans journaliser les mots de passe ni les notes privées ; distinguer disponibilité de l'application, de la base et d'Ollama.
- [ ] **V1-704** Vérifier une installation Docker propre et le parcours manuel documenté ; documenter prérequis, modèle conseillé, limites constatées, sauvegarde, mise à jour, récupération et dépannage. Mesurer les temps de génération sur la machine de référence plutôt que promettre un délai universel.
- [ ] **V1-705** Faire exécuter le scénario de recette par 3 à 5 étudiants ; relever les blocages, corriger ceux du parcours central et refaire la recette concernée.
- [ ] **V1-706** Vérifier la CI, produire les notes de version et aligner README, captures et fonctionnalités réellement livrées. Le numéro `1.0.0` déjà présent dans le dépôt ne vaut pas validation de cette roadmap ; choisir la version de diffusion en fonction des versions déjà publiées.

**Sortie du lot :** les critères de la section 4 passent, aucun blocage du parcours central n'est ouvert, et les limites connues sont documentées.

**État au 28 octobre 2026 : en cours.**

- V1-701 : fait. Parcours automatisés dans `tests/e2e/v1-journey.spec.ts` (configuration reprise, journal sans Ollama, structuration simulée, rapport corrigé, versionné et exporté) en plus des tests de sauvegarde et de sécurité existants.
- V1-702 : partiel. Libellés reliés aux champs, boutons à icône nommés, actions visibles au clavier et sur mobile, états de chargement, de liste vide et d'erreur sur les écrans principaux. Un audit complet (lecteur d'écran, contraste, navigation clavier écran par écran) reste à faire.
- V1-703 : fait. `/api/health` distingue application, base et Ollama (healthcheck Docker et sonde Kubernetes) ; les journaux serveur sont structurés et ne contiennent que des codes et durées.
- V1-704 : partiel. Prérequis, variables, mise à jour et dépannage documentés dans le README ; installation Docker propre et mesures de durée sur la machine de référence à réaliser.
- V1-705 : à faire, hors code : recette par 3 à 5 étudiants avec [SPEC_V1.md](SPEC_V1.md).
- V1-706 : partiel. Les commandes de la CI (`lint`, `lint:code`, `test`, `build`, `test:e2e`) passent localement ; [notes de version](RELEASE_NOTES.md) rédigées ; captures d'écran du README et choix du numéro de version restent à faire.

## 4. Définition de « V1 terminée »

La sortie est autorisée lorsque ce scénario fonctionne sur une installation propre, avec des données fictives :

1. Un étudiant crée son compte, configure son stage et confirme ses échéances.
2. Ollama est arrêté : il enregistre une note datée, garde un brouillon et retrouve ses données après rechargement.
3. Ollama redémarre : il structure la note, corrige les propositions et associe une compétence à cette preuve.
4. Il retrouve ses échéances dans l'application et importe leur fichier `.ics` dans son calendrier.
5. Il renseigne ses consignes, choisit ses notes, valide un plan et génère un rapport.
6. Il corrige le texte, quitte l'application, reprend la bonne version et exporte un PDF lisible conforme à ses corrections.
7. Il reprend une conversation et une simulation de soutenance ; il sauvegarde des points CV corrigés.
8. Il exporte toutes ses données métier et les restaure : profil, liens, contenus et versions sont conservés. Répéter la restauration n'ajoute aucun doublon.
9. Un second compte n'accède à aucun de ces contenus. Les routes IA refusent les appels sans connexion.
10. Les erreurs de modèle, annulations et fichiers d'import invalides ne détruisent ni les données ni les corrections.

Les vérifications automatisées doivent utiliser une base dédiée. La génération réelle doit être relue sur les exemples de référence. La procédure de mise à jour et de récupération doit également avoir été exécutée sur une copie de base.

## 5. Après la V1 · P2

À prioriser avec les retours de la bêta :

- Notifications système et rappels lorsque l'application est fermée.
- Plusieurs stages/périodes par compte et archivage de parcours.
- Référentiels d'école ou RNCP et validations par un tuteur.
- Pièces jointes, annexes, images et exports bureautiques enrichis.
- Analyse de progression entre plusieurs entraînements de soutenance.
- Synchronisation entre appareils ou accès partagé, après décision explicite sur la confidentialité et l'hébergement.

## 6. Prochaines étapes

Les lots 0 à 6 sont livrés. Avant la diffusion de la V1, terminer le **lot 7** : relire les générations réelles sur les exemples de référence, vérifier une installation Docker propre et l'import `.ics`, compléter l'audit d'accessibilité, faire passer la recette à des étudiants, puis mettre à jour les captures et choisir le numéro de version.
