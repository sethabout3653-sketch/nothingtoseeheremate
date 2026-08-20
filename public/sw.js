importScripts("/proxy/baremux-worker.js");
importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts("/uv/uv.sw.js");
importScripts("/proxy/scramjet.all.js");

const uv = new self.UVServiceWorker();
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      try {
        const url = event.request.url;
        // 1. Ultraviolet routing
        if (url.startsWith(location.origin + self.__uv$config.prefix)) {
          return await uv.fetch(event);
        }
        // 2. Scramjet routing
        await scramjet.loadConfig();
        if (scramjet.route(event)) {
          return await scramjet.fetch(event);
        }
      } catch (err) {
        console.error("SW routing error:", err);
      }
      return await fetch(event.request);
    })(),
  );
});
