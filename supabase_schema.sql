-- Schema for Commande Restau

-- 1. Table: restau_menu
CREATE TABLE IF NOT EXISTS public.restau_menu (
    id text PRIMARY KEY,
    name text NOT NULL,
    price numeric NOT NULL,
    image text,
    category text,
    active boolean DEFAULT true,
    description text
);

-- Insert Default Menu Items
INSERT INTO public.restau_menu (id, name, price, image, category, active, description) VALUES
('1', 'Burger Classique', 8500, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=60', 'Burgers', true, 'Steak de bœuf, cheddar, laitue, tomate, sauce maison.'),
('2', 'Pizza Margherita', 9000, 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=500&q=60', 'Pizzas', true, 'Tomate, mozzarella, basilic frais.'),
('3', 'Salade César', 6500, 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=500&q=60', 'Salades', true, 'Poulet grillé, parmesan, croûtons, sauce César.'),
('4', 'Sushi Mix', 12000, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=500&q=60', 'Asiatique', true, 'Assortiment de 12 pièces : nigiri, maki, california.'),
('5', 'Tacos Poulet', 5000, 'https://images.unsplash.com/photo-1613514785940-daed07799d9b?auto=format&fit=crop&w=500&q=60', 'Tacos', true, 'Poulet mariné, frires, sauce fromagère.'),
('6', 'Jus d''Orange Frais', 2500, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=500&q=60', 'Jus', true, 'Presse minute 33cl.'),
('7', 'Jack Daniel''s', 35000, 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=500&q=60', 'Whisky', true, 'Bouteille 70cl.'),
('8', 'Chivas Regal 12 ans', 45000, 'https://images.unsplash.com/photo-1613208535032-475471a93868?auto=format&fit=crop&w=500&q=60', 'Whisky', true, 'Bouteille 70cl.'),
('9', 'Château Margaux (Rouge)', 25000, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=500&q=60', 'Vins', true, 'Bouteille 75cl, Vin rouge sec.'),
('10', 'Chardonnay (Blanc)', 20000, 'https://images.unsplash.com/photo-1559563362-c667ba5f5480?auto=format&fit=crop&w=500&q=60', 'Vins', true, 'Bouteille 75cl, Vin blanc fruité.'),
('11', 'Moët & Chandon', 60000, 'https://images.unsplash.com/photo-1598155523122-38423bb4d6c1?auto=format&fit=crop&w=500&q=60', 'Champagnes', true, 'Impérial Brut, 75cl.'),
('12', 'Heineken', 1500, 'https://images.unsplash.com/photo-1524117853209-a2fc9751e707?auto=format&fit=crop&w=500&q=60', 'Bières', true, 'Bouteille 33cl.'),
('13', 'Guinness', 1500, 'https://images.unsplash.com/photo-1571506538622-d3cf4eec01ae?auto=format&fit=crop&w=500&q=60', 'Bières', true, 'Grand modèle.'),
('14', 'Coca-Cola', 1000, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=500&q=60', 'Sucreries', true, 'Canette 33cl.'),
('15', 'Fanta Orange', 1000, 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=500&q=60', 'Sucreries', true, 'Canette 33cl.'),
('16', 'Jus d''Ananas', 2000, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=500&q=60', 'Jus', true, 'Frais, 33cl.')
ON CONFLICT (id) DO NOTHING;

-- 2. Table: restau_clients
CREATE TABLE IF NOT EXISTS public.restau_clients (
    id text PRIMARY KEY,
    firstname text,
    lastname text,
    email text UNIQUE,
    phone text UNIQUE,
    password text,
    points integer DEFAULT 0,
    join_date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'active'
);

-- Insert Default Clients
INSERT INTO public.restau_clients (id, firstname, lastname, email, phone, password, points, join_date, status) VALUES
('CLT-001', 'Thomas', 'Sankara', 'thomas@example.com', '01020304', 'password123', 120, '2023-01-15T10:00:00.000Z', 'active'),
('CLT-002', 'Mariam', 'Ba', 'mariam@example.com', '05060708', 'password123', 450, '2023-02-20T14:30:00.000Z', 'active'),
('CLT-003', 'Jean', 'Koffi', 'jean@example.com', '09101112', 'password123', 50, '2023-03-10T09:15:00.000Z', 'blocked'),
('CLT-004', 'Client', 'Démo', 'client', '0152818100', 'client123', 0, '2026-02-09T08:30:00.000Z', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Table: restau_orders
CREATE TABLE IF NOT EXISTS public.restau_orders (
    id text PRIMARY KEY,
    date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'Nouvelle',
    type text,
    address text,
    phone text,
    client_name text,
    client_id text REFERENCES public.restau_clients(id),
    total numeric,
    items jsonb,
    comment text
);

-- Insert Default Orders
INSERT INTO public.restau_orders (id, date, status, type, address, phone, client_name, client_id, total, items) VALUES
('CMD-1001', '2023-10-25T12:30:00.000Z', 'Nouvelle', 'delivery', 'Quartier Administratif', '01020304', 'Thomas Sankara', 'CLT-001', 17000, '[{"productId": "1", "quantity": 2, "frozenName": "Burger Classique", "frozenPrice": 8500, "frozenImage": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd"}]'::jsonb),
('CMD-1002', '2023-10-25T13:15:00.000Z', 'En cours', 'dinein', 'Table 5', '05060708', 'Mariam Ba', 'CLT-002', 9000, '[{"productId": "2", "quantity": 1, "frozenName": "Pizza Margherita", "frozenPrice": 9000, "frozenImage": "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3"}]'::jsonb),
('CMD-1003', '2023-10-24T19:00:00.000Z', 'Terminée', 'takeaway', '', '09101112', 'Jean Koffi', 'CLT-003', 6500, '[{"productId": "3", "quantity": 1, "frozenName": "Salade César", "frozenPrice": 6500, "frozenImage": "https://images.unsplash.com/photo-1550304943-4f24f54ddde9"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 4. Table: restau_reviews
CREATE TABLE IF NOT EXISTS public.restau_reviews (
    id text PRIMARY KEY,
    date timestamp with time zone DEFAULT now(),
    order_id text,
    client_id text,
    rating integer,
    comment text
);

-- Enable basic public access to these tables (for now, similar to localStorage behavior)
-- Note: In production you'd use Row Level Security (RLS) properly.
ALTER TABLE public.restau_menu ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.restau_menu FOR SELECT USING (true);

ALTER TABLE public.restau_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON public.restau_clients FOR ALL USING (true);

ALTER TABLE public.restau_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON public.restau_orders FOR ALL USING (true);

ALTER TABLE public.restau_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON public.restau_reviews FOR ALL USING (true);
