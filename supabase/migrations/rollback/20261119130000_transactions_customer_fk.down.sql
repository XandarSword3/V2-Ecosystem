-- Rollback: transactions.customer_id FK (2026-11-19)
--
-- Batch 3, Task 7. Restores the schema where `customer_id` had no FK.
-- The embed fix then has no resolvable relationship and getCheckedInRooms
-- returns 500 again, which is the red-run state.

BEGIN;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_customer_id_fkey;

COMMIT;

NOTIFY pgrst, 'reload schema';
