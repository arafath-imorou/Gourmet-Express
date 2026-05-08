/**
 * Menu.js
 * Handles rendering of menu items and interactions on the menu page.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const restaurantId = DataManager.getCurrentRestaurantId();
    if (!restaurantId) {
        window.location.href = 'index.html';
        return;
    }

    const restaurantName = DataManager.getCurrentRestaurantName() || 'Restaurant';
    const headerTitle = document.querySelector('header h2');
    if (headerTitle) {
        headerTitle.innerHTML = `Notre Menu<div style="font-size:0.75rem; color:var(--primary-color); font-weight:normal;">${restaurantName}</div>`;
    }

    const menuContainer = document.getElementById('menu-container');
    if(menuContainer) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px;">Chargement du menu...</div>';
    }
    
    // Fetch menu from Supabase once
    window.allProducts = await DataManager.getMenu();
    
    renderMenu();
    setupCategoryFilters();
});

function renderMenu(categoryFilter = 'all') {
    const menuContainer = document.getElementById('menu-container');
    const products = window.allProducts || [];

    menuContainer.innerHTML = '';

    const filteredProducts = categoryFilter === 'all'
        ? products
        : products.filter(p => p.category === categoryFilter);

    if (filteredProducts.length === 0) {
        menuContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 40px;">Aucun plat trouvé dans cette catégorie.</div>';
        return;
    }

    filteredProducts.forEach(product => {
        if (!product.active) return;

        const card = document.createElement('div');
        card.className = 'card product-card';
        card.innerHTML = `
            <div class="product-image" style="background-image: url('${product.image}');"></div>
            <div class="product-details">
                <div class="product-header">
                    <h3 class="product-title">${product.name}</h3>
                    <span class="product-price">${formatPrice(product.price)}</span>
                </div>
                <p class="product-desc text-muted text-sm">${product.description || ''}</p>
                <button class="btn btn-primary btn-sm add-to-cart-btn" onclick="addToCart('${product.id}')">
                    Ajouter
                </button>
            </div>
        `;
        menuContainer.appendChild(card);
    });
}

function setupCategoryFilters() {
    const products = window.allProducts || [];
    const categories = ['all', ...new Set(products.map(p => p.category))];
    const filterContainer = document.getElementById('category-filter');

    if(!filterContainer) return;
    filterContainer.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-pill ${cat === 'all' ? 'active' : ''}`;
        btn.textContent = cat === 'all' ? 'Tout' : cat;
        btn.dataset.category = cat;

        btn.addEventListener('click', () => {
            // Remove active class from all
            document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
            // Add to current
            btn.classList.add('active');
            renderMenu(cat);
        });

        filterContainer.appendChild(btn);
    });
}

// Global scope for onclick attribute
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
