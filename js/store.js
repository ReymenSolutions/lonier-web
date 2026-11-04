// Catálogo y configuración de la tienda.
// Este archivo lo usan tanto el navegador como las funciones de /api,
// así el precio que se cobra siempre es el que está aquí (nunca el que manda el navegador).

export const STORE = {
  name: "Lonier Skin",
  currency: "MXN",
  whatsapp: "528681865718",
  whatsappDisplay: "+52 868 186 5718",
  // Pega aquí el enlace a tu publicación de Mercado Libre para mostrar el botón "Comprar en Mercado Libre".
  mercadoLibreUrl: "",
  shipping: {
    fee: 99,
    // El envío es gratis si se cumple cualquiera de las dos. Usa null para desactivar una.
    freeFromQty: 3,
    freeFromAmount: 999,
    label: "Envío estándar a todo México (3 a 7 días hábiles)",
  },
  maxQtyPerItem: 10,
  // Se muestra "¡Quedan pocas piezas!" cuando el inventario es igual o menor a este número,
  // y te llega una alerta por correo al vender.
  lowStockThreshold: 5,
  analytics: {
    // Meta (Facebook/Instagram) → Administrador de eventos → Conjuntos de datos → ID del píxel (solo números).
    metaPixelId: "",
    // Google Analytics → Administrar → Flujos de datos → ID de medición (empieza con "G-").
    ga4Id: "",
  },
};

export const PLACEHOLDER_IMAGE = "/assets/serum-placeholder.svg";

export const PRODUCTS = [
  {
    id: "lonier-skin-serum",
    name: "Lonier Skin Serum",
    tagline: "Cuidado facial natural · Hecho en México",
    // Precio de 1 pieza y precio "antes" por pieza (se muestra tachado).
    price: 299,
    compareAtPrice: 349,
    // Paquetes: precio total por N piezas. Las cantidades mayores se arman con los paquetes más grandes
    // (4 piezas = paquete de 3 + 1 pieza).
    bundles: [
      { qty: 1, price: 299, perks: ["Rutina de mañana y/o noche", "Pago 100% seguro"] },
      {
        qty: 2,
        price: 549,
        badge: "Más vendido",
        perks: ["Para ti y para regalar, o de repuesto", "Asesoría por WhatsApp"],
        highlight: "Asesoría personalizada por WhatsApp",
      },
      { qty: 3, price: 749, badge: "Mejor valor", perks: ["Envío GRATIS", "El mejor precio por frasco", "Asesoría por WhatsApp"] },
    ],
    defaultBundle: 2,
    // La primera imagen es la principal (tienda, carrito y pagos).
    images: [
      "/assets/serum-caja.webp",
      "/assets/serum-ambiente.webp",
      "/assets/serum-duo.webp",
      "/assets/serum-etiqueta.webp",
    ],
    shortDescription:
      "Serum facial con vitamina C, ácido hialurónico y niacinamida 3.5%. Para una piel con apariencia más luminosa, hidratada y uniforme.",
    description:
      "Serum facial con vitamina C, ácido hialurónico, niacinamida al 3.5%, vitamina E y té verde. Su textura ligera se absorbe rápido y ayuda a que tu piel luzca más luminosa, hidratada y uniforme. Úsalo de mañana, de noche o en ambos momentos.",
    features: [
      "Vitamina C, ácido hialurónico y niacinamida 3.5%",
      "Textura ligera, sin sensación grasosa",
      "Para usar de mañana y/o de noche",
      "Hecho en México",
    ],
    ingredients: [
      { name: "Vitamina C", benefit: "Ayuda a que la piel luzca más luminosa y con un tono más uniforme." },
      { name: "Ácido hialurónico", benefit: "Ayuda a retener la hidratación para una piel más suave y elástica." },
      { name: "Niacinamida 3.5%", benefit: "Ayuda a mejorar la apariencia de la textura y de los poros." },
      { name: "Vitamina E", benefit: "Antioxidante que ayuda a cuidar y suavizar la piel." },
      { name: "Té verde", benefit: "Antioxidante natural que ayuda a refrescar la piel." },
    ],
    howToUse: [
      "Limpia y seca tu rostro.",
      "Aplica de 3 a 5 gotas en el rostro limpio, de mañana y/o de noche.",
      "Masajea suavemente hasta que se absorba.",
      "Finaliza con tu crema hidratante y, de día, protector solar (SPF).",
    ],
    precautions: [
      "Solo para uso externo.",
      "Evita el contacto directo con los ojos.",
      "Suspende su uso si notas irritación y consulta a tu dermatólogo.",
      "Consérvalo en un lugar fresco y seco, fuera del alcance de los niños.",
      "Una vez abierto, úsalo dentro de los siguientes 6 meses.",
    ],
    active: true,
  },
];

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id && p.active) || null;
}

