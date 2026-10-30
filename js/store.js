// Catálogo y configuración de la tienda.
// Este archivo lo usan tanto el navegador como las funciones de /api,
// así el precio que se cobra siempre es el que está aquí (nunca el que manda el navegador).

export const STORE = {
  name: "Lonier Skin",
  currency: "MXN",
  whatsapp: "528129992392",
  whatsappDisplay: "+52 812 999 2392",
  // Pega aquí el enlace a tu publicación de Mercado Libre para mostrar el botón "Comprar en Mercado Libre".
  mercadoLibreUrl: "",
  shipping: {
    fee: 99,
    // Número de piezas a partir del cual el envío es gratis. Usa null para cobrar siempre la tarifa fija.
    freeFromQty: 3,
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
    tagline: "Serum facial premium · Glow natural",
    price: 299,
    compareAtPrice: 349,
    images: ["/assets/serum-front.png", "/assets/serum-single.png"],
    shortDescription:
      "Serum facial premium para tu rutina de día o noche. Piel con apariencia más hidratada, luminosa y suave.",
    description:
      "Lonier Skin Serum está diseñado para integrarse a tu rutina de día o de noche. Su textura ligera se absorbe rápido y ayuda a mejorar la apariencia de hidratación, luminosidad y suavidad de la piel.",
    features: [
      "Textura ligera, sin sensación grasosa",
      "Para uso diario, de día o de noche",
      "Producto principal de Lonier Skin",
      "Paga con Mercado Pago o tarjeta",
    ],
    howToUse: [
      "Limpia y seca tu rostro.",
      "Aplica de 2 a 3 gotas en rostro y cuello.",
      "Masajea suavemente hasta que se absorba.",
      "Continúa con tu crema hidratante y, de día, protector solar.",
    ],
    active: true,
  },
];

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id && p.active) || null;
}

export function shippingFor(totalQty) {
  if (totalQty <= 0) return 0;
  const { fee, freeFromQty } = STORE.shipping;
  if (freeFromQty != null && totalQty >= freeFromQty) return 0;
  return fee;
}

// Texto para animar a completar el envío gratis, según cuántas piezas lleva el cliente.
export function freeShippingMessage(totalQty) {
  const { freeFromQty } = STORE.shipping;
  if (freeFromQty == null) return "";
  if (totalQty >= freeFromQty) return "¡Tu envío es gratis!";
  const missing = freeFromQty - totalQty;
  return totalQty === 0
    ? `Envío gratis comprando ${freeFromQty} piezas o más.`
    : `Agrega ${missing} ${missing === 1 ? "pieza" : "piezas"} más y tu envío es gratis.`;
}

export function shippingSummary() {
  const { fee, freeFromQty, label } = STORE.shipping;
  return `${label}: ${formatMXN(fee)}` + (freeFromQty != null ? `, gratis comprando ${freeFromQty} piezas o más` : "");
}

export function discountPercent(product) {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.compareAtPrice) * 100);
}

export function formatMXN(amount) {
  return `$${amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`;
}
