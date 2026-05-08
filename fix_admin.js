const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'admin/index.html');
let content = fs.readFileSync(file, 'utf8');

// Replace Nav
content = content.replace(
    /<div class="admin-nav desktop-only">\s*<a href="index\.html" class="active">Commandes<\/a>/g,
    `<div class="admin-nav desktop-only">
            <span id="nav-restaurant-name" style="font-weight:700;color:var(--primary-color);margin-right:12px;">Restaurant</span>
            <a href="index.html" class="active">Commandes</a>`
);

content = content.replace(
    /<a href="menu\.html">Menu<\/a>\s*<a href="clients\.html">Clients<\/a>/g,
    `<a href="menu.html">Menu</a>
            <a href="agents.html" id="nav-agents" style="display:none;">Agents</a>
            <a href="clients.html">Clients</a>`
);

// Replace Script Block
content = content.replace(
    /<script>\s*\/\/\s*Override renderAdminOrders for table view\s*async function renderAdminOrders\(\) {/g,
    `<script>
        // Multi-restaurant auth guard
        document.addEventListener('DOMContentLoaded', () => {
            const staff = DataManager.getCurrentStaff();
            const loginOverlay = document.getElementById('login-overlay');
            const dashboardContent = document.getElementById('dashboard-content');
            if (staff && (staff.role === 'admin' || staff.role === 'agent')) {
                if (loginOverlay) loginOverlay.style.display = 'none';
                if (dashboardContent) dashboardContent.style.display = 'block';
                const nameEl = document.getElementById('nav-restaurant-name');
                if (nameEl) nameEl.textContent = staff.restaurant_name || '';
                if (staff.role === 'admin' || staff.agent_role === 'administrateur') {
                    const agentsLink = document.getElementById('nav-agents');
                    if (agentsLink) agentsLink.style.display = 'inline';
                }
                renderAdminOrders();
            } else if (loginOverlay && dashboardContent) {
                loginOverlay.style.display = 'flex';
                dashboardContent.style.display = 'none';
            }
        });
        function logout() { DataManager.logout(); window.location.href = '../login.html'; }
        function resetFilters() {
            ['filter-search','filter-date-specific'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
            ['filter-date','filter-status','filter-mode'].forEach(id => { const el = document.getElementById(id); if(el) el.value='all'; });
            renderAdminOrders();
        }

        // Override renderAdminOrders for table view
        async function renderAdminOrders() {`
);

// Search Name fix
content = content.replace(
    /searchMatch = order\.clientName\.toLowerCase\(\)\.includes\(filterSearch\) \|\|/g,
    `const cn = (order.client_name || order.clientName || '').toLowerCase();
                    searchMatch = cn.includes(filterSearch) ||`
);

// Name Field in table
content = content.replace(
    /<div>\$\{order\.clientName\}<\/div>\s*<div class="text-xs text-muted">\$\{order\.phone\}<\/div>/g,
    `<div>\${order.client_name || order.clientName || 'Client'}</div>
                            <div class="text-xs text-muted">\${order.phone || ''}</div>`
);

fs.writeFileSync(file, content);
console.log('Fixed admin/index.html');
