// Cliente mínimo para Upstash Redis por REST (la base de datos que Vercel ofrece en Storage → Upstash).
// Acepta los nombres de variables que crea la integración de Vercel (KV_*) o los de Upstash directo.

function credentials() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function hasDatabase() {
  return credentials() !== null;
}

async function request(path, body) {
  const creds = credentials();
  if (!creds) throw new Error("Base de datos no configurada");
  const response = await fetch(`${creds.url}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(`Redis: ${data.error || response.status}`);
  return data;
}

// redis("GET", "clave") → resultado
export async function redis(...command) {
  return (await request("", command)).result;
}

// pipeline([["GET", "a"], ["GET", "b"]]) → [resultadoA, resultadoB]
export async function pipeline(commands) {
  if (commands.length === 0) return [];
  const results = await request("/pipeline", commands);
  return results.map((r) => {
    if (r.error) throw new Error(`Redis: ${r.error}`);
    return r.result;
  });
}
