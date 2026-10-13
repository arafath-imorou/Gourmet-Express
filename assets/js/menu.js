/**
 * Menu.js - Ultra-Fast Zero-Latency Menu & Live Total Calculator ("tac tac")
 * Instant 0ms rendering from SWR cache, parallel fetching, and real-time Total à payer calculation.
 */

let allRestaurantsList = [];
let currentCategoryFilter = 'all';
const knownProductsMap = {};
let pulseTimeoutId = null;

function registerKnownProducts(list) {
    if (!Array.isArray(list)) return;
    list.forEach(p => {
        if (p && p.id !== undefined && p.id !== null) {
            const pid = String(p.id);
            const norm = {
                ...p,
                id: pid,
                price: Number(p.price) || 0
            };
            knownProductsMap[pid] = norm;
            knownProductsMap[p.id] = norm;
        }
    });
}

function findProductSync(productId) {
    if (productId === undefined || productId === null) return null;
    const pid = String(productId);
    if (knownProductsMap[pid]) return knownProductsMap[pid];
    if (knownProductsMap[productId]) return knownProductsMap[productId];
    const fromDM = DataManager.getProductByIdSync(pid);
    if (fromDM) {
        knownProductsMap[pid] = { ...fromDM, id: pid, price: Number(fromDM.price) || 0 };
        return knownProductsMap[pid];
    }
    const fromWin = (window.allProducts || []).find(p => p && String(p.id) === pid);
    if (fromWin) {
        knownProductsMap[pid] = { ...fromWin, id: pid, price: Number(fromWin.price) || 0 };
        return knownProductsMap[pid];
    }
    return null;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Show client orders link immediately if logged in
    const client = DataManager.getCurrentClient();
    if (client) {
        const btn = document.getElementById('client-orders-header-btn');
        if (btn) btn.style.display = 'inline-block';
    }

    // 0. Render saved restaurant name & logo immediately at 0ms
    const savedRestoName = DataManager.getCurrentRestaurantName();
    const savedRestoLogo = DataManager.getCurrentRestaurantLogo();
    if (savedRestoName || savedRestoLogo) {
        applyRestaurantHeaderLogo(savedRestoName || 'ITAMYA', savedRestoLogo);
    }

    // 1. Instant 0ms synchronous render if cache exists
    const cachedRestos = DataManager.getCachedRestaurantsSync(true);
    let restaurantId = DataManager.getCurrentRestaurantId();

    if (cachedRestos && cachedRestos.length > 0) {
        allRestaurantsList = cachedRestos;
        if (!restaurantId) {
            restaurantId = allRestaurantsList[0].id;
            DataManager.setCurrentRestaurant(restaurantId, allRestaurantsList[0].name, allRestaurantsList[0].logo);
        }
        populateRestaurantSwitcher(restaurantId);
    }

    if (restaurantId) {
        const cachedMenu = DataManager.getCachedMenuSync(restaurantId);
        if (cachedMenu && cachedMenu.length > 0) {
            window.allProducts = cachedMenu;
            registerKnownProducts(cachedMenu);
            renderMenu(currentCategoryFilter);
            setupCategoryFilters();
            updateLiveCartUI(false);
        } else {
            updateLiveCartUI(false);
        }
    } else {
        updateLiveCartUI(false);
    }

    // 2. Listen for cart updates: surgical DOM update + 0ms live total calculation
    window.addEventListener('cart-updated', () => {
        updateAllProductCardsQtyDOM();
        updateLiveCartUI(true);
    });

    // Listen for background SWR menu refresh
    window.addEventListener('menu-refreshed', (e) => {
        if (e.detail && e.detail.restaurantId === DataManager.getCurrentRestaurantId()) {
            window.allProducts = e.detail.data || [];
            registerKnownProducts(window.allProducts);
            renderMenu(currentCategoryFilter);
            setupCategoryFilters();
            updateLiveCartUI(false);
        }
    });

    // 3. Parallel fetch / background validation (never sequential waterfall!)
    const [freshRestos, freshMenu] = await Promise.all([
        DataManager.getRestaurants(true),
        restaurantId ? DataManager.getMenu(restaurantId) : Promise.resolve(null)
    ]);

    allRestaurantsList = freshRestos || [];
    if (!restaurantId && allRestaurantsList.length > 0) {
        restaurantId = allRestaurantsList[0].id;
        DataManager.setCurrentRestaurant(restaurantId, allRestaurantsList[0].name, allRestaurantsList[0].logo);
    } else if (!restaurantId) {
        window.location.href = 'index.html';
        return;
    }

    populateRestaurantSwitcher(restaurantId);

    const finalMenu = freshMenu !== null ? freshMenu : await DataManager.getMenu(restaurantId);
    registerKnownProducts(finalMenu || []);

    if (!window.allProducts || window.allProducts.length === 0 || JSON.stringify(window.allProducts) !== JSON.stringify(finalMenu)) {
        window.allProducts = finalMenu || [];
        renderMenu(currentCategoryFilter);
        setupCategoryFilters();
    }
    updateLiveCartUI(false);
});

