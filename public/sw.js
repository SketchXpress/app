const CACHE_NAME = "sketchxpress-v1";
const urlsToCache = [
  "/",

  // Root level icons and images
  "/assets/icons/favicon.ico",
  "/assets/icons/apple-touch-icon.png",
  "/manifests/manifest.json",

  // Icons
  "/assets/icons/icon-48x48.png",
  "/assets/icons/icon-72x72.png",
  "/assets/icons/icon-96x96.png",
  "/assets/icons/icon-128x128.png",
  "/assets/icons/icon-144x144.png",
  "/assets/icons/icon-152x152.png",
  "/assets/icons/icon-192x192.png",
  "/assets/icons/icon-256x256.png",
  "/assets/icons/icon-384x384.png",
  "/assets/icons/icon-512x512.png",
  "/assets/icons/maskable-icon.png",

  // Critical images
  "/assets/images/logo.png",
  "/assets/images/og-image.png",

  // Demo images (only cache critical ones)
  "/assets/images/defaultNFT.png",
];

// Install event - pre-cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((error) => {
        console.error("Failed to cache some resources:", error);
        // Continue installation even if some resources fail to cache
        return Promise.resolve();
      });
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - serve cached content when offline
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip cross-origin requests
  if (!url.origin === self.location.origin) {
    return;
  }

  // Skip Chrome extensions and dev tools
  if (
    url.hostname === "localhost" &&
    url.port === "3000" &&
    url.pathname.includes("__next")
  ) {
    return;
  }

  // Handle different types of requests
  if (request.url.includes("/api/")) {
    // API requests: Network first, fallback to cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for API requests
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a custom offline response for API requests
            return new Response(
              JSON.stringify({
                error: "Offline",
                message: "No cached data available",
              }),
              {
                headers: { "Content-Type": "application/json" },
              }
            );
          });
        })
    );
  } else if (request.mode === "navigate") {
    // Navigation requests: Try network first, fallback to offline page
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
  } else {
    // Static assets: Cache first, fallback to network
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return from cache and update in background
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          });
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request).then((response) => {
          // Only cache successful responses
          if (!response.ok) {
            return response;
          }

          // Don't cache responses that shouldn't be cached
          const shouldCache =
            response.type === "basic" &&
            !request.url.includes("_next/static/development") &&
            !request.url.includes("hot-update");

          if (shouldCache) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        });
      })
    );
  }
});

// Push notification event
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "New update from SketchXpress!",
      icon: "/assets/icons/icon-192x192.png",
      badge: "/assets/icons/icon-96x96.png", // Smaller icon for badge
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.id || "1",
        url: data.url || "/",
      },
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "SketchXpress", options)
    );
  } catch (error) {
    console.error("Push event error:", error);
  }
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { action, data } = event.notification;
  const urlToOpen = data?.url || "/";

  if (action === "dismiss") {
    return;
  }

  // Open or focus the app window
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (
            client.url.startsWith(self.location.origin) &&
            "focus" in client
          ) {
            client.focus();
            return client.navigate(urlToOpen);
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-uploads") {
    event.waitUntil(
      // Handle queued uploads when back online
      processQueuedUploads()
    );
  }
});

async function processQueuedUploads() {
  // Implement your offline queue processing logic here
  console.log("Processing queued uploads...");
}

// Periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "update-content") {
    event.waitUntil(updateContent());
  }
});

async function updateContent() {
  // Implement periodic content updates
  console.log("Updating content in background...");
}
