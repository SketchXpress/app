const CACHE_NAME = "sketchxpress-v1";
const urlsToCache = [
  "/",
  "/defaultNFT.png",
  "/logo.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/demoHouse.png",
  "/demoRobot.webp",
  "/demoCar.png",
  "/demoIronMan.jpg",
  "/nft1.jpeg",
  "/nft2.avif",
  "/nft3.jpg",
  "/nft4.jpg",
  "/nft5.png",
  "/nft6.webp",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle API requests differently
  if (event.request.url.includes("/api/")) {
    // For API requests, try network first, then fall back to cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response to store in cache and return the original
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try to return from cache
          return caches.match(event.request);
        })
    );
  } else {
    // For non-API requests (static assets), use cache-first approach
    event.respondWith(
      caches
        .match(event.request)
        .then((cachedResponse) => {
          // Return from cache if available
          if (cachedResponse) {
            return cachedResponse;
          }
          // Otherwise fetch from network
          return fetch(event.request).then((response) => {
            // Don't cache if response is not valid
            if (
              !response ||
              response.status !== 200 ||
              response.type !== "basic"
            ) {
              return response;
            }
            // Clone the response to store in cache and return the original
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return response;
          });
        })
        .catch(() => {
          // If both cache and network fail, return offline page
          if (event.request.mode === "navigate") {
            return caches.match("/offline");
          }
        })
    );
  }
});

// For Push Notifications
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || "New update from SketchXpress!",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: "1",
      },
    };
    event.waitUntil(
      self.registration.showNotification(data.title || "SketchXpress", options)
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
