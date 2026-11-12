const { getConfig } = require('../../lib/core');

function siteUrl(event) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  if (process.env.URL) return process.env.URL.replace(/\/$/, '');
  const host = event.headers['x-forwarded-host'] || event.headers.host;
  const proto = event.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getConfig(siteUrl(event))),
  };
};
