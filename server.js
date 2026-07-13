import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { generateSiteStream } from "./lib/generator.js";
import {
  saveProject,
  listProjects,
  getProject,
  deleteProject,
} from "./lib/store.js";

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

// Génération en streaming (SSE). Envoie les fragments au fur et à mesure,
// puis un évènement `done` avec l'identifiant du projet sauvegardé.
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

    const project = await saveProject({ brief, html });
    send("done", { id: project.id, size: html.length });
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

app.get("/api/projects", async (_req, res) => {
  try {
    res.json(await listProjects());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    res.json(await getProject(req.params.id));
  } catch {
    res.status(404).json({ error: "Projet introuvable." });
  }
});

// Aperçu direct du site généré (rendu dans un iframe).
app.get("/api/projects/:id/preview", async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    res.type("html").send(project.html);
  } catch {
    res.status(404).send("Projet introuvable.");
  }
});

// Téléchargement du fichier HTML.
app.get("/api/projects/:id/download", async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    const name = (project.brief.businessName || "site")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${name || "site"}.html"`,
    );
    res.type("html").send(project.html);
  } catch {
    res.status(404).send("Projet introuvable.");
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await deleteProject(req.params.id);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Projet introuvable." });
  }
});

app.listen(PORT, () => {
  console.log(`\n  ⚡ Cagnote AI — http://localhost:${PORT}\n`);
});
