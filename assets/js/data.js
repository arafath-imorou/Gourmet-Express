/**
 * Data Manager - Multi-Restaurant Platform (Ultra-Fast SWR Engine)
 * Supabase backend, persistent sessionStorage/localStorage cache for 0ms navigation
 */

const STORAGE_KEYS = {
    CART: 'restaurant_cart',
    CLIENT_SESSION: 'restaurant_client_session',
    STAFF_SESSION: 'restaurant_staff_session',
    CURRENT_RESTAURANT_ID: 'restaurant_current_id',
    CURRENT_RESTAURANT_NAME: 'restaurant_current_name',
    CURRENT_RESTAURANT_LOGO: 'restaurant_current_logo',
    PAYOUTS: 'restaurant_payouts_local'
};

const FAST_CACHE_KEYS = {
    RESTAURANTS: 'it_fast_cache_restaurants_v4',
    MENU_PREFIX: 'it_fast_cache_menu_v4_',
    PRODUCTS_MAP: 'it_fast_products_map_v4'
};

const CACHE_TTL_MS = 90000; // 90s fresh window + instant Stale-While-Revalidate

const _DATA_CACHE = {
    restaurants: { data: null, expires: 0, inFlight: null },
    menus: {},
    productsById: {}
};

let _CART_RAM = null;

// Safe persistent cache helpers (localStorage + sessionStorage) for permanent 0ms logos & data
function _readSessionCache(key) {
    try {
        const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function _stripLargeBase64(obj, maxLen = 120000) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => _stripLargeBase64(item, maxLen));
    const copy = {};
    for (const k of Object.keys(obj)) {
        const val = obj[k];
        if (typeof val === 'string' && val.length > maxLen && val.startsWith('data:')) {
            copy[k] = '';
        } else if (Array.isArray(val)) {
            copy[k] = val.map(item => _stripLargeBase64(item, maxLen));
        } else {
            copy[k] = val;
        }
    }
    return copy;
}

function _writeSessionCache(key, value) {
    const jsonStr = JSON.stringify(value);
    try {
        sessionStorage.setItem(key, jsonStr);
    } catch (e) {
        try {
            sessionStorage.setItem(key, JSON.stringify(_stripLargeBase64(value, 2000)));
        } catch (e2) {}
    }
    // Persist restaurants and products map in localStorage so logos stay permanently available at 0ms
    if (key === FAST_CACHE_KEYS.RESTAURANTS || key === FAST_CACHE_KEYS.PRODUCTS_MAP) {
        try {
            localStorage.setItem(key, jsonStr);
        } catch (e) {
            try {
                localStorage.setItem(key, JSON.stringify(_stripLargeBase64(value, 60000)));
            } catch (e2) {}
        }
    }
}

function _removeSessionCache(key) {
    try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    } catch (e) {}
}

function _indexProducts(menuItems) {
    if (!Array.isArray(menuItems)) return;
    let map = _readSessionCache(FAST_CACHE_KEYS.PRODUCTS_MAP) || {};
    menuItems.forEach(p => {
        if (p && p.id !== undefined && p.id !== null) {
            const pid = String(p.id);
            const normalizedPrice = Number(p.price) || 0;
            const normalizedProduct = { ...p, id: pid, price: normalizedPrice };
            _DATA_CACHE.productsById[pid] = normalizedProduct;
            _DATA_CACHE.productsById[p.id] = normalizedProduct;
            map[pid] = {
                id: pid,
                name: p.name || 'Plat',
                price: normalizedPrice,
                image: (p.image && typeof p.image === 'string' && p.image.length < 1500) ? p.image : undefined,
                category: p.category,
                restaurant_id: p.restaurant_id,
                active: p.active,
                available: p.available
            };
        }
    });
    _writeSessionCache(FAST_CACHE_KEYS.PRODUCTS_MAP, map);
}

// Hydrate RAM cache immediately on script load
(function _hydrateCacheOnBoot() {
    const cachedRestos = _readSessionCache(FAST_CACHE_KEYS.RESTAURANTS);
    if (cachedRestos && Array.isArray(cachedRestos.data)) {
        _DATA_CACHE.restaurants.data = cachedRestos.data;
        _DATA_CACHE.restaurants.expires = cachedRestos.expires || 0;
    }
    const cachedMap = _readSessionCache(FAST_CACHE_KEYS.PRODUCTS_MAP);
    if (cachedMap && typeof cachedMap === 'object') {
        Object.keys(cachedMap).forEach(k => {
            if (!_DATA_CACHE.productsById[k]) {
                _DATA_CACHE.productsById[k] = cachedMap[k];
            }
        });
    }
})();

