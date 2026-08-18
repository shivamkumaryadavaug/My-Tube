// MyTube service worker
// Caches static assets (icons, css, js) for offline speed.
// Deliberately does NOT cache HTML pages (login, register, dashboard, study mode)
// so logged-in/dynamic content is always fetched fresh from the network.

const CACHE_NAME = "mytube-static-v1";
const STATIC_ASSETS = [
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/logo.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests for same-origin static assets.
  const isStaticAsset =
    event.request.method === "GET" &&
    url.origin === self.location.origin &&
    STATIC_ASSETS.some((path) => url.pathname === path);

  if (!isStaticAsset) {
    return; // let the browser handle everything else normally (network)
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});
