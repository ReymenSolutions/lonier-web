// Crea una orden de PayPal y devuelve la URL donde el cliente la aprueba.
// Al aprobar, PayPal lo regresa a /api/checkout/paypal-return, que captura el pago.
import { checkoutHandler } from "../_lib/order.js";
import { orderBody, paypalRequest } from "../_lib/paypal.js";

export default checkoutHandler({
  provider: "PayPal",
  envVar: "PAYPAL_CLIENT_SECRET",
  async createCheckout({ order, baseUrl }) {
    const { ok, status, data } = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: orderBody(order, baseUrl),
      requestId: order.orderId,
    });
    const approve = data.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!ok || !approve) throw new Error(`HTTP ${status}: ${data.message || "sin enlace de aprobación"}`);
    return approve;
  },
});
