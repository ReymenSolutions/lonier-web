// PayPal regresa aquí al cliente después de aprobar el pago (?token=ID-DE-LA-ORDEN-PAYPAL).
// Capturamos el pago, procesamos el pedido y lo mandamos a la página de gracias.
import { siteUrl } from "../_lib/order.js";
import { captureFromOrder, captureOrder, fulfillCapture } from "../_lib/paypal.js";

const redirect = (res, location) => {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
};

export default async function handler(req, res) {
  const base = siteUrl(req);
  const token = new URL(req.url, base).searchParams.get("token");
  if (!token) return redirect(res, `${base}/carrito?cancelado=1`);

  let result;
  try {
    result = captureFromOrder(await captureOrder(token));
  } catch (error) {
    console.error("[paypal] captura:", error.message);
    return redirect(res, `${base}/carrito?cancelado=1`);
  }

  const { orderId, capture } = result;
  const status = capture?.status === "COMPLETED" ? "approved" : capture?.status === "PENDING" ? "pending" : null;
  if (!status || !orderId) return redirect(res, `${base}/carrito?cancelado=1`);

  try {
    await fulfillCapture(result);
  } catch (error) {
    // El pago ya está cobrado: el aviso de PayPal (webhook) volverá a intentar procesar el pedido.
    console.error(`[paypal] ${orderId}:`, error.message);
  }

  const total = capture.amount?.value ? `&total=${encodeURIComponent(capture.amount.value)}` : "";
  return redirect(res, `${base}/gracias?provider=paypal&status=${status}&order=${encodeURIComponent(orderId)}${total}`);
}
