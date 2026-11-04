import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import mercadopagoCheckout from "../api/checkout/mercadopago.js";
import * as mpWebhook from "../api/webhooks/mercadopago.js";
import * as stripeWebhook from "../api/webhooks/stripe.js";
import * as admin from "../api/admin.js";
import * as stock from "../api/stock.js";
import { createFakeServices, customer, callNode, REDIS_URL } from "./helpers.js";

let services;
const realFetch = globalThis.fetch;
const ENV = {
  MP_ACCESS_TOKEN: "TEST-token",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  KV_REST_API_URL: REDIS_URL,
  KV_REST_API_TOKEN: "redis-token",
  RESEND_API_KEY: "re_test",
  ORDER_EMAIL_TO: "duena@example.com",
  ADMIN_PASSWORD: "secreto",
};
beforeEach(() => {
  services = createFakeServices();
  globalThis.fetch = services.fetch;
  Object.assign(process.env, ENV);
  delete process.env.EMAIL_FROM;
  delete process.env.MP_WEBHOOK_SECRET;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function createOrder(qty) {
  const { data } = await callNode(mercadopagoCheckout, { items: [{ id: "lonier-skin-serum", qty }], customer });
  return data.orderId;
}

function mpNotification(paymentId, headers = {}) {
  return new Request(`https://tienda.test/api/webhooks/mercadopago?source_news=webhooks&data.id=${paymentId}&type=payment`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ type: "payment", data: { id: paymentId } }),
  });
}

function stripeEvent(body, secret = "whsec_test", t = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return new Request("https://tienda.test/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": `t=${t},v1=${sig}` },
    body: raw,
  });
}

test("Mercado Pago: un pago aprobado marca el pedido, descuenta inventario y avisa por correo una sola vez", async () => {
  services.store.set("stock:lonier-skin-serum", "6");
  const orderId = await createOrder(2);
  services.mpPayments["123"] = { status: "approved", external_reference: orderId, transaction_amount: 648, metadata: {} };

  const res = await mpWebhook.POST(mpNotification("123"));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "pagado");

  const order = JSON.parse(services.store.get(`order:${orderId}`));
  assert.equal(order.status, "pagado");
  assert.equal(order.paymentId, "123");
  assert.equal(services.store.get("stock:lonier-skin-serum"), "4");

  assert.equal(services.emails.length, 1);
  const email = services.emails[0];
  assert.equal(email.to, "duena@example.com");
  assert.match(email.subject, new RegExp(orderId));
  assert.match(email.html, /Av\. Siempre Viva 123/);
  assert.match(email.html, /quedan 4 piezas/);
  assert.doesNotMatch(email.html, /no coincide/);

  // Mercado Pago reintenta los avisos: el segundo no debe repetir nada.
  const again = await mpWebhook.POST(mpNotification("123"));
  assert.equal(await again.text(), "duplicado");
  assert.equal(services.emails.length, 1);
  assert.equal(services.store.get("stock:lonier-skin-serum"), "4");
});

test("Mercado Pago: ignora pagos pendientes y avisos que no son de pago", async () => {
  const orderId = await createOrder(1);
  services.mpPayments["9"] = { status: "pending", external_reference: orderId, transaction_amount: 398 };
  assert.equal(await (await mpWebhook.POST(mpNotification("9"))).text(), "estado: pending");

  const other = new Request("https://tienda.test/api/webhooks/mercadopago", {
    method: "POST",
    body: JSON.stringify({ type: "merchant_order", data: { id: "1" } }),
  });
  assert.equal(await (await mpWebhook.POST(other)).text(), "ignorado");
  assert.equal(services.emails.length, 0);
});

test("Mercado Pago: valida la firma cuando hay MP_WEBHOOK_SECRET", async () => {
  process.env.MP_WEBHOOK_SECRET = "mpsecret";
  const orderId = await createOrder(1);
  services.mpPayments["555"] = { status: "approved", external_reference: orderId, transaction_amount: 398 };

  const bad = await mpWebhook.POST(mpNotification("555", { "x-signature": "ts=1,v1=abc", "x-request-id": "r1" }));
  assert.equal(bad.status, 401);

  const v1 = createHmac("sha256", "mpsecret").update("id:555;request-id:r1;ts:1700;").digest("hex");
  const good = await mpWebhook.POST(mpNotification("555", { "x-signature": `ts=1700,v1=${v1}`, "x-request-id": "r1" }));
  assert.equal(good.status, 200);
  assert.equal(services.emails.length, 1);
});

