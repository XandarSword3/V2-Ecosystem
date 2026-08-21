-- Engine A — Money hardening (DOMAIN.md F2/F3).
--
--   F3: cross-currency conversion is reproducible. `exchange_rates` rows are
--       now IMMUTABLE at the database level: UPDATE and DELETE are rejected.
--       A rate correction is a NEW row with a newer as_of; history is
--       preserved so every conversion can be replayed and reconciled.
--
--   F2: the currency hierarchy (transaction → settlement → accounting) is
--       enforced in the service layer (engines/currency-hierarchy.ts) with
--       fail-closed resolution — the DB keeps the [A-Z]{3} format CHECK and
--       the service layer validates semantic ISO 4217 membership.

-- 1. Append-only enforcement on exchange_rates.
CREATE OR REPLACE FUNCTION "public"."prevent_exchange_rate_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'exchange_rates is append-only: rates are immutable facts (record a new row with a newer as_of instead)';
END;
$$;

DROP TRIGGER IF EXISTS "exchange_rates_no_update" ON "public"."exchange_rates";
CREATE TRIGGER "exchange_rates_no_update"
    BEFORE UPDATE ON "public"."exchange_rates"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."prevent_exchange_rate_mutation"();

DROP TRIGGER IF EXISTS "exchange_rates_no_delete" ON "public"."exchange_rates";
CREATE TRIGGER "exchange_rates_no_delete"
    BEFORE DELETE ON "public"."exchange_rates"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."prevent_exchange_rate_mutation"();

ALTER FUNCTION "public"."prevent_exchange_rate_mutation"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."prevent_exchange_rate_mutation"() TO "service_role";

-- 2. Document the currency hierarchy keys (configuration surface).
COMMENT ON COLUMN "public"."properties"."currency" IS
    'Settlement/transaction currency for the property. The currency hierarchy is: transaction (module/property) -> settlement (property) -> accounting (site_settings.accounting_currency, default settlement).';
COMMENT ON TABLE "public"."exchange_rates" IS
    'Append-only immutable exchange-rate facts (rate = units of to_currency per 1 unit of from_currency). UPDATE/DELETE are blocked by triggers.';
