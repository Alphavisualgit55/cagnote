// Indique à l'interface si une clé API est configurée côté Netlify.
export default async () =>
  new Response(
    JSON.stringify({
      ok: true,
      hasApiKey: Boolean(
        process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
      ),
    }),
    { headers: { "content-type": "application/json" } },
  );
