import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('🌱 Starting database seed with Supabase...\n');

  // Get passwords from environment or use defaults only in development
  const isDev = process.env.NODE_ENV !== 'production';
  const adminPasswordPlain = process.env.SEED_ADMIN_PASSWORD || (isDev ? 'admin123' : undefined);
  const staffPasswordPlain = process.env.SEED_STAFF_PASSWORD || (isDev ? 'staff123' : undefined);
  const customerPasswordPlain = process.env.SEED_CUSTOMER_PASSWORD || (isDev ? 'TestPass123!' : undefined);
  const legacyCustomerPasswordPlain = process.env.SEED_LEGACY_CUSTOMER_PASSWORD || (isDev ? 'password123' : undefined);
  
  if (!adminPasswordPlain || !staffPasswordPlain || !customerPasswordPlain || !legacyCustomerPasswordPlain) {
    throw new Error('SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD, SEED_CUSTOMER_PASSWORD, and SEED_LEGACY_CUSTOMER_PASSWORD are required in production');
  }

  try {
    // 1. Create roles
    console.log('Creating roles...');
    const roles = [
      { name: 'super_admin', display_name: 'Super Administrator', description: 'Full system access', business_unit: 'admin' },
      { name: 'customer', display_name: 'Customer', description: 'Registered customer', business_unit: null },
      { name: 'restaurant_admin', display_name: 'Restaurant Admin', description: 'Restaurant management', business_unit: 'restaurant' },
      { name: 'restaurant_staff', display_name: 'Restaurant Staff', description: 'Restaurant operations', business_unit: 'restaurant' },
      { name: 'snack_bar_admin', display_name: 'Snack Bar Admin', description: 'Snack bar management', business_unit: 'snack_bar' },
      { name: 'snack_bar_staff', display_name: 'Snack Bar Staff', description: 'Snack bar operations', business_unit: 'snack_bar' },
      { name: 'chalet_admin', display_name: 'Chalet Admin', description: 'Chalet management', business_unit: 'chalets' },
      { name: 'chalet_staff', display_name: 'Chalet Staff', description: 'Chalet operations', business_unit: 'chalets' },
      { name: 'pool_admin', display_name: 'Pool Admin', description: 'Pool management', business_unit: 'pool' },
      { name: 'pool_staff', display_name: 'Pool Staff', description: 'Pool operations', business_unit: 'pool' },
    ];

    for (const role of roles) {
      const { error } = await supabase.from('roles').upsert(role, { onConflict: 'name' });
      if (error) console.error(`  Error creating role ${role.name}:`, error.message);
    }
    console.log('  ✓ Roles created\n');

    // 2. Create admin user
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash(adminPasswordPlain, 12);
    
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .upsert({
        email: 'admin@v2ecosystem.com',
        password_hash: adminPassword,
        full_name: 'System Administrator',
        email_verified: true,
        is_active: true,
      }, { onConflict: 'email' })
      .select('id')
      .single();

    if (adminError) {
      console.error('  Error creating admin:', adminError.message);
    } else {
      console.log('  ✓ Admin user created\n');

      // 3. Assign super_admin role
      console.log('Assigning super_admin role...');
      const { data: superAdminRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'super_admin')
        .single();

      if (superAdminRole && adminUser) {
        // First check if role exists
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', adminUser.id)
          .eq('role_id', superAdminRole.id);
        
        if (!existingRole || existingRole.length === 0) {
          await supabase.from('user_roles').insert({
            user_id: adminUser.id,
            role_id: superAdminRole.id,
          });
        }
        console.log('  ✓ Role assigned\n');
      }
    }

    // 4. Create staff users
    console.log('Creating staff users...');
    const staffPassword = await bcrypt.hash(staffPasswordPlain, 12);
    
    const staffUsers = [
      { email: 'restaurant.staff@v2ecosystem.com', full_name: 'Restaurant Staff', role: 'restaurant_staff' },
      { email: 'restaurant.admin@v2ecosystem.com', full_name: 'Restaurant Admin', role: 'restaurant_admin' },
      { email: 'snack.staff@v2ecosystem.com', full_name: 'Snack Bar Staff', role: 'snack_bar_staff' },
      { email: 'chalet.staff@v2ecosystem.com', full_name: 'Chalet Staff', role: 'chalet_staff' },
      { email: 'chalet.admin@v2ecosystem.com', full_name: 'Chalet Admin', role: 'chalet_admin' },
      { email: 'pool.staff@v2ecosystem.com', full_name: 'Pool Staff', role: 'pool_staff' },
      { email: 'pool.admin@v2ecosystem.com', full_name: 'Pool Admin', role: 'pool_admin' },
    ];

    for (const staff of staffUsers) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .upsert({
          email: staff.email,
          password_hash: staffPassword,
          full_name: staff.full_name,
          email_verified: true,
          is_active: true,
        }, { onConflict: 'email' })
        .select('id')
        .single();

      if (!userError && user) {
        const { data: role } = await supabase
          .from('roles')
          .select('id')
          .eq('name', staff.role)
          .single();

        if (role) {
          // First check if role exists
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', user.id)
            .eq('role_id', role.id);
          
          if (!existingRole || existingRole.length === 0) {
            await supabase.from('user_roles').insert({
              user_id: user.id,
              role_id: role.id,
            });
          }
        }
      }
    }
    console.log('  ✓ Staff users created\n');

    // 5. Create customer users used by Playwright suites
    console.log('Creating customer users...');
    const customerPassword = await bcrypt.hash(customerPasswordPlain, 12);
    const legacyCustomerPassword = await bcrypt.hash(legacyCustomerPasswordPlain, 12);
    const customerUsers = [
      { email: 'e2e.customer@test.com', full_name: 'E2E Customer', password_hash: customerPassword },
      { email: 'customer@test.com', full_name: 'Test Customer', password_hash: legacyCustomerPassword },
    ];

    const { data: customerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'customer')
      .single();

    for (const customer of customerUsers) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .upsert({
          email: customer.email,
          password_hash: customer.password_hash,
          full_name: customer.full_name,
          email_verified: true,
          is_active: true,
        }, { onConflict: 'email' })
        .select('id')
        .single();

      if (userError || !user || !customerRole) continue;

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role_id', customerRole.id);

      if (!existingRole || existingRole.length === 0) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: customerRole.id,
        });
      }
    }
    console.log('  ✓ Customer users created\n');

    // 6. Create menu categories
    console.log('Creating menu categories...');
    const categories = [
      { name: 'Appetizers', name_ar: 'مقبلات', name_fr: 'Entrées', description: 'Start your meal with our delicious appetizers', display_order: 1 },
      { name: 'Main Courses', name_ar: 'أطباق رئيسية', name_fr: 'Plats Principaux', description: 'Hearty main dishes', display_order: 2 },
      { name: 'Grilled', name_ar: 'مشاوي', name_fr: 'Grillades', description: 'Fresh from the grill', display_order: 3 },
      { name: 'Seafood', name_ar: 'مأكولات بحرية', name_fr: 'Fruits de Mer', description: 'Fresh seafood dishes', display_order: 4 },
      { name: 'Desserts', name_ar: 'حلويات', name_fr: 'Desserts', description: 'Sweet endings', display_order: 5 },
      { name: 'Beverages', name_ar: 'مشروبات', name_fr: 'Boissons', description: 'Refreshing drinks', display_order: 6 },
    ];

    for (const cat of categories) {
      await supabase.from('menu_categories').upsert(cat, { onConflict: 'name' });
    }
    console.log('  ✓ Menu categories created\n');

    // 6. Create menu items
    console.log('Creating menu items...');
    const { data: categoryList } = await supabase.from('menu_categories').select('id, name');
    const categoryMap = new Map(categoryList?.map(c => [c.name, c.id]) || []);

    const menuItems = [
      // Appetizers
      { category_id: categoryMap.get('Appetizers'), name: 'Hummus', name_ar: 'حمص', name_fr: 'Houmous', description: 'Classic Lebanese hummus with olive oil', description_ar: 'حمص لبناني تقليدي بزيت الزيتون', description_fr: 'Houmous libanais classique à l\'huile d\'olive', price: 8.00, preparation_time_minutes: 5, is_featured: true },
      { category_id: categoryMap.get('Appetizers'), name: 'Falafel', name_ar: 'فلافل', name_fr: 'Falafel', description: 'Crispy falafel served with tahini', description_ar: 'فلافل مقرمشة مع الطحينة', description_fr: 'Falafel croustillant servi avec tahini', price: 10.00, preparation_time_minutes: 10 },
      { category_id: categoryMap.get('Appetizers'), name: 'Fattoush', name_ar: 'فتوش', name_fr: 'Fattouch', description: 'Fresh garden salad with crispy pita', description_ar: 'سلطة طازجة مع خبز مقرمش', description_fr: 'Salade fraîche avec pain pita croustillant', price: 12.00, preparation_time_minutes: 8, is_featured: true },
      { category_id: categoryMap.get('Appetizers'), name: 'Tabbouleh', name_ar: 'تبولة', name_fr: 'Taboulé', description: 'Traditional parsley salad', description_ar: 'سلطة البقدونس التقليدية', description_fr: 'Salade de persil traditionnelle', price: 10.00, preparation_time_minutes: 10 },
      // Main Courses
      { category_id: categoryMap.get('Main Courses'), name: 'Chicken Shawarma Plate', name_ar: 'صحن شاورما دجاج', name_fr: 'Assiette Shawarma Poulet', description: 'Tender chicken shawarma with rice and salad', description_ar: 'شاورما دجاج طرية مع الأرز والسلطة', description_fr: 'Shawarma de poulet tendre avec riz et salade', price: 18.00, preparation_time_minutes: 15 },
      { category_id: categoryMap.get('Main Courses'), name: 'Lamb Kofta', name_ar: 'كفتة لحم', name_fr: 'Kefta d\'Agneau', description: 'Grilled lamb kofta with vegetables', description_ar: 'كفتة لحم مشوية مع الخضار', description_fr: 'Kefta d\'agneau grillé avec légumes', price: 22.00, preparation_time_minutes: 20 },
      { category_id: categoryMap.get('Main Courses'), name: 'Mixed Grill', name_ar: 'مشاوي مشكلة', name_fr: 'Grillade Mixte', description: 'Assortment of grilled meats', description_ar: 'تشكيلة من اللحوم المشوية', description_fr: 'Assortiment de viandes grillées', price: 35.00, preparation_time_minutes: 25, is_featured: true },
      // Beverages
      { category_id: categoryMap.get('Beverages'), name: 'Fresh Lemonade', name_ar: 'عصير ليمون', name_fr: 'Limonade Fraîche', description: 'Freshly squeezed lemonade', description_ar: 'عصير ليمون طازج', description_fr: 'Limonade fraîchement pressée', price: 5.00, preparation_time_minutes: 3 },
      { category_id: categoryMap.get('Beverages'), name: 'Arabic Coffee', name_ar: 'قهوة عربية', name_fr: 'Café Arabe', description: 'Traditional Arabic coffee', description_ar: 'قهوة عربية تقليدية', description_fr: 'Café arabe traditionnel', price: 4.00, preparation_time_minutes: 5 },
      { category_id: categoryMap.get('Beverages'), name: 'Mint Tea', name_ar: 'شاي بالنعناع', name_fr: 'Thé à la Menthe', description: 'Fresh mint tea', description_ar: 'شاي بالنعناع الطازج', description_fr: 'Thé à la menthe fraîche', price: 4.00, preparation_time_minutes: 5 },
    ];

    for (const item of menuItems) {
      if (item.category_id) {
        await supabase.from('menu_items').upsert(item, { onConflict: 'name' });
      }
    }
    console.log('  ✓ Menu items created\n');

    // 7. Create snack items
    console.log('Creating snack items...');
    const snackItems = [
      { name: 'Club Sandwich', name_ar: 'ساندويش كلوب', name_fr: 'Club Sandwich', description: 'Triple-decker club sandwich', description_ar: 'ساندويش كلوب ثلاثي الطبقات', description_fr: 'Club sandwich triple', price: 12.00, category: 'sandwich' },
      { name: 'Cheese Burger', name_ar: 'برغر بالجبنة', name_fr: 'Cheeseburger', description: 'Juicy beef burger with cheese', description_ar: 'برغر لحم بقري مع الجبنة', description_fr: 'Burger de boeuf juteux au fromage', price: 14.00, category: 'sandwich' },
      { name: 'French Fries', name_ar: 'بطاطا مقلية', name_fr: 'Frites', description: 'Crispy golden fries', description_ar: 'بطاطا مقلية ذهبية مقرمشة', description_fr: 'Frites dorées croustillantes', price: 6.00, category: 'snack' },
      { name: 'Coca Cola', name_ar: 'كوكا كولا', name_fr: 'Coca Cola', description: 'Ice cold Coca Cola', description_ar: 'كوكا كولا مثلجة', description_fr: 'Coca Cola glacé', price: 3.00, category: 'drink' },
      { name: 'Fresh Orange Juice', name_ar: 'عصير برتقال', name_fr: 'Jus d\'Orange Frais', description: 'Freshly squeezed orange juice', description_ar: 'عصير برتقال طازج', description_fr: 'Jus d\'orange fraîchement pressé', price: 6.00, category: 'drink' },
      { name: 'Vanilla Ice Cream', name_ar: 'آيس كريم فانيلا', name_fr: 'Glace Vanille', description: 'Creamy vanilla ice cream', description_ar: 'آيس كريم فانيلا كريمي', description_fr: 'Glace vanille crémeuse', price: 5.00, category: 'ice_cream' },
    ];

    for (const item of snackItems) {
      await supabase.from('snack_items').upsert(item, { onConflict: 'name' });
    }
    console.log('  ✓ Snack items created\n');

    // 8. Create chalets
    console.log('Creating chalets...');
    const chalets = [
      { name: 'Mountain View Chalet', name_ar: 'شاليه إطلالة الجبل', name_fr: 'Chalet Vue Montagne', description: 'Beautiful chalet with stunning mountain views', description_ar: 'شاليه جميل مع إطلالة خلابة على الجبل', description_fr: 'Beau chalet avec vue imprenable sur la montagne', capacity: 6, bedroom_count: 2, bathroom_count: 2, amenities: ['WiFi', 'AC', 'Kitchen', 'BBQ', 'Parking'], base_price: 150.00, weekend_price: 200.00 },
      { name: 'Garden Chalet', name_ar: 'شاليه الحديقة', name_fr: 'Chalet Jardin', description: 'Cozy chalet surrounded by gardens', description_ar: 'شاليه مريح محاط بالحدائق', description_fr: 'Chalet confortable entouré de jardins', capacity: 4, bedroom_count: 1, bathroom_count: 1, amenities: ['WiFi', 'AC', 'Kitchen', 'Garden'], base_price: 100.00, weekend_price: 140.00 },
      { name: 'Luxury Villa', name_ar: 'فيلا فاخرة', name_fr: 'Villa de Luxe', description: 'Spacious luxury villa with private pool', description_ar: 'فيلا فاخرة واسعة مع مسبح خاص', description_fr: 'Villa de luxe spacieuse avec piscine privée', capacity: 10, bedroom_count: 4, bathroom_count: 3, amenities: ['WiFi', 'AC', 'Kitchen', 'BBQ', 'Private Pool', 'Parking', 'Garden'], base_price: 300.00, weekend_price: 400.00, is_featured: true },
      { name: 'Family Chalet', name_ar: 'شاليه عائلي', name_fr: 'Chalet Familial', description: 'Perfect for family gatherings', description_ar: 'مثالي للتجمعات العائلية', description_fr: 'Parfait pour les réunions de famille', capacity: 8, bedroom_count: 3, bathroom_count: 2, amenities: ['WiFi', 'AC', 'Kitchen', 'BBQ', 'Playground', 'Parking'], base_price: 200.00, weekend_price: 280.00 },
    ];

    for (const chalet of chalets) {
      await supabase.from('chalets').upsert(chalet, { onConflict: 'name' });
    }
    console.log('  ✓ Chalets created\n');

    // 9. Create chalet add-ons
    console.log('Creating chalet add-ons...');
    const addons = [
      { name: 'Breakfast', name_ar: 'فطور', name_fr: 'Petit-déjeuner', description: 'Full breakfast for all guests', description_ar: 'فطور كامل لجميع الضيوف', description_fr: 'Petit-déjeuner complet pour tous les invités', price: 15.00, price_type: 'per_night' },
      { name: 'Extra Cleaning', name_ar: 'تنظيف إضافي', name_fr: 'Nettoyage Supplémentaire', description: 'Additional cleaning service', description_ar: 'خدمة تنظيف إضافية', description_fr: 'Service de nettoyage supplémentaire', price: 25.00, price_type: 'one_time' },
      { name: 'Extra Bed', name_ar: 'سرير إضافي', name_fr: 'Lit Supplémentaire', description: 'Additional bed setup', description_ar: 'إعداد سرير إضافي', description_fr: 'Installation d\'un lit supplémentaire', price: 20.00, price_type: 'per_night' },
      { name: 'BBQ Package', name_ar: 'باقة شواء', name_fr: 'Forfait BBQ', description: 'Charcoal and BBQ supplies', description_ar: 'فحم ومستلزمات الشواء', description_fr: 'Charbon et fournitures BBQ', price: 30.00, price_type: 'one_time' },
      { name: 'Late Checkout', name_ar: 'مغادرة متأخرة', name_fr: 'Départ Tardif', description: 'Checkout extended to 4 PM', description_ar: 'تمديد المغادرة حتى الساعة 4 مساءً', description_fr: 'Départ prolongé jusqu\'à 16h', price: 40.00, price_type: 'one_time' },
    ];

    for (const addon of addons) {
      await supabase.from('chalet_add_ons').upsert(addon, { onConflict: 'name' });
    }
    console.log('  ✓ Chalet add-ons created\n');

    // 10. Create pool sessions
    console.log('Creating pool sessions...');
    const sessions = [
      { name: 'Morning Session', start_time: '09:00', end_time: '12:00', max_capacity: 50, price: 15.00, is_active: true },
      { name: 'Afternoon Session', start_time: '13:00', end_time: '17:00', max_capacity: 50, price: 20.00, is_active: true },
      { name: 'Evening Session', start_time: '18:00', end_time: '21:00', max_capacity: 40, price: 15.00, is_active: true },
    ];

    for (const session of sessions) {
      // Check if session already exists
      const { data: existing } = await supabase
        .from('pool_sessions')
        .select('id')
        .eq('name', session.name)
        .single();
      
      if (!existing) {
        const { error } = await supabase.from('pool_sessions').insert(session);
        if (error) console.error(`  Error creating session ${session.name}:`, error.message);
      }
    }
    console.log('  ✓ Pool sessions created\n');

    // 11. Create restaurant tables
    console.log('Creating restaurant tables...');
    const tables = [
      { table_number: 'T1', capacity: 2, location: 'Indoor' },
      { table_number: 'T2', capacity: 2, location: 'Indoor' },
      { table_number: 'T3', capacity: 4, location: 'Indoor' },
      { table_number: 'T4', capacity: 4, location: 'Indoor' },
      { table_number: 'T5', capacity: 6, location: 'Indoor' },
      { table_number: 'T6', capacity: 4, location: 'Terrace' },
      { table_number: 'T7', capacity: 4, location: 'Terrace' },
      { table_number: 'T8', capacity: 6, location: 'Terrace' },
      { table_number: 'T9', capacity: 8, location: 'Garden' },
      { table_number: 'T10', capacity: 10, location: 'Garden' },
    ];

    for (const table of tables) {
      await supabase.from('restaurant_tables').upsert(table, { onConflict: 'table_number' });
    }
    console.log('  ✓ Restaurant tables created\n');

    // 10. Create sample reviews
    console.log('Creating sample reviews...');
    if (adminUser) {
      const reviews = [
        { user_id: adminUser.id, rating: 5, text: 'Absolutely stunning resort! The chalets have breathtaking mountain views and the staff went above and beyond to make our stay memorable.', service_type: 'general', is_approved: true },
        { user_id: adminUser.id, rating: 5, text: 'The Lebanese cuisine at the restaurant is authentic and delicious. Best hummus I\'ve ever had!', service_type: 'restaurant', is_approved: true },
        { user_id: adminUser.id, rating: 5, text: 'Perfect family getaway. The pool area is fantastic and the kids loved it!', service_type: 'pool', is_approved: true },
        { user_id: adminUser.id, rating: 4, text: 'Great facilities for both work and relaxation. The WiFi was excellent and the views are incredible.', service_type: 'chalets', is_approved: true },
        { user_id: adminUser.id, rating: 5, text: 'The snack bar has amazing variety. Quick service and tasty food!', service_type: 'snack_bar', is_approved: true },
      ];

      for (const review of reviews) {
        const { data: existing } = await supabase
          .from('reviews')
          .select('id')
          .eq('user_id', review.user_id)
          .eq('service_type', review.service_type);
        
        if (!existing || existing.length === 0) {
          await supabase.from('reviews').insert(review);
        }
      }
      console.log('  ✓ Sample reviews created\n');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎉 Database seeding completed successfully!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📧 Admin credentials:');
    console.log('   Email: admin@v2ecosystem.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('👥 Staff credentials (all use password: staff123):');
    console.log('   - restaurant.staff@v2ecosystem.com');
    console.log('   - restaurant.admin@v2ecosystem.com');
    console.log('   - chalet.staff@v2ecosystem.com');
    console.log('   - chalet.admin@v2ecosystem.com');
    console.log('   - pool.staff@v2ecosystem.com');
    console.log('   - pool.admin@v2ecosystem.com');
    console.log('   - snack.staff@v2ecosystem.com');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
