// Servidor para correr la tienda en un VPS (en Vercel no se usa).
// Sirve las páginas y archivos públicos, y ejecuta las funciones de /api igual que Vercel.
//   node server.js            → escucha en 127.0.0.1:3000 (nginx le pasa el tráfico)
//   PORT=4000 node server.js  → otro puerto
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY = 1024 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

// Solo se sirven las páginas .html de la raíz y lo que está en assets/, css/ y js/.
// Así nunca se exponen .env, server.js, api/, tests/, etc.
const PUBLIC_FILE = /^\/(?:(?:assets|css|js)\/[A-Za-z0-9._\-/]+|[A-Za-z0-9\-]+\.html|robots\.txt|sitemap\.xml)$/;
const API_ROUTE = /^\/api\/((?:[a-z0-9-]+\/)*[a-z0-9-]+)$/;

async function serveStatic(req, res, pathname) {
  let file = pathname === "/" ? "/index.html" : pathname;
  if (!path.extname(file)) file += ".html"; // URLs limpias: /carrito → carrito.html
  if (!PUBLIC_FILE.test(file) || file.includes("..")) return notFound(res);

  const fullPath = path.join(ROOT, file);
  try {
    if (!(await stat(fullPath)).isFile()) return notFound(res);
  } catch {
    return notFound(res);
  }

  // Igual que Vercel con cleanUrls: /carrito.html → /carrito
  if (pathname.endsWith(".html")) {
    const clean = pathname === "/index.html" ? "/" : pathname.slice(0, -5);
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.writeHead(308, { Location: clean + query });
    return res.end();
  }

  const ext = path.extname(file);
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
  });
  if (req.method === "HEAD") return res.end();
  res.end(await readFile(fullPath));
}

async function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta charset="utf-8"><title>No encontrado</title><p>Página no encontrada. <a href="/">Ir a Lonier Skin</a></p>`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Cuerpo demasiado grande"), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const modules = new Map();
async function loadRoute(route) {
  if (!modules.has(route)) {
    const file = path.join(ROOT, "api", `${route}.js`);
    try {
      await stat(file);
    } catch {
      modules.set(route, null);
      return null;
    }
    modules.set(route, await import(pathToFileURL(file).href));
  }
  return modules.get(route);
}

async function serveApi(req, res, route) {
  const mod = await loadRoute(route);
  if (!mod) return sendJson(res, 404, { error: "No encontrado." });

  const body = req.method === "GET" || req.method === "HEAD" ? null : await readBody(req);

  // Estilo web estándar: export async function POST(request) → Response
  const webHandler = mod[req.method];
  if (typeof webHandler === "function") {
    const origin = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
    const request = new Request(new URL(req.url, origin), {
      method: req.method,
      headers: Object.entries(req.headers).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])),
      body: body && body.length ? body : undefined,
    });
    const response = await webHandler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    return res.end(Buffer.from(await response.arrayBuffer()));
  }

  // Estilo Vercel/Node: export default function handler(req, res)
  if (typeof mod.default === "function") {
    const text = body ? body.toString("utf8") : "";
    req.body = (req.headers["content-type"] || "").includes("application/json") && text ? safeJson(text) : text;
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (data) => sendJson(res, res.statusCode || 200, data);
    return mod.default(req, res);
  }

  res.setHeader("Allow", Object.keys(mod).filter((k) => /^[A-Z]+$/.test(k)).join(", "));
  return sendJson(res, 405, { error: "Método no permitido." });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sendJson(res, status, data) {
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(JSON.stringify(data));
}

// Con CANONICAL_HOST=lonier.mx, las visitas a www.lonier.mx se redirigen a lonier.mx.
function redirectToCanonical(req, res) {
  const canonical = process.env.CANONICAL_HOST;
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if (!canonical || host !== `www.${canonical}`) return false;
  res.writeHead(301, { Location: `https://${canonical}${req.url}` });
  res.end();
  return true;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (redirectToCanonical(req, res)) return;
    const { pathname } = new URL(req.url, "http://localhost");
    try {
      const api = pathname.match(API_ROUTE);
      if (api) return await serveApi(req, res, api[1]);
      if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "No encontrado." });
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD" });
        return res.end();
      }
      return await serveStatic(req, res, decodeURIComponent(pathname));
    } catch (error) {
      console.error(`[servidor] ${req.method} ${pathname}:`, error);
      if (!res.headersSent) sendJson(res, error.status || 500, { error: "Error del servidor." });
      else res.end();
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, HOST, () => console.log(`Lonier Skin escuchando en http://${HOST}:${PORT}`));
}
