// Panel de administración: pedidos pagados e inventario. Protegido con ADMIN_PASSWORD.
import { createHash, timingSafeEqual } from "node:crypto";
import { PRODUCTS } from "../js/store.js";
import { hasDatabase } from "./_lib/redis.js";
import { getStock, listPaidOrders, markShipped, setStock } from "./_lib/orders.js";
import { notifyCustomerOfShipment } from "./_lib/notify.js";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const digest = (value) => createHash("sha256").update(value).digest();

function authorized(request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const given = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  return timingSafeEqual(digest(given), digest(password));
}

function guard(request) {
  if (!process.env.ADMIN_PASSWORD) return json({ error: "Configura ADMIN_PASSWORD en Vercel para usar el panel." }, 503);
  if (!authorized(request)) return json({ error: "Contraseña incorrecta." }, 401);
  if (!hasDatabase()) return json({ error: "Conecta la base de datos (Upstash Redis) en Vercel para guardar pedidos e inventario." }, 503);
  return null;
}

export async function GET(request) {
  const denied = guard(request);
  if (denied) return denied;
  const [orders, stock] = await Promise.all([listPaidOrders(), getStock()]);
  return json({
    orders,
    stock,
    products: PRODUCTS.map(({ id, name }) => ({ id, name })),
    emailsEnabled: Boolean(process.env.RESEND_API_KEY && process.env.ORDER_EMAIL_TO),
    customerEmailsEnabled: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  });
}

export async function POST(request) {
  const denied = guard(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));

  if (body.action === "setStock") {
    if (!PRODUCTS.some((p) => p.id === body.productId)) return json({ error: "Producto desconocido." }, 400);
    const qty = body.qty === null || body.qty === "" ? null : Number(body.qty);
    if (qty !== null && (!Number.isInteger(qty) || qty < 0 || qty > 100000)) {
      return json({ error: "Escribe un número entero de piezas." }, 400);
    }
    await setStock(body.productId, qty);
    return json({ ok: true, stock: await getStock() });
  }

  if (body.action === "markShipped") {
    const tracking = String(body.tracking || "").trim().slice(0, 120);
    const order = await markShipped(String(body.orderId || ""), tracking);
    if (!order) return json({ error: "No encontramos ese pedido." }, 404);
    let emailed = false;
    try {
      emailed = await notifyCustomerOfShipment(order);
    } catch (error) {
      console.error(`[correo envío] ${order.id}:`, error.message);
    }
    return json({ ok: true, order, emailed });
  }

  return json({ error: "Acción desconocida." }, 400);
}
