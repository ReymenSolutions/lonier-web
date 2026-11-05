// Encabezado que se oculta al bajar y reaparece al subir, y "jalar para actualizar" con la gota de Lonier.

const isPanelOpen = () => document.querySelector(".cart-panel.active, .menu-panel.active") !== null;

// ---------- Encabezado ----------
// Arriba de la página se ve completo; al bajar se oculta; al subir reaparece solo la barra del logo
// (la franja de envío gratis vuelve hasta llegar arriba).
export function autoHideHeader(header) {
  if (!header) return;
  const announcement = header.querySelector(".announcement");
  const setAnnouncementHeight = () =>
    header.style.setProperty("--announcement-h", `${announcement ? announcement.offsetHeight : 0}px`);
  setAnnouncementHeight();
  window.addEventListener("resize", setAnnouncementHeight, { passive: true });

  let lastY = window.scrollY;
  let ticking = false;

  function update() {
    ticking = false;
    if (isPanelOpen()) return;
    // Ignorar el rebote del iPhone al pasarse del inicio o del final de la página
    // (si no, el encabezado aparece y desaparece muy rápido).
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const raw = window.scrollY;
    if (raw < 0 || raw > max - 2) {
      lastY = Math.min(Math.max(raw, 0), max);
      return;
    }
    const y = raw;
    const delta = y - lastY;

    if (y <= header.offsetHeight) {
      header.classList.remove("header-hidden", "header-peek");
    } else if (delta > 6) {
      header.classList.add("header-hidden");
      header.classList.remove("header-peek");
    } else if (delta < -6) {
      header.classList.remove("header-hidden");
      header.classList.add("header-peek");
    }
    if (Math.abs(delta) > 6 || y <= header.offsetHeight) lastY = y;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
}

// ---------- Jalar para actualizar ----------
const THRESHOLD = 90; // px que hay que jalar (ya amortiguados) para que se llene la gota
const MAX_PULL = 140;

export function pullToRefresh(onRefresh) {
  if (!("ontouchstart" in window)) return;

  const indicator = document.createElement("div");
  indicator.className = "ptr";
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = '<span class="ptr-drop"><span class="ptr-fill"></span></span>';
  document.body.appendChild(indicator);

  let startY = null;
  let pull = 0;

  const render = () => {
    const fill = Math.min(1, pull / THRESHOLD);
    indicator.style.setProperty("--pull", `${pull}px`);
    indicator.style.setProperty("--fill", fill.toFixed(3));
    indicator.classList.toggle("ready", fill >= 1);
  };

  function reset() {
    startY = null;
    pull = 0;
    indicator.classList.remove("pulling");
    indicator.classList.add("returning");
    render();
  }

  window.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1 || window.scrollY > 0 || isPanelOpen()) return;
      startY = event.touches[0].clientY;
      indicator.classList.remove("returning");
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (startY === null) return;
      const dy = event.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) {
        if (pull) reset();
        return;
      }
      // Amortiguado: entre más jalas, más cuesta (como el gesto nativo).
      pull = Math.min(MAX_PULL, dy * 0.5);
      indicator.classList.add("pulling");
      render();
      if (event.cancelable) event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("touchend", () => {
    if (startY === null) return;
    if (pull >= THRESHOLD) {
      indicator.classList.add("refreshing");
      onRefresh();
    } else {
      reset();
    }
    startY = null;
  });

  window.addEventListener("touchcancel", () => startY !== null && reset());
}
