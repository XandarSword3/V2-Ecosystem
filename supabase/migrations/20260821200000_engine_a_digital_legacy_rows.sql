-- Engine A — explicit policy for legacy rows from the (brief) digital_delivery
-- ENGINE registration (migrations 20260821160000 / 20260821170000).
--
-- Digital delivery is now a FULFILLMENT MODE of instant_transaction, never an
-- engine. No order-creation path ever used the digital engine (no module could
-- be created with it — chk_modules_engine_type rejected it), so no
-- transactions exist with engine_type = 'digital_delivery'. Fulfillment rows,
-- however, could in principle exist if a trigger fired for such a transaction.
--
-- Policy: any fulfillment row still tagged engine_type = 'digital_delivery'
-- belonged to the digital MODE of Engine A — convert it to instant_transaction.
-- The mode column already carries the selection ('digital_delivery'), so the
-- row becomes a normal Engine A digital-mode fulfillment and the capability
-- lookup (engine_type, mode) resolves it exactly like a new one. Rows whose
-- engine_type is 'digital_delivery' with any other mode would be corrupt data —
-- the conversion is scoped to the only valid digital mode, and the new CHECK
-- below makes any future orphan engine_type impossible.

-- ============================================================
-- 1. Convert legacy digital_delivery-engine fulfillment rows → Engine A
-- ============================================================
UPDATE "public"."fulfillments"
SET "engine_type" = 'instant_transaction', "updated_at" = now()
WHERE "engine_type" = 'digital_delivery' AND "mode" = 'digital_delivery';

-- ============================================================
-- 2. Harden fulfillments.engine_type — orphan engine rows are impossible
-- ============================================================
-- The transactions and modules tables already reject non-canonical engine
-- types at their own CHECK constraints (chk_est_engine_type /
-- chk_modules_engine_type). fulfillments had no CHECK — add the same
-- canonical-five enforcement so the engine-vs-mode mistake cannot recur in
-- the persistence layer.
ALTER TABLE "public"."fulfillments" DROP CONSTRAINT IF EXISTS "chk_fulfillments_engine_type";
ALTER TABLE "public"."fulfillments" ADD CONSTRAINT "chk_fulfillments_engine_type" CHECK (("engine_type" = ANY (ARRAY['instant_transaction'::"text", 'time_exclusive_reservation'::"text", 'shared_capacity_access'::"text", 'ongoing_entitlement'::"text", 'platform_entitlement'::"text"])));
