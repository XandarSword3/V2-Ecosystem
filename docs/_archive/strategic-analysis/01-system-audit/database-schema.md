# Database Schema Documentation
## V2 Hospitality Platform - Complete Schema Reference

**Database:** PostgreSQL (Supabase)  
**Total Tables:** 95  
**Last Analyzed:** February 2026

---

# CORE TABLES

## 1. Users & Authentication

### `users`
The central user profile table for all system users (customers, staff, admins).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  avatar_url TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_created ON users(created_at);
```

**Relationships:**
- `user_roles` → Many-to-many with roles
- `chalet_bookings` → One-to-many
- `restaurant_orders` → One-to-many
- `pool_tickets` → One-to-many
- `loyalty_profiles` → One-to-one

### `roles`
System roles for access control.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data: customer, staff, manager, admin, super_admin
```

### `user_roles`
Junction table for user-role assignments.

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id)
);
```

### `app_permissions`
Granular permissions for system features.

```sql
CREATE TABLE app_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  module VARCHAR(100),
  action VARCHAR(50),  -- create, read, update, delete, manage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Examples: chalets.read, chalets.create, orders.manage, users.delete
```

### `role_permissions`
Maps permissions to roles.

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES app_permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);
```

### `two_factor_auth`
2FA configuration per user.

```sql
CREATE TABLE two_factor_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  secret VARCHAR(255) NOT NULL,  -- Encrypted TOTP secret
  is_enabled BOOLEAN DEFAULT false,
  backup_codes JSONB,  -- Encrypted backup codes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

### `biometric_credentials`
WebAuthn/FIDO2 credentials for biometric login.

```sql
CREATE TABLE biometric_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  device_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

### `password_history`
Prevents password reuse.

```sql
CREATE TABLE password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep last 5 passwords per user
```

---

## 2. Accommodation (Chalets)

### `chalets`
Accommodation units available for booking.

```sql
CREATE TABLE chalets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  short_description VARCHAR(500),
  capacity INTEGER NOT NULL DEFAULT 4,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  base_price DECIMAL(10,2) NOT NULL,
  weekend_price DECIMAL(10,2),
  images JSONB DEFAULT '[]',
  amenities JSONB DEFAULT '[]',
  features JSONB DEFAULT '[]',
  rules JSONB DEFAULT '[]',
  location VARCHAR(255),
  coordinates JSONB,  -- {lat, lng}
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chalets_active ON chalets(is_active);
CREATE INDEX idx_chalets_price ON chalets(base_price);
CREATE INDEX idx_chalets_capacity ON chalets(capacity);
```

### `chalet_bookings`
Accommodation reservations.

```sql
CREATE TABLE chalet_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number VARCHAR(50) UNIQUE NOT NULL,
  chalet_id UUID REFERENCES chalets(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
  guests INTEGER NOT NULL DEFAULT 1,
  guest_name VARCHAR(255),
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  special_requests TEXT,
  base_total DECIMAL(10,2) NOT NULL,
  addons_total DECIMAL(10,2) DEFAULT 0,
  taxes DECIMAL(10,2) DEFAULT 0,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  -- pending, confirmed, checked_in, checked_out, cancelled, no_show
  payment_status VARCHAR(50) DEFAULT 'pending',
  -- pending, partial, paid, refunded
  cancellation_policy_id UUID REFERENCES cancellation_policies(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  stripe_payment_intent_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bookings_chalet ON chalet_bookings(chalet_id);
CREATE INDEX idx_bookings_user ON chalet_bookings(user_id);
CREATE INDEX idx_bookings_dates ON chalet_bookings(check_in, check_out);
CREATE INDEX idx_bookings_status ON chalet_bookings(status);
CREATE INDEX idx_bookings_number ON chalet_bookings(booking_number);
```

### `cancellation_policies`
Configurable cancellation rules.

