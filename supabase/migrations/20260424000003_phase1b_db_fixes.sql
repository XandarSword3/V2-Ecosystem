-- =============================================================================
-- Migration: Phase 1B database fixes — indexes, FK constraint, menu isolation,
--            and universal soft-delete completion
-- Date: 2026-04-24
--
-- Addresses:
--   [1] Missing FK on inventory_bom.menu_item_id
--   [2] Missing performance indexes on orders/bookings/tickets
--   [3] menu_items missing module_id (restaurant-type module isolation)
--   [4] Universal soft-delete: apply deleted_at to all remaining operational tables
-- =============================================================================

BEGIN;

-- ============================================================================
-- [1] Foreign key constraint on inventory_bom.menu_item_id
--     The report says inventory_bom (a.k.a. inventory_recipes) has no FK.
--     inventory_recipes.menu_item_id already has one (from 20260126160000).
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
      WHERE table_schema = 'public' AND table_name = 'inventory_bom' AND column_name = 'menu_item_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'inventory_bom'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'menu_item_id'
    ) THEN
      EXECUTE 'ALTER TABLE inventory_bom
               ADD CONSTRAINT fk_inventory_bom_menu_item
               FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
               ON DELETE RESTRICT';
      RAISE NOTICE 'Added FK constraint on inventory_bom.menu_item_id';
    END IF;
  ELSE
    RAISE NOTICE 'inventory_bom table does not exist — skipping FK (inventory_recipes already has this FK)';
  END IF;
END $$;

-- ============================================================================
-- [2] Performance indexes on core transaction foreign keys
--     Sequential scans on customer_id, status, created_at across the three
--     main transactional tables cause full-table scans on every lookup.
-- ============================================================================

-- restaurant_orders
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_customer_id
  ON restaurant_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status
  ON restaurant_orders(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_created_at
  ON restaurant_orders(created_at DESC);
-- Composite for the most common staff query: active orders by time
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status_created
  ON restaurant_orders(status, created_at DESC)
  WHERE deleted_at IS NULL;

-- chalet_bookings
CREATE INDEX IF NOT EXISTS idx_chalet_bookings_customer_id
  ON chalet_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_chalet_bookings_status
  ON chalet_bookings(status);
CREATE INDEX IF NOT EXISTS idx_chalet_bookings_created_at
  ON chalet_bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chalet_bookings_check_in
  ON chalet_bookings(check_in_date);

-- pool_tickets
CREATE INDEX IF NOT EXISTS idx_pool_tickets_customer_id
  ON pool_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_status
  ON pool_tickets(status);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_created_at
  ON pool_tickets(created_at DESC);

-- snack_bar_orders (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'snack_bar_orders') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_snack_bar_orders_customer_id ON snack_bar_orders(customer_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_snack_bar_orders_status ON snack_bar_orders(status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_snack_bar_orders_created_at ON snack_bar_orders(created_at DESC)';
  END IF;
END $$;

-- pool_sessions (start_time is the primary ordering/filter field in the current schema)
CREATE INDEX IF NOT EXISTS idx_pool_sessions_start_time
  ON pool_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_pool_sessions_module_id
  ON pool_sessions(module_id) WHERE module_id IS NOT NULL;

-- ============================================================================
-- [3] Add module_id to menu_items for restaurant-type module isolation
--     Without this, two restaurant-type modules share the same menu item rows
--     with no DB-level separation.
-- ============================================================================
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_module_id
  ON menu_items(module_id);

COMMENT ON COLUMN menu_items.module_id IS
  'Links this menu item to a specific module instance. '
  'NULL means legacy/unassigned (belongs to the primary restaurant module). '
  'Required for multi-module isolation when two restaurant-type modules are active.';

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
    'menu_items',
    'menu_categories',
    'pool_sessions',
    'pool_memberships',
    'snack_bar_orders',
    'snack_bar_items',
    'restaurant_tables',
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