function populateRestaurantSwitcher(currentId) {
    const select = document.getElementById('restaurant-switcher-select');
    if (!select) return;

    select.innerHTML = allRestaurantsList.map(r => `
        <option value="${r.id}" ${String(r.id) === String(currentId) ? 'selected' : ''}>
            ${r.name}
        </option>
    `).join('');

    updateSwitcherBadge(currentId);
}

let _currentDisplayedLogoSrc = null;

function applyRestaurantHeaderLogo(name, logo) {
    const nameEl = document.getElementById('switcher-resto-name');
    const avatarEl = document.getElementById('switcher-resto-avatar');
    const headerTitle = document.querySelector('header h2');

    if (nameEl && name) nameEl.textContent = name;
    if (avatarEl) {
        const logoKey = logo || ('initial:' + (name ? name.charAt(0).toUpperCase() : 'R'));
        if (_currentDisplayedLogoSrc !== logoKey) {
            _currentDisplayedLogoSrc = logoKey;
            const initial = name ? name.charAt(0).toUpperCase() : 'R';
            avatarEl.innerHTML = logo
                ? `<img src="${logo}" alt="${name || 'Restaurant'}" decoding="sync" fetchpriority="high">`
                : `<span>${initial}</span>`;
        }
    }
    if (headerTitle && name) {
        headerTitle.innerHTML = `Notre Carte<div style="font-size:0.72rem; color:#e63946; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>`;
    }
}

function updateSwitcherBadge(restaurantId) {
    const currentResto = allRestaurantsList.find(r => String(r.id) === String(restaurantId));
    if (currentResto) {
        if (currentResto.logo) {
            try { localStorage.setItem('restaurant_current_logo', currentResto.logo); } catch (e) {}
        }
        applyRestaurantHeaderLogo(currentResto.name, currentResto.logo);
    }
}

async function switchRestaurantFromMenu(newRestaurantId) {
    if (!newRestaurantId) return;
    const targetResto = allRestaurantsList.find(r => String(r.id) === String(newRestaurantId));
    if (!targetResto) return;

    DataManager.setCurrentRestaurant(targetResto.id, targetResto.name, targetResto.logo);
    updateSwitcherBadge(targetResto.id);

    showToast(`Passage au restaurant : ${targetResto.name}`);
    currentCategoryFilter = 'all';
    await loadMenuForRestaurant(targetResto.id);
}

async function loadMenuForRestaurant(restaurantId) {
    const menuContainer = document.getElementById('menu-container');

    // Instant render from cache if available
    const cached = DataManager.getCachedMenuSync(restaurantId);
    if (cached && cached.length > 0) {
        window.allProducts = cached;
        registerKnownProducts(cached);
        renderMenu(currentCategoryFilter);
        setupCategoryFilters();
        updateLiveCartUI(false);
    } else if (menuContainer) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px; font-weight:600;">Chargement de la carte...</div>';
    }

    const fresh = await DataManager.getMenu(restaurantId);
    window.allProducts = fresh || [];
    registerKnownProducts(window.allProducts);

    renderMenu(currentCategoryFilter);
    setupCategoryFilters();
    updateLiveCartUI(false);
}

