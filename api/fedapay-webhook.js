/**
 * ITAMYA - FedaPay Webhook Serverless Endpoint
 * Handles asynchronous payment notifications from FedaPay (MTN MoMo, Moov Money, Celtiis, Carte).
 * Endpoint URL: https://itamya.store/api/fedapay-webhook
 */

const crypto = require('crypto');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://egpgppglcnwrzznhzgbi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_8ew895OxNCne1kc4CnPshw_smMvmpMk';
const FEDAPAY_WEBHOOK_SECRET = process.env.FEDAPAY_WEBHOOK_SECRET || process.env.FEDAPAY_SECRET_KEY || '';

/**
 * Verify FedaPay HMAC-SHA256 Webhook Signature
 * Header format: t=<timestamp>,s=<signature>
 * Signed content: <timestamp>.<rawPayload>
 */
function verifyFedaPaySignature(rawBody, signatureHeader, secret) {
    if (!secret || !signatureHeader) return { valid: false, reason: 'missing_credentials' };

    try {
        const parts = signatureHeader.split(',');
        let timestamp = null;
        let signatures = [];

        for (const part of parts) {
            const [key, value] = part.split('=', 2);
            if (key === 't') {
                timestamp = value;
            } else if (key === 's' || key === 'v1') {
                signatures.push(value);
            }
        }

        if (!timestamp || signatures.length === 0) {
            return { valid: false, reason: 'invalid_header_format' };
        }

        // Tolerance check (300 seconds / 5 minutes)
        const tsNumber = parseInt(timestamp, 10);
        const now = Math.floor(Date.now() / 1000);
        if (isNaN(tsNumber) || Math.abs(now - tsNumber) > 300) {
            return { valid: false, reason: 'timestamp_expired' };
        }

        const signedPayload = `${timestamp}.${rawBody}`;
        const computedSignature = crypto
            .createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');

        // Secure constant-time comparison
        const computedBuffer = Buffer.from(computedSignature);
        const match = signatures.some(sig => {
            const sigBuffer = Buffer.from(sig);
            return computedBuffer.length === sigBuffer.length && crypto.timingSafeEqual(computedBuffer, sigBuffer);
        });

        return { valid: match, reason: match ? null : 'signature_mismatch' };
    } catch (err) {
        return { valid: false, reason: err.message };
    }
}

/**
 * Helper to query Supabase REST API
 */
async function supabaseFetch(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(options.headers || {})
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    const text = await response.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch (e) {
        json = text;
    }

    return {
        ok: response.ok,
        status: response.status,
        data: json
    };
}

/**
 * Award loyalty points to client (+10 pts base + 1 pt per 1000 FCFA)
 */
