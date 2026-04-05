# Supabase Migrations

101 SQL migration files defining the database schema.

## Migration Chain

Migrations run in filename order. The chain covers:

### Initial Schema (00000000*)
- `00000000000000_init_users.sql` — Users table
- `00000000000001_base_schema_shim.sql` — Base schema compatibility

### Feature Tables (20240201–20240205)
- Security audit tables
- Booking credits
- Pool memberships
- Restaurant tables and kitchen order items
- Seasonal pricing

### Core Fixes (20260117)
- User permissions and served_at fixes
- Tier 1 features
- Loyalty compatibility
- Menu item ingredients
- Schema and inventory
- Gift card functions
- Loyalty earn/redeem RPCs
- Coupon system

### Schema Expansions (20260118–20260119)
- Status enums, coupon fixes
- Housekeeping schema + photos
- Manager approvals, staff shifts
- Loyalty multiplier precision
- Device tokens, token versioning
- Biometric credentials and indices
- Soft delete support

### Phase 2 (20260123–20260124)
- Phase 2 schema updates
- Security hardening
- Chargebacks, webhook failures, currencies, email bounces

### Consolidation (20260126)
- Full schema fix
- Role management
- POS, inventory, housekeeping completion
- Notifications, reviews, inventory recipes
- Enhanced housekeeping

### White-Label & i18n (20260130)
- Terminology system
- Dynamic translations
- Chalets schema fixes
- Terminology seed data

### Post-Launch Fixes (20260131–20260212)
- Waitlist, promotions, accommodations
- Booking views, dashboard views
- Menu modifier options
- Restaurant preferences
- Module customization system
- POS hardware support
- Mobile checkin, kiosk, messaging, i18n
- Channel management, rate parity
- Multi-property support
- GDPR compliance
- Finance, revenue, groups, marketing, reporting
- Booking modifications

### Recent (20260213–20260304)
- Loyalty data model unification
- Gym module support
- Activity modules and dynamic scheduling

## Notes

- All migrations target Supabase (PostgreSQL)
- Migrations are applied via `npm run migrate` in the backend
- The chain includes RPCs for atomic operations (loyalty earn/redeem)
