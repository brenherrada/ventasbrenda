import type { Config, Context } from "@netlify/edge-functions";

function categoryMetadata() {
  return {
    "cocina": ["Cocina", "Utensilios, cacerolas y electrodomésticos de cocina."],
    "deco-textiles": ["Deco & textiles", "Decoración, acolchados y textiles para tu hogar."],
    "muebles-organizacion": ["Muebles & organización", "Muebles y accesorios para organizar tus espacios."],
    "hogar-exterior": ["Hogar & exterior", "Artículos para la casa y para disfrutar al aire libre."],
    "cuidado-personal": ["Cuidado personal", "Artículos de cuidado personal y belleza."],
    "tarot-oraculos": ["Tarot & oráculos", "Mazos de tarot y oráculos para tus lecturas."],
    "libros": ["Libros", "Novelas y libros de astrología, tarot y espiritualidad."],
    "ropa-calzado": ["Ropa & Calzado", "Ropa y calzado de la venta por mudanza."],
  } as Record<string, [string, string]>;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async (request: Request, context: Context) => {
  const rawCategory = new URL(request.url).searchParams.get("categoria");
  if (!rawCategory || request.method !== "GET") return;
  const slug = rawCategory.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const categories = categoryMetadata();
  if (!Object.hasOwn(categories, slug)) return;
  const category = categories[slug];

  const response = await context.next({ sendConditionalRequest: false });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
  const [name, summary] = category;
  const title = `${name} · Venta por mudanza en Mar del Plata`;
  const description = `${summary} Venta local en Mar del Plata. Entregas únicamente en Mar del Plata.`;
  const url = `https://ventasbrenda.netlify.app/?categoria=${slug}`;
  const image = `https://ventasbrenda.netlify.app/images/social/${slug}-v1.jpg`;
  const replacements: Record<string, string> = {
    "description": description,
    "og:title": title,
    "og:description": description,
    "og:url": url,
    "og:image": image,
    "og:image:secure_url": image,
    "og:image:alt": `${name} · Venta por mudanza en Mar del Plata`,
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": image,
  };
  let html = await response.text();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(title)}</title>`);
  html = html.replace(/<meta (name|property)="([^"]+)" content="[^"]*"\s*\/>/g,
    (tag, attribute, key) => replacements[key] === undefined ? tag
      : `<meta ${attribute}="${key}" content="${escapeAttribute(replacements[key])}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${escapeAttribute(url)}" />`);

  const headers = new Headers(response.headers);
  for (const header of ["content-length", "content-encoding", "etag", "last-modified"]) headers.delete(header);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Netlify-CDN-Cache-Control", "no-store");
  // Edge responses must also carry the site's existing security headers.
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://docs.google.com; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests");
  return new Response(html, { status: response.status, headers });
};

export const config: Config = { path: ["/", "/index.html"] };
