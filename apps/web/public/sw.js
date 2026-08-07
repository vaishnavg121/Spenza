// Spenza Service Worker - PWA Foundation
// SAFE Caching Only - No Financial Mutations or Private API Caching

const CACHE_NAME = "spenza-pwa-v1";

const PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon.svg",
];

// Install: Pre-cache static shell assets and offline fallback page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up obsolete Spenza caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith("spenza-") && cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Skip Waiting trigger from UI update prompt
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch: Safe caching strategy
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. NON-GET requests (mutations: POST, PUT, DELETE, PATCH): NEVER cache or intercept
  if (request.method !== "GET") {
    return;
  }

  // 2. Cross-origin requests: NEVER cache
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. EXPLICIT EXCLUSIONS: API routes, Auth routes, Receipt URLs, Uploads
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.includes("receipt") ||
    url.pathname.includes("upload")
  ) {
    return;
  }

  // 4. TOP-LEVEL PAGE NAVIGATIONS: Network-first, fallback to /offline page if disconnected
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If network response is valid, return it directly
          return response;
        })
        .catch(async () => {
          // Network failed (offline): return cached offline fallback page
          const cache = await caches.open(CACHE_NAME);
          const offlinePage = await cache.match("/offline");
          return offlinePage || Response.error();
        })
    );
    return;
  }

  // 5. STATIC ASSETS (_next/static, public icons, static images/fonts): Cache-first with network fallback
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }
});
