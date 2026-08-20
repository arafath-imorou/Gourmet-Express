/**
 * Admin.js
 * Handles multi-tenant authentication and navigation for restaurant staff.
 */

function checkAuth() {
    if (typeof DataManager === 'undefined') return true;
    const staff = DataManager.getCurrentStaff();
    if (!staff) {
        window.location.href = '../login.html';
        return false;
    }
    return true;
}

window.logout = () => {
    sessionStorage.removeItem('admin_token');
    if (typeof DataManager !== 'undefined') {
        DataManager.logout();
    }
    window.location.href = '../login.html';
};