```sql
CREATE TABLE cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  -- [{days_before: 7, refund_percentage: 100}, {days_before: 3, refund_percentage: 50}]
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `seasonal_pricing_rules`
Dynamic pricing based on dates/seasons.

```sql
CREATE TABLE seasonal_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_multiplier DECIMAL(5,2) DEFAULT 1.00,
  -- 1.40 = 40% increase, 0.85 = 15% discount
  applies_to VARCHAR(50) DEFAULT 'all',
  -- all, chalets, pool, restaurant
  chalet_ids JSONB,  -- Specific chalets if not 'all'
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: Summer Peak (1.40), Christmas (1.50), Winter Low (0.85)
```

---

## 3. Pool & Facilities

### `pool_sessions`
Time-slot sessions for pool access.

```sql
CREATE TABLE pool_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES modules(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  day_of_week INTEGER[],  -- 0=Sun, 1=Mon, etc. Empty=every day
  max_capacity INTEGER NOT NULL,
  gender_restriction VARCHAR(20) DEFAULT 'mixed',
  -- mixed, male, female
  adult_price DECIMAL(10,2) NOT NULL,
  child_price DECIMAL(10,2),
  senior_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `pool_tickets`
Individual pool access tickets.

```sql
CREATE TABLE pool_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  session_id UUID REFERENCES pool_sessions(id),
  user_id UUID REFERENCES users(id),
  session_date DATE NOT NULL,
  quantity INTEGER DEFAULT 1,
  adult_count INTEGER DEFAULT 0,
  child_count INTEGER DEFAULT 0,
  senior_count INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  -- active, used, expired, cancelled, refunded
  qr_code TEXT,  -- Unique QR for validation
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tickets_session ON pool_tickets(session_id);
CREATE INDEX idx_tickets_date ON pool_tickets(session_date);
CREATE INDEX idx_tickets_user ON pool_tickets(user_id);
CREATE INDEX idx_tickets_status ON pool_tickets(status);
```

### `pool_memberships`
Recurring pool access subscriptions.

```sql
CREATE TABLE pool_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_months INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  max_entries_per_month INTEGER,  -- NULL = unlimited
  guest_passes_per_month INTEGER DEFAULT 0,
  benefits JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `membership_members`
User membership enrollments.

```sql
CREATE TABLE membership_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES pool_memberships(id),
  user_id UUID REFERENCES users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  -- active, expired, cancelled, suspended
  entries_used_this_month INTEGER DEFAULT 0,
  guest_passes_remaining INTEGER DEFAULT 0,
  auto_renew BOOLEAN DEFAULT false,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Restaurant & POS

### `menu_categories`
Menu category organization.

```sql
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  parent_id UUID REFERENCES menu_categories(id),  -- Subcategories
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `menu_items`
Restaurant menu items.

```sql
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES menu_categories(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  description TEXT,
  short_description VARCHAR(500),
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),  -- Recipe cost
  images JSONB DEFAULT '[]',
  allergens JSONB DEFAULT '[]',
  dietary_tags JSONB DEFAULT '[]',  -- vegan, vegetarian, gluten-free
  prep_time_minutes INTEGER,
  calories INTEGER,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_menu_category ON menu_items(category_id);
CREATE INDEX idx_menu_available ON menu_items(is_available);
```

### `menu_modifier_groups`
Modifier categories (Size, Extras, etc.).

```sql
CREATE TABLE menu_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `menu_modifier_options`
Individual modifier choices.

```sql
CREATE TABLE menu_modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES menu_modifier_groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `menu_item_modifiers`
Links items to modifier groups.

```sql
CREATE TABLE menu_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_group_id UUID REFERENCES menu_modifier_groups(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  UNIQUE(menu_item_id, modifier_group_id)
);
```

### `restaurant_tables`
Physical table management.

```sql
CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL,
  name VARCHAR(100),
  capacity INTEGER NOT NULL,
  min_capacity INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'AVAILABLE',
  -- AVAILABLE, OCCUPIED, RESERVED, CLEANING, OUT_OF_SERVICE
  section VARCHAR(100) DEFAULT 'main',
  position JSONB,  -- {x, y, rotation, width, height, shape}
  features JSONB DEFAULT '[]',  -- ['window', 'outdoor', 'wheelchair']
  server_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `table_reservations`
Restaurant table bookings.

```sql
CREATE TABLE table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES restaurant_tables(id),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  end_time TIME,  -- Calculated: time + 2 hours
  party_size INTEGER NOT NULL,
  guest_name VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50),
  guest_email VARCHAR(255),
  special_requests TEXT,
  status VARCHAR(50) DEFAULT 'PENDING',
  -- PENDING, CONFIRMED, SEATED, COMPLETED, CANCELLED, NO_SHOW
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reservations_table_date ON table_reservations(table_id, date);
CREATE INDEX idx_reservations_status ON table_reservations(status);
```

### `restaurant_orders`
Customer orders.

```sql
CREATE TABLE restaurant_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  table_id UUID REFERENCES restaurant_tables(id),
  server_id UUID REFERENCES users(id),
  order_type VARCHAR(50) DEFAULT 'dine_in',
  -- dine_in, takeaway, delivery
  status VARCHAR(50) DEFAULT 'pending',
  -- pending, confirmed, preparing, ready, served, completed, cancelled
  payment_status VARCHAR(50) DEFAULT 'pending',
  -- pending, partial, paid, refunded
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  service_charge DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  coupon_id UUID REFERENCES coupons(id),
  special_instructions TEXT,
  delivery_address JSONB,
  estimated_ready_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  stripe_payment_intent_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_user ON restaurant_orders(user_id);
CREATE INDEX idx_orders_table ON restaurant_orders(table_id);
CREATE INDEX idx_orders_status ON restaurant_orders(status);
CREATE INDEX idx_orders_date ON restaurant_orders(created_at);
```

### `restaurant_order_items`
Individual items within orders.

```sql
CREATE TABLE restaurant_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  name VARCHAR(255) NOT NULL,  -- Snapshot at order time
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  modifiers JSONB DEFAULT '[]',  -- [{name, price_adjustment}]
  modifiers_total DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  special_instructions TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  -- pending, sent_to_kitchen, preparing, ready, served, cancelled
  voided BOOLEAN DEFAULT false,
  void_reason TEXT,
  voided_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_order ON restaurant_order_items(order_id);
CREATE INDEX idx_order_items_menu ON restaurant_order_items(menu_item_id);
```

### `restaurant_tabs`
Open tabs for running bills.

```sql
CREATE TABLE restaurant_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  table_id UUID REFERENCES restaurant_tables(id),
  server_id UUID REFERENCES users(id),
  name VARCHAR(255),  -- "Table 5" or customer name
  status VARCHAR(50) DEFAULT 'open',
  -- open, closed, transferred
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
```

### `waitlist_entries`
Restaurant waiting list.

```sql
CREATE TABLE waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  type VARCHAR(50) DEFAULT 'restaurant',
  -- restaurant, pool
  party_size INTEGER NOT NULL,
  quoted_wait_time INTEGER,  -- Minutes
  status VARCHAR(50) DEFAULT 'waiting',
  -- waiting, notified, seated, cancelled, no_show
  notified_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  table_id UUID REFERENCES restaurant_tables(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_waitlist_status ON waitlist_entries(status);
CREATE INDEX idx_waitlist_type ON waitlist_entries(type);
```

---

## 5. Inventory Management

### `inventory_items`
Stock items tracked in inventory.

```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES inventory_categories(id),
  unit_of_measure VARCHAR(50) NOT NULL,  -- kg, liters, pieces, etc.
  current_stock DECIMAL(10,3) DEFAULT 0,
  min_stock_level DECIMAL(10,3) DEFAULT 0,
  max_stock_level DECIMAL(10,3),
  reorder_point DECIMAL(10,3),
  reorder_quantity DECIMAL(10,3),
  cost_per_unit DECIMAL(10,4) DEFAULT 0,
  supplier_id UUID REFERENCES inventory_suppliers(id),
  storage_location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_perishable BOOLEAN DEFAULT false,
  shelf_life_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_category ON inventory_items(category_id);
CREATE INDEX idx_inventory_low_stock ON inventory_items(current_stock, min_stock_level);
```

### `inventory_categories`
Inventory organization categories.

```sql
CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES inventory_categories(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `inventory_transactions`
All stock movements.

```sql
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id),
  transaction_type VARCHAR(50) NOT NULL,
  -- purchase, sale, adjustment, waste, transfer, return
  quantity DECIMAL(10,3) NOT NULL,  -- Positive or negative
  unit_cost DECIMAL(10,4),
  total_cost DECIMAL(10,2),
  reference_type VARCHAR(50),  -- order, purchase_order, manual
  reference_id UUID,
  reason TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inv_trans_item ON inventory_transactions(item_id);
