import { getPool, initializeDatabase, closeDatabase } from './connection';
import { logger } from '../utils/logger';

async function migrate() {
  try {
    await initializeDatabase();
    const pool = getPool();

    logger.info('Running migrations...');

    // Create enums
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE business_unit AS ENUM ('restaurant', 'snack_bar', 'chalets', 'pool', 'admin');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('cash', 'card', 'whish', 'online');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE ticket_status AS ENUM ('valid', 'used', 'expired', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE snack_category AS ENUM ('sandwich', 'drink', 'snack', 'ice_cream');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      
      DO $$ BEGIN
        CREATE TYPE price_type AS ENUM ('per_night', 'one_time');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Users & Auth tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        profile_image_url TEXT,
        preferred_language VARCHAR(10) DEFAULT 'en',
        email_verified BOOLEAN DEFAULT false,
        phone_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        oauth_provider VARCHAR(50),
        oauth_provider_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        business_unit business_unit,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        role_id UUID REFERENCES roles(id) NOT NULL,
        granted_by UUID REFERENCES users(id),
        granted_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        resource VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID REFERENCES roles(id) NOT NULL,
        permission_id UUID REFERENCES permissions(id) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        PRIMARY KEY (role_id, permission_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        token VARCHAR(500) NOT NULL UNIQUE,
        refresh_token VARCHAR(500) UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true,
        last_activity TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Restaurant tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100),
        name_fr VARCHAR(100),
        description TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id UUID REFERENCES menu_categories(id) NOT NULL,
        name VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255),
        name_fr VARCHAR(255),
        description TEXT,
        description_ar TEXT,
        description_fr TEXT,
        price DECIMAL(10,2) NOT NULL,
        preparation_time_minutes INTEGER,
        calories INTEGER,
        is_vegetarian BOOLEAN DEFAULT false,
        is_vegan BOOLEAN DEFAULT false,
        is_gluten_free BOOLEAN DEFAULT false,
        allergens TEXT[],
        image_url TEXT,
        is_available BOOLEAN DEFAULT true,
        is_featured BOOLEAN DEFAULT false,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_number VARCHAR(20) NOT NULL UNIQUE,
        capacity INTEGER NOT NULL,
        location VARCHAR(100),
        qr_code TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS restaurant_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(20) NOT NULL UNIQUE,
        customer_id UUID REFERENCES users(id),
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        table_id UUID REFERENCES restaurant_tables(id),
        order_type order_type NOT NULL,
        status order_status DEFAULT 'pending' NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) NOT NULL,
        service_charge DECIMAL(10,2),
        delivery_fee DECIMAL(10,2),
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        special_instructions TEXT,
        estimated_ready_time TIMESTAMP,
        actual_ready_time TIMESTAMP,
        payment_status payment_status DEFAULT 'pending' NOT NULL,
        payment_method payment_method,
        assigned_to_staff UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancellation_reason TEXT,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS restaurant_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES restaurant_orders(id) NOT NULL,
        menu_item_id UUID REFERENCES menu_items(id) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        special_instructions TEXT,
        status order_status,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS restaurant_order_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES restaurant_orders(id) NOT NULL,
        from_status order_status,
        to_status order_status NOT NULL,
        changed_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Snack Bar tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS snack_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255),
        name_fr VARCHAR(255),
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category snack_category NOT NULL,
        image_url TEXT,
        is_available BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS snack_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(20) NOT NULL UNIQUE,
        customer_id UUID REFERENCES users(id),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(20),
        status order_status DEFAULT 'pending' NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_status payment_status DEFAULT 'pending' NOT NULL,
        payment_method payment_method,
        special_instructions TEXT,
        estimated_ready_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS snack_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES snack_orders(id) NOT NULL,
        snack_item_id UUID REFERENCES snack_items(id) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Chalets tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chalets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100),
        name_fr VARCHAR(100),
        description TEXT,
        description_ar TEXT,
        description_fr TEXT,
        capacity INTEGER NOT NULL,
        bedroom_count INTEGER NOT NULL,
        bathroom_count INTEGER NOT NULL,
        amenities TEXT[],
        images TEXT[],
        base_price DECIMAL(10,2) NOT NULL,
        weekend_price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chalet_add_ons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100),
        name_fr VARCHAR(100),
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        price_type price_type NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chalet_price_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chalet_id UUID REFERENCES chalets(id),
        name VARCHAR(100) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        price_multiplier DECIMAL(5,2) NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chalet_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_number VARCHAR(20) NOT NULL UNIQUE,
        chalet_id UUID REFERENCES chalets(id) NOT NULL,
        customer_id UUID REFERENCES users(id),
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        check_in_date TIMESTAMP NOT NULL,
        check_out_date TIMESTAMP NOT NULL,
        number_of_guests INTEGER NOT NULL,
        number_of_nights INTEGER NOT NULL,
        base_amount DECIMAL(10,2) NOT NULL,
        add_ons_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        deposit_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        status booking_status DEFAULT 'pending' NOT NULL,
        payment_status payment_status DEFAULT 'pending' NOT NULL,
        payment_method payment_method,
        special_requests TEXT,
        checked_in_at TIMESTAMP,
        checked_out_at TIMESTAMP,
        checked_in_by UUID REFERENCES users(id),
        checked_out_by UUID REFERENCES users(id),
        cancelled_at TIMESTAMP,
        cancellation_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chalet_booking_add_ons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES chalet_bookings(id) NOT NULL,
        add_on_id UUID REFERENCES chalet_add_ons(id) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Pool tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        max_capacity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pool_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_number VARCHAR(20) NOT NULL UNIQUE,
        session_id UUID REFERENCES pool_sessions(id) NOT NULL,
        customer_id UUID REFERENCES users(id),
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        ticket_date TIMESTAMP NOT NULL,
        number_of_guests INTEGER NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status ticket_status DEFAULT 'valid' NOT NULL,
        payment_status payment_status DEFAULT 'pending' NOT NULL,
        payment_method payment_method,
        qr_code TEXT NOT NULL,
        validated_at TIMESTAMP,
        validated_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      );
    `);

    // Payments & Notifications tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference_type VARCHAR(50) NOT NULL,
        reference_id UUID NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        method payment_method NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' NOT NULL,
        stripe_payment_intent_id VARCHAR(255),
        stripe_charge_id VARCHAR(255),
        receipt_url TEXT,
        processed_by UUID REFERENCES users(id),
        processed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        sent_via TEXT[],
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id UUID,
        old_value TEXT,
        new_value TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      -- Modules table
      CREATE TABLE IF NOT EXISTS modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_type VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        settings JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Insert default modules
      INSERT INTO modules (template_type, name, slug, description, sort_order, is_active)
      VALUES 
        ('menu_service', 'Restaurant', 'restaurant', 'Fine dining restaurant management', 1, true),
        ('multi_day_booking', 'Chalets', 'chalets', 'Chalet booking and management', 2, true),
        ('session_access', 'Pool', 'pool', 'Pool access and session management', 3, true),
        ('menu_service', 'Snack Bar', 'snack-bar', 'Quick service snack bar', 4, true)
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_restaurant_orders_customer_id ON restaurant_orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_restaurant_orders_created_at ON restaurant_orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_chalet_bookings_chalet_id ON chalet_bookings(chalet_id);
      CREATE INDEX IF NOT EXISTS idx_chalet_bookings_check_in_date ON chalet_bookings(check_in_date);
      CREATE INDEX IF NOT EXISTS idx_pool_tickets_session_id ON pool_tickets(session_id);
      CREATE INDEX IF NOT EXISTS idx_pool_tickets_ticket_date ON pool_tickets(ticket_date);
      CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
    `);

    // Add module_id to restaurant_orders
    await pool.query(`
      ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
      
      DO $$
      DECLARE
        restaurant_id UUID;
      BEGIN
        SELECT id INTO restaurant_id FROM modules WHERE slug = 'restaurant';
        IF restaurant_id IS NOT NULL THEN
          UPDATE restaurant_orders SET module_id = restaurant_id WHERE module_id IS NULL;
        END IF;
      END $$;
    `);

    logger.info('Migrations completed successfully');
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    // Print full error to stdout for debugging (temporary)
    console.error(error);
    logger.error('Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

migrate();
