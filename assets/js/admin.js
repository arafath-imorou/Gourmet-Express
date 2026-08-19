/**
 * Admin.js
 * Handles multi-restaurant authentication, order management and navigation for the restaurant admin interface.
 */

// --- Authentication Guard ---
function checkAuth() {
    const staff = (typeof DataManager !== 'undefined') ? DataManager.getCurrentStaff() : null;
    const token = sessionStorage.getItem('admin_token');

    const isAuthenticated = staff || token;

    const loginOverlay = document.getElementById('login-overlay');
    const dashboardContent = document.getElementById('dashboard-content');

    if (loginOverlay && dashboardContent) {
        // We are on index.html with login form
        if (isAuthenticated) {
            loginOverlay.style.display = 'none';
            dashboardContent.style.display = 'block';
            if (window.renderAdminOrders) window.renderAdminOrders();
        } else {
            loginOverlay.style.display = 'flex';
            dashboardContent.style.display = 'none';
        }
    } else {
        // We are on sub-pages (menu.html, clients.html, administration.html, order-detail.html)
        if (!isAuthenticated) {
            window.location.href = '../login.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Run auth check on load
    checkAuth();

    // Setup legacy login form if exists on index.html
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = e.target.username.value;
            const pass = e.target.password.value;

            if (user === 'Admin' && pass === 'Admin123') {
                sessionStorage.setItem('admin_token', 'valid');
                checkAuth();
            } else {
                const errBox = document.getElementById('error-box');
                if (errBox) errBox.style.display = 'block';
            }
        });
    }
});

window.logout = () => {
    sessionStorage.removeItem('admin_token');
    if (typeof DataManager !== 'undefined') {
        DataManager.logout();
    }
    window.location.href = '../login.html';
};
