/**
 * ITAMYA Mobile & Capacitor Bridge
 * Gestion de l'expérience mobile native Android & PWA
 * Domaine officiel : https://itamya.store
 * Développé pour ITAMYA par ITA INNOVATE (www.itainnovate.com)
 */

(function () {
    'use strict';

    // 1. Constantes officielles de production
    const OFFICIAL_DOMAIN = "https://itamya.store";
    const PLAY_STORE_URL = "URL_DE_L_APPLICATION_ITAMYA_SUR_GOOGLE_PLAY";
    const FALLBACK_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=bj.itamya.app";
    const effectivePlayStoreUrl = (PLAY_STORE_URL && !PLAY_STORE_URL.startsWith("URL_")) ? PLAY_STORE_URL : FALLBACK_PLAY_STORE_URL;

    // Désactivé tant que l'application n'est pas encore publiée (demande utilisateur)
    const SHOW_APP_INSTALL_PROMPT = false;

    // 2. Initialisation de l'environnement
    const isCapacitor = typeof window.Capacitor !== 'undefined';
    const isAndroid = isCapacitor && window.Capacitor.getPlatform() === 'android';
    const isAndroidBrowser = !isCapacitor && /android/i.test(navigator.userAgent || '');
    const isDesktop = !isCapacitor && window.innerWidth > 768 && !('ontouchstart' in window);

    // 3. Gestion du bouton Retour Android (Hardware Back Button)
    let lastBackPressTime = 0;

    function handleAndroidBack() {
        // A. Vérifier si une modale est ouverte et la fermer en priorité
        const qrModal = document.getElementById('itamya-qr-modal');
        if (qrModal && qrModal.style.display === 'flex') {
            qrModal.style.display = 'none';
            return;
        }

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

    // 4. Liaison avec Capacitor Native Plugins & Deep Links
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

                // Écouter l'ouverture des Deep Links / Android App Links (https://itamya.store/* ou itamya://*)
                App.addListener('appUrlOpen', (event) => {
                    console.log('[ITAMYA Deep Link] URL reçue :', event.url);
                    try {
                        let targetRoute = '';
                        if (event.url.startsWith('itamya://')) {
                            targetRoute = event.url.replace('itamya://', '');
                        } else if (event.url.includes('itamya.store')) {
                            const parsed = new URL(event.url);
                            targetRoute = parsed.pathname + parsed.search + parsed.hash;
                        }

                        if (targetRoute) {
                            if (targetRoute.startsWith('/')) targetRoute = targetRoute.substring(1);
                            if (!targetRoute) targetRoute = 'index.html';
                            window.location.href = targetRoute;
                        }
                    } catch (err) {
                        console.warn('[ITAMYA Deep Link] Erreur lors du routage :', err);
                    }
                });
            }
        }

        // 5. Détection Réseau & Mode Hors-ligne
        setupNetworkMonitoring();

        // 6. Bandeau d'installation (désactivé par défaut tant que non souhaité)
        if (SHOW_APP_INSTALL_PROMPT) {
            setupSmartAppBanner();
            setupDesktopPromo();
        }

        // 7. Enregistrement PWA Service Worker
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
                bottom: calc(95px + env(safe-area-inset-bottom, 0px));
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

    // Smart App Banner pour navigateurs Android Web (activable via SHOW_APP_INSTALL_PROMPT)
    function setupSmartAppBanner() {
        if (!isAndroidBrowser || sessionStorage.getItem('itamya_banner_dismissed')) {
            return;
        }
        const banner = document.createElement('div');
        banner.id = 'itamya-smart-banner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #ffffff;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            z-index: 10001;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            font-size: 0.8rem;
        `;
        banner.innerHTML = `
            <div class="smart-banner-info">
                <strong style="display:block;font-size:0.85rem;color:#fff;margin-bottom:2px;">ITAMYA est aussi disponible sur Android</strong>
                <span style="font-size:0.74rem;color:#94a3b8;line-height:1.3;display:block;">Installez l'application pour profiter d'une expérience mobile optimisée.</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <a href="${effectivePlayStoreUrl}" target="_blank" style="background:#e63946;color:#fff;padding:6px 14px;border-radius:50px;font-weight:700;font-size:0.76rem;text-decoration:none;white-space:nowrap;">Installer l'application</a>
                <button onclick="dismissSmartBanner()" style="background:none;border:none;color:#94a3b8;font-size:1.1rem;cursor:pointer;padding:4px;" aria-label="Fermer">✕</button>
            </div>
        `;
        document.body.prepend(banner);
        window.dismissSmartBanner = function () {
            const el = document.getElementById('itamya-smart-banner');
            if (el) el.remove();
            sessionStorage.setItem('itamya_banner_dismissed', 'true');
        };
    }

    function setupDesktopPromo() {
        if (!isDesktop) return;
    }

    // Enregistrement PWA Service Worker
    function setupServiceWorker() {
        if ('serviceWorker' in navigator && !isCapacitor) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then((reg) => {
                        console.log('[ITAMYA PWA] Service Worker actif :', reg.scope);
                    })
                    .catch((err) => {
                        console.warn('[ITAMYA PWA] Enregistrement Service Worker ignoré :', err);
                    });
            });
        }
    }

    // Exposer l'utilitaire globalement
    window.ITAMYAMobile = {
        isCapacitor,
        isAndroid,
        OFFICIAL_DOMAIN,
        PLAY_STORE_URL,
        effectivePlayStoreUrl,
        showToast: showMobileToast,
        handleBack: handleAndroidBack
    };

})();
