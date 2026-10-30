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
    // Monto a partir del cual el envío es gratis. Usa null para cobrar siempre la tarifa fija.
    freeOver: null,
    label: "Envío estándar a todo México (3 a 7 días hábiles)",
  },
  maxQtyPerItem: 10,
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

export function shippingFor(subtotal) {
  if (subtotal <= 0) return 0;
  const { fee, freeOver } = STORE.shipping;
  if (freeOver != null && subtotal >= freeOver) return 0;
  return fee;
}

export function discountPercent(product) {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.compareAtPrice) * 100);
}

export function formatMXN(amount) {
  return `$${amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`;
}
