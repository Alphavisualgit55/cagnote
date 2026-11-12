const { verifyPayment } = require('../../lib/core');

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  // Le token peut arriver via ?token=... (redirect) ou en fin de chemin.
  let token = params.token;
  if (!token) {
    const parts = (event.path || '').split('/').filter(Boolean);
    token = parts[parts.length - 1];
  }

  if (!token || token === 'verify') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Token manquant.' }) };
  }

  const result = await verifyPayment(token);
  return {
    statusCode: result.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.body),
  };
};
