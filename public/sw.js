/* eslint-disable no-undef */
importScripts("/proxy/baremux-worker.js");
importScripts("/proxy/controller.sw.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isProxyPath = url.pathname.startsWith("/~/scramjet/");
  const controller =
    typeof $scramjetController !== "undefined" ? $scramjetController : self.$scramjetController;
  if (controller) {
    const shouldRoute = isProxyPath || (typeof controller.shouldRoute === "function" && controller.shouldRoute(event));
    if (shouldRoute && typeof controller.route === "function") {
      event.respondWith(controller.route(event));
      return;
    }
  }
});
