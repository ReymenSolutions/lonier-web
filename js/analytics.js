// Meta Pixel y Google Analytics 4. Solo se cargan si pusiste sus IDs en js/store.js (STORE.analytics).
import { STORE, lineTotalFor } from "./store.js";

const { metaPixelId, ga4Id } = STORE.analytics;
const CURRENCY = "MXN";

function loadScript(src) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (ga4Id && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4Id);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
  }

  if (metaPixelId && !window.fbq) {
    const fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    Object.assign(fbq, { push: fbq, loaded: true, version: "2.0", queue: [] });
    window.fbq = window._fbq = fbq;
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", metaPixelId);
    fbq("track", "PageView");
  }
}

function send({ ga, meta, gaParams, metaParams, eventId }) {
  window.gtag?.("event", ga, gaParams);
  window.fbq?.("track", meta, metaParams, eventId ? { eventID: eventId } : undefined);
}

const gaItem = (product, qty = 1) => ({
  item_id: product.id,
  item_name: product.name,
  price: Math.round((lineTotalFor(product, qty) / qty) * 100) / 100,
  quantity: qty,
});

export function trackViewItem(product) {
  send({
    ga: "view_item",
    meta: "ViewContent",
    gaParams: { currency: CURRENCY, value: product.price, items: [gaItem(product)] },
    metaParams: { content_ids: [product.id], content_name: product.name, content_type: "product", value: product.price, currency: CURRENCY },
  });
}

export function trackAddToCart(product, qty) {
  send({
    ga: "add_to_cart",
    meta: "AddToCart",
    gaParams: { currency: CURRENCY, value: lineTotalFor(product, qty), items: [gaItem(product, qty)] },
    metaParams: { content_ids: [product.id], content_type: "product", value: lineTotalFor(product, qty), currency: CURRENCY },
  });
}

export function trackBeginCheckout({ lines, qty, total }) {
  send({
    ga: "begin_checkout",
    meta: "InitiateCheckout",
    gaParams: { currency: CURRENCY, value: total, items: lines.map((l) => gaItem(l.product, l.qty)) },
    metaParams: { content_ids: lines.map((l) => l.product.id), content_type: "product", num_items: qty, value: total, currency: CURRENCY },
  });
}

// Se registra una sola vez por pedido aunque el cliente recargue la página de gracias.
export function trackPurchase({ orderId, total, lines }) {
  const KEY = "lonier_tracked_orders";
  let tracked = [];
  try {
    tracked = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {}
  if (!orderId || tracked.includes(orderId)) return;

  send({
    ga: "purchase",
    meta: "Purchase",
    eventId: orderId,
    gaParams: { transaction_id: orderId, currency: CURRENCY, value: total, items: lines.map((l) => gaItem(l.product, l.qty)) },
    metaParams: { content_ids: lines.map((l) => l.product.id), content_type: "product", value: total, currency: CURRENCY },
  });

  try {
    localStorage.setItem(KEY, JSON.stringify([...tracked, orderId].slice(-20)));
  } catch {}
}
