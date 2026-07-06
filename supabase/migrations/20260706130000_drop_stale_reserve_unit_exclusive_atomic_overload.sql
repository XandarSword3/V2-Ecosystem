-- The prior migration (20260706120000_reserve_unit_exclusive_atomic_discount_tax.sql)
-- used CREATE OR REPLACE FUNCTION with two new trailing params (p_discount_amount,
-- p_tax_amount). Because the parameter list differs from the original function,
-- Postgres registered it as a SECOND overload instead of replacing the original —
-- CREATE OR REPLACE only replaces a function whose signature matches exactly.
--
-- Net effect: two overloads of reserve_unit_exclusive_atomic existed simultaneously.
-- Any call site passing 7 or fewer args (i.e. every existing caller, since the new
-- params are optional/trailing) became ambiguous and raised
-- "function reserve_unit_exclusive_atomic(...) is not unique".
--
-- Fix: drop the original 7-arg signature. The 9-arg version (with discount_amount/
-- tax_amount defaulting to 0) is fully backward compatible for all existing callers.
DROP FUNCTION IF EXISTS reserve_unit_exclusive_atomic(
  TEXT, UUID, DATE, DATE, UUID, DECIMAL, JSONB
);
