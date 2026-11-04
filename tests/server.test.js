import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.js";

let server, base;
before(async () => {
  for (const key of ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL", "MP_ACCESS_TOKEN", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "ADMIN_PASSWORD"]) {
    delete process.env[key];
  }
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const get = (path, init) => fetch(base + path, { redirect: "manual", ...init });

test("sirve páginas con URLs limpias y archivos públicos", async () => {
  for (const [path, type] of [
    ["/", "text/html"],
    ["/carrito", "text/html"],
    ["/producto", "text/html"],
    ["/css/styles.css", "text/css"],
    ["/js/store.js", "text/javascript"],
    ["/assets/serum-caja.webp", "image/webp"],
    ["/assets/og-image.jpg", "image/jpeg"],
    ["/robots.txt", "text/plain"],
    ["/sitemap.xml", "application/xml"],
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type"), new RegExp(type), path);
  }
  assert.match(await (await get("/carrito")).text(), /Tu carrito/);
});

test("redirige .html a la URL limpia conservando la búsqueda", async () => {
  const res = await get("/producto.html?id=lonier-skin-serum");
  assert.equal(res.status, 308);
  assert.equal(res.headers.get("location"), "/producto?id=lonier-skin-serum");
  assert.equal((await get("/index.html")).headers.get("location"), "/");
});

test("nunca expone archivos privados", async () => {
  for (const path of [
    "/.env",
    "/.env.example",
    "/server.js",
    "/package.json",
    "/README.md",
    "/vercel.json",
    "/api/admin.js",
    "/api/_lib/order.js",
    "/tests/helpers.js",
    "/deploy/setup.sh",
    "/.git/config",
    "/js/../server.js",
    "/assets/../server.js",
    "/%2e%2e/server.js",
    "/no-existe",
  ]) {
    const res = await get(path);
    assert.ok([404, 400].includes(res.status), `${path} → ${res.status}`);
  }
  assert.equal((await get("/api/_lib/order")).status, 404);
  assert.equal((await get("/api/no-existe")).status, 404);
});

test("ejecuta las funciones de /api en ambos estilos", async () => {
  // Web estándar (GET)
  const stock = await get("/api/stock");
  assert.equal(stock.status, 200);
  assert.deepEqual(await stock.json(), { "lonier-skin-serum": null });

  // Estilo Vercel (req, res) con cuerpo JSON
  const checkout = await get("/api/checkout/mercadopago", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [] }),
  });
  assert.equal(checkout.status, 503);
  assert.match((await checkout.json()).error, /no está configurado/);

  assert.equal((await get("/api/checkout/stripe")).status, 405);
  assert.equal((await get("/api/webhooks/stripe", { method: "POST", body: "{}" })).status, 503);
  assert.equal((await get("/api/admin")).status, 503);
  assert.equal((await get("/api/stock", { method: "DELETE" })).status, 405);
});

test("rechaza cuerpos demasiado grandes", async () => {
  const res = await get("/api/webhooks/stripe", { method: "POST", body: "x".repeat(2 * 1024 * 1024) }).catch(() => ({ status: 413 }));
  assert.equal(res.status, 413);
});
