# Proposed GitHub Issues for V2 Resort Management Platform

These issues have been identified during the cleanup and audit of the repository. They represent critical paths for stabilizing the platform and reaching feature parity across all interfaces.

---

## 1. [MOBILE] Implement Feature Parity for Restaurant and Pool Modules
**Priority:** High
**Label:** `enhancement`, `mobile`

**Description:**
Currently, the React Native application (`mobile/`) only implements Chalet booking and order tracking. To reach a releasable state, we need to implement the following features already present in the web version:
- **Restaurant:** Menu browsing, cart management, and checkout.
- **Pool:** Session selection, ticket purchase, and QR code generation.
- **Auth:** 2FA support and biometric login (using `expo-local-authentication`).

---

## 2. [BACKEND] Standardize Error Handling and Logging across Modules
**Priority:** Medium
**Label:** `refactor`, `backend`

**Description:**
The backend modules show inconsistent error handling patterns. Some use explicit try-catch blocks with `winston` logging, while others rely on the global Express error handler.
**Requirements:**
- Implement a centralized `AppError` class for all modules.
- Ensure all business logic errors return consistent JSON payloads.
- Audit `loyalty` and `kiosk` modules for missing error boundaries.

---

## 3. [ADMIN] Expand Module Builder Component Library
**Priority:** Low
**Label:** `enhancement`, `admin`

**Description:**
The Module Builder allows for basic layout construction, but lacks complex UI blocks. 
**Proposed Blocks:**
- **Analytics Chart:** A block to render simple business unit metrics.
- **Dynamic Carousel:** For testimonials or feature highlights.
- **Multi-Step Form:** For complex onboarding or booking flows.
- **API Connector:** A property to bind a block directly to a backend endpoint.

---

## 4. [INFRA] Supabase Schema and Migration Audit
**Priority:** High
**Label:** `bug`, `infrastructure`

**Description:**
Discrepancies found between local migrations and the actual `seed.ts` expectations. 
**Tasks:**
- Run a full diff between `supabase/migrations` and a clean DB state.
- Ensure `soft-delete` triggers are implemented on all critical tables (orders, bookings).
- Fix the `DB_ERROR` seen in loyalty service tests during CI.
