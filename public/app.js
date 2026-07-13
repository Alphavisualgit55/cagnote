const $ = (sel) => document.querySelector(sel);

const form = $("#genForm");
const genBtn = $("#genBtn");
const formHint = $("#formHint");
const placeholder = $("#placeholder");
const codeStream = $("#codeStream");
const previewFrame = $("#previewFrame");
const previewActions = $("#previewActions");
const previewLabel = $("#previewLabel");
const projectsList = $("#projectsList");

let currentId = null;
let currentHtml = "";

// --- Vérification de la clé API ---
async function checkHealth() {
  try {
    const r = await fetch("/api/health");
    const h = await r.json();
    const badge = $("#apiBadge");
    badge.hidden = false;
    if (h.hasApiKey) {
      badge.textContent = "● API connectée";
      badge.className = "badge ok";
    } else {
      badge.textContent = "● Clé API manquante";
      badge.className = "badge warn";
    }
  } catch {
    /* silencieux */
  }
}

// Synchronise le sélecteur de couleur avec le champ texte.
$("#colorPicker").addEventListener("input", (e) => {
  form.primaryColor.value = e.target.value;
});

// --- Génération (streaming SSE) ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const brief = {
    type: form.type.value,
    businessName: form.businessName.value.trim(),
    sector: form.sector.value.trim(),
    description: form.description.value.trim(),
    primaryColor: form.primaryColor.value.trim(),
    style: form.style.value,
  };

  if (brief.description.length < 5) {
    formHint.textContent = "Décrivez votre projet un peu plus en détail.";
    formHint.className = "hint error";
    return;
  }

  setLoading(true);
  formHint.textContent = "";
  currentHtml = "";
  currentId = null;
  placeholder.hidden = true;
  previewFrame.hidden = true;
  previewActions.hidden = true;
  codeStream.hidden = false;
  codeStream.textContent = "";
  previewLabel.textContent = "Génération en cours…";

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brief),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Erreur serveur.");
    }

    await readStream(res.body);
  } catch (err) {
    showError(err.message || "Erreur inattendue.");
  } finally {
    setLoading(false);
  }
});

// Lit un flux SSE et dispatche les évènements.
async function readStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const chunk of parts) {
      const evLine = chunk.match(/^event: (.+)$/m);
      const dataLine = chunk.match(/^data: (.+)$/m);
      if (!evLine || !dataLine) continue;
      const event = evLine[1];
      let data;
      try {
        data = JSON.parse(dataLine[1]);
      } catch {
        continue;
      }
      handleEvent(event, data);
    }
  }
}

function handleEvent(event, data) {
  if (event === "delta") {
    currentHtml += data.text;
    codeStream.textContent = currentHtml;
    codeStream.scrollTop = codeStream.scrollHeight;
  } else if (event === "done") {
    currentId = data.id;
    renderPreview(currentHtml);
    previewLabel.textContent = "Aperçu — terminé ✓";
    previewActions.hidden = false;
    loadProjects();
  } else if (event === "error") {
    showError(data.message);
  }
}

function renderPreview(html) {
  codeStream.hidden = true;
  previewFrame.hidden = false;
  previewFrame.srcdoc = html;
}

function showError(msg) {
  codeStream.hidden = true;
  placeholder.hidden = false;
  placeholder.querySelector("p").innerHTML = "❌ " + msg;
  previewLabel.textContent = "Erreur";
}

function setLoading(on) {
  genBtn.disabled = on;
  genBtn.textContent = on ? "⏳ Génération…" : "⚡ Générer le site";
}

// --- Actions d'aperçu ---
$("#dlBtn").addEventListener("click", () => {
  if (currentId) window.location.href = `/api/projects/${currentId}/download`;
});
$("#openBtn").addEventListener("click", () => {
  if (currentId) window.open(`/api/projects/${currentId}/preview`, "_blank");
});

// --- Galerie de projets ---
async function loadProjects() {
  try {
    const r = await fetch("/api/projects");
    const list = await r.json();
    if (!Array.isArray(list) || list.length === 0) {
      projectsList.innerHTML =
        '<p class="muted">Aucun site pour le moment. Générez votre premier site ci-dessus.</p>';
      return;
    }
    projectsList.innerHTML = "";
    for (const p of list) {
      projectsList.appendChild(renderProjectCard(p));
    }
  } catch {
    projectsList.innerHTML = '<p class="muted">Impossible de charger les projets.</p>';
  }
}

function renderProjectCard(p) {
  const el = document.createElement("div");
  el.className = "project";
  const name = escapeHtml(p.brief.businessName || "Site sans nom");
  const desc = escapeHtml(p.brief.description || "");
  const typeLabel = p.brief.type === "ecommerce" ? "🛒 E-commerce" : "🏛️ Vitrine";
  const date = new Date(p.createdAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  el.innerHTML = `
    <div class="thumb">
      <iframe loading="lazy" src="/api/projects/${p.id}/preview" title="${name}"></iframe>
    </div>
    <div class="meta">
      <span class="tag">${typeLabel} · ${date}</span>
      <h3>${name}</h3>
      <p class="desc">${desc}</p>
    </div>
    <div class="actions">
      <button class="btn btn-ghost btn-sm act-open">↗ Ouvrir</button>
      <a class="btn btn-primary btn-sm" href="/api/projects/${p.id}/download">⬇</a>
      <button class="icon-del act-del" title="Supprimer">🗑</button>
    </div>`;

  el.querySelector(".act-open").addEventListener("click", () =>
    window.open(`/api/projects/${p.id}/preview`, "_blank"),
  );
  el.querySelector(".act-del").addEventListener("click", async () => {
    if (!confirm(`Supprimer « ${p.brief.businessName || "ce site"} » ?`)) return;
    await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    loadProjects();
  });
  return el;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

$("#refreshBtn").addEventListener("click", loadProjects);

// Init
checkHealth();
loadProjects();
