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
    instagramUrl: process.env.INSTAGRAM_URL || '',
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

// ---------------------------------------------------------------------------
// Suivi des visiteurs
// ---------------------------------------------------------------------------
async function trackVisit(path, ref) {
  const db = supabase();
  if (!db) return { statusCode: 200, body: { ok: false } };
  await db.from('visits').insert({ path: String(path || '/').slice(0, 200), ref: String(ref || '').slice(0, 200) });
  return { statusCode: 200, body: { ok: true } };
}

// ---------------------------------------------------------------------------
// Assets dynamiques (images uploadées depuis l'admin) + réglages publics
// ---------------------------------------------------------------------------
const ASSET_SLOTS = [
  'photo-hero', 'photo-portrait', 'photo-travail',
  'result-1', 'result-2', 'result-3', 'result-4',
  'result-5', 'result-6', 'result-7', 'result-8',
];

async function getAssets() {
  const db = supabase();
  const out = { assets: {}, settings: {} };
  if (!db) return { statusCode: 200, body: out };
  try {
    const { data: files } = await db.storage.from('site-assets').list('', { limit: 100 });
    const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/site-assets/`;
    (files || []).forEach((f) => {
      const slot = f.name.replace(/\.[a-z0-9]+$/i, '');
      if (ASSET_SLOTS.includes(slot)) {
        out.assets[slot] = `${base}${f.name}?v=${encodeURIComponent(f.updated_at || '')}`;
      }
    });
    const { data: settings } = await db.from('settings').select('key,value');
    (settings || []).forEach((s) => { out.settings[s.key] = s.value; });
  } catch (err) {
    console.error('Erreur getAssets:', err.message);
  }
  return { statusCode: 200, body: out };
}

// ---------------------------------------------------------------------------
// Panneau admin (protégé par ADMIN_PASSWORD)
// Sécurité : comparaison à temps constant + verrouillage anti-force-brute
// (verrou de LOCK_MINUTES après MAX_FAILS échecs, suivi par IP dans Supabase).
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const MAX_FAILS = 6;
const LOCK_MINUTES = 15;

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length || ba.length === 0) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function authAdmin(key, ip) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) {
    return { ok: false, error: { statusCode: 401, body: { error: 'ADMIN_PASSWORD non configuré côté serveur.' } } };
  }
  const db = supabase();
  ip = String(ip || 'unknown').slice(0, 60);

  // Vérifie si l'IP est verrouillée
  if (db) {
    const { data: row } = await db.from('admin_attempts').select('locked_until').eq('ip', ip).maybeSingle();
    if (row && row.locked_until && new Date(row.locked_until) > new Date()) {
      const mins = Math.max(1, Math.ceil((new Date(row.locked_until) - new Date()) / 60000));
      return { ok: false, error: { statusCode: 429, body: { error: `Trop de tentatives. Compte verrouillé, réessaie dans ${mins} min.` } } };
    }
  }

  const good = safeEqual(key, expected);

  // Met à jour le compteur d'échecs (best-effort)
  if (db) {
    try {
      if (good) {
        await db.from('admin_attempts').upsert({ ip, fails: 0, locked_until: null, updated_at: new Date().toISOString() });
      } else {
        const { data: row } = await db.from('admin_attempts').select('fails').eq('ip', ip).maybeSingle();
        const fails = ((row && row.fails) || 0) + 1;
        const locked = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
        await db.from('admin_attempts').upsert({ ip, fails, locked_until: locked, updated_at: new Date().toISOString() });
      }
    } catch (e) {
      console.error('admin_attempts:', e.message);
    }
  }

  if (!good) return { ok: false, error: { statusCode: 401, body: { error: 'Mot de passe admin invalide.' } } };
  return { ok: true };
}

async function adminStats(key, ip) {
  const auth = await authAdmin(key, ip);
  if (!auth.ok) return auth.error;
  const db = supabase();
  if (!db) return { statusCode: 500, body: { error: 'Supabase non configuré.' } };

  const now = new Date();
  const dayMs = 86400000;
  const since7 = new Date(now.getTime() - 7 * dayMs).toISOString();
  const since30 = new Date(now.getTime() - 30 * dayMs).toISOString();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [vTotal, vToday, v7, orders] = await Promise.all([
    db.from('visits').select('id', { count: 'exact', head: true }),
    db.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', today),
    db.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', since7),
    db.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
  ]);

  const all = orders.data || [];
  // Dédoublonne par token : garde le statut le plus avancé (payé > en attente)
  const byToken = new Map();
  all.forEach((o) => {
    const k = o.token || `id-${o.id}`;
    const cur = byToken.get(k);
    const isPaid = (o.statut || '').startsWith('paye');
    if (!cur || (isPaid && !(cur.statut || '').startsWith('paye'))) byToken.set(k, o);
  });
  const unique = Array.from(byToken.values());
  const paid = unique.filter((o) => (o.statut || '').startsWith('paye'));
  const paid30 = paid.filter((o) => o.created_at >= since30);

  return {
    statusCode: 200,
    body: {
      visitors: { total: vTotal.count || 0, today: vToday.count || 0, last7days: v7.count || 0 },
      sales: {
        paidCount: paid.length,
        revenue: paid.reduce((s, o) => s + (o.montant || 0), 0),
        paidLast30days: paid30.length,
        pendingCount: unique.length - paid.length,
      },
      orders: unique.slice(0, 200),
    },
  };
}

async function adminUpload(key, ip, slot, dataBase64, contentType) {
  const auth = await authAdmin(key, ip);
  if (!auth.ok) return auth.error;
  if (!ASSET_SLOTS.includes(slot)) {
    return { statusCode: 400, body: { error: `Emplacement inconnu : ${slot}` } };
  }
  if (!/^image\/(jpeg|png|webp|gif)$/.test(contentType || '')) {
    return { statusCode: 400, body: { error: 'Format accepté : JPG, PNG, WEBP ou GIF.' } };
  }
  const db = supabase();
  if (!db) return { statusCode: 500, body: { error: 'Supabase non configuré.' } };

  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.length > 4 * 1024 * 1024) {
    return { statusCode: 400, body: { error: 'Image trop lourde (max 4 Mo). Compresse-la avant.' } };
  }
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  // Supprime les anciennes versions du slot (autres extensions)
  const { data: files } = await db.storage.from('site-assets').list('', { limit: 100 });
  const old = (files || []).filter((f) => f.name.replace(/\.[a-z0-9]+$/i, '') === slot).map((f) => f.name);
  if (old.length) await db.storage.from('site-assets').remove(old);

  const { error } = await db.storage.from('site-assets').upload(`${slot}.${ext}`, buffer, {
    contentType,
    upsert: true,
  });
  if (error) return { statusCode: 500, body: { error: `Upload échoué : ${error.message}` } };
  return { statusCode: 200, body: { ok: true, slot } };
}

async function adminDeleteAsset(key, ip, slot) {
  const auth = await authAdmin(key, ip);
  if (!auth.ok) return auth.error;
  const db = supabase();
  if (!db) return { statusCode: 500, body: { error: 'Supabase non configuré.' } };
  const { data: files } = await db.storage.from('site-assets').list('', { limit: 100 });
  const match = (files || []).filter((f) => f.name.replace(/\.[a-z0-9]+$/i, '') === slot).map((f) => f.name);
  if (match.length) await db.storage.from('site-assets').remove(match);
  return { statusCode: 200, body: { ok: true } };
}

async function adminSetSetting(key, ip, name, value) {
  const auth = await authAdmin(key, ip);
  if (!auth.ok) return auth.error;
  const allowed = ['video_url', 'instagram_url'];
  if (!allowed.includes(name)) return { statusCode: 400, body: { error: 'Réglage inconnu.' } };
  const db = supabase();
  if (!db) return { statusCode: 500, body: { error: 'Supabase non configuré.' } };
  const { error } = await db.from('settings').upsert({ key: name, value: String(value || ''), updated_at: new Date().toISOString() });
  if (error) return { statusCode: 500, body: { error: error.message } };
  return { statusCode: 200, body: { ok: true } };
}

module.exports = {
  PAYDUNYA_MODE,
  PRICE_FCFA,
  ASSET_SLOTS,
  getConfig,
  createCheckout,
  verifyPayment,
  handleIpn,
  factureNumber,
  trackVisit,
  getAssets,
  adminStats,
  adminUpload,
  adminDeleteAsset,
  adminSetSetting,
};
