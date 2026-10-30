// Crea una preferencia de Mercado Pago Checkout Pro y devuelve la URL de pago.
// https://www.mercadopago.com.mx/developers/es/reference/preferences/_checkout_preferences/post
import { checkoutHandler, formatAddress } from "../_lib/order.js";

export default checkoutHandler({
  provider: "Mercado Pago",
  envVar: "MP_ACCESS_TOKEN",
  async createCheckout({ order, secret, baseUrl }) {
    const { customer: c } = order;
    const returnUrl = `${baseUrl}/gracias?provider=mercadopago&order=${order.orderId}`;

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.orderId,
      },
      body: JSON.stringify({
        external_reference: order.orderId,
        items: order.lines.map(({ product, qty, unitPrice }) => ({
          id: product.id,
          title: product.name,
          description: product.shortDescription,
          picture_url: `${baseUrl}${product.images[0]}`,
          category_id: "health_and_beauty",
          quantity: qty,
          currency_id: "MXN",
          unit_price: unitPrice,
        })),
        shipments: { mode: "not_specified", cost: order.shipping },
        payer: {
          name: c.firstName,
          surname: c.lastName,
          email: c.email,
          phone: { number: c.phone },
          address: { zip_code: c.zip, street_name: c.street },
        },
        metadata: {
          order_id: order.orderId,
          shipping_address: formatAddress(c),
          notes: c.notes || "",
        },
        back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
        auto_return: "approved",
        statement_descriptor: "LONIER SKIN",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.init_point) {
      throw new Error(`HTTP ${response.status}: ${data.message || "sin init_point"}`);
    }
    return data.init_point;
  },
});
