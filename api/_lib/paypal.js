// Cliente mínimo de la API de PayPal (Orders v2) y qué hacer con un pago capturado.
// https://developer.paypal.com/docs/api/orders/v2/
import { fulfillPaidOrder } from "./fulfill.js";

const baseUrl = () =>
  process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

let cachedToken = null;

async function accessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET");
  if (cachedToken && cachedToken.key === `${id}:${baseUrl()}` && cachedToken.expires > Date.now()) return cachedToken.value;

  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`PayPal token HTTP ${response.status}: ${data.error_description || ""}`);
  cachedToken = { key: `${id}:${baseUrl()}`, value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

export async function paypalRequest(path, { method = "GET", body, requestId } = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

const money = (value) => ({ currency_code: "MXN", value: value.toFixed(2) });

export function orderBody(order, siteUrl) {
  const items = order.lines.flatMap((line) => line.items);
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: order.orderId,
        custom_id: order.orderId,
        invoice_id: order.orderId,
        description: `Pedido ${order.orderId} · Lonier Skin`,
        amount: {
          ...money(order.total),
          breakdown: { item_total: money(order.subtotal), shipping: money(order.shipping) },
        },
        items: items.map((item) => ({
          name: item.name.slice(0, 127),
          sku: item.id,
          quantity: String(item.quantity),
          unit_amount: money(item.unitPrice),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Lonier Skin",
          locale: "es-MX",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: `${siteUrl}/api/checkout/paypal-return`,
          cancel_url: `${siteUrl}/carrito?cancelado=1`,
        },
      },
    },
  };
}

// Captura una orden aprobada. Si ya estaba capturada (el cliente regresó y además llegó el aviso), la consulta.
export async function captureOrder(paypalOrderId) {
  const id = encodeURIComponent(paypalOrderId);
  const captured = await paypalRequest(`/v2/checkout/orders/${id}/capture`, { method: "POST", requestId: `capture-${paypalOrderId}` });
  if (captured.ok) return captured.data;
  const alreadyCaptured = captured.data?.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED");
  if (alreadyCaptured) {
    const current = await paypalRequest(`/v2/checkout/orders/${id}`);
    if (current.ok) return current.data;
  }
  throw Object.assign(new Error(`PayPal captura HTTP ${captured.status}: ${captured.data?.message || ""}`), { status: captured.status });
}

// De una orden capturada saca { orderId, capture } (la primera captura de la primera unidad).
export function captureFromOrder(paypalOrder) {
  const unit = paypalOrder?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return { orderId: capture?.custom_id || unit?.custom_id || unit?.reference_id, capture, payer: paypalOrder?.payer };
}

export async function fulfillCapture({ orderId, capture, payer }) {
  if (!orderId || capture?.status !== "COMPLETED") return { status: capture?.status?.toLowerCase() || "sin captura" };
  const name = [payer?.name?.given_name, payer?.name?.surname].filter(Boolean).join(" ");
  return fulfillPaidOrder({
    orderId,
    provider: "PayPal",
    paymentId: capture.id,
    amountPaid: Number(capture.amount?.value),
    metadata: { customer_name: name, email: payer?.email_address || "", items: `Pedido ${orderId} (detalle en PayPal)` },
  });
}
