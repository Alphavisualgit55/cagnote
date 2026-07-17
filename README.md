# 🚀 Ecom Booster — Tunnel de vente

Site tunnel de vente pour la formation **Ecom Booster** (e-commerce en Afrique), avec paiement en ligne via **PayDunya** (Orange Money, Wave, MTN MoMo, Moov Money, carte bancaire).

## Le tunnel

1. **`/` (index.html)** — Page de vente : programme, bonus, compte à rebours de la promo (5 août), tarif 100.000 FCFA.
2. **`/checkout.html`** — Le client renseigne **prénom, nom, email et numéro WhatsApp**, puis est redirigé vers la page de paiement sécurisée PayDunya.
3. **PayDunya** — Le client paie avec son moyen de paiement préféré.
4. **`/merci.html`** — Le paiement est vérifié auprès de PayDunya ; le client voit la confirmation, les prochaines étapes et le bouton pour rejoindre la communauté WhatsApp.

Les informations de chaque commande (nom, prénom, email, WhatsApp, statut du paiement) sont enregistrées dans `orders.json` sur le serveur.

## Installation

```bash
npm install
cp .env.example .env
# Éditez .env avec vos clés PayDunya
npm start
```

Le site est alors disponible sur http://localhost:3000.

## Configuration (.env)

| Variable | Description |
| --- | --- |
| `PAYDUNYA_MASTER_KEY` / `PAYDUNYA_PRIVATE_KEY` / `PAYDUNYA_TOKEN` | Vos clés API, disponibles sur [app.paydunya.com](https://app.paydunya.com) → *Intégrations* |
| `PAYDUNYA_MODE` | `test` (sandbox, pour essayer) ou `live` (vrais paiements). En mode `test`, utilisez les clés *test* de votre compte PayDunya. |
| `APP_BASE_URL` | URL publique du site déployé (nécessaire pour les redirections après paiement) |
| `PRICE_FCFA` | Prix de la formation (par défaut : `100000`) |
| `PROMO_DEADLINE` | Fin de la promo pour le compte à rebours (par défaut : 5 août) |
| `WHATSAPP_GROUP_URL` | Lien d'invitation de votre communauté WhatsApp (affiché après paiement) |
| `SUPPORT_WHATSAPP` | Votre numéro WhatsApp support, avec indicatif (ex : `+221771234567`) |

## Mise en ligne

Déployez sur n'importe quel hébergeur Node.js (Render, Railway, VPS, etc.) :

1. Déployez le dépôt et définissez les variables d'environnement du `.env`.
2. Mettez `APP_BASE_URL` sur votre vrai nom de domaine et `PAYDUNYA_MODE=live` avec vos clés de production.
3. Testez un paiement de bout en bout avant de lancer la promo.

⚠️ Ne commitez jamais votre fichier `.env` (il est déjà dans `.gitignore`).
