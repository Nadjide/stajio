# Vidéo de présentation

[`stajio-demo.mp4`](stajio-demo.mp4) (2 min 40, 1280 × 720) montre le parcours complet. [`stajio-demo.gif`](stajio-demo.gif) en reprend deux passages pour le README.

## Contenu

Connexion, tableau de bord, note écrite dans le journal puis structurée par l'IA et corrigée, note reliée à une compétence, timeline, échéances, rapport (brief, plan, section rédigée par l'IA, aperçu, version nommée, export PDF), points CV, thème sombre, diagnostic d'Ollama et sauvegarde JSON.

## Ce qui est réel, ce qui est rejoué

- L'application filmée est le build de production du dépôt, sans modification, avec le [jeu de données fictif](../fixtures/demo-backup.json). La note du 22 octobre en est retirée, puis saisie pendant la vidéo avec le même texte.
- Les réponses de l'IA viennent de [`fake-ollama.mjs`](fake-ollama.mjs), un petit serveur qui imite l'API d'Ollama. Il renvoie les sorties de phi4-mini de [`recordings.json`](recordings.json), obtenues pendant la recette du 31 octobre au 3 novembre 2026 pour les mêmes demandes, et les diffuse en quelques secondes. Sur la machine de référence, phi4-mini met 10 à 45 s pour structurer une note et 2 à 3 minutes pour rédiger une section ([mesures](../AI_REFERENCE_EXAMPLES.md#mesures-sur-la-machine-de-référence)). Les légendes de la vidéo le rappellent.
- Le curseur, les légendes et les cartes de début et de fin sont ajoutés par le script d'enregistrement.

## Régénérer la vidéo

Prérequis : dépendances installées (`npm install`), Chromium pour Playwright (`npx playwright install chromium`) et `ffmpeg` dans le `PATH`.

1. Construire l'application :

   ```bash
   npm run build
   ```

2. Lancer le faux Ollama :

   ```bash
   node docs/demo/fake-ollama.mjs 11500
   ```

3. Dans un second terminal, démarrer l'application sur une base vide qui ne sert qu'à la vidéo :

   ```bash
   STAJIO_DB_PATH=/tmp/stajio-demo.db STAJIO_COOKIE_SECURE=false OLLAMA_BASE_URL=http://127.0.0.1:11500 \
   JWT_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))") \
   npx next start -p 3201
   ```

4. Enregistrer :

   ```bash
   node docs/demo/record-video.mjs http://127.0.0.1:3201
   ```

Le script crée le compte fictif `camille@exemple.test`, importe le jeu de données, pilote l'interface dans Chromium et capture l'écran, puis écrit `stajio-demo.mp4` et `stajio-demo.gif` dans ce dossier. L'enregistrement dure environ 3 minutes.
