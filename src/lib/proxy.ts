/**
 * Scramjet v2 Proxy Engine with Epoxy & Libcurl BareMux Transports.
 * Browser-only: every function here must be called from an effect or event handler.
 */

export const SCRAMJET_PREFIX = "/~/scramjet/";
export const DEFAULT_WISP = "wss://wisp.mercurywork.shop/";

export type ProxyEngine = "scramjet";
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
 * Automatically determines optimal transport (Libcurl vs Epoxy) for the URL
 */
export function getAutoTransportForUrl(_targetUrl?: string): ProxyTransport {
  // Epoxy transport uses Rustls and native browser fetch streams,
  // preventing WASM memory overflows and SSL certificate error 60 during media streaming.
  return "epoxy";
}

/** Returns the routed Scramjet v2 proxy URL for any given target URL */
export function getProxyUrl(targetUrl: string): string {
  return `${SCRAMJET_PREFIX}${encodeURIComponent(targetUrl)}`;
}

type AnyRecord = Record<string, unknown>;
type RawHeaders = [string, string][];

interface BareMuxWorkerRef {
  sendMessage: (msg: AnyRecord, xfers?: unknown[]) => Promise<AnyRecord>;
}

interface BareMuxFetchResult {
  fetch: {
    body: ReadableStream | ArrayBuffer | Blob | string;
    headers: Record<string, string> | RawHeaders;
    status: number;
    statusText: string;
  };
}

export interface ScramjetProxyTransport {
  ready: boolean;
  init: () => Promise<void>;
  request: (
    remote: URL,
    method: string,
    body: BodyInit | null,
    headers: RawHeaders,
    signal: AbortSignal | undefined,
  ) => Promise<{
    body: ReadableStream | ArrayBuffer | Blob | string;
    headers: RawHeaders;
    status: number;
    statusText: string;
  }>;
  connect: (
    url: URL,
    protocols: string[],
    requestHeaders: RawHeaders,
    onopen: (protocol: string, extensions?: string) => void,
    onmessage: (data: Blob | ArrayBuffer | string) => void,
    onclose: (code: number, reason: string) => void,
    onerror: (error: string) => void,
  ) => [(data: Blob | ArrayBuffer | string) => void, (code: number, reason: string) => void];
}

let scriptPromise: Promise<void> | null = null;
let controllerPromise: Promise<AnyRecord> | null = null;
let activeControllerInstance: AnyRecord | null = null;
let currentWisp = "";
let currentTransport = "";
let connection: AnyRecord | null = null;
let activeTransportAdapter: ScramjetProxyTransport | null = null;

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
      // Load Scramjet v2 runtime bundle then Controller API
      await loadScript("/proxy/scramjet_bundled.js");
      await loadScript("/proxy/controller.api.js");
    })();
  }
  await scriptPromise;
}

/** Normalizes any headers representation (object, entries array, Headers) to [string, string][] */
function normalizeRawHeaders(headers: unknown): RawHeaders {
  if (!headers) return [];
  if (Array.isArray(headers)) {
    const result: RawHeaders = [];
    for (const entry of headers) {
      if (Array.isArray(entry) && entry.length >= 2) {
        result.push([String(entry[0]), String(entry[1])]);
      }
    }
    return result;
  }
  if (typeof headers === "object") {
    const entries: RawHeaders = [];
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          entries.push([String(k), String(item)]);
        }
      } else if (v !== undefined && v !== null) {
        entries.push([String(k), String(v)]);
      }
    }
    return entries;
  }
  return [];
}

