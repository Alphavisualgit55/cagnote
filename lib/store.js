import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data", "projects");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function safeId(id) {
  // Empêche toute traversée de répertoire : uniquement des UUID.
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Identifiant invalide");
  return id;
}

export async function saveProject({ brief, html }) {
  await ensureDir();
  const id = randomUUID();
  const project = {
    id,
    brief,
    html,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(DATA_DIR, `${id}.json`),
    JSON.stringify(project, null, 2),
    "utf8",
  );
  return project;
}

export async function listProjects() {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const projects = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
      const p = JSON.parse(raw);
      // On n'expose pas le HTML complet dans la liste (léger).
      projects.push({
        id: p.id,
        brief: p.brief,
        createdAt: p.createdAt,
        size: p.html?.length ?? 0,
      });
    } catch {
      /* fichier corrompu ignoré */
    }
  }
  projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return projects;
}

export async function getProject(id) {
  await ensureDir();
  const raw = await fs.readFile(path.join(DATA_DIR, `${safeId(id)}.json`), "utf8");
  return JSON.parse(raw);
}

export async function deleteProject(id) {
  await fs.unlink(path.join(DATA_DIR, `${safeId(id)}.json`));
}
