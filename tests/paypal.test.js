import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import paypalCheckout from "../api/checkout/paypal.js";
import paypalReturn from "../api/checkout/paypal-return.js";
import * as paypalWebhook from "../api/webhooks/paypal.js";
import { createFakeServices, customer, callNode, REDIS_URL } from "./helpers.js";

let services;
const realFetch = globalThis.fetch;
beforeEach(() => {
  services = createFakeServices();
  globalThis.fetch = services.fetch;
  Object.assign(process.env, {
    PAYPAL_CLIENT_ID: "pp-id",
    PAYPAL_CLIENT_SECRET: "pp-secret",
    PAYPAL_WEBHOOK_ID: "WH-1",
    KV_REST_API_URL: REDIS_URL,
    KV_REST_API_TOKEN: "redis-token",
    RESEND_API_KEY: "re_test",
    ORDER_EMAIL_TO: "duena@example.com",
  });
  delete process.env.PAYPAL_ENV;
  delete process.env.EMAIL_FROM;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

function callReturn(query) {
  return new Promise((resolve, reject) => {
    const req = { method: "GET", url: `/api/checkout/paypal-return?${query}`, headers: { host: "tienda.test", "x-forwarded-proto": "https" } };
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      end() {
        resolve({ status: this.statusCode, location: this.headers.location });
      },
    };
    Promise.resolve(paypalReturn(req, res)).catch(reject);
  });
}

async function startCheckout(qty) {
  const { status, data } = await callNode(paypalCheckout, { items: [{ id: "lonier-skin-serum", qty }], customer });
  assert.equal(status, 200);
  return data;
}

test("crea la orden de PayPal con el total del servidor y paquetes exactos", async () => {
  const data = await startCheckout(3);
  assert.equal(data.url, "https://paypal.test/checkoutnow?token=PP1");
  const { body } = services.paypalOrders.get("PP1");
  const unit = body.purchase_units[0];
  assert.equal(unit.custom_id, data.orderId);
  assert.deepEqual(unit.amount, {
    currency_code: "MXN",
    value: "749.00",
    breakdown: { item_total: { currency_code: "MXN", value: "749.00" }, shipping: { currency_code: "MXN", value: "0.00" } },
  });
  assert.deepEqual(unit.items.map((i) => [i.quantity, i.unit_amount.value]), [["1", "749.00"]]);
  assert.equal(body.payment_source.paypal.experience_context.return_url, "https://tienda.test/api/checkout/paypal-return");
});

test("al regresar captura el pago, marca el pedido y avisa una sola vez", async () => {
  services.store.set("stock:lonier-skin-serum", "10");
  const { orderId } = await startCheckout(2);

  const back = await callReturn("token=PP1&PayerID=X");
  assert.equal(back.status, 303);
  assert.equal(back.location, `https://tienda.test/gracias?provider=paypal&status=approved&order=${orderId}&total=648.00`);

  const order = JSON.parse(services.store.get(`order:${orderId}`));
  assert.equal(order.status, "pagado");
  assert.equal(order.provider, "PayPal");
  assert.equal(services.store.get("stock:lonier-skin-serum"), "8");
  assert.equal(services.emails.length, 1);

  // Llega también el aviso de PayPal con la misma captura: no se duplica.
  const capture = { id: "CAP-PP1", status: "COMPLETED", custom_id: orderId, amount: { currency_code: "MXN", value: "648.00" } };
  const res = await paypalWebhook.POST(webhook({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: capture }));
  assert.equal(await res.text(), "duplicado");
  assert.equal(services.emails.length, 1);

  // Recargar la página de regreso tampoco duplica (la orden ya estaba capturada).
  assert.equal((await callReturn("token=PP1")).status, 303);
  assert.equal(services.emails.length, 1);
});

function webhook(event) {
  return new Request("https://tienda.test/api/webhooks/paypal", {
    method: "POST",
    headers: { "content-type": "application/json", "paypal-transmission-id": "t1" },
    body: JSON.stringify(event),
  });
}

test("el aviso CHECKOUT.ORDER.APPROVED captura si el cliente no regresó", async () => {
  const { orderId } = await startCheckout(1);
  const res = await paypalWebhook.POST(webhook({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "PP1" } }));
  assert.equal(await res.text(), "pagado");
  assert.equal(JSON.parse(services.store.get(`order:${orderId}`)).status, "pagado");
});

test("rechaza avisos con firma inválida", async () => {
  services.paypalVerify = "FAILURE";
  const res = await paypalWebhook.POST(webhook({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} }));
  assert.equal(res.status, 400);
  assert.equal(services.emails.length, 0);
});

test("pago pendiente: manda a gracias como pendiente y no marca el pedido", async () => {
  const { orderId } = await startCheckout(1);
  services.paypalCaptureStatus = "PENDING";
  const back = await callReturn("token=PP1");
  assert.match(back.location, /status=pending/);
  assert.equal(JSON.parse(services.store.get(`order:${orderId}`)).status, "pendiente");
});

test("sin token o con error de PayPal regresa al carrito", async () => {
  assert.equal((await callReturn("")).location, "https://tienda.test/carrito?cancelado=1");
  const original = console.error;
  console.error = () => {};
  const res = await callReturn("token=NOEXISTE");
  console.error = original;
  assert.equal(res.location, "https://tienda.test/carrito?cancelado=1");
});
