// Serveur Express pour le développement local.
// En production, le site tourne sur Netlify (voir netlify/functions/).
// La logique métier est partagée dans lib/core.js.
require('dotenv').config();

const express = require('express');
const path = require('path');
const core = require('./lib/core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function siteUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function send(res, result) {
  res.status(result.statusCode).json(result.body);
}

app.get('/api/config', (req, res) => {
  res.json(core.getConfig(siteUrl(req)));
});

app.post('/api/checkout', async (req, res) => {
  send(res, await core.createCheckout(req.body || {}, siteUrl(req)));
});

app.get('/api/verify/:token', async (req, res) => {
  send(res, await core.verifyPayment(req.params.token));
});

app.post('/api/paydunya/ipn', async (req, res) => {
  const result = await core.handleIpn(req.body);
  res.status(result.statusCode).send(result.body);
});

// --- Visiteurs & assets dynamiques ---
app.post('/api/track', async (req, res) => {
  send(res, await core.trackVisit((req.body || {}).path, (req.body || {}).ref));
});

app.get('/api/assets', async (_req, res) => {
  send(res, await core.getAssets());
});

// --- Panneau admin ---
const adminKey = (req) => req.get('x-admin-key') || '';

app.get('/api/admin/stats', async (req, res) => {
  send(res, await core.adminStats(adminKey(req)));
});

app.post('/api/admin/upload', async (req, res) => {
  const { slot, data, contentType } = req.body || {};
  send(res, await core.adminUpload(adminKey(req), slot, data, contentType));
});

app.post('/api/admin/delete-asset', async (req, res) => {
  send(res, await core.adminDeleteAsset(adminKey(req), (req.body || {}).slot));
});

app.post('/api/admin/setting', async (req, res) => {
  const { name, value } = req.body || {};
  send(res, await core.adminSetSetting(adminKey(req), name, value));
});

app.listen(PORT, () => {
  console.log(`Ecom Booster en ligne sur http://localhost:${PORT} (PayDunya mode: ${core.PAYDUNYA_MODE})`);
});
