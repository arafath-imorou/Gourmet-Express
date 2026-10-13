/**
 * App.js - Common UI Logic
 * Handles global elements like the cart counter and navigation state.
 */

document.addEventListener('DOMContentLoaded', () => {
    updateCartCounter();

    // Listen for cart updates from data.js
    window.addEventListener('cart-updated', updateCartCounter);

    updateAuthLink();
});

function updateAuthLink() {
    if (!window.DataManager) return;
    const client = DataManager.getCurrentClient();

    // Header Link
    const authLink = document.getElementById('auth-link');
    if (authLink) {
        if (client) {
            authLink.textContent = `${client.firstname}`;
            authLink.href = 'client/index.html';
        } else {
            authLink.textContent = 'Connexion';
            authLink.href = 'login.html';
        }
    }

    // Body Action Button
    const actionBtn = document.getElementById('action-auth-btn');
    if (actionBtn) {
        if (client) {
            actionBtn.textContent = `Mon Espace (${client.points} pts)`;
            actionBtn.href = 'client/index.html';
        } else {
            actionBtn.textContent = 'Se connecter / S\'inscrire';
            actionBtn.href = 'login.html';
        }
    }
}

function updateCartCounter() {
    if (!window.DataManager) return;
    const count = window.DataManager.getCartItemCount();
    const counters = document.querySelectorAll('.cart-counter');

    counters.forEach(el => {
        el.textContent = count;
        if (el.classList.contains('badge')) {
            el.style.display = count > 0 ? 'inline-flex' : 'none';
        } else {
            el.style.display = 'inline-flex';
        }
    });
}

// Utility to format price
function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(price || 0);
}
