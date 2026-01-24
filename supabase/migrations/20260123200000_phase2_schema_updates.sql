-- Phase 2 Schema Updates: Module Versioning, Payment Ledger, Translations governance

-- 1. Add settings_version to modules table
ALTER TABLE modules ADD COLUMN IF NOT EXISTS settings_version INTEGER DEFAULT 1;

-- 2. Payment Ledger for Idempotency & Audit
CREATE TABLE IF NOT EXISTS payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type VARCHAR(50) NOT NULL, -- 'restaurant_order', 'booking', etc.
  reference_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'authorized', 'captured', 'refunded', 'webhook_received'
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  gateway_reference_id VARCHAR(100), -- Stripe PaymentIntent ID
  webhook_id VARCHAR(100), -- For idempotency
  status VARCHAR(20) NOT NULL, -- 'success', 'failed'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_webhook ON payment_ledger(webhook_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_gateway_ref ON payment_ledger(gateway_reference_id);

-- 3. Database-Backed Translations with Governance
DO $$ BEGIN
  CREATE TYPE translation_status AS ENUM ('draft', 'approved', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(100) NOT NULL DEFAULT 'common', -- e.g. 'common', 'menu', 'legal'
  key VARCHAR(255) NOT NULL,
  locale VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  status translation_status DEFAULT 'draft',
  context TEXT, -- Description for translators
  created_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(namespace, key, locale)
);

CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(locale, namespace);

-- 4. Enable RLS on new tables
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;

-- Policies for Translations (Staff can read, Admins can manage)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read published translations" ON translations;
  CREATE POLICY "Public read published translations" ON translations
    FOR SELECT USING (status = 'published');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read all translations" ON translations;
  CREATE POLICY "Staff can read all translations" ON translations
    FOR SELECT USING (auth.role() IN ('authenticated', 'service_role')); -- Simplified for development
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins manage translations" ON translations;
  CREATE POLICY "Admins manage translations" ON translations
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
      )
    );
END $$;
