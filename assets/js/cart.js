/**
 * Cart.js - Instant 0ms Cart Rendering & Total à payer Engine ("tac tac")
 * Renders immediately from cart snapshots & SWR cache without network delay.
 */

document.addEventListener('DOMContentLoaded', () => {
    renderCart();

    // Listen for updates (instant 0ms synchronous update on + / -)
    window.addEventListener('cart-updated', renderCart);
});

async function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('cart-checkout-btn');
    const emptyState = document.getElementById('empty-state');
    const cartContent = document.getElementById('cart-content');

    if (!cartContainer || !emptyState || !cartContent) return;

    const cart = DataManager.getCart();

    if (cart.length === 0) {
        emptyState.style.display = 'block';
        cartContent.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    cartContent.style.display = 'block';

    // Try 0ms synchronous lookup first (from product index or cart item snapshot)
    const cachedMenu = DataManager.getCachedMenuSync() || [];
    let needsAsyncFetch = false;

    for (const item of cart) {
        const pid = String(item.productId);
        const p = DataManager.getProductByIdSync(pid) || cachedMenu.find(m => String(m.id) === pid);
        const hasPrice = (p && p.price !== undefined) || (item.price !== undefined && !Number.isNaN(Number(item.price)));
        if (!hasPrice) {
            needsAsyncFetch = true;
            break;
        }
    }

    let menu = cachedMenu;
    if (needsAsyncFetch) {
        if (cartContainer.children.length === 0) {
            cartContainer.innerHTML = '<div class="text-center text-muted" style="width:100%; padding: 20px;">Chargement du panier...</div>';
        }
        menu = await DataManager.getMenu();
    }

    const fragment = document.createDocumentFragment();
    let total = 0;
    let totalItems = 0;

    cart.forEach(item => {
        const pid = String(item.productId);
        const qty = Number(item.quantity) || 1;
        totalItems += qty;

        const product = DataManager.getProductByIdSync(pid) || (menu || []).find(p => String(p.id) === pid);
        const name = product ? product.name : (item.name || 'Repas');
        const price = Number(product ? product.price : item.price) || 0;
        const image = (product && product.image) || item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=60';

        const itemTotal = price * qty;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-image" style="background-image: url('${image}');"></div>
            <div class="cart-item-details">
                <div class="font-bold">${name}</div>
                <div class="text-muted text-sm">${formatPrice(price)} × ${qty} = <strong style="color:#0f172a;">${formatPrice(itemTotal)}</strong></div>
            </div>
            <div class="quantity-controls">
                <button type="button" class="qty-btn" onclick="updateQuantity('${pid}', -1)">−</button>
                <span style="font-weight:800; min-width:18px; text-align:center;">${qty}</span>
                <button type="button" class="qty-btn" onclick="updateQuantity('${pid}', 1)">+</button>
            </div>
            <button type="button" onclick="removeItem('${pid}')" style="margin-left: 6px; border: none; background: none; font-size: 1.2rem; cursor: pointer; padding: 6px; color: #DC3545; display: flex; align-items: center;" aria-label="Supprimer">
                <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
        `;
        fragment.appendChild(div);
    });

    cartContainer.innerHTML = '';
    cartContainer.appendChild(fragment);

    const formattedTotal = formatPrice(total);
    if (totalElement) totalElement.textContent = formattedTotal;
    if (checkoutBtn) {
        checkoutBtn.innerHTML = `Commander • Payer ${formattedTotal} →`;
    }
}

window.updateQuantity = (productId, delta) => {
    DataManager.updateCartQuantity(String(productId), delta);
};

window.removeItem = (productId) => {
    DataManager.removeFromCart(String(productId));
};
