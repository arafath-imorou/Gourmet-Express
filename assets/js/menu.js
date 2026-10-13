/**
 * Menu.js
 * Handles rendering of menu items, interactive restaurant switching,
 * and progressive real-time cart visibility ("au fur et à mesure").
 */

let allRestaurantsList = [];
let currentCategoryFilter = 'all';
const knownProductsMap = {};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load active restaurants list (from high-speed cache)
    allRestaurantsList = await DataManager.getRestaurants(true);

    let restaurantId = DataManager.getCurrentRestaurantId();
    if (!restaurantId && allRestaurantsList.length > 0) {
        restaurantId = allRestaurantsList[0].id;
        DataManager.setCurrentRestaurant(restaurantId, allRestaurantsList[0].name);
    } else if (!restaurantId) {
        window.location.href = 'index.html';
        return;
    }

    populateRestaurantSwitcher(restaurantId);
    await loadMenuForRestaurant(restaurantId);

    // Show client orders link if logged in
    const client = DataManager.getCurrentClient();
    if (client) {
        const btn = document.getElementById('client-orders-header-btn');
        if (btn) btn.style.display = 'inline-block';
    }

    // Listen for cart updates to refresh live cart bar & product card quantities
    window.addEventListener('cart-updated', () => {
        renderMenu(currentCategoryFilter);
        updateLiveCartUI();
    });
});

function populateRestaurantSwitcher(currentId) {
    const select = document.getElementById('restaurant-switcher-select');
    if (!select) return;

    select.innerHTML = allRestaurantsList.map(r => `
        <option value="${r.id}" ${r.id === currentId ? 'selected' : ''}>
            ${r.name}
        </option>
    `).join('');

    updateSwitcherBadge(currentId);
}

function updateSwitcherBadge(restaurantId) {
    const currentResto = allRestaurantsList.find(r => r.id === restaurantId);
    const nameEl = document.getElementById('switcher-resto-name');
    const avatarEl = document.getElementById('switcher-resto-avatar');
    const headerTitle = document.querySelector('header h2');

    if (currentResto) {
        if (nameEl) nameEl.textContent = currentResto.name;
        if (avatarEl) {
            const initial = currentResto.name ? currentResto.name.charAt(0).toUpperCase() : 'R';
            avatarEl.innerHTML = currentResto.logo
                ? `<img src="${currentResto.logo}" alt="${currentResto.name}" loading="lazy">`
                : `<span>${initial}</span>`;
        }
        if (headerTitle) {
            headerTitle.innerHTML = `Notre Carte<div style="font-size:0.72rem; color:#e63946; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentResto.name}</div>`;
        }
    }
}

async function switchRestaurantFromMenu(newRestaurantId) {
    if (!newRestaurantId) return;
    const targetResto = allRestaurantsList.find(r => r.id === newRestaurantId);
    if (!targetResto) return;

    // Update in session
    DataManager.setCurrentRestaurant(targetResto.id, targetResto.name);
    updateSwitcherBadge(targetResto.id);

    showToast(`Passage au restaurant : ${targetResto.name}`);
    currentCategoryFilter = 'all';
    await loadMenuForRestaurant(targetResto.id);
}

async function loadMenuForRestaurant(restaurantId) {
    const menuContainer = document.getElementById('menu-container');
    if (menuContainer) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px; font-weight:600;">Chargement de la carte...</div>';
    }

    window.allProducts = await DataManager.getMenu(restaurantId);
    (window.allProducts || []).forEach(p => {
        if (p && p.id) knownProductsMap[p.id] = p;
    });

    renderMenu(currentCategoryFilter);
    setupCategoryFilters();
    updateLiveCartUI();
}

