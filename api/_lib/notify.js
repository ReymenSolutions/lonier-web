// Correos de pedidos con Resend (https://resend.com). Si falta RESEND_API_KEY no se envía nada.
import { STORE, formatMXN } from "../../js/store.js";

const escape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function sendEmail({ to, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Lonier Skin <onboarding@resend.dev>",
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${await response.text()}`);
  return true;
}

function itemsTable(order) {
  const rows = (order.lines.length ? order.lines : [{ qty: "", name: order.summary, lineTotal: order.total - order.shipping }])
    .map((l) => `<tr><td>${l.qty ? `${l.qty} × ` : ""}${escape(l.name)}</td><td align="right">${formatMXN(l.lineTotal)}</td></tr>`)
    .join("");
  return `
    <table cellpadding="6" style="border-collapse:collapse;width:100%;max-width:480px">
      ${rows}
      <tr><td>Envío</td><td align="right">${order.shipping ? formatMXN(order.shipping) : "Gratis"}</td></tr>
      <tr><td><strong>Total</strong></td><td align="right"><strong>${formatMXN(order.total)}</strong></td></tr>
    </table>`;
}

function address(c) {
  if (c.fullAddress) return escape(c.fullAddress);
  return [c.street, `Col. ${c.neighborhood}`, `C.P. ${c.zip}`, `${c.city}, ${c.state}`].map(escape).join("<br>");
}

export async function notifyOwnerOfPaidOrder(order, { remainingStock = {}, warnings = [] } = {}) {
  const c = order.customer;
  const phone = c.phone ? `https://wa.me/52${c.phone}` : "";
  const lowStock = Object.entries(remainingStock)
    .filter(([, qty]) => qty <= STORE.lowStockThreshold)
    .map(([id, qty]) => `<li><strong>${escape(id)}</strong>: quedan ${qty} piezas</li>`)
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1f1f1f;line-height:1.5">
      <h2 style="margin:0 0 4px">Nuevo pedido pagado: ${escape(order.id)}</h2>
      <p style="margin:0 0 16px;color:#6f6a64">Pagado con ${escape(order.provider)} · ${new Date(order.paidAt).toLocaleString("es-MX", { timeZone: "America/Monterrey" })}</p>
      ${warnings.map((w) => `<p style="background:#fdecec;padding:10px;border-radius:8px"><strong>Atención:</strong> ${escape(w)}</p>`).join("")}
      ${itemsTable(order)}
      <h3>Enviar a</h3>
      <p>
        <strong>${escape(c.firstName)} ${escape(c.lastName)}</strong><br>
        ${address(c)}<br>
        ${c.notes ? `Referencias: ${escape(c.notes)}<br>` : ""}
        Tel: ${escape(c.phone)} ${phone ? `(<a href="${phone}">WhatsApp</a>)` : ""}<br>
        Correo: ${escape(c.email)}
      </p>
      ${lowStock ? `<h3>Inventario bajo</h3><ul>${lowStock}</ul><p>Recuerda ajustar también tu publicación en Mercado Libre.</p>` : ""}
    </div>`;

  return sendEmail({
    to: process.env.ORDER_EMAIL_TO,
    subject: `Nuevo pedido ${order.id} · ${formatMXN(order.total)}`,
    html,
    replyTo: c.email,
  });
}

// Al cliente solo se le escribe si configuraste un remitente con tu propio dominio (EMAIL_FROM),
// porque el remitente de prueba de Resend solo puede enviar a tu propio correo.
function canEmailCustomers() {
  return Boolean(process.env.EMAIL_FROM);
}

export async function notifyCustomerOfPaidOrder(order) {
  if (!canEmailCustomers()) return false;
  const c = order.customer;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1f1f1f;line-height:1.5">
      <h2>¡Gracias por tu compra, ${escape(c.firstName)}!</h2>
      <p>Recibimos el pago de tu pedido <strong>${escape(order.id)}</strong>. Lo preparamos y te avisamos cuando salga, con tu número de guía.</p>
      ${itemsTable(order)}
      <h3>Dirección de envío</h3>
      <p>${address(c)}</p>
      <p>¿Dudas? Escríbenos por WhatsApp: <a href="https://wa.me/${STORE.whatsapp}">${STORE.whatsappDisplay}</a></p>
    </div>`;
  return sendEmail({ to: c.email, subject: `Tu pedido ${order.id} de Lonier Skin`, html });
}

export async function notifyCustomerOfShipment(order) {
  if (!canEmailCustomers()) return false;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1f1f1f;line-height:1.5">
      <h2>¡Tu pedido va en camino!</h2>
      <p>Tu pedido <strong>${escape(order.id)}</strong> ya salió.</p>
      ${order.tracking ? `<p>Número de guía: <strong>${escape(order.tracking)}</strong></p>` : ""}
      <p>¿Dudas? Escríbenos por WhatsApp: <a href="https://wa.me/${STORE.whatsapp}">${STORE.whatsappDisplay}</a></p>
    </div>`;
  return sendEmail({ to: order.customer.email, subject: `Tu pedido ${order.id} va en camino`, html });
}
