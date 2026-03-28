<div align="center">
  <img src="public/logo.png" alt="Stajio Logo" width="120" />
  <h1>🎓 Stajio</h1>
  <p><strong>Ton Compagnon d'Alternance Intelligent propulsé par l'IA</strong></p>

  <p>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-19-blue.svg?style=flat-square&logo=react" alt="React" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
    <a href="https://firebase.google.com/"><img src="https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black" alt="Firebase" /></a>
    <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat-square&logo=google&logoColor=white" alt="Gemini AI" /></a>
  </p>
</div>

---

Stajio est une application web full-stack conçue pour aider les étudiants en alternance et en stage à documenter leur parcours, gérer leurs échéances et préparer leurs livrables académiques grâce à l'intelligence artificielle.

## Architecture (mise a jour)

- Frontend: Next.js 16 (App Router) + React 19
- Backend: Route Handlers Next.js natifs (routes API sous `/api/*`)
- Base de donnees: SQLite via `better-sqlite3`
- IA: Google Gemini (`@google/genai`)

## ✨ Fonctionnalités Clés

- **📓 Journal de Bord Intelligent** : Saisissez vos activités quotidiennes en langage naturel. L'IA (Gemini 3.1 Flash) structure automatiquement vos notes, extrait les compétences acquises et les technologies utilisées.
- **📅 Gestion des Deadlines** : Suivez vos échéances école et entreprise (rapports, soutenances, évaluations) avec une interface claire et interactive.
- **📝 Générateur de Rapport** : Générez un brouillon de rapport de stage complet basé sur l'historique de votre journal de bord.
- **🎓 Préparation à la Soutenance** : Obtenez un plan de présentation personnalisé et une liste de questions probables du jury avec des conseils de réponse.
- **💼 Optimisation CV** : Transformez vos missions de stage en points d'expérience percutants et optimisés pour les systèmes ATS.
- **🎨 Générateur de Logo** : Créez un logo unique pour votre projet de stage grâce à la génération d'images par l'IA.
- **🌗 Mode Sombre / Clair** : Interface adaptative et responsive pour un confort visuel optimal sur tous les appareils.
- **📄 Export PDF** : Exportez vos rapports et préparations au format PDF en un clic.

## 🛠️ Stack Technique

- **Frontend** : Next.js 16, React 19, Tailwind CSS, Framer Motion.
- **Backend & Database** : Next.js Route Handlers + SQLite (`better-sqlite3`), auth JWT + cookies HTTP-only.
- **Intelligence Artificielle** : Google Gemini API (`@google/genai`).
- **Utilitaires** : `date-fns` (gestion des dates), `jsPDF` & `html2canvas` (export PDF), `lucide-react` (icônes).

## 🚀 Installation et Configuration en Local

1. **Cloner le dépôt** :
   ```bash
   git clone https://github.com/votre-username/stajio.git
   cd stajio
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Variables d'Environnement** :
   - Créez un fichier `.env` à la racine et ajoutez vos secrets :
     ```env
     GEMINI_API_KEY=votre_cle_api_gemini
     JWT_SECRET=change_me
     ```
   - Si vous appelez Gemini depuis le navigateur, ajoutez aussi :
     ```env
     NEXT_PUBLIC_GEMINI_API_KEY=votre_cle_api_gemini
     ```

4. **Lancer le serveur de développement** :
   ```bash
   npm run dev
   ```
   L'application sera accessible sur `http://localhost:3000`.

## 🔒 Sécurité et Confidentialité

L'authentification repose sur JWT stocke en cookie HTTP-only. En production, activez HTTPS et utilisez un `JWT_SECRET` fort.

## 🤝 Contribution

Les contributions, les problèmes (issues) et les demandes de fonctionnalités (feature requests) sont les bienvenus ! N'hésitez pas à consulter la page des [issues](https://github.com/votre-username/stajio/issues).

## 📄 Licence

Ce projet est distribué sous la licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

---
<div align="center">
  <i>Développé avec ❤️ pour faciliter la vie des étudiants et alternants.</i>
</div>
