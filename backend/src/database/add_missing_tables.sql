-- ============================================
-- V2 Resort - Missing Tables Migration
-- Run this AFTER the main migration.sql
-- ============================================

-- Create enums for new tables (safe - won't fail if they exist)
DO $$ BEGIN
  CREATE TYPE module_template_type AS ENUM ('menu_service', 'multi_day_booking', 'session_access');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- MODULES TABLE
-- Defines which business modules are active and configured
-- ============================================
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type module_template_type NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  name_fr VARCHAR(100),
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Package',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_modules_slug ON modules(slug);
CREATE INDEX IF NOT EXISTS idx_modules_active ON modules(is_active);
CREATE INDEX IF NOT EXISTS idx_modules_sort ON modules(sort_order);

-- ============================================
-- EMAIL TEMPLATES TABLE
-- Stores customizable email templates
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  subject_ar VARCHAR(255),
  subject_fr VARCHAR(255),
  html_body TEXT NOT NULL,
  html_body_ar TEXT,
  html_body_fr TEXT,
  text_body TEXT,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(template_name);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  module_id UUID REFERENCES modules(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  content TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  is_featured BOOLEAN DEFAULT false,
  admin_response TEXT,
  responded_at TIMESTAMP,
  responded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_module ON reviews(module_id);

-- ============================================
-- ADD MODULE_ID TO EXISTING CONTENT TABLES
-- Links content to specific modules
-- ============================================

-- Add module_id to menu_categories if not exists
DO $$ BEGIN
  ALTER TABLE menu_categories ADD COLUMN module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Add module_id to chalets if not exists
DO $$ BEGIN
  ALTER TABLE chalets ADD COLUMN module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Add module_id to pool_sessions if not exists
DO $$ BEGIN
  ALTER TABLE pool_sessions ADD COLUMN module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Add module_id to snack_items if not exists
DO $$ BEGIN
  ALTER TABLE snack_items ADD COLUMN module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Create indexes for module_id columns
CREATE INDEX IF NOT EXISTS idx_menu_categories_module ON menu_categories(module_id);
CREATE INDEX IF NOT EXISTS idx_chalets_module ON chalets(module_id);
CREATE INDEX IF NOT EXISTS idx_pool_sessions_module ON pool_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_snack_items_module ON snack_items(module_id);

-- ============================================
-- SEED DATA: MODULES
-- ============================================
INSERT INTO modules (template_type, name, name_ar, name_fr, slug, description, icon, is_active, sort_order) VALUES
  ('menu_service', 'Restaurant', 'المطعم', 'Restaurant', 'restaurant', 'Fine dining experience with diverse menu options', 'UtensilsCrossed', true, 1),
  ('multi_day_booking', 'Chalets', 'الشاليهات', 'Chalets', 'chalets', 'Luxurious beachfront accommodations', 'Home', true, 2),
  ('session_access', 'Pool', 'المسبح', 'Piscine', 'pool', 'Refreshing pool sessions with beautiful views', 'Waves', true, 3),
  ('menu_service', 'Snack Bar', 'سناك بار', 'Snack-Bar', 'snack-bar', 'Quick bites and refreshments', 'Coffee', true, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  name_fr = EXCLUDED.name_fr,
  updated_at = NOW();

-- Link existing content to modules (update rows where module_id is NULL)
UPDATE menu_categories SET module_id = (SELECT id FROM modules WHERE slug = 'restaurant') WHERE module_id IS NULL;
UPDATE chalets SET module_id = (SELECT id FROM modules WHERE slug = 'chalets') WHERE module_id IS NULL;
UPDATE pool_sessions SET module_id = (SELECT id FROM modules WHERE slug = 'pool') WHERE module_id IS NULL;
UPDATE snack_items SET module_id = (SELECT id FROM modules WHERE slug = 'snack-bar') WHERE module_id IS NULL;

-- ============================================
-- SEED DATA: EMAIL TEMPLATES
-- ============================================
INSERT INTO email_templates (template_name, subject, html_body, variables) VALUES
  (
    'order_confirmation',
    'Order Confirmation - {{orderNumber}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0ea5e9, #7c3aed); color: white; padding: 30px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
    .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .total { font-size: 18px; font-weight: bold; color: #0ea5e9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{companyName}}</h1>
    <p>Order Confirmation</p>
  </div>
  <div class="content">
    <h2>Thank you for your order, {{customerName}}!</h2>
    <p>Your order has been received and is being prepared.</p>
    <div class="order-details">
      <p><strong>Order Number:</strong> {{orderNumber}}</p>
      <p><strong>Order Date:</strong> {{orderDate}}</p>
      <p><strong>Estimated Ready Time:</strong> {{estimatedTime}}</p>
      <h3>Order Items</h3>
      {{orderItems}}
      <hr>
      <p class="total">Total: {{totalAmount}}</p>
    </div>
    <p>Questions? Contact us at {{contactPhone}} or {{contactEmail}}.</p>
  </div>
  <div class="footer">
    <p>{{companyName}} | {{companyAddress}}</p>
  </div>
</body>
</html>',
    '["companyName", "customerName", "orderNumber", "orderDate", "estimatedTime", "orderItems", "totalAmount", "contactPhone", "contactEmail", "companyAddress"]'
  ),
  (
    'booking_confirmation',
    'Booking Confirmation - {{bookingNumber}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0ea5e9, #7c3aed); color: white; padding: 30px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .highlight { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{companyName}}</h1>
    <p>Booking Confirmation</p>
  </div>
  <div class="content">
    <h2>Your booking is confirmed, {{customerName}}!</h2>
    <p>We are excited to welcome you to {{chaletName}}.</p>
    <div class="booking-details">
      <p><strong>Booking Reference:</strong> {{bookingNumber}}</p>
      <p><strong>Chalet:</strong> {{chaletName}}</p>
      <p><strong>Check-in:</strong> {{checkInDate}} at {{checkInTime}}</p>
      <p><strong>Check-out:</strong> {{checkOutDate}} at {{checkOutTime}}</p>
      <p><strong>Guests:</strong> {{numberOfGuests}}</p>
      <p><strong>Nights:</strong> {{numberOfNights}}</p>
      {{addOns}}
      <hr>
      <p><strong>Total Amount:</strong> {{totalAmount}}</p>
      <p><strong>Payment Status:</strong> {{paymentStatus}}</p>
    </div>
    <div class="highlight">
      <strong>Important:</strong> Please bring a valid ID for check-in.
    </div>
    <p>Need changes? Contact us at {{contactPhone}} or {{contactEmail}}.</p>
  </div>
  <div class="footer">
    <p>{{companyName}} | {{companyAddress}}</p>
  </div>
</body>
</html>',
    '["companyName", "customerName", "bookingNumber", "chaletName", "checkInDate", "checkInTime", "checkOutDate", "checkOutTime", "numberOfGuests", "numberOfNights", "addOns", "totalAmount", "paymentStatus", "contactPhone", "contactEmail", "companyAddress"]'
  ),
  (
    'ticket_delivery',
    'Your Pool Ticket - {{ticketNumber}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0ea5e9, #7c3aed); color: white; padding: 30px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
    .ticket-card { background: white; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center; border: 2px dashed #0ea5e9; }
    .qr-code { margin: 20px auto; max-width: 200px; }
    .ticket-info { background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: left; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{companyName}}</h1>
    <p>Your Pool Ticket</p>
  </div>
  <div class="content">
    <h2>Hello {{customerName}}!</h2>
    <p>Your pool ticket is ready. Show this QR code at the entrance.</p>
    <div class="ticket-card">
      <h3>POOL ACCESS TICKET</h3>
      <p><strong>Ticket #{{ticketNumber}}</strong></p>
      <div class="qr-code">
        <img src="{{qrCodeUrl}}" alt="QR Code" style="width: 100%; max-width: 200px;">
      </div>
      <div class="ticket-info">
        <p><strong>Session:</strong> {{sessionName}}</p>
        <p><strong>Date:</strong> {{ticketDate}}</p>
        <p><strong>Time:</strong> {{sessionTime}}</p>
        <p><strong>Guests:</strong> {{numberOfGuests}}</p>
      </div>
    </div>
    <p><strong>Note:</strong> This ticket is valid only for the date and session shown. Arrive 15 min early.</p>
    <p>Questions? {{contactPhone}} or {{contactEmail}}</p>
  </div>
  <div class="footer">
    <p>{{companyName}} | {{companyAddress}}</p>
  </div>
</body>
</html>',
    '["companyName", "customerName", "ticketNumber", "qrCodeUrl", "sessionName", "ticketDate", "sessionTime", "numberOfGuests", "contactPhone", "contactEmail", "companyAddress"]'
  ),
  (
    'password_reset',
    'Reset Your Password - {{companyName}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0ea5e9, #7c3aed); color: white; padding: 30px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
    .btn { display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{companyName}}</h1>
    <p>Password Reset</p>
  </div>
  <div class="content">
    <h2>Hello {{customerName}},</h2>
    <p>We received a request to reset your password. Click below to create a new password:</p>
    <p style="text-align: center;">
      <a href="{{resetUrl}}" class="btn">Reset Password</a>
    </p>
    <p>This link expires in 1 hour.</p>
    <div class="warning">
      <strong>Did not request this?</strong> Ignore this email - your password will remain unchanged.
    </div>
  </div>
  <div class="footer">
    <p>{{companyName}} | {{companyAddress}}</p>
  </div>
</body>
</html>',
    '["companyName", "customerName", "resetUrl", "companyAddress"]'
  ),
  (
    'welcome',
    'Welcome to {{companyName}}!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0ea5e9, #7c3aed); color: white; padding: 30px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
    .btn { display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .feature { padding: 15px; margin: 10px 0; background: white; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{companyName}}</h1>
    <p>Welcome!</p>
  </div>
  <div class="content">
    <h2>Welcome, {{customerName}}!</h2>
    <p>Thank you for creating an account. We are excited to have you!</p>
    <h3>What you can do:</h3>
    <div class="feature">🍽️ <strong>Restaurant</strong> - Order delicious meals</div>
    <div class="feature">🏠 <strong>Chalets</strong> - Book luxurious accommodations</div>
    <div class="feature">🏊 <strong>Pool</strong> - Purchase pool session tickets</div>
    <div class="feature">☕ <strong>Snack Bar</strong> - Grab quick refreshments</div>
    <p style="text-align: center;">
      <a href="{{siteUrl}}" class="btn">Start Exploring</a>
    </p>
  </div>
  <div class="footer">
    <p>{{companyName}} | {{companyAddress}}</p>
  </div>
</body>
</html>',
    '["companyName", "customerName", "siteUrl", "companyAddress"]'
  )
ON CONFLICT (template_name) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
