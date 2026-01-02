import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('🚀 Starting Supabase migration...');
  console.log(`📍 URL: ${supabaseUrl}`);
  
  try {
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (testError && !testError.message.includes('does not exist')) {
      console.log('⚠️ Connection test returned:', testError.message);
    }
    
    console.log('✅ Connected to Supabase');
    console.log('📋 Creating tables via Supabase SQL Editor...');
    console.log('');
    console.log('⚠️ IMPORTANT: Direct SQL execution via Supabase JS client is limited.');
    console.log('Please run the following SQL in Supabase SQL Editor:');
    console.log('Go to: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql/new');
    console.log('');
    console.log('=' .repeat(80));
    
    // Print the full migration SQL
    const migrationSQL = `
-- ============================================
-- V2 Resort Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Create enums
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

-- Users & Auth tables
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

-- Restaurant tables
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

-- Snack Bar tables
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

-- Chalets tables
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

-- Pool tables
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

-- Payments & Notifications tables
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

-- Reviews table for testimonials
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  service_type VARCHAR(50) DEFAULT 'general',
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
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

-- ============================================
-- SEED DATA
-- ============================================

-- Insert roles
INSERT INTO roles (name, display_name, description, business_unit) VALUES
  ('super_admin', 'Super Administrator', 'Full access to all systems', 'admin'),
  ('admin', 'Administrator', 'Administrative access', 'admin'),
  ('restaurant_manager', 'Restaurant Manager', 'Manages restaurant operations', 'restaurant'),
  ('restaurant_staff', 'Restaurant Staff', 'Restaurant service staff', 'restaurant'),
  ('kitchen_staff', 'Kitchen Staff', 'Kitchen personnel', 'restaurant'),
  ('snack_staff', 'Snack Bar Staff', 'Snack bar personnel', 'snack_bar'),
  ('chalet_manager', 'Chalet Manager', 'Manages chalet bookings', 'chalets'),
  ('pool_staff', 'Pool Staff', 'Pool operations staff', 'pool'),
  ('customer', 'Customer', 'Regular customer', NULL)
ON CONFLICT (name) DO NOTHING;

-- Insert sample menu categories
INSERT INTO menu_categories (name, name_ar, name_fr, description, display_order) VALUES
  ('Appetizers', 'المقبلات', 'Entrées', 'Start your meal with our delicious appetizers', 1),
  ('Main Courses', 'الأطباق الرئيسية', 'Plats Principaux', 'Hearty main dishes', 2),
  ('Desserts', 'الحلويات', 'Desserts', 'Sweet endings', 3),
  ('Beverages', 'المشروبات', 'Boissons', 'Refreshing drinks', 4)
ON CONFLICT DO NOTHING;

-- Insert sample chalets
INSERT INTO chalets (name, name_ar, name_fr, description, capacity, bedroom_count, bathroom_count, base_price, weekend_price, amenities) VALUES
  ('Ocean View Villa', 'فيلا إطلالة المحيط', 'Villa Vue Océan', 'Luxurious beachfront villa with stunning ocean views', 6, 3, 2, 250.00, 350.00, ARRAY['WiFi', 'Pool', 'Kitchen', 'AC', 'TV']),
  ('Garden Cottage', 'كوخ الحديقة', 'Cottage Jardin', 'Cozy cottage surrounded by beautiful gardens', 4, 2, 1, 150.00, 200.00, ARRAY['WiFi', 'Garden', 'Kitchen', 'AC']),
  ('Family Suite', 'جناح العائلة', 'Suite Familiale', 'Spacious suite perfect for families', 8, 4, 3, 350.00, 450.00, ARRAY['WiFi', 'Pool Access', 'Kitchen', 'AC', 'TV', 'BBQ'])
ON CONFLICT DO NOTHING;

-- Insert pool sessions
INSERT INTO pool_sessions (name, start_time, end_time, max_capacity, price) VALUES
  ('Morning Session', '08:00', '12:00', 50, 15.00),
  ('Afternoon Session', '13:00', '17:00', 50, 15.00),
  ('Evening Session', '18:00', '21:00', 30, 20.00)
ON CONFLICT DO NOTHING;

-- Insert sample snack items
INSERT INTO snack_items (name, name_ar, name_fr, description, price, category) VALUES
  ('Club Sandwich', 'ساندويش كلوب', 'Club Sandwich', 'Classic club sandwich with chicken, bacon, and fresh vegetables', 12.00, 'sandwich'),
  ('Fresh Lemonade', 'عصير ليمون طازج', 'Limonade Fraîche', 'Freshly squeezed lemonade', 5.00, 'drink'),
  ('Ice Cream Sundae', 'آيس كريم سنداي', 'Sundae Glacé', 'Vanilla ice cream with chocolate sauce', 8.00, 'ice_cream'),
  ('Chips & Dip', 'رقائق وصوص', 'Chips & Sauce', 'Crispy chips with house-made dip', 6.00, 'snack')
ON CONFLICT DO NOTHING;

-- Insert chalet add-ons
INSERT INTO chalet_add_ons (name, name_ar, name_fr, description, price, price_type) VALUES
  ('Extra Bed', 'سرير إضافي', 'Lit Supplémentaire', 'Additional bed for extra guest', 30.00, 'per_night'),
  ('BBQ Setup', 'معدات الشواء', 'Installation BBQ', 'Charcoal and BBQ equipment', 25.00, 'one_time'),
  ('Late Checkout', 'مغادرة متأخرة', 'Départ Tardif', 'Extend checkout until 4 PM', 50.00, 'one_time'),
  ('Airport Transfer', 'نقل من المطار', 'Transfert Aéroport', 'Round-trip airport transfer', 80.00, 'one_time')
ON CONFLICT DO NOTHING;

-- Insert sample menu items (need category IDs)
DO $$
DECLARE
  appetizers_id UUID;
  mains_id UUID;
  desserts_id UUID;
  beverages_id UUID;
BEGIN
  SELECT id INTO appetizers_id FROM menu_categories WHERE name = 'Appetizers';
  SELECT id INTO mains_id FROM menu_categories WHERE name = 'Main Courses';
  SELECT id INTO desserts_id FROM menu_categories WHERE name = 'Desserts';
  SELECT id INTO beverages_id FROM menu_categories WHERE name = 'Beverages';
  
  INSERT INTO menu_items (category_id, name, name_ar, name_fr, description, price, preparation_time_minutes, is_vegetarian) VALUES
    (appetizers_id, 'Hummus Platter', 'طبق حمص', 'Plateau de Houmous', 'Creamy hummus with pita bread', 12.00, 10, true),
    (appetizers_id, 'Grilled Halloumi', 'حلوم مشوي', 'Halloumi Grillé', 'Grilled halloumi cheese with herbs', 14.00, 15, true),
    (mains_id, 'Grilled Sea Bass', 'سمك قاروص مشوي', 'Bar Grillé', 'Fresh sea bass with lemon butter sauce', 32.00, 25, false),
    (mains_id, 'Mixed Grill', 'مشاوي مشكلة', 'Grillade Mixte', 'Assortment of grilled meats', 38.00, 30, false),
    (desserts_id, 'Baklava', 'بقلاوة', 'Baklava', 'Traditional layered pastry with nuts and honey', 10.00, 5, true),
    (desserts_id, 'Chocolate Cake', 'كيك شوكولاتة', 'Gâteau au Chocolat', 'Rich chocolate layer cake', 12.00, 5, true),
    (beverages_id, 'Fresh Orange Juice', 'عصير برتقال طازج', 'Jus d''Orange Frais', 'Freshly squeezed orange juice', 6.00, 5, true),
    (beverages_id, 'Turkish Coffee', 'قهوة تركية', 'Café Turc', 'Traditional Turkish coffee', 4.00, 5, true)
  ON CONFLICT DO NOTHING;
END $$;

-- Insert sample restaurant tables
INSERT INTO restaurant_tables (table_number, capacity, location) VALUES
  ('T1', 4, 'Indoor'),
  ('T2', 4, 'Indoor'),
  ('T3', 6, 'Indoor'),
  ('T4', 2, 'Terrace'),
  ('T5', 4, 'Terrace'),
  ('T6', 8, 'Private Room')
ON CONFLICT (table_number) DO NOTHING;

-- ============================================
-- Migration Complete!
-- ============================================
`;

    console.log(migrationSQL);
    console.log('');
    console.log('=' .repeat(80));
    console.log('');
    console.log('✅ Copy the SQL above and run it in Supabase SQL Editor');
    console.log('📍 URL: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql/new');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