function renderMenu(categoryFilter = 'all') {
    currentCategoryFilter = categoryFilter;
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) return;
    const products = window.allProducts || [];
    const cart = DataManager.getCart();

    menuContainer.innerHTML = '';

    const filteredProducts = categoryFilter === 'all'
        ? products
        : products.filter(p => p.category === categoryFilter);

    const activeProducts = filteredProducts.filter(p => p.active !== false && p.available !== false);

    if (activeProducts.length === 0) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px; font-weight:600;">Aucun plat disponible pour cet établissement dans cette catégorie.</div>';
        return;
    }

    activeProducts.forEach(product => {
        const cartItem = cart.find(i => i.productId === product.id);
        const qty = cartItem ? cartItem.quantity : 0;

        const card = document.createElement('div');
        card.className = `card product-card ${qty > 0 ? 'in-cart' : ''}`;
        card.innerHTML = `
            <div class="product-image" style="background-image: url('${product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=60'}');">
                ${qty > 0 ? `<span class="in-cart-badge">${qty} au panier</span>` : ''}
            </div>
            <div class="product-details">
                <div>
                    <div class="product-header">
                        <h3 class="product-title">${product.name}</h3>
                        <span class="product-price">${formatPrice(product.price)}</span>
                    </div>
                    <p class="product-desc text-muted text-sm">${product.description || ''}</p>
                </div>
                ${qty > 0 ? `
                    <div class="card-qty-row">
                        <button type="button" class="card-qty-btn minus" onclick="changeProductQty('${product.id}', -1)" aria-label="Retirer">−</button>
                        <span class="card-qty-label">${qty} × ${formatPrice(product.price * qty)}</span>
                        <button type="button" class="card-qty-btn plus" onclick="changeProductQty('${product.id}', 1)" aria-label="Ajouter">+</button>
                    </div>
                ` : `
                    <button type="button" class="btn btn-primary btn-sm add-to-cart-btn" onclick="addToCart('${product.id}')">
                        + Ajouter au panier
                    </button>
                `}
            </div>
        `;
        menuContainer.appendChild(card);
    });
}

function setupCategoryFilters() {
    const products = (window.allProducts || []).filter(p => p.available !== false && p.active !== false);
    const existingCats = [...new Set(products.map(p => p.category).filter(Boolean))];

    const order = ['Repas', 'Boissons', 'Glaces'];
    const sortedCats = ['all'];

    order.forEach(c => {
        sortedCats.push(c);
    });

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

function updateLiveCartUI() {
    const cart = DataManager.getCart();
    const stripEl = document.getElementById('live-cart-items-strip');
    const countLabelEl = document.getElementById('live-cart-count-label');
    const totalAmountEl = document.getElementById('live-cart-total-amount');
    const orderBtnEl = document.getElementById('live-cart-order-btn');

    if (!countLabelEl || !totalAmountEl || !orderBtnEl) return;

    let totalItems = 0;
    let totalPrice = 0;
    const chipsHtml = [];

    cart.forEach(item => {
        const product = knownProductsMap[item.productId] || (window.allProducts || []).find(p => p.id === item.productId);
        const qty = item.quantity || 1;
        totalItems += qty;

        if (product) {
            const sub = (product.price || 0) * qty;
            totalPrice += sub;
            chipsHtml.push(`
                <div class="live-cart-chip">
                    <span class="live-cart-chip-name">${product.name}</span>
                    <span class="live-cart-chip-price">${formatPrice(sub)}</span>
                    <div class="live-cart-chip-controls">
                        <button type="button" class="chip-qty-btn minus" onclick="changeProductQty('${item.productId}', -1)">−</button>
                        <span class="chip-qty-val">${qty}</span>
                        <button type="button" class="chip-qty-btn plus" onclick="changeProductQty('${item.productId}', 1)">+</button>
                    </div>
                </div>
            `);
        }
    });

    if (totalItems > 0) {
        if (stripEl) {
            stripEl.innerHTML = chipsHtml.join('');
            stripEl.style.display = chipsHtml.length > 0 ? 'flex' : 'none';
        }
        countLabelEl.textContent = `${totalItems} article${totalItems > 1 ? 's' : ''} dans votre panier`;
        totalAmountEl.textContent = formatPrice(totalPrice);
        orderBtnEl.classList.remove('empty');
        orderBtnEl.innerHTML = `Commander (${totalItems}) →`;
    } else {
        if (stripEl) {
            stripEl.innerHTML = '';
            stripEl.style.display = 'none';
        }
        countLabelEl.textContent = 'Panier vide (ajoutez vos plats)';
        totalAmountEl.textContent = formatPrice(0);
        orderBtnEl.classList.add('empty');
        orderBtnEl.innerHTML = 'Voir le panier';
    }
}

window.addToCart = (id) => {
    DataManager.addToCart(id, 1);
    showToast('Plat ajouté au panier');
};

window.changeProductQty = (id, delta) => {
    DataManager.updateCartQuantity(id, delta);
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
            setTimeout(() => toast.remove(), 300);
        }, 1800);
    }, 10);
}
