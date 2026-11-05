// Aviso de pago de PayPal: respaldo por si el cliente cierra la ventana antes de regresar a la tienda,
// y para pagos que quedaron pendientes y se completan después.
// Configúralo en developer.paypal.com → Apps & Credentials → tu app → Webhooks con los eventos
// CHECKOUT.ORDER.APPROVED y PAYMENT.CAPTURE.COMPLETED, y copia el Webhook ID a PAYPAL_WEBHOOK_ID.
import { captureFromOrder, captureOrder, fulfillCapture, paypalRequest } from "../_lib/paypal.js";

const ok = (text) => new Response(text, { status: 200 });

async function verified(request, event) {
  const h = (name) => request.headers.get(name);
  const { ok: sent, data } = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
  });
  return sent && data.verification_status === "SUCCESS";
}

export async function POST(request) {
  if (!process.env.PAYPAL_WEBHOOK_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return new Response("PayPal webhook no configurado", { status: 503 });
  }
  const event = await request.json().catch(() => null);
  if (!event?.event_type) return new Response("cuerpo inválido", { status: 400 });

  try {
    if (!(await verified(request, event))) return new Response("firma inválida", { status: 400 });

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const capture = event.resource;
      const result = await fulfillCapture({ orderId: capture.custom_id, capture, payer: null });
      return ok(result.status);
    }

    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      // El cliente aprobó pero no regresó a la tienda: capturamos nosotros.
      const result = captureFromOrder(await captureOrder(event.resource.id));
      return ok((await fulfillCapture(result)).status);
    }

    return ok(`ignorado: ${event.event_type}`);
  } catch (error) {
    console.error(`[webhook paypal] ${event.event_type}:`, error.message);
    return new Response("error", { status: 500 });
  }
}
