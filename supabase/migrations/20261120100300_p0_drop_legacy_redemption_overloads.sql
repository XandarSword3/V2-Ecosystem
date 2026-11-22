-- Drops the legacy, non-tenant-scoped redemption overloads (audit P0-1).
--
-- Run this AFTER the tenant-scoped backend (callers pass p_tenant_id) is
-- deployed. Until then the old overloads must stay, because the previously
-- deployed backend still calls them. They are also the cross-tenant hole, so
-- do not leave this migration pending longer than the rollout needs.

DROP FUNCTION IF EXISTS public.redeem_giftcard_atomic(text, numeric, uuid);
DROP FUNCTION IF EXISTS public.redeem_loyalty_points_atomic(uuid, integer, uuid, numeric);
DROP FUNCTION IF EXISTS public.apply_coupon_atomic(text, uuid, numeric, uuid, text);