// Divide una cantidad en paquetes, del más grande al más chico: 5 → [paquete de 3, paquete de 2].
// Devuelve [{ qty, price, count }] (count = cuántas veces se usa ese paquete).
export function bundleBreakdown(product, qty) {
  const bundles = [...(product.bundles || [{ qty: 1, price: product.price }])].sort((a, b) => b.qty - a.qty);
  const parts = [];
  let left = qty;
  for (const bundle of bundles) {
    const count = Math.floor(left / bundle.qty);
    if (count > 0) {
      parts.push({ qty: bundle.qty, price: bundle.price, count });
      left -= count * bundle.qty;
    }
  }
  if (left > 0) parts.push({ qty: 1, price: product.price, count: left });
  return parts;
}

// Precio total de N piezas aplicando los paquetes.
export function lineTotalFor(product, qty) {
  return bundleBreakdown(product, qty).reduce((sum, part) => sum + part.price * part.count, 0);
}

export function compareAtTotalFor(product, qty) {
  return (product.compareAtPrice || product.price) * qty;
}

export function qualifiesForFreeShipping(totalQty, subtotal) {
  const { freeFromQty, freeFromAmount } = STORE.shipping;
  return (freeFromQty != null && totalQty >= freeFromQty) || (freeFromAmount != null && subtotal >= freeFromAmount);
}

export function shippingFor(totalQty, subtotal = 0) {
  if (totalQty <= 0) return 0;
  return qualifiesForFreeShipping(totalQty, subtotal) ? 0 : STORE.shipping.fee;
}

// Texto para animar a completar el envío gratis.
export function freeShippingMessage(totalQty, subtotal = 0) {
  const { freeFromQty, freeFromAmount } = STORE.shipping;
  if (freeFromQty == null && freeFromAmount == null) return "";
  if (totalQty > 0 && qualifiesForFreeShipping(totalQty, subtotal)) return "¡Tu pedido tiene envío gratis!";
  if (freeFromQty == null) return `Te faltan ${formatMXN(freeFromAmount - subtotal)} para el envío gratis.`;
  const missing = freeFromQty - totalQty;
  return totalQty === 0
    ? `Envío gratis llevando ${freeFromQty} piezas.`
    : `Agrega ${missing} ${missing === 1 ? "pieza" : "piezas"} más y tu envío es gratis.`;
}

export function freeShippingRule() {
  const { freeFromQty, freeFromAmount } = STORE.shipping;
  const rules = [];
  if (freeFromQty != null) rules.push(`llevando ${freeFromQty} piezas o más`);
  if (freeFromAmount != null) rules.push(`en compras desde ${formatMXN(freeFromAmount)}`);
  return rules.join(" o ");
}

export function shippingSummary() {
  const { fee, label } = STORE.shipping;
  const rule = freeShippingRule();
  return `${label}: ${formatMXN(fee)}` + (rule ? `. Gratis ${rule}` : "");
}

export function discountPercent(product) {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.compareAtPrice) * 100);
}

export function formatMXN(amount) {
  return `${formatPrice(amount)} MXN`;
}

export function formatPrice(amount) {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `$${amount.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
}