CREATE INDEX idx_inv_trans_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inv_trans_date ON inventory_transactions(created_at);
```

### `inventory_batches`
Batch tracking with FIFO support.

```sql
CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id),
  batch_number VARCHAR(100),
  quantity DECIMAL(10,3) NOT NULL,
  remaining_quantity DECIMAL(10,3) NOT NULL,
  cost_per_unit DECIMAL(10,4) NOT NULL,
  received_date DATE NOT NULL,
  expiry_date DATE,
  supplier_id UUID REFERENCES inventory_suppliers(id),
  purchase_order_id UUID REFERENCES inventory_purchase_orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_batches_item ON inventory_batches(item_id);
CREATE INDEX idx_batches_expiry ON inventory_batches(expiry_date);
```

### `inventory_suppliers`
Vendor/supplier management.

```sql
CREATE TABLE inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  payment_terms VARCHAR(100),  -- Net 30, COD, etc.
  lead_time_days INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `inventory_purchase_orders`
Purchase order management.

```sql
CREATE TABLE inventory_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES inventory_suppliers(id),
  status VARCHAR(50) DEFAULT 'draft',
  -- draft, submitted, approved, received, cancelled
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  received_date DATE,
  subtotal DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  shipping_cost DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `inventory_purchase_order_items`
Line items in purchase orders.

```sql
CREATE TABLE inventory_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id),
  quantity_ordered DECIMAL(10,3) NOT NULL,
  quantity_received DECIMAL(10,3) DEFAULT 0,
  unit_cost DECIMAL(10,4) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `inventory_recipes`
