// ============================================
// MoneyTrack Service Worker
// ============================================

const CACHE_NAME = 'moneytrack-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/register.html',
    '/dashboard.html',
    '/transactions.html',
    '/budget.html',
    '/goals.html',
    '/analytics.html',
    '/recurring.html',
    '/upi.html',
    '/css/style.css',
    '/js/pwa.js',
    '/js/app.js',
    '/js/transactions.js',
    '/js/upi.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cache what we can; don't fail if one asset errors
            return Promise.allSettled(
                STATIC_ASSETS.map((url) =>
                    cache.add(url).catch(() => { /* skip uncacheable */ })
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API calls: always network-first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: 'You are offline. Please reconnect.' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 503,
                })
            )
        );
        return;
    }

    // Static assets: cache-first, fall back to network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache successful GET responses for static assets
                if (
                    response.ok &&
                    event.request.method === 'GET' &&
                    !url.pathname.startsWith('/api/')
                ) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() =>
                // Fallback offline page
                caches.match('/dashboard.html')
            );
        })
    );
});
