const publicFields: Record<string, string[]> = {
  Catalogo: ["id", "titulo", "descripcion", "precio", "disponible", "imagenes", "categoria", "vendido", "badge", "reservado"],
  Config: ["clave", "valor"],
  Ventas: ["concepto", "importe"]
};
const publicSettings = new Set(["titulo", "intro", "nota_reserva", "whatsapp", "actualizado", "meta_total", "mp_comision_inmediata", "mp_comision_3_cuotas", "mp_iva", "mostrar_boton_vender"]);

// Project again at the public boundary, including dropping formatted/raw metadata.
function publicTable(sheet: string, table: any) {
  if (!Array.isArray(table?.cols) || !Array.isArray(table?.rows)) throw new Error("Invalid source table");
  const fields = publicFields[sheet];
  const indices = fields.map(label => {
    const matches = table.cols.map((column: any, index: number) => column?.label === label ? index : -1).filter((index: number) => index >= 0);
    if (matches.length !== 1) throw new Error("Invalid source columns");
    return matches[0];
  });
  const rows = table.rows.map((row: any) => {
    if (!Array.isArray(row?.c)) throw new Error("Invalid source row");
    return { c: indices.map(index => {
      const value = row.c[index]?.v ?? "";
      if (!["string", "number", "boolean"].includes(typeof value) || (typeof value === "number" && !Number.isFinite(value))) throw new Error("Invalid source cell");
      return { v: value };
    }) };
  }).filter((row: any) => sheet === "Config" ? publicSettings.has(String(row.c[0].v).trim()) : sheet === "Ventas" ? row.c[0].v === "TOTAL VENDIDO" : String(row.c[1].v).trim());
  if (sheet === "Ventas" && (rows.length !== 1 || typeof rows[0].c[1].v !== "number")) throw new Error("Invalid sales total");
  return { cols: fields.map(label => ({ label })), rows };
}

export default async (request: Request) => {
  const sheet = new URL(request.url).searchParams.get("sheet") || "Catalogo";
  if (!["Catalogo", "Config", "Ventas"].includes(sheet)) return new Response("Not found", { status: 404 });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    // Reuse the existing owner-authorized bridge; credentials stay in Functions.
    const url = Netlify.env.get("WAITLIST_SCRIPT_URL");
    const secret = Netlify.env.get("WAITLIST_SCRIPT_SECRET");
    if (!url || !secret || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) throw new Error("Missing private catalog connection");
    // Keep the complete read below the browser and waitlist request budgets.
    // Retry only transient failures; never reuse stale stock or configuration.
    for (let attempt = 0; attempt < 2; attempt++) {
      let reason = "network";
      let retryable = true;
      try {
        const response = await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "catalog.read", sheet, secret }),
          signal: AbortSignal.timeout(attempt === 0 ? 12000 : 5000)
        });
        if (!response.ok) {
          reason = `http_${response.status}`;
          retryable = response.status === 429 || response.status >= 500;
          await response.body?.cancel();
          throw new Error("Upstream unavailable");
        }
        reason = "invalid_response";
        retryable = false;
        const data = await response.json();
        if (data.ok !== true) throw new Error("Private source rejected request");
        return new Response(JSON.stringify({ table: publicTable(sheet, data.table) }), { headers });
      } catch (error) {
        if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) reason = "timeout";
        // No upstream bodies, URLs, customer records or credentials in logs.
        console.warn(JSON.stringify({ event: "catalog_read_failed", sheet, attempt: attempt + 1, reason }));
        if (!retryable || attempt === 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  } catch (_) {
    return new Response(JSON.stringify({ error: "Catalog temporarily unavailable" }), { status: 503, headers });
  }
};

export const config = {
  path: "/api/catalog",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
