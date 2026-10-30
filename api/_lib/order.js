// Validación del pedido y cálculo de totales del lado del servidor.
// Los precios salen del catálogo (js/store.js); del navegador solo se aceptan id y cantidad.
import { STORE, getProduct, shippingFor } from "../../js/store.js";

export class OrderError extends Error {}

const FIELDS = {
  firstName: { label: "Nombre", max: 60 },
  lastName: { label: "Apellidos", max: 80 },
  email: { label: "Correo", max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phone: { label: "Teléfono", max: 20, pattern: /^\d{10}$/, normalize: (v) => v.replace(/\D/g, "").slice(-10) },
  street: { label: "Calle y número", max: 120 },
  neighborhood: { label: "Colonia", max: 80 },
  zip: { label: "Código postal", max: 5, pattern: /^\d{5}$/ },
  city: { label: "Ciudad o municipio", max: 80 },
  state: { label: "Estado", max: 60 },
  notes: { label: "Referencias", max: 200, optional: true },
};

function parseCustomer(input) {
  if (!input || typeof input !== "object") throw new OrderError("Faltan tus datos de envío.");
  const customer = {};
  for (const [key, rule] of Object.entries(FIELDS)) {
    let value = typeof input[key] === "string" ? input[key].trim() : "";
    if (rule.normalize) value = rule.normalize(value);
    if (!value) {
      if (rule.optional) continue;
      throw new OrderError(`Falta el campo: ${rule.label}.`);
    }
    if (value.length > rule.max || (rule.pattern && !rule.pattern.test(value))) {
      throw new OrderError(`Revisa el campo: ${rule.label}.`);
    }
    customer[key] = value;
  }
  return customer;
}

function parseItems(input) {
  if (!Array.isArray(input) || input.length === 0) throw new OrderError("Tu carrito está vacío.");
  const byId = new Map();
  for (const item of input) {
    const product = getProduct(item?.id);
    const qty = Number(item?.qty);
    if (!product) throw new OrderError("Uno de los productos ya no está disponible.");
    if (!Number.isInteger(qty) || qty < 1) throw new OrderError("Cantidad inválida.");
    byId.set(product.id, { product, qty: Math.min(STORE.maxQtyPerItem, (byId.get(product.id)?.qty || 0) + qty) });
  }
  return [...byId.values()].map(({ product, qty }) => ({
    product,
    qty,
    unitPrice: product.price,
    lineTotal: product.price * qty,
  }));
}

export function buildOrder(body) {
  const lines = parseItems(body?.items);
  const customer = parseCustomer(body?.customer);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = shippingFor(subtotal);
  const orderId = `LON-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return { orderId, lines, customer, subtotal, shipping, total: subtotal + shipping };
}

export function formatAddress(c) {
  return [c.street, `Col. ${c.neighborhood}`, `C.P. ${c.zip}`, c.city, c.state].join(", ");
}

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

export function readBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

// Envuelve un handler de checkout: valida método, configuración y pedido, y responde errores en JSON.
export function checkoutHandler({ provider, envVar, createCheckout }) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Método no permitido." });
    }
    const secret = process.env[envVar];
    if (!secret) {
      return res.status(503).json({ error: `El pago con ${provider} aún no está configurado.` });
    }

    let order;
    try {
      order = buildOrder(readBody(req));
    } catch (error) {
      if (error instanceof OrderError) return res.status(400).json({ error: error.message });
      throw error;
    }

    try {
      const url = await createCheckout({ order, secret, baseUrl: siteUrl(req) });
      return res.status(200).json({ url, orderId: order.orderId });
    } catch (error) {
      console.error(`[${provider}] ${order.orderId}:`, error.message);
      return res.status(502).json({ error: `No pudimos conectar con ${provider}. Intenta de nuevo en un momento.` });
    }
  };
}
