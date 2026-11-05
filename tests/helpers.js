// Simula Upstash Redis, Mercado Pago, Stripe y Resend reemplazando fetch.
export const REDIS_URL = "https://redis.test";

export function createFakeServices() {
  const store = new Map();
  const zsets = new Map();
  const services = { store, requests: [], emails: [], mpPayments: {}, failRedis: false };

  function run([cmd, ...args]) {
    switch (cmd.toUpperCase()) {
      case "GET":
        return store.has(args[0]) ? store.get(args[0]) : null;
      case "SET": {
        const [key, value, ...opts] = args;
        if (opts.includes("NX") && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      }
      case "DEL":
        return store.delete(args[0]) ? 1 : 0;
      case "ZADD": {
        const [key, score, member] = args;
        if (!zsets.has(key)) zsets.set(key, new Map());
        zsets.get(key).set(member, Number(score));
        return 1;
      }
      case "ZRANGE": {
        const [key, start, stop] = args;
        const members = [...(zsets.get(key) || new Map()).entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
        return members.slice(Number(start), Number(stop) + 1);
      }
      case "EVAL": {
        const [, , key, amount] = args;
        if (!store.has(key)) return null;
        const next = Number(store.get(key)) - Number(amount);
        store.set(key, String(next));
        return next;
      }
      default:
        throw new Error(`comando no simulado: ${cmd}`);
    }
  }

  services.fetch = async (input, init = {}) => {
    const url = String(input);
    services.requests.push({ url, init });
    if (url.startsWith(REDIS_URL)) {
      if (services.failRedis) return Response.json({ error: "down" }, { status: 500 });
      const body = JSON.parse(init.body);
      if (url.endsWith("/pipeline")) return Response.json(body.map((c) => ({ result: run(c) })));
      return Response.json({ result: run(body) });
    }
    if (url === "https://api.mercadopago.com/checkout/preferences") return Response.json({ init_point: "https://mp.test/pay" });
    if (url.startsWith("https://api.mercadopago.com/v1/payments/")) {
      const payment = services.mpPayments[url.split("/").pop()];
      return payment ? Response.json(payment) : Response.json({}, { status: 404 });
    }
    if (url === "https://api.stripe.com/v1/checkout/sessions") return Response.json({ url: "https://stripe.test/pay" });
    if (url.startsWith("https://api-m.sandbox.paypal.com")) return paypal(url, init);
    if (url === "https://api.resend.com/emails") {
      services.emails.push(JSON.parse(init.body));
      return Response.json({ id: "email_1" });
    }
    throw new Error(`fetch no simulado: ${url}`);
  };

  // PayPal: guarda las órdenes creadas y responde como la API real (sandbox).
  services.paypalOrders = new Map();
  services.paypalVerify = "SUCCESS";
  function paypal(url, init) {
    const path = url.replace("https://api-m.sandbox.paypal.com", "");
    if (path === "/v1/oauth2/token") return Response.json({ access_token: "pp-token", expires_in: 3600 });
    if (path === "/v1/notifications/verify-webhook-signature") return Response.json({ verification_status: services.paypalVerify });
    if (path === "/v2/checkout/orders" && init.method === "POST") {
      const body = JSON.parse(init.body);
      const id = `PP${services.paypalOrders.size + 1}`;
      services.paypalOrders.set(id, { id, body, captured: false });
      return Response.json({ id, status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: `https://paypal.test/checkoutnow?token=${id}` }] }, { status: 201 });
    }
    const capture = path.match(/^\/v2\/checkout\/orders\/(\w+)(\/capture)?$/);
    if (capture) {
      const order = services.paypalOrders.get(capture[1]);
      if (!order) return Response.json({ name: "RESOURCE_NOT_FOUND" }, { status: 404 });
      if (capture[2] && order.captured) return Response.json({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, { status: 422 });
      if (capture[2]) order.captured = true;
      const unit = order.body.purchase_units[0];
      return Response.json({
        id: order.id,
        status: "COMPLETED",
        payer: { name: { given_name: "Ana", surname: "López" }, email_address: "ana@example.com" },
        purchase_units: [{ reference_id: unit.reference_id, payments: { captures: [{ id: `CAP-${order.id}`, status: services.paypalCaptureStatus || "COMPLETED", custom_id: unit.custom_id, amount: unit.amount }] } }],
      });
    }
    throw new Error(`PayPal no simulado: ${path}`);
  }

  return services;
}

export const customer = {
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

// Llama un handler estilo (req, res) de Vercel.
export function callNode(handler, body, method = "POST") {
  const req = { method, body, headers: { host: "tienda.test", "x-forwarded-proto": "https" } };
  return new Promise((resolve, reject) => {
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json(data) {
        resolve({ status: this.code, data });
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
