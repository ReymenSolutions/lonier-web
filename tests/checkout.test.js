import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mercadopago from "../api/checkout/mercadopago.js";
import stripe from "../api/checkout/stripe.js";
import { buildOrder } from "../api/_lib/order.js";
import { shippingFor, freeShippingMessage } from "../js/store.js";
import { createFakeServices, customer, callNode as call, REDIS_URL } from "./helpers.js";

let services;
const realFetch = globalThis.fetch;
beforeEach(() => {
  services = createFakeServices();
  globalThis.fetch = services.fetch;
  Object.assign(process.env, {
    MP_ACCESS_TOKEN: "TEST-token",
    STRIPE_SECRET_KEY: "sk_test_x",
    KV_REST_API_URL: REDIS_URL,
    KV_REST_API_TOKEN: "redis-token",
  });
  delete process.env.SITE_URL;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const external = () => services.requests.filter((r) => !r.url.startsWith(REDIS_URL));

test("envío: $99 hasta 2 piezas, gratis desde 3", () => {
  assert.equal(shippingFor(1), 99);
  assert.equal(shippingFor(2), 99);
  assert.equal(shippingFor(3), 0);
  assert.equal(freeShippingMessage(1), "Agrega 2 piezas más y tu envío es gratis.");
  assert.equal(freeShippingMessage(2), "Agrega 1 pieza más y tu envío es gratis.");
  assert.equal(freeShippingMessage(3), "¡Tu envío es gratis!");
});

test("buildOrder usa el precio del catálogo y aplica envío gratis desde 3 piezas", () => {
  const two = buildOrder({ items: [{ id: "lonier-skin-serum", qty: 2, price: 1 }], customer });
  assert.equal(two.lines[0].unitPrice, 299);
  assert.equal(two.subtotal, 598);
  assert.equal(two.shipping, 99);
  assert.equal(two.total, 697);
  assert.equal(two.customer.phone, "8112345678");

  const three = buildOrder({ items: [{ id: "lonier-skin-serum", qty: 3 }], customer });
  assert.equal(three.shipping, 0);
  assert.equal(three.total, 897);
});

test("rechaza productos inexistentes, carrito vacío y datos incompletos", async () => {
  for (const body of [
    { items: [], customer },
    { items: [{ id: "otro", qty: 1 }], customer },
    { items: [{ id: "lonier-skin-serum", qty: 0 }], customer },
    { items: [{ id: "lonier-skin-serum", qty: 1 }], customer: { ...customer, zip: "123" } },
    { items: [{ id: "lonier-skin-serum", qty: 1 }] },
  ]) {
    const { status, data } = await call(mercadopago, body);
    assert.equal(status, 400, JSON.stringify(body));
    assert.ok(data.error);
  }
  assert.equal(external().length, 0);
});

test("Mercado Pago: crea la preferencia, guarda el pedido pendiente y manda la URL de avisos", async () => {
  const { status, data } = await call(mercadopago, { items: [{ id: "lonier-skin-serum", qty: 2 }], customer });
  assert.equal(status, 200);
  assert.equal(data.url, "https://mp.test/pay");

  const pref = external().find((r) => r.url.includes("preferences"));
  const sent = JSON.parse(pref.init.body);
  assert.equal(pref.init.headers.Authorization, "Bearer TEST-token");
  assert.deepEqual(sent.items.map((i) => [i.id, i.quantity, i.unit_price, i.currency_id]), [["lonier-skin-serum", 2, 299, "MXN"]]);
  assert.equal(sent.shipments.cost, 99);
  assert.equal(sent.external_reference, data.orderId);
  assert.equal(sent.metadata.order_id, data.orderId);
  assert.equal(sent.notification_url, "https://tienda.test/api/webhooks/mercadopago?source_news=webhooks");
  assert.match(sent.back_urls.success, /^https:\/\/tienda\.test\/gracias\?provider=mercadopago&order=LON-.*&total=697$/);

  const saved = JSON.parse(services.store.get(`order:${data.orderId}`));
  assert.equal(saved.status, "pendiente");
  assert.equal(saved.total, 697);
  assert.equal(saved.customer.email, "ana@example.com");
});

test("Stripe: crea la sesión en centavos MXN con envío fijo o gratis", async () => {
  const { status, data } = await call(stripe, { items: [{ id: "lonier-skin-serum", qty: 1 }], customer });
  assert.equal(status, 200);
  assert.equal(data.url, "https://stripe.test/pay");
  let sent = external().at(-1).init.body;
  assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "29900");
  assert.equal(sent.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "9900");
  assert.equal(sent.get("client_reference_id"), data.orderId);
  assert.equal(sent.get("metadata[email]"), "ana@example.com");

  await call(stripe, { items: [{ id: "lonier-skin-serum", qty: 3 }], customer });
  sent = external().at(-1).init.body;
  assert.equal(sent.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "0");
  assert.equal(sent.get("shipping_options[0][shipping_rate_data][display_name]"), "Envío gratis");
});

test("inventario: rechaza si no alcanzan las piezas y deja pasar si alcanzan", async () => {
  services.store.set("stock:lonier-skin-serum", "2");
  let res = await call(mercadopago, { items: [{ id: "lonier-skin-serum", qty: 3 }], customer });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /Solo quedan 2 piezas/);

  services.store.set("stock:lonier-skin-serum", "0");
  res = await call(mercadopago, { items: [{ id: "lonier-skin-serum", qty: 1 }], customer });
  assert.match(res.data.error, /agotado/);

  services.store.set("stock:lonier-skin-serum", "5");
  res = await call(mercadopago, { items: [{ id: "lonier-skin-serum", qty: 3 }], customer });
  assert.equal(res.status, 200);
});

test("si la base de datos falla, la venta sigue", async () => {
  services.failRedis = true;
  const original = console.error;
  console.error = () => {};
  const { status } = await call(stripe, { items: [{ id: "lonier-skin-serum", qty: 1 }], customer });
  console.error = original;
  assert.equal(status, 200);
});

test("responde 503 si falta la llave y 405 si no es POST", async () => {
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal((await call(stripe, {})).status, 503);
  assert.equal((await call(mercadopago, {}, "GET")).status, 405);
});

test("responde 502 si la pasarela falla", async () => {
  globalThis.fetch = async (url, init) =>
    String(url).startsWith(REDIS_URL) ? services.fetch(url, init) : Response.json({ message: "invalid token" }, { status: 401 });
  const original = console.error;
  console.error = () => {};
  const { status } = await call(mercadopago, { items: [{ id: "lonier-skin-serum", qty: 1 }], customer });
  console.error = original;
  assert.equal(status, 502);
});
