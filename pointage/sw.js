// Service worker de mise en cache pour un usage hors-ligne du carnet de pointage.
// Les données (salariés, pointages...) restent dans localStorage, donc déjà disponibles hors-ligne.
//
// Stratégie : la page de l'appli est toujours récupérée sur le réseau en priorité (pour avoir
// systématiquement la dernière version après une mise à jour), avec le cache uniquement en secours
// si la connexion est coupée. Les librairies externes (React, Babel, Tailwind) sont mises en cache
// en priorité puisqu'elles ne changent jamais.

const CACHE_NAME = "pointage-cache-v2";
const ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
  "https://cdn.tailwindcss.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isAppShell = event.request.mode === "navigate" || event.request.destination === "document";

  if (isAppShell) {
    // Réseau en priorité pour toujours avoir la dernière version publiée
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache en priorité pour les librairies externes (ne changent jamais une fois versionnées)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
