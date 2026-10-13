// ITAMYA Service Worker - Ultra-Fast Cache & Live Update Engine (v3)
const CACHE_NAME = 'itamya-fast-cache-v3';

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
    './assets/css/style.css?v=3',
    './assets/css/menu.css?v=3',
    './assets/images/logoitamya.png',
    './assets/images/icon-192.png',
    './assets/images/icon-512.png',
    './assets/js/supabase.js?v=3',
    './assets/js/data.js?v=3',
    './assets/js/app.js?v=3',
    './assets/js/menu.js?v=3',
    './assets/js/cart.js?v=3',
    './assets/js/order.js?v=3',
    './assets/js/mobile.js?v=3'
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

    const isCodeOrDoc =
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css');

    if (isCodeOrDoc) {
        // Network-First ultra-rapide avec fallback immédiat sur le cache
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        return cached || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // Images, polices et icônes : Cache-First + SWR
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
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            });
        })
    );
});