Recipe definitions for menu items.

```sql
CREATE TABLE inventory_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  yield_quantity DECIMAL(10,3) DEFAULT 1,
  yield_unit VARCHAR(50),
  prep_time_minutes INTEGER,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `inventory_recipe_ingredients`
Ingredients in recipes.

```sql
CREATE TABLE inventory_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES inventory_recipes(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id),
  quantity DECIMAL(10,4) NOT NULL,
  unit VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `menu_item_recipes`
Links menu items to recipes for auto-deduction.

```sql
CREATE TABLE menu_item_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES inventory_recipes(id),
  quantity DECIMAL(10,3) DEFAULT 1,
  UNIQUE(menu_item_id, recipe_id)
);
```

---

## 6. Payments & Finance

### `payments`
Payment records for all transactions.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  order_id UUID,  -- Can be order, booking, ticket, etc.
  order_type VARCHAR(50),  -- restaurant_order, chalet_booking, pool_ticket
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50),  -- card, cash, gift_card, loyalty_points
  status VARCHAR(50) DEFAULT 'pending',
  -- pending, processing, completed, failed, refunded
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `cash_drawers`
Cash drawer management for POS.

```sql
CREATE TABLE cash_drawers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  current_balance DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'closed',
  -- closed, open, counting
  opened_at TIMESTAMPTZ,
  opened_by UUID REFERENCES users(id),
  opening_balance DECIMAL(10,2),
  expected_balance DECIMAL(10,2),
  actual_balance DECIMAL(10,2),
  variance DECIMAL(10,2),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `cash_transactions`
Individual cash movements.

```sql
CREATE TABLE cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id UUID REFERENCES cash_drawers(id),
  transaction_type VARCHAR(50) NOT NULL,
  -- sale, refund, drop, pickup, adjustment
  amount DECIMAL(10,2) NOT NULL,
  payment_id UUID REFERENCES payments(id),
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Loyalty & Promotions

### `loyalty_tiers`
Loyalty program tier definitions.

```sql
CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,  -- Bronze, Silver, Gold, Platinum
  min_points INTEGER NOT NULL,
  points_multiplier DECIMAL(4,2) DEFAULT 1.00,
  benefits JSONB DEFAULT '[]',
  color VARCHAR(20),
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: Bronze(1), Silver(1000), Gold(5000), Platinum(15000)
```

### `loyalty_profiles`
Customer loyalty accounts.

```sql
CREATE TABLE loyalty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES loyalty_tiers(id),
  points_balance INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  lifetime_spent DECIMAL(10,2) DEFAULT 0,
  member_since DATE DEFAULT CURRENT_DATE,
  tier_expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `loyalty_transactions`
Points earning/redemption history.

```sql
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES loyalty_profiles(id),
  transaction_type VARCHAR(50) NOT NULL,
  -- earn, redeem, expire, adjust, bonus
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_type VARCHAR(50),  -- order, booking, manual
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `coupons`
Discount coupon definitions.

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255),
  description TEXT,
  discount_type VARCHAR(50) NOT NULL,  -- percentage, fixed
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(10,2),
  max_discount DECIMAL(10,2),
  max_uses INTEGER,
  max_uses_per_user INTEGER DEFAULT 1,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  applies_to VARCHAR(50) DEFAULT 'all',
  -- all, restaurant, pool, chalets
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `gift_cards`
Gift card inventory.

