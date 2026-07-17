require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Configuration PayDunya
// ---------------------------------------------------------------------------
const PAYDUNYA_MODE = process.env.PAYDUNYA_MODE === 'live' ? 'live' : 'test';
const PAYDUNYA_BASE =
  PAYDUNYA_MODE === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';

const PRICE_FCFA = Number(process.env.PRICE_FCFA || 100000);

function paydunyaHeaders() {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY || '',
    'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY || '',
    'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN || '',
  };
}

function baseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

// Génère un numéro de facture unique et lisible, dérivé du token PayDunya
// (déterministe : le même paiement donne toujours la même référence).
function factureNumber(token) {
  let hash = 0;
  const str = String(token || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const ref = hash.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `EB-${ref}`;
}

function formatMontant(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

// ---------------------------------------------------------------------------
// Enregistrement simple des commandes dans orders.json
// ---------------------------------------------------------------------------
const ORDERS_FILE = path.join(__dirname, 'orders.json');

function saveOrder(order) {
  let orders = [];
  try {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    orders = [];
  }
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// ---------------------------------------------------------------------------
// Config publique exposée au front (liens WhatsApp, prix…)
// ---------------------------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({
    price: PRICE_FCFA,
    whatsappGroupUrl: process.env.WHATSAPP_GROUP_URL || '',
    supportWhatsapp: process.env.SUPPORT_WHATSAPP || '+221755274787',
    promoDeadline: process.env.PROMO_DEADLINE || '2026-08-05T23:59:59',
    siteUrl: baseUrl(req),
  });
});

// ---------------------------------------------------------------------------
// Création de la facture PayDunya puis redirection vers la page de paiement
// ---------------------------------------------------------------------------
app.post('/api/checkout', async (req, res) => {
  const { nom, prenom, email, whatsapp } = req.body || {};

  if (!nom || !prenom || !email || !whatsapp) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (!/^\+?[0-9\s-]{8,16}$/.test(whatsapp)) {
    return res.status(400).json({ error: 'Numéro WhatsApp invalide (ex : +221771234567).' });
  }

  const url = baseUrl(req);
  const payload = {
    invoice: {
      total_amount: PRICE_FCFA,
      description: `Formation Ecom Booster — inscription de ${prenom} ${nom}`,
      items: {
        item_0: {
          name: 'Formation Ecom Booster',
          quantity: 1,
          unit_price: PRICE_FCFA,
          total_price: PRICE_FCFA,
          description: 'Formation complète e-commerce en Afrique + bonus',
        },
      },
    },
    store: {
      name: process.env.STORE_NAME || 'Ecom Booster',
      tagline: 'Lance ton business e-commerce rentable en Afrique',
      website_url: url,
    },
    custom_data: { nom, prenom, email, whatsapp },
    actions: {
      return_url: `${url}/merci.html`,
      cancel_url: `${url}/checkout.html`,
      callback_url: `${url}/api/paydunya/ipn`,
    },
  };

  try {
    const r = await fetch(`${PAYDUNYA_BASE}/checkout-invoice/create`, {
      method: 'POST',
      headers: paydunyaHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await r.json();

    if (data.response_code === '00') {
      saveOrder({
        date: new Date().toISOString(),
        statut: 'en_attente_paiement',
        token: data.token,
        nom,
        prenom,
        email,
        whatsapp,
        montant: PRICE_FCFA,
      });
      return res.json({ url: data.response_text, token: data.token });
    }

    console.error('Erreur PayDunya (create):', data);
    return res.status(502).json({
      error: data.response_text || 'Erreur lors de la création du paiement. Réessayez.',
    });
  } catch (err) {
    console.error('Erreur PayDunya (create):', err);
    return res.status(502).json({ error: 'Impossible de contacter PayDunya. Réessayez.' });
  }
});

// ---------------------------------------------------------------------------
// Vérification du statut d'une facture (utilisée par la page merci.html)
// ---------------------------------------------------------------------------
app.get('/api/verify/:token', async (req, res) => {
  try {
    const r = await fetch(
      `${PAYDUNYA_BASE}/checkout-invoice/confirm/${encodeURIComponent(req.params.token)}`,
      { headers: paydunyaHeaders() }
    );
    const data = await r.json();

    const completed = data.status === 'completed';
    const montant = data.invoice ? data.invoice.total_amount : PRICE_FCFA;
    const facture = factureNumber(req.params.token);

    if (completed) {
      saveOrder({
        date: new Date().toISOString(),
        statut: 'paye',
        facture,
        token: req.params.token,
        ...(data.custom_data || {}),
        montant,
      });
    }
    return res.json({
      status: data.status || 'unknown',
      customer: data.custom_data || null,
      facture,
      montant,
      montantFormate: formatMontant(montant),
      date: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur PayDunya (confirm):', err);
    return res.status(502).json({ error: 'Vérification impossible pour le moment.' });
  }
});

// ---------------------------------------------------------------------------
// IPN PayDunya : notification instantanée de paiement (serveur → serveur)
// ---------------------------------------------------------------------------
app.post('/api/paydunya/ipn', (req, res) => {
  try {
    const data = req.body && req.body.data ? req.body.data : req.body;
    console.log('IPN PayDunya reçu:', JSON.stringify(data));
    if (data && data.status === 'completed') {
      saveOrder({
        date: new Date().toISOString(),
        statut: 'paye_ipn',
        token: data.invoice ? data.invoice.token : undefined,
        ...(data.custom_data || {}),
        montant: data.invoice ? data.invoice.total_amount : PRICE_FCFA,
      });
    }
  } catch (err) {
    console.error('Erreur IPN:', err);
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Ecom Booster en ligne sur http://localhost:${PORT} (PayDunya mode: ${PAYDUNYA_MODE})`);
});
