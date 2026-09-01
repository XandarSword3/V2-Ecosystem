import { getPool, initializeDatabase, closeDatabase } from "./connection.js";
import { logger } from "../utils/logger.js";
import * as fs from 'fs';
import * as path from 'path';

export async function migrate() {
  try {
    // Only initialize if not already initialized
    try {
      await initializeDatabase();
    } catch (e) {
      // Ignore if already initialized
    }
    const pool = getPool();

    logger.info('Running migrations...');

    // Create enums (generic state enums only — no module-specific types)
    await pool.query(`
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
        slug VARCHAR(100),
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

    // Add name column to sessions (used by dynamic module session_access queries)
    await pool.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS name TEXT;
    `);

    // Compatibility shim: older bootstrap schemas created permissions without slug.
    // Later SQL migrations and module logic rely on this column and a unique index.
    await pool.query(`
      ALTER TABLE permissions ADD COLUMN IF NOT EXISTS slug VARCHAR(100);

      UPDATE permissions
      SET slug = COALESCE(
        slug,
        'perm_' || REPLACE(id::text, '-', '')
      )
      WHERE slug IS NULL OR slug = '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_slug ON permissions(slug);
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
        user_id UUID REFERENCES users(id),
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        target_type VARCHAR(50) NOT NULL DEFAULT 'user',
        channel VARCHAR(20) NOT NULL DEFAULT 'in_app',
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        data JSONB DEFAULT '{}'::jsonb,
        actions JSONB DEFAULT '[]'::jsonb,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        scheduled_for TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
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
        name_ar VARCHAR(100),
        name_fr VARCHAR(100),
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        description_ar TEXT,
        description_fr TEXT,
        settings JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        show_in_main BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Add translation columns to modules if they don't exist (for upgrades)
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'name_ar') THEN
          ALTER TABLE modules ADD COLUMN name_ar VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'name_fr') THEN
          ALTER TABLE modules ADD COLUMN name_fr VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'description_ar') THEN
          ALTER TABLE modules ADD COLUMN description_ar TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'description_fr') THEN
          ALTER TABLE modules ADD COLUMN description_fr TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'show_in_main') THEN
          ALTER TABLE modules ADD COLUMN show_in_main BOOLEAN DEFAULT true;
        END IF;
      END $$;

    `);

    // Create transactions table (engine-refit unified table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metadata_id UUID REFERENCES modules(id) ON DELETE SET NULL,
        engine_type VARCHAR(50) NOT NULL,
        property_id UUID,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        service_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        customer_id UUID,
        staff_id UUID,
        service_location_id UUID,
        reference_id UUID,
        reference_table VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'
      );

      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service_location_id UUID;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS staff_id UUID;
      ALTER TABLE transactions ALTER COLUMN property_id DROP NOT NULL;
      ALTER TABLE transactions ALTER COLUMN reference_id DROP NOT NULL;
      ALTER TABLE transactions ALTER COLUMN reference_table DROP NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_transactions_engine_type ON transactions(engine_type);
      CREATE INDEX IF NOT EXISTS idx_transactions_metadata_id ON transactions(metadata_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_scoped_idempotency ON transactions ((metadata->>'scoped_idempotency_key')) WHERE (metadata->>'scoped_idempotency_key') IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_active_service_location ON transactions (service_location_id) WHERE service_location_id IS NOT NULL AND engine_type = 'instant_transaction' AND status NOT IN ('completed', 'cancelled');

      CREATE TABLE IF NOT EXISTS idempotency_records (
        key VARCHAR(255) PRIMARY KEY,
        claim_token UUID NOT NULL DEFAULT gen_random_uuid(),
        status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
        transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        response JSONB,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS claim_token UUID NOT NULL DEFAULT gen_random_uuid();
      ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds');
      CREATE INDEX IF NOT EXISTS idx_idempotency_records_status ON idempotency_records(status);

      CREATE OR REPLACE FUNCTION claim_idempotency_key(
        p_key TEXT,
        p_lease_seconds INTEGER DEFAULT 60
      ) RETURNS JSONB
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_record RECORD;
        v_now TIMESTAMPTZ := NOW();
        v_expires TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
        v_token UUID := gen_random_uuid();
      BEGIN
        -- 1. Try to insert new claim with token
        INSERT INTO idempotency_records (key, claim_token, status, response, transaction_id, created_at, updated_at, expires_at)
        VALUES (p_key, v_token, 'in_progress', NULL, NULL, v_now, v_now, v_expires)
        ON CONFLICT (key) DO NOTHING
        RETURNING * INTO v_record;

        IF FOUND THEN
          RETURN jsonb_build_object('claimed', true, 'status', 'in_progress', 'claim_token', v_record.claim_token);
        END IF;

        -- 2. Row exists, check current state with row lock
        SELECT * INTO v_record FROM idempotency_records WHERE key = p_key FOR UPDATE;

        IF NOT FOUND THEN
          INSERT INTO idempotency_records (key, claim_token, status, response, transaction_id, created_at, updated_at, expires_at)
          VALUES (p_key, v_token, 'in_progress', NULL, NULL, v_now, v_now, v_expires)
          ON CONFLICT (key) DO NOTHING
          RETURNING * INTO v_record;
          
          IF FOUND THEN
            RETURN jsonb_build_object('claimed', true, 'status', 'in_progress', 'claim_token', v_record.claim_token);
          END IF;
          SELECT * INTO v_record FROM idempotency_records WHERE key = p_key;
        END IF;

        IF v_record.status = 'completed' THEN
          RETURN jsonb_build_object(
            'claimed', false,
            'status', 'completed',
            'response', v_record.response,
            'transaction_id', v_record.transaction_id
          );
        END IF;

        IF v_record.status = 'failed' OR (v_record.status = 'in_progress' AND v_record.expires_at < v_now) THEN
          -- Clean up uncompleted transactions from dead/expired attempts
          IF v_record.transaction_id IS NOT NULL THEN
            DELETE FROM order_items WHERE transaction_id = v_record.transaction_id;
            DELETE FROM transactions WHERE id = v_record.transaction_id;
          END IF;

          UPDATE idempotency_records
          SET claim_token = v_token,
              status = 'in_progress',
              response = NULL,
              transaction_id = NULL,
              updated_at = v_now,
              expires_at = v_expires
          WHERE key = p_key;

          RETURN jsonb_build_object('claimed', true, 'status', 'in_progress', 'claim_token', v_token);
        END IF;

        RETURN jsonb_build_object(
          'claimed', false,
          'status', 'in_progress',
          'expires_at', v_record.expires_at
        );
      END;
      $$;

      CREATE OR REPLACE FUNCTION assert_active_lease(
        p_key TEXT,
        p_claim_token UUID
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_count
        FROM idempotency_records
        WHERE key = p_key 
          AND claim_token = p_claim_token 
          AND status = 'in_progress'
          AND expires_at > NOW();

        RETURN v_count > 0;
      END;
      $$;

      CREATE OR REPLACE FUNCTION create_order_atomic(
        p_key TEXT,
        p_claim_token UUID,
        p_transaction JSONB
      ) RETURNS JSONB
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_lease RECORD;
        v_inserted RECORD;
        v_service_location_id UUID;
        v_existing_open_order UUID;
      BEGIN
        -- 1. Check & lock idempotency lease atomically
        IF p_key IS NOT NULL AND p_claim_token IS NOT NULL THEN
          SELECT * INTO v_lease
          FROM idempotency_records
          WHERE key = p_key
          FOR UPDATE;

          IF NOT FOUND OR v_lease.claim_token != p_claim_token OR v_lease.status != 'in_progress' OR v_lease.expires_at <= NOW() THEN
            RETURN jsonb_build_object('success', false, 'error', 'LEASE_LOST', 'message', 'Active checkout lease expired or taken over.');
          END IF;
        END IF;

        -- 2. Extract and check service location if provided
        IF (p_transaction->>'service_location_id') IS NOT NULL AND (p_transaction->>'service_location_id') != '' THEN
          v_service_location_id := (p_transaction->>'service_location_id')::UUID;
          
          SELECT id INTO v_existing_open_order
          FROM transactions
          WHERE service_location_id = v_service_location_id
            AND engine_type = 'instant_transaction'
            AND status NOT IN ('completed', 'cancelled')
          LIMIT 1;

          IF FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'LOCATION_OCCUPIED', 'message', 'This location/table already has an open order');
          END IF;
        END IF;

        -- 3. Insert transaction
        INSERT INTO transactions (
          engine_type,
          module_id,
          property_id,
          tenant_id,
          customer_id,
          staff_id,
          status,
          amount,
          discount_amount,
          tax_amount,
          service_charge,
          currency,
          service_location_id,
          metadata
        ) VALUES (
          COALESCE(p_transaction->>'engine_type', 'instant_transaction'),
          (p_transaction->>'module_id')::UUID,
          (p_transaction->>'property_id')::UUID,
          (p_transaction->>'tenant_id')::UUID,
          NULLIF(p_transaction->>'customer_id', '')::UUID,
          NULLIF(p_transaction->>'staff_id', '')::UUID,
          COALESCE(p_transaction->>'status', 'pending'),
          COALESCE((p_transaction->>'amount')::NUMERIC, 0),
          COALESCE((p_transaction->>'discount_amount')::NUMERIC, 0),
          COALESCE((p_transaction->>'tax_amount')::NUMERIC, 0),
          COALESCE((p_transaction->>'service_charge')::NUMERIC, 0),
          COALESCE(p_transaction->>'currency', 'USD'),
          v_service_location_id,
          COALESCE(p_transaction->'metadata', '{}'::jsonb)
        )
        RETURNING * INTO v_inserted;

        -- 4. Associate transaction_id on idempotency record if key was provided
        IF p_key IS NOT NULL AND p_claim_token IS NOT NULL THEN
          UPDATE idempotency_records
          SET transaction_id = v_inserted.id,
              updated_at = NOW()
          WHERE key = p_key AND claim_token = p_claim_token;
        END IF;

        RETURN jsonb_build_object('success', true, 'data', to_jsonb(v_inserted));
      EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONFLICT', 'message', SQLERRM);
      WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'DB_ERROR', 'message', SQLERRM);
      END;
      $$;

      CREATE OR REPLACE FUNCTION persist_order_items_atomic(
        p_key TEXT,
        p_claim_token UUID,
        p_transaction_id UUID,
        p_items JSONB
      ) RETURNS JSONB
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_lease RECORD;
        v_item JSONB;
        v_inserted JSONB := '[]'::jsonb;
        v_row RECORD;
      BEGIN
        IF p_key IS NOT NULL AND p_claim_token IS NOT NULL THEN
          SELECT * INTO v_lease
          FROM idempotency_records
          WHERE key = p_key
          FOR UPDATE;

          IF NOT FOUND OR v_lease.claim_token != p_claim_token OR v_lease.status != 'in_progress' OR v_lease.expires_at <= NOW() THEN
            RETURN jsonb_build_object('success', false, 'error', 'LEASE_LOST', 'message', 'Active checkout lease expired or taken over.');
          END IF;
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
          INSERT INTO order_items (
            transaction_id,
            catalog_item_id,
            quantity,
            unit_price,
            subtotal,
            special_instructions,
            status,
            tenant_id,
            property_id,
            metadata
          ) VALUES (
            p_transaction_id,
            NULLIF(v_item->>'catalog_item_id', '')::UUID,
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            COALESCE((v_item->>'unit_price')::NUMERIC, 0),
            COALESCE((v_item->>'subtotal')::NUMERIC, 0),
            v_item->>'special_instructions',
            COALESCE(v_item->>'status', 'pending'),
            (v_item->>'tenant_id')::UUID,
            (v_item->>'property_id')::UUID,
            COALESCE(v_item->'metadata', '{}'::jsonb)
          )
          RETURNING id, catalog_item_id, quantity, metadata INTO v_row;

          v_inserted := v_inserted || jsonb_build_array(to_jsonb(v_row));
        END LOOP;

        RETURN jsonb_build_object('success', true, 'data', v_inserted);
      END;
      $$;

      CREATE TABLE IF NOT EXISTS checkout_compensation_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        idempotency_key TEXT,
        transaction_id UUID,
        operation VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_compensation_queue_status ON checkout_compensation_queue(status);

      CREATE OR REPLACE FUNCTION queue_failed_compensation(
        p_key TEXT,
        p_transaction_id UUID,
        p_operation TEXT,
        p_payload JSONB,
        p_error TEXT
      ) RETURNS UUID
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_id UUID;
      BEGIN
        INSERT INTO checkout_compensation_queue (
          idempotency_key,
          transaction_id,
          operation,
          payload,
          last_error
        ) VALUES (
          p_key,
          p_transaction_id,
          p_operation,
          p_payload,
          p_error
        )
        RETURNING id INTO v_id;

        RETURN v_id;
      END;
      $$;

      CREATE OR REPLACE FUNCTION complete_idempotency_key(
        p_key TEXT,
        p_claim_token UUID,
        p_transaction_id UUID,
        p_response JSONB
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_updated INTEGER;
      BEGIN
        UPDATE idempotency_records
        SET status = 'completed',
            transaction_id = p_transaction_id,
            response = p_response,
            updated_at = NOW()
        WHERE key = p_key AND claim_token = p_claim_token AND status = 'in_progress';

        GET DIAGNOSTICS v_updated = ROW_COUNT;
        RETURN v_updated > 0;
      END;
      $$;

      CREATE OR REPLACE FUNCTION fail_idempotency_key(
        p_key TEXT,
        p_claim_token UUID
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_updated INTEGER;
      BEGIN
        UPDATE idempotency_records
        SET status = 'failed',
            updated_at = NOW()
        WHERE key = p_key AND claim_token = p_claim_token AND status = 'in_progress';

        GET DIAGNOSTICS v_updated = ROW_COUNT;
        RETURN v_updated > 0;
      END;
      $$;

      CREATE OR REPLACE FUNCTION heartbeat_idempotency_key(
        p_key TEXT,
        p_claim_token UUID,
        p_extension_seconds INTEGER DEFAULT 60
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_updated INTEGER;
      BEGIN
        UPDATE idempotency_records
        SET expires_at = NOW() + (p_extension_seconds || ' seconds')::INTERVAL,
            updated_at = NOW()
        WHERE key = p_key AND claim_token = p_claim_token AND status = 'in_progress';

        GET DIAGNOSTICS v_updated = ROW_COUNT;
        RETURN v_updated > 0;
      END;
      $$;

      -- Support inquiries table
      CREATE TABLE IF NOT EXISTS support_inquiries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        admin_notes TEXT,
        responded_at TIMESTAMP WITH TIME ZONE,
        responded_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- FAQs table
      CREATE TABLE IF NOT EXISTS faqs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Compatibility shim for legacy payments schema.
    // Older schemas may have chalet_booking_id/pool_ticket_id but no reference_type/reference_id.
    await pool.query(`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_id UUID;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'chalet_booking_id'
        ) THEN
          UPDATE payments
          SET reference_type = COALESCE(reference_type, 'booking'),
              reference_id = COALESCE(reference_id, chalet_booking_id)
          WHERE chalet_booking_id IS NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'pool_ticket_id'
        ) THEN
          UPDATE payments
          SET reference_type = COALESCE(reference_type, 'pool_ticket'),
              reference_id = COALESCE(reference_id, pool_ticket_id)
          WHERE pool_ticket_id IS NOT NULL;
        END IF;
      END $$;

      UPDATE payments
      SET reference_type = COALESCE(reference_type, 'legacy')
      WHERE reference_type IS NULL;
    `);

    // Compatibility shim for legacy loyalty_transactions schema.
    // Some historical Supabase migrations created loyalty_transactions without reference_type/reference_id
    // (or with a `type` column rather than `transaction_type`). Integration tests and reporting indexes
    // assume these fields exist.
    await pool.query(`
      ALTER TABLE IF EXISTS loyalty_transactions
        ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS reference_id UUID;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'loyalty_transactions'
            AND column_name = 'type'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'loyalty_transactions'
            AND column_name = 'transaction_type'
        ) THEN
          ALTER TABLE loyalty_transactions ADD COLUMN transaction_type VARCHAR(50);
          UPDATE loyalty_transactions
          SET transaction_type = COALESCE(transaction_type, type)
          WHERE transaction_type IS NULL;
        END IF;
      END $$;
    `);

    // Compatibility shim: older bootstrap schemas created notifications without
    // scheduling and delivery columns used by notification jobs.
    await pool.query(`
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT 'user';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'in_app';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

      ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE notifications ALTER COLUMN type SET DEFAULT 'info';

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'notifications'
            AND column_name = 'data'
            AND udt_name IN ('text', 'varchar')
        ) THEN
          ALTER TABLE notifications
          ALTER COLUMN data TYPE JSONB
          USING CASE
            WHEN data IS NULL OR BTRIM(data) = '' THEN '{}'::jsonb
            WHEN LEFT(BTRIM(data), 1) IN ('{', '[') THEN data::jsonb
            ELSE to_jsonb(data)
          END;
        END IF;
      EXCEPTION
        WHEN invalid_text_representation OR data_exception THEN
          -- Keep legacy data type if conversion fails; critical scheduling columns
          -- are still present from the ALTER TABLE statements above.
          NULL;
      END $$;
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
    `);

    // Legacy backfill removed per ARCHITECTURE_LAW.md

    let shouldReplaySqlMigrations = true;
    const supabaseMigrationTableResult = await pool.query<{ table_name: string | null }>(
      "SELECT to_regclass('supabase_migrations.schema_migrations')::text AS table_name"
    );

    if (supabaseMigrationTableResult.rows[0]?.table_name) {
      const appliedMigrationCountResult = await pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM supabase_migrations.schema_migrations'
      );
      const appliedMigrationCount = Number(appliedMigrationCountResult.rows[0]?.count ?? '0');

      if (appliedMigrationCount > 0) {
        shouldReplaySqlMigrations = false;
        logger.info(
          `Detected ${appliedMigrationCount} pre-applied Supabase migrations; skipping SQL file replay.`
        );
      }
    }

    // Apply SQL file migrations from supabase/migrations when migrations were not already applied.
    if (shouldReplaySqlMigrations) {
      logger.info('Applying SQL file migrations...');
      const migrationsDir = path.join(__dirname, '../../../supabase/migrations');

      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir)
          .filter(f => f.endsWith('.sql'))
          .sort(); // Run in order

        for (const file of files) {
          logger.info(`Processing migration file: ${file}`);
          const filePath = path.join(migrationsDir, file);
          const sql = fs.readFileSync(filePath, 'utf8');
          try {
             await pool.query(sql);
             logger.info(`Applied: ${file}`);
          } catch (e: any) {
             logger.warn(`Error applying ${file}: ${e.message}`);
             // Continue if error is likely harmless (e.g. object exists), otherwise throw
             if (!e.message.includes('already exists')) {
               throw e;
             }
          }
        }
      } else {
         logger.warn(`Migrations directory not found at ${migrationsDir}`);
      }
    }

    logger.info('Migrations completed successfully');
    // await closeDatabase(); // Don't close if imported
  } catch (error) {
    // Print full error to stdout for debugging (temporary)
    console.error(error);
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migrate()
    .then(async () => {
      await closeDatabase();
      process.exit(0);
    })
    .catch(async () => {
      await closeDatabase();
      process.exit(1);
    });
}
