-- ============================================
-- V2 Resort - Consolidated Missing Tables Migration
-- Includes content from add_missing_tables.sql and create_backups_table.sql
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

-- Ensure columns exist if table already exists
DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS template_type module_template_type;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS name_ar VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS name_fr VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS slug VARCHAR(50);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'Package';
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS image_url TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN null; END $$;

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

-- Ensure columns exist
DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS subject_ar VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS subject_fr VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS html_body_ar TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS html_body_fr TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS text_body TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

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

-- Ensure columns exist (Critical fix for existing table)
DO $$ BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_response TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES users(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_module ON reviews(module_id);

-- ============================================
-- BACKUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT,
    type TEXT NOT NULL CHECK (type IN ('manual', 'scheduled')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    checksum TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);


-- ============================================
-- ADD MODULE_ID TO EXISTING CONTENT TABLES
-- Links content to existing tables
-- ============================================

-- Add module_id to menu_categories if not exists
DO $$ BEGIN
  ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Add module_id to chalets if not exists
DO $$ BEGIN
  ALTER TABLE chalets ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Add module_id to pool_sessions if not exists
DO $$ BEGIN
  ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Add module_id to snack_items if not exists
DO $$ BEGIN
  ALTER TABLE snack_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
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
-- Use DO block to avoid errors if tables are empty or missing
DO $$ BEGIN
    UPDATE menu_categories SET module_id = (SELECT id FROM modules WHERE slug = 'restaurant') WHERE module_id IS NULL;
EXCEPTION WHEN undefined_table THEN null; END $$;

DO $$ BEGIN
    UPDATE chalets SET module_id = (SELECT id FROM modules WHERE slug = 'chalets') WHERE module_id IS NULL;
EXCEPTION WHEN undefined_table THEN null; END $$;

DO $$ BEGIN
    UPDATE pool_sessions SET module_id = (SELECT id FROM modules WHERE slug = 'pool') WHERE module_id IS NULL;
EXCEPTION WHEN undefined_table THEN null; END $$;

DO $$ BEGIN
    UPDATE snack_items SET module_id = (SELECT id FROM modules WHERE slug = 'snack-bar') WHERE module_id IS NULL;
EXCEPTION WHEN undefined_table THEN null; END $$;
