-- Migration: transactions.customer_id -> users(id) FK (2026-11-19)
--
-- Batch 3, Task 7.
--
-- `transactions` has two columns that both point at `users`:
--   user_id      -> users(id)  (legacy "who owns this row")
--   staff_id     -> users(id)  (who served it)
--   customer_id  -> users(id)  (who bought/booked it)  <-- no FK existed
--
-- Because `customer_id` had no FK constraint, PostgREST could not resolve a
-- `transactions -> users` embed for it. A query that asked for
--   select=id,users(full_name)
-- was ambiguous and answered HTTP 300 ("more than one relationship was found
-- for 'transactions' and 'users'"), and
--   select=id,users!customer_id(full_name)
-- answered HTTP 400 because `customer_id` was not a known relationship.
--
-- `src/modules/staff/module-staff.controller.ts` (getCheckedInRooms) relies on
-- exactly this embed to show the guest name for a checked-in room, so the
-- endpoint returned 500 for every caller.
--
-- Adding the constraint makes the guest relationship first-class and
-- hintable as `users!transactions_customer_id_fkey`.
--
-- NOT VALID: the constraint is enforced for every new insert/update but does
-- not scan existing rows at apply time. The local mirror has 0 orphan
-- customer_id values (verified), but a production table can contain legacy
-- orphans and `ALTER TABLE ... VALIDATE CONSTRAINT` must stay a deliberate
-- operator action.
--
-- Rollback: supabase/migrations/rollback/20261119130000_transactions_customer_fk.down.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transactions_customer_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.users (id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

COMMIT;

-- PostgREST caches the FK graph; without this the new relationship is only
-- visible after the container restarts.
NOTIFY pgrst, 'reload schema';
