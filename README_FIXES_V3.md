# Critical Fixes - 2026-01-08

We have addressed critical errors causing 500 responses on Render.

### 1. Fixed "Ambiguous Relationship" in Admin Users API
**Issue:** `GET /api/admin/users` was failing because the `users` table has multiple relationships to `user_roles` (one for ownership, one for `granted_by`), causing Supabase to throw an error when trying to embed `user_roles`.
**Fix:** Updated `users.controller.ts` to explicitly specify the `user_id` relationship using `user_roles!user_id`.

### 2. Fixed "Column does not exist" in Chalet Settings
**Issue:** `GET /api/chalets/admin/settings` was failing because the code queried a `category` column in `site_settings` table, but the database schema uses an older structure without that column.
**Fix:** 
1. Added fallback logic in `chalet.controller.ts` to support the old schema structure temporarily, preventing the app from crashing.
2. Created a migration file `backend/src/database/update_settings_schema.sql` to align the database schema with the new code.

### 3. Database Migration Required
To fully resolve the schema mismatch and enable per-setting updates, you should run the following SQL in your Supabase SQL Editor:

```sql
-- Add category column if it doesn't exist
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';

-- Drop the specific unique constraint on key if it exists
ALTER TABLE site_settings DROP CONSTRAINT IF EXISTS site_settings_key_key;

-- Add new constraint
DO $$ BEGIN
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_category_key_key UNIQUE (category, key);
EXCEPTION WHEN duplicate_object THEN 
    NULL;
END $$;
```

Alternatively, if you have database connectivity from your local machine, you can run:
`npx tsx src/database/run_settings_migration.ts`
(inside `backend/` directory)

### Status
The backend should now deploy to Render without crashing on these endpoints. The "Tenant or user not found" warnings in logs may persist until Supabase connectivity/pausing is resolved, but the fallback to Supabase HTTP API (which we fixed) will handle the requests.
