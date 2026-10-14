export default async (request: Request) => {
  const sheet = new URL(request.url).searchParams.get("sheet") || "Catalogo";
  if (!["Catalogo", "Config", "Ventas"].includes(sheet)) return new Response("Not found", { status: 404 });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  try {
    const url = new URL("https://docs.google.com/spreadsheets/d/18tOI0_8yoLwXR4za7XVvsOUjVrktexYldoMAlRJ1BMA/gviz/tq");
    url.searchParams.set("sheet", sheet);
    url.searchParams.set("headers", "1");
    // Only the aggregate is needed for the goal; never return the sales detail.
    const queries: Record<string, string> = {
      Catalogo: "select A,B,C,D,E,F,G,H,I,K where B is not null",
      Config: "select A,B where A is not null",
      Ventas: "select A,B where A = 'TOTAL VENDIDO'",
    };
    url.searchParams.set("tq", queries[sheet]);
    url.searchParams.set("tqx", "out:json");
    // Keep the complete read below the browser and waitlist request budgets.
    // Retry only transient failures; never reuse stale stock or configuration.
    for (let attempt = 0; attempt < 2; attempt++) {
      let reason = "network";
      let retryable = true;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(attempt === 0 ? 6000 : 2000) });
        if (!response.ok) {
          reason = `http_${response.status}`;
          retryable = response.status === 429 || response.status >= 500;
          await response.body?.cancel();
          throw new Error("Upstream unavailable");
        }
        const text = await response.text();
        reason = "invalid_response";
        retryable = false;
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        const data = JSON.parse(text.slice(start, end + 1));
        if (data.status === "error" || !Array.isArray(data.table?.cols) || !Array.isArray(data.table?.rows)) {
          throw new Error("Invalid upstream response");
        }
        return new Response(JSON.stringify({ table: data.table }), { headers });
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

export const config = { path: "/api/catalog" };
