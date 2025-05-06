const CACHE_NAME = "sketchxpress-v2"; // Incremented cache version
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
  "/offline" // Ensure offline page is in the initial cache list
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache for installation:", CACHE_NAME);
      return cache.addAll(urlsToCache).catch(error => {
        console.error("Failed to cache all initial assets:", error);
        // Optionally, throw the error to fail the installation if critical assets are missing
        // throw error;
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
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
    }).then(() => {
      console.log("Cache activated and old caches cleaned:", CACHE_NAME);
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return; // Skip cross-origin requests
  }

  if (event.request.url.includes("/api/")) {
    // Network-first strategy for API requests, with improved error handling
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) { // Only cache successful responses
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(err => {
                console.error("Cache put failed for API request:", event.request.url, err);
              });
            });
          } else {
            // If response is not OK, do not cache it.
            // Log the error and consider invalidating existing cache for this request if it exists and is problematic.
            console.warn("API request failed, not caching:", event.request.url, response.status);
            // Optional: Invalidate cache for this specific request if an error is detected
            // caches.open(CACHE_NAME).then(cache => cache.delete(event.request));
          }
          return response; // Return the original response (success or error)
        })
        .catch((error) => {
          console.log("Network fetch failed for API, trying cache:", event.request.url, error);
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If not in cache and network failed, construct a generic error response or return undefined
            // For API calls, returning a specific error structure might be better than offline page
            console.error("API request failed: Not in cache and network error for", event.request.url);
            return new Response(JSON.stringify({ error: "Network error and not in cache" }), {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "application/json" }
            });
          });
        })
    );
  } else {
    // Cache-first strategy for non-API requests (static assets)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) { // Only cache successful responses for static assets too
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(err => {
                console.error("Cache put failed for static asset:", event.request.url, err);
              });
            });
          } else {
            console.warn("Static asset fetch failed, not caching:", event.request.url, response.status);
          }
          return response;
        });
      }).catch(() => {
        // If both cache and network fail for a navigation request, return offline page
        if (event.request.mode === "navigate") {
          return caches.match("/offline").then(offlineResponse => {
            if (offlineResponse) return offlineResponse;
            // Fallback if /offline is not cached for some reason
            return new Response("Offline page not available", { status: 503, statusText: "Service Unavailable" });
          });
        }
        // For other types of assets, if not in cache and network fails, the browser will handle the error.
      })
    );
  }
});

self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || "New update from SketchXpress!",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge.png", // Ensure this badge icon exists or remove if not
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: "1", // Consider making primaryKey dynamic if multiple notifications can arrive
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

