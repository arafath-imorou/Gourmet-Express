-- ==============================================================================
-- ITAMYA - CONFIGURATION WEBHOOKS & AUTOMATISATIONS
-- À exécuter dans le SQL Editor de Supabase (https://egpgppglcnwrzznhzgbi.supabase.co)
-- ==============================================================================

-- 1. Ajout de colonnes complémentaires dans restau_orders
ALTER TABLE IF EXISTS public.restau_orders 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_ref text,
ADD COLUMN IF NOT EXISTS payment_network text;

-- 2. Ajout de configuration Webhook & WhatsApp pour chaque restaurant
ALTER TABLE IF EXISTS public.restaurants 
ADD COLUMN IF NOT EXISTS webhook_url text,
ADD COLUMN IF NOT EXISTS whatsapp_phone text;

-- 3. Table de journalisation des Webhooks (Historique & Debug)
CREATE TABLE IF NOT EXISTS public.restau_webhooks_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source text NOT NULL DEFAULT 'fedapay', -- fedapay | order_dispatch | external
    event_name text,
    order_id text,
    status text DEFAULT 'success', -- success | error | ignored
    payload jsonb,
    response text,
    created_at timestamptz DEFAULT now()
);

-- RLS pour restau_webhooks_log
ALTER TABLE public.restau_webhooks_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhooks_log_all_policy" ON public.restau_webhooks_log;
CREATE POLICY "webhooks_log_all_policy" ON public.restau_webhooks_log FOR ALL USING (true) WITH CHECK (true);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_webhooks_log_order_id ON public.restau_webhooks_log(order_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_log_created_at ON public.restau_webhooks_log(created_at DESC);

-- ==============================================================================
-- GUIDE DE CONFIGURATION DU DASHBOARD FEDAPAY
-- ==============================================================================
-- 1. Connectez-vous à votre compte FedaPay (https://fedapay.com)
-- 2. Rendez-vous dans : Paramètres -> Développeurs -> Webhooks
-- 3. Cliquez sur "Ajouter un point de terminaison" (Add Endpoint) :
--    - URL du Webhook : https://itamya.store/api/fedapay-webhook
--    - Événements à écouter :
--        * transaction.approved (Crucial pour la validation automatique)
--        * transaction.canceled (Pour marquer les abandons)
--        * transaction.declined (Pour marquer les rejets)
-- 4. Copiez la clé secrète du webhook (commençant par wh_live_...) 
--    et configurez-la dans les variables d'environnement Vercel :
--    FEDAPAY_WEBHOOK_SECRET = wh_live_...
-- ==============================================================================
