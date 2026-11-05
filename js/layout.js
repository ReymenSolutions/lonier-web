// Encabezado, pie de página, carrito lateral y botón de WhatsApp compartidos por todas las páginas.
import {
  STORE,
  PLACEHOLDER_IMAGE,
  activePromo,
  breakdownLabel,
  discountPercent,
  formatMXN,
  formatPrice,
  freeShippingMessage,
  freeShippingRule,
  getProduct,
} from "./store.js";
import { cart } from "./cart.js";
import { applyStock } from "./stock.js";
import { initAnalytics, trackAddToCart } from "./analytics.js";
import { icon, renderIcons } from "./icons.js";
import { autoHideHeader, pullToRefresh } from "./gestures.js";

export function imgFallback(img) {
  const swap = () => {
    if (!img.src.endsWith(PLACEHOLDER_IMAGE)) img.src = PLACEHOLDER_IMAGE;
  };
  img.addEventListener("error", swap);
  // La imagen pudo fallar antes de que cargara este script.
  if (img.complete && img.getAttribute("src") && img.naturalWidth === 0) swap();
}

export function whatsappUrl(message) {
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`;
}

// Selector − 1 + para una línea del carrito (lo usan el carrito lateral y la página de carrito).
export function qtyStepper(id, qty) {
  return `
    <div class="qty qty-sm">
      <button type="button" data-cart-id="${id}" data-delta="-1" aria-label="Quitar una pieza" ${qty <= 1 ? "disabled" : ""}>${icon("minus", { size: 16 })}</button>
      <span aria-live="polite">${qty}</span>
      <button type="button" data-cart-id="${id}" data-delta="1" aria-label="Agregar una pieza" ${qty >= STORE.maxQtyPerItem ? "disabled" : ""}>${icon("plus", { size: 16 })}</button>
    </div>`;
}

// Maneja los clics de − / + / Eliminar dentro de un contenedor del carrito.
export function bindCartControls(container) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.remove) cart.remove(button.dataset.remove);
    if (button.dataset.cartId) {
      const item = cart.items().find((i) => i.id === button.dataset.cartId);
      if (item) cart.setQty(item.id, item.qty + Number(button.dataset.delta));
    }
  });
}

export function freeShippingBadge() {
  return `<div class="free-badge">${icon("truck", { size: 18 })}<span>Tu pedido tiene <strong>envío gratis</strong></span></div>`;
}

const rule = freeShippingRule();
const announcement = rule
  ? `<div class="announcement">${icon("truck", { size: 16 })}<span>Envío <strong>GRATIS</strong> ${rule}</span></div>`
  : "";

const header = `
  ${announcement}
  <nav class="nav">
    <div class="container nav-inner">
      <div class="nav-start">
        <button class="menu-btn" id="openMenu" aria-label="Abrir menú" aria-controls="menuPanel" aria-expanded="false">
          ${icon("menu", { size: 24 })}
        </button>
        <a href="/" class="brand" data-home aria-label="Lonier Skin, ir al inicio">
          <img class="brand-logo" src="/assets/logo-gota-160.webp" alt="" width="52" height="52" />
          <span class="brand-text"><span class="brand-name">Lonier</span><span class="brand-sub">Skin</span></span>
        </a>
      </div>
      <div class="nav-links">
        <a href="/tienda">Tienda</a>
        <a href="/#ingredientes">Ingredientes</a>
        <a href="/#como-usar">Cómo usar</a>
        <a href="/#preguntas">Preguntas</a>
      </div>
      <div class="nav-actions">
        <a class="btn btn-primary" href="/producto?id=lonier-skin-serum">Comprar ahora</a>
        <button class="cart-btn" id="openCart" aria-label="Abrir carrito">
          ${icon("bag", { size: 20 })}
          <span class="cart-count" id="cartCount">0</span>
        </button>
      </div>
    </div>
  </nav>`;

const footer = `
  <footer class="footer">
    <div class="container footer-inner">
      <div>
        <strong>Lonier Skin</strong><br />
        Cuidado facial natural · Hecho en México
      </div>
      <div class="footer-links">
        <a href="/tienda">Tienda</a>
        <a href="/politicas#envios">Envíos</a>
        <a href="/politicas#devoluciones">Devoluciones</a>
        <a href="/politicas#terminos">Términos</a>
        <a href="/politicas#privacidad">Aviso de privacidad</a>
      </div>
      <div class="footer-contact">
        <a href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener">${icon("whatsapp", { size: 16 })} ${STORE.whatsappDisplay}</a>
        <span>© ${new Date().getFullYear()} Lonier Skin. Todos los derechos reservados.</span>
      </div>
    </div>
  </footer>`;

// Menú de celular: se abre desde la izquierda con el botón de hamburguesa.
const menu = `
  <aside class="menu-panel" id="menuPanel" aria-label="Menú" aria-hidden="true">
    <div class="menu-head">
      <a href="/" class="brand menu-brand" data-home aria-label="Lonier Skin, ir al inicio">
        <img class="brand-logo" src="/assets/logo-gota-160.webp" alt="" width="44" height="44" />
        <span class="brand-text"><span class="brand-name">Lonier</span><span class="brand-sub">Skin</span></span>
      </a>
      <button class="close-cart" id="closeMenu" aria-label="Cerrar menú">${icon("x", { size: 20 })}</button>
    </div>
    <nav class="menu-links">
      <a href="/" data-home>Inicio</a>
      <a href="/tienda">Tienda</a>
      <a href="/producto?id=lonier-skin-serum">Lonier Serum</a>
      <a href="/#ingredientes">Ingredientes</a>
      <a href="/#como-usar">Cómo usar</a>
      <a href="/#resultados">Antes y después</a>
      <a href="/#preguntas">Preguntas frecuentes</a>
    </nav>
    <div class="menu-actions">
      <a class="btn btn-gold" href="/producto?id=lonier-skin-serum">Comprar ahora</a>
      <a class="btn btn-whatsapp" href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener">${icon("whatsapp", { size: 18 })}Escríbenos por WhatsApp</a>
    </div>
    <div class="menu-foot">
      <a href="/politicas#envios">Envíos</a>
      <a href="/politicas#devoluciones">Devoluciones</a>
      <a href="/politicas#terminos">Términos</a>
      <a href="/politicas#privacidad">Aviso de privacidad</a>
    </div>
  </aside>`;

const drawer = `
  <div class="overlay" id="overlay"></div>
  <aside class="cart-panel" id="cartPanel" aria-label="Carrito">
    <div class="cart-head">
      <h3>Tu carrito</h3>
      <button class="close-cart" id="closeCart" aria-label="Cerrar carrito">${icon("x", { size: 20 })}</button>
    </div>
    <div class="cart-body" id="cartBody"></div>
    <div class="cart-footer" id="drawerFooter">
      <div class="cart-row"><span>Subtotal</span><span id="drawerSubtotal">$0 MXN</span></div>
      <div class="cart-row muted"><span>Envío</span><span id="drawerShipping"></span></div>
      <div id="drawerShippingNote"></div>
      <div class="cart-row total"><span>Total</span><span id="drawerTotal"></span></div>
      <a class="btn btn-gold" href="/carrito">Ver carrito y pagar</a>
      <button class="btn btn-ghost" id="keepShopping">Seguir comprando</button>
    </div>
  </aside>
  <a class="whatsapp-float" href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">${icon("whatsapp", { size: 28 })}</a>`;

export function openCart() {
  closeMenu();
  document.getElementById("cartPanel").classList.add("active");
  document.getElementById("overlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

export function closeCart() {
  document.getElementById("cartPanel").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
  document.body.style.overflow = "";
}

function openMenu() {
  closeCart();
  document.getElementById("menuPanel").classList.add("active");
  document.getElementById("menuPanel").setAttribute("aria-hidden", "false");
  document.getElementById("openMenu").setAttribute("aria-expanded", "true");
  document.getElementById("overlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeMenu() {
  const panel = document.getElementById("menuPanel");
  if (!panel?.classList.contains("active")) return;
  panel.classList.remove("active");
  panel.setAttribute("aria-hidden", "true");
  document.getElementById("openMenu").setAttribute("aria-expanded", "false");
  document.getElementById("overlay").classList.remove("active");
  document.body.style.overflow = "";
}

function renderDrawer() {
  const { lines, qty, subtotal, shipping, total } = cart.totals();
  document.getElementById("cartCount").textContent = qty;
  document.getElementById("drawerSubtotal").textContent = formatMXN(subtotal);
  document.getElementById("drawerShipping").textContent = shipping ? formatMXN(shipping) : "Gratis";
  document.getElementById("drawerTotal").textContent = formatMXN(total);
  document.getElementById("drawerShippingNote").innerHTML =
    lines.length && !shipping ? freeShippingBadge() : `<p class="cart-note">${freeShippingMessage(qty, subtotal)}</p>`;
  document.getElementById("drawerFooter").hidden = lines.length === 0;
  document.querySelectorAll("[data-free-shipping]").forEach((el) => (el.textContent = freeShippingMessage(qty, subtotal)));

  const body = document.getElementById("cartBody");
  if (lines.length === 0) {
    body.innerHTML = `
      <div class="empty">
        Tu carrito está vacío.<br />Agrega Lonier Skin Serum para continuar.
        <a class="btn btn-gold" href="/producto?id=lonier-skin-serum">Ver producto</a>
      </div>`;
    return;
  }

  body.innerHTML = lines
    .map(
      ({ product, qty: lineQty, lineTotal, compareAtTotal }) => `
      <div class="cart-item">
        <div class="cart-item-img"><img src="${product.images[0]}" alt="${product.name}" /></div>
        <div class="cart-item-info">
          <h4>${product.name}</h4>
          <p>${breakdownLabel(product, lineQty)}</p>
          <div class="cart-item-bottom">
            ${qtyStepper(product.id, lineQty)}
            <div class="cart-item-price">
              ${compareAtTotal > lineTotal ? `<s>${formatPrice(compareAtTotal)}</s>` : ""}
              <strong>${formatMXN(lineTotal)}</strong>
            </div>
          </div>
          <button class="remove" data-remove="${product.id}">Eliminar</button>
        </div>
      </div>`
    )
    .join("");
  body.querySelectorAll("img").forEach(imgFallback);
}

export function initLayout() {
  initAnalytics();
  document.getElementById("site-header").innerHTML = header;
  document.getElementById("site-footer").innerHTML = footer;
  document.body.insertAdjacentHTML("afterbegin", drawer + menu);

  document.getElementById("openCart").addEventListener("click", openCart);
  document.getElementById("closeCart").addEventListener("click", closeCart);
  document.getElementById("keepShopping").addEventListener("click", closeCart);
  document.getElementById("overlay").addEventListener("click", () => {
    closeCart();
    closeMenu();
  });
  document.getElementById("openMenu").addEventListener("click", openMenu);
  document.getElementById("closeMenu").addEventListener("click", closeMenu);
  // Al elegir una sección se cierra el menú (incluye los enlaces a #secciones de la misma página).
  document.getElementById("menuPanel").addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
      closeMenu();
    }
  });
  bindCartControls(document.getElementById("cartBody"));

  // Logo y nombre: muestran la gota cargando y llevan al inicio; si ya estás en el inicio, lo refrescan desde arriba.
  document.querySelectorAll("[data-home]").forEach((link) =>
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // abrir en otra pestaña
      event.preventDefault();
      goHome();
    })
  );
  autoHideHeader(document.getElementById("site-header"));
  pullToRefresh(refreshPage);

  // Si el navegador regresa a esta página desde su caché (botón atrás), no dejar la gota encima.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) document.documentElement.classList.remove("is-loading", "loaded", "loader-wait");
  });

  renderIcons();
  document.querySelectorAll("img").forEach(imgFallback);
  window.addEventListener("cart:change", renderDrawer);
  renderDrawer();
  applyStock();
}

