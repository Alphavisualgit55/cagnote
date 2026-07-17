// ---------------------------------------------------------------------------
// Logique métier partagée entre le serveur Express (dev local) et les
// fonctions serverless Netlify (production). Paiement PayDunya + stockage
// des commandes dans Supabase.
// ---------------------------------------------------------------------------
const { createClient } = require('@supabase/supabase-js');

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

// --- Supabase (créé à la demande pour ne pas planter si non configuré) ------
let _supabase = null;
function supabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

async function saveOrder(order) {
  const db = supabase();
  if (!db) {
    console.warn('Supabase non configuré : commande non enregistrée.', order.facture);
    return;
  }
  const { error } = await db.from('orders').insert(order);
  if (error) console.error('Erreur enregistrement commande Supabase:', error.message);
}

// --- Utilitaires facture ----------------------------------------------------
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

// --- Config publique --------------------------------------------------------
function getConfig(siteUrl) {
  return {
    price: PRICE_FCFA,
    supportWhatsapp: process.env.SUPPORT_WHATSAPP || '+221755274787',
    promoDeadline: process.env.PROMO_DEADLINE || '2026-08-05T23:59:59',
    siteUrl: siteUrl || process.env.APP_BASE_URL || '',
  };
}

// --- Création de la facture PayDunya ---------------------------------------
async function createCheckout(input, siteUrl) {
  const nom = (input.nom || '').trim();
  const prenom = (input.prenom || '').trim();
  const email = (input.email || '').trim();
  const whatsapp = (input.whatsapp || '').trim();

  if (!nom || !prenom || !email || !whatsapp) {
    return { statusCode: 400, body: { error: 'Tous les champs sont obligatoires.' } };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: { error: 'Adresse email invalide.' } };
  }
  if (!/^\+?[0-9\s-]{8,16}$/.test(whatsapp)) {
    return { statusCode: 400, body: { error: 'Numéro WhatsApp invalide (ex : +221771234567).' } };
  }

  const url = (siteUrl || process.env.APP_BASE_URL || '').replace(/\/$/, '');
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
      await saveOrder({
        statut: 'en_attente_paiement',
        facture: factureNumber(data.token),
        token: data.token,
        nom,
        prenom,
        email,
        whatsapp,
        montant: PRICE_FCFA,
      });
      return { statusCode: 200, body: { url: data.response_text, token: data.token } };
    }

    console.error('Erreur PayDunya (create):', data);
    return {
      statusCode: 502,
      body: { error: data.response_text || 'Erreur lors de la création du paiement. Réessayez.' },
    };
  } catch (err) {
    console.error('Erreur PayDunya (create):', err);
    return { statusCode: 502, body: { error: 'Impossible de contacter PayDunya. Réessayez.' } };
  }
}

// --- Vérification du paiement ----------------------------------------------
async function verifyPayment(token) {
  try {
    const r = await fetch(
      `${PAYDUNYA_BASE}/checkout-invoice/confirm/${encodeURIComponent(token)}`,
      { headers: paydunyaHeaders() }
    );
    const data = await r.json();

    const completed = data.status === 'completed';
    const montant = data.invoice ? data.invoice.total_amount : PRICE_FCFA;
    const facture = factureNumber(token);

    if (completed) {
      await saveOrder({
        statut: 'paye',
        facture,
        token,
        ...(data.custom_data || {}),
        montant,
      });
    }

    return {
      statusCode: 200,
      body: {
        status: data.status || 'unknown',
        customer: data.custom_data || null,
        facture,
        montant,
        montantFormate: formatMontant(montant),
        date: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error('Erreur PayDunya (confirm):', err);
    return { statusCode: 502, body: { error: 'Vérification impossible pour le moment.' } };
  }
}

// --- IPN (notification serveur → serveur) ----------------------------------
async function handleIpn(body) {
  try {
    const data = body && body.data ? body.data : body;
    console.log('IPN PayDunya reçu:', JSON.stringify(data));
    if (data && data.status === 'completed') {
      const token = data.invoice ? data.invoice.token : undefined;
      await saveOrder({
        statut: 'paye_ipn',
        facture: factureNumber(token),
        token,
        ...(data.custom_data || {}),
        montant: data.invoice ? data.invoice.total_amount : PRICE_FCFA,
      });
    }
  } catch (err) {
    console.error('Erreur IPN:', err);
  }
  return { statusCode: 200, body: 'OK' };
}

module.exports = {
  PAYDUNYA_MODE,
  PRICE_FCFA,
  getConfig,
  createCheckout,
  verifyPayment,
  handleIpn,
  factureNumber,
};
