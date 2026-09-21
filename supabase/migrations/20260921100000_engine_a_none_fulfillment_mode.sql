-- Engine A: the 'none' fulfillment mode (defect D6).
--
-- Orders created with the fulfillment selection mode 'none' (pure
-- point-of-sale / instantly-consumed transactions) could never be COMPLETED.
-- The capability mirror seeded a ('instant_transaction','none') row with
-- required = false, so the confirm trigger skipped creating a fulfillment
-- row for them — while the completion gate (fulfillment required on the
-- engine) forbids the transaction machine from completing an order without
-- a fulfillment row. Result: none-mode orders parked on 'confirmed' with
-- only 'cancel' available.
--
-- The fix follows the architecture used for every other mode: the
-- persistence layer creates the row in the MODE'S OWN initial state and the
-- fulfillment layer is the only path to completion. The 'none' mode binds
-- the degenerate adapter machine (adapters/none/fulfillment.ts): the row
-- starts AT the terminal pre-completion state ('none' — no fulfillment work
-- exists) and staff/admin complete (or cancel) directly.
--
-- Like its predecessor it RESEEDS THE FULL per-(engine_type, mode) registry
-- mirror (ON CONFLICT DO UPDATE) — the latest capability migration is the
-- law the seed-parity contract test reads.
--
-- Row semantics mirror the adapters' own machine declarations:
--   on_premise / pickup / local_delivery → hospitality machine, 'queued',
--       handoff modeled (the hospitality adapter's handed_off step);
--   digital_delivery → digital machine, 'provisioning', no handoff step;
--   shipment → shipment machine, 'allocated', handoff modeled;
--   service_execution → service machine, 'received', handoff modeled;
--   none → none machine, 'queued' (degenerate: nothing to do), no handoff.

-- ============================================================
-- 1. fulfillments.status allowlist — remove
-- ============================================================
-- The original table CHECK hardcodes only the hospitality statuses
-- ('queued','in_progress','ready','handed_off','completed','cancelled');
-- adapter-owned initial states (provisioning, allocated, received) are
-- declared per-(engine, mode) in engine_fulfillment_capabilities, not here,
-- and deployed databases already accept them. Drop the stale allowlist
-- defensively so fresh replays match deployed behavior (the predecessor
-- capability migration 20260916200000 introduced those initial states
-- without dropping this CHECK — a latent fresh-replay gap).
ALTER TABLE "public"."fulfillments" DROP CONSTRAINT IF EXISTS "chk_fulfillments_status";

-- ============================================================
-- 2. Capability registry mirror — full reseed incl. 'none'
-- ============================================================
INSERT INTO "public"."engine_fulfillment_capabilities" ("engine_type", "mode", "required", "handoff", "initial_status") VALUES
    ('instant_transaction', 'on_premise',       true,  true,  'queued'),
    ('instant_transaction', 'pickup',           true,  true,  'queued'),
    ('instant_transaction', 'local_delivery',   true,  true,  'queued'),
    ('instant_transaction', 'digital_delivery', true,  false, 'provisioning'),
    ('instant_transaction', 'shipment',         true,  true,  'allocated'),
    ('instant_transaction', 'service_execution',true,  true,  'received'),
    ('instant_transaction', 'none',             true,  false, 'queued')
ON CONFLICT ("engine_type", "mode") DO UPDATE SET
    "required" = EXCLUDED."required",
    "handoff" = EXCLUDED."handoff",
    "initial_status" = EXCLUDED."initial_status",
    "updated_at" = now();

-- ============================================================
-- 3. Backfill: confirmed none-mode orders with no fulfillment row
-- ============================================================
-- These are exactly the orders D6 stranded: confirmed, mode 'none', no row
-- (the confirm trigger skipped creation under the old required=false row).
INSERT INTO "public"."fulfillments"
    (transaction_id, engine_type, module_id, property_id, tenant_id, status, mode, destination_type, destination_ref, queued_at)
SELECT t.id, t.engine_type, t.module_id, t.property_id, t.tenant_id, 'queued', 'none', 'none', NULL, now()
FROM "public"."transactions" t
WHERE t.engine_type = 'instant_transaction'
  AND t.status = 'confirmed'
  AND t.metadata->>'fulfillment_mode' = 'none'
  AND NOT EXISTS (SELECT 1 FROM "public"."fulfillments" f WHERE f.transaction_id = t.id);

-- The backfilled rows (and any legacy 'none' rows) lack their creation
-- event — append it once so the event timeline stays complete.
INSERT INTO "public"."fulfillment_events" (fulfillment_id, from_status, to_status, action, actor, metadata)
SELECT f.id, 'queued', 'queued', 'queue_fulfillment', 'system',
       jsonb_build_object('reason', 'backfill: none-mode order had no fulfillment row (D6)', 'mode', 'none')
FROM "public"."fulfillments" f
WHERE f.mode = 'none' AND f.status = 'queued'
  AND NOT EXISTS (SELECT 1 FROM "public"."fulfillment_events" e WHERE e.fulfillment_id = f.id);
