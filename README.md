# 🚀 Ecom Booster — Tunnel de vente

Site tunnel de vente pour la formation **Ecom Booster** (e-commerce en Afrique), avec paiement en ligne via **PayDunya** (Orange Money, Wave, MTN MoMo, Moov Money, carte bancaire).

**Hébergement : Netlify** (site + fonctions serverless) · **Base de données : Supabase** (commandes).

## Le tunnel

1. **`/` (index.html)** — Page de vente : programme, bonus, compte à rebours de la promo (5 août), tarif 100.000 FCFA.
2. **`/checkout.html`** — Le client renseigne **prénom, nom, email et numéro WhatsApp**, puis est redirigé vers la page de paiement sécurisée PayDunya.
3. **PayDunya** — Le client paie avec son moyen de paiement préféré.
4. **`/merci.html`** — Le paiement est vérifié ; le client voit sa **facture unique** (n° `EB-XXXXXX`), un bouton **« Contacter le formateur »** (WhatsApp pré-rempli avec sa facture) et le lien du site.

Chaque commande (nom, prénom, email, WhatsApp, n° de facture, statut) est enregistrée dans la table **`orders`** de Supabase.

## Architecture

```
public/                  Pages statiques (servies par Netlify)
lib/core.js              Logique métier partagée (PayDunya + Supabase)
netlify/functions/       Fonctions serverless (API en production)
  config.js  checkout.js  verify.js  ipn.js
server.js                Serveur Express (développement local uniquement)
netlify.toml             Config Netlify (publish + redirections /api/*)
```

Les redirections mappent `/api/config`, `/api/checkout`, `/api/verify/:token`,
`/api/paydunya/ipn` vers les fonctions correspondantes.

## Déploiement sur Netlify

1. **Connecte le dépôt à Netlify** : [app.netlify.com](https://app.netlify.com) → *Add new site* → *Import an existing project* → GitHub → dépôt `cagnote`, branche `claude/ecom-booster-sales-funnel-cnj0cj`.
2. Netlify lit `netlify.toml` automatiquement (publish = `public`, functions = `netlify/functions`). Laisse les réglages par défaut.
3. Ajoute les **variables d'environnement** (*Site settings → Environment variables*) — voir tableau ci-dessous.
4. Déploie. Netlify te donne une URL du type `https://ecom-booster.netlify.app` = le lien de ton site.
5. Remets cette URL dans la variable `APP_BASE_URL`, puis redéploie (pour que les redirections PayDunya et la facture pointent vers ton domaine).

## Variables d'environnement (Netlify)

| Variable | Description |
| --- | --- |
| `PAYDUNYA_MASTER_KEY` / `PAYDUNYA_PRIVATE_KEY` / `PAYDUNYA_TOKEN` | Clés API PayDunya ([app.paydunya.com](https://app.paydunya.com) → *Intégrations*) |
| `PAYDUNYA_MODE` | `test` (sandbox) ou `live` (vrais paiements) |
| `SUPABASE_URL` | `https://cbvykjzrmcuqtdrwbanf.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **service_role** (secrète) — Supabase → *Project Settings → API Keys* |
| `APP_BASE_URL` | URL publique du site (ex : `https://ecom-booster.netlify.app`) |
| `SUPPORT_WHATSAPP` | Numéro WhatsApp du formateur, cliqué par le client après paiement pour recevoir ses accès (déjà `+221755274787` par défaut) |
| `PRICE_FCFA` | Prix (par défaut `100000`) |
| `PROMO_DEADLINE` | Fin de la promo pour le compte à rebours (par défaut 5 août) |

> ⚠️ La clé `service_role` est **secrète** : ne la mets que dans les variables Netlify, jamais dans le code ni le front.

## Base de données Supabase

Table `orders` déjà créée (projet **cagnotte-assane**) avec RLS activé : seules
les requêtes serveur (clé `service_role`) peuvent lire/écrire, les données
clients restent privées. Tu peux consulter tes commandes dans
*Supabase → Table Editor → orders*.

## Développement local

```bash
npm install
cp .env.example .env   # puis renseigne tes clés
npm start              # http://localhost:3000
```

## Tester avant de lancer

Fais d'abord un **paiement test** en mode sandbox (`PAYDUNYA_MODE=test` avec tes
clés de test) et vérifie que la commande apparaît bien dans la table `orders`,
avant de passer en `live`.
