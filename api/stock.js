// Inventario público: { "lonier-skin-serum": 12 } (null = sin control de inventario).
import { getStock } from "./_lib/orders.js";

export async function GET() {
  try {
    return Response.json(await getStock(), {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[inventario]", error.message);
    return Response.json({}, { status: 200 });
  }
}
