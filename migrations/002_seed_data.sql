-- =============================================================
-- VilaVest — Seed data (idempotente)
--
-- Popula a base com categorias, produtos, imagens, estoque,
-- um cliente de demonstração e alguns endereços. Projetado
-- para ser executado após 001_initial_schema.sql.
--
-- Credenciais de teste:
--   admin@vilavest.com.br        senha: vilavest123!
--   cliente@vilavest.com.br      senha: cliente123!
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- Admin (idempotente + atualiza hash caso já exista)
-- -------------------------------------------------------------
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES (
    'admin@vilavest.com.br',
    '$2b$12$bDCncc1B2U13vEZTxlacFu/.rwwa4Un3fNLktZn8KGaBemA.vRYsm',
    'Administrador VilaVest',
    'admin',
    'active'
) ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        role          = EXCLUDED.role,
        status        = EXCLUDED.status;

-- -------------------------------------------------------------
-- Cliente de demonstração (idempotente + atualiza hash)
-- -------------------------------------------------------------
INSERT INTO users (email, password_hash, full_name, phone, role, status)
VALUES (
    'cliente@vilavest.com.br',
    '$2b$12$kun1Uo6iGGG5w3rlrum.cO8U7F0il5aV.Q4P6n0OselWFydHs0yOW',
    'Cliente Demo',
    '+5511998877665',
    'customer',
    'active'
) ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status        = EXCLUDED.status;

-- Endereço padrão do cliente
INSERT INTO addresses (user_id, label, street, number, complement, neighborhood, city, state, zip_code, is_default)
SELECT id, 'Casa',
       'Av. Paulista', '1578', 'Apto 203', 'Bela Vista',
       'São Paulo', 'SP', '01310-200', true
FROM users u WHERE u.email = 'cliente@vilavest.com.br'
  AND NOT EXISTS (
    SELECT 1 FROM addresses a WHERE a.user_id = u.id
  );

