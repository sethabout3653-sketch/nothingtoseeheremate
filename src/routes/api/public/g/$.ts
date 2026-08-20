import { createFileRoute } from "@tanstack/react-router";

const CDNS = [
  "https://cdn.jsdelivr.net/gh/freebuisness/html@main",
  "https://raw.githubusercontent.com/freebuisness/html/main",
  "https://rawcdn.githack.com/freebuisness/html/main",
  "https://fastly.jsdelivr.net/gh/freebuisness/html@main",
  "https://cdn.jsdelivr.net/gh/selenite-cc/selenite-old@main",
];
const PREFIX = "/api/public/g";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  wasm: "application/wasm",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  swf: "application/x-shockwave-flash",
  zip: "application/zip",
  data: "application/octet-stream",
  unityweb: "application/octet-stream",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
  atlas: "text/plain; charset=utf-8",
};

function contentType(path: string) {
  const ext = path.split("?")[0]!.split("#")[0]!.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

/** Games assume a full-window document; iframes need the sizing made explicit. */
const FIT_CSS =
  "<style>html,body{height:100%;width:100%;margin:0;padding:0;overflow:hidden;background:#000}" +
  "body>div,body>canvas,body>embed,body>object,body>iframe,#ruffle,#player,ruffle-player" +
  "{width:100%!important;height:100%!important}</style>";

/** Rewrites root-relative references so nested assets stay inside the proxy. */
function rewriteHtml(html: string, dir: string) {
  let out = html.replace(/(src|href|data|action)\s*=\s*(["'])\/(?!\/)/gi, `$1=$2${PREFIX}/`);
  out = out.replace(/(url\()\s*(["']?)\/(?!\/)/gi, `$1$2${PREFIX}/`);
  const base = `<base href="${PREFIX}/${dir}${dir ? "/" : ""}">`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${base}`);
    out = out.replace(/<\/head>/i, `${FIT_CSS}</head>`);
  } else {
    out = `${base}${FIT_CSS}${out}`;
  }
  return out;
}

export const Route = createFileRoute("/api/public/g/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const clean = splat.replace(/^\/+/, "");
        if (!clean || clean.includes("..")) {
          return new Response("Bad path", { status: 400 });
        }

        const search = new URL(request.url).search;
        let upstream: Response | null = null;
        for (const cdn of CDNS) {
          try {
            const res = await fetch(`${cdn}/${clean}${search}`, {
              headers: { "user-agent": "Mozilla/5.0" },
            });
            if (res.ok) {
              upstream = res;
              break;
            }
          } catch {
            /* try next cdn */
          }
        }

        if (!upstream || !upstream.ok) {
          return new Response("Not found", { status: upstream?.status ?? 404 });
        }

        const type = contentType(clean);
        const headers = new Headers({
          "content-type": type,
          "cache-control": "public, max-age=3600",
        });

        if (type.startsWith("text/html")) {
          const dir = clean.split("/").slice(0, -1).join("/");
          return new Response(rewriteHtml(await upstream.text(), dir), { headers });
        }

        return new Response(upstream.body, { headers });
      },
    },
  },
});
