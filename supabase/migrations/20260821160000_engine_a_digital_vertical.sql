-- Engine A — Phase 4 completion: register the digital_delivery engine.
--
-- Proves the generic fulfillment contract hosts a SECOND vertical at the
-- DATABASE boundary too: required-fulfillment intent still comes from the
-- engine_fulfillment_capabilities table (no engine literals in trigger
-- bodies), and the engine_type CHECK constraints on the tables that store
-- engine state are extended — not replaced with vertical-specific logic.
--
--   1. engine_state_transitions + modules allow the new engine type;
--   2. the capability registry gains the digital_delivery row (required
--      fulfillment, no physical handoff — delivery to the digital account
--      IS the handoff).

-- ============================================================
-- 1. engine_type CHECK constraints — add digital_delivery
-- ============================================================

ALTER TABLE "public"."engine_state_transitions" DROP CONSTRAINT IF EXISTS "chk_est_engine_type";
ALTER TABLE "public"."engine_state_transitions" ADD CONSTRAINT "chk_est_engine_type" CHECK (("engine_type" = ANY (ARRAY['instant_transaction'::"text", 'time_exclusive_reservation'::"text", 'shared_capacity_access'::"text", 'ongoing_entitlement'::"text", 'platform_entitlement'::"text", 'digital_delivery'::"text"])));

ALTER TABLE "public"."modules" DROP CONSTRAINT IF EXISTS "chk_modules_engine_type";
ALTER TABLE "public"."modules" ADD CONSTRAINT "chk_modules_engine_type" CHECK (((("engine_type")::"text") = ANY ((ARRAY['instant_transaction'::character varying, 'time_exclusive_reservation'::character varying, 'shared_capacity_access'::character varying, 'ongoing_entitlement'::character varying, 'platform_entitlement'::character varying, 'digital_delivery'::character varying])::"text"[])));

-- ============================================================
-- 2. Capability registry seed — digital_delivery
-- ============================================================

INSERT INTO "public"."engine_fulfillment_capabilities" ("engine_type", "required", "handoff")
VALUES ('digital_delivery', true, false)
ON CONFLICT ("engine_type") DO NOTHING;
