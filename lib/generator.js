import Anthropic from "@anthropic-ai/sdk";

// Le SDK résout la clé depuis ANTHROPIC_API_KEY (ou un profil `ant auth login`).
const client = new Anthropic();

export const MODEL = "claude-opus-4-8";

const BASE_SYSTEM = `Tu es un générateur de sites web professionnel intégré à un SaaS appelé Cagnote.
Ta mission : produire un site web COMPLET, moderne et prêt à l'emploi, sous la forme d'un SEUL fichier HTML autonome.

RÈGLES ABSOLUES :
- Retourne UNIQUEMENT le code HTML. Aucune explication, aucun texte avant/après, aucune balise Markdown (pas de \`\`\`).
- Le document doit commencer par <!DOCTYPE html> et se terminer par </html>.
- Tout est inline : le CSS dans une balise <style> et le JavaScript dans une balise <script>. Aucune dépendance externe (pas de CDN, pas de framework, pas de police Google Fonts distante).
- Utilise les polices système (system-ui, -apple-system, Segoe UI, Roboto, sans-serif) et, si besoin d'une police d'affichage, Georgia/serif.
- Images : utilise des dégradés CSS, des formes SVG inline, ou des images d'illustration via https://picsum.photos/seed/<mot>/<largeur>/<hauteur>. N'utilise JAMAIS d'autres domaines d'images.
- Design distinctif et soigné : évite absolument l'esthétique "IA générique" (Inter/Roboto partout, dégradés violets sur blanc, layouts prévisibles). Choisis une palette cohérente adaptée au secteur d'activité, une vraie hiérarchie typographique, des micro-interactions et animations au survol/scroll.
- 100% responsive (mobile-first), accessible (contrastes, aria-labels, alt), et rapide.
- Contenu en FRANÇAIS par défaut (sauf si la description demande une autre langue), crédible et spécifique au métier — pas de "Lorem ipsum".
- SEO de base : <title>, meta description, structure de headings correcte.
- Ajoute un smooth-scroll et une navigation collante (sticky) avec ancres vers les sections.`;

const VITRINE_SECTIONS = `STRUCTURE ATTENDUE (site VITRINE) :
1. En-tête / navigation collante avec logo textuel et liens d'ancre + bouton d'appel à l'action.
2. Hero plein écran : titre fort, sous-titre, 1-2 boutons CTA, visuel/dégradé.
3. Section "Services" / "Prestations" : 3 à 6 cartes avec icônes SVG inline.
4. Section "À propos" avec un texte crédible et quelques chiffres clés (statistiques animées si possible).
5. Section "Réalisations" ou "Galerie" (grille d'images picsum).
6. Section "Témoignages" clients.
7. Section "Contact" avec un formulaire (nom, email, message) — validation JS côté client + message de confirmation simulé (pas d'envoi réseau réel).
8. Pied de page avec coordonnées, réseaux sociaux (icônes SVG) et mentions.`;

const ECOM_SECTIONS = `STRUCTURE ATTENDUE (site E-COMMERCE) :
1. En-tête collant : logo, navigation catégories, barre de recherche, et une icône panier affichant le nombre d'articles.
2. Hero / bannière promotionnelle.
3. Grille de PRODUITS (8 à 12) : chaque produit a une image (picsum), un nom, une description courte, un prix en euros, et un bouton "Ajouter au panier".
4. Filtres/catégories fonctionnels en JavaScript (afficher/masquer les produits).
5. Panier fonctionnel : un panneau latéral (drawer) ou modale qui liste les articles ajoutés, permet de modifier les quantités et de supprimer, calcule le total, et persiste dans localStorage.
6. Bouton "Passer commande" ouvrant un formulaire de checkout simulé (livraison + paiement factices) avec message de confirmation — aucun paiement réel.
7. Section confiance : livraison, retours, paiement sécurisé (icônes SVG).
8. Pied de page complet.
Le JavaScript du panier doit être robuste, sans erreur, et entièrement autonome.`;

function buildUserPrompt(brief) {
  const {
    type,
    businessName,
    sector,
    description,
    primaryColor,
    style,
    language,
  } = brief;

  const kind = type === "ecommerce" ? "e-commerce" : "vitrine";
  const sections = type === "ecommerce" ? ECOM_SECTIONS : VITRINE_SECTIONS;

  return `Génère un site ${kind} complet pour l'entreprise suivante.

- Nom de l'entreprise : ${businessName || "(à inventer, crédible pour le secteur)"}
- Secteur / activité : ${sector || "à déduire de la description"}
- Description du projet : ${description}
- Couleur principale souhaitée : ${primaryColor || "à choisir selon le secteur"}
- Style visuel souhaité : ${style || "moderne et élégant, adapté au secteur"}
- Langue du contenu : ${language || "français"}

${sections}

Rappel : réponds UNIQUEMENT avec le code HTML complet du fichier, rien d'autre.`;
}

/**
 * Génère un site en streaming. Appelle onDelta(text) pour chaque fragment.
 * Retourne le HTML complet (nettoyé) une fois terminé.
 */
export async function generateSiteStream(brief, onDelta) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: BASE_SYSTEM,
    messages: [{ role: "user", content: buildUserPrompt(brief) }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onDelta(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  const raw = final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return cleanHtml(raw);
}

// Retire d'éventuelles clôtures Markdown si le modèle en ajoute malgré tout.
export function cleanHtml(text) {
  let html = text.trim();
  const fence = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) html = fence[1].trim();
  const start = html.indexOf("<!DOCTYPE");
  if (start > 0) html = html.slice(start);
  return html.trim();
}