```sql
CREATE TABLE gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  template_id UUID REFERENCES gift_card_templates(id),
  initial_balance DECIMAL(10,2) NOT NULL,
  balance DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  purchased_by UUID REFERENCES users(id),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  personal_message TEXT,
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Staff & Shifts

### `staff_shifts`
Employee shift records.

```sql
CREATE TABLE staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  shift_type VARCHAR(50) NOT NULL,
  -- morning, afternoon, evening, night, split, on_call
  department VARCHAR(50) NOT NULL,
  -- kitchen, front_desk, housekeeping, pool, restaurant, maintenance
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'scheduled',
  -- scheduled, in_progress, completed, cancelled, no_show
  late_reason TEXT,
  early_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shifts_user ON staff_shifts(user_id);
CREATE INDEX idx_shifts_date ON staff_shifts(scheduled_start);
CREATE INDEX idx_shifts_status ON staff_shifts(status);
```

### `shift_swap_requests`
Shift trading between employees.

```sql
CREATE TABLE shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_user_id UUID REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  original_shift_id UUID REFERENCES staff_shifts(id),
  target_shift_id UUID REFERENCES staff_shifts(id),
  status VARCHAR(50) DEFAULT 'pending',
  -- pending, approved, rejected, cancelled
  reason TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. Housekeeping

### `housekeeping_tasks`
Cleaning/maintenance task tracking.

```sql
CREATE TABLE housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type_id UUID REFERENCES housekeeping_task_types(id),
  location_type VARCHAR(50) NOT NULL,
  -- chalet, pool, restaurant, common_area
  location_id UUID,  -- Reference to chalet_id, etc.
  assigned_to UUID REFERENCES users(id),
  priority VARCHAR(20) DEFAULT 'medium',
  -- low, medium, high, urgent
  status VARCHAR(50) DEFAULT 'pending',
  -- pending, in_progress, completed, cancelled, blocked
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_assigned ON housekeeping_tasks(assigned_to);
CREATE INDEX idx_tasks_status ON housekeeping_tasks(status);
CREATE INDEX idx_tasks_due ON housekeeping_tasks(due_date);
```

### `housekeeping_sla`
Service level agreements for task completion.

```sql
CREATE TABLE housekeeping_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type_id UUID REFERENCES housekeeping_task_types(id),
  priority VARCHAR(20) NOT NULL,
  response_time_minutes INTEGER NOT NULL,
  resolution_time_minutes INTEGER NOT NULL,
  escalation_after_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 10. Notifications

### `notifications`
In-app notification storage.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(is_read);
```

### `device_tokens`
Push notification registration.

```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,  -- ios, android, web
  device_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. System & Config

### `modules`
Feature modules that can be enabled/disabled.

```sql
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  is_core BOOLEAN DEFAULT false,  -- Can't be disabled
  settings JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: restaurant, pool, chalets, snack_bar, gift_cards, loyalty
```

### `system_settings`
Key-value configuration store.

```sql
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  category VARCHAR(100),
  is_public BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `audit_logs`