const DataManager = {

    // Cache control
    invalidateCache: () => {
        _DATA_CACHE.restaurants.data = null;
        _DATA_CACHE.restaurants.expires = 0;
        _DATA_CACHE.menus = {};
        _removeSessionCache(FAST_CACHE_KEYS.RESTAURANTS);
        try {
            Object.keys(sessionStorage).forEach(k => {
                if (k.startsWith(FAST_CACHE_KEYS.MENU_PREFIX)) {
                    sessionStorage.removeItem(k);
                }
            });
        } catch (e) {}
    },

    // ==================== HELPERS ====================
    normalize: (str) => str ? str.toString().trim().toLowerCase() : '',
    normalizePhone: (str) => str ? str.toString().replace(/[\s\-\.]/g, '') : '',
    cleanPhoneDigits: (str) => {
        if (!str) return '';
        return str.toString().replace(/\D/g, '');
    },
    matchPhones: (p1, p2) => {
        if (!p1 || !p2) return false;
        const d1 = p1.toString().replace(/\D/g, '');
        const d2 = p2.toString().replace(/\D/g, '');
        if (!d1 || !d2) return false;
        if (d1 === d2) return true;
        if (d1.length >= 8 && d2.length >= 8 && d1.slice(-8) === d2.slice(-8)) return true;
        if (d1.length >= 10 && d2.length >= 10 && d1.slice(-10) === d2.slice(-10)) return true;
        return false;
    },
    stripAccents: (str) => {
        if (!str) return '';
        return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    },

    // ==================== IMAGE WEBP COMPRESSION ====================
    convertToWebP: (file, maxDimension = 800, quality = 0.82) => {
        return new Promise((resolve, reject) => {
            if (!file) { resolve(''); return; }
            if (!file.type || !file.type.match(/image.*/)) {
                reject(new Error('Le fichier sélectionné n\'est pas une image valide.'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDimension) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        }
                    } else {
                        if (height > maxDimension) {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const webpDataUrl = canvas.toDataURL('image/webp', quality);
                    resolve(webpDataUrl);
                };
                img.onerror = (err) => reject(err);
                img.src = e.target.result;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    },

    // ==================== SESSION ====================
    getCurrentClient: () => {
        const s = localStorage.getItem(STORAGE_KEYS.CLIENT_SESSION);
        return s ? JSON.parse(s) : null;
    },
    getCurrentStaff: () => {
        const s = localStorage.getItem(STORAGE_KEYS.STAFF_SESSION);
        return s ? JSON.parse(s) : null;
    },
    getCurrentRestaurantId: () => {
        const staff = DataManager.getCurrentStaff();
        if (staff && staff.restaurant_id) return staff.restaurant_id;
        return localStorage.getItem(STORAGE_KEYS.CURRENT_RESTAURANT_ID);
    },
    getCurrentRestaurantName: () => {
        const staff = DataManager.getCurrentStaff();
        if (staff && staff.restaurant_name) return staff.restaurant_name;
        return localStorage.getItem(STORAGE_KEYS.CURRENT_RESTAURANT_NAME) || '';
    },
    getCurrentRestaurantLogo: () => {
        const staff = DataManager.getCurrentStaff();
        if (staff && staff.restaurant_logo) return staff.restaurant_logo;
        return localStorage.getItem(STORAGE_KEYS.CURRENT_RESTAURANT_LOGO) || '';
    },
    setCurrentRestaurant: (id, name, logo) => {
        localStorage.setItem(STORAGE_KEYS.CURRENT_RESTAURANT_ID, id);
        localStorage.setItem(STORAGE_KEYS.CURRENT_RESTAURANT_NAME, name || '');
        let resolvedLogo = logo;
        if (resolvedLogo === undefined) {
            const cached = DataManager.getCachedRestaurantsSync(false);
            const found = cached ? cached.find(r => String(r.id) === String(id)) : null;
            resolvedLogo = found && found.logo ? found.logo : '';
        }
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENT_RESTAURANT_LOGO, resolvedLogo || '');
        } catch (e) {}
        const session = DataManager.getCurrentClient();
        if (session) {
            session.currentRestaurantId = id;
            session.currentRestaurantName = name;
            localStorage.setItem(STORAGE_KEYS.CLIENT_SESSION, JSON.stringify(session));
        }
    },
    logout: () => {
        localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION);
        localStorage.removeItem(STORAGE_KEYS.STAFF_SESSION);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_RESTAURANT_ID);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_RESTAURANT_NAME);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_RESTAURANT_LOGO);
    },
    logoutClient: () => localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION),
    logoutStaff: () => localStorage.removeItem(STORAGE_KEYS.STAFF_SESSION),

    // ==================== RESTAURANTS (0ms Sync + SWR Async) ====================
    getCachedRestaurantsSync: (activeOnly = false) => {
        let list = _DATA_CACHE.restaurants.data;
        if (!list) {
            const cached = _readSessionCache(FAST_CACHE_KEYS.RESTAURANTS);
            if (cached && Array.isArray(cached.data)) {
                list = cached.data;
                _DATA_CACHE.restaurants.data = list;
                _DATA_CACHE.restaurants.expires = cached.expires || 0;
            }
        }
        if (!list || !list.length) return null;
        return activeOnly ? list.filter(r => r.status !== 'inactive') : list;
    },

    _fetchRestaurantsNetwork: async () => {
        if (_DATA_CACHE.restaurants.inFlight) {
            return _DATA_CACHE.restaurants.inFlight;
        }
        _DATA_CACHE.restaurants.inFlight = (async () => {
            try {
                if (!window.supabaseClient) return _DATA_CACHE.restaurants.data || [];
                const { data, error } = await window.supabaseClient
                    .from('restaurants')
                    .select('*')
                    .order('name');
                if (!error && data && data.length > 0) {
                    const expires = Date.now() + CACHE_TTL_MS;
                    _DATA_CACHE.restaurants.data = data;
                    _DATA_CACHE.restaurants.expires = expires;
                    _writeSessionCache(FAST_CACHE_KEYS.RESTAURANTS, { data, expires });
                    window.dispatchEvent(new CustomEvent('restaurants-refreshed', { detail: data }));
                    return data;
                }
            } catch (e) {
                console.error('Erreur _fetchRestaurantsNetwork:', e);
            } finally {
                _DATA_CACHE.restaurants.inFlight = null;
            }
            return _DATA_CACHE.restaurants.data || [];
        })();
        return _DATA_CACHE.restaurants.inFlight;
    },

    getRestaurants: async (activeOnly = false, forceRefresh = false) => {
        const cached = DataManager.getCachedRestaurantsSync(false);
        const now = Date.now();

        if (!forceRefresh && cached && cached.length > 0) {
            // Si le cache a expiré, on rafraîchit en arrière-plan sans bloquer l'interface !
            if (now >= _DATA_CACHE.restaurants.expires) {
                DataManager._fetchRestaurantsNetwork();
            }
            return activeOnly ? cached.filter(r => r.status !== 'inactive') : cached;
        }

        const fresh = await DataManager._fetchRestaurantsNetwork();
        return activeOnly ? (fresh || []).filter(r => r.status !== 'inactive') : (fresh || []);
    },

    getRestaurantById: async (id) => {
        const cached = DataManager.getCachedRestaurantsSync(false);
        if (cached) {
            const found = cached.find(r => r.id === id);
            if (found) return found;
        }
        const { data, error } = await window.supabaseClient
            .from('restaurants').select('*').eq('id', id).single();
        if (error) return null;
        return data;
    },
    createRestaurant: async (restaurantData, adminData) => {
        const slug = restaurantData.name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            + '-' + Date.now();

        const { data: restaurant, error: rErr } = await window.supabaseClient
            .from('restaurants')
            .insert([{ ...restaurantData, slug, status: 'active' }])
            .select().single();
        if (rErr) return { success: false, message: rErr.message };

        const { error: sErr } = await window.supabaseClient
            .from('staff')
            .insert([{ ...adminData, restaurant_id: restaurant.id, role: 'admin', status: 'active' }]);
        if (sErr) return { success: false, message: sErr.message };

        DataManager.invalidateCache();
        return { success: true, restaurant };
    },
    updateRestaurant: async (id, data) => {
        const { error } = await window.supabaseClient.from('restaurants').update(data).eq('id', id);
        DataManager.invalidateCache();
        return !error;
    },
    deleteRestaurant: async (id) => {
        try {
            await Promise.all([
                window.supabaseClient.from('restau_menu').delete().eq('restaurant_id', id),
                window.supabaseClient.from('staff').delete().eq('restaurant_id', id)
            ]);
            const { error } = await window.supabaseClient.from('restaurants').delete().eq('id', id);
            DataManager.invalidateCache();
            return !error;
        } catch (e) {
            console.error('Error deleting restaurant:', e);
            return false;
        }
    },
    getAllRestaurantsStats: async () => {
        // Exécution 100% parallèle au lieu de séquentielle
        const [restaurantsRes, ordersRes, payouts] = await Promise.all([
            DataManager.getRestaurants(false),
            window.supabaseClient.from('restau_orders').select('total, status, restaurant_id'),
            DataManager.getPayouts()
        ]);

        const restaurants = restaurantsRes || [];
        const orders = (ordersRes && ordersRes.data) || [];

        return restaurants.map(r => {
            const restoOrders = orders.filter(o => o.restaurant_id === r.id);
            const grossRevenue = restoOrders
                .filter(o => o.status === 'Terminée' || o.status === 'En cours' || o.status === 'Nouvelle')
                .reduce((s, o) => s + (o.total || 0), 0);

            const itaCommission = Math.round(grossRevenue * 0.05);
            const restaurantNet = grossRevenue - itaCommission;

            const totalPaidOut = (payouts || [])
                .filter(p => p.restaurant_id === r.id)
                .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

            const remainingBalance = Math.max(0, restaurantNet - totalPaidOut);

            return {
                ...r,
                orderCount: restoOrders.length,
                completedOrdersCount: restoOrders.filter(o => o.status === 'Terminée').length,
                cancelledOrdersCount: restoOrders.filter(o => o.status === 'Annulée').length,
                grossRevenue: grossRevenue,
                revenue: grossRevenue,
                itaCommission: itaCommission,
                restaurantNet: restaurantNet,
                totalPaidOut: totalPaidOut,
                remainingBalance: remainingBalance
            };
        });
    },

    // ==================== REVERSEMENTS / PAYOUTS ====================
    getPayouts: async (restaurantId) => {
        try {
            let q = window.supabaseClient.from('restaurant_payouts').select('*').order('date', { ascending: false });
            if (restaurantId) q = q.eq('restaurant_id', restaurantId);
            const { data, error } = await q;
            if (!error && data && Array.isArray(data)) {
                return data;
            }
        } catch (e) {
            console.warn('Supabase payouts fallback:', e);
        }
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
        if (restaurantId) return local.filter(p => p.restaurant_id === restaurantId);
        return local;
    },

    createPayout: async ({ restaurant_id, amount, method, reference }) => {
        const newPayout = {
            id: 'REV-' + Date.now().toString().slice(-6),
            restaurant_id,
            amount: parseFloat(amount) || 0,
            method: method || 'MTN MoMo',
            reference: reference || '',
            date: new Date().toISOString()
        };

        try {
            const { data, error } = await window.supabaseClient.from('restaurant_payouts').insert([newPayout]).select();
            if (!error && data && data.length > 0) {
                const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
                local.unshift(data[0]);
                localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(local));
                return { success: true, payout: data[0] };
            }
        } catch (e) {
            console.warn('Supabase insert payout fallback:', e);
        }

        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
        local.unshift(newPayout);
        localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(local));
        return { success: true, payout: newPayout };
    },

    // ==================== SUPERADMIN LOGIN ====================
    loginSuperAdmin: async (email, password) => {
        try {
            const cleanEmail = email ? email.toLowerCase().trim() : '';
            const cleanPassword = password ? password.trim() : '';

            if (!cleanEmail || !cleanPassword) {
                return { success: false, message: 'Veuillez saisir votre email et mot de passe.' };
            }

            if (cleanEmail === 'groupita25@gmail.com' && cleanPassword === 'Dilshadtairou2') {
                const session = {
                    id: 'STAFF-SUPER-001',
                    role: 'superadmin',
                    agent_role: null,
                    restaurant_id: null,
                    restaurant_name: 'Plateforme ITAMYA',
                    restaurant_logo: null,
                    firstname: 'Super',
                    lastname: 'Admin',
                    email: cleanEmail
                };
                localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
                localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION);
                return { success: true, staff: session };
            }

            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient.from('staff')
                    .select('*')
                    .eq('email', cleanEmail)
                    .eq('role', 'superadmin');

                if (!error && data && data.length > 0) {
                    const admin = data.find(s => s.password === cleanPassword);
                    if (admin) {
                        const session = {
                            id: admin.id,
                            role: 'superadmin',
                            agent_role: null,
                            restaurant_id: null,
                            restaurant_name: 'Plateforme ITAMYA',
                            restaurant_logo: null,
                            firstname: admin.firstname || 'Super',
                            lastname: admin.lastname || 'Admin',
                            email: admin.email
                        };
                        localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
                        localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION);
                        return { success: true, staff: session };
                    }
                }
            }

            return { success: false, message: 'Email ou mot de passe superadmin incorrect.' };
        } catch (e) {
            console.error('Erreur loginSuperAdmin:', e);
            return { success: false, message: 'Identifiants superadmin incorrects.' };
        }
    },

    // ==================== STAFF LOGIN ====================
    loginStaff: async (identifier, password, restaurantId) => {
        const rawId = (identifier || '').trim();
        const cleanEmail = rawId.toLowerCase();
        const cleanPassword = password ? password.trim() : '';

        const { data: superadmins } = await window.supabaseClient.from('staff')
            .select('*, restaurants(id, name, logo, slug, phone)')
            .eq('email', cleanEmail)
            .eq('password', cleanPassword)
            .eq('role', 'superadmin')
            .eq('status', 'active');

        if (superadmins && superadmins.length > 0) {
            const m = superadmins[0];
            const session = {
                id: m.id, role: 'superadmin', agent_role: null,
                restaurant_id: null,
                restaurant_name: 'Plateforme ITAMYA',
                restaurant_logo: null,
                firstname: m.firstname, lastname: m.lastname, email: m.email
            };
            localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
            return { success: true, staff: session };
        }

        let candidateStaff = [];
        let q = window.supabaseClient.from('staff')
            .select('*, restaurants(id, name, logo, slug, phone)')
            .eq('email', cleanEmail)
            .eq('password', cleanPassword)
            .eq('status', 'active');

        if (restaurantId) q = q.eq('restaurant_id', restaurantId);
        const { data: byEmail } = await q;
        if (byEmail && byEmail.length > 0) candidateStaff.push(...byEmail);

        if (candidateStaff.length === 0) {
            const restos = await DataManager.getRestaurants(false);
            const matchingRestos = (restos || []).filter(r => DataManager.matchPhones(r.phone, rawId));
            if (matchingRestos.length > 0) {
                let pq = window.supabaseClient.from('staff')
                    .select('*, restaurants(id, name, logo, slug, phone)')
                    .in('restaurant_id', matchingRestos.map(r => r.id))
                    .eq('password', cleanPassword)
                    .eq('status', 'active');
                if (restaurantId) pq = pq.eq('restaurant_id', restaurantId);
                const { data: byPhone } = await pq;
                if (byPhone && byPhone.length > 0) candidateStaff.push(...byPhone);
            }
        }

        if (candidateStaff.length === 0) return { success: false, message: 'Identifiants incorrects ou restaurant non correspondant.' };

        const m = candidateStaff[0];
        const session = {
            id: m.id, role: m.role, agent_role: m.agent_role,
            restaurant_id: m.restaurant_id,
            restaurant_name: m.restaurants ? m.restaurants.name : 'Restaurant',
            restaurant_logo: m.restaurants ? m.restaurants.logo : null,
            restaurant_phone: m.restaurants ? m.restaurants.phone : null,
            firstname: m.firstname, lastname: m.lastname, email: m.email,
            phone: m.restaurants ? m.restaurants.phone : null
        };
        localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
        return { success: true, staff: session };
    },

    // ==================== UNIFIED AUTOMATIC LOGIN (100% PARALLELIZED) ====================
    loginUnified: async (identifier, password) => {
        try {
            const rawId = (identifier || '').trim();
            const normEmail = DataManager.normalize(rawId);
            const normPhone = DataManager.normalizePhone(rawId);
            const cleanPassword = (password || '').trim();

            if (!rawId || !cleanPassword) {
                return { success: false, message: 'Veuillez saisir votre identifiant et votre mot de passe.' };
            }

            const isPotentialPhone = /\d{6,}/.test(rawId.replace(/\D/g, ''));

            // Préparation des requêtes en parallèle (1 seul aller-retour réseau au lieu de 4-5 !)
            let staffQuery = window.supabaseClient
                .from('staff')
                .select('*, restaurants(id, name, logo, phone, address, status)');

            if (normEmail && rawId && normEmail !== rawId) {
                staffQuery = staffQuery.or(`email.eq.${normEmail},email.eq.${rawId}`);
            } else {
                staffQuery = staffQuery.eq('email', normEmail || rawId);
            }

            let clientQuery = window.supabaseClient.from('restau_clients').select('*');
            if (rawId.includes('@')) {
                clientQuery = clientQuery.eq('email', normEmail || rawId);
            } else {
                clientQuery = clientQuery.or(`phone.eq.${normPhone},phone.eq.${rawId},email.eq.${rawId}`);
            }

            const restosPromise = isPotentialPhone ? DataManager.getRestaurants(false) : Promise.resolve([]);

            // Exécution simultanée
            const [staffRes, clientRes, allRestos] = await Promise.all([
                staffQuery,
                clientQuery,
                restosPromise
            ]);

            const candidateStaffList = [];
            if (!staffRes.error && staffRes.data && staffRes.data.length > 0) {
                candidateStaffList.push(...staffRes.data);
            }

            // Si téléphone de restaurant détecté
            if (isPotentialPhone && allRestos && allRestos.length > 0) {
                const matchingRestos = allRestos.filter(r => DataManager.matchPhones(r.phone, rawId));
                if (matchingRestos.length > 0) {
                    const restoIds = matchingRestos.map(r => r.id);
                    const { data: phoneStaffList } = await window.supabaseClient
                        .from('staff')
                        .select('*, restaurants(id, name, logo, phone, address, status)')
                        .in('restaurant_id', restoIds);
                    if (phoneStaffList && phoneStaffList.length > 0) {
                        candidateStaffList.push(...phoneStaffList);
                    }
                }
            }

            // Dédoublonnage staff
            const uniqueStaff = [];
            const seenIds = new Set();
            for (const s of candidateStaffList) {
                if (s && s.id && !seenIds.has(s.id)) {
                    seenIds.add(s.id);
                    uniqueStaff.push(s);
                }
            }

            const matchedMember = uniqueStaff.find(s => s.password === cleanPassword);
            if (matchedMember) {
                if (matchedMember.status === 'inactive' || matchedMember.status === 'blocked') {
                    return { success: false, message: 'Ce compte restaurant est actuellement désactivé.' };
                }
                if (matchedMember.restaurants && matchedMember.restaurants.status === 'inactive') {
                    return { success: false, message: 'Cet établissement est actuellement désactivé.' };
                }
                const session = {
                    id: matchedMember.id,
                    role: matchedMember.role || 'admin',
                    agent_role: matchedMember.agent_role,
                    restaurant_id: matchedMember.restaurant_id,
                    restaurant_name: matchedMember.restaurants ? matchedMember.restaurants.name : 'Plateforme ITAMYA',
                    restaurant_logo: matchedMember.restaurants ? matchedMember.restaurants.logo : null,
                    restaurant_phone: matchedMember.restaurants ? matchedMember.restaurants.phone : null,
                    firstname: matchedMember.firstname,
                    lastname: matchedMember.lastname,
                    name: `${matchedMember.firstname || ''} ${matchedMember.lastname || ''}`.trim() || matchedMember.email,
                    email: matchedMember.email,
                    phone: matchedMember.restaurants ? matchedMember.restaurants.phone : null
                };
                localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
                localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION);

                if (matchedMember.restaurant_id) {
                    DataManager.setCurrentRestaurant(matchedMember.restaurant_id, session.restaurant_name);
                }

                return {
                    success: true,
                    type: matchedMember.role === 'superadmin' ? 'superadmin' : 'staff',
                    redirectUrl: matchedMember.role === 'superadmin' ? 'superadmin/index.html' : 'admin/index.html'
                };
            }

            // Vérification Client directe
            let matchedClients = (!clientRes.error && clientRes.data) ? clientRes.data : [];

            if (matchedClients.length === 0 && isPotentialPhone) {
                const { data: allClients } = await window.supabaseClient.from('restau_clients').select('*');
                matchedClients = (allClients || []).filter(c => DataManager.matchPhones(c.phone, rawId));
            }

            if (matchedClients.length > 0) {
                const client = matchedClients.find(c => c.password === cleanPassword);
                if (client) {
                    if (client.status === 'blocked' || client.status === 'inactive') {
                        return { success: false, message: 'Votre compte client est temporairement désactivé.' };
                    }
                    const session = {
                        id: client.id,
                        firstname: client.firstname,
                        lastname: client.lastname,
                        email: client.email,
                        phone: client.phone,
                        points: client.points || 0,
                        type: 'client'
                    };
                    localStorage.setItem(STORAGE_KEYS.CLIENT_SESSION, JSON.stringify(session));
                    localStorage.removeItem(STORAGE_KEYS.STAFF_SESSION);

                    return { success: true, type: 'client', redirectUrl: 'client/index.html' };
                }
            }

            // Fallback tolérance accents email staff uniquement si aucun résultat
            if (rawId.includes('@')) {
                const strippedInput = DataManager.stripAccents(rawId);
                const { data: allStaff } = await window.supabaseClient
                    .from('staff')
                    .select('*, restaurants(id, name, logo, phone, address, status)');
                const accentMember = (allStaff || []).find(s => DataManager.stripAccents(s.email) === strippedInput && s.password === cleanPassword);
                if (accentMember) {
                    const session = {
                        id: accentMember.id,
                        role: accentMember.role || 'admin',
                        agent_role: accentMember.agent_role,
                        restaurant_id: accentMember.restaurant_id,
                        restaurant_name: accentMember.restaurants ? accentMember.restaurants.name : 'Plateforme ITAMYA',
                        restaurant_logo: accentMember.restaurants ? accentMember.restaurants.logo : null,
                        restaurant_phone: accentMember.restaurants ? accentMember.restaurants.phone : null,
                        firstname: accentMember.firstname,
                        lastname: accentMember.lastname,
                        name: `${accentMember.firstname || ''} ${accentMember.lastname || ''}`.trim() || accentMember.email,
                        email: accentMember.email,
                        phone: accentMember.restaurants ? accentMember.restaurants.phone : null
                    };
                    localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
                    localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION);
                    if (accentMember.restaurant_id) {
                        DataManager.setCurrentRestaurant(accentMember.restaurant_id, session.restaurant_name);
                    }
                    return {
                        success: true,
                        type: accentMember.role === 'superadmin' ? 'superadmin' : 'staff',
                        redirectUrl: accentMember.role === 'superadmin' ? 'superadmin/index.html' : 'admin/index.html'
                    };
                }
            }

            return { success: false, message: 'Identifiant (Email / Téléphone) ou mot de passe incorrect.' };
        } catch (e) {
            console.error('Erreur loginUnified:', e);
            return { success: false, message: 'Erreur lors de la connexion. Veuillez vérifier votre connexion internet.' };
        }
    },

    getStaff: async (restaurantId) => {
        const { data, error } = await window.supabaseClient
            .from('staff').select('*')
            .eq('restaurant_id', restaurantId)
            .neq('role', 'superadmin')
            .order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    },
    createStaff: async (staffData) => {
        const { data, error } = await window.supabaseClient
            .from('staff').insert([staffData]).select();
        if (error) return { success: false, message: error.message };
        return { success: true, staff: data[0] };
    },
    updateStaff: async (id, updates) => {
        const { error } = await window.supabaseClient.from('staff').update(updates).eq('id', id);
        return !error;
    },
    deleteStaff: async (id) => {
        const { error } = await window.supabaseClient.from('staff').delete().eq('id', id);
        return !error;
    },

    // ==================== CLIENTS ====================
    registerClient: async (clientData) => {
        const email = DataManager.normalize(clientData.email);
        const phone = DataManager.normalizePhone(clientData.phone);
        const { data: existing } = await window.supabaseClient
            .from('restau_clients').select('id').or(`email.eq.${email},phone.eq.${phone}`);
        if (existing && existing.length > 0) return { success: false, message: 'Email ou téléphone déjà utilisé.' };
        const { data, error } = await window.supabaseClient.from('restau_clients')
            .insert([{ id: 'CLT-' + Date.now().toString().slice(-6), firstname: clientData.firstname, lastname: clientData.lastname, email, phone, password: clientData.password, points: 0, status: 'active' }]).select();
        if (error) return { success: false, message: 'Erreur inscription.' };
        return { success: true, client: data[0] };
    },
    loginClient: async (identifier, password, restaurantId, restaurantName) => {
        const normId = DataManager.normalize(identifier);
        const normPhone = DataManager.normalizePhone(identifier);
        const { data: clients } = await window.supabaseClient
            .from('restau_clients').select('*').or(`email.eq.${normId},phone.eq.${normPhone}`);
        if (!clients || clients.length === 0) return { success: false, message: 'Identifiants incorrects.' };
        const client = clients.find(c => c.password === password);
        if (!client) return { success: false, message: 'Identifiants incorrects.' };
        if (client.status === 'blocked') return { success: false, message: 'Compte bloqué.' };
        const session = { ...client, type: 'client', currentRestaurantId: restaurantId, currentRestaurantName: restaurantName };
        delete session.password;
        localStorage.setItem(STORAGE_KEYS.CLIENT_SESSION, JSON.stringify(session));
        localStorage.setItem(STORAGE_KEYS.CURRENT_RESTAURANT_ID, restaurantId);
        localStorage.setItem(STORAGE_KEYS.CURRENT_RESTAURANT_NAME, restaurantName || '');
        return { success: true, client: session };
    },
    getClients: async () => {
        const { data, error } = await window.supabaseClient.from('restau_clients').select('*');
        if (error) return [];
        return data || [];
    },

    // ==================== MENU (0ms Sync + SWR Async) ====================
    getProductByIdSync: (productId) => {
        if (productId === undefined || productId === null) return null;
        const pid = String(productId);
        if (_DATA_CACHE.productsById[pid]) return _DATA_CACHE.productsById[pid];
        if (_DATA_CACHE.productsById[productId]) return _DATA_CACHE.productsById[productId];
        if (Array.isArray(window.allProducts)) {
            const fromWin = window.allProducts.find(p => p && String(p.id) === pid);
            if (fromWin) {
                const norm = { ...fromWin, id: pid, price: Number(fromWin.price) || 0 };
                _DATA_CACHE.productsById[pid] = norm;
                return norm;
            }
        }
        const map = _readSessionCache(FAST_CACHE_KEYS.PRODUCTS_MAP);
        if (map && (map[pid] || map[productId])) {
            const entry = map[pid] || map[productId];
            entry.price = Number(entry.price) || 0;
            _DATA_CACHE.productsById[pid] = entry;
            return entry;
        }
        return null;
    },

    getCachedMenuSync: (restaurantId) => {
        const rid = restaurantId || DataManager.getCurrentRestaurantId();
        if (!rid) return null;
        if (_DATA_CACHE.menus[rid] && Array.isArray(_DATA_CACHE.menus[rid].data)) {
            return _DATA_CACHE.menus[rid].data;
        }
        const sessionEntry = _readSessionCache(FAST_CACHE_KEYS.MENU_PREFIX + rid);
        if (sessionEntry && Array.isArray(sessionEntry.data)) {
            _DATA_CACHE.menus[rid] = {
                data: sessionEntry.data,
                expires: sessionEntry.expires || 0,
                inFlight: null
            };
            _indexProducts(sessionEntry.data);
            return sessionEntry.data;
        }
        return null;
    },

    _fetchMenuNetwork: async (rid) => {
        if (!_DATA_CACHE.menus[rid]) {
            _DATA_CACHE.menus[rid] = { data: null, expires: 0, inFlight: null };
        }
        if (_DATA_CACHE.menus[rid].inFlight) {
            return _DATA_CACHE.menus[rid].inFlight;
        }
        _DATA_CACHE.menus[rid].inFlight = (async () => {
            try {
                if (!window.supabaseClient) return _DATA_CACHE.menus[rid].data || [];
                const { data, error } = await window.supabaseClient
                    .from('restau_menu')
                    .select('*')
                    .eq('restaurant_id', rid)
                    .order('category');
                if (!error && data) {
                    const normalizedData = data.map(p => ({
                        ...p,
                        id: String(p.id),
                        price: Number(p.price) || 0
                    }));
                    const expires = Date.now() + CACHE_TTL_MS;
                    _DATA_CACHE.menus[rid].data = normalizedData;
                    _DATA_CACHE.menus[rid].expires = expires;
                    _writeSessionCache(FAST_CACHE_KEYS.MENU_PREFIX + rid, { data: normalizedData, expires });
                    _indexProducts(normalizedData);
                    window.dispatchEvent(new CustomEvent('menu-refreshed', { detail: { restaurantId: rid, data: normalizedData } }));
                    return normalizedData;
                }
            } catch (e) {
                console.error('Erreur _fetchMenuNetwork:', e);
            } finally {
                if (_DATA_CACHE.menus[rid]) {
                    _DATA_CACHE.menus[rid].inFlight = null;
                }
            }
            return (_DATA_CACHE.menus[rid] && _DATA_CACHE.menus[rid].data) || [];
        })();
        return _DATA_CACHE.menus[rid].inFlight;
    },

    getMenu: async (restaurantId, forceRefresh = false) => {
        const rid = restaurantId || DataManager.getCurrentRestaurantId();
        if (!rid) return [];

        const cached = DataManager.getCachedMenuSync(rid);
        const now = Date.now();

        if (!forceRefresh && cached) {
            const entry = _DATA_CACHE.menus[rid];
            if (!entry || now >= entry.expires) {
                DataManager._fetchMenuNetwork(rid);
            }
            return cached;
        }

        return await DataManager._fetchMenuNetwork(rid);
    },

    addMenuItem: async (item) => {
        const itemToInsert = {
            id: item.id || 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            active: item.active !== false,
            available: item.available !== false,
            ...item
        };
        try {
            const { data, error } = await window.supabaseClient.from('restau_menu').insert([itemToInsert]).select();
            if (error) {
                console.error('Erreur Supabase addMenuItem:', error);
                return null;
            }
            if (item.restaurant_id) {
                delete _DATA_CACHE.menus[item.restaurant_id];
                _removeSessionCache(FAST_CACHE_KEYS.MENU_PREFIX + item.restaurant_id);
            }
            const created = data && data.length > 0 ? data[0] : itemToInsert;
            _indexProducts([created]);
            return created;
        } catch (err) {
            console.error('Exception addMenuItem:', err);
            return null;
        }
    },
    updateMenuItem: async (id, updates) => {
        try {
            const { error } = await window.supabaseClient.from('restau_menu').update(updates).eq('id', id);
            if (error) console.error('Erreur updateMenuItem:', error);
            DataManager.invalidateCache();
            return !error;
        } catch (err) {
            console.error('Exception updateMenuItem:', err);
            return false;
        }
    },
    deleteMenuItem: async (id) => {
        try {
            const { error } = await window.supabaseClient.from('restau_menu').delete().eq('id', id);
            if (error) console.error('Erreur deleteMenuItem:', error);
            DataManager.invalidateCache();
            return !error;
        } catch (err) {
            console.error('Exception deleteMenuItem:', err);
            return false;
        }
    },

    // ==================== CART (0ms RAM + Lightweight localStorage Snapshot) ====================
    getCart: () => {
        if (Array.isArray(_CART_RAM)) {
            return _CART_RAM;
        }
        try {
            const s = localStorage.getItem(STORAGE_KEYS.CART);
            const parsed = s ? JSON.parse(s) : [];
            _CART_RAM = Array.isArray(parsed) ? parsed.map(i => ({
                ...i,
                productId: String(i.productId),
                quantity: Number(i.quantity) || 1,
                price: i.price !== undefined ? (Number(i.price) || 0) : undefined,
                image: (i.image && typeof i.image === 'string' && i.image.length < 1500) ? i.image : undefined
            })) : [];
            return _CART_RAM;
        } catch (e) {
            _CART_RAM = [];
            return _CART_RAM;
        }
    },
    saveCart: (cart) => {
        const cleanCart = (Array.isArray(cart) ? cart : []).map(i => ({
            productId: String(i.productId),
            quantity: Number(i.quantity) || 1,
            note: i.note || '',
            name: i.name,
            price: i.price !== undefined ? (Number(i.price) || 0) : undefined,
            image: (i.image && typeof i.image === 'string' && i.image.length < 1500) ? i.image : undefined,
            restaurantId: i.restaurantId
        }));
        _CART_RAM = cleanCart;
        try {
            localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cleanCart));
        } catch (e) {
            console.warn('saveCart localStorage warning:', e);
        }
    },
    addToCart: (productId, quantity = 1, meta = null) => {
        const pid = String(productId);
        const qtyDelta = Number(quantity) || 1;
        let cart = [...DataManager.getCart()];
        const product = DataManager.getProductByIdSync(pid) || meta;
        const unitPrice = product && product.price !== undefined ? (Number(product.price) || 0) : undefined;
        const prodName = product && product.name ? product.name : undefined;
        const prodImg = product && product.image && typeof product.image === 'string' && product.image.length < 1500 ? product.image : undefined;
        const prodRestoId = product ? (product.restaurant_id || product.restaurantId) : undefined;

        const item = cart.find(i => String(i.productId) === pid);
        if (item) {
            item.quantity = (Number(item.quantity) || 0) + qtyDelta;
            if (prodName) item.name = prodName;
            if (unitPrice !== undefined) item.price = unitPrice;
            if (prodImg) item.image = prodImg;
            if (prodRestoId) item.restaurantId = prodRestoId;
        } else {
            cart.push({
                productId: pid,
                quantity: qtyDelta,
                note: '',
                name: prodName,
                price: unitPrice,
                image: prodImg,
                restaurantId: prodRestoId
            });
        }
        DataManager.saveCart(cart);
        window.dispatchEvent(new Event('cart-updated'));
    },
    removeFromCart: (productId) => {
        const pid = String(productId);
        const nextCart = DataManager.getCart().filter(i => String(i.productId) !== pid);
        DataManager.saveCart(nextCart);
        window.dispatchEvent(new Event('cart-updated'));
    },
    updateCartQuantity: (productId, delta) => {
        const pid = String(productId);
        const d = Number(delta) || 0;
        let cart = [...DataManager.getCart()];
        const item = cart.find(i => String(i.productId) === pid);
        if (item) {
            item.quantity = (Number(item.quantity) || 1) + d;
            const product = DataManager.getProductByIdSync(pid);
            if (product) {
                item.name = product.name || item.name;
                item.price = Number(product.price) || item.price || 0;
            }
            if (item.quantity <= 0) {
                cart = cart.filter(i => String(i.productId) !== pid);
            }
            DataManager.saveCart(cart);
            window.dispatchEvent(new Event('cart-updated'));
        } else if (d > 0) {
            DataManager.addToCart(pid, d);
        }
    },
    clearCart: () => {
        _CART_RAM = [];
        try {
            localStorage.removeItem(STORAGE_KEYS.CART);
        } catch (e) {}
        window.dispatchEvent(new Event('cart-updated'));
    },
    getCartItemCount: () => DataManager.getCart().reduce((acc, i) => acc + (Number(i.quantity) || 1), 0),

    getCartTotalSync: () => {
        const cart = DataManager.getCart();
        if (!cart.length) return 0;
        let total = 0;
        let allResolved = true;
        for (const item of cart) {
            const p = DataManager.getProductByIdSync(item.productId);
            const rawPrice = (p && p.price !== undefined) ? p.price : item.price;
            const numPrice = Number(rawPrice);
            if (!Number.isNaN(numPrice) && rawPrice !== undefined && rawPrice !== null) {
                total += numPrice * (Number(item.quantity) || 1);
            } else {
                allResolved = false;
            }
        }
        return allResolved ? total : null;
    },

    getCartTotal: async (restaurantId) => {
        const cart = DataManager.getCart();
        if (!cart.length) return 0;

        const syncTotal = DataManager.getCartTotalSync();
        if (syncTotal !== null) return syncTotal;

        const rid = restaurantId || DataManager.getCurrentRestaurantId();
        const menu = await DataManager.getMenu(rid);
        return cart.reduce((total, item) => {
            const pid = String(item.productId);
            const p = (menu || []).find(m => String(m.id) === pid) || DataManager.getProductByIdSync(pid);
            const price = Number(p ? p.price : item.price) || 0;
            return total + price * (Number(item.quantity) || 1);
        }, 0);
    },

    // ==================== ORDERS ====================
    getOrders: async (restaurantId) => {
        const rid = restaurantId || DataManager.getCurrentRestaurantId();
        if (!rid) return [];
        const { data, error } = await window.supabaseClient
            .from('restau_orders').select('*').eq('restaurant_id', rid).order('date', { ascending: false });
        if (error) return [];
        return data || [];
    },
    getClientOrders: async (clientId, phone) => {
        try {
            let query = window.supabaseClient
                .from('restau_orders')
                .select('*, restaurants(id, name, logo, phone, address)')
                .order('date', { ascending: false });

            if (clientId && phone) {
                const cleanPhone = phone.trim();
                query = query.or(`client_id.eq.${clientId},phone.eq.${cleanPhone}`);
            } else if (clientId) {
                query = query.eq('client_id', clientId);
            } else if (phone) {
                query = query.eq('phone', phone.trim());
            }

            const { data, error } = await query;
            if (!error && data) return data;
        } catch (e) {
            console.error('Erreur getClientOrders:', e);
        }
        return [];
    },
    placeOrder: async (orderDetails) => {
        const restaurantId = DataManager.getCurrentRestaurantId();
        const menu = DataManager.getCachedMenuSync(restaurantId) || await DataManager.getMenu(restaurantId);
        const cart = DataManager.getCart();
        const enrichedItems = cart.map(cartItem => {
            const p = (menu || []).find(m => m.id === cartItem.productId) || DataManager.getProductByIdSync(cartItem.productId);
            return {
                productId: cartItem.productId,
                quantity: cartItem.quantity,
                frozenName: p ? p.name : (cartItem.name || '?'),
                frozenPrice: p ? p.price : (cartItem.price || 0),
                frozenImage: p ? p.image : (cartItem.image || '')
            };
        });
        const client = DataManager.getCurrentClient();
        const newOrder = {
            id: 'CMD-' + Date.now().toString().slice(-6),
            status: 'Nouvelle',
            restaurant_id: restaurantId,
            type: orderDetails.type,
            address: orderDetails.address,
            phone: orderDetails.phone,
            client_name: orderDetails.clientName,
            client_id: client ? client.id : null,
            total: orderDetails.total,
            items: enrichedItems,
            comment: orderDetails.comment || ''
        };
        const { data, error } = await window.supabaseClient.from('restau_orders').insert([newOrder]).select();
        if (error) return null;
        DataManager.clearCart();
        return data[0];
    },
    updateOrderStatus: async (id, status) => {
        const { data, error } = await window.supabaseClient
            .from('restau_orders').update({ status }).eq('id', id).select();
        if (error) return false;
        if (status === 'Terminée' && data && data[0]) await DataManager.awardPoints(data[0]);
        return true;
    },
    awardPoints: async (order) => {
        if (!order.client_id) return;
        const { data: clientData } = await window.supabaseClient
            .from('restau_clients').select('points').eq('id', order.client_id).single();
        if (!clientData) return;
        const newPoints = (clientData.points || 0) + 10 + Math.floor(order.total / 1000);
        await window.supabaseClient.from('restau_clients').update({ points: newPoints }).eq('id', order.client_id);
        const session = DataManager.getCurrentClient();
        if (session && session.id === order.client_id) {
            session.points = newPoints;
            localStorage.setItem(STORAGE_KEYS.CLIENT_SESSION, JSON.stringify(session));
        }
    }
};

window.DataManager = DataManager;
