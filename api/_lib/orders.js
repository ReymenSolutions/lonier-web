// Pedidos e inventario guardados en Redis.
//   order:{id}      → JSON del pedido (los pendientes expiran a los 30 días; los pagados se quedan)
//   orders:paid     → lista ordenada por fecha de los pedidos pagados
//   paid-lock:{id}  → evita procesar dos veces el mismo pago (los avisos pueden llegar repetidos)
//   stock:{product} → piezas disponibles; si no existe, el producto no lleva control de inventario
import { PRODUCTS } from "../../js/store.js";
import { hasDatabase, pipeline, redis } from "./redis.js";

const PENDING_TTL = 60 * 60 * 24 * 30;

export async function savePendingOrder(order, provider) {
  if (!hasDatabase()) return;
  const record = {
    id: order.orderId,
    status: "pendiente",
    provider,
    createdAt: new Date().toISOString(),
    customer: order.customer,
    lines: order.lines.map(({ product, qty, unitPrice, lineTotal }) => ({
      id: product.id,
      name: product.name,
      qty,
      unitPrice,
      lineTotal,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
  };
  await redis("SET", `order:${record.id}`, JSON.stringify(record), "EX", PENDING_TTL);
}

export async function getOrder(id) {
  if (!hasDatabase() || !id) return null;
  const raw = await redis("GET", `order:${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveOrder(order) {
  await redis("SET", `order:${order.id}`, JSON.stringify(order));
}

// Devuelve true solo la primera vez que se llama para un pedido.
export async function claimPayment(orderId) {
  if (!hasDatabase()) return true;
  return (await redis("SET", `paid-lock:${orderId}`, "1", "NX")) === "OK";
}

export async function releasePayment(orderId) {
  if (hasDatabase()) await redis("DEL", `paid-lock:${orderId}`);
}

export async function recordPaidOrder(order) {
  if (!hasDatabase()) return;
  await pipeline([
    ["SET", `order:${order.id}`, JSON.stringify(order)],
    ["ZADD", "orders:paid", String(Date.parse(order.paidAt)), order.id],
  ]);
}

export async function listPaidOrders(limit = 100) {
  const ids = await redis("ZRANGE", "orders:paid", "0", String(limit - 1), "REV");
  const raw = await pipeline(ids.map((id) => ["GET", `order:${id}`]));
  return raw.filter(Boolean).map((r) => JSON.parse(r));
}

export async function markShipped(id, tracking) {
  const order = await getOrder(id);
  if (!order) return null;
  order.status = "enviado";
  order.shippedAt = new Date().toISOString();
  order.tracking = tracking || "";
  await saveOrder(order);
  return order;
}

// ---------- Inventario ----------

// { "lonier-skin-serum": 12 } — null significa "sin control de inventario".
export async function getStock() {
  const stock = Object.fromEntries(PRODUCTS.map((p) => [p.id, null]));
  if (!hasDatabase()) return stock;
  const values = await pipeline(PRODUCTS.map((p) => ["GET", `stock:${p.id}`]));
  PRODUCTS.forEach((p, i) => {
    if (values[i] != null) stock[p.id] = Number(values[i]);
  });
  return stock;
}

export async function setStock(productId, qty) {
  if (qty === null) return redis("DEL", `stock:${productId}`);
  return redis("SET", `stock:${productId}`, String(qty));
}

// Descuenta las piezas vendidas solo de los productos que llevan inventario.
// Devuelve { [productId]: piezasRestantes }.
const DECREMENT_IF_TRACKED =
  "if redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('DECRBY', KEYS[1], ARGV[1]) else return false end";

export async function decrementStock(lines) {
  if (!hasDatabase()) return {};
  const results = await pipeline(
    lines.map((line) => ["EVAL", DECREMENT_IF_TRACKED, "1", `stock:${line.id}`, String(line.qty)])
  );
  const remaining = {};
  lines.forEach((line, i) => {
    if (results[i] != null) remaining[line.id] = Number(results[i]);
  });
  return remaining;
}
