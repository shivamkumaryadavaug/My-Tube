/* MyTube PWA service worker — app shell + offline fallback */
const CACHE_NAME = "mytube-pwa-v3";
const APP_SHELL = [
  "./", "./index.html", "./login.html", "./register.html", "./dashboard.html",
  "./library.html", "./playlist.html", "./study.html", "./progress.html",
  "./channel.html", "./settings.html", "./add-content.html", "./offline.html",
  "./manifest.json", "./assets/logo.svg",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png", "./assets/icons/icon-512-maskable.png",
  "./css/style.css", "./css/dashboard.css", "./css/library.css", "./css/study.css",
  "./css/progress.css", "./css/premium-ui.css",
  "./js/app.js", "./js/api.js", "./js/dashboard.js", "./js/library.js", "./js/playlist.js",
  "./js/study.js", "./js/progress.js", "./js/channel.js", "./js/login.js", "./js/register.js", "./js/add-content.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) || (await caches.match("./offline.html"));
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(response => {
    if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
