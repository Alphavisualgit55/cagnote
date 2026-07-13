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
server.js            API Express + endpoints SSE
lib/generator.js     Prompts + appel streaming à l'API Claude (claude-opus-4-8)
lib/store.js         Persistance des projets (fichiers JSON dans data/)
public/              Interface (landing + générateur + galerie)
  index.html
  styles.css
  app.js             Client SSE, aperçu, galerie
```

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
- **Sécurité** : identifiants de projets restreints aux UUID (protection contre
  la traversée de répertoire) ; aperçu rendu dans un iframe.
- **Zéro base de données** : les projets sont stockés en fichiers JSON sous `data/`.

## Limites & pistes d'évolution

- Le stockage fichier convient à une démo mono-utilisateur ; pour la production,
  brancher une base de données et de l'authentification multi-utilisateurs.
- Les checkout e-commerce générés sont **simulés** (aucun paiement réel) — à
  connecter à Stripe/Shopify pour une vraie boutique.
