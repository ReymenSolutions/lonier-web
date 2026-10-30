// Muestra "Agotado" o "¡Quedan pocas piezas!" según el inventario guardado en el servidor.
import { STORE } from "./store.js";

let request;

export function loadStock() {
  request ||= fetch("/api/stock")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return request;
}

// Botones con data-add="{id}" se desactivan si no hay piezas;
// elementos con data-stock-note="{id}" muestran el aviso de inventario.
export async function applyStock() {
  const stock = await loadStock();
  document.querySelectorAll("[data-add]").forEach((btn) => {
    const qty = stock[btn.dataset.add];
    if (qty != null && qty <= 0) {
      btn.disabled = true;
      btn.textContent = "Agotado";
    }
  });
  document.querySelectorAll("[data-stock-note]").forEach((el) => {
    const qty = stock[el.dataset.stockNote];
    el.textContent =
      qty == null
        ? ""
        : qty <= 0
          ? "Agotado por ahora. Escríbenos por WhatsApp y te avisamos cuando vuelva."
          : qty <= STORE.lowStockThreshold
            ? `¡Solo quedan ${qty} piezas!`
            : "";
    el.hidden = !el.textContent;
  });
}
