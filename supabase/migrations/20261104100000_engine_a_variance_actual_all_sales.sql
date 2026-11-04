-- ═══════════════════════════════════════════════════════════════════════════
-- Engine A — variance CTE under-counts customization sale rows
--
-- Follow-up to 20261103120000: that migration widened get_ingredient_variance
-- `actual` to reference_type IN ('order','order_customization','transaction'),
-- but live ledger rows written by the customization-deduction path carry
-- reference_type 'instant_transaction_customization' (13 rows on the shared
-- DB) — still invisible to the aggregate.
--
-- Fix: drop the reference_type filter entirely. The ledger's transaction_type
-- already discriminates semantics: 'sale' rows ARE consumption (restorations
-- are 'restoration', purchases are 'purchase'), so any reference_type naming
-- convention is equally valid. This also future-proofs against the next
-- writer inventing another reference_type string.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_ingredient_variance(
  p_property_id UUID,
  p_tenant_id UUID,          -- NULL = unscoped platform operator
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  inventory_item_id UUID,
  item_name VARCHAR,
  unit VARCHAR,
  units_sold NUMERIC,
  theoretical_consumption NUMERIC,
  actual_consumption NUMERIC,
  variance NUMERIC,
  variance_pct NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH sold AS (
    SELECT oi.catalog_item_id, SUM(oi.quantity) AS units
    FROM order_items oi
    JOIN transactions t ON t.id = oi.transaction_id
    WHERE oi.property_id = p_property_id
      AND (p_tenant_id IS NULL OR oi.tenant_id = p_tenant_id)
      AND t.status NOT IN ('cancelled', 'void', 'refunded')
      AND oi.created_at >= p_since
      AND oi.created_at < p_until
    GROUP BY oi.catalog_item_id
  ),
  theoretical AS (
    SELECT m.inventory_item_id, SUM(s.units * m.quantity_required) AS qty
    FROM sold s
    JOIN menu_item_ingredients m ON m.catalog_item_id = s.catalog_item_id
    WHERE m.property_id = p_property_id
    GROUP BY m.inventory_item_id
  ),
  actual AS (
    -- Every 'sale' ledger row is consumption regardless of the writer's
    -- reference_type convention (order / transaction /
    -- instant_transaction_customization / ledger_backfill / ...).
    SELECT t.item_id, ABS(SUM(t.quantity)) AS qty
    FROM inventory_transactions t
    WHERE t.property_id = p_property_id
      AND (p_tenant_id IS NULL OR t.tenant_id = p_tenant_id)
      AND t.transaction_type = 'sale'
      AND t.created_at >= p_since
      AND t.created_at < p_until
    GROUP BY t.item_id
  ),
  sold_units_by_item AS (
    SELECT m.inventory_item_id, SUM(s.units) AS units
    FROM sold s
    JOIN menu_item_ingredients m ON m.catalog_item_id = s.catalog_item_id
    WHERE m.property_id = p_property_id
    GROUP BY m.inventory_item_id
  )
  SELECT
    i.id,
    i.name,
    i.unit,
    COALESCE(su.units, 0),
    COALESCE(th.qty, 0),
    COALESCE(ac.qty, 0),
    COALESCE(ac.qty, 0) - COALESCE(th.qty, 0),
    CASE WHEN COALESCE(th.qty, 0) > 0
         THEN ROUND(((COALESCE(ac.qty,0) - COALESCE(th.qty,0)) / COALESCE(th.qty,0) * 100)::numeric, 1)
         ELSE NULL END
  FROM inventory_items i
  LEFT JOIN theoretical th ON th.inventory_item_id = i.id
  LEFT JOIN actual ac ON ac.item_id = i.id
  LEFT JOIN sold_units_by_item su ON su.inventory_item_id = i.id
  WHERE i.property_id = p_property_id
    AND i.deleted_at IS NULL
    AND (th.qty IS NOT NULL OR ac.qty IS NOT NULL);
$$;

COMMENT ON FUNCTION get_ingredient_variance IS 'Actual-vs-theoretical ingredient variance per inventory item. actual = ALL sale ledger rows (reference_type-agnostic; transaction_type discriminates semantics). 20261104100000 dropped the reference_type filter after instant_transaction_customization rows were found under-counted.';
