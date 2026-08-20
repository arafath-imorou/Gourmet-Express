/**
 * Data Manager - Multi-Restaurant Platform
 * Supabase backend, localStorage for cart & session
 */

const STORAGE_KEYS = {
    CART: 'restaurant_cart',
    CLIENT_SESSION: 'restaurant_client_session',
    STAFF_SESSION: 'restaurant_staff_session',
    CURRENT_RESTAURANT_ID: 'restaurant_current_id',
    CURRENT_RESTAURANT_NAME: 'restaurant_current_name',
    PAYOUTS: 'restaurant_payouts_local'
};

const DataManager = {

    // ==================== HELPERS ====================
    normalize: (str) => str ? str.toString().trim().toLowerCase() : '',
    normalizePhone: (str) => str ? str.toString().replace(/[\s\-\.]/g, '') : '',

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

                    // Conversion instantanée en format WEBP optimisé
                    const webpDataUrl = canvas.toDataURL('image/webp', quality);
                    console.log(`🖼️ Image convertie en WEBP (${width}x${height}) - Réduction de poids maximale`);
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
    setCurrentRestaurant: (id, name) => {
        localStorage.setItem(STORAGE_KEYS.CURRENT_RESTAURANT_ID, id);
        localStorage.setItem(STORAGE_KEYS.CURRENT_RESTAURANT_NAME, name || '');
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
    },
    logoutClient: () => localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION),
    logoutStaff: () => localStorage.removeItem(STORAGE_KEYS.STAFF_SESSION),

    // ==================== RESTAURANTS ====================
    getRestaurants: async (activeOnly = false) => {
        try {
            if (!window.supabaseClient) return [];
            let q = window.supabaseClient.from('restaurants').select('*');
            if (activeOnly) {
                q = q.neq('status', 'inactive');
            }
            const { data, error } = await q.order('name');
            if (!error && data && data.length > 0) return data;

            // Fallback: fetch all without filter
            const { data: allData, error: allErr } = await window.supabaseClient.from('restaurants').select('*');
            if (!allErr && allData) return allData;
        } catch (e) {
            console.error('Erreur getRestaurants:', e);
        }
        return [];
    },
    getRestaurantById: async (id) => {
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

        return { success: true, restaurant };
    },
    updateRestaurant: async (id, data) => {
        const { error } = await window.supabaseClient.from('restaurants').update(data).eq('id', id);
        return !error;
    },
    deleteRestaurant: async (id) => {
        try {
            await window.supabaseClient.from('restau_menu').delete().eq('restaurant_id', id);
            await window.supabaseClient.from('staff').delete().eq('restaurant_id', id);
            const { error } = await window.supabaseClient.from('restaurants').delete().eq('id', id);
            return !error;
        } catch (e) {
            console.error('Error deleting restaurant:', e);
            return false;
        }
    },
    getAllRestaurantsStats: async () => {
        const { data: restaurants } = await window.supabaseClient.from('restaurants').select('*');
        const { data: orders } = await window.supabaseClient.from('restau_orders').select('total, status, restaurant_id');
        const payouts = await DataManager.getPayouts();

        return (restaurants || []).map(r => {
            const restoOrders = (orders || []).filter(o => o.restaurant_id === r.id);
            const grossRevenue = restoOrders
                .filter(o => o.status === 'Terminée' || o.status === 'En cours' || o.status === 'Nouvelle')
                .reduce((s, o) => s + (o.total || 0), 0);
            
            const completedRevenue = restoOrders
                .filter(o => o.status === 'Terminée')
                .reduce((s, o) => s + (o.total || 0), 0);

            // 5% Commission pour ITA INNOVATE
            const itaCommission = Math.round(grossRevenue * 0.05);
            // 95% Part nette revenant au restaurant
            const restaurantNet = grossRevenue - itaCommission;

            // Total déjà reversé
            const totalPaidOut = (payouts || [])
                .filter(p => p.restaurant_id === r.id)
                .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

            // Solde restant à reverser
            const remainingBalance = Math.max(0, restaurantNet - totalPaidOut);

            return {
                ...r,
                orderCount: restoOrders.length,
                completedOrdersCount: restoOrders.filter(o => o.status === 'Terminée').length,
                cancelledOrdersCount: restoOrders.filter(o => o.status === 'Annulée').length,
                grossRevenue: grossRevenue,
                revenue: grossRevenue, // alias
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

    // ==================== STAFF ====================
    loginStaff: async (email, password, restaurantId) => {
        const cleanEmail = email ? email.toLowerCase().trim() : '';
        const cleanPassword = password ? password.trim() : '';

        // 1. Check if superadmin
        const { data: superadmins } = await window.supabaseClient.from('staff')
            .select('*, restaurants(id, name, logo, slug)')
            .eq('email', cleanEmail)
            .eq('password', cleanPassword)
            .eq('role', 'superadmin')
            .eq('status', 'active');

        if (superadmins && superadmins.length > 0) {
            const m = superadmins[0];
            const session = {
                id: m.id, role: 'superadmin', agent_role: null,
                restaurant_id: null,
                restaurant_name: 'Plateforme Gourmet Express',
                restaurant_logo: null,
                firstname: m.firstname, lastname: m.lastname, email: m.email
            };
            localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
            return { success: true, staff: session };
        }

        return { success: false, message: 'Identifiants superadmin incorrects.' };
    },

    // ==================== UNIFIED AUTOMATIC LOGIN ====================
    loginUnified: async (identifier, password) => {
        try {
            const rawId = (identifier || '').trim();
            const normEmail = DataManager.normalize(rawId);
            const normPhone = DataManager.normalizePhone(rawId);
            const cleanPassword = (password || '').trim();

            if (!rawId || !cleanPassword) {
                return { success: false, message: 'Veuillez saisir votre identifiant et votre mot de passe.' };
            }

            // 1. Vérifier si c'est un compte Restaurant (ou Staff) dans la table 'staff'
            let staffQuery = window.supabaseClient
                .from('staff')
                .select('*, restaurants(id, name, logo, phone, address, commission_rate)')
                .or(`email.eq.${normEmail},email.eq.${rawId}`);

            const { data: staffList, error: staffErr } = await staffQuery;
            if (!staffErr && staffList && staffList.length > 0) {
                const member = staffList.find(s => s.password === cleanPassword);
                if (member) {
                    if (member.status === 'inactive' || member.status === 'blocked') {
                        return { success: false, message: 'Ce compte restaurant est actuellement désactivé.' };
                    }
                    const session = {
                        id: member.id,
                        role: member.role || 'admin',
                        agent_role: member.agent_role,
                        restaurant_id: member.restaurant_id,
                        restaurant_name: member.restaurants ? member.restaurants.name : 'Plateforme Gourmet Express',
                        restaurant_logo: member.restaurants ? member.restaurants.logo : null,
                        firstname: member.firstname,
                        lastname: member.lastname,
                        name: `${member.firstname || ''} ${member.lastname || ''}`.trim() || member.email,
                        email: member.email
                    };
                    localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
                    localStorage.removeItem(STORAGE_KEYS.CLIENT_SESSION);

                    if (member.restaurant_id) {
                        DataManager.setCurrentRestaurant(member.restaurant_id, session.restaurant_name);
                    }

                    if (member.role === 'superadmin') {
                        return { success: true, type: 'superadmin', redirectUrl: 'superadmin/index.html' };
                    } else {
                        return { success: true, type: 'staff', redirectUrl: 'admin/index.html' };
                    }
                }
            }

            // 2. Vérifier si c'est un compte Client dans la table 'restau_clients'
            let clientQuery = window.supabaseClient
                .from('restau_clients')
                .select('*')
                .or(`email.eq.${normEmail},email.eq.${rawId},phone.eq.${normPhone},phone.eq.${rawId}`);

            const { data: clientList, error: clientErr } = await clientQuery;
            if (!clientErr && clientList && clientList.length > 0) {
                const client = clientList.find(c => c.password === cleanPassword);
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

            return { success: false, message: 'Identifiant (Email / Téléphone) ou mot de passe incorrect.' };
        } catch (e) {
            console.error('Erreur loginUnified:', e);
            return { success: false, message: 'Erreur lors de la connexion. Veuillez vérifier votre connexion internet.' };
        }
    },

    // 2. Check regular restaurant staff
        let q = window.supabaseClient.from('staff')
            .select('*, restaurants(id, name, logo, slug)')
            .eq('email', cleanEmail)
            .eq('password', cleanPassword)
            .eq('status', 'active');

        if (restaurantId) {
            q = q.eq('restaurant_id', restaurantId);
        }

        const { data, error } = await q;
        if (error || !data || data.length === 0) return { success: false, message: 'Identifiants incorrects ou restaurant non correspondant.' };

        const m = data[0];
        const session = {
            id: m.id, role: m.role, agent_role: m.agent_role,
            restaurant_id: m.restaurant_id,
            restaurant_name: m.restaurants ? m.restaurants.name : 'Restaurant',
            restaurant_logo: m.restaurants ? m.restaurants.logo : null,
            firstname: m.firstname, lastname: m.lastname, email: m.email
        };
        localStorage.setItem(STORAGE_KEYS.STAFF_SESSION, JSON.stringify(session));
        return { success: true, staff: session };
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

    // ==================== MENU ====================
    getMenu: async (restaurantId) => {
        const rid = restaurantId || DataManager.getCurrentRestaurantId();
        if (!rid) return [];
        const { data, error } = await window.supabaseClient
            .from('restau_menu').select('*').eq('restaurant_id', rid).order('category');
        if (error) return [];
        return data || [];
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
            return data && data.length > 0 ? data[0] : itemToInsert;
        } catch (err) {
            console.error('Exception addMenuItem:', err);
            return null;
        }
    },
    updateMenuItem: async (id, updates) => {
        try {
            const { error } = await window.supabaseClient.from('restau_menu').update(updates).eq('id', id);
            if (error) console.error('Erreur updateMenuItem:', error);
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
            return !error;
        } catch (err) {
            console.error('Exception deleteMenuItem:', err);
            return false;
        }
    },

    // ==================== CART (localStorage) ====================
    getCart: () => { const s = localStorage.getItem(STORAGE_KEYS.CART); return s ? JSON.parse(s) : []; },
    saveCart: (cart) => localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart)),
    addToCart: (productId, quantity = 1) => {
        let cart = DataManager.getCart();
        const item = cart.find(i => i.productId === productId);
        if (item) item.quantity += quantity;
        else cart.push({ productId, quantity, note: '' });
        DataManager.saveCart(cart);
        window.dispatchEvent(new Event('cart-updated'));
    },
    removeFromCart: (productId) => {
        DataManager.saveCart(DataManager.getCart().filter(i => i.productId !== productId));
        window.dispatchEvent(new Event('cart-updated'));
    },
    updateCartQuantity: (productId, delta) => {
        let cart = DataManager.getCart();
        const item = cart.find(i => i.productId === productId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) cart = cart.filter(i => i.productId !== productId);
            DataManager.saveCart(cart);
            window.dispatchEvent(new Event('cart-updated'));
        }
    },
    clearCart: () => { localStorage.removeItem(STORAGE_KEYS.CART); window.dispatchEvent(new Event('cart-updated')); },
    getCartItemCount: () => DataManager.getCart().reduce((acc, i) => acc + i.quantity, 0),
    getCartTotal: async (restaurantId) => {
        const rid = restaurantId || DataManager.getCurrentRestaurantId();
        const cart = DataManager.getCart();
        if (!cart.length) return 0;
        const menu = await DataManager.getMenu(rid);
        return cart.reduce((total, item) => {
            const p = menu.find(m => m.id === item.productId);
            return total + (p ? p.price * item.quantity : 0);
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
                .select('*, restaurants(id, name, logo, phone, whatsapp_phone)')
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
        const menu = await DataManager.getMenu(restaurantId);
        const cart = DataManager.getCart();
        const enrichedItems = cart.map(cartItem => {
            const p = menu.find(m => m.id === cartItem.productId);
            return { productId: cartItem.productId, quantity: cartItem.quantity, frozenName: p ? p.name : '?', frozenPrice: p ? p.price : 0, frozenImage: p ? p.image : '' };
        });
        const client = DataManager.getCurrentClient();
        const newOrder = {
            id: 'CMD-' + Date.now().toString().slice(-6),
            status: 'Nouvelle', restaurant_id: restaurantId,
            type: orderDetails.type, address: orderDetails.address,
            phone: orderDetails.phone, client_name: orderDetails.clientName,
            client_id: client ? client.id : null,
            total: orderDetails.total, items: enrichedItems, comment: orderDetails.comment || ''
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
