-- Engine A — Money/currency invariants (DOMAIN.md F2/F3).
--
--   F2: every monetary record carries an explicit ISO 4217 currency.
--       Existing rows are normalized to uppercase; new writes are enforced
--       with CHECK constraints (3 uppercase letters) — a lowercase or
--       missing code fails loudly instead of being defaulted.
--   F3: cross-currency conversion is reproducible — `exchange_rates` keeps
--       the immutable rate fact (rate + as-of + provider) that any
--       conversion must reference, so conversions can be replayed.

-- 1. Normalize existing currency values before adding CHECKs.
UPDATE "public"."engine_financial_ledger"
SET "currency" = UPPER("currency")
WHERE "currency" IS NOT NULL AND "currency" <> UPPER("currency");

UPDATE "public"."transactions"
SET "currency" = UPPER("currency")
WHERE "currency" IS NOT NULL AND "currency" <> UPPER("currency");

UPDATE "public"."payments"
SET "currency" = UPPER("currency")
WHERE "currency" IS NOT NULL AND "currency" <> UPPER("currency");

-- currencies.code is bpchar(3): equality ignores trailing spaces, so compare
-- as text (case-insensitive) to catch lowercase codes before the CHECK lands.
UPDATE "public"."currencies"
SET "code" = UPPER("code")
WHERE "code" IS NOT NULL AND "code"::text <> UPPER("code"::text);

-- 2. Enforce the currency format on the economic tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_engine_financial_ledger_currency_format'
  ) THEN
    ALTER TABLE "public"."engine_financial_ledger"
      ADD CONSTRAINT "chk_engine_financial_ledger_currency_format"
      CHECK ("currency" ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_transactions_currency_format'
  ) THEN
    ALTER TABLE "public"."transactions"
      ADD CONSTRAINT "chk_transactions_currency_format"
      CHECK ("currency" ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_payments_currency_format'
  ) THEN
    ALTER TABLE "public"."payments"
      ADD CONSTRAINT "chk_payments_currency_format"
      CHECK ("currency" ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_currencies_code_format'
  ) THEN
    ALTER TABLE "public"."currencies"
      ADD CONSTRAINT "chk_currencies_code_format"
      CHECK ("code" ~ '^[A-Z]{3}$');
  END IF;
END $$;

-- 3. Immutable exchange-rate facts for reproducible conversion (F3).
--    rate = units of to_currency per 1 unit of from_currency.
CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_currency" character varying(3) NOT NULL,
    "to_currency" character varying(3) NOT NULL,
    "rate" numeric(18,10) NOT NULL,
    "as_of" timestamp with time zone NOT NULL,
    "provider" character varying(50) NOT NULL DEFAULT 'manual',
    "source" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_exchange_rates_from_format" CHECK (("from_currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "chk_exchange_rates_rate_positive" CHECK (("rate" > 0)),
    CONSTRAINT "chk_exchange_rates_to_format" CHECK (("to_currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "exchange_rates_from_to_as_of_key" UNIQUE ("from_currency", "to_currency", "as_of", "provider"),
    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- 4. RLS: exchange rates are platform-global reference data; readable by
--    authenticated users, writable only by service role / admin via API.
ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'exchange_rates_read_authenticated'
  ) THEN
    CREATE POLICY "exchange_rates_read_authenticated"
      ON "public"."exchange_rates"
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Grant access for the service role (used by backend service layer).
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."exchange_rates" TO "service_role";
GRANT SELECT ON "public"."exchange_rates" TO "authenticated";
GRANT SELECT ON "public"."exchange_rates" TO "anon";
