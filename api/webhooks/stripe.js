// Aviso de pago de Stripe. Configúralo en Stripe → Developers → Webhooks con los eventos
// checkout.session.completed y checkout.session.async_payment_succeeded.
// https://docs.stripe.com/webhooks#verify-manually
import { createHmac, timingSafeEqual } from "node:crypto";
import { fulfillPaidOrder } from "../_lib/fulfill.js";

const TOLERANCE_SECONDS = 300;
const ok = (text) => new Response(text, { status: 200 });

function validSignature(rawBody, header, secret) {
  const items = (header || "").split(",").map((p) => p.trim().split("="));
  const timestamp = items.find(([k]) => k === "t")?.[1];
  const signatures = items.filter(([k]) => k === "v1").map(([, v]) => Buffer.from(v));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Stripe webhook no configurado", { status: 503 });

  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("stripe-signature"), secret)) {
    return new Response("firma inválida", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const session = event.data?.object;
  const paid =
    (event.type === "checkout.session.completed" && session?.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!paid) return ok(`ignorado: ${event.type}`);

  const orderId = session.client_reference_id || session.metadata?.order_id;
  if (!orderId) return ok("sin pedido");

  try {
    const result = await fulfillPaidOrder({
      orderId,
      provider: "Stripe",
      paymentId: session.payment_intent || session.id,
      amountPaid: session.amount_total / 100,
      metadata: session.metadata,
    });
    return ok(result.status);
  } catch (error) {
    console.error(`[webhook stripe] ${orderId}:`, error.message);
    return new Response("error", { status: 500 });
  }
}
