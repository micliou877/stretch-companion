const CACHE = "sfc-v1";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((r) => { try { cache.put(e.request, r.clone()); } catch (_) {} return r; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
