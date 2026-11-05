// Iconos de línea (estilo Lucide, licencia ISC) y logos de métodos de pago, como SVG en línea.
// En el HTML basta con <span data-icon="truck"></span>: initLayout() los dibuja.

const PATHS = {
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  droplets:
    '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
  sparkles:
    '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  star:
    '<path fill="currentColor" stroke="none" d="M11.53 2.3a.53.53 0 0 1 .94 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.75a.53.53 0 0 1 .3.9l-3.74 3.65a2.12 2.12 0 0 0-.61 1.87l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.87L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"/>',
  whatsapp:
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.6 8.4c.3-.3.8-.3 1 .1l.7 1.1c.2.3.1.7-.1 1l-.5.5a5.2 5.2 0 0 0 2.3 2.3l.5-.5c.3-.2.7-.3 1-.1l1.1.7c.4.2.4.7.1 1l-.5.6c-.6.6-1.6.8-2.4.4a8.3 8.3 0 0 1-3.7-3.7c-.4-.8-.2-1.8.4-2.4z"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
};

export function icon(name, { size = 20, className = "" } = {}) {
  const paths = PATHS[name];
  if (!paths) return "";
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

// Reemplaza <span data-icon="nombre" data-size="24"></span> por su SVG.
export function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (el.dataset.iconDone) return;
    el.innerHTML = icon(el.dataset.icon, { size: Number(el.dataset.size) || 20 });
    el.dataset.iconDone = "1";
  });
}

// ---------- Logos de pago ----------

const card = (label, body, bg = "#fff") =>
  `<svg class="pay-logo" viewBox="0 0 48 30" role="img" aria-label="${label}"><rect x=".5" y=".5" width="47" height="29" rx="5" fill="${bg}" stroke="rgba(0,0,0,.12)"/>${body}</svg>`;

const FONT = 'font-family="Arial, Helvetica, sans-serif" font-weight="700"';

const LOGOS = {
  visa: card("Visa", `<text x="24" y="20" text-anchor="middle" ${FONT} font-style="italic" font-size="13" fill="#1A1F71" letter-spacing=".5">VISA</text>`),
  mastercard: card(
    "Mastercard",
    `<circle cx="19.5" cy="15" r="8" fill="#EB001B"/><circle cx="28.5" cy="15" r="8" fill="#F79E1B"/><path d="M24 8.4a8 8 0 0 1 0 13.2 8 8 0 0 1 0-13.2z" fill="#FF5F00"/>`
  ),
  amex: card("American Express", `<text x="24" y="19" text-anchor="middle" ${FONT} font-size="10.5" fill="#fff" letter-spacing=".3">AMEX</text>`, "#1F72CD"),
  paypal: card(
    "PayPal",
    `<text x="24" y="19.5" text-anchor="middle" ${FONT} font-style="italic" font-size="11"><tspan fill="#003087">Pay</tspan><tspan fill="#009CDE">Pal</tspan></text>`
  ),
  mercadopago: card(
    "Mercado Pago",
    `<text x="24" y="13.5" text-anchor="middle" ${FONT} font-size="7.5" fill="#fff">mercado</text><text x="24" y="22.5" text-anchor="middle" ${FONT} font-size="7.5" fill="#fff">pago</text>`,
    "#009EE3"
  ),
  oxxo: card(
    "OXXO",
    `<rect x="4" y="6" width="40" height="18" rx="1.5" fill="#F9B000"/><rect x="4" y="8.6" width="40" height="12.8" fill="#E1251B"/><text x="24" y="18.6" text-anchor="middle" ${FONT} font-size="10" fill="#fff" letter-spacing=".6">OXXO</text>`
  ),
};

export function paymentLogos(names = ["visa", "mastercard", "amex", "paypal", "mercadopago", "oxxo"]) {
  return `<div class="pay-logos">${names.map((n) => LOGOS[n]).join("")}</div>`;
}