test("Mercado Pago: avisa si el monto pagado no coincide", async () => {
  const orderId = await createOrder(1);
  services.mpPayments["7"] = { status: "approved", external_reference: orderId, transaction_amount: 1 };
  await mpWebhook.POST(mpNotification("7"));
  assert.match(services.emails[0].html, /no coincide/);
});

test("Stripe: valida la firma y procesa pagos completos y de OXXO", async () => {
  const orderId = await createOrder(3);
  const session = { id: "cs_1", client_reference_id: orderId, amount_total: 74900, payment_status: "unpaid", payment_intent: "pi_1", metadata: {} };

  const forged = await stripeWebhook.POST(stripeEvent({ type: "checkout.session.completed", data: { object: session } }, "otro"));
  assert.equal(forged.status, 400);

  // OXXO: la sesión se completa sin pagar, y el pago llega después.
  const unpaid = await stripeWebhook.POST(stripeEvent({ type: "checkout.session.completed", data: { object: session } }));
  assert.match(await unpaid.text(), /ignorado/);
  assert.equal(services.emails.length, 0);

  const paid = await stripeWebhook.POST(stripeEvent({ type: "checkout.session.async_payment_succeeded", data: { object: session } }));
  assert.equal(await paid.text(), "pagado");
  const order = JSON.parse(services.store.get(`order:${orderId}`));
  assert.equal(order.provider, "Stripe");
  assert.equal(order.total, 749);
  assert.equal(services.emails.length, 1);
});

test("sin base de datos el aviso igual llega con los datos del pago", async () => {
  delete process.env.KV_REST_API_URL;
  const session = {
    id: "cs_2",
    client_reference_id: "LON-X",
    amount_total: 39800,
    payment_status: "paid",
    metadata: { customer_name: "Ana López", phone: "8112345678", shipping_address: "Av. 1, Col. Centro", items: "1 x Lonier Skin Serum", shipping: "99" },
  };
  const res = await stripeWebhook.POST(stripeEvent({ type: "checkout.session.completed", data: { object: session } }));
  assert.equal(res.status, 200);
  assert.match(services.emails[0].html, /1 x Lonier Skin Serum/);
  assert.match(services.emails[0].html, /Av\. 1, Col\. Centro/);
  process.env.KV_REST_API_URL = REDIS_URL;
});

test("con EMAIL_FROM también se envía confirmación al cliente", async () => {
  process.env.EMAIL_FROM = "Lonier Skin <pedidos@lonier.test>";
  const orderId = await createOrder(1);
  services.mpPayments["8"] = { status: "approved", external_reference: orderId, transaction_amount: 398 };
  await mpWebhook.POST(mpNotification("8"));
  assert.deepEqual(services.emails.map((e) => e.to).sort(), ["ana@example.com", "duena@example.com"]);
});

const adminRequest = (method, body, password = "secreto") =>
  new Request("https://tienda.test/api/admin", {
    method,
    headers: { authorization: `Bearer ${password}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

test("panel: pide contraseña, ajusta inventario y marca pedidos como enviados", async () => {
  assert.equal((await admin.GET(adminRequest("GET", null, "mala"))).status, 401);

  let res = await admin.POST(adminRequest("POST", { action: "setStock", productId: "lonier-skin-serum", qty: "20" }));
  assert.deepEqual((await res.json()).stock, { "lonier-skin-serum": 20 });
  assert.deepEqual(await (await stock.GET()).json(), { "lonier-skin-serum": 20 });

  res = await admin.POST(adminRequest("POST", { action: "setStock", productId: "lonier-skin-serum", qty: "-1" }));
  assert.equal(res.status, 400);

  const orderId = await createOrder(1);
  services.mpPayments["1"] = { status: "approved", external_reference: orderId, transaction_amount: 398 };
  await mpWebhook.POST(mpNotification("1"));

  const dashboard = await (await admin.GET(adminRequest("GET"))).json();
  assert.equal(dashboard.orders.length, 1);
  assert.equal(dashboard.orders[0].id, orderId);
  assert.equal(dashboard.stock["lonier-skin-serum"], 19);

  res = await admin.POST(adminRequest("POST", { action: "markShipped", orderId, tracking: "GUIA123" }));
  const { order } = await res.json();
  assert.equal(order.status, "enviado");
  assert.equal(order.tracking, "GUIA123");

  res = await admin.POST(adminRequest("POST", { action: "setStock", productId: "lonier-skin-serum", qty: "" }));
  assert.deepEqual((await res.json()).stock, { "lonier-skin-serum": null });
});
