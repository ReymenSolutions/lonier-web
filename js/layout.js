// Encabezado, pie de página, carrito lateral y botón de WhatsApp compartidos por todas las páginas.
import { STORE, PLACEHOLDER_IMAGE, discountPercent, formatMXN } from "./store.js";
import { cart } from "./cart.js";

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

const header = `
  <nav class="nav">
    <div class="container nav-inner">
      <a href="/" class="brand">Lonier <span>Skin</span></a>
      <div class="nav-links">
        <a href="/tienda">Tienda</a>
        <a href="/#beneficios">Beneficios</a>
        <a href="/#como-usar">Cómo usar</a>
        <a href="/#preguntas">Preguntas</a>
      </div>
      <div class="nav-actions">
        <a class="btn btn-primary" href="/producto?id=lonier-skin-serum">Comprar ahora</a>
        <button class="cart-btn" id="openCart" aria-label="Abrir carrito">
          🛒
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
        Serum facial premium.
      </div>
      <div class="footer-links">
        <a href="/tienda">Tienda</a>
        <a href="/politicas#envios">Envíos</a>
        <a href="/politicas#devoluciones">Devoluciones</a>
        <a href="/politicas#terminos">Términos</a>
        <a href="/politicas#privacidad">Aviso de privacidad</a>
      </div>
      <div>
        WhatsApp: ${STORE.whatsappDisplay}<br />
        © ${new Date().getFullYear()} Lonier Skin. Todos los derechos reservados.
      </div>
    </div>
  </footer>`;

const drawer = `
  <div class="overlay" id="overlay"></div>
  <aside class="cart-panel" id="cartPanel" aria-label="Carrito">
    <div class="cart-head">
      <h3>Tu carrito</h3>
      <button class="close-cart" id="closeCart" aria-label="Cerrar carrito">×</button>
    </div>
    <div class="cart-body" id="cartBody"></div>
    <div class="cart-footer">
      <div class="subtotal">
        <span>Subtotal</span>
        <span id="drawerSubtotal">$0 MXN</span>
      </div>
      <p class="cart-note" id="drawerShippingNote"></p>
      <a class="btn btn-gold" href="/carrito">Ver carrito y pagar</a>
      <button class="btn btn-ghost" id="keepShopping">Seguir comprando</button>
    </div>
  </aside>
  <a class="whatsapp-float" href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">☏</a>`;

export function openCart() {
  document.getElementById("cartPanel").classList.add("active");
  document.getElementById("overlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

export function closeCart() {
  document.getElementById("cartPanel").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
  document.body.style.overflow = "";
}

function renderDrawer() {
  const { lines, subtotal } = cart.totals();
  document.getElementById("cartCount").textContent = cart.count();
  document.getElementById("drawerSubtotal").textContent = formatMXN(subtotal);

  const { fee, freeOver } = STORE.shipping;
  document.getElementById("drawerShippingNote").textContent =
    freeOver != null && subtotal < freeOver
      ? `Te faltan ${formatMXN(freeOver - subtotal)} para envío gratis.`
      : freeOver != null
        ? "¡Tu envío es gratis!"
        : `Envío: ${formatMXN(fee)}. Se calcula al pagar.`;

  const body = document.getElementById("cartBody");
  if (lines.length === 0) {
    body.innerHTML = `<div class="empty">Tu carrito está vacío.<br />Agrega Lonier Skin Serum para continuar.</div>`;
    return;
  }

  body.innerHTML = lines
    .map(
      ({ product, qty, lineTotal }) => `
      <div class="cart-item">
        <div class="cart-item-img"><img src="${product.images[0]}" alt="${product.name}" /></div>
        <div>
          <h4>${product.name}</h4>
          <p>Cantidad: ${qty}</p>
          <div class="cart-item-bottom">
            <strong>${formatMXN(lineTotal)}</strong>
            <button class="remove" data-remove="${product.id}">Eliminar</button>
          </div>
        </div>
      </div>`
    )
    .join("");
  body.querySelectorAll("img").forEach(imgFallback);
}

export function initLayout() {
  document.getElementById("site-header").innerHTML = header;
  document.getElementById("site-footer").innerHTML = footer;
  document.body.insertAdjacentHTML("afterbegin", drawer);

  document.getElementById("openCart").addEventListener("click", openCart);
  document.getElementById("closeCart").addEventListener("click", closeCart);
  document.getElementById("keepShopping").addEventListener("click", closeCart);
  document.getElementById("overlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCart();
  });
  document.getElementById("cartBody").addEventListener("click", (event) => {
    const id = event.target.dataset.remove;
    if (id) cart.remove(id);
  });

  document.querySelectorAll("img").forEach(imgFallback);
  window.addEventListener("cart:change", renderDrawer);
  renderDrawer();
}

export function addToCartAndOpen(id, qty = 1) {
  cart.add(id, qty);
  openCart();
}

// Rellena los elementos marcados con data-price / data-compare / data-discount con los datos del catálogo,
// para que el precio solo se cambie en js/store.js.
export function bindPrices(product) {
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
