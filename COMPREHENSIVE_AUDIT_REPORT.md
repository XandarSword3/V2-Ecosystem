# V2 HOSPITALITY PLATFORM — COMPREHENSIVE AUDIT REPORT

**Audit Date:** March 9, 2026  
**Auditor:** Automated Code Review & Static Analysis  
**Platform Version:** V2 Resort  
**Report Classification:** CONFIDENTIAL

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Codebase Metrics](#2-codebase-metrics)
3. [Architecture Assessment](#3-architecture-assessment)
4. [Security Audit Findings](#4-security-audit-findings)
5. [Module-by-Module Analysis](#5-module-by-module-analysis)
6. [Database & Data Integrity](#6-database--data-integrity)
7. [Frontend Assessment](#7-frontend-assessment)
8. [Third-Party Integration Review](#8-third-party-integration-review)
9. [Code Quality Assessment](#9-code-quality-assessment)
10. [Performance & Scalability](#10-performance--scalability)
11. [Dependency Vulnerability Report](#11-dependency-vulnerability-report)
12. [Risk Matrix & Prioritized Findings](#12-risk-matrix--prioritized-findings)
13. [Recommendations](#13-recommendations)

---

## 1. EXECUTIVE SUMMARY

### Overall Assessment: **STRONG with CRITICAL items requiring immediate remediation**

The V2 Hospitality Platform is a substantial, well-architected full-stack application with **823 API endpoints** across **47 route files**, supporting **38+ business modules**. The codebase demonstrates mature engineering patterns including RBAC, JWT lifecycle management, atomic database operations, and comprehensive input validation.

However, the audit identified **3 CRITICAL**, **12 HIGH**, **18 MEDIUM**, and **9 LOW** severity findings that require attention before production deployment.

### Key Strengths
- Comprehensive module coverage spanning the entire hospitality stack
- Strong authentication system with JWT rotation, 2FA/TOTP, WebAuthn/passkeys, OAuth (Google, Facebook, Apple)
- Row-Level Security (RLS) enforcement across 68+ database policies
- Atomic PostgreSQL functions for concurrency-sensitive operations (loyalty points, inventory, bookings)
- Real-time communication via Socket.IO with proper auth
- GDPR compliance module with data export, deletion, and consent tracking
- Multi-language support (EN, AR, FR, DE, IT) with RTL

### Critical Issues Requiring Immediate Action
1. **Raw SQL execution endpoint exposed in production** (app.ts line 50)
2. **13 known vulnerabilities** in backend dependencies (1 critical, 9 high)
3. **CSP headers allow `unsafe-inline` and `unsafe-eval`**, defeating XSS protection

---

## 2. CODEBASE METRICS

| Metric | Value |
|--------|-------|
| **Total Backend Source Files** | 460 TypeScript files |
| **Total Frontend Source Files** | 284 TypeScript/TSX files |
| **Backend Lines of Code** | 133,334 |
| **Frontend Lines of Code** | 73,042 |
| **Total Lines of Code** | ~206,376 |
| **API Route Files** | 47 |
| **Total API Endpoints** | 823 |
| **Backend Test Files** | 255 |
| **Database Migrations** | 103 (100 active) |
| **Database Tables** | 100+ |
| **RLS Policies** | 68+ |
| **Database Indexes** | 50+ |
| **Foreign Key Relationships** | 200+ |
| **Backend Modules** | 38+ |
| **Frontend Pages** | 108 routes |
| **Supported Languages** | 5 (EN, AR, FR, DE, IT) |
| **TypeScript Compiler Errors** | 31 (mostly rootDir config + minor type mismatches) |

### Endpoint Distribution (Top 15 by Count)

| Module | Endpoints | % of Total |
|--------|-----------|------------|
| Admin | 78 | 9.5% |
| Restaurant | 53 | 6.4% |
| Inventory | 35 | 4.3% |
| Chalet | 33 | 4.0% |
| Housekeeping | 32 | 3.9% |
| Marketing | 31 | 3.8% |
| Reporting | 31 | 3.8% |
| Kiosk | 29 | 3.5% |
| Auth | 28 | 3.4% |
| Revenue | 26 | 3.2% |
| Pool | 25 | 3.0% |
| Customization | 24 | 2.9% |
| Messaging | 24 | 2.9% |
| Mobile Check-in | 24 | 2.9% |
| I18n | 23 | 2.8% |

---

## 3. ARCHITECTURE ASSESSMENT

### 3.1 System Design

**Architecture Pattern:** Layered Monolithic Backend with Modular Organization  
**Communication:** REST API + Socket.IO (real-time)  
**Auth Flow:** Client → JWT Bearer Token → Express Middleware → Route Handler → Service → Supabase/PostgreSQL

#### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend Runtime** | Node.js | 20.x LTS |
| **Backend Framework** | Express.js | 4.18 |
| **Frontend Framework** | Next.js (App Router) | 14.2 |
| **Language** | TypeScript | 5.3 (backend), 5.4 (frontend) |
| **Database** | PostgreSQL via Supabase | - |
| **ORM** | Drizzle ORM + Supabase JS Client | - |
| **State Management** | Zustand | 4.5 |
| **Payments** | Stripe (including Terminal) | 14.25 |
| **Real-time** | Socket.IO | 4.8 |
| **Caching** | Redis (optional) | 7.x |
| **Auth** | JWT + bcryptjs + otplib (TOTP) | - |
| **Validation** | Zod | 3.22 |
| **CSS** | Tailwind CSS | 3.4 |
| **Monitoring** | OpenTelemetry + Sentry | - |
| **Testing** | Vitest + Playwright | - |

### 3.2 Middleware Stack (Critical for Security)

The middleware is applied in correct order in `app.ts`:

```
1. Sentry Request Handler (first)
2. Helmet (security headers)
3. CORS (origin validation)
4. Compression
5. Cookie Parser
6. Body Parsing (JSON 10MB limit)
7. CSRF Protection (double-submit cookie)
8. Request Logging (Morgan)
9. Routes
10. 404 Handler
11. Sentry Error Handler
12. Custom Error Handler (last)
```

**Assessment:** ✅ Correct ordering. CORS before routes, error handling last.

### 3.3 Architecture Strengths

- **Separation of Concerns:** Controllers → Services → Database layer consistently applied
- **Async Error Handling:** `asyncHandler` wrapper prevents unhandled promise rejections
- **Circuit Breaker Pattern:** Implemented for external service calls
- **Connection Pooling:** PostgreSQL pool with max 20 connections, 30s idle timeout
- **Graceful Degradation:** Redis failure doesn't crash the app; falls back to in-memory

### 3.4 Architecture Concerns

| Concern | Severity | Details |
|---------|----------|---------|
| Monolithic backend | MEDIUM | All 38 modules in single Express process; no microservice isolation |
| Single database | HIGH | PostgreSQL is single point of failure; no read replicas documented |
| No message queue | MEDIUM | Async operations (email, exports) use `setImmediate`, not a job queue |
| Session table growth | LOW | Sessions table grows unbounded; no cleanup cron documented |

---

## 4. SECURITY AUDIT FINDINGS

### 4.1 CRITICAL Findings

#### CRITICAL-001: Raw SQL Execution Endpoint in Production
**File:** `backend/src/app.ts` (lines 50-63)
**Severity:** 🔴 CRITICAL
**OWASP:** A03:2021 Injection, A01:2021 Broken Access Control

```typescript
app.post('/admin/execute-sql-fix', express.json(), async (req, res) => {
  if (req.headers['x-admin-secret'] !== 'temp-fix-secret-123') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const pool = getPool();
  await pool.query(req.body.sql);  // ARBITRARY SQL EXECUTION
});
```

**Impact:** Any attacker who discovers the hardcoded header secret (`temp-fix-secret-123`) gains complete database access including DROP TABLE, data exfiltration, and privilege escalation. This bypasses ALL RLS policies since it uses the direct PostgreSQL connection.

**Recommendation:** **DELETE THIS ENDPOINT IMMEDIATELY.** It should never exist in production code. Use proper migration scripts instead.

---

#### CRITICAL-002: CSP Headers Allow `unsafe-inline` and `unsafe-eval`
**File:** `backend/src/middleware/security-headers.middleware.ts`
**Severity:** 🔴 CRITICAL
**OWASP:** A03:2021 Injection (XSS)

Default CSP configuration:
```typescript
'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://js.stripe.com']
```

**Impact:** `unsafe-inline` and `unsafe-eval` render Content-Security-Policy ineffective against XSS attacks. An attacker who can inject content can execute arbitrary JavaScript, stealing session tokens from localStorage.

**Recommendation:** Remove `unsafe-inline` and `unsafe-eval`. Use nonce-based CSP (nonce generation already exists but is unused in defaults). Use `strict-dynamic` for Stripe JS.

---

#### CRITICAL-003: Backend Dependency Vulnerabilities
**Severity:** 🔴 CRITICAL (1 critical, 9 high severity CVEs)
**OWASP:** A06:2021 Vulnerable and Outdated Components

**Backend (13 vulnerabilities):**

| Package | Severity | Issue |
|---------|----------|-------|
| express-validator → validator | CRITICAL | ReDoS vulnerability |
| fast-xml-parser (via AWS SDK) | HIGH | XXE vulnerability chain |
| multer | HIGH | DoS via resource exhaustion + uncontrolled recursion (2 CVEs) |
| qs | HIGH | Denial of service via comma parsing |
| rollup | HIGH | Arbitrary file write via path traversal |
| @aws-sdk chain (5 packages) | HIGH | Signature bypass chain |

**Frontend (8 vulnerabilities):**

| Package | Severity | Issue |
|---------|----------|-------|
| serialize-javascript | HIGH | RCE via RegExp.flags |
| rollup | HIGH | Arbitrary file write |

**Recommendation:** Run `npm audit fix` immediately. For breaking changes, use `npm audit fix --force` in a test branch.

---

### 4.2 HIGH Findings

#### HIGH-001: JWT Access Tokens Stored in localStorage
**OWASP:** A02:2021 Cryptographic Failures
**Impact:** Any XSS vulnerability (even via third-party scripts) can steal tokens. Combined with CRITICAL-002 (CSP bypass), this creates a viable attack chain.
**Recommendation:** Migrate to httpOnly cookie storage with secure, SameSite=strict attributes.

#### HIGH-002: Unauthenticated Accommodation Booking Endpoint
**File:** `backend/src/modules/accommodations/accommodation.routes.ts`
**OWASP:** A01:2021 Broken Access Control
**Impact:** `POST /bookings` requires no authentication, enabling spam bookings and inventory blocking attacks.
**Recommendation:** Add rate limiting, CAPTCHA, and email verification to public booking endpoints.

#### HIGH-003: Kiosk Device Status Updates Without Authentication
**File:** `backend/src/modules/kiosk/kiosk.routes.ts`
**OWASP:** A01:2021 Broken Access Control
**Impact:** Device status, check-in initiation, and session management endpoints lack proper authentication. Malicious actors could manipulate kiosk state.
**Recommendation:** Implement device token validation for all kiosk endpoints.

#### HIGH-004: API Key Validation Not Implemented
**File:** `backend/src/middleware/api-security.middleware.ts`
**Code Comment:** `'For now, just pass through'`
**Impact:** API key middleware exists but only validates format, not actual key lookup. Provides false sense of security.
**Recommendation:** Implement database-backed API key validation or remove the middleware.

#### HIGH-005: WebAuthn Signature Verification Incomplete
**File:** `backend/src/modules/auth/biometric.controller.ts`
**Impact:** Biometric authentication stores credentials but counter validation doesn't reject cloned authenticators (`credential.counter <= stored.counter` check missing). No proper signature verification with `@simplewebauthn/server`.
**Recommendation:** Integrate `@simplewebauthn/server` for proper WebAuthn verification.

#### HIGH-006: Gift Card Code Generation Uses Math.random()
**File:** `backend/src/modules/giftcards/`
**OWASP:** A02:2021 Cryptographic Failures
**Impact:** Math.random() is not cryptographically secure. Gift card codes may be predictable with enough samples.
**Recommendation:** Use `crypto.randomBytes()` or `crypto.getRandomValues()`.

#### HIGH-007: Channel Manager Webhook Signature Verification Unclear
**File:** `backend/src/modules/channels/channel.controller.ts`
**Impact:** Webhook handlers for SiteMinder and OTA partners claim signature verification but implementation not visible. Could allow forged booking injections.
**Recommendation:** Verify and add explicit HMAC-SHA256 signature validation for all webhook endpoints.

#### HIGH-008: OAuth Callback Passes Tokens in URL Query Parameters
**File:** `backend/src/modules/auth/oauth.controller.ts`
```typescript
redirectUrl.searchParams.set('accessToken', result.accessToken);
redirectUrl.searchParams.set('refreshToken', result.refreshToken);
```
**OWASP:** A02:2021 Cryptographic Failures
**Impact:** Tokens in URL parameters are logged in browser history, server access logs, and potentially leaked via Referer headers.
**Recommendation:** Use a short-lived authorization code that the frontend exchanges for tokens via a POST request.

#### HIGH-009: CSRF Token Not Rotated After Login
**File:** `backend/src/middleware/csrf.middleware.ts`
**Impact:** Session fixation risk if CSRF token remains unchanged after authentication state change.
**Recommendation:** Rotate CSRF token on login/logout.

#### HIGH-010: Rate Limit Graceful Fallback Disables Protection
**File:** `backend/src/middleware/userRateLimit.middleware.ts`
**Impact:** When Redis is unavailable, user-based rate limiting silently passes through with `next()`. During a Redis outage, there's no fallback protection.
**Recommendation:** Fall back to in-memory rate limiting (express-rate-limit default store).

#### HIGH-011: No Account Lockout in Rate Limiter
**File:** `backend/src/middleware/rateLimit.middleware.ts`
**Impact:** IP-based rate limiting (5 attempts/15 min) doesn't lock accounts. The separate lockout service exists but the rate limiter and lockout service appear disconnected in some flows.
**Recommendation:** Ensure lockout service is called consistently on all auth failure paths.

#### HIGH-012: x-property-id Header Not Validated
**Files:** Revenue, Reporting, Multi-Property modules
**Impact:** Multiple modules trust `req.headers['x-property-id']` without validation. Users could potentially access data for properties they don't own.
**Recommendation:** Add middleware to validate property access against user permissions.

---

### 4.3 MEDIUM Findings

| ID | Finding | OWASP | Location |
|----|---------|-------|----------|
| MED-001 | Regex-based SQL injection detection is bypassable | A03 | 3 middleware files |
| MED-002 | Request ID uses `Math.random()` (predictable) | A02 | security.middleware.ts |
| MED-003 | HSTS preload enabled by default (irreversible) | A05 | security-headers.middleware.ts |
| MED-004 | Test environment bypass disables CSRF | A01 | csrf.middleware.ts |
| MED-005 | No input sanitization library on frontend | A03 | Frontend (no DOMPurify) |
| MED-006 | `dangerouslySetInnerHTML` used in 3 source files | A03 | layout.tsx, structured-data.tsx |
| MED-007 | No Content-Security-Policy in Next.js config | A03 | next.config.mjs |
| MED-008 | SameSite: 'lax' should be 'strict' for CSRF cookies | A01 | csrf.middleware.ts |
| MED-009 | Report execution endpoints lack rate limiting | A05 | reporting.routes.ts |
| MED-010 | Revenue forecast endpoints lack rate limiting | A05 | revenue.routes.ts |
| MED-011 | No audit trail for `canAccess()` permission helper | A09 | permission.middleware.ts |
| MED-012 | GDPR export uses setImmediate (no queue) | A04 | gdpr.service.ts |
| MED-013 | Printer network communication unencrypted | A02 | pos-hardware.controller.ts |
| MED-014 | Password reset token lifecycle unclear | A07 | auth.service.ts |
| MED-015 | Session table lacks index on refresh_token | A05 | Database schema |
| MED-016 | Soft delete not applied to all tables | A09 | Various migrations |
| MED-017 | 31 TypeScript compiler errors present | A04 | Various files |
| MED-018 | Overtime self-approval not prevented | A01 | staff.routes.ts |

### 4.4 LOW Findings

| ID | Finding | Location |
|----|---------|----------|
| LOW-001 | roleGuard.middleware.ts is redundant (3-line wrapper) | middleware/ |
| LOW-002 | requireDbPermission() marked deprecated but callable | auth.middleware.ts |
| LOW-003 | CSS injection possible via theme customization | Settings store |
| LOW-004 | No scheduled cleanup of expired sessions | Database |
| LOW-005 | XSS sanitizer empty whitelist blocks legitimate HTML | validation.middleware.ts |
| LOW-006 | Token version field optional in JWT payload | auth.utils.ts |
| LOW-007 | Multiple token payload shapes (userId vs id) | Loyalty module |
| LOW-008 | Commented-out accommodation CRUD routes | accommodation.routes.ts |
| LOW-009 | Several error log files committed to repo | backend/*.txt |

---

## 5. MODULE-BY-MODULE ANALYSIS

### Module Testing Matrix

| Module | Files | Endpoints | Auth | Validation | Tests | Rating |
|--------|-------|-----------|------|------------|-------|--------|
| **Auth** | 12+ | 28 | ✅ Full | ✅ Zod | ✅ Good | ⭐⭐⭐⭐⭐ |
| **Restaurant** | 10 | 53 | ✅ Role-based | ✅ Zod | ✅ Good | ⭐⭐⭐⭐ |
| **Payments** | 5 | 17 | ✅ Mixed | ✅ Zod | ✅ Some | ⭐⭐⭐⭐ |
| **Housekeeping** | 3 | 32 | ✅ Strict | ✅ Zod | ✅ Some | ⭐⭐⭐⭐ |
| **Loyalty** | 2 | 18 | ✅ Mixed | ✅ Zod | ✅ Good | ⭐⭐⭐⭐ |
| **Inventory** | 4 | 35 | ✅ Staff-only | ✅ Zod | ✅ Some | ⭐⭐⭐⭐ |
| **Pool** | 5+ | 25 | ✅ Mixed | ✅ Zod | ✅ Some | ⭐⭐⭐⭐ |
| **Chalets** | 3+ | 33 | ✅ Mixed | ✅ Zod | ✅ Some | ⭐⭐⭐⭐ |
| **Staff** | 2 | 20 | ✅ Role-based | ✅ Zod | ⚠️ Basic | ⭐⭐⭐ |
| **Kiosk** | 4 | 29 | ⚠️ Partial | ⚠️ Partial | ⚠️ None | ⭐⭐ |
| **Revenue** | 4 | 26 | ✅ Good | ⚠️ Implied | ⚠️ Basic | ⭐⭐⭐ |
| **Reporting** | 4 | 31 | ✅ Good | ⚠️ Unknown | ⚠️ None | ⭐⭐⭐ |
| **Channels** | 4 | 19 | ✅ Admin | ⚠️ Webhook? | ✅ Some | ⭐⭐⭐ |
| **GDPR** | 4 | 18 | ✅ Full | ✅ Zod | ✅ Integration | ⭐⭐⭐⭐ |
| **Giftcards** | 2 | 16 | ✅ Mixed | ✅ Zod | ✅ Good | ⭐⭐⭐⭐ |
| **Customization** | 4+ | 24 | ✅ Role-based | ✅ RPC | ✅ Good | ⭐⭐⭐⭐⭐ |
| **Marketing** | 3+ | 31 | ✅ Admin | ✅ Zod | ⚠️ Basic | ⭐⭐⭐ |
| **Multi-Property** | 4 | 16 | ✅ Super Admin | ⚠️ Header | ⚠️ None | ⭐⭐⭐ |
| **POS** | 2 | 12 | ✅ Staff+Admin | ✅ Stripe-safe | ⚠️ None | ⭐⭐⭐ |
| **Accommodations** | 2 | 7 | ❌ Missing | ⚠️ Basic | ⚠️ None | ⭐⭐ |
| **Admin** | 3+ | 78 | ✅ Admin-only | ✅ Zod | ⚠️ Some | ⭐⭐⭐⭐ |

### Module Highlights

**Best Implemented Modules:**
1. **Customization Module** — Excellent transactional snapshots, inventory integration, multi-language, soft deletes
2. **Auth Module** — Comprehensive JWT lifecycle, 2FA, OAuth, WebAuthn, account lockout, progressive delays
3. **Loyalty Module** — PostgreSQL advisory locks for atomic operations, race condition prevention
4. **GDPR Module** — Complete compliance with export, deletion, consent tracking, data retention

**Modules Needing Improvement:**
1. **Accommodations** — Missing authentication on public booking, very basic validation, commented-out routes
2. **Kiosk** — Unauthenticated device endpoints, missing comprehensive tests
3. **POS** — No unit tests, printer network security concerns

---

## 6. DATABASE & DATA INTEGRITY

### 6.1 Schema Assessment

**Total Tables:** 100+  
**Migration Count:** 103 (well-versioned, linear history from 2023 to March 2026)  
**ORM:** Drizzle ORM with 24 schema modules + Supabase JS Client

#### Table Distribution by Domain

| Domain | Table Count |
|--------|------------|
| Booking & Accommodation | 7 |
| Restaurant & Food | 8 |
| Snack Bar | 4 |
| Inventory & Supply | 10+ |
| Housekeeping | 5 |
| Financial & Payments | 8 |
| Loyalty & Marketing | 10+ |
| Security & Audit | 10+ |
| Staff & Operations | 6 |
| Other Systems | 15+ |

### 6.2 Data Integrity Strengths

- ✅ **Foreign key cascading** properly configured (CASCADE DELETE for child records, SET NULL for audit trails, RESTRICT for payments/chargebacks)
- ✅ **Check constraints** on critical fields (amounts, quantities)
- ✅ **Unique constraints** on emails, booking conflicts
- ✅ **Atomic functions** for concurrency-sensitive operations (`earn_loyalty_points_atomic`, `purchase_pool_ticket_atomic`, `create_chalet_booking_with_addons_atomic`)
- ✅ **Soft delete** patterns with `deleted_at`, `deleted_by` columns
- ✅ **Audit logging** via `security_audit_log` table with composite indexes

### 6.3 RLS Assessment

**68+ managed policies** applied in migration `20260208000000_enforce_rls_policies.sql`

**Policy Categories:**
- **Public Read:** Customization groups, loyalty settings, currencies (safe for anonymous access)
- **Staff Operational:** Kitchen operations, inventory, housekeeping tasks
- **Admin-Only:** 44 policies for advanced features (GDPR, marketing, pricing rules)
- **Service Role:** 5 server-side operation policies (currencies, email bounces, webhooks)

**Role Resolution:** `user_has_role()` function checks JWT metadata → users table → normalizes `super_admin` → `admin`

**Assessment:** ✅ **STRONG**. The Feb 2026 migration replaced all open `USING (true)` policies with proper role-based access.

### 6.4 Index Coverage

- ✅ Security audit log has 7 indexes including composite
- ✅ Booking/availability tables indexed on date ranges
- ✅ Kitchen orders indexed on priority (DESC) and status
- ⚠️ **Missing:** Index on `sessions.refresh_token` column (used in token refresh lookups)
- ⚠️ **Potential:** No documented index on `users.email` (used in login, registration)

### 6.5 Connection Management

| Setting | Value | Assessment |
|---------|-------|------------|
| Max Connections | 20 | Adequate for modest load |
| Idle Timeout | 30s | Good |
| Connection Timeout | 10s | Good |
| SSL | Required (non-localhost) | ✅ |
| Fallback | Supabase HTTP API | ✅ Graceful |

---

## 7. FRONTEND ASSESSMENT

### 7.1 Architecture

- **Framework:** Next.js 14.2 with App Router
- **State:** Zustand (4 stores: auth, cart, settings, module-builder)
- **API Client:** Axios with interceptors for token refresh, CSRF, retry logic
- **Forms:** React Hook Form + Zod
- **UI:** 40+ Radix UI primitives + Tailwind CSS

### 7.2 Frontend Routes (108 pages)

**Guest-Facing:** Restaurant, pool, chalets, cart, order tracking, gift cards, privacy, contact  
**Auth:** Login, register, forgot-password, reset-password  
**Staff:** Staff dashboard, task management  
**Admin:** 25+ admin subsections (audit, channels, coupons, housekeeping, inventory, kiosk, loyalty, reports, settings, users, etc.)  
**Special:** Kiosk mode, offline mode

### 7.3 Security Assessment

| Area | Status | Notes |
|------|--------|-------|
| XSS Prevention | ⚠️ MEDIUM | React auto-escapes by default; 3 uses of `dangerouslySetInnerHTML` (2 are JSON-LD/theme which are controlled) |
| CSRF Protection | ✅ GOOD | Double-submit cookie pattern with `X-CSRF-Token` header |
| Token Management | ⚠️ HIGH | Stored in localStorage (XSS-accessible); proactive expiry checking |
| Token Refresh | ✅ GOOD | Atomic refresh with request queue prevents race conditions |
| Input Validation | ⚠️ MEDIUM | No client-side sanitization library (DOMPurify); relies on backend |
| Image Handling | ⚠️ MEDIUM | Image domains whitelisted but no runtime URL validation |
| Error Handling | ✅ GOOD | Sentry integration, 10% trace rate (prod), 100% error replays |
| Session Timeout | ✅ GOOD | SessionTimeoutMonitor component exists |

### 7.4 Accessibility & i18n

- **Languages:** EN, AR, FR, DE, IT
- **RTL Support:** Implemented for Arabic
- **Translation Pattern:** Field suffix (`name_ar`, `name_fr`) with English fallback
- **Assessment:** Completeness of translations should be verified per-language

### 7.5 `dangerouslySetInnerHTML` Usage (Source Files Only)

| File | Usage | Risk |
|------|-------|------|
| `src/app/layout.tsx:146` | Theme initialization script | **LOW** — Controlled string, no user input |
| `src/lib/structured-data.tsx:276` | JSON-LD schema | **LOW** — `JSON.stringify()` output is safe |
| `src/components/common/StructuredData.tsx:29` | JSON-LD schema | **LOW** — Same pattern |

**Assessment:** All 3 usages are for meta/structured data with no user input. Risk is LOW but pattern should be documented.

---

## 8. THIRD-PARTY INTEGRATION REVIEW

### 8.1 Stripe (Payment Processing)

| Aspect | Status | Details |
|--------|--------|---------|
| Tokenization | ✅ | No PAN storage; Stripe handles card data |
| Webhook Verification | ✅ | `stripe.webhooks.constructEvent()` with signing secret |
| Idempotency | ✅ | Payment ledger prevents duplicate processing |
| Terminal SDK | ✅ | Connection tokens (not raw credentials) |
| Test Mode | ✅ | Separate keys for test/production |
| Refund Authorization | ✅ | `rateLimits.sensitive` applied |
| Manual Capture | ✅ | POS uses manual capture for authorization flow |

**Assessment:** ⭐⭐⭐⭐⭐ Excellent Stripe integration

### 8.2 Supabase

| Aspect | Status | Details |
|--------|--------|---------|
| Auth | ✅ | JWT + Supabase Auth integration |
| RLS | ✅ | 68+ policies enforced |
| Storage | Unknown | Not audited in detail |
| Edge Functions | Unknown | Not found in codebase |
| Real-time | ⚠️ | Socket.IO used instead of Supabase Realtime |

### 8.3 Socket.IO (Real-time)

| Aspect | Status | Details |
|--------|--------|---------|
| Authentication | ✅ | Token verification on connection |
| CORS | ✅ | Safe origin allowlist |
| Room-based Broadcasting | ✅ | Role-segregated rooms |
| Connection Recovery | ✅ | 2-minute grace period |
| HTTPS/WSS | ✅ | Enforced in production |
| Heartbeat | ✅ | Connection health monitoring |

**Assessment:** ⭐⭐⭐⭐⭐ Excellent Socket.IO implementation

### 8.4 Sentry / OpenTelemetry

| Aspect | Status | Details |
|--------|--------|---------|
| Client Errors | ✅ | Production-only, 10% trace, 100% error replay |
| PII Stripping | ✅ | Cookies stripped from events |
| Noise Filtering | ✅ | Network errors, extension errors filtered |
| Backend Errors | ✅ | Separate configuration |
| Performance | ✅ | Integration with error handler middleware |

### 8.5 Email (Nodemailer)

| Aspect | Status | Details |
|--------|--------|---------|
| SMTP Config | ✅ | Configurable via env vars |
| Templates | ✅ | Database-stored HTML templates |
| Bounce Handling | ✅ | Email bounce tracking tables exist |

### 8.6 QuickBooks

| Aspect | Status | Details |
|--------|--------|---------|
| OAuth2 | ✅ | Standard flow with token management |
| Endpoints | 13 | Revenue sync, invoice creation, account mapping |

---

## 9. CODE QUALITY ASSESSMENT

### 9.1 TypeScript Compilation

**Total Errors:** 31

| Error Type | Count | Files Affected |
|------------|-------|---------------|
| TS6059 (rootDir config) | 16 | shared/types/ (config issue, not real) |
| TS2322/TS2352 (type mismatch) | 6 | order.service.ts, order.controller.ts |
| TS7006 (implicit any) | 3 | run_atomic_migration.ts, coupon.controller.ts |
| TS2551 (wrong property) | 3 | booking.controller.ts, coupon.controller.ts |
| TS2304 (undefined name) | 2 | coupon.controller.ts (missing `logger` import) |
| TS18046 (unknown type) | 2 | run_atomic_migration.ts |

**Assessment:** 
- 16 errors are configuration issues (rootDir mismatch with shared types)
- 15 are real errors, mostly in non-critical paths (migration scripts, coupon module)
- Core business logic (restaurant, payments, auth) compiles cleanly

### 9.2 Architecture Patterns

| Pattern | Implementation | Quality |
|---------|---------------|---------|
| Controllers | ✅ Express route handlers with asyncHandler | Good |
| Services | ✅ Business logic layer | Good |
| Validation | ✅ Zod schemas with .safeParse() | Excellent |
| Error Handling | ✅ Centralized error handler + operational/unexpected distinction | Good |
| Logging | ✅ Structured logging via Winston | Good |
| Config | ✅ Centralized config with env var defaults | Good |

### 9.3 Code Patterns Observed

**Positive Patterns:**
- Consistent `asyncHandler` wrapping
- Zod validation before database operations
- Supabase parameterized queries (no raw SQL concatenation in business logic)
- Activity logging for audit trails
- Non-blocking Socket.IO emissions

**Negative Patterns:**
- Some controllers mix concerns (tab.controller.ts at 700+ lines)
- Multiple redundant security middleware files with overlapping SQL injection regex
- `Math.random()` used where `crypto.randomBytes()` should be (request IDs, gift card codes)
- Several utility scripts committed that should be in `.gitignore` (test-debug*.js, *.txt output files)

### 9.4 Test Coverage

**Backend Test Files:** 255  
**Test Framework:** Vitest  
**Integration Tests:** Present (ai-agent, security-patches, comprehensive-verification, criticalFlows)

| Test Category | Files | Assessment |
|---------------|-------|------------|
| Unit (controllers) | 30+ | Good coverage for auth, loyalty, restaurant, pool |
| Unit (services) | 10+ | Moderate; key services tested |
| Integration | 5+ | Good; covers RBAC, payment ledger immutability |
| Security | 1 | Tests payment ledger immutability |
| E2E (Playwright) | Present | Configuration exists |
| Load Tests | Present | Stress test bots documented |

**Coverage Gaps:**
- Revenue module (1 test file)
- Reporting module (no tests)
- Multi-property module (no tests)
- POS module (no tests)
- Kiosk module (no tests)
- Mobile check-in (no tests)
- Staff module (minimal tests)

---

## 10. PERFORMANCE & SCALABILITY

### 10.1 Backend Performance Characteristics

| Aspect | Implementation | Rating |
|--------|---------------|--------|
| Connection Pooling | max 20 connections, 30s idle | ✅ |
| Request Size Limits | 10MB JSON body | ✅ |
| Compression | gzip via compression middleware | ✅ |
| Rate Limiting | Per-IP (express-rate-limit) + Per-user (Redis-backed) | ✅ |
| Caching | Redis with graceful fallback | ✅ |
| Circuit Breaker | External service calls | ✅ |
| DB Transactions | Atomic RPC for concurrent operations | ✅ |

### 10.2 Frontend Performance Characteristics

| Aspect | Implementation | Rating |
|--------|---------------|--------|
| Code Splitting | Next.js automatic | ✅ |
| Image Optimization | next/image with domain whitelist | ✅ |
| Standalone Build | Docker-ready output | ✅ |
| State Management | Zustand (lightweight) | ✅ |
| Bundle Size | Not measured (recommend Lighthouse) | ⚠️ Unknown |

### 10.3 Scalability Concerns

| Concern | Severity | Details |
|---------|----------|---------|
| Single process backend | MEDIUM | 38 modules in one process; CPU-bound ops block event loop |
| No horizontal scaling docs | MEDIUM | Socket.IO has Redis adapter but deployment docs don't cover multi-instance |
| Database pool limit 20 | MEDIUM | May bottleneck at 100+ concurrent users |
| No CDN configuration | LOW | Static assets served by Next.js, not CDN |
| 10MB body limit | LOW | Large file uploads may need streaming |

### 10.4 Offline Mode

- IndexedDB caching for menu data
- Order queuing when offline
- Cash payment processing works offline
- Auto-sync on reconnection
- **Limitation:** Card payments require internet (expected)

---

## 11. DEPENDENCY VULNERABILITY REPORT

### Backend Dependencies (npm audit)

| Severity | Count | Auto-fixable |
|----------|-------|-------------|
| Critical | 1 | Yes |
| High | 9 | Yes |
| Moderate | 1 | Yes |
| Low | 2 | Yes |
| **Total** | **13** | **All** |

### Frontend Dependencies (npm audit)

| Severity | Count | Auto-fixable |
|----------|-------|-------------|
| High | 6 | Yes (some need --force) |
| Moderate | 1 | Yes |
| Low | 1 | Yes |
| **Total** | **8** | **All** |

### Notable Dependency Concerns

| Package | Issue | Risk |
|---------|-------|------|
| **multer** | DoS via resource exhaustion + uncontrolled recursion | File upload attacks |
| **qs** | ArrayLimit bypass DoS | Query string attacks |
| **serialize-javascript** | RCE via RegExp.flags | Build-time code execution |
| **rollup** | Arbitrary file write via path traversal | Build-time file manipulation |
| **fast-xml-parser** | XXE chain via AWS SDK | XML processing attacks |

---

## 12. RISK MATRIX & PRIORITIZED FINDINGS

### Risk Severity Distribution

```
CRITICAL:  ███ 3
HIGH:      ████████████ 12
MEDIUM:    ██████████████████ 18
LOW:       █████████ 9
           ──────────────────────
Total:     42 findings
```

### Top 10 Priority Actions

| Priority | Finding | Severity | Effort | Impact |
|----------|---------|----------|--------|--------|
| **P0** | Remove raw SQL execution endpoint | CRITICAL | 5 min | Prevents total DB compromise |
| **P0** | Run `npm audit fix` on backend + frontend | CRITICAL | 15 min | Patches 21 CVEs |
| **P1** | Fix CSP headers (remove unsafe-inline/eval) | CRITICAL | 2 hours | Prevents XSS |
| **P1** | Add auth to accommodation booking | HIGH | 30 min | Prevents booking spam |
| **P1** | Add auth to kiosk device endpoints | HIGH | 1 hour | Prevents kiosk manipulation |
| **P2** | Migrate JWT tokens to httpOnly cookies | HIGH | 4 hours | Prevents token theft via XSS |
| **P2** | Fix OAuth token redirect (use auth code) | HIGH | 2 hours | Prevents token leakage |
| **P2** | Implement API key validation | HIGH | 2 hours | Completes API security layer |
| **P3** | Validate x-property-id header | HIGH | 1 hour | Prevents cross-property access |
| **P3** | Rotate CSRF token after login | HIGH | 30 min | Prevents session fixation |

---

## 13. RECOMMENDATIONS

### Immediate (Before Production)

1. **DELETE** the `/admin/execute-sql-fix` endpoint from `app.ts`
2. **RUN** `npm audit fix` in both backend and frontend
3. **FIX** CSP headers: remove `unsafe-inline` and `unsafe-eval`; implement nonce-based CSP
4. **ADD** authentication/rate-limiting to accommodation booking endpoint
5. **ADD** device token validation to all kiosk endpoints
6. **REPLACE** `Math.random()` with `crypto.randomBytes()` in gift card code generation and request ID generation

### Short-Term (Within 2 Weeks)

7. **MIGRATE** JWT tokens from localStorage to httpOnly secure cookies
8. **FIX** OAuth callback to use authorization code flow instead of URL parameters
9. **IMPLEMENT** API key database validation
10. **ADD** middleware to validate `x-property-id` against user permissions
11. **ROTATE** CSRF tokens after login/logout
12. **ADD** fallback in-memory rate limiting when Redis is unavailable
13. **ADD** index on `sessions.refresh_token` column
14. **INTEGRATE** `@simplewebauthn/server` for proper WebAuthn verification
15. **ADD** webhook signature validation to channel manager endpoints

### Medium-Term (Within 1 Month)

16. **EXPAND** test coverage for: Reporting, Revenue, POS, Kiosk, Multi-Property, Staff modules  
17. **FIX** 31 TypeScript compiler errors
18. **REMOVE** redundant SQL injection regex detection (3 files); rely on ORM parameterization
19. **ADD** Content-Security-Policy to `next.config.mjs`
20. **IMPLEMENT** scheduled session cleanup job
21. **ADD** rate limiting to report execution and revenue forecast endpoints
22. **CONSOLIDATE** security middleware files (reduce overlap)
23. **ADD** audit logging for super admin bypass operations

### Long-Term (Within 3 Months)

24. **EVALUATE** microservice extraction for high-traffic modules (restaurant, payments)
25. **ADD** database read replicas for reporting/analytics queries
26. **IMPLEMENT** proper job queue (Bull/BullMQ) for async operations (email, GDPR exports)
27. **ADD** CDN for static asset delivery
28. **INCREASE** database connection pool based on load testing results
29. **CONDUCT** penetration testing with tools (OWASP ZAP, Burp Suite)
30. **IMPLEMENT** Lighthouse CI for automated frontend performance tracking

---

## APPENDIX A: SECURITY MIDDLEWARE COVERAGE MATRIX

| Middleware | Applied | Scope | Assessment |
|-----------|---------|-------|------------|
| Helmet | ✅ Global | All routes | Good |
| CORS | ✅ Global | All routes | Good; verify production origins |
| CSRF | ✅ Global | State-changing routes | Good; needs post-login rotation |
| Rate Limiting (IP) | ✅ Route-level | Auth endpoints | Basic; needs Redis fallback |
| Rate Limiting (User) | ✅ Route-level | Financial operations | Good; Redis-backed |
| Auth (JWT) | ✅ Route-level | Protected routes | Good |
| RBAC | ✅ Route-level | Protected routes | Good; fine-grained permissions |
| Zod Validation | ✅ Controller-level | Input endpoints | Excellent |
| Request Sanitization | ✅ Global | All routes | Good; removes null bytes |
| SQL Injection Detection | ✅ Global | All routes | Weak (regex-based); not needed with ORM |
| Security Headers | ✅ Global | All routes | Good; CSP needs fixing |
| Request ID | ✅ Global | All routes | Good; needs crypto RNG |
| Compression | ✅ Global | All responses | Good |

## APPENDIX B: DATABASE TABLE INVENTORY (Key Tables)

**Users & Auth:** users, sessions, user_permissions, permissions, roles, password_history, two_factor_auth, biometric_credentials  
**Restaurant:** menu_categories, menu_items, menu_modifier_groups, menu_modifier_options, restaurant_tables, table_reservations, kitchen_orders, kitchen_order_items, restaurant_orders, order_items  
**Bookings:** chalets, chalet_bookings, chalet_blocked_dates, pool_tickets, pool_sessions, pool_memberships  
**Financial:** payments, payment_ledger, chargebacks, chargebacks_disputes, user_credits, gift_cards, gift_card_transactions  
**Loyalty:** loyalty_tiers, loyalty_members, loyalty_transactions, loyalty_rewards  
**Inventory:** inventory_items, inventory_categories, inventory_transactions, inventory_alerts, inventory_recipes, inventory_batches, inventory_suppliers  
**Housekeeping:** housekeeping_task_types, housekeeping_tasks, housekeeping_inspections, housekeeping_sla, housekeeping_supplies  
**Staff:** staff_shifts, shift_swap_requests, shift_adjustments, manager_approvals  
**Marketing:** marketing_campaigns, email_journeys, journey_steps, coupons, coupon_usage  
**GDPR:** gdpr_retention_policies, gdpr_processing_activities, gdpr_data_sharing_log  
**Audit:** security_audit_log  

## APPENDIX C: AUTHENTICATION METHODS SUPPORTED

| Method | Status | Implementation |
|--------|--------|---------------|
| Email + Password | ✅ Active | bcrypt (cost 12), Zod validation |
| JWT Access Token | ✅ Active | 15-min expiry, separate secret |
| JWT Refresh Token | ✅ Active | 7-day expiry, single-use rotation |
| TOTP 2FA | ✅ Active | otplib, QR code, backup codes |
| OAuth (Google) | ✅ Active | Full flow with state verification |
| OAuth (Facebook) | ✅ Active | Full flow |
| OAuth (Apple) | ✅ Active | JWKS verification |
| WebAuthn/Passkeys | ✅ Active | Face ID/Touch ID (needs verification fix) |
| Account Lockout | ✅ Active | 5 attempts, 15-min lockout, progressive delays |
| Captcha Trigger | ✅ Active | Required after 3 failed attempts |

---

**END OF AUDIT REPORT**

*This audit was conducted through static code analysis and architecture review. Runtime testing, penetration testing with security tools (OWASP ZAP, Burp Suite), and production load testing should be conducted separately to validate these findings.*
