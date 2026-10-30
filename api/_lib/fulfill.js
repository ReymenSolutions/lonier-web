// Qué hacer cuando una pasarela confirma un pago: marcar el pedido como pagado (una sola vez),
// descontar inventario, guardarlo y avisar por correo.
import { claimPayment, decrementStock, getOrder, recordPaidOrder, releasePayment } from "./orders.js";
import { notifyCustomerOfPaidOrder, notifyOwnerOfPaidOrder } from "./notify.js";

// Datos que viajan en la metadata del pago, por si el pedido no está en la base de datos.
export function paymentMetadata(order) {
  const c = order.customer;
  return {
    order_id: order.orderId,
    customer_name: `${c.firstName} ${c.lastName}`,
    email: c.email,
    phone: c.phone,
    shipping_address: [c.street, `Col. ${c.neighborhood}`, `C.P. ${c.zip}`, c.city, c.state].join(", "),
    notes: c.notes || "",
    items: order.lines.map((l) => `${l.qty} x ${l.product.name}`).join(", "),
    shipping: String(order.shipping),
  };
}

function orderFromMetadata(orderId, meta = {}, total) {
  return {
    id: orderId,
    customer: {
      firstName: meta.customer_name || "(sin nombre)",
      lastName: "",
      email: meta.email || "",
      phone: meta.phone || "",
      fullAddress: meta.shipping_address || "(sin dirección: revisa el pago en tu panel)",
      notes: meta.notes || "",
    },
    lines: [],
    summary: meta.items || "",
    shipping: Number(meta.shipping) || 0,
    total,
  };
}

// amountPaidAlt: otra forma de leer el monto pagado (p. ej. Mercado Pago puede reportar el envío aparte).
export async function fulfillPaidOrder({ orderId, provider, paymentId, amountPaid, amountPaidAlt, metadata }) {
  if (!(await claimPayment(orderId))) return { status: "duplicado" };

  try {
    const stored = await getOrder(orderId);
    const order = stored || orderFromMetadata(orderId, metadata, amountPaid);
    const warnings = [];
    const matches = (amount) => amount != null && Math.abs(order.total - amount) <= 0.5;
    if (!matches(amountPaid) && !matches(amountPaidAlt)) {
      warnings.push(`El monto pagado (${amountPaid}) no coincide con el total del pedido (${order.total}). Revísalo antes de enviar.`);
    }
    if (!stored) warnings.push("Este pedido no estaba en la base de datos; los datos vienen del pago.");

    Object.assign(order, { status: "pagado", provider, paymentId: String(paymentId), paidAt: new Date().toISOString() });
    const remainingStock = await decrementStock(order.lines);
    await recordPaidOrder(order);

    const results = await Promise.allSettled([
      notifyOwnerOfPaidOrder(order, { remainingStock, warnings }),
      notifyCustomerOfPaidOrder(order),
    ]);
    results
      .filter((r) => r.status === "rejected")
      .forEach((r) => console.error(`[correo] ${orderId}:`, r.reason?.message));

    return { status: "pagado", order };
  } catch (error) {
    // Liberamos el candado para que el reintento de la pasarela vuelva a procesarlo.
    await releasePayment(orderId).catch(() => {});
    throw error;
  }
}
