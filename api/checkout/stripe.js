// Crea una sesión de Stripe Checkout y devuelve la URL de pago.
// https://docs.stripe.com/api/checkout/sessions/create
import { checkoutHandler, formatAddress } from "../_lib/order.js";
import { STORE } from "../../js/store.js";

export default checkoutHandler({
  provider: "Stripe",
  envVar: "STRIPE_SECRET_KEY",
  async createCheckout({ order, secret, baseUrl }) {
    const { customer: c } = order;
    const metadata = {
      order_id: order.orderId,
      customer_name: `${c.firstName} ${c.lastName}`,
      phone: c.phone,
      shipping_address: formatAddress(c),
      notes: c.notes || "",
    };

    const params = new URLSearchParams({
      mode: "payment",
      locale: "es-419",
      client_reference_id: order.orderId,
      customer_email: c.email,
      success_url: `${baseUrl}/gracias?provider=stripe&status=approved&order=${order.orderId}`,
      cancel_url: `${baseUrl}/carrito?cancelado=1`,
      "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
      "shipping_options[0][shipping_rate_data][display_name]": order.shipping ? STORE.shipping.label : "Envío gratis",
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(order.shipping * 100),
      "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "mxn",
      "payment_intent_data[description]": `Pedido ${order.orderId} · Lonier Skin`,
    });
    for (const [key, value] of Object.entries(metadata)) {
      params.set(`metadata[${key}]`, value);
      params.set(`payment_intent_data[metadata][${key}]`, value);
    }
    order.lines.forEach(({ product, qty, unitPrice }, i) => {
      params.set(`line_items[${i}][quantity]`, String(qty));
      params.set(`line_items[${i}][price_data][currency]`, "mxn");
      params.set(`line_items[${i}][price_data][unit_amount]`, String(unitPrice * 100));
      params.set(`line_items[${i}][price_data][product_data][name]`, product.name);
      params.set(`line_items[${i}][price_data][product_data][images][0]`, `${baseUrl}${product.images[0]}`);
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": order.orderId,
      },
      body: params,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      throw new Error(`HTTP ${response.status}: ${data.error?.message || "sin url"}`);
    }
    return data.url;
  },
});
