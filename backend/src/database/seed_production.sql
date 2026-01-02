-- =====================================================
-- V2 Resort Production Seed Script
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Clear existing demo data
-- =====================================================

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

-- STEP 3: Seed Menu Items
-- =====================================================

-- Appetizers
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Hummus', 'حمص', 'Classic chickpea dip with tahini', 'حمص كلاسيكي مع الطحينة', 8.00, '/images/menu/hummus.jpg', true, true, 10, NOW(), NOW()
FROM menu_categories WHERE name = 'Appetizers';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Falafel', 'فلافل', 'Crispy chickpea fritters', 'فلافل مقرمشة', 10.00, '/images/menu/falafel.jpg', true, true, 15, NOW(), NOW()
FROM menu_categories WHERE name = 'Appetizers';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Tabbouleh', 'تبولة', 'Fresh parsley salad', 'سلطة بقدونس طازجة', 9.00, '/images/menu/tabbouleh.jpg', true, false, 10, NOW(), NOW()
FROM menu_categories WHERE name = 'Appetizers';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Baba Ganoush', 'بابا غنوج', 'Smoky eggplant dip', 'غموس الباذنجان المدخن', 9.00, '/images/menu/baba-ganoush.jpg', true, false, 10, NOW(), NOW()
FROM menu_categories WHERE name = 'Appetizers';

-- Salads
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Fattoush', 'فتوش', 'Lebanese bread salad', 'سلطة الخبز اللبنانية', 12.00, '/images/menu/fattoush.jpg', true, true, 10, NOW(), NOW()
FROM menu_categories WHERE name = 'Salads';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Greek Salad', 'سلطة يونانية', 'Feta, olives, tomatoes', 'جبنة فيتا، زيتون، طماطم', 14.00, '/images/menu/greek-salad.jpg', true, false, 10, NOW(), NOW()
FROM menu_categories WHERE name = 'Salads';

-- Main Courses
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Chicken Shawarma Plate', 'طبق شاورما دجاج', 'Marinated chicken with rice and salad', 'دجاج متبل مع أرز وسلطة', 18.00, '/images/menu/shawarma.jpg', true, true, 20, NOW(), NOW()
FROM menu_categories WHERE name = 'Main Courses';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Lamb Kofta', 'كفتة لحم', 'Spiced lamb skewers', 'أسياخ لحم متبلة', 22.00, '/images/menu/kofta.jpg', true, true, 25, NOW(), NOW()
FROM menu_categories WHERE name = 'Main Courses';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Grilled Sea Bass', 'سمك القاروص المشوي', 'Fresh whole fish with herbs', 'سمكة كاملة طازجة مع الأعشاب', 32.00, '/images/menu/seabass.jpg', true, true, 30, NOW(), NOW()
FROM menu_categories WHERE name = 'Main Courses';

-- Grills
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Mixed Grill', 'مشاوي مشكلة', 'Assortment of grilled meats', 'تشكيلة من اللحوم المشوية', 35.00, '/images/menu/mixed-grill.jpg', true, true, 30, NOW(), NOW()
FROM menu_categories WHERE name = 'Grills';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Beef Kebab', 'كباب لحم', 'Premium beef skewers', 'أسياخ لحم بقري فاخرة', 28.00, '/images/menu/kebab.jpg', true, true, 25, NOW(), NOW()
FROM menu_categories WHERE name = 'Grills';

-- Seafood
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Grilled Prawns', 'قريدس مشوي', 'Jumbo prawns with garlic butter', 'قريدس كبير مع زبدة الثوم', 38.00, '/images/menu/prawns.jpg', true, true, 20, NOW(), NOW()
FROM menu_categories WHERE name = 'Seafood';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Calamari', 'كالاماري', 'Crispy fried squid', 'حبار مقلي مقرمش', 16.00, '/images/menu/calamari.jpg', true, false, 15, NOW(), NOW()
FROM menu_categories WHERE name = 'Seafood';

-- Desserts
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Baklava', 'بقلاوة', 'Honey-soaked pastry', 'معجنات بالعسل', 10.00, '/images/menu/baklava.jpg', true, false, 5, NOW(), NOW()
FROM menu_categories WHERE name = 'Desserts';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Kunafa', 'كنافة', 'Cheese pastry with syrup', 'معجنات بالجبن والقطر', 12.00, '/images/menu/kunafa.jpg', true, true, 10, NOW(), NOW()
FROM menu_categories WHERE name = 'Desserts';

