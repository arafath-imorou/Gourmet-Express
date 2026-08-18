-- ==============================================================================
-- GOURMET EXPRESS - INITIALISATION COMPLÈTE BASE DE DONNÉES SUPABASE
-- À exécuter dans le SQL Editor de Supabase (https://egpgppglcnwrzznhzgbi.supabase.co)
-- ==============================================================================

-- 1. TABLE : restaurants
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

-- 2. TABLE : staff (superadmin, admin de restaurant, agents)
CREATE TABLE IF NOT EXISTS public.staff (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    firstname text NOT NULL,
    lastname text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text NOT NULL DEFAULT 'agent', -- superadmin | admin | agent
    agent_role text, -- administrateur | caissier | serveur | cuisinier | livreur
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

-- 3. TABLE : restau_clients
CREATE TABLE IF NOT EXISTS public.restau_clients (
    id text PRIMARY KEY,
    firstname text,
    lastname text,
    email text,
    phone text,
    password text,
    points integer DEFAULT 0,
    join_date timestamptz DEFAULT now(),
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

-- 4. TABLE : restau_menu
CREATE TABLE IF NOT EXISTS public.restau_menu (
    id text PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric NOT NULL,
    image text,
    category text,
    available boolean DEFAULT true,
    active boolean DEFAULT true,
    description text,
    created_at timestamptz DEFAULT now()
);

-- 5. TABLE : restau_orders
CREATE TABLE IF NOT EXISTS public.restau_orders (
    id text PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
    date timestamptz DEFAULT now(),
    status text DEFAULT 'Nouvelle',
    type text,
    address text,
    phone text,
    client_name text,
    client_id text REFERENCES public.restau_clients(id) ON DELETE SET NULL,
    total numeric,
    items jsonb,
    comment text,
    created_at timestamptz DEFAULT now()
);

-- 6. TABLE : restau_reviews
CREATE TABLE IF NOT EXISTS public.restau_reviews (
    id text PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    date timestamptz DEFAULT now(),
    order_id text,
    client_id text,
    rating integer,
    comment text,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- SÉCURITÉ : ROW LEVEL SECURITY (RLS) & POLICIES
-- ==============================================================================
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurants_all_policy" ON public.restaurants;
CREATE POLICY "restaurants_all_policy" ON public.restaurants FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_all_policy" ON public.staff;
CREATE POLICY "staff_all_policy" ON public.staff FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.restau_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_all_policy" ON public.restau_clients;
CREATE POLICY "clients_all_policy" ON public.restau_clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.restau_menu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_all_policy" ON public.restau_menu;
CREATE POLICY "menu_all_policy" ON public.restau_menu FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.restau_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_all_policy" ON public.restau_orders;
CREATE POLICY "orders_all_policy" ON public.restau_orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.restau_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_all_policy" ON public.restau_reviews;
CREATE POLICY "reviews_all_policy" ON public.restau_reviews FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- DONNÉES INITIALES (SEED DATA)
-- ==============================================================================

-- Superadmin de la Plateforme (Accès aux 4 modules)
INSERT INTO public.staff (restaurant_id, firstname, lastname, email, password, role, status)
VALUES (NULL, 'Super', 'Admin', 'superadmin@restau.com', 'Admin123', 'superadmin', 'active')
ON CONFLICT DO NOTHING;

-- Restaurant de Démonstration : Gourmet Express
INSERT INTO public.restaurants (id, name, slug, address, phone, logo, description, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Gourmet Express',
    'gourmet-express',
    'Quartier Gah, Parakou, Bénin',
    '+229 01 96 79 14 70',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=500&q=60',
    'Vos plats préférés, livrés chez vous ou à emporter.',
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- Compte Administrateur du Restaurant Gourmet Express
INSERT INTO public.staff (restaurant_id, firstname, lastname, email, password, role, agent_role, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Admin', 'Gourmet', 'admin@gourmet.com', 'Admin2026', 'admin', 'administrateur', 'active')
ON CONFLICT DO NOTHING;

-- Plats initiaux pour Gourmet Express
INSERT INTO public.restau_menu (id, restaurant_id, name, price, image, category, available, active, description) VALUES
('1', '11111111-1111-1111-1111-111111111111', 'Burger Classique', 8500, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=60', 'Burgers', true, true, 'Steak de bœuf, cheddar, laitue, tomate, sauce maison.'),
('2', '11111111-1111-1111-1111-111111111111', 'Pizza Margherita', 9000, 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=500&q=60', 'Pizzas', true, true, 'Tomate, mozzarella, basilic frais.'),
('3', '11111111-1111-1111-1111-111111111111', 'Salade César', 6500, 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=500&q=60', 'Salades', true, true, 'Poulet grillé, parmesan, croûtons, sauce César.'),
('4', '11111111-1111-1111-1111-111111111111', 'Sushi Mix', 12000, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=500&q=60', 'Asiatique', true, true, 'Assortiment de 12 pièces : nigiri, maki, california.'),
('5', '11111111-1111-1111-1111-111111111111', 'Tacos Poulet', 5000, 'https://images.unsplash.com/photo-1613514785940-daed07799d9b?auto=format&fit=crop&w=500&q=60', 'Tacos', true, true, 'Poulet mariné, frites, sauce fromagère.'),
('6', '11111111-1111-1111-1111-111111111111', 'Jus d''Orange Frais', 2500, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=500&q=60', 'Boissons', true, true, 'Presse minute 33cl.')
ON CONFLICT (id) DO NOTHING;