function getProductActionHTML(product, qty) {
    const pid = String(product.id);
    const unitPrice = Number(product.price) || 0;
    if (qty > 0) {
        const subTotal = unitPrice * qty;
        return `
            <div class="card-qty-row">
                <button type="button" class="card-qty-btn minus" onclick="changeProductQty('${pid}', -1)" aria-label="Retirer">−</button>
                <span class="card-qty-label">${qty} choisi${qty > 1 ? 's' : ''} • ${formatPrice(subTotal)}</span>
                <button type="button" class="card-qty-btn plus" onclick="changeProductQty('${pid}', 1)" aria-label="Ajouter">+</button>
            </div>
        `;
    }
    return `
        <button type="button" class="btn btn-primary btn-sm add-to-cart-btn" onclick="addToCart('${pid}')">
            + Choisir (${formatPrice(unitPrice)})
        </button>
    `;
}

function renderMenu(categoryFilter = 'all') {
    currentCategoryFilter = categoryFilter;
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) return;
    const products = window.allProducts || [];
    const cart = DataManager.getCart();

    const filteredProducts = categoryFilter === 'all'
        ? products
        : products.filter(p => p.category === categoryFilter);

    const activeProducts = filteredProducts.filter(p => p.active !== false && p.available !== false);

    if (activeProducts.length === 0) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px; font-weight:600;">Aucun plat disponible pour cet établissement dans cette catégorie.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    activeProducts.forEach(product => {
        const pid = String(product.id);
        const unitPrice = Number(product.price) || 0;
        const cartItem = cart.find(i => String(i.productId) === pid);
        const qty = cartItem ? (Number(cartItem.quantity) || 0) : 0;

        const card = document.createElement('div');
        card.className = `card product-card ${qty > 0 ? 'in-cart' : ''}`;
        card.dataset.productId = pid;
        card.innerHTML = `
            <div class="product-image" style="background-image: url('${product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=60'}');">
                <span class="in-cart-badge" style="display: ${qty > 0 ? 'inline-block' : 'none'};">${qty} × ${formatPrice(unitPrice)} = ${formatPrice(unitPrice * qty)}</span>
            </div>
            <div class="product-details">
                <div>
                    <div class="product-header">
                        <h3 class="product-title">${product.name}</h3>
                        <span class="product-price">${formatPrice(unitPrice)}</span>
                    </div>
                    <p class="product-desc text-muted text-sm">${product.description || ''}</p>
                </div>
                <div class="product-action-slot">
                    ${getProductActionHTML(product, qty)}
                </div>
            </div>
        `;
        fragment.appendChild(card);
    });

    menuContainer.innerHTML = '';
    menuContainer.appendChild(fragment);
}

