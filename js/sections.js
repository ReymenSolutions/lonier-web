// Secciones que se repiten en varias páginas: "Cómo usar" y "Antes y después".
// En el HTML: <div data-section="how-to"></div> y <div data-section="results"></div>.
import { icon } from "./icons.js";

// Fotos de antes y después. Cuando las tengas, súbelas a assets/resultados/ y llena before/after, por ejemplo:
//   { before: "/assets/resultados/ana-antes.webp", after: "/assets/resultados/ana-despues.webp", caption: "Ana, 4 semanas" }
// Mientras estén vacías se muestran recuadros de "Próximamente".
export const RESULTS = [
  { before: "", after: "", caption: "" },
  { before: "", after: "", caption: "" },
  { before: "", after: "", caption: "" },
];

const svg = (body) =>
  `<svg class="step-art" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const FACE =
  '<path d="M60 18c-17 0-28 13-28 32 0 12 4 22 10 30 5 7 11 12 18 12s13-5 18-12c6-8 10-18 10-30 0-19-11-32-28-32z"/>' +
  '<path d="M47 52q5 3 10 0"/><path d="M63 52q5 3 10 0"/><path d="M60 56v10l-3 3"/><path d="M53 78q7 4 14 0"/>' +
  '<path d="M48 89v13"/><path d="M72 89v13"/>';

const drop = (x, y, s = 1) =>
  `<path d="M${x} ${y}c${3 * s} ${5 * s} ${5 * s} ${8 * s} ${5 * s} ${10 * s}a${5 * s} ${5 * s} 0 0 1-${10 * s} 0c0-${2 * s} ${2 * s}-${5 * s} ${5 * s}-${10 * s}z"/>`;

const STEPS = [
  {
    title: "Limpia tu rostro",
    text: "Lava y seca tu piel antes de aplicar.",
    art: svg(
      FACE +
        drop(94, 16) +
        drop(104, 38, 0.7) +
        '<circle cx="40" cy="68" r="3"/><circle cx="35" cy="60" r="2"/><circle cx="82" cy="67" r="2.5"/><circle cx="86" cy="59" r="1.6"/>'
    ),
  },
  {
    title: "Aplica de 3 a 5 gotas",
    text: "Directo en el rostro limpio, de mañana y/o de noche.",
    art: svg(
      '<path d="M54 28v-8a6 6 0 0 1 12 0v8"/><rect x="50" y="28" width="20" height="10" rx="2"/><path d="M54 38v4h12v-4"/>' +
        '<path d="M46 50a8 8 0 0 1 8-8h12a8 8 0 0 1 8 8v44a6 6 0 0 1-6 6H52a6 6 0 0 1-6-6z"/>' +
        '<rect x="50" y="60" width="20" height="24" rx="2"/>' +
        drop(60, 64, 0.5) +
        drop(92, 34, 0.6) +
        drop(92, 54, 0.6) +
        drop(92, 74, 0.6)
    ),
  },
  {
    title: "Masajea suavemente",
    text: "Con movimientos circulares hasta que se absorba.",
    art: svg(
      FACE +
        '<path d="M34 66a8 8 0 1 0 8-8"/><path d="M38 56l4 2-2 4"/>' +
        '<path d="M86 66a8 8 0 1 1-8-8"/><path d="M82 56l-4 2 2 4"/>'
    ),
  },
  {
    title: "Finaliza con hidratante y SPF",
    text: "De día, siempre protector solar.",
    art: svg(
      '<rect x="30" y="60" width="52" height="12" rx="3"/><path d="M34 72h44v22a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6z"/><path d="M44 86h24"/>' +
        '<circle cx="86" cy="32" r="11"/><path d="M86 14v-4"/><path d="M86 54v-4"/><path d="M104 32h4"/><path d="M64 32h4"/>' +
        '<path d="m98.7 19.3 2.8-2.8"/><path d="m70.5 47.5 2.8-2.8"/><path d="m98.7 44.7 2.8 2.8"/><path d="m70.5 16.5 2.8 2.8"/>' +
        '<text x="86" y="35" font-size="7.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial, sans-serif">SPF</text>'
    ),
  },
];

function howTo() {
  return `
    <div class="howto">
      <div class="section-head">
        <h2>Cómo usar <span class="gold">Lonier Serum</span></h2>
        <p>Constancia simple, piel más luminosa.</p>
      </div>
      <ol class="howto-steps">
        ${STEPS.map(
          (step, i) => `
          <li class="howto-step">
            <span class="howto-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
            ${step.art}
            <strong>${step.title}</strong>
            <span>${step.text}</span>
          </li>`
        ).join("")}
      </ol>
    </div>`;
}

function photo(src, label, caption) {
  return src
    ? `<figure class="result-photo"><img src="${src}" alt="${label}${caption ? ` · ${caption}` : ""}" loading="lazy" /><figcaption>${label}</figcaption></figure>`
    : `<figure class="result-photo placeholder">${icon("image", { size: 28 })}<figcaption>${label}</figcaption></figure>`;
}

function results() {
  const hasPhotos = RESULTS.some((r) => r.before && r.after);
  return `
    <div class="results">
      <div class="section-head">
        <h2>Antes y después</h2>
        <p>${hasPhotos ? "Resultados de nuestras clientas usando Lonier Serum." : "Muy pronto, fotos reales de nuestras clientas usando Lonier Serum."}</p>
      </div>
      <div class="results-grid">
        ${RESULTS.map(
          (r) => `
          <div class="result-card">
            <div class="result-pair">
              ${photo(r.before, "Antes", r.caption)}
              ${photo(r.after, "Después", r.caption)}
            </div>
            <p class="result-caption">${r.caption || (hasPhotos ? "" : "Próximamente")}</p>
          </div>`
        ).join("")}
      </div>
      ${hasPhotos ? `<p class="results-note">Fotos compartidas por clientas con su permiso. Los resultados pueden variar en cada persona.</p>` : ""}
    </div>`;
}

const SECTIONS = { "how-to": howTo, results };

export function mountSections(root = document) {
  root.querySelectorAll("[data-section]").forEach((el) => {
    const render = SECTIONS[el.dataset.section];
    if (render) el.innerHTML = render();
  });
}
