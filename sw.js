// ITAMYA Service Worker - Ultra-Fast Stale-While-Revalidate (SWR) Engine
const CACHE_NAME = 'itamya-fast-cache-v2';

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
    './assets/js/app.js',
    './assets/js/menu.js',
    './assets/js/cart.js',
    './assets/js/order.js',
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

    // Ne jamais mettre en cache les appels API dynamiques (Supabase REST/Auth, FedaPay)
    if (
        request.method !== 'GET' ||
        url.hostname.includes('supabase.co') ||
        url.hostname.includes('fedapay.com')
    ) {
        return;
    }

    // Stratégie Stale-While-Revalidate :
    // Répond immédiatement depuis le cache (0ms) s'il est disponible, et met à jour en arrière-plan !
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        if (cachedResponse) return cachedResponse;
                        if (request.headers.get('accept')?.includes('text/html')) {
                            return cache.match('./index.html');
                        }
                    });

                return cachedResponse || fetchPromise;
            });
        })
    );
});
