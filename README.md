# ⚡ Cagnote AI

**SaaS de génération de sites web par IA.** Décrivez votre activité, et l'API
Claude (`claude-opus-4-8`) génère un **site vitrine** ou **e-commerce** complet,
responsive et prêt à l'emploi — prévisualisé en direct et téléchargeable en un clic.

![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen) ![Claude](https://img.shields.io/badge/API-Claude%20Opus%204.8-6ee7b7)

## Fonctionnalités

- 🏛️ **Sites vitrine** — hero, services, à propos, réalisations, témoignages, formulaire de contact.
- 🛒 **Sites e-commerce** — grille de produits, filtres, panier fonctionnel (localStorage), checkout simulé.
- 🔴 **Génération en streaming** — le code s'écrit ligne par ligne dans l'aperçu (Server-Sent Events).
- 👁️ **Aperçu en direct** dans un iframe isolé.
- 💾 **Galerie de projets** — tous les sites générés sont sauvegardés, prévisualisables et supprimables.
- ⬇️ **Téléchargement** du site en un fichier HTML autonome (CSS + JS inline, aucune dépendance externe).
- 🎨 Paramètres : nom, secteur, description, couleur principale, style visuel.

## Architecture

```
server.js                    Serveur Express (dev local) : /api/health + /api/generate (SSE)
lib/generator.js             Prompts + appel streaming à l'API Claude (claude-opus-4-8)
netlify/functions/           Version serverless (déploiement Netlify)
  generate.mjs               Fonction streaming réutilisant lib/generator.js
  health.mjs                 État de la clé API
netlify.toml                 Config Netlify (static public/ + fonctions + redirects /api/*)
public/                      Interface (landing + générateur + galerie)
  index.html
  styles.css
  app.js                     Client SSE, aperçu, galerie (persistée en localStorage)
```

La génération est identique en local (Express) et en production (fonction
Netlify) : les deux réutilisent `lib/generator.js` et streament le HTML.
La galerie des sites est stockée **dans le navigateur** (`localStorage`), ce qui
rend l'app compatible avec un hébergement sans état.

Le générateur envoie un **system prompt** strict qui impose un fichier HTML
unique et autonome (CSS/JS inline, images via dégradés ou `picsum.photos`,
contenu en français crédible, design non-générique, 100% responsive), avec une
structure dédiée selon le type — vitrine ou e-commerce (panier + checkout).

## Prérequis

- Node.js ≥ 20
- Une clé API Anthropic — https://console.anthropic.com/

## Installation

```bash
npm install
cp .env.example .env          # puis renseignez ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY=sk-ant-...   # ou via .env / variable d'environnement
npm start
```

Ouvrez ensuite **http://localhost:3000**.

> Le badge en haut à droite indique si la clé API est bien détectée.

## API

| Méthode | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/health` | État du serveur + présence de la clé API |
| `POST` | `/api/generate` | Génère un site (réponse **SSE** : `delta`, `done`, `error`) |
| `GET`  | `/api/projects` | Liste des projets générés |
| `GET`  | `/api/projects/:id` | Détail d'un projet (avec HTML) |
| `GET`  | `/api/projects/:id/preview` | Rendu HTML du site |
| `GET`  | `/api/projects/:id/download` | Téléchargement du fichier `.html` |
| `DELETE` | `/api/projects/:id` | Suppression |

Exemple de corps pour `POST /api/generate` :

```json
{
  "type": "ecommerce",
  "businessName": "Atelier Belleville",
  "sector": "Boulangerie artisanale",
  "description": "Boulangerie parisienne : pains au levain, viennoiseries...",
  "primaryColor": "#c0562f",
  "style": "Chaleureux & artisanal"
}
```

## Choix techniques

- **Modèle** : `claude-opus-4-8` avec *adaptive thinking* et `effort: high`,
  en **streaming** (`max_tokens: 64000`) — l'aperçu se remplit en temps réel.
- **SDK** : `@anthropic-ai/sdk` officiel ; la clé est résolue depuis
  l'environnement (`ANTHROPIC_API_KEY`).
- **Sécurité** : aperçu rendu dans un iframe isolé ; aucune donnée serveur.
- **Zéro base de données** : les projets générés sont stockés côté navigateur
  (`localStorage`) ; téléchargement/aperçu via des Blobs.

## Déploiement sur Netlify

L'app est prête pour Netlify (site statique `public/` + fonctions serverless).

**Option 1 — depuis le dépôt GitHub (recommandé) :**
1. Sur https://app.netlify.com → **Add new site → Import an existing project**.
2. Choisir ce dépôt GitHub et la branche à déployer.
3. Netlify lit `netlify.toml` automatiquement (build dir `public`, fonctions).
4. **Site configuration → Environment variables → Add** :
   `ANTHROPIC_API_KEY = sk-ant-...`
5. **Deploy** → Netlify fournit une URL `https://<nom>.netlify.app`.

**Option 2 — via la CLI :**
```bash
npm i -g netlify-cli
netlify deploy --prod   # suit netlify.toml ; définir ANTHROPIC_API_KEY dans le dashboard
```

> ⚠️ **Limite Netlify** : les fonctions serverless ont une durée d'exécution
> plafonnée (~10 à 26 s). Un site complexe généré à haut niveau d'effort peut
> dépasser ce délai. Pour des générations longues sans coupure, un hébergement
> qui exécute le serveur Express (Render, Railway, Fly.io) est plus adapté.

## Limites & pistes d'évolution

- Les checkout e-commerce générés sont **simulés** (aucun paiement réel) — à
  connecter à Stripe/Shopify pour une vraie boutique.
- Pour du multi-utilisateur persistant, brancher une base de données et de
  l'authentification.