/** Creates a bridge adapter connecting BareMux / Epoxy / Libcurl to Scramjet v2 */
function createTransportAdapter(
  wispUrl: string,
  preferred: ProxyTransport,
): ScramjetProxyTransport {
  const normalizedWisp = wispUrl.endsWith("/") ? wispUrl : `${wispUrl}/`;

  return {
    ready: true,
    async init() {
      // noop
    },
    async request(remote, method, body, rawHeaders, _signal) {
      if (!connection) {
        throw new Error("BareMux transport connection not initialized");
      }
      const worker = (connection as { worker?: BareMuxWorkerRef }).worker;
      if (!worker || typeof worker.sendMessage !== "function") {
        throw new Error("BareMux worker connection unavailable");
      }

      const rawNormalized = normalizeRawHeaders(rawHeaders);
      const targetHost = remote.host || remote.hostname;
      const targetOrigin = remote.origin;

      const filteredHeaders: RawHeaders = [];
      for (const [key, value] of rawNormalized) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === "host") {
          // Skip proxy domain host header
          continue;
        }
        if (lowerKey === "origin") {
          if (value.includes(location.host) || value.includes(location.hostname)) {
            filteredHeaders.push(["Origin", targetOrigin]);
          } else {
            filteredHeaders.push([key, value]);
          }
          continue;
        }
        if (lowerKey === "referer") {
          if (value.includes(SCRAMJET_PREFIX)) {
            try {
              const idx = value.indexOf(SCRAMJET_PREFIX);
              const encodedTarget = value.substring(idx + SCRAMJET_PREFIX.length);
              const decoded = decodeURIComponent(encodedTarget);
              filteredHeaders.push(["Referer", decoded]);
            } catch {
              filteredHeaders.push(["Referer", targetOrigin]);
            }
          } else if (value.includes(location.host) || value.includes(location.hostname)) {
            filteredHeaders.push(["Referer", targetOrigin]);
          } else {
            filteredHeaders.push([key, value]);
          }
          continue;
        }
        filteredHeaders.push([key, value]);
      }

      if (targetHost) {
        filteredHeaders.push(["Host", targetHost]);
      }

      let lastError: unknown = null;
      const attemptedWispServers: string[] = [normalizedWisp];
      let activePreferredTransport: ProxyTransport = preferred;

      // Retry with alternative transports (Libcurl fallback for cert errors) and Wisp relays
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await worker.sendMessage({
            type: "fetch",
            fetch: {
              remote: remote.toString(),
              method: method || "GET",
              headers: filteredHeaders,
              body: body || undefined,
            },
          });

          const fetchResult = (res as unknown as BareMuxFetchResult).fetch;
          const formattedHeaders: RawHeaders = normalizeRawHeaders(fetchResult.headers);

          return {
            body: fetchResult.body,
            headers: formattedHeaders,
            status: fetchResult.status || 200,
            statusText: fetchResult.statusText || "OK",
          };
        } catch (err: unknown) {
          lastError = err;
          const errStr = String((err as { message?: string })?.message || err);
          console.warn(`[ProxyTransport] Fetch attempt ${attempt + 1} failed: ${errStr}`);

          // When Epoxy encounters InvalidCertificate / UnknownIssuer, switch to Libcurl transport
          if (activePreferredTransport === "epoxy") {
            activePreferredTransport = "libcurl";
          } else {
            activePreferredTransport = "epoxy";
          }

          const nextCandidate = WISP_SERVERS.find(
            (s) => !attemptedWispServers.some((a) => a.includes(s.url) || s.url.includes(a)),
          );

          if (attempt < 2) {
            const nextWisp = nextCandidate ? nextCandidate.url : normalizedWisp;
            if (nextCandidate) {
              attemptedWispServers.push(nextCandidate.url);
            }
            try {
              await ensureTransport(nextWisp, activePreferredTransport);
            } catch {
              // ignore
            }
          } else {
            break;
          }
        }
      }

      const errStr = String(
        (lastError as { message?: string })?.message || lastError || "Connection error",
      );

      const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proxy Connection Notice</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .box { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; max-width: 520px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center; }
    .icon { width: 48px; height: 48px; margin: 0 auto 16px; color: #a1a1aa; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px 0; color: #f4f4f5; }
    p { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 20px 0; }
    .err-code { background: #09090b; border: 1px solid #27272a; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #f87171; margin-bottom: 24px; word-break: break-all; text-align: left; }
    .btn-group { display: flex; gap: 12px; justify-content: center; }
    button { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
    button:hover { background: #1d4ed8; }
    button.secondary { background: #27272a; color: #f4f4f5; }
    button.secondary:hover { background: #3f3f46; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">🌐</div>
    <h1>Connection Notice</h1>
    <p>The proxy transport could not reach the target server. Click below to try reconnecting.</p>
    <div class="err-code">${errStr}</div>
    <div class="btn-group">
      <button onclick="window.location.reload()">Retry Connection</button>
      <button class="secondary" onclick="window.history.back()">Go Back</button>
    </div>
  </div>
</body>
</html>`;

      return {
        body: errorHtml,
        headers: [["Content-Type", "text/html; charset=utf-8"]],
        status: 502,
        statusText: "Bad Gateway",
      };
    },
    connect(url, protocols, rawHeaders, onopen, onmessage, onclose, onerror) {
      if (!connection) {
        onerror("BareMux connection not initialized");
        return [() => {}, () => {}];
      }
      const worker = (connection as { worker?: BareMuxWorkerRef }).worker;
      if (!worker || typeof worker.sendMessage !== "function") {
        onerror("BareMux worker unavailable");
        return [() => {}, () => {}];
      }

      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        const msg = e.data;
        if (!msg) return;
        if (msg.type === "open") {
          onopen(msg.args?.[0] || "", msg.args?.[1] || "");
        } else if (msg.type === "message") {
          onmessage(msg.args?.[0]);
        } else if (msg.type === "close") {
          onclose(msg.args?.[0] || 1000, msg.args?.[1] || "Normal Closure");
        } else if (msg.type === "error") {
          onerror(msg.error || "WebSocket connection failed");
        }
      };

      const rawNormalized = normalizeRawHeaders(rawHeaders);
      const targetHost = url.host || url.hostname;
      const filteredHeaders: RawHeaders = [];
      for (const [key, value] of rawNormalized) {
        if (key.toLowerCase() !== "host") {
          filteredHeaders.push([key, value]);
        }
      }
      if (targetHost) {
        filteredHeaders.push(["Host", targetHost]);
      }

      worker.sendMessage(
        {
          type: "websocket",
          websocket: {
            url: url.toString(),
            protocols: protocols || [],
            requestHeaders: filteredHeaders,
            channel: channel.port2,
          },
        },
        [channel.port2],
      );

      const send = (data: Blob | ArrayBuffer | string) => {
        let payload = data;
        if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(payload)) {
          payload = payload.buffer.slice(
            payload.byteOffset,
            payload.byteOffset + payload.byteLength,
          );
        }
        channel.port1.postMessage(
          { type: "data", data: payload },
          payload instanceof ArrayBuffer ? [payload] : [],
        );
      };

      const close = (code: number, reason: string) => {
        channel.port1.postMessage({ type: "close", closeCode: code, closeReason: reason });
      };

      return [send, close];
    },
  };
}

/** Configures BareMux transport using Epoxy or Libcurl with auto-fallback */
export async function ensureTransport(wisp?: string, preferredTransport?: ProxyTransport) {
  const selectedWisp = wisp || DEFAULT_WISP;
  const normalizedWisp = selectedWisp.endsWith("/") ? selectedWisp : `${selectedWisp}/`;
  const transportKey = `${preferredTransport || "auto"}:${normalizedWisp}`;

  if (currentWisp === normalizedWisp && currentTransport === transportKey && connection) {
    return activeTransportAdapter;
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

  // Loader code that loads Libcurl & Epoxy seamlessly
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

  await setManualTransport.call(connection, loaderCode, [
    { wisp: normalizedWisp, disable_certificate_validation: true },
  ]);
  currentWisp = normalizedWisp;
  currentTransport = transportKey;

  activeTransportAdapter = createTransportAdapter(normalizedWisp, preferredTransport || "epoxy");

  if (activeControllerInstance && typeof activeControllerInstance["setTransport"] === "function") {
    try {
      (activeControllerInstance["setTransport"] as (t: ScramjetProxyTransport) => void).call(
        activeControllerInstance,
        activeTransportAdapter,
      );
    } catch {
      // Ignore
    }
  }

  return activeTransportAdapter;
}

/** Boots Scramjet v2 Controller + Service Worker + BareMux Transports (Epoxy/Libcurl). */
export async function initProxy(wisp?: string, targetUrl?: string): Promise<AnyRecord | null> {
  await ensureScripts();

  const activeWisp = wisp || getAutoWispForUrl(targetUrl);
  const preferredTransport = getAutoTransportForUrl(targetUrl);
  const transport = await ensureTransport(activeWisp, preferredTransport);

  if (!controllerPromise) {
    controllerPromise = (async () => {
      let swReg: ServiceWorkerRegistration | null = null;
      if ("serviceWorker" in navigator) {
        swReg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          // The page is not controlled yet. Reload once to activate the Service Worker interception immediately.
          window.location.reload();
          await new Promise(() => {}); // pause execution
        }
      }

      let controllerInstance: AnyRecord | null = null;
      try {
        const sjControllerModule = (window as unknown as AnyRecord)["$scramjetController"] as
          | {
              Controller: new (init: AnyRecord) => AnyRecord;
            }
          | undefined;

        if (sjControllerModule && typeof sjControllerModule.Controller === "function") {
          const swActive = navigator.serviceWorker.controller || swReg?.active;
          const controller = new sjControllerModule.Controller({
            serviceworker: swActive,
            transport: transport || activeTransportAdapter,
            config: {
              prefix: SCRAMJET_PREFIX,
              scramjetPath: "/proxy/scramjet.js",
              injectPath: "/proxy/controller.inject.js",
              wasmPath: "/proxy/scramjet.wasm",
              virtualWasmPath: "scramjet.wasm.js",
              codec: {
                encode: (url: string) => (!url ? url : encodeURIComponent(url)),
                decode: (url: string) => (!url ? url : decodeURIComponent(url)),
              },
            },
          });
          controllerInstance = controller;
          activeControllerInstance = controller;
        }
      } catch (err) {
        console.warn("Scramjet v2 Controller init notice:", err);
      }

      return controllerInstance || {};
    })();
  }

  const controller = await controllerPromise;
  if (controller && transport && typeof controller["setTransport"] === "function") {
    try {
      (controller["setTransport"] as (t: ScramjetProxyTransport) => void).call(
        controller,
        transport,
      );
    } catch {
      // Ignore
    }
  }

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
