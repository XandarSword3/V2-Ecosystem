# Fixes and Instructions

## 1. Database Migrations
The "500 Internal Server Error" on the modules page and the missing QR codes are due to missing database tables and columns. Please run the following commands in your terminal to update your database:

```bash
# Navigate to the backend directory
cd backend

# Run the modules migration (Fixes 500 error)
npx ts-node src/database/run_modules_sql.ts

# Run the QR code migration (Fixes missing QR codes)
npx ts-node src/database/run_qr_migration.ts
```

If these commands fail with connection errors, please ensure your `backend/.env` file has the correct `DATABASE_URL`. You can also copy the SQL from `backend/src/database/create_modules_table.sql` and `backend/src/database/add_qr_code_to_tickets.sql` and run them manually in your Supabase SQL Editor.

## 2. Admin Access (401 Unauthorized)
The "401" errors indicate your login session has expired or is invalid.
1. **Log out** of the application.
2. **Log in** again with your admin credentials.
3. This should refresh your authentication token.

## 3. Appearance Settings
The appearance settings (themes, colors) are currently defined in the code (`frontend/src/lib/theme-config.ts`) to ensure design consistency and performance. They are not fully CMS-editable yet. However, you can switch between the predefined themes in the Admin > Settings > Appearance page.

## 4. Render Stability (Keep-Alive)
Free instances on Render spin down after 15 minutes of inactivity, causing lag on the next request.
I have created a keep-alive script to prevent this.

To run it locally:
```bash
cd backend
npx ts-node src/scripts/keep-alive.ts
```

For a permanent solution, you can:
1. Upgrade to a paid Render instance (starts at $7/month).
2. Or, set up a cron job (e.g., using GitHub Actions or a free cron service) to ping `https://v2-resort-backend.onrender.com/health` every 10 minutes.

## 5. Frontend Updates
I have fixed the missing "Access Denied" error message. You may need to rebuild the frontend for changes to take effect:

```bash
cd frontend
npm run build
```
