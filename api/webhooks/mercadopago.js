// Aviso de pago de Mercado Pago. La URL se envía en cada preferencia (notification_url),
// así que no hace falta configurarla en el panel.
// https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
import { createHmac, timingSafeEqual } from "node:crypto";
import { fulfillPaidOrder } from "../_lib/fulfill.js";

const ok = (text) => new Response(text, { status: 200 });

// Solo se valida si configuraste MP_WEBHOOK_SECRET (Tus integraciones → Webhooks → Clave secreta).
// Aun sin firma, el pago se consulta directo a Mercado Pago con tu token, así que un aviso falso no surte efecto.
function validSignature(request, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const parts = Object.fromEntries(
    (request.headers.get("x-signature") || "").split(",").map((p) => p.trim().split("="))
  );
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${request.headers.get("x-request-id") || ""};ts:${parts.ts};`;
  const expected = Buffer.from(createHmac("sha256", secret).update(manifest).digest("hex"));
  const received = Buffer.from(parts.v1);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return new Response("Mercado Pago no configurado", { status: 503 });

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const type = body.type || url.searchParams.get("type") || url.searchParams.get("topic");
  const paymentId = String(url.searchParams.get("data.id") || body.data?.id || "");
  if (type !== "payment" || !paymentId) return ok("ignorado");
  if (!validSignature(request, paymentId)) return new Response("firma inválida", { status: 401 });

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return ok("pago no encontrado");
  if (!response.ok) return new Response("error consultando el pago", { status: 502 });

  const payment = await response.json();
  if (payment.status !== "approved" || !payment.external_reference) return ok(`estado: ${payment.status}`);

  try {
    const result = await fulfillPaidOrder({
      orderId: payment.external_reference,
      provider: "Mercado Pago",
      paymentId,
      amountPaid: payment.transaction_amount,
      amountPaidAlt: payment.transaction_amount + (payment.shipping_amount || 0),
      metadata: payment.metadata,
    });
    return ok(result.status);
  } catch (error) {
    console.error(`[webhook mercadopago] ${payment.external_reference}:`, error.message);
    return new Response("error", { status: 500 });
  }
}
