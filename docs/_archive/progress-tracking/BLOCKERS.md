# V2 Resort Production Hardening - Blockers

## Active Blockers Summary
| ID | Phase | Task | Status | Severity |
|----|-------|------|--------|----------|
| BLK-001 | Pre-existing | Missing npm modules | INFO | Low |
| BLK-002 | Pre-existing | Stripe SDK types | INFO | Low |

---

## Blocker Details

### BLK-001: Missing Module Declarations (Pre-existing)

**Gap Addressed:** N/A - Not part of hardening scope
**Task:** TypeScript type fixes
**Issue:** Several services reference modules that don't exist or aren't installed:
- `../lib/supabase` - Supabase client not in expected location
- `../utils/activityLogger` - ActivityLogger export missing
- `twilio` - Type declarations not installed
- `redis` / `@socket.io/redis-adapter` - Type declarations not installed
- `../config/database.js` / `../config/socket.js` - Prisma/Socket config files

**Required Action:** Run `npm install` to install type declarations, or update import paths to match actual file locations
**Status:** INFO - Pre-existing architecture issue, not blocking production

---

### BLK-002: Stripe SDK Type Compatibility (Pre-existing)

**Gap Addressed:** N/A - Not part of hardening scope
**Task:** TypeScript type fixes
**Issue:** Stripe SDK `Status` type doesn't include `charge_refunded`, and `EmailOptions` interface missing `template` property
**Required Action:** Update to latest Stripe SDK or extend types locally
**Status:** INFO - Pre-existing, runtime functionality works, only type checking affected

---

## Resolved Blockers

*All hardening blockers were addressed without escalation.*
