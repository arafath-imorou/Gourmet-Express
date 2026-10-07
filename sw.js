// ITAMYA Service Worker - PWA & Offline Support
const CACHE_NAME = 'itamya-cache-v1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './menu.html',
    './cart.html',
    './order.html',
    './confirmation.html',
    './blog.html',
    './login.html',
    './register.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/css/menu.css',
    './assets/images/logoitamya.png',
    './assets/images/icon-192.png',
    './assets/images/icon-512.png',
    './assets/js/supabase.js',
    './assets/js/data.js',
    './assets/js/cart.js',
    './assets/js/mobile.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[ITAMYA SW] Pre-caching warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Ne pas intercepter les requêtes non-GET ou externes sensibles (Supabase API, FedaPay)
    if (request.method !== 'GET' || url.hostname.includes('supabase.co') || url.hostname.includes('fedapay.com')) {
        return;
    }

    // Stratégie Network-First avec fallback Cache
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
