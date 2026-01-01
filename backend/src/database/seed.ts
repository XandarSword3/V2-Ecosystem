import bcrypt from 'bcryptjs';
import { getPool, initializeDatabase, closeDatabase } from './connection.js';
import { logger } from '../utils/logger.js';

async function seed() {
  try {
    await initializeDatabase();
    const pool = getPool();

    logger.info('Seeding database...');

    // Create roles
    await pool.query(`
      INSERT INTO roles (name, display_name, description, business_unit) VALUES
        ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
        ('customer', 'Customer', 'Registered customer', NULL),
        ('restaurant_admin', 'Restaurant Admin', 'Restaurant management', 'restaurant'),
        ('restaurant_staff', 'Restaurant Staff', 'Restaurant operations', 'restaurant'),
        ('snack_bar_admin', 'Snack Bar Admin', 'Snack bar management', 'snack_bar'),
        ('snack_bar_staff', 'Snack Bar Staff', 'Snack bar operations', 'snack_bar'),
        ('chalet_admin', 'Chalet Admin', 'Chalet management', 'chalets'),
        ('chalet_staff', 'Chalet Staff', 'Chalet operations', 'chalets'),
        ('pool_admin', 'Pool Admin', 'Pool management', 'pool'),
        ('pool_staff', 'Pool Staff', 'Pool operations', 'pool')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminResult = await pool.query(`
      INSERT INTO users (email, password_hash, full_name, email_verified, is_active)
      VALUES ('admin@v2resort.com', $1, 'System Administrator', true, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
      RETURNING id;
    `, [adminPassword]);

    const adminId = adminResult.rows[0].id;

    // Assign super_admin role
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = 'super_admin'
      ON CONFLICT DO NOTHING;
    `, [adminId]);

    // Create sample menu categories
    await pool.query(`
      INSERT INTO menu_categories (name, name_ar, description, display_order) VALUES
        ('Appetizers', 'مقبلات', 'Start your meal with our delicious appetizers', 1),
        ('Main Courses', 'أطباق رئيسية', 'Hearty main dishes', 2),
        ('Grilled', 'مشاوي', 'Fresh from the grill', 3),
        ('Seafood', 'مأكولات بحرية', 'Fresh seafood dishes', 4),
        ('Desserts', 'حلويات', 'Sweet endings', 5),
        ('Beverages', 'مشروبات', 'Refreshing drinks', 6)
      ON CONFLICT DO NOTHING;
    `);

    // Get category IDs
    const categories = await pool.query(`SELECT id, name FROM menu_categories`);
    const categoryMap = new Map(categories.rows.map(c => [c.name, c.id]));

    // Create sample menu items
    if (categoryMap.has('Appetizers')) {
      await pool.query(`
        INSERT INTO menu_items (category_id, name, name_ar, description, price, preparation_time_minutes, is_featured) VALUES
          ($1, 'Hummus', 'حمص', 'Classic Lebanese hummus with olive oil', 8.00, 5, true),
          ($1, 'Falafel', 'فلافل', 'Crispy falafel served with tahini', 10.00, 10, false),
          ($1, 'Fattoush', 'فتوش', 'Fresh garden salad with crispy pita', 12.00, 8, true),
          ($1, 'Tabbouleh', 'تبولة', 'Traditional parsley salad', 10.00, 10, false)
        ON CONFLICT DO NOTHING;
      `, [categoryMap.get('Appetizers')]);
    }

    if (categoryMap.has('Main Courses')) {
      await pool.query(`
        INSERT INTO menu_items (category_id, name, name_ar, description, price, preparation_time_minutes) VALUES
          ($1, 'Chicken Shawarma Plate', 'صحن شاورما دجاج', 'Tender chicken shawarma with rice and salad', 18.00, 15),
          ($1, 'Lamb Kofta', 'كفتة لحم', 'Grilled lamb kofta with vegetables', 22.00, 20),
          ($1, 'Mixed Grill', 'مشاوي مشكلة', 'Assortment of grilled meats', 35.00, 25)
        ON CONFLICT DO NOTHING;
      `, [categoryMap.get('Main Courses')]);
    }

    if (categoryMap.has('Beverages')) {
      await pool.query(`
        INSERT INTO menu_items (category_id, name, name_ar, description, price, preparation_time_minutes) VALUES
          ($1, 'Fresh Lemonade', 'عصير ليمون', 'Freshly squeezed lemonade', 5.00, 3),
          ($1, 'Arabic Coffee', 'قهوة عربية', 'Traditional Arabic coffee', 4.00, 5),
          ($1, 'Mint Tea', 'شاي بالنعناع', 'Fresh mint tea', 4.00, 5)
        ON CONFLICT DO NOTHING;
      `, [categoryMap.get('Beverages')]);
    }

    // Create sample snack items
    await pool.query(`
      INSERT INTO snack_items (name, name_ar, description, price, category) VALUES
        ('Club Sandwich', 'ساندويش كلوب', 'Triple-decker club sandwich', 12.00, 'sandwich'),
        ('Cheese Burger', 'برغر بالجبنة', 'Juicy beef burger with cheese', 14.00, 'sandwich'),
        ('French Fries', 'بطاطا مقلية', 'Crispy golden fries', 6.00, 'snack'),
        ('Coca Cola', 'كوكا كولا', 'Ice cold Coca Cola', 3.00, 'drink'),
        ('Fresh Orange Juice', 'عصير برتقال', 'Freshly squeezed orange juice', 6.00, 'drink'),
        ('Vanilla Ice Cream', 'آيس كريم فانيلا', 'Creamy vanilla ice cream', 5.00, 'ice_cream')
      ON CONFLICT DO NOTHING;
    `);

    // Create sample chalets
    await pool.query(`
      INSERT INTO chalets (name, name_ar, description, capacity, bedroom_count, bathroom_count, amenities, base_price, weekend_price) VALUES
        ('Mountain View Chalet', 'شاليه إطلالة الجبل', 'Beautiful chalet with stunning mountain views', 6, 2, 2, ARRAY['WiFi', 'AC', 'Kitchen', 'BBQ', 'Parking'], 150.00, 200.00),
        ('Garden Chalet', 'شاليه الحديقة', 'Cozy chalet surrounded by gardens', 4, 1, 1, ARRAY['WiFi', 'AC', 'Kitchen', 'Garden'], 100.00, 140.00),
        ('Luxury Villa', 'فيلا فاخرة', 'Spacious luxury villa with private pool', 10, 4, 3, ARRAY['WiFi', 'AC', 'Kitchen', 'BBQ', 'Private Pool', 'Parking', 'Garden'], 300.00, 400.00),
        ('Family Chalet', 'شاليه عائلي', 'Perfect for family gatherings', 8, 3, 2, ARRAY['WiFi', 'AC', 'Kitchen', 'BBQ', 'Playground', 'Parking'], 200.00, 280.00)
      ON CONFLICT DO NOTHING;
    `);

    // Create chalet add-ons
    await pool.query(`
      INSERT INTO chalet_add_ons (name, name_ar, description, price, price_type) VALUES
        ('Breakfast', 'فطور', 'Full breakfast for all guests', 15.00, 'per_night'),
        ('Extra Cleaning', 'تنظيف إضافي', 'Additional cleaning service', 25.00, 'one_time'),
        ('Extra Bed', 'سرير إضافي', 'Additional bed setup', 20.00, 'per_night'),
        ('BBQ Package', 'باقة شواء', 'Charcoal and BBQ supplies', 30.00, 'one_time'),
        ('Late Checkout', 'مغادرة متأخرة', 'Checkout extended to 4 PM', 40.00, 'one_time')
      ON CONFLICT DO NOTHING;
    `);

    // Create pool sessions
    await pool.query(`
      INSERT INTO pool_sessions (name, start_time, end_time, max_capacity, price) VALUES
        ('Morning Session', '09:00', '12:00', 50, 15.00),
        ('Afternoon Session', '13:00', '17:00', 50, 20.00),
        ('Evening Session', '18:00', '21:00', 40, 15.00)
      ON CONFLICT DO NOTHING;
    `);

    // Create restaurant tables
    await pool.query(`
      INSERT INTO restaurant_tables (table_number, capacity, location) VALUES
        ('T1', 2, 'Indoor'),
        ('T2', 2, 'Indoor'),
        ('T3', 4, 'Indoor'),
        ('T4', 4, 'Indoor'),
        ('T5', 6, 'Indoor'),
        ('T6', 4, 'Terrace'),
        ('T7', 4, 'Terrace'),
        ('T8', 6, 'Terrace'),
        ('T9', 8, 'Garden'),
        ('T10', 10, 'Garden')
      ON CONFLICT (table_number) DO NOTHING;
    `);

    logger.info('Seeding completed successfully');
    logger.info('');
    logger.info('Admin credentials:');
    logger.info('  Email: admin@v2resort.com');
    logger.info('  Password: admin123');
    logger.info('');
    
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

seed();
