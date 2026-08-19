/**
 * Menu.js
 * Handles rendering of menu items and interactive restaurant switching.
 */

let allRestaurantsList = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load active restaurants list
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
});

function populateRestaurantSwitcher(currentId) {
    const select = document.getElementById('restaurant-switcher-select');
    if (!select) return;

    select.innerHTML = allRestaurantsList.map(r => `
        <option value="${r.id}" ${r.id === currentId ? 'selected' : ''}>
            🍽️ ${r.name}
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
            avatarEl.innerHTML = currentResto.logo 
                ? `<img src="${currentResto.logo}" alt="${currentResto.name}">`
                : '🍽️';
        }
        if (headerTitle) {
            headerTitle.innerHTML = `Notre Carte<div style="font-size:0.75rem; color:#e74c3c; font-weight:600;">${currentResto.name}</div>`;
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
    await loadMenuForRestaurant(targetResto.id);
}

async function loadMenuForRestaurant(restaurantId) {
    const menuContainer = document.getElementById('menu-container');
    if (menuContainer) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px;">Chargement de la carte...</div>';
    }

    window.allProducts = await DataManager.getMenu(restaurantId);
    renderMenu();
    setupCategoryFilters();
}

function renderMenu(categoryFilter = 'all') {
    const menuContainer = document.getElementById('menu-container');
    const products = window.allProducts || [];

    menuContainer.innerHTML = '';

    const filteredProducts = categoryFilter === 'all'
        ? products
        : products.filter(p => p.category === categoryFilter);

    if (filteredProducts.length === 0) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px; font-weight:500;">Aucun plat disponible pour cet établissement dans cette catégorie.</div>';
        return;
    }

    filteredProducts.forEach(product => {
        if (product.active === false || product.available === false) return;

        const card = document.createElement('div');
        card.className = 'card product-card';
        card.innerHTML = `
            <div class="product-image" style="background-image: url('${product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=60'}');"></div>
            <div class="product-details">
                <div class="product-header">
                    <h3 class="product-title">${product.name}</h3>
                    <span class="product-price">${formatPrice(product.price)}</span>
                </div>
                <p class="product-desc text-muted text-sm">${product.description || ''}</p>
                <button class="btn btn-primary btn-sm add-to-cart-btn" onclick="addToCart('${product.id}')">
                    + Ajouter
                </button>
            </div>
        `;
        menuContainer.appendChild(card);
    });
}

function setupCategoryFilters() {
    const products = (window.allProducts || []).filter(p => p.available !== false && p.active !== false);
    const existingCats = [...new Set(products.map(p => p.category).filter(Boolean))];
    
    // Ordre prioritaire des catégories
    const order = ['Repas', 'Boissons', 'Glaces'];
    const sortedCats = ['all'];
    
    order.forEach(c => {
        if (existingCats.includes(c) || true) {
            sortedCats.push(c);
        }
    });
    
    existingCats.forEach(c => {
        if (!sortedCats.includes(c)) sortedCats.push(c);
    });

    const filterContainer = document.getElementById('category-filter');
    if (!filterContainer) return;
    filterContainer.innerHTML = '';

    const categoryIcons = {
        'all': '🍽️ Tous les plats',
        'Repas': '🍲 Repas',
        'Boissons': '🥤 Boissons',
        'Glaces': '🍦 Glaces'
    };

    sortedCats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-pill ${cat === 'all' ? 'active' : ''}`;
        btn.textContent = categoryIcons[cat] || cat;
        btn.dataset.category = cat;

        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMenu(cat);
        });

        filterContainer.appendChild(btn);
    });
}

window.addToCart = (id) => {
    DataManager.addToCart(id, 1);
    showToast('Ajouté au panier');
};

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }, 10);
}
