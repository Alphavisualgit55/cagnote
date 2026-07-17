const { handleIpn } = require('../../lib/core');

// PayDunya envoie l'IPN en application/x-www-form-urlencoded avec un champ "data".
function parseBody(event) {
  const raw = event.body || '';
  const ct = (event.headers['content-type'] || '').toLowerCase();
  try {
    if (ct.includes('application/json')) return JSON.parse(raw);
    const params = new URLSearchParams(raw);
    const obj = {};
    for (const [k, v] of params.entries()) {
      try {
        obj[k] = JSON.parse(v);
      } catch {
        obj[k] = v;
      }
    }
    return obj;
  } catch {
    return {};
  }
}

exports.handler = async (event) => {
  const body = parseBody(event);
  const result = await handleIpn(body);
  return { statusCode: result.statusCode, body: result.body };
};
