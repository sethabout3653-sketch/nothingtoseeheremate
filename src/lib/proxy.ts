/**
 * Multi-Engine Proxy Bootstrap (Ultraviolet & Scramjet with Epoxy & Libcurl).
 * Browser-only: every function here must be called from an effect or event handler.
 */

export const UV_PREFIX = "/~/uv/";
export const SCRAMJET_PREFIX = "/~/scramjet/";
export const DEFAULT_WISP = "wss://wisp.mercurywork.shop/";

export type ProxyEngine = "ultraviolet" | "scramjet";
export type ProxyTransport = "epoxy" | "libcurl";

/** Alternates to fall back on when one relay refuses a site */
export const WISP_SERVERS = [
  { name: "Mercury", url: "wss://wisp.mercurywork.shop/" },
  { name: "TitaniumNetwork", url: "wss://wisp.terbiumon.top/wisp/" },
  { name: "Nebula", url: "wss://anura.pro/" },
  { name: "Ruby", url: "wss://ruby.rubynetwork.co/wisp/" },
  { name: "Rhodium", url: "wss://wisp.rhw.one/" },
  { name: "Shadow", url: "wss://shadow.freewisp.org/wisp/" },
] as const;

/** XOR Codec for Ultraviolet URL encoding */
export function encodeUv(url: string): string {
  if (!url) return "";
  return encodeURIComponent(
    url
      .toString()
      .split("")
      .map((char, ind) => (ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
      .join(""),
  );
}

/** XOR Codec for Ultraviolet URL decoding */
export function decodeUv(encoded: string): string {
  if (!encoded) return "";
  const [input, ...search] = encoded.split("?");
  return (
    decodeURIComponent(input || "")
      .split("")
      .map((char, ind) => (ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
      .join("") + (search.length ? "?" + search.join("?") : "")
  );
}

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
    // Fast hash-based deterministic load balancing across reliable relays
    let hash = 0;
    for (let i = 0; i < host.length; i++) {
      hash = (hash << 5) - hash + host.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % WISP_SERVERS.length;
    return WISP_SERVERS[index]?.url || DEFAULT_WISP;
  } catch {
    return DEFAULT_WISP;
  }
}

/**
 * Automatically chooses the best proxy engine (Ultraviolet vs Scramjet)
 * based on target domain, feature capabilities, and runtime heuristics.
 */
export function getAutoEngineForUrl(targetUrl?: string): ProxyEngine {
  if (!targetUrl) return "ultraviolet";
  try {
    const raw = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    // WASM game heavy engines or canvas-heavy sites that benefit from Scramjet
    if (
      host.includes("scratch.mit.edu") ||
      host.includes("turbowarp.org") ||
      host.includes("poki.com") ||
      host.includes("coolmathgames.com") ||
      host.includes("armorgames.com") ||
      host.includes("newgrounds.com")
    ) {
      return "scramjet";
    }

    // Default to Ultraviolet for rich SPAs, video streaming, search engines, and general web
    return "ultraviolet";
  } catch {
    return "ultraviolet";
  }
}

/**
 * Automatically determines optimal transport (Libcurl vs Epoxy) for the URL
 */
export function getAutoTransportForUrl(targetUrl?: string): ProxyTransport {
  if (!targetUrl) return "epoxy";
  try {
    const raw = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
    const host = new URL(raw).hostname.toLowerCase();
    // Video and audio streaming perform exceptionally well with Libcurl transport
    if (
      host.includes("youtube") ||
      host.includes("twitch") ||
      host.includes("spotify") ||
      host.includes("soundcloud") ||
      host.includes("tiktok")
    ) {
      return "libcurl";
    }
    return "epoxy";
  } catch {
    return "epoxy";
  }
}

/** Returns the routed proxy URL for any given engine and target URL */
export function getProxyUrl(targetUrl: string, engine?: ProxyEngine): string {
  const chosenEngine = engine || getAutoEngineForUrl(targetUrl);
  if (chosenEngine === "ultraviolet") {
    return `${UV_PREFIX}${encodeUv(targetUrl)}`;
  }
  return `${SCRAMJET_PREFIX}${encodeURIComponent(targetUrl)}`;
}

type AnyRecord = Record<string, unknown>;

let scriptPromise: Promise<void> | null = null;
let controllerPromise: Promise<AnyRecord> | null = null;
let currentWisp = "";
let currentTransport = "";
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
  if (!scriptPromise) {
    scriptPromise = (async () => {
      try {
        await loadScript("/uv/uv.bundle.js");
      } catch (err) {
        console.warn("UV bundle load notice:", err);
      }
      try {
        await loadScript("/uv/uv.config.js");
      } catch (err) {
        console.warn("UV config load notice:", err);
      }
      try {
        await loadScript("/proxy/scramjet.all.js");
      } catch (err) {
        console.warn("Scramjet script load notice:", err);
      }
    })();
  }
  await scriptPromise;
}

/** Configures BareMux transport using Epoxy or Libcurl with auto-fallback */
export async function ensureTransport(wisp?: string, preferredTransport?: ProxyTransport) {
  const selectedWisp = wisp || DEFAULT_WISP;
  const normalizedWisp = selectedWisp.endsWith("/") ? selectedWisp : `${selectedWisp}/`;
  const transportKey = `${preferredTransport || "auto"}:${normalizedWisp}`;

  if (currentWisp === normalizedWisp && currentTransport === transportKey && connection) {
    return;
  }

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

  // Loader code that tries Libcurl & Epoxy seamlessly
  const prioritizeLibcurl = preferredTransport === "libcurl";
  const loaderCode = `
    const isLibcurlFirst = ${prioritizeLibcurl};
    const libcurlSources = [
      "${location.origin}/proxy/libcurl.mjs",
      "/proxy/libcurl.mjs",
      "https://cdn.jsdelivr.net/npm/@mercuryworkshop/libcurl-transport@2.0.5/dist/index.mjs",
      "https://unpkg.com/@mercuryworkshop/libcurl-transport/dist/index.mjs"
    ];
    const epoxySources = [
      "${location.origin}/proxy/epoxy.mjs",
      "/proxy/epoxy.mjs",
      "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@3.0.1/dist/index.mjs",
      "https://unpkg.com/@mercuryworkshop/epoxy-transport/dist/index.mjs"
    ];

    const orderedSources = isLibcurlFirst
      ? [...libcurlSources, ...epoxySources]
      : [...epoxySources, ...libcurlSources];

    let lastError;
    for (const src of orderedSources) {
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
  currentTransport = transportKey;
}

/** Boots Ultraviolet & Scramjet + the service worker + transport. Idempotent. */
export async function initProxy(wisp?: string, targetUrl?: string): Promise<AnyRecord | null> {
  await ensureScripts();

  if (!controllerPromise) {
    controllerPromise = (async () => {
      let controller: AnyRecord | null = null;
      try {
        const loader = (window as unknown as AnyRecord)["$scramjetLoadController"] as
          | (() => {
              ScramjetController: new (config: AnyRecord) => AnyRecord;
            })
          | undefined;
        if (loader) {
          const { ScramjetController } = loader();
          const sj = new ScramjetController({
            prefix: SCRAMJET_PREFIX,
            files: {
              wasm: "/proxy/scramjet.wasm.wasm",
              all: "/proxy/scramjet.all.js",
              sync: "/proxy/scramjet.sync.js",
            },
          });
          await (sj["init"] as () => Promise<void>).call(sj);
          controller = sj;
        }
      } catch (err) {
        console.warn("Scramjet controller init notice:", err);
      }

      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      }
      return controller || {};
    })();
  }

  const controller = await controllerPromise;
  const activeWisp = wisp || getAutoWispForUrl(targetUrl);
  const preferredTransport = getAutoTransportForUrl(targetUrl);
  await ensureTransport(activeWisp, preferredTransport);
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
  { name: "Google", url: "https://www.google.com/search?q=%s", host: "google.com" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s", host: "duckduckgo.com" },
  { name: "Bing", url: "https://www.bing.com/search?q=%s", host: "bing.com" },
] as const;

export function faviconFor(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}
