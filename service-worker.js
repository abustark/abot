/**
 * ABot Service Worker
 * Provides offline caching for local assets only
 */

const CACHE_NAME = 'abot-cache-v13'; // v12: Phase 4 self-hosted fonts + vendored libs
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/favicon.png',
    '/logo.png',
    '/dist/output.css?v=p5',
    '/js/app.js',
    '/js/config.js',
    '/js/dom.js',
    '/js/state.js',
    '/js/utils.js',
    '/js/ui.js',
    '/js/auth.js',
    '/js/chat.js',
    '/vendor/marked.min.js',
    '/vendor/highlight.min.js',
    '/vendor/atom-one-dark.css',
    '/manifest.json',
    '/dist/fonts/inter-latin-400-normal.woff2',
    '/dist/fonts/inter-latin-600-normal.woff2',
    '/dist/fonts/source-serif-4-latin-400-normal.woff2'
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

// Fetch event
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept same-origin requests
    if (url.origin !== self.location.origin) return;

    // Skip API requests
    if (url.pathname.startsWith('/api/')) return;

    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // STRATEGY: Network-First for main page (navigation), Cache-First for assets
    if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => caches.match('/index.html')) // Offline fallback
        );
        return;
    }

    // Default: Cache-First for static assets
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
    );
});
