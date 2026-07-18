const core = require('../../lib/core');

// Endpoint admin multiplexé : /api/admin/{stats|upload|delete-asset|setting}
exports.handler = async (event) => {
  const key = event.headers['x-admin-key'] || '';
  const action = (event.queryStringParameters || {}).action
    || (event.path || '').split('/').filter(Boolean).pop();

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }

  let result;
  if (action === 'stats') {
    result = await core.adminStats(key);
  } else if (action === 'upload') {
    result = await core.adminUpload(key, body.slot, body.data, body.contentType);
  } else if (action === 'delete-asset') {
    result = await core.adminDeleteAsset(key, body.slot);
  } else if (action === 'setting') {
    result = await core.adminSetSetting(key, body.name, body.value);
  } else {
    result = { statusCode: 404, body: { error: `Action admin inconnue : ${action}` } };
  }

  return {
    statusCode: result.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.body),
  };
};
