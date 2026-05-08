/**
 * Cart.js
 * Handles rendering and interaction on the cart page.
 */

document.addEventListener('DOMContentLoaded', () => {
    renderCart();

    // Listen for updates (in case of multi-tab or internal changes)
    window.addEventListener('cart-updated', renderCart);
});

async function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    const emptyState = document.getElementById('empty-state');
    const cartContent = document.getElementById('cart-content');

    if (!cartContainer || !emptyState || !cartContent) return;

    const cart = DataManager.getCart();

    if (cart.length === 0) {
        emptyState.style.display = 'block';
        cartContent.style.display = 'none';
        return;
    }

    // Show loading state while fetching menu
    if(cartContainer.innerHTML === '') {
        cartContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 20px;">Chargement du panier...</div>';
    }

    const menu = await DataManager.getMenu();

    emptyState.style.display = 'none';
    cartContent.style.display = 'block';
    cartContainer.innerHTML = '';

    let total = 0;

    cart.forEach(item => {
        const product = menu.find(p => p.id === item.productId);
        if (!product) return; // Should not happen ideally

        const itemTotal = product.price * item.quantity;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-image" style="background-image: url('${product.image}');"></div>
            <div class="cart-item-details">
                <div class="font-bold">${product.name}</div>
                <div class="text-muted text-sm">${formatPrice(product.price)}</div>
            </div>
            <div class="quantity-controls">
                <button class="qty-btn" onclick="updateQuantity('${item.productId}', -1)">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity('${item.productId}', 1)">+</button>
            </div>
            <button onclick="removeItem('${item.productId}')" style="margin-left: 12px; border: none; background: none; font-size: 1.2rem; cursor: pointer; padding: 4px; color: #DC3545; display: flex; align-items: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
        `;
        cartContainer.appendChild(div);
    });

    if(totalElement) totalElement.textContent = formatPrice(total);
}

window.updateQuantity = (productId, delta) => {
    DataManager.updateCartQuantity(productId, delta);
};

window.removeItem = (productId) => {
    if (confirm('Voulez-vous retirer cet article du panier ?')) {
        DataManager.removeFromCart(productId);
    }
};