-- -------------------------------------------------------------
-- Categorias
-- -------------------------------------------------------------
INSERT INTO categories (name, slug, image_url, sort_order) VALUES
    ('Camisetas',  'camisetas',  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600', 1),
    ('Calças',     'calcas',     'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600', 2),
    ('Vestidos',   'vestidos',   'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600', 3),
    ('Calçados',   'calcados',   'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600', 4),
    ('Acessórios', 'acessorios', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600', 5),
    ('Bolsas',     'bolsas',     'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600', 6)
ON CONFLICT (slug) DO NOTHING;

-- -------------------------------------------------------------
-- Produtos
-- -------------------------------------------------------------
-- Helper: (cat_slug, sku, name, slug, description, price, compare_at, brand, is_featured, weight, img_url)
WITH cat AS (
  SELECT slug, id FROM categories
),
prods (cat_slug, sku, name, slug, description, price, compare_at, brand, is_featured, weight, img) AS (
  VALUES
  -- Camisetas
  ('camisetas', 'VV-CAM-0001', 'Camiseta Oversized Essentials Preta', 'camiseta-oversized-essentials-preta',
   'Algodão pima de alta gramatura (220g), caimento oversized e lavagem stone. Peça que combina com tudo.',
   139.90::NUMERIC, 189.90::NUMERIC, 'VilaVest', true, 280,
   'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800'),
  ('camisetas', 'VV-CAM-0002', 'Camiseta Pima Off-White', 'camiseta-pima-off-white',
   'Camiseta básica em algodão pima, caimento regular. Toque macio e cor que não desbota.',
   99.90::NUMERIC, 129.90::NUMERIC, 'VilaVest', true, 220,
   'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800'),
  ('camisetas', 'VV-CAM-0003', 'Camiseta Gola V Marinho', 'camiseta-gola-v-marinho',
   'Modelagem slim, malha 30.1 penteada. Ideal para o dia a dia.',
   89.90::NUMERIC, NULL, 'VilaVest', false, 190,
   'https://images.unsplash.com/photo-1622445275576-721325763afe?w=800'),
  ('camisetas', 'VV-CAM-0004', 'Camiseta Linho Verde Oliva', 'camiseta-linho-verde-oliva',
   'Linho leve e respirável, perfeita para dias quentes. Caimento reto.',
   179.90::NUMERIC, 219.90::NUMERIC, 'VilaVest', false, 230,
   'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800'),

  -- Calças
  ('calcas', 'VV-CAL-0001', 'Calça Wide Leg Alfaiataria Preta', 'calca-wide-leg-alfaiataria-preta',
   'Alfaiataria moderna em tecido com caimento fluído. Cintura alta e passadores largos.',
   299.90::NUMERIC, 389.90::NUMERIC, 'VilaVest', true, 520,
   'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800'),
  ('calcas', 'VV-CAL-0002', 'Jeans Reto Azul Escuro', 'jeans-reto-azul-escuro',
   'Jeans reto com 2% de elastano, lavagem escura. Conforto e durabilidade para o dia a dia.',
   249.90::NUMERIC, 329.90::NUMERIC, 'Denim Co.', true, 640,
   'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'),
  ('calcas', 'VV-CAL-0003', 'Calça Cargo Bege', 'calca-cargo-bege',
   'Cargo em sarja premium com bolsos utilitários. Caimento reto.',
   279.90::NUMERIC, NULL, 'VilaVest', false, 580,
   'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=800'),

  -- Vestidos
  ('vestidos', 'VV-VES-0001', 'Vestido Midi Linho Terracota', 'vestido-midi-linho-terracota',
   'Vestido midi em linho, mangas curtas, com botões frontais. Elegância para qualquer ocasião.',
   349.90::NUMERIC, 459.90::NUMERIC, 'VilaVest', true, 420,
   'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=800'),
  ('vestidos', 'VV-VES-0002', 'Vestido Slip Seda Champagne', 'vestido-slip-seda-champagne',
   'Slip dress em viscose acetinada, alças finas, comprimento longuete.',
   429.90::NUMERIC, 559.90::NUMERIC, 'VilaVest', false, 310,
   'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800'),
  ('vestidos', 'VV-VES-0003', 'Vestido Curto Tricot Preto', 'vestido-curto-tricot-preto',
   'Tricot de algodão egípcio com gola alta. Peça coringa para o guarda-roupa.',
   389.90::NUMERIC, NULL, 'VilaVest', false, 380,
   'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=800'),

  -- Calçados
  ('calcados', 'VV-CLC-0001', 'Tênis Minimalista Branco', 'tenis-minimalista-branco',
   'Couro ecológico com solado de borracha natural. Design atemporal.',
   499.90::NUMERIC, 649.90::NUMERIC, 'WalkLab', true, 780,
   'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800'),
  ('calcados', 'VV-CLC-0002', 'Mule Couro Caramelo', 'mule-couro-caramelo',
   'Mule de salto bloco em couro natural. Conforto sem abrir mão do estilo.',
   389.90::NUMERIC, NULL, 'WalkLab', false, 520,
   'https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800'),
  ('calcados', 'VV-CLC-0003', 'Bota Coturno Preta', 'bota-coturno-preta',
   'Bota estilo coturno em couro pull-up. Solado tratorado e forração confortável.',
   629.90::NUMERIC, 799.90::NUMERIC, 'WalkLab', true, 1200,
   'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800'),

  -- Acessórios
  ('acessorios', 'VV-ACS-0001', 'Cinto Couro Legítimo Marrom', 'cinto-couro-legitimo-marrom',
   'Cinto clássico em couro italiano, fivela escovada.',
   159.90::NUMERIC, 219.90::NUMERIC, 'VilaVest', false, 220,
   'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800'),
  ('acessorios', 'VV-ACS-0002', 'Cachecol Lã Merino Cinza', 'cachecol-la-merino-cinza',
   '100% lã merino, toque macio e ótima isolação térmica.',
   199.90::NUMERIC, NULL, 'VilaVest', false, 160,
   'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800'),
  ('acessorios', 'VV-ACS-0003', 'Óculos de Sol Acetato Preto', 'oculos-sol-acetato-preto',
   'Armação em acetato italiano, lentes polarizadas UV400.',
   299.90::NUMERIC, 399.90::NUMERIC, 'Lens&Co', true, 80,
   'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800'),

  -- Bolsas
  ('bolsas', 'VV-BOL-0001', 'Bolsa Tote Couro Preto', 'bolsa-tote-couro-preto',
   'Tote espaçosa em couro legítimo, alças reforçadas e forro em algodão.',
   649.90::NUMERIC, 829.90::NUMERIC, 'VilaVest', true, 950,
   'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800'),
  ('bolsas', 'VV-BOL-0002', 'Mochila Minimalista Nylon', 'mochila-minimalista-nylon',
   'Mochila em nylon reciclado com compartimento para notebook 15”.',
   389.90::NUMERIC, 499.90::NUMERIC, 'VilaVest', false, 780,
   'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800'),
  ('bolsas', 'VV-BOL-0003', 'Carteira Slim Couro Camel', 'carteira-slim-couro-camel',
   'Slim wallet em couro vegetal com 6 compartimentos.',
   149.90::NUMERIC, NULL, 'VilaVest', false, 90,
   'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800')
)
INSERT INTO products (sku, name, slug, description, price, compare_at_price, category_id, brand, is_featured, weight_grams, is_active)
SELECT p.sku, p.name, p.slug, p.description, p.price, p.compare_at, c.id, p.brand, p.is_featured, p.weight, true
FROM prods p
JOIN cat c ON c.slug = p.cat_slug
ON CONFLICT (sku) DO NOTHING;

-- Imagem principal para cada produto (derivada da tabela temporária via re-join)
WITH prods (slug, img) AS (
  VALUES
  ('camiseta-oversized-essentials-preta', 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800'),
  ('camiseta-pima-off-white',              'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800'),
  ('camiseta-gola-v-marinho',              'https://images.unsplash.com/photo-1622445275576-721325763afe?w=800'),
  ('camiseta-linho-verde-oliva',           'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800'),
  ('calca-wide-leg-alfaiataria-preta',     'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800'),
  ('jeans-reto-azul-escuro',               'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'),
  ('calca-cargo-bege',                     'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=800'),
  ('vestido-midi-linho-terracota',         'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=800'),
  ('vestido-slip-seda-champagne',          'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800'),
  ('vestido-curto-tricot-preto',           'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=800'),
  ('tenis-minimalista-branco',             'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800'),
  ('mule-couro-caramelo',                  'https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800'),
  ('bota-coturno-preta',                   'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800'),
  ('cinto-couro-legitimo-marrom',          'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800'),
  ('cachecol-la-merino-cinza',             'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800'),
  ('oculos-sol-acetato-preto',             'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800'),
  ('bolsa-tote-couro-preto',               'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800'),
  ('mochila-minimalista-nylon',            'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800'),
  ('carteira-slim-couro-camel',            'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800')
)
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT p.id, pp.img, p.name, 0, true
FROM prods pp
JOIN products p ON p.slug = pp.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);

-- Estoque inicial para cada produto (sem variantes)
INSERT INTO stock (product_id, quantity, reserved, low_stock_threshold)
SELECT p.id, 50, 0, 5
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM stock s WHERE s.product_id = p.id AND s.variant_id IS NULL
);

COMMIT;
