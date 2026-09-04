/**
 * Order.js
 * Handles checkout form submission and FedaPay payment verification before creating order.
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
        return;
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

    // Auto-fill and lock if logged in
    const client = DataManager.getCurrentClient();
    if (client) {
        const nameInput = document.getElementById('name');
        const phoneInput = document.getElementById('phone');
        const paymentPhoneInput = document.getElementById('payment_phone');

        if (nameInput) {
            nameInput.value = `${client.firstname || ''} ${client.lastname || ''}`.trim();
            nameInput.readOnly = true;
            nameInput.style.backgroundColor = '#f1f5f9';
            nameInput.style.color = '#334155';
            nameInput.style.borderColor = '#cbd5e1';
            nameInput.style.cursor = 'not-allowed';
            nameInput.style.fontWeight = '600';
        }

        if (phoneInput) {
            phoneInput.value = client.phone || '';
            phoneInput.readOnly = true;
            phoneInput.style.backgroundColor = '#f1f5f9';
            phoneInput.style.color = '#334155';
            phoneInput.style.borderColor = '#cbd5e1';
            phoneInput.style.cursor = 'not-allowed';
            phoneInput.style.fontWeight = '600';
        }

        if (paymentPhoneInput && client.phone) {
            paymentPhoneInput.value = client.phone;
        }

        const banner = document.createElement('div');
        banner.innerHTML = `<div style="background: #EBF8FF; color: #1e40af; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; font-size:0.9rem; font-weight:600; border: 1px solid #bfdbfe;">
            👋 Heureux de vous revoir <strong>${client.firstname}</strong> ! Vous cumulerez des points de fidélité sur cette commande.
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
                if (addressGroup) addressGroup.style.display = 'block';
                if (addressInput) addressInput.setAttribute('required', 'true');
            } else {
                if (addressGroup) addressGroup.style.display = 'none';
                if (addressInput) addressInput.removeAttribute('required');
            }
        });
    });

    // Handle Submit with FedaPay Payment
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-submit-order') || form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const orderTotal = await DataManager.getCartTotal();

        const clientName = formData.get('name') ? formData.get('name').trim() : `${client?.firstname || ''} ${client?.lastname || ''}`.trim();
        const clientEmail = (client && client.email) || 'client@gourmetexpress.com';
        const phone = formData.get('phone') ? formData.get('phone').trim() : (client?.phone || '');
        const paymentPhone = formData.get('payment_phone') ? formData.get('payment_phone').trim() : phone;
        const mode = formData.get('mode');
        const address = formData.get('address') ? formData.get('address').trim() : '';
        const userComment = formData.get('comment') ? formData.get('comment').trim() : '';
        const paymentNetwork = formData.get('payment_network') || 'MTN MoMo';

        if (!paymentPhone) {
            alert('Veuillez renseigner le numéro Mobile Money pour le débit.');
            return;
        }

        if (mode === 'delivery' && !address) {
            alert('Veuillez préciser votre adresse de livraison.');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>⏳ Traitement paiement ${paymentNetwork}...</span>`;
        }

        // Split names for clean FedaPay customer formatting
        const nameParts = clientName.split(' ');
        const firstname = nameParts[0] || 'Client';
        const lastname = nameParts.slice(1).join(' ') || firstname;

        // Lancement du paiement FedaPay
        FedaPayManager.pay({
            amount: orderTotal,
            description: `Commande ${DataManager.getCurrentRestaurantName() || 'ITAMYA'} (${paymentNetwork})`,
            customer: {
                name: clientName,
                firstname: firstname,
                lastname: lastname,
                email: clientEmail,
                phone: paymentPhone,
                network: paymentNetwork
            },
            onSuccess: async (paymentResult) => {
                if (submitBtn) {
                    submitBtn.innerHTML = '<span>✅ Paiement validé ! Enregistrement de la commande...</span>';
                }

                const actualMethod = paymentResult.method || paymentNetwork;
                const paymentInfo = `[Paiement FedaPay Validé - ${actualMethod} - Tel Débit: ${paymentPhone} - Réf: ${paymentResult.transactionId || 'FEDA'}]`;
                const finalComment = userComment ? `${paymentInfo} ${userComment}` : paymentInfo;

                const orderDetails = {
                    clientName: clientName,
                    phone: phone, // WhatsApp phone for delivery & contact
                    type: mode,
                    address: address,
                    comment: finalComment,
                    total: orderTotal,
                    status: 'Nouvelle'
                };

                // Enregistrement définitif de la commande dans Supabase
                const newOrder = await DataManager.placeOrder(orderDetails);

                if (newOrder) {
                    window.location.href = `confirmation.html?id=${newOrder.id}`;
                } else {
                    alert('Votre paiement a été validé mais une erreur est survenue lors de l\'enregistrement de la commande. Veuillez contacter le support.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span>🔒 Réessayer de valider</span>';
                    }
                }
            },
            onError: (errorMessage) => {
                alert(`Échec du paiement : ${errorMessage || 'Impossible de compléter la transaction.'}`);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>🔒 Payer & Valider la commande</span>';
                }
            },
            onCancel: () => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>🔒 Payer & Valider la commande</span>';
                }
            }
        });
    });
}
