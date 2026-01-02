-- =====================================================
-- V2 Resort Production Seed Script
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Clear existing demo data
-- =====================================================

-- Clear order-related data first (has foreign keys)
DELETE FROM restaurant_order_items;
DELETE FROM restaurant_order_status_history;
DELETE FROM restaurant_orders;
DELETE FROM snack_order_items;
DELETE FROM snack_orders;
DELETE FROM chalet_booking_add_ons;
DELETE FROM chalet_bookings;
DELETE FROM pool_tickets;
DELETE FROM pool_sessions;
DELETE FROM payments;
DELETE FROM reviews;
DELETE FROM audit_logs;
DELETE FROM notifications;

-- Clear main entity data
DELETE FROM menu_items;
DELETE FROM menu_categories;
DELETE FROM restaurant_tables;
DELETE FROM snack_items;
DELETE FROM chalet_add_ons;
DELETE FROM chalet_price_rules;
DELETE FROM chalets;

-- STEP 2: Seed Restaurant Categories
-- =====================================================

INSERT INTO menu_categories (id, name, name_ar, description, display_order, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Appetizers', 'المقبلات', 'Start your meal right', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'Salads', 'السلطات', 'Fresh and healthy salads', 2, true, NOW(), NOW()),
  (gen_random_uuid(), 'Main Courses', 'الأطباق الرئيسية', 'Hearty main dishes', 3, true, NOW(), NOW()),
  (gen_random_uuid(), 'Grills', 'المشاوي', 'Fresh from the grill', 4, true, NOW(), NOW()),
  (gen_random_uuid(), 'Seafood', 'المأكولات البحرية', 'Fresh seafood selection', 5, true, NOW(), NOW()),
  (gen_random_uuid(), 'Desserts', 'الحلويات', 'Sweet endings', 6, true, NOW(), NOW()),
  (gen_random_uuid(), 'Beverages', 'المشروبات', 'Hot and cold drinks', 7, true, NOW(), NOW()),
  (gen_random_uuid(), 'Kids Menu', 'قائمة الأطفال', 'For our young guests', 8, true, NOW(), NOW());

-- STEP 3: Seed Menu Items (using the category IDs we just created)
-- =====================================================

-- Get category IDs for reference
WITH cat AS (
  SELECT id, name FROM menu_categories
)
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, prep_time_minutes, allergens, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  c.id,
  items.name,
  items.name_ar,
  items.description,
  items.description_ar,
  items.price,
  items.image_url,
  true,
  items.featured,
  items.prep_time,
  items.allergens,
  NOW(),
  NOW()
FROM (VALUES
  -- Appetizers
  ('Appetizers', 'Hummus', 'حمص', 'Classic chickpea dip with tahini', 'حمص كلاسيكي مع الطحينة', 8.00, '/images/menu/hummus.jpg', true, 10, ARRAY['sesame']),
  ('Appetizers', 'Falafel', 'فلافل', 'Crispy chickpea fritters', 'فلافل مقرمشة', 10.00, '/images/menu/falafel.jpg', true, 15, ARRAY['gluten']),
  ('Appetizers', 'Tabbouleh', 'تبولة', 'Fresh parsley salad', 'سلطة بقدونس طازجة', 9.00, '/images/menu/tabbouleh.jpg', false, 10, NULL),
  ('Appetizers', 'Baba Ganoush', 'بابا غنوج', 'Smoky eggplant dip', 'غموس الباذنجان المدخن', 9.00, '/images/menu/baba-ganoush.jpg', false, 10, ARRAY['sesame']),
  
  -- Salads
  ('Salads', 'Fattoush', 'فتوش', 'Lebanese bread salad', 'سلطة الخبز اللبنانية', 12.00, '/images/menu/fattoush.jpg', true, 10, ARRAY['gluten']),
  ('Salads', 'Greek Salad', 'سلطة يونانية', 'Feta, olives, tomatoes', 'جبنة فيتا، زيتون، طماطم', 14.00, '/images/menu/greek-salad.jpg', false, 10, ARRAY['dairy']),
  
  -- Main Courses
  ('Main Courses', 'Chicken Shawarma Plate', 'طبق شاورما دجاج', 'Marinated chicken with rice and salad', 'دجاج متبل مع أرز وسلطة', 18.00, '/images/menu/shawarma.jpg', true, 20, NULL),
  ('Main Courses', 'Lamb Kofta', 'كفتة لحم', 'Spiced lamb skewers', 'أسياخ لحم متبلة', 22.00, '/images/menu/kofta.jpg', true, 25, NULL),
  ('Main Courses', 'Grilled Sea Bass', 'سمك القاروص المشوي', 'Fresh whole fish with herbs', 'سمكة كاملة طازجة مع الأعشاب', 32.00, '/images/menu/seabass.jpg', true, 30, ARRAY['fish']),
  
  -- Grills
  ('Grills', 'Mixed Grill', 'مشاوي مشكلة', 'Assortment of grilled meats', 'تشكيلة من اللحوم المشوية', 35.00, '/images/menu/mixed-grill.jpg', true, 30, NULL),
  ('Grills', 'Beef Kebab', 'كباب لحم', 'Premium beef skewers', 'أسياخ لحم بقري فاخرة', 28.00, '/images/menu/kebab.jpg', true, 25, NULL),
  
  -- Seafood
  ('Seafood', 'Grilled Prawns', 'قريدس مشوي', 'Jumbo prawns with garlic butter', 'قريدس كبير مع زبدة الثوم', 38.00, '/images/menu/prawns.jpg', true, 20, ARRAY['shellfish']),
  ('Seafood', 'Calamari', 'كالاماري', 'Crispy fried squid', 'حبار مقلي مقرمش', 16.00, '/images/menu/calamari.jpg', false, 15, ARRAY['shellfish', 'gluten']),
  
  -- Desserts
  ('Desserts', 'Baklava', 'بقلاوة', 'Honey-soaked pastry', 'معجنات بالعسل', 10.00, '/images/menu/baklava.jpg', false, 5, ARRAY['nuts', 'gluten']),
  ('Desserts', 'Kunafa', 'كنافة', 'Cheese pastry with syrup', 'معجنات بالجبن والقطر', 12.00, '/images/menu/kunafa.jpg', true, 10, ARRAY['dairy', 'gluten']),
  
  -- Beverages
  ('Beverages', 'Fresh Orange Juice', 'عصير برتقال طازج', 'Freshly squeezed', 'عصير طازج', 6.00, '/images/menu/orange-juice.jpg', false, 5, NULL),
  ('Beverages', 'Mint Lemonade', 'ليموناضة بالنعناع', 'Refreshing lemon drink', 'مشروب ليمون منعش', 5.00, '/images/menu/mint-lemonade.jpg', false, 5, NULL),
  ('Beverages', 'Turkish Coffee', 'قهوة تركية', 'Traditional Arabic coffee', 'قهوة عربية تقليدية', 4.00, '/images/menu/turkish-coffee.jpg', false, 10, NULL),
  
  -- Kids Menu
  ('Kids Menu', 'Chicken Nuggets', 'ناغتس دجاج', 'Crispy chicken bites with fries', 'قطع دجاج مقرمشة مع بطاطس', 10.00, '/images/menu/nuggets.jpg', false, 15, ARRAY['gluten']),
  ('Kids Menu', 'Mini Burger', 'برغر صغير', 'Kids-sized beef burger', 'برغر لحم بحجم صغير', 12.00, '/images/menu/mini-burger.jpg', false, 15, ARRAY['gluten', 'dairy'])
) AS items(category, name, name_ar, description, description_ar, price, image_url, featured, prep_time, allergens)
JOIN cat c ON c.name = items.category;

-- STEP 4: Seed Restaurant Tables
-- =====================================================

INSERT INTO restaurant_tables (id, table_number, capacity, is_available, location, qr_code, created_at, updated_at) VALUES
  (gen_random_uuid(), 1, 2, true, 'Indoor', NULL, NOW(), NOW()),
  (gen_random_uuid(), 2, 2, true, 'Indoor', NULL, NOW(), NOW()),
  (gen_random_uuid(), 3, 4, true, 'Indoor', NULL, NOW(), NOW()),
  (gen_random_uuid(), 4, 4, true, 'Indoor', NULL, NOW(), NOW()),
  (gen_random_uuid(), 5, 4, true, 'Indoor', NULL, NOW(), NOW()),
  (gen_random_uuid(), 6, 6, true, 'Indoor', NULL, NOW(), NOW()),
  (gen_random_uuid(), 7, 6, true, 'Terrace', NULL, NOW(), NOW()),
  (gen_random_uuid(), 8, 4, true, 'Terrace', NULL, NOW(), NOW()),
  (gen_random_uuid(), 9, 4, true, 'Terrace', NULL, NOW(), NOW()),
  (gen_random_uuid(), 10, 8, true, 'Private', NULL, NOW(), NOW());

-- STEP 5: Seed Snack Bar Items
-- =====================================================

INSERT INTO snack_items (id, name, name_ar, description, description_ar, price, category, image_url, is_available, created_at, updated_at) VALUES
  -- Drinks
  (gen_random_uuid(), 'Cola', 'كولا', 'Refreshing cola drink', 'مشروب كولا منعش', 3.00, 'drinks', '/images/snack/cola.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Sprite', 'سبرايت', 'Lemon-lime soda', 'صودا الليمون', 3.00, 'drinks', '/images/snack/sprite.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Water Bottle', 'زجاجة ماء', 'Still mineral water', 'مياه معدنية', 2.00, 'drinks', '/images/snack/water.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Fresh Juice', 'عصير طازج', 'Orange or apple', 'برتقال أو تفاح', 5.00, 'drinks', '/images/snack/juice.jpg', true, NOW(), NOW()),
  
  -- Ice Cream
  (gen_random_uuid(), 'Vanilla Ice Cream', 'آيس كريم فانيلا', 'Classic vanilla scoop', 'كرة فانيلا كلاسيكية', 4.00, 'ice_cream', '/images/snack/vanilla-icecream.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Chocolate Ice Cream', 'آيس كريم شوكولاتة', 'Rich chocolate scoop', 'كرة شوكولاتة غنية', 4.00, 'ice_cream', '/images/snack/chocolate-icecream.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Sundae', 'صنداي', 'Ice cream with toppings', 'آيس كريم مع إضافات', 7.00, 'ice_cream', '/images/snack/sundae.jpg', true, NOW(), NOW()),
  
  -- Sandwiches
  (gen_random_uuid(), 'Club Sandwich', 'كلوب ساندويتش', 'Triple-decker classic', 'ساندويتش ثلاثي كلاسيكي', 12.00, 'sandwiches', '/images/snack/club-sandwich.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Cheese Burger', 'تشيز برغر', 'Beef patty with cheese', 'قطعة لحم بقري مع جبن', 10.00, 'sandwiches', '/images/snack/cheeseburger.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Grilled Cheese', 'جبنة مشوية', 'Melted cheese sandwich', 'ساندويتش جبنة ذائبة', 6.00, 'sandwiches', '/images/snack/grilled-cheese.jpg', true, NOW(), NOW()),
  
  -- Snacks
  (gen_random_uuid(), 'French Fries', 'بطاطس مقلية', 'Crispy golden fries', 'بطاطس ذهبية مقرمشة', 5.00, 'snacks', '/images/snack/fries.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Nachos', 'ناتشوز', 'Tortilla chips with cheese', 'رقائق التورتيلا مع الجبن', 8.00, 'snacks', '/images/snack/nachos.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Popcorn', 'فوشار', 'Buttered popcorn', 'فوشار بالزبدة', 4.00, 'snacks', '/images/snack/popcorn.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Chips', 'شيبس', 'Assorted chips bag', 'كيس شيبس متنوع', 3.00, 'snacks', '/images/snack/chips.jpg', true, NOW(), NOW());

-- STEP 6: Seed Chalets
-- =====================================================

INSERT INTO chalets (id, name, name_ar, description, description_ar, capacity, base_price, weekend_price, image_url, amenities, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Mountain View Chalet', 'شاليه إطلالة الجبل', 'Stunning mountain views with modern amenities', 'إطلالات جبلية خلابة مع وسائل راحة حديثة', 6, 150.00, 200.00, '/images/chalets/mountain-view.jpg', ARRAY['wifi', 'ac', 'bbq', 'parking', 'kitchen'], true, NOW(), NOW()),
  (gen_random_uuid(), 'Garden Chalet', 'شاليه الحديقة', 'Private garden with pool access', 'حديقة خاصة مع وصول للمسبح', 4, 120.00, 160.00, '/images/chalets/garden.jpg', ARRAY['wifi', 'ac', 'garden', 'parking'], true, NOW(), NOW()),
  (gen_random_uuid(), 'Luxury Villa', 'الفيلا الفاخرة', 'Premium villa with all amenities', 'فيلا فاخرة بجميع وسائل الراحة', 8, 250.00, 350.00, '/images/chalets/luxury-villa.jpg', ARRAY['wifi', 'ac', 'bbq', 'parking', 'kitchen', 'jacuzzi', 'private_pool'], true, NOW(), NOW()),
  (gen_random_uuid(), 'Cozy Cottage', 'الكوخ المريح', 'Perfect for couples', 'مثالي للأزواج', 2, 80.00, 100.00, '/images/chalets/cottage.jpg', ARRAY['wifi', 'ac', 'parking'], true, NOW(), NOW()),
  (gen_random_uuid(), 'Family Suite', 'جناح العائلة', 'Spacious family accommodation', 'إقامة عائلية واسعة', 6, 180.00, 240.00, '/images/chalets/family-suite.jpg', ARRAY['wifi', 'ac', 'bbq', 'parking', 'kitchen', 'playground'], true, NOW(), NOW());

-- STEP 7: Seed Chalet Add-ons
-- =====================================================

INSERT INTO chalet_add_ons (id, name, name_ar, description, description_ar, price, category, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Airport Transfer', 'التوصيل من المطار', 'Round-trip airport pickup', 'توصيل ذهاب وإياب من المطار', 50.00, 'transport', true, NOW(), NOW()),
  (gen_random_uuid(), 'Extra Cleaning', 'تنظيف إضافي', 'Deep cleaning service', 'خدمة تنظيف عميق', 30.00, 'service', true, NOW(), NOW()),
  (gen_random_uuid(), 'BBQ Package', 'حزمة الشواء', 'Charcoal, utensils, and starter pack', 'فحم وأدوات ومستلزمات بدء', 25.00, 'amenity', true, NOW(), NOW()),
  (gen_random_uuid(), 'Late Checkout', 'تأخير المغادرة', 'Checkout until 4 PM', 'المغادرة حتى الساعة 4 مساءً', 40.00, 'service', true, NOW(), NOW()),
  (gen_random_uuid(), 'Early Check-in', 'تسجيل وصول مبكر', 'Check-in from 10 AM', 'تسجيل الوصول من الساعة 10 صباحاً', 35.00, 'service', true, NOW(), NOW()),
  (gen_random_uuid(), 'Breakfast Package', 'حزمة الإفطار', 'Daily breakfast for all guests', 'إفطار يومي لجميع الضيوف', 15.00, 'food', true, NOW(), NOW()),
  (gen_random_uuid(), 'Welcome Fruit Basket', 'سلة فاكهة ترحيبية', 'Fresh seasonal fruits', 'فواكه موسمية طازجة', 20.00, 'food', true, NOW(), NOW());

-- STEP 8: Verify the data was inserted
-- =====================================================

DO $$
DECLARE
  cat_count INTEGER;
  item_count INTEGER;
  table_count INTEGER;
  snack_count INTEGER;
  chalet_count INTEGER;
  addon_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cat_count FROM menu_categories;
  SELECT COUNT(*) INTO item_count FROM menu_items;
  SELECT COUNT(*) INTO table_count FROM restaurant_tables;
  SELECT COUNT(*) INTO snack_count FROM snack_items;
  SELECT COUNT(*) INTO chalet_count FROM chalets;
  SELECT COUNT(*) INTO addon_count FROM chalet_add_ons;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Menu Categories: %', cat_count;
  RAISE NOTICE 'Menu Items: %', item_count;
  RAISE NOTICE 'Restaurant Tables: %', table_count;
  RAISE NOTICE 'Snack Items: %', snack_count;
  RAISE NOTICE 'Chalets: %', chalet_count;
  RAISE NOTICE 'Chalet Add-ons: %', addon_count;
  RAISE NOTICE '========================================';
END $$;
