// Serveur Express pour le développement local.
// En production, le site tourne sur Netlify (voir netlify/functions/).
// La logique métier est partagée dans lib/core.js.
require('dotenv').config();

const express = require('express');
const path = require('path');
const core = require('./lib/core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
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

app.listen(PORT, () => {
  console.log(`Ecom Booster en ligne sur http://localhost:${PORT} (PayDunya mode: ${core.PAYDUNYA_MODE})`);
});
