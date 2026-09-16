-- Engine A fulfillment capability seed parity (F11 backend pre-existing-failure sweep).
--
-- The TypeScript engine registry (src/engines/definitions/instant-transaction.ts)
-- declares `shipment` and `service_execution` fulfillment modes with their own
-- per-mode machines, but the capability mirror seeded in
-- 20260821190000_engine_a_digital_fulfillment_mode.sql never gained those rows.
-- The confirm trigger + ensure_fulfillment look the initial status up by
-- (engine_type, mode) and fail closed for unknown pairs — so orders confirmed
-- with a shipment or service_execution selection could not initialize a
-- fulfillment row at all. This migration closes that deployment gap.
--
-- Like its predecessor it RESEEDS THE FULL per-(engine_type, mode) registry
-- mirror (ON CONFLICT DO UPDATE) — the latest capability migration is the law
-- the seed-parity contract test reads.
--
-- Row semantics mirror the adapters' own machine declarations:
--   on_premise / pickup / local_delivery → hospitality machine, 'queued',
--       handoff modeled (the hospitality adapter's handed_off step);
--   digital_delivery → digital machine, 'provisioning', no handoff step
--       (delivery to the digital account IS the handoff);
--   shipment → shipment machine, 'allocated', handoff modeled
--       (packed → shipped is the carrier handoff);
--   service_execution → service machine, 'received', handoff modeled
--       (collected is the customer/staff handoff).

INSERT INTO "public"."engine_fulfillment_capabilities" ("engine_type", "mode", "required", "handoff", "initial_status") VALUES
    ('instant_transaction', 'on_premise',       true,  true,  'queued'),
    ('instant_transaction', 'pickup',           true,  true,  'queued'),
    ('instant_transaction', 'local_delivery',   true,  true,  'queued'),
    ('instant_transaction', 'digital_delivery', true,  false, 'provisioning'),
    ('instant_transaction', 'shipment',         true,  true,  'allocated'),
    ('instant_transaction', 'service_execution', true, true,  'received')
ON CONFLICT ("engine_type", "mode") DO UPDATE SET
    "required" = EXCLUDED."required",
    "handoff" = EXCLUDED."handoff",
    "initial_status" = EXCLUDED."initial_status",
    "updated_at" = now();
