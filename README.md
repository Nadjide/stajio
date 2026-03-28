<div align="center">
  <img src="public/logo.png" alt="Stajio Logo" width="120" />
  <h1>Stajio</h1>
  <p><strong>Assistant intelligent de suivi d'alternance et de stage, en local-first.</strong></p>

  <p>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square" alt="Next.js" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-blue.svg?style=flat-square&logo=react" alt="React" /></a>
    <a href="https://ollama.com/"><img src="https://img.shields.io/badge/Ollama-Local_Model-2f855a?style=flat-square" alt="Ollama" /></a>
    <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-Local_DB-0ea5e9?style=flat-square" alt="SQLite" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square" alt="TypeScript" /></a>
  </p>
</div>

## Aperçu
Stajio aide les étudiants en alternance/stage à centraliser leur journal de bord, leurs deadlines académiques et professionnelles, et à générer automatiquement des livrables (rapport, préparation soutenance, points CV) avec une IA locale via Ollama.

Le projet est pensé pour un usage concret et démontrable en portfolio: architecture claire, backend Next natif, stockage local, et flux utilisateur complet.

## Démo (à compléter)
- Vidéo: à ajouter
- Captures: à ajouter
- URL de déploiement: à ajouter

## Fonctionnalités
- Journal de bord intelligent (structuration missions/technologies/compétences)
- Gestion des deadlines école/entreprise
- Génération de rapport de stage (Markdown)
- Préparation de soutenance (plan + questions probables)
- Optimisation CV (bullet points ATS)
- Export PDF des résultats IA
- Auth JWT en cookie HTTP-only
- UI responsive avec thème clair/sombre

## Architecture
- Frontend: Next.js 16 App Router + React 19
- Backend: Route Handlers Next.js (`app/api/*`)
- Base de données: SQLite (`better-sqlite3`)
- IA: Ollama local (modèle configurable)
- Styling: Tailwind CSS 4

### Points techniques importants
- Aucune clé API cloud nécessaire pour l'IA
- Données utilisateur stockées localement (SQLite)
- Séparation claire front/backend via API interne
- Route IA unique côté backend: `/api/ai`

## Installation locale
1. Cloner le dépôt
```bash
git clone https://github.com/votre-username/stajio.git
cd stajio
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer l'environnement
Créer `.env`:
```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
JWT_SECRET=change_me
```

4. Lancer Ollama
```bash
ollama serve
ollama pull llama3.2
```

5. Démarrer l'app
```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Scripts utiles
- `npm run dev`: développement
- `npm run build`: build production
- `npm run start`: démarrage production (nécessite build)
- `npm run lint`: type-check TypeScript
- `npm run lint:code`: lint ESLint
- `npm run format`: formatage Prettier
- `npm run test`: tests API (Vitest)
- `npm run check`: pipeline locale complète (lint + tests + build)

## Qualité logicielle
- ESLint (config Next + JS)
- Prettier + plugin Tailwind
- Vitest (tests API essentiels)

## Sécurité
- JWT signé avec `JWT_SECRET`
- Cookie auth HTTP-only
- En production: HTTPS obligatoire et secret robuste

## Roadmap portfolio (prochaines améliorations)
- Tests E2E (Playwright)
- Validation schémas API (Zod)
- Observabilité (logs structurés)
- Ajout édition d'entrée de journal
- CI GitHub Actions

## Pourquoi ce projet est pertinent en portfolio
- Cas d'usage réel (étudiants en alternance)
- Architecture full-stack moderne
- Intégration IA locale (différenciant)
- Compromis techniques justifiés (local-first, privacy-friendly)
- Produit montrable de bout en bout

## Licence
MIT
