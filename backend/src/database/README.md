# Database Layer

Database connection, migrations, and seed management for PostgreSQL via Supabase.

## Directory Structure

```
database/
├── connection.ts       # Database connection pool
├── migrations/         # Schema migrations
├── seed.ts            # Development seed script
├── seed-supabase.ts   # Supabase-specific seed
└── README.md          # This file
```

## Connection

Uses Supabase PostgreSQL with connection pooling:

```typescript
import { getPool, initializeDatabase, closeDatabase } from './connection';

// Initialize on app start
await initializeDatabase();

// Get pool for queries
const pool = getPool();

// Close on shutdown
await closeDatabase();
```

## Environment Variables

```env
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Optional - Direct connection
DATABASE_URL=postgresql://user:pass@host:5432/db
```

## Schema Overview

### Core Tables

```sql
-- Users & Authentication
users
roles
permissions
user_roles
role_permissions
sessions
password_reset_tokens
two_factor_secrets

-- Modules System
modules
module_settings

-- Restaurant
menu_categories
menu_items
orders
order_items

-- Pool
pool_sessions
pool_session_schedules
pool_bookings
pool_booking_guests

-- Chalets
chalets
chalet_amenities
chalet_bookings

-- Reviews
reviews
review_responses

-- Payments
payments
refunds

-- Audit & Logging
audit_logs
activity_logs
```

## Migrations

Migrations are SQL files executed in order:

```
migrations/
├── 001_initial_schema.sql
├── 002_add_modules.sql
├── 003_add_pool_sessions.sql
├── 004_add_audit_logs.sql
└── ...
```

### Running Migrations

```bash
# Apply all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Create new migration
npm run migrate:create add_feature_name
```

### Migration Template

```sql
-- migrations/XXX_description.sql

-- Up
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_new_table_name ON new_table(name);

-- Down
DROP TABLE IF EXISTS new_table;
```

## Seeding

### Development Seed

Creates test data for local development:

```bash
npm run seed
```

**Important**: Uses environment variables for passwords:

```env
SEED_ADMIN_PASSWORD=your-secure-password
SEED_STAFF_PASSWORD=your-staff-password
```

In development, defaults to `admin123` / `staff123` if not set.

### What Gets Seeded

1. **Roles** - super_admin, customer, staff roles
2. **Permissions** - All system permissions
3. **Admin User** - admin@v2resort.com
4. **Staff Users** - Test staff accounts
5. **Role Assignments** - Permission mappings

### Production Notes

- Seed scripts refuse to run if `NODE_ENV=production` without explicit passwords
- Only creates core system data (roles, permissions)
- Sample data (menus, chalets) should be added via admin UI

## Query Patterns

### Using Supabase Client

```typescript
import { supabase } from './connection';

// Select
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(10);

// Insert
const { data, error } = await supabase
  .from('orders')
  .insert({ user_id: userId, total: 100 })
  .select()
  .single();

// Update
const { error } = await supabase
  .from('orders')
  .update({ status: 'completed' })
  .eq('id', orderId);

// Delete (soft delete)
const { error } = await supabase
  .from('users')
  .update({ deleted_at: new Date() })
  .eq('id', userId);
```

### Using Raw SQL (Complex Queries)

```typescript
import { getPool } from './connection';

const pool = getPool();

const result = await pool.query(`
  SELECT 
    o.id,
    o.total_amount,
    u.full_name as customer_name,
    json_agg(oi.*) as items
  FROM orders o
  JOIN users u ON o.user_id = u.id
  JOIN order_items oi ON o.id = oi.order_id
  WHERE o.status = $1
  GROUP BY o.id, u.full_name
  ORDER BY o.created_at DESC
  LIMIT $2
`, ['pending', 10]);
```

## Best Practices

1. **Parameterized Queries** - Always use `$1, $2` placeholders
2. **Transactions** - Use for multi-step operations
3. **Indexes** - Add indexes for frequently queried columns
4. **Soft Deletes** - Use `deleted_at` instead of DELETE
5. **Timestamps** - Always include `created_at`, `updated_at`
6. **UUIDs** - Use UUIDs for primary keys

## Troubleshooting

### Connection Issues

```bash
# Test connection
npx ts-node -e "
  import { initializeDatabase } from './src/database/connection';
  initializeDatabase().then(() => console.log('Connected!'));
"
```

### Migration Errors

```bash
# Check migration status
npm run migrate:status

# Force rerun specific migration
npm run migrate:force 001_initial_schema
```

---

See Supabase dashboard for real-time database monitoring and query logs.
