import { STORE, getProduct, shippingFor } from "./store.js";

const KEY = "lonier_cart_v1";
let memory = [];

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? JSON.parse(raw) : [];
  } catch {
    // Sin localStorage (modo privado, etc.): el carrito vive solo en memoria.
  }
  return memory.filter((item) => getProduct(item.id) && Number.isInteger(item.qty) && item.qty > 0);
}

function write(items) {
  memory = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  window.dispatchEvent(new CustomEvent("cart:change"));
}

function clampQty(qty) {
  return Math.max(1, Math.min(STORE.maxQtyPerItem, Math.floor(qty)));
}

export const cart = {
  items: read,

  add(id, qty = 1) {
    if (!getProduct(id)) return;
    const items = read();
    const existing = items.find((item) => item.id === id);
    if (existing) existing.qty = clampQty(existing.qty + qty);
    else items.push({ id, qty: clampQty(qty) });
    write(items);
  },

  setQty(id, qty) {
    write(read().map((item) => (item.id === id ? { ...item, qty: clampQty(qty) } : item)));
  },

  remove(id) {
    write(read().filter((item) => item.id !== id));
  },

  clear() {
    write([]);
  },

  count() {
    return read().reduce((sum, item) => sum + item.qty, 0);
  },

  totals() {
    const lines = read().map((item) => {
      const product = getProduct(item.id);
      return { product, qty: item.qty, lineTotal: product.price * item.qty };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const savings = lines.reduce(
      (sum, line) => sum + Math.max(0, (line.product.compareAtPrice || 0) - line.product.price) * line.qty,
      0
    );
    const qty = lines.reduce((sum, line) => sum + line.qty, 0);
    const shipping = shippingFor(qty);
    return { lines, qty, subtotal, savings, shipping, total: subtotal + shipping };
  },
};

window.addEventListener("storage", (event) => {
  if (event.key === KEY) window.dispatchEvent(new CustomEvent("cart:change"));
});
