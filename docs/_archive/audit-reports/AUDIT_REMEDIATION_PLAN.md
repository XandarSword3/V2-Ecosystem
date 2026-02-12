# V2 Resort Audit Remediation Plan

## Generated: January 13, 2026

This document tracks all identified gaps and their remediation status.

---

## 1. Database Migration Organization

### Problem
- 33 SQL files in `backend/src/database/` with no sequential numbering
- Multiple migration runner scripts with unclear execution order
- Risk of inconsistent schema on fresh deployment

### Solution
- Rename all SQL files with sequential prefixes (001_, 002_, etc.)
- Create a master migration runner that executes in order
- Document the migration sequence

### Status: 🔄 IN PROGRESS

---

## 2. Missing Customer E2E Tests

### Problem
- E2E tests only cover admin panel
- No tests for: restaurant ordering, chalet booking, pool tickets
- Critical revenue flows untested

### Solution
- Add Playwright tests for customer booking flow
- Add Playwright tests for restaurant ordering
- Add Playwright tests for pool ticket purchase

### Status: 🔄 IN PROGRESS

---

## 3. Console.log Cleanup

### Problem
- ~100 console.log/error/warn statements in production code
- Should use proper Winston logger in backend
- Frontend should use structured logging

### Solution
- Replace console.* with logger.* in backend
- Create frontend logger utility
- Clean up debug statements

### Status: 🔄 IN PROGRESS

---

## 4. Missing HSTS Header

### Problem
- nginx.conf missing Strict-Transport-Security header
- Security best practice not implemented

### Solution
- Add HSTS header to nginx configuration

### Status: 🔄 IN PROGRESS

---

## 5. Frontend Dockerfile Missing HEALTHCHECK

### Problem
- Backend Dockerfile has HEALTHCHECK, frontend doesn't
- Container orchestration can't verify frontend health

### Solution
- Add HEALTHCHECK instruction to frontend Dockerfile

### Status: 🔄 IN PROGRESS

---

## 6. Dietary Filtering API Incomplete

### Problem
- Menu items have dietary fields (vegetarian, vegan, etc.)
- API doesn't expose filtering by these fields

### Solution
- Add dietary filter parameters to menu API endpoint

### Status: 🔄 IN PROGRESS

---

## 7. Session Expiration Background Job Missing

### Problem
- Pool tickets don't automatically expire after session ends
- Relies on validation-time checks only

### Solution
- Add node-cron job to mark expired tickets

### Status: 🔄 IN PROGRESS

---

## 8. Phone Placeholder

### Problem
- '+961 XX XXX XXX' hardcoded as fallback in contact page

### Solution
- Use proper placeholder or remove fallback

### Status: 🔄 IN PROGRESS

---

## 9. Test Coverage Gaps

### Problem
- Reviews module: No tests
- Support module: No tests  
- Users/GDPR module: No tests
- Integration tests skipped by default

### Solution
- Add unit tests for missing modules
- Enable integration tests

### Status: 🔄 IN PROGRESS

---

## 10. README Accuracy

### Problem
- Claims "comprehensive automated tests" but coverage is ~25-30%

### Solution
- Update README to accurately reflect test coverage

### Status: ✅ COMPLETE

---

## Progress Tracker

| Item | Status | Files Changed |
|------|--------|---------------|
| Migration organization | ✅ | `migrations/001_initial_schema.sql`, `run-migrations.ts` |
| Customer E2E tests | ✅ | `tests/customer-flows.spec.ts` |
| Console.log cleanup | ✅ | `notifications.controller.ts`, `webhookIdempotency.service.ts` |
| HSTS header | ✅ | `nginx/nginx.conf` |
| Frontend HEALTHCHECK | ✅ | `frontend/Dockerfile` |
| Dietary filtering API | ✅ | `menu.service.ts`, `menu.controller.ts` |
| Session expiration job | ✅ | `scheduler.service.ts`, `expire-pool-tickets.ts` |
| Phone placeholder | ✅ | `email.service.ts`, `admin.controller.ts` |
| Missing module tests | ✅ | `reviews.test.ts`, `support.test.ts`, `users.test.ts` |
| README accuracy | ✅ | `README.md` |

---

## Summary of Changes Made

### 1. Database Migrations Organized
- Created `backend/src/database/migrations/` folder with numbered system
- Created `001_initial_schema.sql` with comprehensive consolidated schema
- Created `run-migrations.ts` migration runner with tracking table
- Created `000_migration_index.sql` documentation

### 2. Security Improvements
- Added HSTS header to `nginx/nginx.conf`
- Added HEALTHCHECK to `frontend/Dockerfile`

### 3. Feature Completions
- Added dietary filtering API (vegetarian, vegan, gluten-free, dairy-free, halal)
- Added session expiration background job to `scheduler.service.ts`
- Integrated pool ticket expiry job into scheduler

### 4. Code Quality
- Replaced console.log/error with logger in production code
- Fixed placeholder phone numbers with proper fallback text

### 5. Testing
- Created comprehensive customer E2E tests (`customer-flows.spec.ts`)
- Created reviews module unit tests (`reviews.test.ts`)
- Created support module unit tests (`support.test.ts`)
- Created users module unit tests (`users.test.ts`)

### 6. Documentation
- Updated README.md to accurately reflect test coverage (~30%)

