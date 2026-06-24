-- ============================================
-- V2 Ecosystem - Consolidated Missing Tables Migration
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
    ALTER TABLE modules ADD COLUMN IF NOT EXISTS settings_version INTEGER DEFAULT 1;
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

-- Add module_id to catalog_categories (pre-rename: catalog_categories) if not exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_categories') THEN
    ALTER TABLE catalog_categories ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_categories') THEN
    ALTER TABLE catalog_categories ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
  END IF;
END $$;

-- Add module_id to accommodation_units if not exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accommodation_units') THEN
    ALTER TABLE accommodation_units ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
  END IF;
END $$;

-- Add module_id to capacity_windows if not exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capacity_windows') THEN
    ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
  END IF;
END $$;

-- snack_items removed (legacy table eliminated)

-- Create indexes for module_id columns (guarded: only if tables exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_categories') THEN
    CREATE INDEX IF NOT EXISTS idx_catalog_categories_module ON catalog_categories(module_id);
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_categories') THEN
    CREATE INDEX IF NOT EXISTS idx_catalog_categories_module ON catalog_categories(module_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accommodation_units') THEN
    CREATE INDEX IF NOT EXISTS idx_accommodation_units_module ON accommodation_units(module_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capacity_windows') THEN
    CREATE INDEX IF NOT EXISTS idx_capacity_windows_module ON capacity_windows(module_id);
  END IF;
END $$;

-- ============================================
-- SEED DATA: MODULES
-- ============================================
-- Legacy module seeds removed — modules are created dynamically via the platform UI.

-- Module linkage is managed dynamically via the platform UI; no static seed associations needed.
