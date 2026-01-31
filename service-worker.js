/**
 * ABot Service Worker
 * Provides offline caching for local assets only
 */

const CACHE_NAME = 'abot-cache-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/favicon.png',
    '/logo.png',
    '/dist/output.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.log('[SW] Cache failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - ONLY handle same-origin local requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // IMPORTANT: Only intercept same-origin requests
    // Let ALL external requests (CDN, Firebase, Google, etc.) pass through normally
    if (url.origin !== self.location.origin) {
        return; // Don't call event.respondWith - let the browser handle it
    }

    // Skip API requests
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Only return offline fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        // For other local assets, just fail
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});
