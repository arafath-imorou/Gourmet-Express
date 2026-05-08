-- =====================================================
-- MIGRATION V2 : Plateforme Multi-Restaurants
-- Exécuter dans l'éditeur SQL Supabase
-- =====================================================

-- 1. TABLE restaurants
CREATE TABLE IF NOT EXISTS public.restaurants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    address text,
    phone text,
    logo text,
    description text,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

-- 2. TABLE staff (superadmin, admin, agents)
CREATE TABLE IF NOT EXISTS public.staff (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    firstname text NOT NULL,
    lastname text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text NOT NULL DEFAULT 'agent',
    agent_role text, -- administrateur | caissier | serveur | cuisinier | livreur
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

-- 3. Ajouter restaurant_id aux tables existantes
ALTER TABLE public.restau_menu ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id);
ALTER TABLE public.restau_orders ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id);

-- 4. Insérer le restaurant de démonstration (Gourmet Express)
INSERT INTO public.restaurants (id, name, slug, address, phone, description, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Gourmet Express',
    'gourmet-express',
    'Quartier Gah, Parakou, BENIN',
    '00 229 01 96 79 14 70',
    'Vos plats préférés, livrés chez vous ou à emporter.',
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- 5. Lier les données existantes à Gourmet Express
UPDATE public.restau_menu SET restaurant_id = '11111111-1111-1111-1111-111111111111' WHERE restaurant_id IS NULL;
UPDATE public.restau_orders SET restaurant_id = '11111111-1111-1111-1111-111111111111' WHERE restaurant_id IS NULL;

-- 6. Superadmin (aucun restaurant)
INSERT INTO public.staff (restaurant_id, firstname, lastname, email, password, role)
VALUES (NULL, 'Super', 'Admin', 'superadmin@restau.com', 'SuperAdmin2026', 'superadmin');

-- 7. Admin de démonstration pour Gourmet Express
INSERT INTO public.staff (restaurant_id, firstname, lastname, email, password, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'Admin', 'Gourmet', 'admin@gourmet.com', 'Admin2026', 'admin');

-- 8. RLS
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurants_all" ON public.restaurants;
CREATE POLICY "restaurants_all" ON public.restaurants FOR ALL USING (true);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_all" ON public.staff;
CREATE POLICY "staff_all" ON public.staff FOR ALL USING (true);
