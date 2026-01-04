
# V2 Resort - Fixes for Duplicates and 500 Errors

## 1. Sidebar Duplicates Fixed
The admin sidebar was showing duplicate entries for "Restaurant", "Chalets", etc. because both the hardcoded navigation and the dynamic modules were being rendered.
- **Fix**: Updated `frontend/src/app/admin/layout.tsx` to filter out dynamic modules that match the core business units ('restaurant', 'chalets', 'pool', 'snack-bar').

## 2. 500 Errors on Module Pages
The dynamic module pages (e.g., `/admin/modules/restaurant/menu`) were failing with 500 errors because the backend was trying to filter by `module_id`, but the `module_id` column was missing from the `menu_items` and `menu_categories` tables.

- **Fix**: Created a SQL migration script `backend/src/database/FIX_500_ERRORS.sql`.
- **Action Required**: You must run this SQL in your Supabase SQL Editor to apply the changes.

## 3. SVG Path Error
The error `Error: <path> attribute d: Expected moveto path command ('M' or 'm'), "undefined"` usually indicates a broken icon.
- **Status**: This might be resolved by fixing the sidebar duplicates (if a duplicate module was causing it). If it persists, check if any custom modules have invalid configurations.

## Next Steps
1. **Run the SQL**: Open `backend/src/database/FIX_500_ERRORS.sql` and run it in Supabase.
2. **Rebuild/Restart**: Restart your backend and frontend to ensure all changes are picked up.
