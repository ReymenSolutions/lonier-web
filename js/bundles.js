// Selector de paquetes (1, 2 o 3 frascos) con ahorro, envío y precio por frasco.
import { STORE, breakdownLabel, compareAtTotalFor, formatPrice, isSingleBundle, lineTotalFor, shippingFor } from "./store.js";
import { icon } from "./icons.js";

function card(product, bundle, name) {
  const compare = compareAtTotalFor(product, bundle.qty);
  const savings = compare - bundle.price;
  const shipping = shippingFor(bundle.qty, bundle.price);
  const each = Math.round((bundle.price / bundle.qty) * 100) / 100;

  return `
    <label class="bundle-card${bundle.highlight ? " featured" : ""}" data-bundle="${bundle.qty}">
      <input type="radio" name="${name}" value="${bundle.qty}" />
      ${bundle.badge ? `<span class="bundle-badge">${bundle.badge}</span>` : ""}
      <span class="bundle-radio" aria-hidden="true"></span>
      <span class="bundle-main">
        <span class="bundle-title">${bundle.qty} ${bundle.qty === 1 ? "frasco" : "frascos"} Lonier Serum</span>
        ${savings > 0 ? `<span class="bundle-save">Ahorras ${formatPrice(savings)}</span>` : ""}
        <span class="bundle-perks">
          ${(bundle.perks || []).map((perk) => `<span>${icon("check", { size: 14 })}${perk}</span>`).join("")}
        </span>
      </span>
      <span class="bundle-side">
        <strong class="bundle-total">${formatPrice(bundle.price)}</strong>
        <span class="bundle-ship${shipping ? "" : " free"}">${shipping ? `+ ${formatPrice(shipping)} envío` : `${icon("check", { size: 14 })}Envío gratis`}</span>
        ${compare > bundle.price ? `<s class="bundle-compare">${formatPrice(compare)}</s>` : ""}
        ${bundle.qty > 1 ? `<span class="bundle-each">${formatPrice(each)}<small>por frasco</small></span>` : ""}
      </span>
      ${bundle.highlight ? `<span class="bundle-highlight">${icon("whatsapp", { size: 14 })}${bundle.highlight}</span>` : ""}
    </label>`;
}

// Dibuja el selector en `container` y avisa con onChange(qty) cuando cambia.
// Devuelve { get qty(), set(qty) } para sincronizarlo con el selector − / +.
export function mountBundlePicker(container, product, { onChange } = {}) {
  const name = `bundle-${product.id}-${Math.random().toString(36).slice(2, 7)}`;
  const bundles = product.bundles || [{ qty: 1, price: product.price }];
  container.classList.add("bundles");
  container.setAttribute("role", "radiogroup");
  container.setAttribute("aria-label", "Elige cuántos frascos");
  container.innerHTML = `
    <div class="bundles-title"><span>Elige tu rutina</span></div>
    ${bundles.map((bundle) => card(product, bundle, name)).join("")}
    <div class="bundle-combo" hidden></div>`;
  const combo = container.querySelector(".bundle-combo");

  let qty = product.defaultBundle || 1;

  function set(next) {
    qty = Math.max(1, Math.min(STORE.maxQtyPerItem, next));
    container.querySelectorAll(".bundle-card").forEach((el) => {
      const selected = Number(el.dataset.bundle) === qty;
      el.classList.toggle("selected", selected);
      el.querySelector("input").checked = selected;
    });
    // Más piezas que el paquete más grande: se explica la combinación en lugar de un promedio por frasco.
    combo.hidden = isSingleBundle(product, qty);
    if (!combo.hidden) {
      const total = lineTotalFor(product, qty);
      const shipping = shippingFor(qty, total);
      combo.innerHTML = `
        <strong>${qty} frascos: ${breakdownLabel(product, qty)}</strong>
        <span>${breakdownLabel(product, qty, { withPrices: true })} = <b>${formatPrice(total)}</b>${shipping ? ` + ${formatPrice(shipping)} envío` : " · Envío gratis"}</span>`;
    }
    onChange?.(qty);
  }

  container.addEventListener("change", (event) => {
    if (event.target.name === name) set(Number(event.target.value));
  });

  set(qty);
  return {
    get qty() {
      return qty;
    },
    set,
  };
}