Administrative action tracking.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
```

---

# ENTITY RELATIONSHIP DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS & AUTH                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌─────────┐     ┌─────────────┐     ┌─────────┐                     │
│    │  users  │────<│ user_roles  │>────│  roles  │                     │
│    └────┬────┘     └─────────────┘     └────┬────┘                     │
│         │                                    │                          │
│         │          ┌───────────────────┐    │                          │
│         └─────────>│ loyalty_profiles  │    │                          │
│         │          └───────────────────┘    │                          │
│         │                                   ▼                          │
│         │          ┌─────────────────────────────────┐                 │
│         │          │     role_permissions            │                 │
│         │          └─────────────────────────────────┘                 │
│         │                      │                                        │
│         │                      ▼                                        │
│         │          ┌─────────────────────────────────┐                 │
│         │          │     app_permissions             │                 │
│         │          └─────────────────────────────────┘                 │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
          │
┌─────────┼───────────────────────────────────────────────────────────────┐
│         │              RESTAURANT & POS                                  │
├─────────┼───────────────────────────────────────────────────────────────┤
│         │                                                                │
│         │     ┌─────────────────┐     ┌──────────────────┐             │
│         ├────>│restaurant_orders│────>│restaurant_order  │             │
│         │     │                 │     │     _items       │             │
│         │     └────────┬────────┘     └────────┬─────────┘             │
│         │              │                       │                        │
│         │              │                       ▼                        │
│         │              │              ┌──────────────────┐             │
│         │              │              │   menu_items     │             │
│         │              │              └────────┬─────────┘             │
│         │              │                       │                        │
│         │              │                       ▼                        │
│         │              │              ┌──────────────────┐             │
│         │              │              │ menu_categories  │             │
│         │              │              └──────────────────┘             │
│         │              │                                                │
│         │              ▼                                                │
│         │     ┌─────────────────┐                                      │
│         │     │restaurant_tables│<────┐                                │
│         │     └─────────────────┘     │                                │
│         │              │              │                                │
│         │              ▼              │                                │
│         │     ┌─────────────────┐     │                                │
│         │     │table_reservations────┘                                │
│         │     └─────────────────┘                                      │
│         │                                                               │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
          │
┌─────────┼───────────────────────────────────────────────────────────────┐
│         │              ACCOMMODATIONS                                    │
├─────────┼───────────────────────────────────────────────────────────────┤
│         │                                                                │
│         │     ┌─────────────────┐     ┌──────────────────┐             │
│         ├────>│ chalet_bookings │────>│     chalets      │             │
│         │     └─────────────────┘     └──────────────────┘             │
│         │              │                                                │
│         │              ▼                                                │
│         │     ┌─────────────────────┐                                  │
│         │     │cancellation_policies│                                  │
│         │     └─────────────────────┘                                  │
│         │                                                               │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
          │
┌─────────┼───────────────────────────────────────────────────────────────┐
│         │              POOL & FACILITIES                                 │
├─────────┼───────────────────────────────────────────────────────────────┤
│         │                                                                │
│         │     ┌─────────────────┐     ┌──────────────────┐             │
│         ├────>│   pool_tickets  │────>│  pool_sessions   │             │
│         │     └─────────────────┘     └──────────────────┘             │
│         │                                                               │
│         │     ┌─────────────────┐     ┌──────────────────┐             │
│         └────>│membership_members────>│ pool_memberships │             │
│               └─────────────────┘     └──────────────────┘             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                          INVENTORY                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌──────────────────┐                          │
│  │ inventory_items │────>│inventory_categories                         │
│  └────────┬────────┘     └──────────────────┘                          │
│           │                                                             │
│           ├──────────────────────────────────────────┐                 │
│           │                                          │                 │
│           ▼                                          ▼                 │
│  ┌─────────────────────┐              ┌─────────────────────────┐     │
│  │inventory_transactions              │  inventory_batches      │     │
│  └─────────────────────┘              └───────────┬─────────────┘     │
│                                                   │                    │
│                                                   ▼                    │
│                                       ┌─────────────────────────┐     │
│                                       │inventory_purchase_orders│     │
│                                       └───────────┬─────────────┘     │
│                                                   │                    │
│                                                   ▼                    │
│                                       ┌─────────────────────────┐     │
│                                       │  inventory_suppliers    │     │
│                                       └─────────────────────────┘     │
│                                                                         │
│  ┌─────────────────┐     ┌───────────────────────────┐                │
│  │inventory_recipes│────>│inventory_recipe_ingredients│               │
│  └────────┬────────┘     └───────────────────────────┘                │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────┐                                                   │
│  │menu_item_recipes│─────────────────> (to menu_items)                │
│  └─────────────────┘                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# TABLE COUNT SUMMARY

| Category | Tables | Status |
|----------|--------|--------|
| Users & Auth | 12 | ✅ Active |
| Restaurant & POS | 15 | ✅ Active |
| Accommodations | 6 | ✅ Active |
| Pool & Facilities | 6 | ✅ Active |
| Inventory | 14 | ✅ Active |
| Payments & Finance | 8 | ✅ Active |
| Loyalty & Promotions | 12 | ✅ Active |
| Staff & Shifts | 4 | ✅ Active |
| Housekeeping | 8 | ✅ Active |
| Notifications | 5 | ✅ Active |
| System & Config | 5 | ✅ Active |
| **TOTAL** | **95** | |

---

*Last Updated: February 2026*
