# Sauvegarde JSON et restauration d'un compte

Depuis le profil, **Exporter tout (JSON)** télécharge toutes les données métier du compte connecté. Le format courant est la version 3.

## Format courant

```json
{
  "format": "stajio",
  "version": 3,
  "exportedAt": "2026-10-27T12:00:00.000Z",
  "profile": {
    "displayName": "Étudiant",
    "school": null,
    "degree": null,
    "internshipStart": null,
    "internshipEnd": null,
    "company": null,
    "tutorName": null
  },
  "logs": [],
  "deadlines": [],
  "aiOutputs": [],
  "drafts": [],
  "reports": [],
  "reportVersions": [],
  "skills": [],
  "skillEvidence": [],
  "conversations": [],
  "conversationMessages": [],
  "simulations": []
}
```

| Collection                               | Contenu                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logs`                                   | Notes du journal : date, texte brut, champs structurés, numéro de semaine                                                                                 |
| `deadlines`                              | Échéances école et entreprise, avec leur état                                                                                                             |
| `aiOutputs`                              | Préparations de soutenance et points CV (et anciens résultats), avec texte corrigé, date de correction, modèle, consignes et instantané des notes sources |
| `drafts`                                 | Brouillons en cours (configuration, nouvelle note, modification de note), par clé                                                                         |
| `reports`                                | Rapports : titre, brief, sections, statut, provenance, révision, dates de création, de modification et de validation                                      |
| `reportVersions`                         | Versions enregistrées de chaque rapport (`reportId`)                                                                                                      |
| `skills`                                 | Compétences : libellé, objectif, niveau déclaré                                                                                                           |
| `skillEvidence`                          | Liens de preuve entre une compétence (`skillId`) et une note (`logId`)                                                                                    |
| `conversations` / `conversationMessages` | Conversations de l'assistant et leurs messages ordonnés (`position`), y compris les réponses interrompues                                                 |
| `simulations`                            | Simulations de soutenance : questions, réponses, évaluations, étape en cours, modèle et notes sources                                                     |

Toutes les collections sont obligatoires, même vides. Les identifiants, contenus, valeurs nulles admises et horodatages sont conservés, ce qui préserve les liens entre collections.

L'export exclut l'UID du compte, l'adresse de connexion, les mots de passe, les cookies et les secrets. Lors d'une restauration, l'adresse et le mot de passe du compte cible restent inchangés ; seuls son profil métier et ses contenus sont remplacés.

Un profil avant configuration est sauvegardable et restaurable. Si le profil restauré est incomplet, Stajio revient à l'écran de configuration.

## Restaurer depuis l'interface

1. Ouvrir **Mon Profil**, puis **Choisir une sauvegarde**.
2. Vérifier le nom, l'école, l'entreprise, la période et le nombre d'éléments de chaque collection, avant et après.
3. Télécharger si nécessaire les données actuelles avec le lien de sauvegarde proposé.
4. Cocher la confirmation du remplacement, puis choisir **Restaurer les données**. **Annuler** ferme l'aperçu sans écriture.
5. Le profil et les listes sont actualisés. Une restauration répétée ne crée pas de doublons.

La restauration est un **remplacement complet des données métier du compte connecté**, appliqué dans une transaction SQLite. Les contenus actuels absents du fichier sont supprimés. Les autres comptes restent inchangés, même si leurs éléments ont les mêmes identifiants.

Si les données du compte ou le fichier changent après l'aperçu, la confirmation est refusée avec un conflit HTTP 409. Actualiser l'aperçu, vérifier les nouvelles valeurs et confirmer à nouveau.

## Compatibilité et validation

- **Version 2** (profil, notes, échéances, résultats IA) : convertie explicitement. Les collections apparues en version 3 étaient impossibles à exporter et sont donc vides ; restaurer un tel fichier supprime les rapports, compétences, conversations, simulations et brouillons actuels du compte, comme l'indique l'aperçu.
- **Version 1** : les exports complets historiques sont convertis ; leur identité source est vérifiée puis écartée au profit du compte connecté.
- Les anciennes importations partielles, dont `{}`, sont refusées : l'absence d'une collection ne doit jamais effacer implicitement son contenu.
- Sont refusés avant toute écriture : versions inconnues, clés inattendues, dates invalides, identifiants dupliqués, deux compétences au même libellé (sans tenir compte de la casse), preuve ou version qui renvoie vers un élément absent, message d'une conversation absente ou deux messages à la même position, étape de simulation hors limites, note d'évaluation hors de 0 à 10.
- Le document est limité à **19 Mio** ; la requête HTTP complète à **20 Mio** pour laisser de la place à l'enveloppe de confirmation. Chaque collection est limitée à 10 000 éléments.
- Si les données stockées sont invalides ou dépassent la limite, l'export échoue explicitement ; aucun fichier tronqué n'est produit.

Un nouveau type de données doit faire évoluer la version du format, sa conversion depuis les versions précédentes, l'export, la restauration et la suppression de compte (`src/server/account-content.ts`).

Pour récupérer une base entière après un incident de migration, utiliser la [procédure de récupération SQLite](DATA_RECOVERY.md), distincte de la restauration JSON d'un compte.