async function awardLoyaltyPoints(clientId, totalAmount) {
    if (!clientId) return false;

    try {
        const clientRes = await supabaseFetch(`restau_clients?id=eq.${encodeURIComponent(clientId)}&select=points`);
        if (!clientRes.ok || !Array.isArray(clientRes.data) || clientRes.data.length === 0) {
            return false;
        }

        const currentPoints = clientRes.data[0].points || 0;
        const addedPoints = 10 + Math.floor(Number(totalAmount || 0) / 1000);
        const newPoints = currentPoints + addedPoints;

        await supabaseFetch(`restau_clients?id=eq.${encodeURIComponent(clientId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ points: newPoints })
        });

        return true;
    } catch (err) {
        console.error('[WEBHOOK] Erreur attribution points:', err);
        return false;
    }
}

/**
 * Main Webhook Handler
 */
module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-FEDAPAY-SIGNATURE');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Health check endpoint
    if (req.method === 'GET') {
        return res.status(200).json({
            service: 'ITAMYA FedaPay Webhook',
            status: 'online',
            environment: process.env.FEDAPAY_ENVIRONMENT || 'live',
            timestamp: new Date().toISOString()
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    try {
        // 1. Read Raw Body
        let rawBody = '';
        if (typeof req.body === 'string') {
            rawBody = req.body;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
        } else if (req.body && typeof req.body === 'object') {
            rawBody = JSON.stringify(req.body);
        }

        const signatureHeader = req.headers['x-fedapay-signature'] || req.headers['X-FEDAPAY-SIGNATURE'];
        const isSimulation = req.headers['x-fedapay-simulation'] === 'true' || req.query?.simulation === 'true';

        // 2. Signature verification if secret configured
        if (FEDAPAY_WEBHOOK_SECRET && signatureHeader && !isSimulation) {
            const verification = verifyFedaPaySignature(rawBody, signatureHeader, FEDAPAY_WEBHOOK_SECRET);
            if (!verification.valid) {
                console.warn('[WEBHOOK FEDAPAY] Signature invalide:', verification.reason);
                return res.status(400).json({ error: 'Signature invalide', detail: verification.reason });
            }
        }

        // 3. Parse JSON Event Payload
        let payload = null;
        try {
            payload = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody);
        } catch (parseErr) {
            return res.status(400).json({ error: 'Payload JSON invalide' });
        }

        const eventName = payload.name || payload.event || '';
        const entity = payload.entity || payload.data || {};
        const transactionId = entity.id || entity.reference || 'FED-' + Date.now().toString().slice(-6);
        const transactionStatus = (entity.status || '').toString().toLowerCase();
        const amount = Number(entity.amount || 0);
        const paymentMode = entity.mode || entity.payment_method?.name || 'Mobile Money';

        // Extract metadata
        const metadata = entity.custom_metadata || entity.metadata || {};
        const orderId = metadata.order_id || metadata.orderId || null;
        const restaurantId = metadata.restaurant_id || null;
        const clientId = metadata.client_id || null;

        console.log(`[WEBHOOK FEDAPAY] Reçu événement "${eventName}", statut: "${transactionStatus}", Commande: ${orderId || 'inconnue'}`);

        // 4. Handle Approved Transactions
        const isApproved = eventName === 'transaction.approved' || 
                           transactionStatus === 'approved' || 
                           transactionStatus === 'transferred';

        if (isApproved) {
            let targetOrder = null;

            // Search order by order_id if passed
            if (orderId) {
                const orderRes = await supabaseFetch(`restau_orders?id=eq.${encodeURIComponent(orderId)}&select=*`);
                if (orderRes.ok && Array.isArray(orderRes.data) && orderRes.data.length > 0) {
                    targetOrder = orderRes.data[0];
                }
            }

            // Fallback: search recent order matching amount/phone if order_id wasn't in metadata
            if (!targetOrder && entity.customer?.phone_number?.number) {
                const cleanPhone = entity.customer.phone_number.number.replace(/[^0-9]/g, '').slice(-8);
                const recentRes = await supabaseFetch(`restau_orders?phone=ilike.*${cleanPhone}*&order=created_at.desc&limit=1&select=*`);
                if (recentRes.ok && Array.isArray(recentRes.data) && recentRes.data.length > 0) {
                    targetOrder = recentRes.data[0];
                }
            }

            // Check if already reconciled (Idempotency)
            if (targetOrder) {
                const comment = targetOrder.comment || '';
                const alreadyPaid = comment.includes('Paiement FedaPay Validé') || targetOrder.status === 'En cours';

                if (alreadyPaid) {
                    console.log(`[WEBHOOK FEDAPAY] Commande ${targetOrder.id} déjà validée (idempotence).`);
                    return res.status(200).json({
                        success: true,
                        message: 'Commande déjà enregistrée et payée',
                        order_id: targetOrder.id
                    });
                }

                // Update order to 'En cours' + payment confirmation note
                const paymentNote = `[Paiement FedaPay Validé - Réf: ${transactionId} - Mode: ${paymentMode} - Montant: ${amount} FCFA]`;
                const updatedComment = comment ? `${paymentNote} ${comment}` : paymentNote;

                await supabaseFetch(`restau_orders?id=eq.${encodeURIComponent(targetOrder.id)}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        status: 'En cours',
                        comment: updatedComment
                    })
                });

                // Award loyalty points
                const orderClientId = targetOrder.client_id || clientId;
                if (orderClientId) {
                    await awardLoyaltyPoints(orderClientId, targetOrder.total || amount);
                }

                return res.status(200).json({
                    success: true,
                    event: eventName,
                    order_id: targetOrder.id,
                    status: 'En cours',
                    transaction_id: transactionId
                });
            } else {
                // If order wasn't found (browser closed before saving), create order from entity
                const fallbackOrderId = orderId || ('CMD-' + Date.now().toString().slice(-6));
                const customerName = entity.customer ? `${entity.customer.firstname || ''} ${entity.customer.lastname || ''}`.trim() : 'Client FedaPay';
                const customerPhone = entity.customer?.phone_number?.number || '';

                const newOrder = {
                    id: fallbackOrderId,
                    status: 'En cours',
                    restaurant_id: restaurantId,
                    type: 'delivery',
                    address: 'Adresse transmise lors de la confirmation',
                    phone: customerPhone,
                    client_name: customerName || 'Client',
                    client_id: clientId,
                    total: amount,
                    items: metadata.items || [],
                    comment: `[Paiement FedaPay Validé (Auto-créé via Webhook) - Réf: ${transactionId} - Mode: ${paymentMode}]`
                };

                await supabaseFetch('restau_orders', {
                    method: 'POST',
                    body: JSON.stringify(newOrder)
                });

                if (clientId) {
                    await awardLoyaltyPoints(clientId, amount);
                }

                return res.status(200).json({
                    success: true,
                    event: eventName,
                    order_id: fallbackOrderId,
                    created_from_webhook: true,
                    transaction_id: transactionId
                });
            }
        }

        // 5. Handle Canceled or Declined Transactions
        const isCanceled = eventName === 'transaction.canceled' || 
                           eventName === 'transaction.declined' || 
                           transactionStatus === 'canceled' || 
                           transactionStatus === 'declined';

        if (isCanceled && orderId) {
            const cancelNote = `[Paiement FedaPay Refusé/Annulé - Réf: ${transactionId}]`;
            const orderRes = await supabaseFetch(`restau_orders?id=eq.${encodeURIComponent(orderId)}&select=*`);
            if (orderRes.ok && Array.isArray(orderRes.data) && orderRes.data.length > 0) {
                const current = orderRes.data[0];
                if (current.status === 'En attente' || current.status === 'Nouvelle') {
                    await supabaseFetch(`restau_orders?id=eq.${encodeURIComponent(orderId)}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            status: 'Annulée',
                            comment: current.comment ? `${cancelNote} ${current.comment}` : cancelNote
                        })
                    });
                }
            }

            return res.status(200).json({
                success: true,
                event: eventName,
                order_id: orderId,
                status: 'Annulée'
            });
        }

        // Acknowledge other events
        return res.status(200).json({
            success: true,
            message: `Événement ${eventName} reçu sans action requise`,
            received: true
        });

    } catch (error) {
        console.error('[WEBHOOK FEDAPAY] Erreur serveur:', error);
        return res.status(500).json({
            error: 'Erreur interne lors du traitement du webhook',
            message: error.message
        });
    }
};