// Surgical DOM update (< 1ms, no image reload!) when cart changes
function updateAllProductCardsQtyDOM() {
    const cart = DataManager.getCart();
    const cards = document.querySelectorAll('.product-card[data-product-id]');
    cards.forEach(card => {
        const pid = String(card.dataset.productId);
        const product = findProductSync(pid);
        if (!product) return;

        const unitPrice = Number(product.price) || 0;
        const cartItem = cart.find(i => String(i.productId) === pid);
        const qty = cartItem ? (Number(cartItem.quantity) || 0) : 0;

        card.classList.toggle('in-cart', qty > 0);

        const badge = card.querySelector('.in-cart-badge');
        if (badge) {
            if (qty > 0) {
                badge.textContent = `${qty} × ${formatPrice(unitPrice)} = ${formatPrice(unitPrice * qty)}`;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        const slot = card.querySelector('.product-action-slot');
        if (slot) {
            slot.innerHTML = getProductActionHTML(product, qty);
        }
    });
}

function setupCategoryFilters() {
    const products = (window.allProducts || []).filter(p => p.available !== false && p.active !== false);
    const existingCats = [...new Set(products.map(p => p.category).filter(Boolean))];

    const order = ['Repas', 'Boissons', 'Glaces'];
    const sortedCats = ['all', ...order];

    existingCats.forEach(c => {
        if (!sortedCats.includes(c)) sortedCats.push(c);
    });

    const filterContainer = document.getElementById('category-filter');
    if (!filterContainer) return;
    filterContainer.innerHTML = '';

    const categoryNames = {
        'all': 'Tous les plats',
        'Repas': 'Repas',
        'Boissons': 'Boissons',
        'Glaces': 'Glaces'
    };

    sortedCats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-pill ${cat === currentCategoryFilter ? 'active' : ''}`;
        btn.textContent = categoryNames[cat] || cat;
        btn.dataset.category = cat;

        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMenu(cat);
        });

        filterContainer.appendChild(btn);
    });
}

// Instant 0ms calculation of "Total à payer" as meals are selected
function updateLiveCartUI(animate = false) {
    const cart = DataManager.getCart();
    const stripEl = document.getElementById('live-cart-items-strip');
    const countLabelEl = document.getElementById('live-cart-count-label');
    const totalAmountEl = document.getElementById('live-cart-total-amount');
    const orderBtnEl = document.getElementById('live-cart-order-btn');
    const clearBtnEl = document.getElementById('live-cart-clear-btn');
    const headerTotalEl = document.getElementById('header-cart-total');

    if (!countLabelEl || !totalAmountEl || !orderBtnEl) return;

    let totalItems = 0;
    let totalPrice = 0;
    const chipsHtml = [];

    cart.forEach(item => {
        const pid = String(item.productId);
        const product = findProductSync(pid);
        const qty = Number(item.quantity) || 1;
        totalItems += qty;

        const name = product ? product.name : (item.name || 'Repas');
        const unitPrice = Number(product ? product.price : item.price) || 0;
        const sub = unitPrice * qty;
        totalPrice += sub;

        chipsHtml.push(`
            <div class="live-cart-chip">
                <span class="live-cart-chip-name">${qty}× ${name}</span>
                <span class="live-cart-chip-price">${formatPrice(sub)}</span>
                <div class="live-cart-chip-controls">
                    <button type="button" class="chip-qty-btn minus" onclick="changeProductQty('${pid}', -1)">−</button>
                    <span class="chip-qty-val">${qty}</span>
                    <button type="button" class="chip-qty-btn plus" onclick="changeProductQty('${pid}', 1)">+</button>
                </div>
            </div>
        `);
    });

    const formattedTotal = formatPrice(totalPrice);

    if (totalItems > 0) {
        if (stripEl) {
            stripEl.innerHTML = chipsHtml.join('');
            stripEl.style.display = 'flex';
        }
        countLabelEl.textContent = `TOTAL À PAYER • ${totalItems} repas choisi${totalItems > 1 ? 's' : ''}`;
        totalAmountEl.textContent = formattedTotal;
        orderBtnEl.classList.remove('empty');
        orderBtnEl.innerHTML = `Commander • ${formattedTotal} →`;
        if (clearBtnEl) clearBtnEl.style.display = 'inline-flex';
        if (headerTotalEl) {
            headerTotalEl.textContent = formattedTotal;
            headerTotalEl.style.display = 'inline-block';
        }
    } else {
        if (stripEl) {
            stripEl.innerHTML = '';
            stripEl.style.display = 'none';
        }
        countLabelEl.textContent = 'TOTAL À PAYER • 0 repas choisi';
        totalAmountEl.textContent = formatPrice(0);
        orderBtnEl.classList.add('empty');
        orderBtnEl.innerHTML = 'Voir le panier';
        if (clearBtnEl) clearBtnEl.style.display = 'none';
        if (headerTotalEl) {
            headerTotalEl.style.display = 'none';
        }
    }

    if (animate && totalAmountEl) {
        totalAmountEl.classList.add('pulse');
        if (pulseTimeoutId) clearTimeout(pulseTimeoutId);
        pulseTimeoutId = setTimeout(() => {
            totalAmountEl.classList.remove('pulse');
        }, 220);
    }

    return { totalItems, totalPrice, formattedTotal };
}

window.addToCart = (id) => {
    const pid = String(id);
    const product = findProductSync(pid);
    DataManager.addToCart(pid, 1, product);
    const stats = updateLiveCartUI(true);
    if (stats) {
        showToast(`✓ Total à payer : ${stats.formattedTotal} (${stats.totalItems} repas)`);
    }
};

window.changeProductQty = (id, delta) => {
    const pid = String(id);
    DataManager.updateCartQuantity(pid, delta);
    const stats = updateLiveCartUI(true);
    if (stats && stats.totalItems > 0) {
        showToast(`Total à payer : ${stats.formattedTotal} (${stats.totalItems} repas)`);
    }
};

window.clearLiveCart = () => {
    DataManager.clearCart();
    updateLiveCartUI(true);
    showToast('Sélection réinitialisée (0 FCFA)');
};

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
        }, 1200);
    }, 10);
}
