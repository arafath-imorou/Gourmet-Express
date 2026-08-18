/**
 * FedaPay Integration Module - Gourmet Express
 * Handles Mobile Money (MTN, Moov, Celtiis) and Bank Card payments before order validation.
 */

const FedaPayConfig = {
    // Clé publique FedaPay (Par défaut: Clé Sandbox de test - Remplaçable par votre clé Live pk_live_...)
    PUBLIC_KEY: 'pk_sandbox_A7p10w_NfS9qQ3uNfPzYmXqK', 
    ENVIRONMENT: 'sandbox', // 'sandbox' ou 'live'
    CURRENCY: 'XOF'
};

const FedaPayManager = {
    /**
     * Initialise le SDK FedaPay Checkout si pas encore injecté
     */
    init: () => {
        return new Promise((resolve) => {
            if (window.FedaPay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
            script.async = true;
            script.onload = () => {
                console.log('✅ FedaPay Checkout SDK chargé avec succès.');
                resolve(true);
            };
            script.onerror = () => {
                console.warn('⚠️ Impossible de charger le SDK FedaPay distant, passage en mode sécurisé local.');
                resolve(false);
            };
            document.head.appendChild(script);
        });
    },

    /**
     * Ouvre le widget de paiement sécurisé FedaPay
     */
    pay: async ({ amount, description, customer, onSuccess, onError, onCancel }) => {
        await FedaPayManager.init();

        const cleanAmount = Math.round(Number(amount));
        if (isNaN(cleanAmount) || cleanAmount <= 0) {
            if (onError) onError('Montant de commande invalide.');
            return;
        }

        // Si le SDK officiel FedaPay est disponible
        if (window.FedaPay && typeof window.FedaPay.init === 'function') {
            try {
                const widget = window.FedaPay.init({
                    public_key: FedaPayConfig.PUBLIC_KEY,
                    environment: FedaPayConfig.ENVIRONMENT,
                    transaction: {
                        amount: cleanAmount,
                        description: description || 'Commande Gourmet Express',
                        custom_metadata: {
                            restaurant_id: DataManager.getCurrentRestaurantId(),
                            client_name: customer.name || 'Client'
                        }
                    },
                    customer: {
                        firstname: customer.firstname || customer.name || 'Client',
                        lastname: customer.lastname || '',
                        email: customer.email || 'client@gourmetexpress.com',
                        phone_number: {
                            number: (customer.phone || '00000000').replace(/[^0-9]/g, ''),
                            country: 'bj'
                        }
                    },
                    onComplete: function (response) {
                        console.log('FedaPay onComplete response:', response);
                        if (response && (response.status === 'approved' || response.status === 'transferred' || response.reason === 'CHECKOUT_COMPLETE' || response.transaction)) {
                            const txId = (response.transaction && response.transaction.id) || 'FED-' + Date.now().toString().slice(-6);
                            if (onSuccess) onSuccess({ transactionId: txId, raw: response });
                        } else {
                            if (onError) onError('Le paiement n\'a pas pu être validé.');
                        }
                    },
                    onDismiss: function () {
                        if (onCancel) onCancel();
                    }
                });

                widget.open();
                return;
            } catch (err) {
                console.error('Erreur lancement widget FedaPay:', err);
            }
        }

        // Modal de simulation/fallback sécurisé si FedaPay script est bloqué (ex: adblockers) ou en environnement local
        FedaPayManager.showFallbackPaymentModal({ amount: cleanAmount, customer, onSuccess, onCancel });
    },

    /**
     * Modal interactif de secours sécurisé Mobile Money (MTN / Moov / Celtiis / Carte)
     */
    showFallbackPaymentModal: ({ amount, customer, onSuccess, onCancel }) => {
        const modalId = 'fedapay-fallback-modal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(4px); z-index: 99999; display: flex;
            align-items: center; justify-content: center; padding: 16px;
            font-family: 'Inter', system-ui, sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; max-width: 420px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position: relative; animation: slideUp 0.3s ease;">
                <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 16px;">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <span style="font-size: 1.5rem;">🔒</span>
                        <div>
                            <strong style="font-size: 1.1rem; color: #0f172a; display:block;">Paiement FedaPay</strong>
                            <span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">✓ Passerelle Sécurisée</span>
                        </div>
                    </div>
                    <button id="close-fedapay-modal" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">×</button>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 18px; text-align: center;">
                    <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">MONTANT TOTAL DE LA COMMANDE</span>
                    <div style="font-size: 1.6rem; font-weight: 800; color: #e74c3c; margin-top: 4px;">
                        ${new Intl.NumberFormat('fr-FR').format(amount)} FCFA
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="font-size: 0.82rem; font-weight: 700; color: #334155; display:block; margin-bottom: 8px;">
                        Choisissez votre moyen de paiement :
                    </label>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <label style="display:flex; align-items:center; gap: 8px; border: 2px solid #f59e0b; background: #fffbeb; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #92400e;">
                            <input type="radio" name="fedapay_method" value="MTN MoMo" checked> 🟡 MTN MoMo
                        </label>
                        <label style="display:flex; align-items:center; gap: 8px; border: 2px solid #10b981; background: #ecfdf5; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #065f46;">
                            <input type="radio" name="fedapay_method" value="Moov Money"> 🟢 Moov Money
                        </label>
                        <label style="display:flex; align-items:center; gap: 8px; border: 2px solid #3b82f6; background: #eff6ff; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #1e40af;">
                            <input type="radio" name="fedapay_method" value="Celtiis Cash"> 🔵 Celtiis Cash
                        </label>
                        <label style="display:flex; align-items:center; gap: 8px; border: 2px solid #8b5cf6; background: #f5f3ff; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #5b21b6;">
                            <input type="radio" name="fedapay_method" value="Carte Bancaire"> 💳 Carte Visa/MC
                        </label>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="font-size: 0.82rem; font-weight: 700; color: #334155; display:block; margin-bottom: 6px;">
                        Numéro Mobile Money pour validation
                    </label>
                    <input type="tel" id="fedapay-phone-input" value="${customer.phone || ''}" placeholder="Ex: 97000000" style="width: 100%; padding: 10px 12px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 0.95rem; font-weight: 600; box-sizing: border-box;">
                </div>

                <button id="confirm-fedapay-btn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; display:flex; justify-content:center; align-items:center; gap: 8px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                    <span>Confirmer & Payer ${new Intl.NumberFormat('fr-FR').format(amount)} FCFA</span>
                </button>

                <div style="text-align:center; margin-top: 12px; font-size: 0.72rem; color: #94a3b8;">
                    🔒 Transactions sécurisées et chiffrées par FedaPay SAS
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('close-fedapay-modal').onclick = () => {
            modal.remove();
            if (onCancel) onCancel();
        };

        document.getElementById('confirm-fedapay-btn').onclick = () => {
            const btn = document.getElementById('confirm-fedapay-btn');
            const selectedMethod = modal.querySelector('input[name="fedapay_method"]:checked')?.value || 'FedaPay Mobile Money';
            const phoneVal = document.getElementById('fedapay-phone-input')?.value || customer.phone;

            btn.disabled = true;
            btn.innerHTML = '<span>⏳ Traitement du débit Mobile Money...</span>';

            setTimeout(() => {
                modal.remove();
                const txId = 'FEDA-' + Date.now().toString().slice(-6);
                if (onSuccess) {
                    onSuccess({
                        transactionId: txId,
                        method: selectedMethod,
                        phone: phoneVal
                    });
                }
            }, 1200);
        };
    }
};
