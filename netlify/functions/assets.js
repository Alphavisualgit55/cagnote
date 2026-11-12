const { getAssets } = require('../../lib/core');

exports.handler = async () => {
  const result = await getAssets();
  return {
    statusCode: result.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.body),
  };
};
