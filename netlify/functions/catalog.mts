export default async (request: Request) => {
  const sheet = new URL(request.url).searchParams.get("sheet") || "Catalogo";
  if (!["Catalogo", "Config"].includes(sheet)) return new Response("Not found", { status: 404 });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  try {
    const url = new URL("https://docs.google.com/spreadsheets/d/18tOI0_8yoLwXR4za7XVvsOUjVrktexYldoMAlRJ1BMA/gviz/tq");
    url.searchParams.set("sheet", sheet);
    url.searchParams.set("headers", "1");
    url.searchParams.set("tqx", "out:json");
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Upstream unavailable");
    const text = await response.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const data = JSON.parse(text.slice(start, end + 1));
    if (data.status === "error" || !data.table) throw new Error("Invalid upstream response");
    return new Response(JSON.stringify({ table: data.table }), { headers });
  } catch (_) {
    return new Response(JSON.stringify({ error: "Catalog temporarily unavailable" }), { status: 503, headers });
  }
};

export const config = { path: "/api/catalog" };
