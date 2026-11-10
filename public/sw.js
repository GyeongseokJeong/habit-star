const CACHE = "byeolharu-shell-v4";
const SHELL = "/offline";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([
        "/icon.svg",
        "/icon-192.png",
        "/icon-512.png",
        "/noto-color-emoji-colr.woff2",
      ]);
      const response = await fetch(SHELL, {
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Offline shell unavailable");
      const html = await response.clone().text();
      await cache.put(SHELL, response);
      // Pre-cache this static shell's scripts/styles too; caching HTML alone cannot boot offline.
      const assets = [...html.matchAll(/(?:src|href)="([^"\s]+)"/g)]
        .map((match) => match[1].replaceAll("&amp;", "&"))
        .filter((path) => path.startsWith("/_next/static/"));
      await cache.addAll([...new Set(assets)]);
    })(),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("byeolharu-shell-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (url.pathname.startsWith("/auth") || url.pathname.startsWith("/api"))
    return;
  if (
    event.request.mode === "navigate" &&
    ["/", SHELL].includes(url.pathname) &&
    !url.search
  ) {
    // Never cache session-bearing navigation responses.
    event.respondWith(
      fetch(event.request).catch(
        async () => (await caches.match(SHELL)) || Response.error(),
      ),
    );
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/noto-color-emoji-colr.woff2" ||
    /^\/icon[\w-]*\.(png|svg)$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })(),
    );
  }
});
