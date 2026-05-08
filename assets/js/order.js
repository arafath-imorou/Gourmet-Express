/**
 * Order.js
 * Handles checkout form submission and order creation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const client = DataManager.getCurrentClient();
    const staff = DataManager.getCurrentStaff();

    if (!client && !staff) {
        window.location.href = 'login.html';
        return;
    }

    setupForm();
    checkCartValidity();
});

async function checkCartValidity() {
    const cart = DataManager.getCart();
    if (cart.length === 0) {
        window.location.href = 'menu.html';
    }

    // Display summary totals
    const totalElement = document.getElementById('summary-total');
    if (totalElement) {
        totalElement.textContent = 'Calcul...';
        const total = await DataManager.getCartTotal();
        totalElement.textContent = formatPrice(total);
    }
}

function setupForm() {
    const form = document.getElementById('order-form');
    if (!form) return;

    // Auto-fill if logged in
    const client = DataManager.getCurrentClient();
    if (client) {
        const nameInput = document.getElementById('name');
        const phoneInput = document.getElementById('phone');

        if(nameInput) {
            nameInput.value = client.firstname + ' ' + client.lastname;
            nameInput.readOnly = true;
            nameInput.style.backgroundColor = '#e9ecef';
            nameInput.style.cursor = 'not-allowed';
        }

        if(phoneInput) {
            phoneInput.value = client.phone;
            phoneInput.readOnly = true;
            phoneInput.style.backgroundColor = '#e9ecef';
            phoneInput.style.cursor = 'not-allowed';
        }

        // Add a small welcome banner
        const banner = document.createElement('div');
        banner.innerHTML = `<div style="background: #EBF8FF; color: #3B82F6; padding: 12px; border-radius: 8px; margin-bottom: 24px;">👋 Bon retour ${client.firstname} ! Vous cumulerez des points sur cette commande.</div>`;
        form.insertBefore(banner, form.firstChild);
    } else {
        // Show login prompt
        const banner = document.createElement('div');
        banner.innerHTML = `<div style="background: #FFFBEB; color: #F59E0B; padding: 12px; border-radius: 8px; margin-bottom: 24px; font-size: 0.9rem;">
            💡 <a href="login.html" style="color: inherit; font-weight: 700;">Connectez-vous</a> pour gagner des points de fidélité !
        </div>`;
        form.insertBefore(banner, form.firstChild);
    }

    const modeInputs = document.querySelectorAll('input[name="mode"]');
    const addressGroup = document.getElementById('address-group');
    const addressInput = document.getElementById('address');

    // Toggle address field
    modeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.value === 'delivery') {
                if(addressGroup) addressGroup.style.display = 'block';
                if(addressInput) addressInput.setAttribute('required', 'true');
            } else {
                if(addressGroup) addressGroup.style.display = 'none';
                if(addressInput) addressInput.removeAttribute('required');
            }
        });
    });

    // Handle Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Traitement en cours...';
        }

        const formData = new FormData(form);
        const orderTotal = await DataManager.getCartTotal();
        
        const orderDetails = {
            clientName: formData.get('name'),
            phone: formData.get('phone'),
            type: formData.get('mode'),
            address: formData.get('address') || '',
            comment: formData.get('comment') || '',
            total: orderTotal
        };

        // Create Order
        const newOrder = await DataManager.placeOrder(orderDetails);

        if (newOrder) {
            // Redirect to confirmation
            window.location.href = `confirmation.html?id=${newOrder.id}`;
        } else {
            alert('Une erreur est survenue lors de la commande.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Valider la commande';
            }
        }
    });
}
