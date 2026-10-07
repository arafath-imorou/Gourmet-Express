/**
 * ITAMYA Mobile & Capacitor Bridge
 * Gestion de l'expérience mobile native Android & PWA
 * Développé pour ITAMYA par ITA INNOVATE
 */

(function () {
    'use strict';

    // 1. Initialisation de l'environnement
    const isCapacitor = typeof window.Capacitor !== 'undefined';
    const isAndroid = isCapacitor && window.Capacitor.getPlatform() === 'android';

    // 2. Gestion du bouton Retour Android (Hardware Back Button)
    let lastBackPressTime = 0;

    function handleAndroidBack() {
        // A. Vérifier si une modale est ouverte et la fermer en priorité
        const restaurantModal = document.getElementById('restaurant-modal');
        if (restaurantModal && (restaurantModal.style.display === 'flex' || restaurantModal.style.display === 'block')) {
            if (typeof window.closeRestaurantModal === 'function') {
                window.closeRestaurantModal();
                return;
            }
            restaurantModal.style.display = 'none';
            return;
        }

        const readerModal = document.getElementById('reader-modal');
        if (readerModal && (readerModal.style.display === 'flex' || readerModal.style.display === 'block')) {
            if (typeof window.closeArticleModal === 'function') {
                window.closeArticleModal();
                return;
            }
            readerModal.style.display = 'none';
            return;
        }

        const genericModals = document.querySelectorAll('.modal.show, [data-modal-open="true"]');
        if (genericModals.length > 0) {
            genericModals.forEach(m => m.classList.remove('show'));
            return;
        }

        // B. Vérifier si on est sur la page d'accueil
        const path = window.location.pathname;
        const isHomePage = path.endsWith('index.html') || path === '/' || path.endsWith('/commande%20restau/') || path.endsWith('/commande%20restau');
        const isClientOrAdmin = path.includes('/admin/') || path.includes('/client/') || path.includes('/superadmin/');

        if (!isHomePage && !isClientOrAdmin) {
            // Revenir en arrière dans l'historique ou vers l'accueil
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'index.html';
            }
            return;
        }

        // C. Double-tap pour quitter sur la page d'accueil
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
            if (isCapacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            }
        } else {
            lastBackPressTime = now;
            showMobileToast("Appuyez à nouveau pour quitter ITAMYA");
        }
    }

    // 3. Liaison avec Capacitor Native Plugins
    document.addEventListener('DOMContentLoaded', () => {
        if (isCapacitor && window.Capacitor.Plugins) {
            const { App, StatusBar, SplashScreen } = window.Capacitor.Plugins;

            // Masquer le splash screen proprement
            if (SplashScreen) {
                setTimeout(() => {
                    SplashScreen.hide().catch(() => {});
                }, 600);
            }

            // Personnaliser la barre d'état
            if (StatusBar) {
                StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
            }

            // Écouter le bouton retour matériel Android
            if (App) {
                App.addListener('backButton', () => {
                    handleAndroidBack();
                });
            }
        }

        // 4. Détection Réseau & Mode Hors-ligne
        setupNetworkMonitoring();

        // 5. Injection de la barre de navigation mobile
        setupMobileBottomNav();

        // 6. Enregistrement PWA Service Worker
        setupServiceWorker();
    });

    // Toast de notification mobile
    function showMobileToast(message, duration = 2000) {
        let toast = document.getElementById('itamya-mobile-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'itamya-mobile-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: calc(85px + env(safe-area-inset-bottom, 0px));
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 23, 42, 0.94);
                color: #ffffff;
                padding: 10px 20px;
                border-radius: 50px;
                font-size: 0.82rem;
                font-weight: 600;
                z-index: 9999;
                box-shadow: 0 4px 18px rgba(0,0,0,0.25);
                backdrop-filter: blur(8px);
                transition: opacity 0.25s ease, transform 0.25s ease;
                opacity: 0;
                pointer-events: none;
                text-align: center;
                max-width: 90%;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(8px)';
        }, duration);
    }

    // Détection du réseau
    function setupNetworkMonitoring() {
        let banner = document.getElementById('itamya-network-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'itamya-network-banner';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                padding: calc(6px + env(safe-area-inset-top, 0px)) 16px 8px;
                font-size: 0.78rem;
                font-weight: 700;
                text-align: center;
                z-index: 10000;
                display: none;
                transition: transform 0.3s ease;
            `;
            document.body.appendChild(banner);
        }

        function updateOnlineStatus() {
            if (!navigator.onLine) {
                banner.style.background = '#e63946';
                banner.style.color = '#ffffff';
                banner.textContent = "Connexion Internet indisponible. Mode consultation actif.";
                banner.style.display = 'block';
            } else {
                if (banner.style.display === 'block') {
                    banner.style.background = '#059669';
                    banner.style.color = '#ffffff';
                    banner.textContent = "Connexion Internet rétablie.";
                    setTimeout(() => {
                        banner.style.display = 'none';
                    }, 2500);
                }
            }
        }

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        if (!navigator.onLine) {
            updateOnlineStatus();
        }
    }

    // Barre de navigation mobile inférieure (Bottom Navigation)
    function setupMobileBottomNav() {
        // Ne pas afficher sur certaines pages d'administration spécifiques ou si déjà présent
        if (document.getElementById('itamya-bottom-nav')) return;

        const path = window.location.pathname;
        const isClient = path.includes('/client/');
        const isAdmin = path.includes('/admin/');
        const isSuperAdmin = path.includes('/superadmin/');

        // Déterminer le préfixe relatif pour les liens selon la sous-arborescence
        let rootPrefix = '';
        if (isClient || isAdmin || isSuperAdmin) {
            rootPrefix = '../';
        }

        // Calculer l'état de session utilisateur
        let accountLink = rootPrefix + 'login.html';
        let accountLabel = 'Compte';
        try {
            const client = localStorage.getItem('it_current_client') || localStorage.getItem('it_client_session');
            const staff = localStorage.getItem('it_current_staff') || localStorage.getItem('it_staff_session');
            if (staff) {
                const parsed = JSON.parse(staff);
                accountLink = parsed.role === 'superadmin' ? rootPrefix + 'superadmin/index.html' : rootPrefix + 'admin/index.html';
                accountLabel = 'Admin';
            } else if (client) {
                accountLink = rootPrefix + 'client/index.html';
                accountLabel = 'Mon Espace';
            }
        } catch (e) {}

        // Récupérer le nombre d'articles dans le panier
        let cartCount = 0;
        try {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            if (Array.isArray(cart)) {
                cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
            }
        } catch (e) {}

        const isHome = path.endsWith('index.html') || path === '/' || (!path.includes('cart') && !path.includes('order') && !path.includes('login') && !path.includes('client') && !path.includes('admin') && !path.includes('blog'));
        const isCart = path.includes('cart.html');
        const isAccount = path.includes('login.html') || path.includes('/client/') || path.includes('/admin/') || path.includes('/superadmin/');
        const isBlog = path.includes('blog.html');

        const nav = document.createElement('nav');
        nav.id = 'itamya-bottom-nav';
        nav.setAttribute('aria-label', 'Navigation mobile');
        nav.innerHTML = `
            <style>
                #itamya-bottom-nav {
                    display: none;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(15, 23, 42, 0.98);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
                    z-index: 999;
                    justify-content: space-around;
                    align-items: center;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.18);
                }
                @media (max-width: 768px) {
                    #itamya-bottom-nav {
                        display: flex;
                    }
                    body {
                        padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important;
                    }
                }
                .nav-item-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.65);
                    text-decoration: none;
                    font-size: 0.68rem;
                    font-weight: 600;
                    gap: 3px;
                    padding: 4px 10px;
                    position: relative;
                    transition: color 0.2s ease;
                }
                .nav-item-btn.active {
                    color: #ffffff;
                }
                .nav-item-btn svg {
                    width: 20px;
                    height: 20px;
                    stroke: currentColor;
                    fill: none;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }
                .nav-item-btn.active svg {
                    stroke: #e63946;
                }
                .nav-cart-badge {
                    position: absolute;
                    top: 2px;
                    right: 8px;
                    background: #e63946;
                    color: #ffffff;
                    font-size: 0.62rem;
                    font-weight: 800;
                    min-width: 16px;
                    height: 16px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                }
            </style>
            <!-- Accueil -->
            <a href="${rootPrefix}index.html" class="nav-item-btn ${isHome && !isBlog ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                <span>Accueil</span>
            </a>
            <!-- Restaurants -->
            <a href="${rootPrefix}index.html#restaurants-grid" class="nav-item-btn">
                <svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                <span>Restaurants</span>
            </a>
            <!-- Panier -->
            <a href="${rootPrefix}cart.html" class="nav-item-btn ${isCart ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <span>Panier</span>
                ${cartCount > 0 ? `<span class="nav-cart-badge" id="bottom-nav-cart-count">${cartCount}</span>` : ''}
            </a>
            <!-- Blog -->
            <a href="${rootPrefix}blog.html" class="nav-item-btn ${isBlog ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                <span>Blog</span>
            </a>
            <!-- Compte -->
            <a href="${accountLink}" class="nav-item-btn ${isAccount ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>${accountLabel}</span>
            </a>
        `;
        document.body.appendChild(nav);
    }

    // Enregistrement PWA Service Worker
    function setupServiceWorker() {
        if ('serviceWorker' in navigator && !isCapacitor) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then((reg) => {
                        console.log('[ITAMYA PWA] Service Worker actif:', reg.scope);
                    })
                    .catch((err) => {
                        console.warn('[ITAMYA PWA] Enregistrement Service Worker ignoré:', err);
                    });
            });
        }
    }

    // Exposer l'utilitaire globalement
    window.ITAMYAMobile = {
        isCapacitor,
        isAndroid,
        showToast: showMobileToast,
        handleBack: handleAndroidBack
    };

})();
