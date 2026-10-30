import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mercadopago from "../api/checkout/mercadopago.js";
import stripe from "../api/checkout/stripe.js";
import { buildOrder } from "../api/_lib/order.js";

const customer = {
  firstName: "Ana",
  lastName: "López",
  email: "ana@example.com",
  phone: "+52 (81) 1234-5678",
  street: "Av. Siempre Viva 123",
  neighborhood: "Centro",
  zip: "64000",
  city: "Monterrey",
  state: "Nuevo León",
};

function call(handler, body, method = "POST") {
  const req = { method, body, headers: { host: "tienda.test", "x-forwarded-proto": "https" } };
  return new Promise((resolve) => {
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.code = code; return this; },
      json(data) { resolve({ status: this.code, data }); },
    };
    handler(req, res);
  });
}

let requests;
const realFetch = globalThis.fetch;
beforeEach(() => {
  requests = [];
  process.env.MP_ACCESS_TOKEN = "TEST-token";
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  delete process.env.SITE_URL;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    const body = url.includes("mercadopago") ? { init_point: "https://mp.test/pay" } : { url: "https://stripe.test/pay" };
    return new Response(JSON.stringify(body), { status: 200 });
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("buildOrder usa el precio del catálogo y suma el envío", () => {
  const order = buildOrder({ items: [{ id: "lonier-skin-serum", qty: 2, price: 1 }], customer });
  assert.equal(order.lines[0].unitPrice, 299);
  assert.equal(order.subtotal, 598);
  assert.equal(order.shipping, 99);
  assert.equal(order.total, 697);
  assert.equal(order.customer.phone, "8112345678");
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
  assert.equal(requests.length, 0);
});

test("Mercado Pago: crea la preferencia con precio, envío y URLs de regreso", async () => {
  const { status, data } = await call(mercadopago, { items: [{ id: "lonier-skin-serum", qty: 3 }], customer });
  assert.equal(status, 200);
  assert.equal(data.url, "https://mp.test/pay");

  const sent = JSON.parse(requests[0].init.body);
  assert.equal(requests[0].init.headers.Authorization, "Bearer TEST-token");
  assert.deepEqual(
    sent.items.map((i) => [i.id, i.quantity, i.unit_price, i.currency_id]),
    [["lonier-skin-serum", 3, 299, "MXN"]]
  );
  assert.equal(sent.shipments.cost, 99);
  assert.equal(sent.external_reference, data.orderId);
  assert.match(sent.back_urls.success, /^https:\/\/tienda\.test\/gracias\?provider=mercadopago&order=LON-/);
});

test("Stripe: crea la sesión en centavos MXN con envío fijo", async () => {
  const { status, data } = await call(stripe, { items: [{ id: "lonier-skin-serum", qty: 1 }], customer });
  assert.equal(status, 200);
  assert.equal(data.url, "https://stripe.test/pay");

  const sent = requests[0].init.body;
  assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "29900");
  assert.equal(sent.get("line_items[0][price_data][currency]"), "mxn");
  assert.equal(sent.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "9900");
  assert.equal(sent.get("customer_email"), "ana@example.com");
  assert.equal(sent.get("metadata[order_id]"), data.orderId);
});

test("responde 503 si falta la llave y 405 si no es POST", async () => {
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal((await call(stripe, {})).status, 503);
  assert.equal((await call(mercadopago, {}, "GET")).status, 405);
});

test("responde 502 si la pasarela falla", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "invalid token" }), { status: 401 });
  const original = console.error;
  console.error = () => {};
  const { status } = await call(mercadopago, { items: [{ id: "lonier-skin-serum", qty: 1 }], customer });
  console.error = original;
  assert.equal(status, 502);
});