-- Beverages
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Fresh Orange Juice', 'عصير برتقال طازج', 'Freshly squeezed', 'عصير طازج', 6.00, '/images/menu/orange-juice.jpg', true, false, 5, NOW(), NOW()
FROM menu_categories WHERE name = 'Beverages';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Mint Lemonade', 'ليموناضة بالنعناع', 'Refreshing lemon drink', 'مشروب ليمون منعش', 5.00, '/images/menu/mint-lemonade.jpg', true, false, 5, NOW(), NOW()
FROM menu_categories WHERE name = 'Beverages';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Turkish Coffee', 'قهوة تركية', 'Traditional Arabic coffee', 'قهوة عربية تقليدية', 4.00, '/images/menu/turkish-coffee.jpg', true, false, 10, NOW(), NOW()
FROM menu_categories WHERE name = 'Beverages';

-- Kids Menu
INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Chicken Nuggets', 'ناغتس دجاج', 'Crispy chicken bites with fries', 'قطع دجاج مقرمشة مع بطاطس', 10.00, '/images/menu/nuggets.jpg', true, false, 15, NOW(), NOW()
FROM menu_categories WHERE name = 'Kids Menu';

INSERT INTO menu_items (id, category_id, name, name_ar, description, description_ar, price, image_url, is_available, is_featured, preparation_time_minutes, created_at, updated_at)
SELECT gen_random_uuid(), id, 'Mini Burger', 'برغر صغير', 'Kids-sized beef burger', 'برغر لحم بحجم صغير', 12.00, '/images/menu/mini-burger.jpg', true, false, 15, NOW(), NOW()
FROM menu_categories WHERE name = 'Kids Menu';

-- STEP 4: Seed Restaurant Tables
-- =====================================================

INSERT INTO restaurant_tables (id, table_number, capacity, location, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), '1', 2, 'Indoor', true, NOW(), NOW()),
  (gen_random_uuid(), '2', 2, 'Indoor', true, NOW(), NOW()),
  (gen_random_uuid(), '3', 4, 'Indoor', true, NOW(), NOW()),
  (gen_random_uuid(), '4', 4, 'Indoor', true, NOW(), NOW()),
  (gen_random_uuid(), '5', 4, 'Indoor', true, NOW(), NOW()),
  (gen_random_uuid(), '6', 6, 'Indoor', true, NOW(), NOW()),
  (gen_random_uuid(), '7', 6, 'Terrace', true, NOW(), NOW()),
  (gen_random_uuid(), '8', 4, 'Terrace', true, NOW(), NOW()),
  (gen_random_uuid(), '9', 4, 'Terrace', true, NOW(), NOW()),
  (gen_random_uuid(), '10', 8, 'Private', true, NOW(), NOW());

-- STEP 5: Seed Snack Bar Items
-- =====================================================

INSERT INTO snack_items (id, name, name_ar, description, price, category, image_url, is_available, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Cola', 'كولا', 'Refreshing cola drink', 3.00, 'drink', '/images/snack/cola.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Sprite', 'سبرايت', 'Lemon-lime soda', 3.00, 'drink', '/images/snack/sprite.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Water Bottle', 'زجاجة ماء', 'Still mineral water', 2.00, 'drink', '/images/snack/water.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Fresh Juice', 'عصير طازج', 'Orange or apple', 5.00, 'drink', '/images/snack/juice.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Vanilla Ice Cream', 'آيس كريم فانيلا', 'Classic vanilla scoop', 4.00, 'ice_cream', '/images/snack/vanilla-icecream.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Chocolate Ice Cream', 'آيس كريم شوكولاتة', 'Rich chocolate scoop', 4.00, 'ice_cream', '/images/snack/chocolate-icecream.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Sundae', 'صنداي', 'Ice cream with toppings', 7.00, 'ice_cream', '/images/snack/sundae.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Club Sandwich', 'كلوب ساندويتش', 'Triple-decker classic', 12.00, 'sandwich', '/images/snack/club-sandwich.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Cheese Burger', 'تشيز برغر', 'Beef patty with cheese', 10.00, 'sandwich', '/images/snack/cheeseburger.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Grilled Cheese', 'جبنة مشوية', 'Melted cheese sandwich', 6.00, 'sandwich', '/images/snack/grilled-cheese.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'French Fries', 'بطاطس مقلية', 'Crispy golden fries', 5.00, 'snack', '/images/snack/fries.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Nachos', 'ناتشوز', 'Tortilla chips with cheese', 8.00, 'snack', '/images/snack/nachos.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Popcorn', 'فوشار', 'Buttered popcorn', 4.00, 'snack', '/images/snack/popcorn.jpg', true, NOW(), NOW()),
  (gen_random_uuid(), 'Chips', 'شيبس', 'Assorted chips bag', 3.00, 'snack', '/images/snack/chips.jpg', true, NOW(), NOW());

