const { trackVisit } = require('../../lib/core');

exports.handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const result = await trackVisit(body.path, body.ref);
  return {
    statusCode: result.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.body),
  };
};