// Muestra la gota cargando y luego ejecuta `go` (recargar o navegar). La página nueva la sigue mostrando
// hasta terminar de cargar (ver el script del <head>).
function withLoader(go) {
  const root = document.documentElement;
  try {
    sessionStorage.setItem("lonier_loader", "1");
  } catch {}
  // Solo el fondo crema: la gota aparece ya en la página nueva (ver loader-wait en el CSS).
  root.classList.add("is-loading", "loader-wait");
  // Subir sin animación (la gota tapa la página): al recargar, el navegador regresa a esta posición.
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  // Dejar que se pinte la gota antes de salir de la página.
  requestAnimationFrame(() => setTimeout(go, 120));
}

function goHome() {
  withLoader(() => {
    if (location.pathname === "/" && !location.hash) location.reload();
    else location.href = "/";
  });
}

function refreshPage() {
  withLoader(() => location.reload());
}

export function addToCart(id, qty = 1) {
  cart.add(id, qty);
  const product = getProduct(id);
  if (product) trackAddToCart(product, qty);
}

export function addToCartAndOpen(id, qty = 1) {
  addToCart(id, qty);
  openCart();
}

// Precio tachado → precio de oferta, con el aviso de promoción por tiempo limitado.
export function promoBlock(product) {
  const promo = activePromo(product);
  const pct = discountPercent(product);
  return `
    <div class="promo-price">
      <div class="promo-row">
        ${product.compareAtPrice > product.price ? `<s>${formatPrice(product.compareAtPrice)}</s>` : ""}
        <strong>${formatPrice(product.price)}</strong><small>MXN</small>
        ${pct ? `<span class="promo-off">-${pct}%</span>` : ""}
      </div>
      ${promo ? `<div class="promo-tag">${icon("clock", { size: 14 })}<span>${promo.label}${promo.until ? ` · ${promo.until}` : ""}</span></div>` : ""}
    </div>`;
}

// Rellena los elementos marcados con data-price / data-compare / data-discount / data-promo con los datos
// del catálogo, para que el precio solo se cambie en js/store.js.
export function bindPrices(product) {
  const promo = activePromo(product);
  document.querySelectorAll("[data-promo]").forEach((el) => (el.innerHTML = promoBlock(product)));
  document.querySelectorAll("[data-promo-label]").forEach((el) => {
    if (promo) el.textContent = `${promo.label}${promo.until ? ` · ${promo.until}` : ""}`;
  });
  document.querySelectorAll("[data-price]").forEach((el) => (el.textContent = `$${product.price}`));
  document.querySelectorAll("[data-compare]").forEach((el) => {
    el.textContent = product.compareAtPrice ? `$${product.compareAtPrice}` : "";
  });
  document.querySelectorAll("[data-discount]").forEach((el) => {
    const pct = discountPercent(product);
    el.textContent = pct ? `-${pct}%` : "";
    el.hidden = !pct;
  });
}
