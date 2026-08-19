/**
 * Scramjet proxy bootstrap. Browser-only: every function here must be called
 * from an effect or an event handler, never during render/SSR.
 */

export const SCRAMJET_PREFIX = "/~/scramjet/";
export const DEFAULT_WISP = "wss://wisp.mercurywork.shop/";

/** Alternates to fall back on when one relay refuses a site (TLS handshake eof). */
export const WISP_SERVERS = [
  { name: "Mercury", url: "wss://wisp.mercurywork.shop/" },
  { name: "TitaniumNetwork", url: "wss://wisp.terbiumon.top/wisp/" },
  { name: "Nebula", url: "wss://anura.pro/" },
  { name: "Ruby", url: "wss://ruby.rubynetwork.co/wisp/" },
  { name: "Rhodium", url: "wss://wisp.rhw.one/" },
  { name: "Shadow", url: "wss://shadow.freewisp.org/wisp/" },
] as const;

/** Automatically selects the best Wisp relay based on the target URL */
export function getAutoWispForUrl(targetUrl?: string): string {
  if (!targetUrl) return DEFAULT_WISP;
  try {
    const raw = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    // High bandwidth / media & streaming domains
    if (
      host.includes("youtube") ||
      host.includes("twitch") ||
      host.includes("vimeo") ||
      host.includes("spotify") ||
      host.includes("soundcloud") ||
      host.includes("discord")
    ) {
      return "wss://wisp.mercurywork.shop/";
    }
    // Search engines & dynamic query APIs
    if (
      host.includes("duckduckgo") ||
      host.includes("google") ||
      host.includes("bing") ||
      host.includes("brave") ||
      host.includes("yahoo") ||
      host.includes("wikipedia")
    ) {
      return "wss://wisp.terbiumon.top/wisp/";
    }
    // Gaming & interactive WASM portals
    if (
      host.includes("github") ||
      host.includes("itch.io") ||
      host.includes("crazygames") ||
      host.includes("poki") ||
      host.includes("coolmathgames") ||
      host.includes("now.gg") ||
      host.includes("roblox")
    ) {
      return "wss://anura.pro/";
    }
    // Fast hash-based deterministic load balancing across reliable relays for general web
    let hash = 0;
    for (let i = 0; i < host.length; i++) {
      hash = (hash << 5) - hash + host.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % WISP_SERVERS.length;
    return WISP_SERVERS[index].url;
  } catch {
    return DEFAULT_WISP;
  }
}

type AnyRecord = Record<string, unknown>;

let scriptPromise: Promise<void> | null = null;
let controllerPromise: Promise<AnyRecord> | null = null;
let currentWisp = "";
let connection: AnyRecord | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.dataset["src"] = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

async function ensureScripts() {
  if (!scriptPromise) scriptPromise = loadScript("/proxy/scramjet.all.js");
  await scriptPromise;
}

export async function ensureTransport(wisp?: string) {
  const selectedWisp = wisp || DEFAULT_WISP;
  const normalizedWisp = selectedWisp.endsWith("/") ? selectedWisp : `${selectedWisp}/`;
  if (currentWisp === normalizedWisp && connection) return;
  const dynamicImport = new Function("p", "return import(p)") as (p: string) => Promise<AnyRecord>;
  let mod: AnyRecord;
  try {
    mod = await dynamicImport(`${location.origin}/proxy/baremux.mjs`);
  } catch {
    mod = await dynamicImport(
      "https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux/dist/index.mjs",
    );
  }
  const BareMuxConnection = mod["BareMuxConnection"] as new (worker: string) => AnyRecord;
  if (!connection) {
    connection = new BareMuxConnection(`${location.origin}/proxy/baremux-worker.js`);
  }
  const setManualTransport = connection["setManualTransport"] as (
    code: string,
    options: unknown[],
  ) => Promise<void>;

  const loaderCode = `
    const sources = [
      "${location.origin}/proxy/epoxy.mjs",
      "/proxy/epoxy.mjs",
      "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@3.0.1/dist/index.mjs",
      "https://unpkg.com/@mercuryworkshop/epoxy-transport/dist/index.mjs",
      "${location.origin}/proxy/libcurl.mjs",
      "/proxy/libcurl.mjs",
      "https://cdn.jsdelivr.net/npm/@mercuryworkshop/libcurl-transport@2.0.5/dist/index.mjs",
      "https://unpkg.com/@mercuryworkshop/libcurl-transport/dist/index.mjs"
    ];
    let lastError;
    for (const src of sources) {
      try {
        const mod = await import(src);
        const BareTransport = mod.default || mod.EpoxyTransport || mod.LibcurlTransport || mod.BareTransport;
        if (BareTransport) {
          return [BareTransport, src];
        }
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error("Failed to load BareTransport (Epoxy/Libcurl) from all available sources");
  `;

  await setManualTransport.call(connection, loaderCode, [{ wisp: normalizedWisp }]);
  currentWisp = normalizedWisp;
}

/** Boots Scramjet + the service worker + the wisp transport. Idempotent. */
export async function initProxy(wisp?: string, targetUrl?: string): Promise<AnyRecord> {
  await ensureScripts();

  if (!controllerPromise) {
    controllerPromise = (async () => {
      const loader = (window as unknown as AnyRecord)["$scramjetLoadController"] as () => {
        ScramjetController: new (config: AnyRecord) => AnyRecord;
      };
      const { ScramjetController } = loader();
      const controller = new ScramjetController({
        prefix: SCRAMJET_PREFIX,
        files: {
          wasm: "/proxy/scramjet.wasm.wasm",
          all: "/proxy/scramjet.all.js",
          sync: "/proxy/scramjet.sync.js",
        },
      });
      await (controller["init"] as () => Promise<void>).call(controller);
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      }
      return controller;
    })();
  }

  const controller = await controllerPromise;
  const activeWisp = wisp || getAutoWispForUrl(targetUrl);
  await ensureTransport(activeWisp);
  return controller;
}

/** Turns whatever the user typed into a real URL. */
export function toUrl(input: string, engine: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const looksLikeHost =
    /^[^\s./]+(\.[^\s./]+)+(\/.*)?$/.test(value) || value.startsWith("localhost");
  if (looksLikeHost) return `https://${value}`;
  return engine.replace("%s", encodeURIComponent(value));
}

export const SEARCH_ENGINES = [
  { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s", host: "duckduckgo.com" },
  { name: "Google", url: "https://www.google.com/search?q=%s", host: "google.com" },
  { name: "Bing", url: "https://www.bing.com/search?q=%s", host: "bing.com" },
] as const;
