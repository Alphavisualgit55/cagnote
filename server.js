import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { generateSiteStream } from "./lib/generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Indique si une clé API est configurée (pour l'UI).
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(
      process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
    ),
  });
});

// Génération en streaming (SSE). Diffuse les fragments, puis un évènement
// `done` contenant le HTML complet. La persistance est gérée côté navigateur
// (localStorage), ce qui rend l'app compatible avec un hébergement statique
// + fonctions serverless (Netlify) sans état serveur.
app.post("/api/generate", async (req, res) => {
  const brief = req.body || {};
  if (!brief.description || brief.description.trim().length < 5) {
    return res
      .status(400)
      .json({ error: "Merci de décrire votre projet (5 caractères minimum)." });
  }
  if (brief.type !== "vitrine" && brief.type !== "ecommerce") {
    brief.type = "vitrine";
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const html = await generateSiteStream(brief, (delta) => {
      send("delta", { text: delta });
    });
    send("done", { html });
  } catch (err) {
    console.error("Erreur de génération:", err);
    const message =
      err?.status === 401 || /api key|authentication/i.test(err?.message || "")
        ? "Clé API Anthropic manquante ou invalide. Configurez ANTHROPIC_API_KEY."
        : err?.message || "Erreur lors de la génération.";
    send("error", { message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n  ⚡ Cagnote AI — http://localhost:${PORT}\n`);
});
