-- =============================================================================
-- Migration: Phase 1B database fixes — indexes, FK constraint, menu isolation,
--            and universal soft-delete completion
-- Date: 2026-04-24
--
-- Addresses:
--   [1] Missing FK on inventory_bom.catalog_item_id
--   [2] Missing performance indexes on orders/bookings/tickets
--   [3] catalog_items missing module_id (restaurant-type module isolation)
--   [4] Universal soft-delete: apply deleted_at to all remaining operational tables
-- =============================================================================

BEGIN;

-- ============================================================================
-- [1] Foreign key constraint on inventory_bom.catalog_item_id
--     The report says inventory_bom (a.k.a. inventory_recipes) has no FK.
--     inventory_recipes.catalog_item_id already has one (from 20260126160000).
--     Check for any separate inventory_bom table and add the FK if it exists.
-- ============================================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_bom'
  ) THEN
    -- Add FK only if the column exists and constraint is missing
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_bom' AND column_name = 'catalog_item_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'inventory_bom'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'catalog_item_id'
    ) THEN
      EXECUTE 'ALTER TABLE inventory_bom
               ADD CONSTRAINT fk_inventory_bom_menu_item
               FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id)
               ON DELETE RESTRICT';
      RAISE NOTICE 'Added FK constraint on inventory_bom.catalog_item_id';
    END IF;
  ELSE
    RAISE NOTICE 'inventory_bom table does not exist — skipping FK (inventory_recipes already has this FK)';
  END IF;
END $$;

-- [2] Performance indexes on transactions (unified engine table)
-- legacy order/booking/ticket indexes replaced with transactions indexes.
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id
  ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_engine_status_created
  ON transactions(engine_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_instant_active
  ON transactions(status, created_at DESC)
  WHERE engine_type = 'instant_transaction';
CREATE INDEX IF NOT EXISTS idx_transactions_time_exclusive_checkin
  ON transactions((metadata->>'check_in_date'))
  WHERE engine_type = 'time_exclusive_reservation';
CREATE INDEX IF NOT EXISTS idx_transactions_shared_capacity_date
  ON transactions((metadata->>'date'))
  WHERE engine_type = 'shared_capacity_access';

-- kiosk orders not in canonical schema — no-op block.
DO $$ BEGIN NULL; END $$;

-- capacity_windows indexes handled in dedicated capacity_windows migration.

-- ============================================================================
-- [3] Add module_id to catalog_items for menu-service module isolation
--     Without this, two menu-service modules share the same menu item rows
--     with no DB-level separation.
-- ============================================================================
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_items_module_id
  ON catalog_items(module_id);

COMMENT ON COLUMN catalog_items.module_id IS
  'Links this menu item to a specific module instance. '
  'NULL means legacy/unassigned (belongs to the primary menu-service module). '
  'Required for multi-module isolation when two menu-service modules are active.';

-- ============================================================================
-- [4] Universal soft-delete: apply deleted_at + deleted_by to all remaining
--     operational tables that do not already have it.
--     Audit log tables (audit_logs) are intentionally excluded — those are
--     never soft-deleted, only written.
-- ============================================================================

-- Helper macro repeated for each table:
-- ALTER TABLE <t> ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
-- ALTER TABLE <t> ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL;
-- CREATE INDEX IF NOT EXISTS idx_<t>_deleted_at ON <t>(deleted_at) WHERE deleted_at IS NULL;

DO $$ 
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'catalog_items',
    'catalog_categories',
    'capacity_windows',
    'loyalty_accounts',
    'loyalty_transactions',
    'gift_cards',
    'coupons',
    'staff_shifts',
    'manager_approvals',
    'support_tickets',
    'reviews',
    'housekeeping_tasks',
    'inventory_items',
    'inventory_recipes',
    'inventory_batches',
    'modules',
    'properties',
    'roles',
    'sessions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND table_type = 'BASE TABLE'
    ) THEN
      -- Add deleted_at
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'deleted_at'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL', tbl);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_deleted_at ON %I(deleted_at) WHERE deleted_at IS NULL',
          tbl, tbl
        );
        EXECUTE format(
          'COMMENT ON COLUMN %I.deleted_at IS ''Soft-delete timestamp. NULL = active record.''',
          tbl
        );
      END IF;

      -- Add deleted_by
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'deleted_by'
      ) THEN
        EXECUTE format(
          'ALTER TABLE %I ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;
