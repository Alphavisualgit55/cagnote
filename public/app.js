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

const STORE_KEY = "cagnote.projects";
let currentHtml = "";
let currentBrief = null;

/* ---------- Persistance navigateur (localStorage) ---------- */
function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveStore(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}
function addProject(brief, html) {
  const list = loadStore();
  const project = {
    id:
      (crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now()) + Math.random().toString(16).slice(2),
    brief,
    html,
    createdAt: new Date().toISOString(),
  };
  list.unshift(project);
  saveStore(list);
  return project;
}
function getProject(id) {
  return loadStore().find((p) => p.id === id);
}
function removeProject(id) {
  saveStore(loadStore().filter((p) => p.id !== id));
}

/* ---------- Vérification de la clé API ---------- */
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

/* ---------- Génération (streaming SSE) ---------- */
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
  currentBrief = brief;
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
      let data;
      try {
        data = JSON.parse(dataLine[1]);
      } catch {
        continue;
      }
      handleEvent(evLine[1], data);
    }
  }
}

function handleEvent(event, data) {
  if (event === "delta") {
    currentHtml += data.text;
    codeStream.textContent = currentHtml;
    codeStream.scrollTop = codeStream.scrollHeight;
  } else if (event === "done") {
    if (data.html) currentHtml = data.html;
    renderPreview(currentHtml);
    previewLabel.textContent = "Aperçu — terminé ✓";
    previewActions.hidden = false;
    if (currentBrief) addProject(currentBrief, currentHtml);
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
  placeholder.querySelector("p").innerHTML = "❌ " + escapeHtml(msg);
  previewLabel.textContent = "Erreur";
}

function setLoading(on) {
  genBtn.disabled = on;
  genBtn.textContent = on ? "⏳ Génération…" : "⚡ Générer le site";
}

/* ---------- Aperçu / téléchargement (côté client) ---------- */
function downloadHtml(html, businessName) {
  const name =
    (businessName || "site")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "site";
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function openHtml(html) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

$("#dlBtn").addEventListener("click", () => {
  if (currentHtml) downloadHtml(currentHtml, currentBrief?.businessName);
});
$("#openBtn").addEventListener("click", () => {
  if (currentHtml) openHtml(currentHtml);
});

/* ---------- Galerie ---------- */
function loadProjects() {
  const list = loadStore();
  if (list.length === 0) {
    projectsList.innerHTML =
      '<p class="muted">Aucun site pour le moment. Générez votre premier site ci-dessus.</p>';
    return;
  }
  projectsList.innerHTML = "";
  for (const p of list) projectsList.appendChild(renderProjectCard(p));
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
    <div class="thumb"><iframe loading="lazy" title="${name}"></iframe></div>
    <div class="meta">
      <span class="tag">${typeLabel} · ${date}</span>
      <h3>${name}</h3>
      <p class="desc">${desc}</p>
    </div>
    <div class="actions">
      <button class="btn btn-ghost btn-sm act-open">↗ Ouvrir</button>
      <button class="btn btn-primary btn-sm act-dl">⬇</button>
      <button class="icon-del act-del" title="Supprimer">🗑</button>
    </div>`;

  // Miniature via srcdoc (aucune requête réseau, contenu isolé).
  el.querySelector("iframe").srcdoc = p.html;
  el.querySelector(".act-open").addEventListener("click", () => openHtml(p.html));
  el.querySelector(".act-dl").addEventListener("click", () =>
    downloadHtml(p.html, p.brief.businessName),
  );
  el.querySelector(".act-del").addEventListener("click", () => {
    if (!confirm(`Supprimer « ${p.brief.businessName || "ce site"} » ?`)) return;
    removeProject(p.id);
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
