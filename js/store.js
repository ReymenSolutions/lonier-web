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
    tagline: "Cuidado facial natural · Hecho en México",
    price: 299,
    compareAtPrice: 349,
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
