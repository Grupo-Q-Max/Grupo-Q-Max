const CACHE_NAME = "finora-propostas-v4";
const ASSETS_TO_CACHE = [
  "/proposta/index.html",
  "/proposta/styles.css",
  "/proposta/script.js",
  "/proposta/dashboard.html",
  "/proposta/crm.html",
  "/proposta/prospeccao.html"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Ignorar chamadas de API para manter dados em tempo real; cache só serve GET
  if (e.request.url.includes("/api/") || e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request).catch(() =>
      // Sem cache para o recurso: Response.error() deixa o navegador mostrar a falha de rede
      // (respondWith(undefined) quebrava a requisição com erro do próprio service worker)
      caches.match(e.request).then((emCache) => emCache || Response.error())
    )
  );
});
