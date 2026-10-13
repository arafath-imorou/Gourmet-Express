/**
 * ITAMYA - Order Notification & Dispatch Webhook
 * Formats order payloads and forwards real-time alerts to WhatsApp gateways,
 * Make.com, n8n, or restaurant webhook URLs.
 * Endpoint URL: https://itamya.store/api/order-webhook
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://egpgppglcnwrzznhzgbi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_8ew895OxNCne1kc4CnPshw_smMvmpMk';
const GLOBAL_NOTIFICATION_WEBHOOK = process.env.NOTIFICATION_WEBHOOK_URL || '';

/**
 * Format order into clean WhatsApp message text
 */
function formatOrderWhatsAppText(order, restaurantName) {
    const itemsText = Array.isArray(order.items)
        ? order.items.map(item => `  • ${item.quantity || 1}x ${item.frozenName || item.name || 'Article'} (${new Intl.NumberFormat('fr-FR').format((item.frozenPrice || item.price || 0) * (item.quantity || 1))} FCFA)`).join('\n')
        : '  • Aucun détail';

    const modeLabels = {
        'delivery': '🛵 Livraison à domicile',
        'takeaway': '🛍️ À emporter',
        'dinein': '🍽️ Sur place (À table)'
    };
    const modeText = modeLabels[order.type] || order.type || 'Non précisé';

    return `🔔 *NOUVELLE COMMANDE ITAMYA* 🔔\n\n` +
           `📋 *N° Commande :* ${order.id}\n` +
           `🏪 *Restaurant :* ${restaurantName || 'ITAMYA'}\n` +
           `👤 *Client :* ${order.client_name || 'Client'}\n` +
           `📞 *WhatsApp Client :* ${order.phone || 'Non renseigné'}\n` +
           `📍 *Mode :* ${modeText}\n` +
           (order.address ? `🏠 *Adresse :* ${order.address}\n` : '') +
           `\n🍽️ *ARTICLES COMMANDÉS :*\n${itemsText}\n\n` +
           `💰 *TOTAL :* ${new Intl.NumberFormat('fr-FR').format(order.total || 0)} FCFA\n` +
           (order.comment ? `📝 *Note :* ${order.comment}\n` : '') +
           `\n⚡ _Plateforme ITAMYA - https://itamya.store_`;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            service: 'ITAMYA Order Dispatch Webhook',
            status: 'online',
            endpoints: ['POST /api/order-webhook'],
            timestamp: new Date().toISOString()
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const order = body.order || body.record || body;
        const restaurantName = body.restaurant_name || body.restaurantName || 'ITAMYA';
        const targetWebhook = body.target_webhook || GLOBAL_NOTIFICATION_WEBHOOK;

        if (!order || !order.id) {
            return res.status(400).json({ error: 'Données de commande manquantes (order.id requis)' });
        }

        const whatsappMessage = formatOrderWhatsAppText(order, restaurantName);
        const webhookPayload = {
            event: 'order.created',
            order_id: order.id,
            timestamp: new Date().toISOString(),
            restaurant_id: order.restaurant_id,
            restaurant_name: restaurantName,
            client_name: order.client_name,
            client_phone: order.phone,
            total: order.total,
            type: order.type,
            address: order.address,
            items: order.items,
            whatsapp_message: whatsappMessage
        };

        const dispatchResults = [];

        // Forward to custom webhook if provided or configured
        if (targetWebhook) {
            try {
                const response = await fetch(targetWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                });
                dispatchResults.push({
                    url: targetWebhook,
                    status: response.status,
                    ok: response.ok
                });
            } catch (dispatchErr) {
                console.error('[ORDER WEBHOOK] Erreur dispatch externe:', dispatchErr);
                dispatchResults.push({
                    url: targetWebhook,
                    ok: false,
                    error: dispatchErr.message
                });
            }
        }

        return res.status(200).json({
            success: true,
            order_id: order.id,
            whatsapp_message: whatsappMessage,
            dispatch_results: dispatchResults,
            dispatched: dispatchResults.length > 0
        });

    } catch (err) {
        console.error('[ORDER WEBHOOK] Erreur:', err);
        return res.status(500).json({ error: err.message });
    }
};
