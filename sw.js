/**
 * AgroSat Brasil — Service Worker (PWA)
 * Cache básico de assets estáticos para uso offline parcial.
 * Dados de clima/mapa exigem conexão (não são cacheados).
 */
const CACHE_NAME = "agrosat-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/firebase.js",
  "./js/map.js",
  "./js/ai.js",
  "./js/app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Não cacheia chamadas de API (clima, geocodificação, tiles de mapa)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
