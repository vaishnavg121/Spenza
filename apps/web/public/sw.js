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

  // DEVELOPMENT SAFEGUARD: Never intercept or cache requests in dev / localhost
  if (
    self.location.hostname === "localhost" ||
    self.location.hostname === "127.0.0.1" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.includes("webpack")
  ) {
    return;
  }

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

// 6. WEB PUSH EVENT LISTENER
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();

    // Strip sensitive details, provide safe fallback
    const title = payload.title || "Spenza";
    const body = payload.body || "You have a new update.";
    // Only accept local same-origin paths, sanitize absolute URLs
    let url = "/dashboard";
    if (payload.url && payload.url.startsWith("/")) {
      url = payload.url;
    }

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon.svg",
        data: { url },
        tag: "spenza-notification", // Deduplicates rapid identical notifications
      })
    );
  } catch (err) {
    console.error("Failed to parse push payload:", err);
  }
});

// 7. NOTIFICATION CLICK LISTENER
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus and navigate it
      for (let client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (windowClients.length > 0 && "focus" in windowClients[0]) {
        windowClients[0].focus();
        return windowClients[0].navigate(urlToOpen);
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