-- STEP 6: Seed Chalets
-- =====================================================

INSERT INTO chalets (id, name, name_ar, description, description_ar, capacity, bedroom_count, bathroom_count, base_price, weekend_price, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Mountain View Chalet', 'شاليه إطلالة الجبل', 'Stunning mountain views with modern amenities', 'إطلالات جبلية خلابة مع وسائل راحة حديثة', 6, 2, 2, 150.00, 200.00, true, NOW(), NOW()),
  (gen_random_uuid(), 'Garden Chalet', 'شاليه الحديقة', 'Private garden with pool access', 'حديقة خاصة مع وصول للمسبح', 4, 1, 1, 120.00, 160.00, true, NOW(), NOW()),
  (gen_random_uuid(), 'Luxury Villa', 'الفيلا الفاخرة', 'Premium villa with all amenities', 'فيلا فاخرة بجميع وسائل الراحة', 8, 4, 3, 250.00, 350.00, true, NOW(), NOW()),
  (gen_random_uuid(), 'Cozy Cottage', 'الكوخ المريح', 'Perfect for couples', 'مثالي للأزواج', 2, 1, 1, 80.00, 100.00, true, NOW(), NOW()),
  (gen_random_uuid(), 'Family Suite', 'جناح العائلة', 'Spacious family accommodation', 'إقامة عائلية واسعة', 6, 3, 2, 180.00, 240.00, true, NOW(), NOW());

-- STEP 7: Seed Chalet Add-ons
-- =====================================================

INSERT INTO chalet_add_ons (id, name, name_ar, description, price, price_type, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Airport Transfer', 'التوصيل من المطار', 'Round-trip airport pickup', 50.00, 'one_time', true, NOW(), NOW()),
  (gen_random_uuid(), 'Extra Cleaning', 'تنظيف إضافي', 'Deep cleaning service', 30.00, 'one_time', true, NOW(), NOW()),
  (gen_random_uuid(), 'BBQ Package', 'حزمة الشواء', 'Charcoal, utensils, and starter pack', 25.00, 'one_time', true, NOW(), NOW()),
  (gen_random_uuid(), 'Late Checkout', 'تأخير المغادرة', 'Checkout until 4 PM', 40.00, 'one_time', true, NOW(), NOW()),
  (gen_random_uuid(), 'Early Check-in', 'تسجيل وصول مبكر', 'Check-in from 10 AM', 35.00, 'one_time', true, NOW(), NOW()),
  (gen_random_uuid(), 'Breakfast Package', 'حزمة الإفطار', 'Daily breakfast for all guests', 15.00, 'per_night', true, NOW(), NOW()),
  (gen_random_uuid(), 'Welcome Fruit Basket', 'سلة فاكهة ترحيبية', 'Fresh seasonal fruits', 20.00, 'one_time', true, NOW(), NOW());

-- STEP 8: Verify counts
-- =====================================================

SELECT 'menu_categories' as table_name, COUNT(*) as count FROM menu_categories
UNION ALL SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL SELECT 'restaurant_tables', COUNT(*) FROM restaurant_tables
UNION ALL SELECT 'snack_items', COUNT(*) FROM snack_items
UNION ALL SELECT 'chalets', COUNT(*) FROM chalets
UNION ALL SELECT 'chalet_add_ons', COUNT(*) FROM chalet_add_ons;
