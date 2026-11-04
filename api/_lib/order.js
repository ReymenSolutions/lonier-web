// Validación del pedido y cálculo de totales del lado del servidor.
// Los precios salen del catálogo (js/store.js); del navegador solo se aceptan id y cantidad.
import { STORE, bundleBreakdown, getProduct, lineTotalFor, shippingFor } from "../../js/store.js";
import { getStock, savePendingOrder } from "./orders.js";

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
  return [...byId.values()].map(({ product, qty }) => {
    const lineTotal = lineTotalFor(product, qty);
    return {
      product,
      qty,
      unitPrice: Math.round((lineTotal / qty) * 100) / 100,
      lineTotal,
      items: paymentItems(product, qty),
    };
  });
}

// Conceptos que se mandan a la pasarela. Los paquetes van como un concepto con su precio exacto
// (p. ej. "Paquete de 3 piezas" a $749), para que la suma cuadre al centavo.
export function paymentItems(product, qty) {
  return bundleBreakdown(product, qty).map((part) => ({
    id: part.qty === 1 ? product.id : `${product.id}-x${part.qty}`,
    name: part.qty === 1 ? product.name : `${product.name} · Paquete de ${part.qty} piezas`,
    quantity: part.count,
    unitPrice: part.price,
  }));
}

export function buildOrder(body) {
  const lines = parseItems(body?.items);
  const customer = parseCustomer(body?.customer);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = shippingFor(lines.reduce((sum, line) => sum + line.qty, 0), subtotal);
  const orderId = `LON-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return { orderId, lines, customer, subtotal, shipping, total: subtotal + shipping };
}

async function checkStock(order) {
  let stock;
  try {
    stock = await getStock();
  } catch (error) {
    console.error("[inventario]", error.message);
    return;
  }
  for (const { product, qty } of order.lines) {
    const available = stock[product.id];
    if (available == null || qty <= available) continue;
    throw new OrderError(
      available <= 0
        ? `${product.name} está agotado por el momento.`
        : `Solo quedan ${available} piezas de ${product.name}. Ajusta la cantidad en tu carrito.`
    );
  }
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
      await checkStock(order);
    } catch (error) {
      if (error instanceof OrderError) return res.status(400).json({ error: error.message });
      throw error;
    }

    try {
      await savePendingOrder(order, provider);
    } catch (error) {
      // Si la base de datos falla no detenemos la venta: el aviso de pago trae los datos en la metadata.
      console.error(`[pedidos] ${order.orderId}:`, error.message);
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
