import { generateSiteStream } from "../../lib/generator.js";

// Fonction serverless Netlify (v2) : génère un site en streaming SSE.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  let brief;
  try {
    brief = await req.json();
  } catch {
    brief = {};
  }

  if (!brief.description || brief.description.trim().length < 5) {
    return new Response(
      JSON.stringify({ error: "Merci de décrire votre projet (5 caractères minimum)." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  if (brief.type !== "vitrine" && brief.type !== "ecommerce") brief.type = "vitrine";

  const encoder = new TextEncoder();
  const sse = (event, data) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const html = await generateSiteStream(brief, (delta) => {
          controller.enqueue(sse("delta", { text: delta }));
        });
        controller.enqueue(sse("done", { html }));
      } catch (err) {
        const message =
          err?.status === 401 ||
          /api key|authentication/i.test(err?.message || "")
            ? "Clé API Anthropic manquante ou invalide. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement Netlify."
            : err?.message || "Erreur lors de la génération.";
        controller.enqueue(sse("error", { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};
