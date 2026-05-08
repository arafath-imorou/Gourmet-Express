/**
 * Admin.js
 * Handles order management, menu editing, and authentication for the admin interface.
 */

// --- Authentication Guard ---
function checkAuth() {
    const token = sessionStorage.getItem('admin_token');

    // Check if we are on a page that supports the login overlay (index.html)
    const loginOverlay = document.getElementById('login-overlay');
    const dashboardContent = document.getElementById('dashboard-content');

    if (loginOverlay && dashboardContent) {
        // We are on index.html with merged login
        if (token) {
            loginOverlay.style.display = 'none';
            dashboardContent.style.display = 'block';
            if (window.renderAdminOrders) window.renderAdminOrders(); // Trigger render
        } else {
            loginOverlay.style.display = 'flex';
            dashboardContent.style.display = 'none';
        }
    } else {
        // We are on other admin pages (menu, details)
        // Strict guard: if no token, redirect to index
        if (!token) {
            window.location.href = 'index.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Run auth check on load
    checkAuth();

    // Setup login form if exists (It exists on index.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = e.target.username.value;
            const pass = e.target.password.value;

            // Updated Credentials as requested
            if (user === 'Admin' && pass === 'Admin123') {
                sessionStorage.setItem('admin_token', 'valid');
                checkAuth(); // Refresh view
            } else {
                document.getElementById('error-box').style.display = 'block';
            }
        });
    }

    // Page specific renders
    if (window.location.href.includes('menu.html')) {
        renderAdminMenu();
    } else if (window.renderAdminOrders && document.getElementById('dashboard-content') && document.getElementById('dashboard-content').style.display !== 'none') {
        renderAdminOrders();
    }
});

window.logout = () => {
    sessionStorage.removeItem('admin_token');
    // If on sub-page, go to index
    if (!document.getElementById('login-overlay')) {
        window.location.href = 'index.html';
    } else {
        // Just toggle view
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('error-box').style.display = 'none';
        checkAuth();
    }
};

// --- Order Management ---
async function renderAdminOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return; // Might be overridden by index.html specific script

    container.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 20px;">Chargement des commandes...</td></tr>';
    
    const orders = await DataManager.getOrders();
    container.innerHTML = '';

    orders.forEach(order => {
        const div = document.createElement('div');
        div.className = 'card order-card';
        div.innerHTML = `
            <div class="order-header">
                <span class="font-bold">${order.id}</span>
                <span class="badge ${getStatusClass(order.status)}">${order.status}</span>
            </div>
            <div class="order-details text-sm">
                <div>👤 ${order.client_name} | 📞 ${order.phone}</div>
                <div>📍 ${order.type === 'delivery' ? 'Livraison: ' + order.address : (order.type === 'dinein' ? 'Sur place' : 'À emporter')}</div>
                <div>💰 ${formatPrice(order.total)} | 📅 ${new Date(order.date).toLocaleString()}</div>
                ${order.comment ? `<div class="text-secondary">Note: ${order.comment}</div>` : ''}
            </div>
            <div class="order-items text-sm text-muted mt-2">
                ${order.items ? order.items.length : 0} articles
            </div>
            <div class="order-actions">
                <select onchange="updateStatus('${order.id}', this.value)">
                    <option value="Nouvelle" ${order.status === 'Nouvelle' ? 'selected' : ''}>Nouvelle</option>
                    <option value="En cours" ${order.status === 'En cours' ? 'selected' : ''}>En cours</option>
                    <option value="Terminée" ${order.status === 'Terminée' ? 'selected' : ''}>Terminée</option>
                    <option value="Annulée" ${order.status === 'Annulée' ? 'selected' : ''}>Annulée</option>
                </select>
            </div>
        `;
        container.appendChild(div);
    });
}

function getStatusClass(status) {
    if (status === 'Nouvelle') return 'bg-blue';
    if (status === 'En cours') return 'bg-orange';
    if (status === 'Terminée') return 'bg-green';
    return 'bg-gray';
}

window.updateStatus = async (id, status) => {
    await DataManager.updateOrderStatus(id, status);
    if (typeof renderAdminOrders === 'function') {
        renderAdminOrders();
    }
};

// --- Menu Management ---
async function renderAdminMenu() {
    const container = document.getElementById('admin-menu-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-muted" style="padding: 20px;">Chargement du menu...</div>';

    const menu = await DataManager.getMenu();
    container.innerHTML = '';

    menu.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card menu-item-row';
        div.style.display = 'flex';
        div.style.gap = '16px';
        div.style.alignItems = 'center';
        div.style.padding = '12px';

        div.innerHTML = `
            <img src="${item.image}" style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;">
            <div style="flex: 1;">
                <div class="font-bold">${item.name}</div>
                <div class="text-sm text-muted">${formatPrice(item.price)}</div>
            </div>
            <div class="menu-actions">
                <button class="btn-icon ${item.active ? 'text-green' : 'text-red'}" onclick="toggleMenuItem('${item.id}', ${item.active})">
                    ${item.active ? 'Actif' : 'Inactif'}
                </button>
                <button class="btn-icon text-red" onclick="deleteMenuItem('${item.id}')">Suppr.</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.toggleMenuItem = async (id, currentActive) => {
    await DataManager.updateMenuItem(id, { active: !currentActive });
    renderAdminMenu();
};

window.deleteMenuItem = async (id) => {
    if (!confirm('Supprimer ce plat ?')) return;
    await DataManager.deleteMenuItem(id);
    renderAdminMenu();
};

window.addNewProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ajout...';
    }

    const newItem = {
        id: Date.now().toString(),
        name: form.name.value,
        price: parseInt(form.price.value),
        category: form.category.value,
        image: form.image.value || 'https://via.placeholder.com/150',
        description: form.description.value,
        active: true
    };

    await DataManager.addMenuItem(newItem);

    form.reset();
    alert('Produit ajouté');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ajouter le plat';
    }
    renderAdminMenu();
};
