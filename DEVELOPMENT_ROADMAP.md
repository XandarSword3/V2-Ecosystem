# V2 RESORT SYSTEM: COMPLETE DEVELOPMENT ROADMAP TO 100% PRODUCTION-READY

**Document Version:** 1.0  
**Created:** January 24, 2026  
**Target Completion:** April 11, 2026  
**Author:** GitHub Copilot (Claude Opus 4.5)

---

## EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Total Duration** | 12 weeks (6 sprints of 2 weeks) |
| **Total Development Hours** | 720 hours |
| **Total Cost (at €80/hr)** | €57,600 |
| **Team Size** | 2-3 developers |
| **Sprint Count** | 6 sprints + 1 hardening sprint |
| **Target Completion Date** | April 11, 2026 |
| **Current Production Readiness** | 71% |
| **Target Production Readiness** | 100% |

### Key Discovery During Analysis

The codebase is **significantly more complete** than initially assessed:

**Already Implemented (Not Requiring Work):**
- ✅ Weekend/weekday pricing for chalets (with seasonal rules)
- ✅ GDPR compliance (data export + deletion + 30-day grace period)
- ✅ Rate limiting middleware (user-based + IP-based)
- ✅ Backup service with restore capability
- ✅ Scheduled reports service (daily/weekly/monthly)
- ✅ OpenAPI/Swagger documentation (2 versions)
- ✅ Soft delete pattern throughout codebase
- ✅ TypeScript strict mode enabled
- ✅ Constants file (no magic numbers)
- ✅ Cancellation email templates
- ✅ 150+ unit/integration tests

**Actual Work Required:**
- Complete missing features (session timeout, QR security, email wizard)
- Enhance existing features (booking modification, pool memberships)
- Increase test coverage (30% → 80%)
- Documentation completion
- Production hardening

---

## PROJECT OVERVIEW

### Scope

This roadmap covers all work required to bring the V2 Resort Management System from its current state (71% production-ready) to 100% production-ready status, excluding the mobile application.

### Modules In Scope
1. **Authentication & Authorization** - Complete with enhancements
2. **Restaurant Module** - Ordering, kitchen display, inventory
3. **Chalet Booking Module** - Reservations, pricing, modifications
4. **Pool Ticketing Module** - Sessions, QR tickets, memberships
5. **Admin Dashboard** - Analytics, reports, settings
6. **Settings & Configuration** - Branding, email, integrations
7. **Infrastructure** - Security, performance, deployment

### Modules Out of Scope
- Mobile application (React Native) - Separate project
- Module Builder dynamic schema generation - Architectural change

---

## PART 1: DEFINITION OF "100% PRODUCTION-READY"

### 1.1 FEATURE COMPLETENESS CRITERIA

#### Core Authentication ✅ MOSTLY COMPLETE
| Feature | Status | Notes |
|---------|--------|-------|
| User Registration | ✅ Complete | bcrypt cost 12, email normalization |
| User Login | ✅ Complete | JWT tokens, session management |
| Password Reset | ✅ Complete | Token-based, 1-hour expiry |
| Two-Factor Auth | ✅ Complete | TOTP with backup codes |
| Session Management | ✅ Complete | Database sessions, token versioning |
| Account Deletion | ✅ Complete | GDPR compliant, 30-day grace period |
| Password Strength | ⚠️ Partial | Backend validation exists, needs frontend visual feedback |
| Brute Force Protection | ✅ Complete | Rate limiting middleware |
| Email Verification | ⚠️ Partial | Requires SMTP configuration wizard |
| Remember Me | 🔧 Needed | Extended session option |
| Session Timeout UI | 🔧 Needed | Frontend idle detection with warning |

#### Restaurant Module ✅ MOSTLY COMPLETE
| Feature | Status | Notes |
|---------|--------|-------|
| Menu Management | ✅ Complete | CRUD, images, categories, translations |
| Dietary Filtering | ✅ Complete | Vegetarian, vegan, gluten-free, halal |
| Order Creation | ✅ Complete | Validation, discounts, items |
| Kitchen Display | ✅ Complete | Real-time with Socket.io |
| Order Status | ✅ Complete | Audit logging |
| Auto-Translation | ✅ Complete | AR/FR on creation |
| Inventory Integration | ✅ Complete | Stock tracking exists |
| Auto-86 Items | 🔧 Needed | When inventory depleted |
| Table Management | 🔧 Needed | For dine-in service |
| Order Modifications | 🔧 Needed | Staff can add/remove items |
| Promotional Pricing | 🔧 Needed | Happy hour, daily specials |
| Scheduled Orders | 🔧 Needed | Pre-order for future |
| Customer Reviews | ✅ Complete | Module exists |

#### Chalet Booking Module ✅ MOSTLY COMPLETE
| Feature | Status | Notes |
|---------|--------|-------|
| Availability Calendar | ✅ Complete | Blocked dates calculation |
| Double-Booking Prevention | ✅ Complete | Overlap validation |
| Add-Ons Support | ✅ Complete | Per-night or one-time |
| Weekend/Weekday Pricing | ✅ Complete | Already implemented! |
| Seasonal Pricing | ✅ Complete | chalet_price_rules table |
| Booking Creation | ✅ Complete | Full validation |
| Booking Modification | 🔧 Needed | Change dates, upgrade |
| Cancellation Policy | 🔧 Needed | Configurable refund rules |
| PDF Confirmation | 🔧 Needed | Email attachment |
| Guest Preferences | 🔧 Needed | Store and recall |
| Early/Late Checkout | 🔧 Needed | Pricing and availability |
| Housekeeping Integration | ✅ Complete | Module exists |

#### Pool Ticketing Module ✅ MOSTLY COMPLETE
| Feature | Status | Notes |
|---------|--------|-------|
| Session Selection | ✅ Complete | Gender filtering |
| Capacity Tracking | ✅ Complete | Real-time |
| Ticket Purchase | ✅ Complete | Adult/child pricing |
| QR Code Generation | ✅ Complete | QRCode library |
| QR Security | 🔧 Needed | HMAC signature |
| Season Passes | 🔧 Needed | Multi-visit packages |
| Family Packages | 🔧 Needed | Bundle pricing |
| Lost Ticket Replacement | 🔧 Needed | Lookup and reissue |
| Per-Zone Capacity | 🔧 Needed | Sauna, pool, jacuzzi |
| Pool-Side Food | 🔧 Needed | Location-based ordering |

#### Admin Dashboard ✅ MOSTLY COMPLETE
| Feature | Status | Notes |
|---------|--------|-------|
| Real-Time Stats | ✅ Complete | Socket.io |
| User Management | ✅ Complete | Full CRUD |
| Audit Logs | ✅ Complete | All operations |
| Revenue Charts | ✅ Complete | Per module |
| Scheduled Reports | ✅ Complete | Daily/weekly/monthly email |
| Backup System | ✅ Complete | Create/restore/download |
| Date Range Selection | ✅ Complete | Week/month/year |
| Export CSV | ✅ Complete | All major tables |
| Export PDF | 🔧 Needed | Formatted reports |
| Dashboard Customization | 🔧 Needed | Widget arrangement |
| Occupancy Forecasting | 🔧 Needed | Trend analysis |
| Staff Performance | 🔧 Needed | Metrics dashboard |

#### Settings & Configuration ✅ MOSTLY COMPLETE
| Feature | Status | Notes |
|---------|--------|-------|
| Site Settings | ✅ Complete | Name, contact, etc. |
| Appearance Settings | ✅ Complete | Page exists |
| Translations | ✅ Complete | EN/AR/FR (1970+ keys) |
| Backup Management | ✅ Complete | UI exists |
| Notification Settings | ✅ Complete | Page exists |
| Email Configuration Wizard | 🔧 Needed | Test connection UI |
| Visual Branding Editor | 🔧 Needed | Live preview |
| Email Template Editor | 🔧 Needed | WYSIWYG |
| Tax Configuration | 🔧 Needed | Region-based |

### 1.2 CODE QUALITY CRITERIA

#### Testing
| Criterion | Current | Target | Gap |
|-----------|---------|--------|-----|
| Backend Statement Coverage | 30% | 80% | +50% |
| Backend Branch Coverage | 47% | 70% | +23% |
| Backend Function Coverage | 33% | 75% | +42% |
| Frontend Coverage | ~20% | 70% | +50% |
| Critical Path Coverage | ~60% | 100% | +40% |
| E2E Test Count | 21 | 50 | +29 |
| Load Test | None | 100 users | Full |

#### Code Standards
| Criterion | Status | Notes |
|-----------|--------|-------|
| TypeScript Strict Mode | ✅ Complete | Enabled in tsconfig.json |
| ESLint Zero Errors | ⚠️ Partial | Some warnings remain |
| No Magic Numbers | ✅ Complete | constants.ts exists |
| Consistent Error Handling | ⚠️ Partial | Some `any` types remain |
| No console.log | 🔧 Needed | Replace with logger |
| No Commented Code | 🔧 Needed | Cleanup pass |

#### Documentation
| Criterion | Status | Notes |
|-----------|--------|-------|
| API Documentation | ✅ Complete | OpenAPI 3.0.3 (2 versions) |
| Database Schema (ERD) | 🔧 Needed | Visual diagram |
| Architecture Diagrams | 🔧 Needed | C4 model |
| Deployment Guide | ⚠️ Partial | README exists, needs detail |
| Environment Reference | ✅ Complete | .env.example |
| User Manual | 🔧 Needed | Customer guide |
| Admin Guide | 🔧 Needed | Operations manual |
| Developer Onboarding | 🔧 Needed | Setup + architecture |

### 1.3 SECURITY CRITERIA

#### Authentication & Authorization
| Criterion | Status | Notes |
|-----------|--------|-------|
| OWASP Auth Checklist | ⚠️ Partial | 2FA mandatory for admin needed |
| Password Policy Config | 🔧 Needed | Admin-configurable |
| Account Lockout | 🔧 Needed | Progressive delays |
| Session Fixation Protection | ✅ Complete | New token on login |
| CSRF Protection | ✅ Complete | Token validation |
| Horizontal Privilege Tests | 🔧 Needed | Security test suite |

#### Data Protection
| Criterion | Status | Notes |
|-----------|--------|-------|
| Input Validation | ✅ Complete | Zod schemas everywhere |
| XSS Prevention | ✅ Complete | Output encoding |
| SQL Injection Prevention | ✅ Complete | Parameterized queries |
| File Upload Restrictions | ✅ Complete | constants.ts |
| PII Encryption at Rest | ⚠️ Partial | Supabase handles |
| Audit Logs | ✅ Complete | activityLogger |
| Data Retention | ✅ Complete | Soft delete pattern |

#### Infrastructure
| Criterion | Status | Notes |
|-----------|--------|-------|
| HTTPS Only | ✅ Complete | Config ready |
| Security Headers | ✅ Complete | Helmet.js |
| Rate Limiting | ✅ Complete | Per-user + IP |
| DDoS Protection | ⚠️ Partial | Needs cloud config |
| Secrets in Environment | ✅ Complete | .env pattern |
| Dependency Scan | 🔧 Needed | npm audit |
| Penetration Test | 🔧 Needed | OWASP ZAP |

### 1.4 PERFORMANCE CRITERIA

| Criterion | Current | Target | Gap |
|-----------|---------|--------|-----|
| Homepage Load | Unknown | <2 seconds | Test needed |
| API Response (p95) | Unknown | <200ms | Test needed |
| Database Queries (p95) | Unknown | <50ms | Test needed |
| Lighthouse Score | Unknown | >90 | Test needed |
| Concurrent Users | Unknown | 100 | Load test needed |
| WebSocket Latency | ~100ms | <100ms | Acceptable |

### 1.5 DEPLOYMENT CRITERIA

| Criterion | Status | Notes |
|-----------|--------|-------|
| Docker Production Config | ✅ Complete | docker-compose.yml |
| Health Check Endpoints | ✅ Complete | /health endpoint |
| Database Backups | ✅ Complete | Backup service |
| Migration Rollback | 🔧 Needed | Test and document |
| Zero-Downtime Deploy | 🔧 Needed | Strategy needed |
| Monitoring Setup | ⚠️ Partial | Sentry configured |
| Log Aggregation | 🔧 Needed | Cloud logging |
| Error Tracking | ✅ Complete | Sentry configured |

---

## PART 2: GAP ANALYSIS

### 2.1 CRITICAL GAPS (Blocks Production Launch)

#### GAP-001: Email Configuration Wizard
**Severity:** Critical  
**Current State:** SMTP credentials required in .env, silent failure if not set  
**Impact:** 80% of features require email (confirmations, resets, tickets)  
**Blocks:** Registration flow, booking confirmations, password reset  
**Depends On:** Nothing  
**Files Affected:**
- `backend/src/services/email.service.ts` (add test connection)
- `frontend/src/app/admin/settings/email/page.tsx` (new - wizard UI)
- `backend/src/modules/admin/email-config.controller.ts` (new)  
**Estimated Effort:** 8 hours

#### GAP-002: Session Timeout UI
**Severity:** Critical  
**Current State:** Session expires server-side (7 days), no frontend warning  
**Impact:** Users lose work without warning; security compliance issue  
**Blocks:** Enterprise/compliance customers  
**Depends On:** Nothing  
**Files Affected:**
- `frontend/src/components/SessionTimeoutMonitor.tsx` (new)
- `frontend/src/app/providers.tsx` (add monitor)
- `backend/src/modules/auth/auth.controller.ts` (configurable timeout)
- `backend/src/lib/services/settings.service.ts` (add session settings)  
**Estimated Effort:** 8 hours

#### GAP-003: QR Code Security Enhancement
**Severity:** High  
**Current State:** QR data is plain JSON, forgery possible  
**Impact:** Revenue loss from forged tickets  
**Blocks:** Pool module production use  
**Depends On:** Nothing  
**Files Affected:**
- `backend/src/modules/pool/pool.controller.ts` (lines 237-242)
- `backend/src/utils/qr-security.ts` (new - HMAC signing)
- `backend/src/modules/pool/pool.routes.ts` (add validation endpoint)  
**Estimated Effort:** 6 hours

#### GAP-004: Account Lockout After Failed Attempts
**Severity:** High  
**Current State:** Rate limiting exists but no progressive lockout  
**Impact:** Security vulnerability to credential stuffing  
**Blocks:** Security compliance  
**Depends On:** Nothing  
**Files Affected:**
- `backend/src/modules/auth/lockout.service.ts` (new)
- `backend/src/modules/auth/auth.controller.ts` (integrate lockout)
- `backend/src/middleware/auth.middleware.ts` (lockout check)  
**Estimated Effort:** 6 hours

#### GAP-005: Production Environment Validation
**Severity:** High  
**Current State:** Server starts even with missing config  
**Impact:** Silent failures in production  
**Blocks:** Reliable deployment  
**Depends On:** Nothing  
**Files Affected:**
- `backend/src/config/validation.ts` (new - startup checks)
- `backend/src/index.ts` (call validation on startup)  
**Estimated Effort:** 4 hours

### 2.2 FEATURE GAPS (Expected but Missing)

#### GAP-006: Booking Modification Self-Service
**Severity:** Medium  
**Business Justification:** Customers expect to change dates online  
**User Story:** As a customer, I want to modify my chalet booking dates without calling support  
**Acceptance Criteria:**
- Can change check-in/check-out dates if available
- Price difference calculated and shown
- Change fee applied per policy
- Confirmation email sent
**Files Affected:**
- `backend/src/modules/chalets/booking-modification.service.ts` (new)
- `backend/src/modules/chalets/chalet.controller.ts` (add endpoint)
- `frontend/src/app/chalets/booking/[id]/modify/page.tsx` (new)  
**Estimated Effort:** 12 hours

#### GAP-007: Cancellation Policy Engine
**Severity:** Medium  
**Business Justification:** Different properties have different policies  
**User Story:** As an admin, I want to configure refund percentages based on cancellation timing  
**Acceptance Criteria:**
- Configurable deadlines (7 days = 100%, 3 days = 50%, etc.)
- Automatic refund calculation
- Policy displayed at booking time
- Admin UI to configure policies
**Files Affected:**
- `backend/src/modules/chalets/cancellation-policy.service.ts` (new)
- `frontend/src/app/admin/settings/policies/page.tsx` (new)
- Database migration for `cancellation_policies` table  
**Estimated Effort:** 10 hours

#### GAP-008: Season Passes & Memberships
**Severity:** Medium  
**Business Justification:** Recurring revenue from loyal customers  
**User Story:** As a customer, I want to buy a 10-visit pool pass at a discount  
**Acceptance Criteria:**
- Multiple pass types (10-visit, monthly, annual)
- Visit tracking and remaining balance
- Auto-renewal option (Stripe subscription)
- Admin reporting on membership sales
**Files Affected:**
- `backend/src/modules/pool/membership.service.ts` (new)
- `backend/src/modules/pool/membership.controller.ts` (new)
- `frontend/src/app/pool/memberships/page.tsx` (new)
- Database migration for `pool_memberships`, `membership_visits`  
**Estimated Effort:** 16 hours

#### GAP-009: Table Management for Restaurant
**Severity:** Medium  
**Business Justification:** Dine-in service requires table assignment  
**User Story:** As a host, I want to assign tables to incoming guests  
**Acceptance Criteria:**
- Define table layout with capacity
- Real-time table status (available, occupied, reserved)
- Assign orders to tables
- Table turnover metrics
**Files Affected:**
- `backend/src/modules/restaurant/table.service.ts` (new)
- `backend/src/modules/restaurant/table.controller.ts` (new)
- `frontend/src/app/admin/restaurant/tables/page.tsx` (new)
- Database migration for `restaurant_tables`  
**Estimated Effort:** 12 hours

#### GAP-010: PDF Report Generation
**Severity:** Medium  
**Business Justification:** Accountants need formatted reports  
**User Story:** As an admin, I want to export revenue reports as PDF  
**Acceptance Criteria:**
- Professional formatting with logo
- Charts rendered in PDF
- Date range selection
- Email delivery option
**Files Affected:**
- `backend/src/services/pdf.service.ts` (new)
- `backend/src/modules/admin/controllers/reports.controller.ts` (add PDF export)
- `frontend/src/app/admin/reports/page.tsx` (add PDF button)  
**Estimated Effort:** 10 hours

#### GAP-011: Pool-Side Food Ordering
**Severity:** Low  
**Business Justification:** Upsell opportunity at pool  
**User Story:** As a pool guest, I want to order food delivered to my locker  
**Acceptance Criteria:**
- Order from pool area with locker/chair number
- Kitchen sees delivery location
- Delivery notification to guest
- Integration with restaurant module
**Files Affected:**
- `frontend/src/app/pool/food/page.tsx` (new)
- `backend/src/modules/restaurant/services/order.service.ts` (add delivery location)
- Database: add `delivery_location` column to `restaurant_orders`  
**Estimated Effort:** 8 hours

#### GAP-012: Visual Branding Editor
**Severity:** Medium  
**Business Justification:** White-label customization  
**User Story:** As an admin, I want to change colors and logo with live preview  
**Acceptance Criteria:**
- Logo upload with preview
- Color picker for primary/secondary colors
- Live preview before saving
- CSS variables generated dynamically
**Files Affected:**
- `frontend/src/app/admin/settings/appearance/page.tsx` (enhance)
- `backend/src/modules/admin/branding.controller.ts` (new)
- `frontend/src/app/layout.tsx` (inject CSS variables)  
**Estimated Effort:** 12 hours

#### GAP-013: Email Template Editor
**Severity:** Medium  
**Business Justification:** Customization without code changes  
**User Story:** As an admin, I want to edit booking confirmation email content  
**Acceptance Criteria:**
- WYSIWYG editor for HTML templates
- Variable placeholders ({{customer_name}}, etc.)
- Preview with sample data
- Test email functionality
**Files Affected:**
- `frontend/src/app/admin/settings/email-templates/page.tsx` (new)
- `backend/src/modules/admin/email-templates.controller.ts` (new)
- `backend/src/services/email.service.ts` (load templates from DB)  
**Estimated Effort:** 14 hours

### 2.3 POLISH GAPS (UX/Quality)

#### GAP-014: Password Strength Visual Feedback
**Current:** Backend validates, no visual indicator  
**Fix:** Add strength meter component  
**Files:** `frontend/src/components/PasswordStrengthMeter.tsx` (new)  
**Effort:** 3 hours

#### GAP-015: Skeleton Screens Audit
**Current:** Skeleton exists but not consistently used  
**Fix:** Ensure all data-loading states use skeletons  
**Files:** Multiple frontend pages  
**Effort:** 6 hours

#### GAP-016: Empty State Components
**Current:** Some pages show blank when no data  
**Fix:** Add friendly empty states with CTAs  
**Files:** All list pages  
**Effort:** 4 hours

#### GAP-017: Error Message Localization
**Current:** Some errors in English only  
**Fix:** Ensure all errors use translation keys  
**Files:** `backend/src/middleware/error-handler.ts`, translation files  
**Effort:** 4 hours

#### GAP-018: Mobile Responsiveness Audit
**Current:** Generally responsive, some issues  
**Fix:** Test and fix all breakpoints  
**Files:** Multiple CSS/layout files  
**Effort:** 8 hours

### 2.4 TECHNICAL DEBT

#### DEBT-001: Replace `any` Types
**Current:** ~15 `any` types in critical paths  
**Fix:** Replace with proper types  
**Files:** Multiple (grep search identified locations)  
**Effort:** 6 hours

#### DEBT-002: Console.log Cleanup
**Current:** Some debug logs remain  
**Fix:** Replace with logger calls  
**Files:** Multiple  
**Effort:** 2 hours

#### DEBT-003: Database Index Audit
**Current:** Basic indexes exist  
**Fix:** Add indexes for all common query patterns  
**Files:** Database migration  
**Effort:** 4 hours

#### DEBT-004: Query Optimization
**Current:** Some N+1 queries  
**Fix:** Add eager loading, optimize joins  
**Files:** Service files with Supabase queries  
**Effort:** 8 hours

#### DEBT-005: Component Refactoring
**Current:** Some large components  
**Fix:** Split into smaller, reusable pieces  
**Files:** `frontend/src/app/admin/page.tsx` (569 lines), others  
**Effort:** 8 hours

---

## PART 3: COMPREHENSIVE DEVELOPMENT PLAN

### 3.0 SPRINT OVERVIEW

| Sprint | Theme | Duration | Focus |
|--------|-------|----------|-------|
| 0 | Foundation | 1 week | Setup, specs, planning |
| 1 | Critical Blockers | 2 weeks | Auth, email, security |
| 2 | Booking Enhancements | 2 weeks | Modifications, cancellation, PDF |
| 3 | Pool Enhancements | 2 weeks | Memberships, security, zones |
| 4 | Restaurant & Admin | 2 weeks | Tables, reports, exports |
| 5 | Configuration & Polish | 2 weeks | Branding, templates, UX |
| 6 | Testing & Documentation | 2 weeks | Coverage, docs, hardening |
| 7 | Production Hardening | 1 week | Security, performance, deployment |

**Total Duration:** 14 weeks (3.5 months)

---

### SPRINT 0: Foundation & Planning
**Duration:** 1 week (40 hours)  
**Goal:** Establish development environment, create detailed specs, set up workflows

#### Tasks

**0.1 Development Environment Setup (8 hours)**
- Clone repository and verify all dependencies
- Configure local database (Supabase CLI)
- Set up Redis for caching/rate limiting
- Configure SMTP for local email testing (Mailhog)
- Document complete setup in `DEVELOPMENT_SETUP.md`

**0.2 Technical Specifications (16 hours)**
- Create database schema diagrams for new tables
- Write OpenAPI specs for new endpoints
- Design UI wireframes for new pages
- Document API contracts for modifications

**0.3 Project Setup (8 hours)**
- Configure GitHub branch protection rules
- Set up CI/CD pipeline (GitHub Actions)
- Create pull request template
- Set up automated testing on PR

**0.4 Task Breakdown (8 hours)**
- Create detailed tickets in project board
- Assign story points
- Identify dependencies
- Set sprint milestones

#### Deliverables
- ✓ Working local dev environment for all team members
- ✓ Complete technical specifications for Sprints 1-6
- ✓ CI/CD pipeline running tests on every PR
- ✓ All sprints planned with detailed tasks

---

### SPRINT 1: Critical Blockers - Authentication & Security
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprint 0  
**Goal:** Fix all critical production blockers

#### Development Tasks (64 hours)

**1.1 Email Configuration Wizard (8 hours)** - Mid-level
```
Files to Create:
- frontend/src/app/admin/settings/email/page.tsx
- backend/src/modules/admin/email-config.controller.ts
- backend/src/modules/admin/email-config.routes.ts

Files to Modify:
- backend/src/services/email.service.ts (add testConnection method)
- backend/src/modules/admin/admin.routes.ts (add email routes)

Implementation:
1. Create admin UI with SMTP host, port, user, password fields
2. Add "Test Connection" button that sends test email
3. Store encrypted credentials in site_settings
4. Show connection status indicator
5. Add SendGrid and Gmail presets

Acceptance Criteria:
✓ Admin can configure SMTP without editing .env
✓ Test email sends successfully
✓ Error messages are clear and actionable
✓ Credentials stored encrypted in database
```

**1.2 Session Timeout with UI Warning (8 hours)** - Mid-level
```
Files to Create:
- frontend/src/components/SessionTimeoutMonitor.tsx
- frontend/src/hooks/useIdleTimer.ts

Files to Modify:
- frontend/src/app/providers.tsx (add SessionTimeoutMonitor)
- backend/src/lib/services/settings.service.ts (add session settings)
- backend/src/modules/auth/auth.service.ts (configurable expiry)

Implementation:
1. Create idle detection hook (mouse, keyboard, touch events)
2. Show warning modal 2 minutes before expiry
3. Add "Stay Logged In" button to extend session
4. Add "Logout Now" button
5. Make timeout configurable per role in admin settings

Acceptance Criteria:
✓ Warning appears 2 minutes before session expires
✓ User can extend session with one click
✓ Timeout is configurable (15min - 8hr)
✓ Activity resets the timer
```

**1.3 QR Code Security with HMAC (6 hours)** - Senior
```
Files to Create:
- backend/src/utils/qr-security.ts

Files to Modify:
- backend/src/modules/pool/pool.controller.ts (lines 237-270)
- backend/src/modules/pool/pool.routes.ts (add /validate-qr endpoint)

Implementation:
1. Create HMAC signing function using crypto
2. Include timestamp in QR data
3. Generate signature: HMAC-SHA256(ticketId + sessionId + date + timestamp)
4. Validate signature on scan
5. Check timestamp is within 24 hours
6. Log all validation attempts

Acceptance Criteria:
✓ QR contains HMAC signature
✓ Forged QR codes are rejected
✓ Old QR codes (>24hr) are rejected
✓ Validation logged for audit
```

**1.4 Account Lockout System (6 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/auth/lockout.service.ts
- backend/src/modules/auth/lockout.types.ts

Files to Modify:
- backend/src/modules/auth/auth.controller.ts (login function)
- backend/src/middleware/auth.middleware.ts (add lockout check)
- backend/src/utils/cache.ts (add lockout key prefix)

Implementation:
1. Track failed login attempts per email
2. Progressive delay: 1st fail = 0s, 2nd = 2s, 3rd = 5s, 4th = 15s, 5th = 30s
3. Lock account after 5 failures for 15 minutes
4. Add CAPTCHA requirement after 3 failures
5. Send email notification on lockout
6. Admin can unlock accounts manually

Acceptance Criteria:
✓ Progressive delays work correctly
✓ Account locks after 5 failures
✓ Lockout email sent to user
✓ Admin can unlock via UI
```

**1.5 Environment Validation on Startup (4 hours)** - Mid-level
```
Files to Create:
- backend/src/config/validation.ts

Files to Modify:
- backend/src/index.ts (call validate on startup)
- backend/src/config/index.ts (export validation)

Implementation:
1. List of required environment variables
2. Check each on startup
3. Verify database connection
4. Verify Redis connection (if configured)
5. Check Stripe keys format (if configured)
6. Fail with clear error message listing missing items

Acceptance Criteria:
✓ Server fails fast with clear errors
✓ All required vars checked
✓ Database connectivity verified
✓ Optional services marked clearly
```

**1.6 2FA Mandatory for Admin Roles (4 hours)** - Mid-level
```
Files to Modify:
- backend/src/middleware/auth.middleware.ts
- backend/src/modules/auth/auth.controller.ts
- frontend/src/app/admin/layout.tsx

Implementation:
1. Check if user.role includes 'super_admin' or 'admin'
2. If yes, check if 2FA is enabled
3. If not enabled, redirect to 2FA setup page
4. Block admin access until 2FA configured
5. Show reminder on admin dashboard

Acceptance Criteria:
✓ Admins cannot access admin panel without 2FA
✓ Clear setup instructions provided
✓ Redirect to setup if not configured
```

**1.7 Password Policy Configuration (6 hours)** - Mid-level
```
Files to Create:
- frontend/src/app/admin/settings/security/page.tsx
- backend/src/modules/admin/security-settings.controller.ts

Files to Modify:
- backend/src/modules/auth/auth.service.ts (validate password against policy)
- backend/src/validation/schemas.ts (dynamic password schema)

Implementation:
1. Admin UI for password requirements
2. Configurable: min length, require uppercase, require number, require special
3. Password history (prevent reuse of last N passwords)
4. Apply validation on registration and password change

Acceptance Criteria:
✓ Admin can configure password rules
✓ Rules enforced on registration
✓ Rules enforced on password change
✓ Clear error messages
```

**1.8 Password Strength Visual Meter (4 hours)** - Junior
```
Files to Create:
- frontend/src/components/PasswordStrengthMeter.tsx

Files to Modify:
- frontend/src/app/register/page.tsx
- frontend/src/app/reset-password/[token]/page.tsx
- frontend/src/app/profile/change-password/page.tsx

Implementation:
1. Calculate strength based on length, complexity
2. Show colored bar (red/yellow/green)
3. Show strength text (Weak/Fair/Strong)
4. Show requirements checklist
5. Real-time feedback as user types

Acceptance Criteria:
✓ Meter updates as user types
✓ Requirements checklist shows what's missing
✓ Consistent across all password forms
```

**1.9 Remember Me Functionality (4 hours)** - Junior
```
Files to Modify:
- frontend/src/app/login/page.tsx
- backend/src/modules/auth/auth.service.ts
- backend/src/modules/auth/auth.controller.ts

Implementation:
1. Add "Remember me" checkbox to login form
2. If checked, set refresh token to 30 days
3. If not checked, use default 7 days
4. Store preference in session

Acceptance Criteria:
✓ Checkbox visible on login form
✓ Session extends to 30 days when checked
✓ Default remains 7 days when unchecked
```

**1.10 GDPR Cookie Consent (6 hours)** - Mid-level
```
Files to Create:
- frontend/src/components/CookieConsent.tsx
- frontend/src/store/consent-store.ts
- backend/src/modules/users/consent.controller.ts

Files to Modify:
- frontend/src/app/layout.tsx (add CookieConsent)

Implementation:
1. Banner on first visit
2. Options: Accept All, Reject Non-Essential, Customize
3. Categories: Essential, Analytics, Marketing
4. Store consent in localStorage and database
5. Respect consent for analytics loading

Acceptance Criteria:
✓ Banner appears on first visit
✓ Preferences saved correctly
✓ Analytics only load if consented
✓ Preferences editable in profile
```

**1.11 Dependency Security Audit (4 hours)** - Mid-level
```
Implementation:
1. Run npm audit on backend
2. Run npm audit on frontend
3. Update dependencies with known vulnerabilities
4. Document any that cannot be updated (breaking changes)
5. Add npm audit to CI/CD pipeline

Acceptance Criteria:
✓ Zero high/critical vulnerabilities
✓ Audit runs on every PR
✓ Documentation for unfixable issues
```

#### Testing Tasks (12 hours)
- Unit tests for lockout service
- Unit tests for QR security
- Integration test for email wizard
- E2E test for session timeout
- Security test suite for auth endpoints

#### Documentation Tasks (4 hours)
- Update API docs with new endpoints
- Document password policy configuration
- Add troubleshooting guide for email setup

#### Acceptance Criteria for Sprint 1
- ✓ Email test connection works in admin panel
- ✓ Session timeout warning appears before expiry
- ✓ QR codes pass forgery attempt tests
- ✓ Account locks after 5 failed attempts
- ✓ Server fails to start if misconfigured
- ✓ 2FA required for all admin accounts
- ✓ Password strength meter on all password forms
- ✓ Cookie consent GDPR compliant
- ✓ Zero high/critical dependency vulnerabilities

---

### SPRINT 2: Booking Module Completion
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprint 1  
**Goal:** Complete chalet booking with all commercial features

#### Development Tasks (64 hours)

**2.1 Booking Modification Service (14 hours)** - Senior
```
Files to Create:
- backend/src/modules/chalets/booking-modification.service.ts
- backend/src/modules/chalets/booking-modification.types.ts
- frontend/src/app/chalets/booking/[id]/modify/page.tsx
- frontend/src/app/chalets/booking/[id]/modify/components/DatePicker.tsx
- frontend/src/app/chalets/booking/[id]/modify/components/PriceDiff.tsx

Files to Modify:
- backend/src/modules/chalets/chalet.controller.ts (add modify endpoint)
- backend/src/modules/chalets/chalet.routes.ts (add routes)
- backend/src/services/email.service.ts (add modification confirmation template)

Implementation:
1. Check new dates availability (excluding current booking)
2. Calculate price difference (new dates - original)
3. Apply modification fee from settings
4. If new total > paid: require additional payment
5. If new total < paid: create store credit or refund
6. Update booking record with modification history
7. Send confirmation email with changes summary

Acceptance Criteria:
✓ Customer can change dates if available
✓ Price difference clearly shown
✓ Modification fee applied per policy
✓ Payment/refund handled correctly
✓ Confirmation email sent
✓ Modification history tracked
```

**2.2 Cancellation Policy Engine (10 hours)** - Senior
```
Files to Create:
- backend/src/modules/chalets/cancellation-policy.service.ts
- backend/src/modules/chalets/cancellation-policy.types.ts
- frontend/src/app/admin/settings/policies/page.tsx
- frontend/src/app/admin/settings/policies/components/PolicyEditor.tsx
- migrations/YYYYMMDD_cancellation_policies.sql

Database Schema:
CREATE TABLE cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  rules JSONB NOT NULL, -- [{days_before: 7, refund_percent: 100}, ...]
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE chalets ADD COLUMN cancellation_policy_id UUID REFERENCES cancellation_policies(id);

Implementation:
1. Admin UI to create/edit policies
2. Rules: days before check-in → refund percentage
3. Assign policy to chalets (or use default)
4. Calculate refund on cancellation request
5. Show policy at booking time
6. Process refund via Stripe

Acceptance Criteria:
✓ Multiple policies can be created
✓ Policies assignable to chalets
✓ Correct refund calculated
✓ Refund processed automatically
✓ Policy shown during booking
```

**2.3 PDF Confirmation Generation (10 hours)** - Mid-level
```
Files to Create:
- backend/src/services/pdf.service.ts
- backend/src/templates/booking-confirmation.hbs
- backend/src/templates/pool-ticket.hbs

Files to Modify:
- backend/package.json (add puppeteer or @react-pdf/renderer)
- backend/src/services/email.service.ts (attach PDF)
- backend/src/modules/chalets/chalet.controller.ts (generate PDF)
- backend/src/modules/pool/pool.controller.ts (generate PDF)

Implementation:
1. Install PDF library (puppeteer for HTML→PDF)
2. Create Handlebars templates with logo, booking details
3. Include QR code for mobile check-in
4. Generate on booking creation
5. Attach to confirmation email
6. Store in Supabase Storage
7. Provide download link in customer portal

Acceptance Criteria:
✓ PDF generated for all bookings
✓ QR code included
✓ Professional formatting
✓ Attached to email
✓ Downloadable from account
```

**2.4 Guest Preferences System (8 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/chalets/guest-preferences.service.ts
- frontend/src/app/profile/preferences/page.tsx
- migrations/YYYYMMDD_guest_preferences.sql

Database Schema:
CREATE TABLE guest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  preferences JSONB NOT NULL, -- {bed_type, floor, pillow_type, etc}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

Implementation:
1. Profile page section for preferences
2. Options: bed type, floor preference, pillow type, dietary, etc.
3. Auto-apply to new bookings
4. Show in admin booking view
5. Print on housekeeping task

Acceptance Criteria:
✓ Customers can set preferences
✓ Preferences auto-applied on booking
✓ Admin sees preferences
✓ Housekeeping task includes preferences
```

**2.5 Early Check-in / Late Checkout (8 hours)** - Mid-level
```
Files to Modify:
- backend/src/modules/chalets/chalet.controller.ts
- backend/src/validation/schemas.ts
- frontend/src/app/chalets/booking/page.tsx

Implementation:
1. Add early_checkin, late_checkout options to booking form
2. Check availability (previous/next booking)
3. Add pricing (configurable per chalet or flat fee)
4. Update booking record
5. Notify housekeeping of adjusted times
6. Show in confirmation

Acceptance Criteria:
✓ Options available during booking
✓ Availability checked automatically
✓ Correct pricing applied
✓ Housekeeping notified
✓ Confirmation shows times
```

**2.6 Multi-Room Booking Support (14 hours)** - Senior
```
Files to Create:
- backend/src/modules/chalets/group-booking.service.ts
- frontend/src/app/chalets/group-booking/page.tsx

Files to Modify:
- backend/src/modules/chalets/chalet.controller.ts
- backend/src/validation/schemas.ts

Implementation:
1. UI to select multiple chalets
2. Cross-availability check
3. Group discount (configurable percentage)
4. Single payment for all units
5. Single confirmation with all units listed
6. Linked bookings in database

Acceptance Criteria:
✓ Multiple chalets selectable
✓ All dates must be available
✓ Group discount applied
✓ Single payment processed
✓ Single confirmation email
✓ Bookings linked in DB
```

#### Testing Tasks (12 hours)
- Unit tests for modification service
- Unit tests for cancellation policy
- Integration test for PDF generation
- E2E test for complete booking modification

#### Documentation Tasks (4 hours)
- Document cancellation policy configuration
- Update API docs for modification endpoints
- Add user guide section for modifications

#### Acceptance Criteria for Sprint 2
- ✓ Customers can modify bookings self-service
- ✓ Cancellation refunds calculated per policy
- ✓ PDF confirmations attached to emails
- ✓ Guest preferences saved and applied
- ✓ Early/late checkout available and priced
- ✓ Group bookings with discount working

---

### SPRINT 3: Pool Module Enhancement
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprint 1  
**Goal:** Complete pool ticketing with memberships and security

#### Development Tasks (64 hours)

**3.1 Season Passes & Memberships (16 hours)** - Senior
```
Files to Create:
- backend/src/modules/pool/membership.service.ts
- backend/src/modules/pool/membership.controller.ts
- backend/src/modules/pool/membership.routes.ts
- frontend/src/app/pool/memberships/page.tsx
- frontend/src/app/pool/memberships/[id]/page.tsx
- frontend/src/app/admin/pool/memberships/page.tsx
- migrations/YYYYMMDD_pool_memberships.sql

Database Schema:
CREATE TABLE membership_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'visit_pack', 'time_based'
  visits_included INT, -- for visit packs
  duration_days INT, -- for time-based
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pool_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  membership_type_id UUID REFERENCES membership_types(id),
  visits_remaining INT,
  valid_from DATE NOT NULL,
  valid_until DATE,
  stripe_subscription_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE membership_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES pool_memberships(id),
  session_id UUID REFERENCES pool_sessions(id),
  used_at TIMESTAMP DEFAULT NOW()
);

Implementation:
1. Admin: Create membership types (10-visit, monthly, annual)
2. Customer: Purchase membership with Stripe
3. Stripe subscription for auto-renewal
4. Track visit usage on ticket validation
5. Email reminders before expiry
6. Admin reporting on sales

Acceptance Criteria:
✓ Multiple membership types configurable
✓ Purchase flow with Stripe
✓ Auto-renewal working
✓ Visit tracking accurate
✓ Expiry reminders sent
```

**3.2 Family Packages (6 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/pool/packages.service.ts

Files to Modify:
- backend/src/modules/pool/pool.controller.ts
- frontend/src/app/pool/tickets/page.tsx

Implementation:
1. Define package types (Family = 2 adults + 2 kids)
2. Package pricing (discount vs individual)
3. UI to select package
4. Single ticket with multiple guests
5. Validate entire group on entry

Acceptance Criteria:
✓ Family packages purchasable
✓ Correct pricing applied
✓ Single QR for group
✓ All guests validated together
```

**3.3 Per-Zone Capacity Management (10 hours)** - Senior
```
Files to Create:
- migrations/YYYYMMDD_pool_zones.sql
- backend/src/modules/pool/zone.service.ts
- frontend/src/app/admin/pool/zones/page.tsx

Database Schema:
CREATE TABLE pool_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  name_fr VARCHAR(100),
  capacity INT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE pool_tickets ADD COLUMN zone_ids UUID[] DEFAULT '{}';

Implementation:
1. Define zones (main pool, sauna, jacuzzi, kids area)
2. Set capacity per zone
3. Ticket includes zone access
4. Track occupancy per zone
5. Real-time capacity display
6. Alert when zone near capacity

Acceptance Criteria:
✓ Zones configurable in admin
✓ Per-zone capacity tracked
✓ Real-time occupancy displayed
✓ Alerts when near capacity
```

**3.4 Lost Ticket Replacement (6 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/pool/ticket-replacement.controller.ts
- frontend/src/app/pool/lost-ticket/page.tsx

Implementation:
1. Customer enters email/phone
2. Find recent valid tickets
3. Verify identity (email code or phone)
4. Reissue ticket with new QR
5. Invalidate old QR
6. Charge replacement fee (configurable)

Acceptance Criteria:
✓ Lookup by email or phone
✓ Identity verification required
✓ New QR generated
✓ Old QR invalidated
✓ Replacement fee charged
```

**3.5 Weather-Based Refund System (10 hours)** - Mid-level
```
Files to Create:
- backend/src/services/weather.service.ts
- backend/src/jobs/weather-check.job.ts
- frontend/src/app/admin/settings/weather/page.tsx

Implementation:
1. Integrate OpenWeather API
2. Check forecast for next day
3. Define closure conditions (rain, temperature)
4. Auto-cancel tickets for closure days
5. Process refunds automatically
6. Send notification to affected customers

Acceptance Criteria:
✓ Weather API integrated
✓ Closure conditions configurable
✓ Auto-refunds processed
✓ Customers notified
✓ Admin can override
```

**3.6 Pool-Side Food Ordering (10 hours)** - Mid-level
```
Files to Modify:
- frontend/src/app/pool/page.tsx (add food ordering tab)
- backend/src/modules/restaurant/services/order.service.ts
- backend/src/validation/schemas.ts
- migrations/YYYYMMDD_delivery_location.sql

Database:
ALTER TABLE restaurant_orders ADD COLUMN delivery_location JSONB;
-- { type: 'pool', locker_number: '45', chair_number: 'A12' }

Implementation:
1. Add menu browsing from pool page
2. Add delivery location field (locker/chair)
3. Kitchen sees delivery location
4. Notification when order ready
5. Delivery tracking

Acceptance Criteria:
✓ Order from pool area
✓ Location captured
✓ Kitchen sees location
✓ Customer notified
```

**3.7 Locker Assignment System (6 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/pool/locker.service.ts
- migrations/YYYYMMDD_pool_lockers.sql
- frontend/src/app/admin/pool/lockers/page.tsx

Database:
CREATE TABLE pool_lockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_number VARCHAR(10) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'available',
  assigned_ticket_id UUID REFERENCES pool_tickets(id),
  zone_id UUID REFERENCES pool_zones(id)
);

Implementation:
1. Define locker inventory
2. Auto-assign on check-in
3. Release on checkout
4. Track usage history
5. Admin management UI

Acceptance Criteria:
✓ Lockers auto-assigned
✓ Released on exit
✓ Status visible in admin
```

#### Testing Tasks (12 hours)
- Unit tests for membership service
- Integration test for weather refunds
- E2E test for membership purchase
- Load test for zone capacity

#### Documentation Tasks (4 hours)
- Document membership configuration
- Add weather API setup guide
- Update user guide with lockers

#### Acceptance Criteria for Sprint 3
- ✓ Monthly passes purchasable with auto-renew
- ✓ Family packages at discounted price
- ✓ Per-zone capacity tracked in real-time
- ✓ Lost tickets replaceable with verification
- ✓ Weather causes automatic refunds
- ✓ Food orderable from pool with delivery

---

### SPRINT 4: Restaurant & Admin Enhancements
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprint 1  
**Goal:** Complete restaurant features and admin analytics

#### Development Tasks (64 hours)

**4.1 Table Management System (12 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/restaurant/table.service.ts
- backend/src/modules/restaurant/table.controller.ts
- frontend/src/app/admin/restaurant/tables/page.tsx
- frontend/src/app/admin/restaurant/tables/components/TableLayout.tsx
- migrations/YYYYMMDD_restaurant_tables.sql

Database:
CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number VARCHAR(20) NOT NULL,
  capacity INT NOT NULL,
  location VARCHAR(50), -- 'indoor', 'outdoor', 'patio'
  status VARCHAR(20) DEFAULT 'available',
  current_order_id UUID REFERENCES restaurant_orders(id),
  position_x INT,
  position_y INT
);

Implementation:
1. Define tables with capacity and location
2. Visual floor plan editor
3. Real-time status updates (Socket.io)
4. Assign tables to dine-in orders
5. Waitlist management
6. Table turnover metrics

Acceptance Criteria:
✓ Tables configurable in admin
✓ Visual floor plan
✓ Real-time status
✓ Waitlist functional
✓ Metrics tracked
```

**4.2 Order Modification by Staff (8 hours)** - Mid-level
```
Files to Modify:
- backend/src/modules/restaurant/controllers/order.controller.ts
- backend/src/modules/restaurant/services/order.service.ts
- frontend/src/app/admin/orders/[id]/page.tsx

Implementation:
1. Add items to existing order
2. Remove items (if not yet prepared)
3. Adjust quantities
4. Void items with reason
5. Comp items with manager approval
6. Recalculate total
7. Audit trail for all changes

Acceptance Criteria:
✓ Items addable/removable
✓ Void requires reason
✓ Comp requires approval
✓ Total recalculated
✓ All changes logged
```

**4.3 Promotional Pricing Engine (10 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/restaurant/promotions.service.ts
- backend/src/modules/restaurant/promotions.controller.ts
- frontend/src/app/admin/restaurant/promotions/page.tsx
- migrations/YYYYMMDD_promotions.sql

Database:
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'happy_hour', 'daily_special', 'bogo'
  discount_percent INT,
  discount_amount DECIMAL(10,2),
  applicable_items UUID[], -- menu item IDs, empty = all
  applicable_categories UUID[],
  start_time TIME,
  end_time TIME,
  days_of_week INT[], -- 0=Sun, 1=Mon...
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true
);

Implementation:
1. Admin UI to create promotions
2. Types: percentage off, fixed amount, BOGO
3. Schedule by time of day
4. Limit to specific days
5. Auto-apply to qualifying orders
6. Show promotion on menu

Acceptance Criteria:
✓ Multiple promotion types
✓ Time-based scheduling
✓ Auto-applied to orders
✓ Visible on menu items
```

**4.4 Inventory Auto-86 Integration (6 hours)** - Mid-level
```
Files to Modify:
- backend/src/modules/restaurant/services/menu.service.ts
- backend/src/modules/restaurant/services/order.service.ts
- backend/src/lib/services/inventory.service.ts
- frontend/src/app/restaurant/page.tsx

Implementation:
1. Link menu items to inventory items
2. Deduct on order completion
3. Mark item unavailable when stock = 0
4. Real-time update to menu display
5. Low stock alerts to admin
6. Auto-unmark when restocked

Acceptance Criteria:
✓ Stock deducted on order
✓ Items auto-86'd at zero stock
✓ Menu updates in real-time
✓ Low stock alerts sent
```

**4.5 Scheduled Orders (Pre-ordering) (10 hours)** - Senior
```
Files to Create:
- backend/src/modules/restaurant/scheduled-order.service.ts
- frontend/src/app/restaurant/schedule/page.tsx
- backend/src/jobs/scheduled-order-reminder.job.ts

Implementation:
1. Select future date/time for order
2. Cut-off time validation
3. Reminder notification 2 hours before
4. Kitchen receives order at prep time
5. Calendar view for staff
6. Cancellation policy

Acceptance Criteria:
✓ Future orders placeable
✓ Reminders sent
✓ Kitchen timing correct
✓ Staff calendar view
```

**4.6 Advanced Revenue Reports (8 hours)** - Mid-level
```
Files to Modify:
- backend/src/modules/admin/controllers/reports.controller.ts
- frontend/src/app/admin/reports/page.tsx

Implementation:
1. Custom date range picker
2. Comparison mode (YoY, MoM)
3. Revenue by hour of day
4. Revenue by day of week
5. Payment method breakdown
6. Export to Excel with charts

Acceptance Criteria:
✓ Custom date ranges
✓ YoY comparison
✓ By-hour breakdown
✓ Excel export with charts
```

**4.7 Staff Performance Metrics (10 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/admin/staff-metrics.service.ts
- frontend/src/app/admin/staff/performance/page.tsx

Implementation:
1. Orders processed per staff member
2. Average order completion time
3. Customer ratings per staff
4. Revenue generated per staff
5. Leaderboard view
6. Date range filtering

Acceptance Criteria:
✓ Metrics tracked per staff
✓ Leaderboard visible
✓ Date filtering works
✓ Export available
```

#### Testing Tasks (12 hours)
- Unit tests for table service
- Unit tests for promotions
- Integration test for auto-86
- E2E test for scheduled orders

#### Documentation Tasks (4 hours)
- Document table management
- Add promotions configuration guide
- Update kitchen display guide

#### Acceptance Criteria for Sprint 4
- ✓ Tables assignable with floor plan
- ✓ Staff can modify orders with audit trail
- ✓ Happy hour prices auto-apply
- ✓ Items auto-86 when out of stock
- ✓ Pre-orders for tomorrow work
- ✓ Staff performance metrics visible

---

### SPRINT 5: Configuration System & Polish
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprints 1-4  
**Goal:** Make system fully configurable and polished

#### Development Tasks (64 hours)

**5.1 Visual Branding Editor (12 hours)** - Senior
```
Files to Create:
- frontend/src/app/admin/settings/branding/page.tsx
- backend/src/modules/admin/branding.controller.ts
- frontend/src/lib/branding.ts

Files to Modify:
- frontend/src/app/layout.tsx
- frontend/src/styles/globals.css

Implementation:
1. Logo upload with crop/resize
2. Color pickers for primary, secondary, accent
3. Font selection from Google Fonts
4. Live preview panel
5. Generate CSS variables
6. Apply dynamically on load

Acceptance Criteria:
✓ Logo changes immediately
✓ Colors update without deploy
✓ Font selection works
✓ Preview before save
```

**5.2 Email Template Editor (14 hours)** - Mid-level
```
Files to Create:
- frontend/src/app/admin/settings/email-templates/page.tsx
- frontend/src/app/admin/settings/email-templates/[id]/page.tsx
- frontend/src/components/EmailEditor.tsx
- backend/src/modules/admin/email-templates.controller.ts
- migrations/YYYYMMDD_email_templates.sql

Database:
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB, -- available variables for this template
  is_system BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

Implementation:
1. List of editable templates
2. WYSIWYG HTML editor (TipTap/Quill)
3. Variable insertion dropdown
4. Preview with sample data
5. Send test email button
6. Version history

Acceptance Criteria:
✓ Templates editable without code
✓ Variables work correctly
✓ Preview accurate
✓ Test email sends
```

**5.3 Tax Configuration System (8 hours)** - Mid-level
```
Files to Create:
- backend/src/modules/admin/tax.service.ts
- backend/src/modules/admin/tax.controller.ts
- frontend/src/app/admin/settings/tax/page.tsx
- migrations/YYYYMMDD_tax_configuration.sql

Database:
CREATE TABLE tax_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  applies_to VARCHAR(50)[], -- ['restaurant', 'pool', 'chalets']
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true
);

Implementation:
1. Admin UI to create tax rates
2. Apply to specific modules
3. Show tax breakdown in orders
4. Tax-inclusive vs exclusive pricing
5. Tax reports for accounting

Acceptance Criteria:
✓ Tax rates configurable
✓ Applied to correct modules
✓ Breakdown shown
✓ Reports accurate
```

**5.4 Dashboard Widget Customization (8 hours)** - Mid-level
```
Files to Modify:
- frontend/src/app/admin/page.tsx
- frontend/src/store/dashboard-store.ts (create)

Implementation:
1. Drag-and-drop widget arrangement
2. Widget size options (small, medium, large)
3. Show/hide specific widgets
4. Save layout per user
5. Reset to default option

Acceptance Criteria:
✓ Widgets draggable
✓ Layout persists
✓ Reset works
```

**5.5 Skeleton Screens Audit (6 hours)** - Junior
```
Files to Modify:
- All data-loading pages

Implementation:
1. Audit all pages for loading states
2. Add Skeleton components where missing
3. Ensure consistent loading UX
4. Test with slow network

Acceptance Criteria:
✓ All pages show skeletons during load
✓ Consistent appearance
```

**5.6 Empty State Components (6 hours)** - Junior
```
Files to Create:
- frontend/src/components/EmptyState.tsx

Files to Modify:
- All list/table pages

Implementation:
1. Create reusable EmptyState component
2. Custom icon, title, description, CTA
3. Add to all empty data states
4. Friendly illustrations

Acceptance Criteria:
✓ All empty states friendly
✓ CTAs guide next action
```

**5.7 Mobile Responsiveness Audit (10 hours)** - Mid-level
```
Implementation:
1. Test all pages at 320px, 768px, 1024px
2. Fix layout issues
3. Ensure touch targets 44px minimum
4. Test navigation on mobile
5. Test forms on mobile

Acceptance Criteria:
✓ Works at all breakpoints
✓ Touch targets adequate
✓ Forms usable on mobile
```

#### Testing Tasks (12 hours)
- Visual regression tests for branding
- Integration tests for email templates
- Cross-browser testing (Chrome, Firefox, Safari)

#### Documentation Tasks (4 hours)
- Document branding customization
- Add email template guide
- Update admin settings guide

#### Acceptance Criteria for Sprint 5
- ✓ Logo/colors changeable in UI
- ✓ Email templates editable with preview
- ✓ Tax configurable per module
- ✓ Dashboard widgets customizable
- ✓ All pages have proper loading states
- ✓ All empty states are friendly
- ✓ Mobile experience polished

---

### SPRINT 6: Testing & Documentation
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprints 1-5  
**Goal:** Achieve 80% test coverage, complete all documentation

#### Development Tasks (64 hours)

**6.1 Backend Unit Tests to 80% (20 hours)** - Mid-level
```
Files to Create/Modify:
- tests/unit/*.test.ts (expand existing)

Focus Areas:
1. Booking modification service
2. Cancellation policy service
3. Membership service
4. QR security utilities
5. Email template rendering
6. Tax calculation

Acceptance Criteria:
✓ Statement coverage ≥80%
✓ Branch coverage ≥70%
✓ Critical paths 100%
```

**6.2 Frontend Unit Tests (12 hours)** - Mid-level
```
Files to Create:
- frontend/tests/components/*.test.tsx
- frontend/tests/hooks/*.test.ts
- frontend/tests/utils/*.test.ts

Focus Areas:
1. Form validation components
2. Cart logic
3. Date picker logic
4. Authentication hooks
5. Price formatting utilities

Acceptance Criteria:
✓ Coverage ≥70%
✓ All hooks tested
✓ All utils tested
```

**6.3 E2E Test Suite Expansion (12 hours)** - Senior
```
Files to Create:
- tests/workflows/booking-modification.spec.ts
- tests/workflows/membership-purchase.spec.ts
- tests/workflows/admin-reports.spec.ts
- tests/workflows/email-template-edit.spec.ts

Implementation:
1. Complete booking modification flow
2. Membership purchase and usage
3. Admin report generation
4. Email template editing
5. Branding changes
6. Payment flows with test cards

Acceptance Criteria:
✓ All critical paths have E2E tests
✓ Tests run in CI/CD
✓ <10 minute execution
```

**6.4 Load Testing (8 hours)** - Senior
```
Files to Create:
- tests/load/k6-scenarios.js
- tests/load/README.md

Implementation:
1. Install k6 load testing tool
2. Create scenarios for:
   - 100 concurrent menu views
   - 50 concurrent bookings
   - 20 concurrent admin dashboards
3. Run tests and document results
4. Identify bottlenecks
5. Optimize if needed

Acceptance Criteria:
✓ System handles 100 concurrent users
✓ p95 response time <200ms
✓ No errors under load
```

**6.5 API Documentation Completion (4 hours)** - Mid-level
```
Files to Modify:
- backend/src/docs/openapi.v1.ts

Implementation:
1. Add all new endpoints
2. Add request/response examples
3. Document error codes
4. Add authentication info
5. Generate interactive docs

Acceptance Criteria:
✓ All endpoints documented
✓ Examples provided
✓ Swagger UI works
```

**6.6 Database ERD Generation (4 hours)** - Mid-level
```
Files to Create:
- docs/database/ERD.png
- docs/database/SCHEMA.md

Implementation:
1. Use dbdiagram.io or similar
2. Include all tables
3. Show relationships
4. Document columns
5. Add to docs/

Acceptance Criteria:
✓ ERD includes all tables
✓ Relationships clear
✓ Documentation complete
```

**6.7 Deployment Guide (4 hours)** - Senior
```
Files to Create:
- docs/DEPLOYMENT.md

Content:
1. Prerequisites
2. Server requirements
3. Step-by-step deployment
4. Environment variables reference
5. Database setup
6. SSL configuration
7. Monitoring setup
8. Troubleshooting

Acceptance Criteria:
✓ Complete step-by-step guide
✓ Tested on fresh server
✓ Troubleshooting section
```

#### Testing Tasks (12 hours)
- Run full test suite
- Fix flaky tests
- Optimize test execution

#### Documentation Tasks (4 hours)
- Review all documentation
- Add search functionality
- Create index/TOC

#### Acceptance Criteria for Sprint 6
- ✓ Backend coverage ≥80%
- ✓ Frontend coverage ≥70%
- ✓ All E2E tests pass
- ✓ Load test: 100 concurrent users OK
- ✓ API docs complete
- ✓ ERD created
- ✓ Deployment guide tested

---

### SPRINT 7: Production Hardening (Final)
**Duration:** 1 week (40 hours)  
**Dependencies:** Sprints 1-6  
**Goal:** Production-ready deployment

#### Development Tasks (32 hours)

**7.1 Security Penetration Testing (8 hours)** - Senior
```
Implementation:
1. Run OWASP ZAP automated scan
2. Manual testing of auth flows
3. Test for SQL injection
4. Test for XSS
5. Test for CSRF bypass
6. Fix any findings

Acceptance Criteria:
✓ Zero high/critical findings
✓ All OWASP Top 10 tested
✓ Findings documented
```

**7.2 Performance Optimization (8 hours)** - Senior
```
Implementation:
1. Database index audit
2. Query optimization (EXPLAIN ANALYZE)
3. Redis caching for hot paths
4. Frontend bundle analysis
5. Image optimization
6. Lighthouse audit

Acceptance Criteria:
✓ Lighthouse score >90
✓ Largest Contentful Paint <2s
✓ Time to Interactive <3s
```

**7.3 Monitoring & Alerting Setup (6 hours)** - Mid-level
```
Implementation:
1. Configure Sentry alerts
2. Set up uptime monitoring
3. Configure log aggregation
4. Create monitoring dashboard
5. Set alert thresholds

Acceptance Criteria:
✓ Errors alert immediately
✓ Downtime detected <1 minute
✓ Logs searchable
```

**7.4 Backup Verification (4 hours)** - Mid-level
```
Implementation:
1. Create test backup
2. Restore to separate DB
3. Verify data integrity
4. Document restore procedure
5. Test scheduled backup cron

Acceptance Criteria:
✓ Restore works perfectly
✓ Procedure documented
✓ Automated backups running
```

**7.5 Final QA Pass (6 hours)** - QA
```
Implementation:
1. Full feature walkthrough
2. Cross-browser testing
3. Mobile testing
4. Accessibility audit
5. Bug fixing

Acceptance Criteria:
✓ Zero P0/P1 bugs
✓ P2 bugs documented
✓ WCAG AA compliant
```

#### Documentation Tasks (8 hours)
- Create runbook for common issues
- Document incident response
- Create handoff package
- Final documentation review

#### Acceptance Criteria for Sprint 7
- ✓ Security scan clean
- ✓ Performance targets met
- ✓ Monitoring operational
- ✓ Backups verified
- ✓ Zero critical bugs
- ✓ Documentation complete

---

## PART 4: RESOURCE REQUIREMENTS

### 4.1 Team Composition

**Recommended Team (Optimized for 3-month timeline):**

| Role | FTE | Hourly Rate | Weekly Hours | Sprints |
|------|-----|-------------|--------------|---------|
| Senior Full-Stack Developer | 1.0 | €100/hr | 40 | 0-7 |
| Mid-Level Full-Stack Developer | 1.0 | €80/hr | 40 | 0-7 |
| Junior Developer | 0.5 | €50/hr | 20 | 1-6 |
| QA Engineer | 0.25 | €70/hr | 10 | 1-7 |

### 4.2 Cost Breakdown

| Resource | Hours | Rate | Total |
|----------|-------|------|-------|
| Senior Developer | 520h | €100/hr | €52,000 |
| Mid-Level Developer | 520h | €80/hr | €41,600 |
| Junior Developer | 200h | €50/hr | €10,000 |
| QA Engineer | 130h | €70/hr | €9,100 |
| **Total Labor** | **1,370h** | - | **€112,700** |

**Additional Costs:**
| Item | Monthly | Months | Total |
|------|---------|--------|-------|
| Cloud Hosting (staging) | €200 | 3.5 | €700 |
| Third-party APIs (dev) | €100 | 3.5 | €350 |
| Tools & Licenses | €50 | 3.5 | €175 |
| **Total Additional** | - | - | **€1,225** |

**Grand Total: €113,925**

### 4.3 Timeline Summary

| Phase | Duration | Dates |
|-------|----------|-------|
| Sprint 0 | 1 week | Jan 27 - Jan 31, 2026 |
| Sprint 1 | 2 weeks | Feb 3 - Feb 14, 2026 |
| Sprint 2 | 2 weeks | Feb 17 - Feb 28, 2026 |
| Sprint 3 | 2 weeks | Mar 3 - Mar 14, 2026 |
| Sprint 4 | 2 weeks | Mar 17 - Mar 28, 2026 |
| Sprint 5 | 2 weeks | Mar 31 - Apr 11, 2026 |
| Sprint 6 | 2 weeks | Apr 14 - Apr 25, 2026 |
| Sprint 7 | 1 week | Apr 28 - May 2, 2026 |

**Total Duration:** 14 weeks (3.5 months)

---

## PART 5: RISK MANAGEMENT

### 5.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Key developer unavailable | Medium | High | Cross-training, documentation, pair programming |
| Third-party API changes | Low | Medium | Abstract integrations, monitor changelogs, have fallbacks |
| Security vulnerability found late | Medium | Critical | Continuous security scanning, early pen testing |
| Performance issues at scale | Medium | High | Early load testing, continuous monitoring |
| Scope creep | High | High | Strict change control, product backlog |
| Integration complexity | Medium | Medium | Spike tasks, early prototyping |
| Database migration issues | Low | Critical | Extensive testing, rollback procedures |

### 5.2 Contingency Budget

Reserve 15% of budget (€17,000) for:
- Unexpected security fixes
- Performance optimization
- Third-party integration issues
- Scope clarification

---

## PART 6: SUCCESS METRICS

### 6.1 Completion Criteria

**The project is complete when ALL of the following are verified:**

#### Functionality
- [ ] All features from "100% Complete" definition implemented
- [ ] All critical bugs (P0/P1) resolved
- [ ] All P2 bugs documented with workarounds

#### Quality
- [ ] Backend test coverage ≥80%
- [ ] Frontend test coverage ≥70%
- [ ] All E2E tests passing
- [ ] Lighthouse score ≥90
- [ ] WCAG AA compliant
- [ ] Zero OWASP critical/high vulnerabilities

#### Performance
- [ ] Page load time <2 seconds (p95)
- [ ] API response time <200ms (p95)
- [ ] System handles 100 concurrent users
- [ ] Database queries <50ms (p95)

#### Documentation
- [ ] API documentation 100% complete
- [ ] Deployment guide tested on fresh server
- [ ] User manual covers all features
- [ ] Admin guide complete

#### Deployment
- [ ] Production environment configured
- [ ] Monitoring and alerting operational
- [ ] Automated backups running
- [ ] Disaster recovery tested
- [ ] SSL configured with A+ rating

### 6.2 Quality Gates

| Gate | Sprint | Criteria |
|------|--------|----------|
| Alpha | 3 | Core features work, 50% test coverage |
| Beta | 5 | All features work, 70% test coverage |
| RC1 | 6 | All tests pass, docs complete |
| GA | 7 | Zero critical bugs, pen test passed |

---

## PART 7: POST-COMPLETION PLAN

### 7.1 Handoff Package

**Deliverables:**
1. Complete source code with Git history
2. All documentation (API, ERD, deployment, user guides)
3. Test suites with instructions
4. Environment configurations
5. Access credentials (encrypted)
6. Training recordings (optional)
7. Known issues document
8. Roadmap for future enhancements

### 7.2 Recommended Post-Launch Support

**3-Month Support Package (Optional):**
- 1 Senior Developer (10 hours/week)
- Bug fixes from production usage
- Performance tuning based on real traffic
- User training sessions
- Documentation updates

**Estimated Cost:** €12,000

### 7.3 Future Enhancement Roadmap (Post V1)

**Phase 2 Candidates:**
1. Mobile app completion (iOS/Android)
2. Advanced module builder with schema generation
3. Multi-location/franchise support
4. Integration marketplace (Mailchimp, Salesforce)
5. AI-based demand forecasting
6. White-label marketplace
7. Customer mobile app
8. Staff mobile app

---

## APPENDIX A: FILE REFERENCE

### New Files to Create (65+ files)

**Backend:**
```
backend/src/config/validation.ts
backend/src/modules/admin/branding.controller.ts
backend/src/modules/admin/email-config.controller.ts
backend/src/modules/admin/email-templates.controller.ts
backend/src/modules/admin/security-settings.controller.ts
backend/src/modules/admin/staff-metrics.service.ts
backend/src/modules/admin/tax.controller.ts
backend/src/modules/admin/tax.service.ts
backend/src/modules/auth/lockout.service.ts
backend/src/modules/auth/lockout.types.ts
backend/src/modules/chalets/booking-modification.service.ts
backend/src/modules/chalets/cancellation-policy.service.ts
backend/src/modules/chalets/guest-preferences.service.ts
backend/src/modules/chalets/group-booking.service.ts
backend/src/modules/pool/locker.service.ts
backend/src/modules/pool/membership.controller.ts
backend/src/modules/pool/membership.service.ts
backend/src/modules/pool/packages.service.ts
backend/src/modules/pool/ticket-replacement.controller.ts
backend/src/modules/pool/zone.service.ts
backend/src/modules/restaurant/promotions.controller.ts
backend/src/modules/restaurant/promotions.service.ts
backend/src/modules/restaurant/scheduled-order.service.ts
backend/src/modules/restaurant/table.controller.ts
backend/src/modules/restaurant/table.service.ts
backend/src/modules/users/consent.controller.ts
backend/src/services/pdf.service.ts
backend/src/services/weather.service.ts
backend/src/templates/booking-confirmation.hbs
backend/src/templates/pool-ticket.hbs
backend/src/utils/qr-security.ts
backend/src/jobs/scheduled-order-reminder.job.ts
backend/src/jobs/weather-check.job.ts
```

**Frontend:**
```
frontend/src/app/admin/pool/lockers/page.tsx
frontend/src/app/admin/pool/memberships/page.tsx
frontend/src/app/admin/pool/zones/page.tsx
frontend/src/app/admin/restaurant/promotions/page.tsx
frontend/src/app/admin/restaurant/tables/page.tsx
frontend/src/app/admin/settings/branding/page.tsx
frontend/src/app/admin/settings/email/page.tsx
frontend/src/app/admin/settings/email-templates/page.tsx
frontend/src/app/admin/settings/policies/page.tsx
frontend/src/app/admin/settings/security/page.tsx
frontend/src/app/admin/settings/tax/page.tsx
frontend/src/app/admin/settings/weather/page.tsx
frontend/src/app/admin/staff/performance/page.tsx
frontend/src/app/chalets/booking/[id]/modify/page.tsx
frontend/src/app/chalets/group-booking/page.tsx
frontend/src/app/pool/lost-ticket/page.tsx
frontend/src/app/pool/memberships/page.tsx
frontend/src/app/profile/preferences/page.tsx
frontend/src/app/restaurant/schedule/page.tsx
frontend/src/components/CookieConsent.tsx
frontend/src/components/EmailEditor.tsx
frontend/src/components/EmptyState.tsx
frontend/src/components/PasswordStrengthMeter.tsx
frontend/src/components/SessionTimeoutMonitor.tsx
frontend/src/hooks/useIdleTimer.ts
frontend/src/lib/branding.ts
frontend/src/store/consent-store.ts
frontend/src/store/dashboard-store.ts
```

**Documentation:**
```
docs/DEPLOYMENT.md
docs/database/ERD.png
docs/database/SCHEMA.md
DEVELOPMENT_SETUP.md
```

**Tests:**
```
tests/load/k6-scenarios.js
tests/workflows/admin-reports.spec.ts
tests/workflows/booking-modification.spec.ts
tests/workflows/email-template-edit.spec.ts
tests/workflows/membership-purchase.spec.ts
```

**Migrations:**
```
migrations/YYYYMMDD_cancellation_policies.sql
migrations/YYYYMMDD_delivery_location.sql
migrations/YYYYMMDD_email_templates.sql
migrations/YYYYMMDD_guest_preferences.sql
migrations/YYYYMMDD_pool_lockers.sql
migrations/YYYYMMDD_pool_memberships.sql
migrations/YYYYMMDD_pool_zones.sql
migrations/YYYYMMDD_promotions.sql
migrations/YYYYMMDD_restaurant_tables.sql
migrations/YYYYMMDD_tax_configuration.sql
```

---

## APPENDIX B: COMPARISON WITH INITIAL ASSESSMENT

| Feature | Initial Assessment | Actual Status | Work Required |
|---------|-------------------|---------------|---------------|
| Weekend Pricing | ⚠️ Missing | ✅ Complete | None |
| GDPR Compliance | 🔧 Needed | ✅ Complete | None |
| Rate Limiting | 🔧 Needed | ✅ Complete | None |
| Backup System | 🔧 Needed | ✅ Complete | None |
| Scheduled Reports | 🔧 Needed | ✅ Complete | None |
| API Documentation | 🔧 Needed | ✅ Complete | Update only |
| Soft Delete | 🔧 Needed | ✅ Complete | None |
| Constants File | 🔧 Needed | ✅ Complete | None |
| Session Timeout UI | ⚠️ Missing | ⚠️ Missing | 8 hours |
| QR Security | ⚠️ Missing | ⚠️ Missing | 6 hours |
| Email Wizard | ⚠️ Missing | ⚠️ Missing | 8 hours |
| Booking Modification | ⚠️ Missing | ⚠️ Missing | 14 hours |
| Memberships | ⚠️ Missing | ⚠️ Missing | 16 hours |

**Key Finding:** The codebase is approximately **15-20% more complete** than initially assessed. Features like weekend pricing, GDPR compliance, backup systems, and scheduled reports already exist.

**Revised Effort Estimate:**
- Original estimate based on verification report: ~€237,000
- Revised estimate based on deep analysis: **€113,925**
- Savings from already-implemented features: **€123,075 (52%)**

---

## APPENDIX C: QUICK REFERENCE COMMANDS

```bash
# Development Setup
cd v2-resort/backend && npm install
cd v2-resort/frontend && npm install
cp .env.example .env
npm run dev

# Run Tests
cd backend && npm test
cd backend && npm run test:coverage
cd frontend && npm test
npx playwright test

# Database
npx supabase db reset
npx supabase migration up

# Build
npm run build

# Docker
docker-compose up -d
docker-compose -f docker-compose.prod.yml up -d
```

---

**Document End**

*This roadmap represents a comprehensive plan based on actual code analysis. Estimates assume senior developer proficiency. Actual time may vary based on team familiarity with the codebase.*


And here's what ive decided to add,do these as well opus.

# ROADMAP ADDENDUM: MISSING PRODUCTION-CRITICAL WORK

**Add this section after Sprint 7 in the existing roadmap**

---

## SPRINT 8: Infrastructure Resilience & Scalability
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprint 7  
**Goal:** Production-grade infrastructure that handles scale and failure

### Development Tasks (64 hours)

#### 8.1 CDN Configuration & Asset Optimization (8 hours) - Senior
```
Files to Create:
- infrastructure/cloudflare-config.yaml
- docs/CDN_SETUP.md

Files to Modify:
- next.config.js (add CDN domain)
- backend/src/config/index.ts (add ASSET_CDN_URL)

Implementation:
1. Configure Cloudflare/Vercel CDN
2. Set cache headers for static assets (1 year)
3. Set cache headers for API (vary by endpoint)
4. Configure image optimization pipeline
5. Set up cache purge automation
6. Configure geographic distribution

Acceptance Criteria:
✓ Static assets served from CDN
✓ Cache hit rate >90% after warmup
✓ Images auto-optimized on upload
✓ Cache invalidation works on deploy
```

#### 8.2 Horizontal Scaling Setup (12 hours) - Senior
```
Files to Create:
- infrastructure/load-balancer.config
- backend/src/config/session-store.ts
- docker-compose.scale.yml

Files to Modify:
- backend/src/index.ts (stateless design verification)
- backend/src/socket/index.ts (Redis adapter for Socket.io)

Implementation:
1. Configure load balancer (Nginx/AWS ALB)
2. Move sessions to Redis (not memory)
3. Configure Socket.io Redis adapter for multi-instance
4. Add health check endpoint with dependencies
5. Configure sticky sessions (if needed)
6. Test with 3 backend instances

Database:
-- Already using Supabase (handles this)
-- Verify all sessions use Redis

Acceptance Criteria:
✓ System runs with 3+ backend instances
✓ Sessions persist across instances
✓ WebSocket works across instances
✓ Load balancer health checks working
```

#### 8.3 Database Read Replicas (6 hours) - Senior
```
Files to Create:
- backend/src/config/database.ts (read replica config)
- docs/DATABASE_SCALING.md

Files to Modify:
- backend/src/lib/supabase.ts (separate read/write clients)
- All query files (use read client for SELECT)

Implementation:
1. Configure Supabase read replica (if available) or use connection pooling
2. Create separate Supabase client for read-only queries
3. Route SELECT queries to read client
4. Route INSERT/UPDATE/DELETE to write client
5. Add fallback to primary if replica fails
6. Monitor replication lag

Acceptance Criteria:
✓ Read queries use replica
✓ Write queries use primary
✓ Fallback works if replica down
✓ Replication lag monitored
```

#### 8.4 Redis Clustering for Production (6 hours) - Mid-level
```
Files to Create:
- infrastructure/redis-cluster.config
- backend/src/services/cache-cluster.service.ts

Files to Modify:
- backend/src/utils/cache.ts (use cluster client)
- docker-compose.prod.yml (Redis Cluster)

Implementation:
1. Configure Redis Cluster (3+ nodes)
2. Update cache service to use cluster client
3. Configure automatic failover
4. Set up monitoring for cluster health
5. Test failover scenarios

Acceptance Criteria:
✓ Redis survives node failure
✓ Cache operations continue
✓ Monitoring alerts on issues
```

#### 8.5 Blue-Green Deployment Strategy (8 hours) - Senior
```
Files to Create:
- scripts/deploy-blue-green.sh
- docs/DEPLOYMENT_STRATEGIES.md
- .github/workflows/blue-green-deploy.yml

Implementation:
1. Create deployment script for blue-green
2. Route traffic using load balancer weight
3. Run health checks on new version
4. Gradual traffic shift (10% → 50% → 100%)
5. Automatic rollback on errors
6. Monitoring during deployment

Acceptance Criteria:
✓ Zero-downtime deployment verified
✓ Automatic rollback works
✓ Traffic shifting gradual
✓ Database migrations safe
```

#### 8.6 SSL Auto-Renewal Automation (4 hours) - Mid-level
```
Files to Create:
- infrastructure/ssl-renewal.sh
- infrastructure/certbot-config.ini

Files to Modify:
- docker-compose.prod.yml (add certbot service)

Implementation:
1. Configure Let's Encrypt with certbot
2. Add auto-renewal cron job (runs daily)
3. Configure nginx to reload on cert update
4. Set up monitoring for cert expiry
5. Test renewal process

Acceptance Criteria:
✓ SSL auto-renews 30 days before expiry
✓ Nginx reloads automatically
✓ Monitoring alerts 14 days before expiry
✓ Backup certs stored securely
```

#### 8.7 DDoS Protection Configuration (4 hours) - Mid-level
```
Files to Create:
- infrastructure/ddos-protection.config
- docs/SECURITY_INFRASTRUCTURE.md

Implementation:
1. Enable Cloudflare DDoS protection (or AWS Shield)
2. Configure rate limiting at edge
3. Set up geo-blocking rules (if needed)
4. Configure challenge pages for suspicious traffic
5. Set up DDoS attack alerting

Acceptance Criteria:
✓ DDoS protection active
✓ Rate limiting at CDN level
✓ Attack mitigation tested
✓ Alerts configured
```

#### 8.8 Database Connection Pool Optimization (4 hours) - Senior
```
Files to Modify:
- backend/src/lib/supabase.ts
- backend/src/config/database.ts

Implementation:
1. Configure connection pool size (min/max)
2. Set connection timeout limits
3. Configure idle connection timeout
4. Add connection pool monitoring
5. Tune based on load testing

Configuration:
- Min connections: 10
- Max connections: 100
- Connection timeout: 30s
- Idle timeout: 10 minutes

Acceptance Criteria:
✓ Connection pool sized correctly
✓ No connection exhaustion under load
✓ Monitoring shows pool usage
```

#### 8.9 Circuit Breaker Pattern Implementation (6 hours) - Senior
```
Files to Create:
- backend/src/utils/circuit-breaker.ts
- backend/src/middleware/circuit-breaker.middleware.ts

Files to Modify:
- backend/src/services/email.service.ts (wrap in circuit breaker)
- backend/src/services/weather.service.ts
- backend/src/modules/payments/payment.controller.ts

Implementation:
1. Create circuit breaker utility
2. Wrap external service calls (email, weather, Stripe)
3. Configure failure thresholds (5 failures → open)
4. Configure retry timeout (30 seconds)
5. Add fallback behaviors
6. Monitor circuit state

Acceptance Criteria:
✓ Circuit opens after 5 consecutive failures
✓ Automatic retry after timeout
✓ Graceful degradation when open
✓ Circuit state monitored
```

#### 8.10 Request Correlation ID Tracking (6 hours) - Mid-level
```
Files to Create:
- backend/src/middleware/correlation-id.middleware.ts

Files to Modify:
- backend/src/index.ts (add middleware)
- backend/src/utils/logger.ts (include correlation ID)
- frontend/src/lib/api-client.ts (send correlation ID)

Implementation:
1. Generate UUID for each request
2. Add to response headers (X-Correlation-ID)
3. Include in all log messages
4. Track across service boundaries
5. Include in error reports

Acceptance Criteria:
✓ Every request has correlation ID
✓ All logs include it
✓ Can trace request through system
✓ Included in error tracking
```

### Testing Tasks (12 hours)
- Load test with multiple backend instances
- Test failover scenarios
- Test zero-downtime deployment
- Chaos engineering tests (kill random services)

### Documentation Tasks (4 hours)
- Infrastructure architecture diagram
- Scaling playbook
- Disaster recovery procedures
- Monitoring dashboard guide

### Acceptance Criteria for Sprint 8
- ✓ System runs on 3+ backend instances
- ✓ CDN serves static assets
- ✓ Zero-downtime deployment verified
- ✓ SSL auto-renews
- ✓ DDoS protection active
- ✓ Circuit breakers prevent cascading failures
- ✓ All requests traceable via correlation ID

---

## SPRINT 9: Payment & Financial Hardening
**Duration:** 1 week (40 hours)  
**Dependencies:** Sprint 1  
**Goal:** Production-ready payment handling with all edge cases

### Development Tasks (32 hours)

#### 9.1 Chargeback Handling System (6 hours) - Senior
```
Files to Create:
- backend/src/modules/payments/chargeback.service.ts
- backend/src/modules/payments/chargeback.controller.ts
- frontend/src/app/admin/payments/chargebacks/page.tsx
- migrations/YYYYMMDD_chargebacks.sql

Database:
CREATE TABLE chargebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payment_ledger(id),
  stripe_dispute_id VARCHAR(100) UNIQUE,
  amount DECIMAL(10,2),
  reason VARCHAR(100),
  status VARCHAR(20), -- 'needs_response', 'under_review', 'won', 'lost'
  evidence_submitted JSONB,
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

Implementation:
1. Handle Stripe dispute webhook
2. Create chargeback record
3. Notify admin immediately
4. UI to submit evidence
5. Track status updates
6. Update accounting on resolution

Acceptance Criteria:
✓ Disputes captured from webhooks
✓ Admin notified immediately
✓ Evidence submittable via UI
✓ Status tracked accurately
```

#### 9.2 Failed Webhook Retry System (6 hours) - Senior
```
Files to Create:
- backend/src/modules/payments/webhook-retry.service.ts
- migrations/YYYYMMDD_webhook_failures.sql

Database:
CREATE TABLE webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100),
  payload JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP,
  status VARCHAR(20), -- 'pending', 'retrying', 'resolved', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

Implementation:
1. Catch webhook processing errors
2. Store failed webhooks with payload
3. Exponential backoff retry (1min, 5min, 30min, 2hr, 24hr)
4. Manual retry button in admin
5. Alert after 5 failures
6. Reconciliation report

Acceptance Criteria:
✓ Failed webhooks stored
✓ Automatic retry with backoff
✓ Manual retry works
✓ Alerts sent after 5 failures
```

#### 9.3 Subscription Payment Failure Handling (4 hours) - Mid-level
```
Files to Modify:
- backend/src/modules/pool/membership.service.ts
- backend/src/services/email.service.ts (add payment failure template)

Implementation:
1. Handle subscription payment failure webhook
2. Email customer about failed payment
3. Retry payment after 3 days
4. Suspend membership after 7 days
5. Cancel after 14 days if still unpaid
6. Send notifications at each step

Acceptance Criteria:
✓ Failed payments trigger email
✓ Automatic retry attempted
✓ Membership suspended at 7 days
✓ Customer can update card
```

#### 9.4 Multi-Currency Support (8 hours) - Senior
```
Files to Create:
- backend/src/services/currency.service.ts
- migrations/YYYYMMDD_multi_currency.sql

Database:
CREATE TABLE currencies (
  code VARCHAR(3) PRIMARY KEY,
  symbol VARCHAR(10),
  name VARCHAR(50),
  exchange_rate DECIMAL(10,6),
  is_active BOOLEAN DEFAULT true,
  last_updated TIMESTAMP
);

ALTER TABLE site_settings ADD COLUMN default_currency VARCHAR(3) DEFAULT 'EUR';

Files to Modify:
- backend/src/modules/payments/payment.controller.ts
- frontend/src/utils/format-currency.ts
- All pricing displays

Implementation:
1. Admin configures accepted currencies
2. Exchange rates from API (or manual)
3. Store prices in default currency
4. Convert at booking time
5. Store transaction currency
6. Display in customer's chosen currency

Acceptance Criteria:
✓ Multiple currencies configurable
✓ Prices converted correctly
✓ Transaction currency stored
✓ Currency selector on frontend
```

#### 9.5 Local Payment Methods Integration (6 hours) - Senior
```
Files to Create:
- backend/src/modules/payments/local-payment.service.ts

Files to Modify:
- backend/src/modules/payments/payment.controller.ts
- frontend/src/components/PaymentMethodSelector.tsx

Implementation:
1. Configure Stripe for local methods (Tabby, Tamara for UAE)
2. Add payment method selector
3. Handle different confirmation flows
4. Add local method webhooks
5. Test with each payment method

Acceptance Criteria:
✓ Tabby/Tamara options visible
✓ Buy Now Pay Later works
✓ Webhooks handled correctly
✓ Tested with test cards
```

#### 9.6 Payment Reconciliation Dashboard (2 hours) - Mid-level
```
Files to Create:
- frontend/src/app/admin/payments/reconciliation/page.tsx

Implementation:
1. Compare Stripe dashboard vs database
2. Identify discrepancies
3. Show pending settlements
4. Export for accounting
5. Highlight failed webhooks

Acceptance Criteria:
✓ Stripe vs DB comparison
✓ Discrepancies highlighted
✓ Export to CSV
```

### Testing Tasks (6 hours)
- Test all payment failure scenarios
- Test multi-currency calculations
- Test chargeback workflow
- Integration tests for webhooks

### Documentation Tasks (2 hours)
- Document chargeback response process
- Add payment reconciliation guide

### Acceptance Criteria for Sprint 9
- ✓ Chargebacks tracked and manageable
- ✓ Failed webhooks retry automatically
- ✓ Subscription failures handled gracefully
- ✓ Multi-currency working
- ✓ Local payment methods integrated
- ✓ Payment reconciliation dashboard

---

## SPRINT 10: Email Deliverability & Communication
**Duration:** 1 week (40 hours)  
**Dependencies:** Sprint 1  
**Goal:** Emails reach inbox, not spam folder

### Development Tasks (32 hours)

#### 10.1 SPF/DKIM/DMARC Setup (4 hours) - Senior
```
Files to Create:
- docs/EMAIL_AUTHENTICATION.md
- infrastructure/dns-records.txt

Implementation:
1. Generate DKIM keys in SendGrid/email provider
2. Create DNS records for SPF, DKIM, DMARC
3. Verify DNS propagation
4. Test email authentication (mail-tester.com)
5. Monitor DMARC reports

DNS Records:
TXT @ "v=spf1 include:sendgrid.net ~all"
TXT default._domainkey "v=DKIM1; k=rsa; p=[key]"
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@domain.com"

Acceptance Criteria:
✓ SPF passes authentication
✓ DKIM passes authentication
✓ DMARC passes authentication
✓ Mail-tester.com score 10/10
```

#### 10.2 Bounce Handling System (4 hours) - Mid-level
```
Files to Create:
- backend/src/modules/notifications/bounce.service.ts
- backend/src/modules/notifications/bounce.controller.ts
- migrations/YYYYMMDD_email_bounces.sql

Database:
CREATE TABLE email_bounces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  bounce_type VARCHAR(20), -- 'hard', 'soft', 'complaint'
  reason TEXT,
  bounced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_suppression_list (
  email VARCHAR(255) PRIMARY KEY,
  reason VARCHAR(50),
  added_at TIMESTAMP DEFAULT NOW()
);

Implementation:
1. Handle SendGrid bounce webhook
2. Track bounce types (hard, soft, complaint)
3. Add to suppression list after hard bounce
4. Add to suppression list after 3 soft bounces
5. Check suppression before sending
6. Admin UI to manage suppression list

Acceptance Criteria:
✓ Bounces tracked automatically
✓ Suppression list prevents sending
✓ Admin can remove from suppression
✓ Reports on bounce rate
```

#### 10.3 Unsubscribe Mechanism (2 hours) - Junior
```
Files to Modify:
- backend/src/services/email.service.ts
- backend/src/modules/users/preferences.controller.ts
- All email templates

Database:
ALTER TABLE users ADD COLUMN email_preferences JSONB DEFAULT '{"marketing": true, "transactional": true}';

Implementation:
1. Add unsubscribe link to all marketing emails
2. Create unsubscribe landing page
3. Store email preferences per user
4. Respect preferences when sending
5. Transactional emails always send (legal requirement)

Acceptance Criteria:
✓ Unsubscribe link in all marketing emails
✓ One-click unsubscribe works
✓ Preferences respected
✓ CAN-SPAM compliant
```

#### 10.4 Email Rate Limiting (2 hours) - Mid-level
```
Files to Create:
- backend/src/services/email-rate-limiter.service.ts

Files to Modify:
- backend/src/services/email.service.ts

Implementation:
1. Limit emails per recipient (5/hour, 20/day)
2. Limit total emails sent (1000/hour with SendGrid free tier)
3. Queue excess emails
4. Monitor sending rate
5. Alert if approaching limits

Acceptance Criteria:
✓ Rate limits enforced
✓ Emails queued when over limit
✓ No spam complaints
✓ Monitoring in place
```

#### 10.5 Email Template Testing Suite (4 hours) - Mid-level
```
Files to Create:
- backend/tests/emails/*.test.ts
- tools/email-preview-server.ts

Implementation:
1. Unit tests for all email templates
2. Test with various data inputs
3. Test subject line length (<60 chars)
4. Test HTML rendering in preview tool
5. Test across email clients (Litmus or Email on Acid)

Acceptance Criteria:
✓ All templates have tests
✓ Templates render correctly
✓ Tested in Gmail, Outlook, Apple Mail
```

#### 10.6 SMS Notification Integration (8 hours) - Senior
```
Files to Create:
- backend/src/services/sms.service.ts
- backend/src/modules/notifications/sms.controller.ts
- frontend/src/app/admin/settings/sms/page.tsx

Files to Modify:
- backend/package.json (add twilio)
- backend/src/services/notification.service.ts

Implementation:
1. Install Twilio SDK
2. Admin UI for Twilio credentials
3. SMS templates (similar to email)
4. Send SMS for critical notifications (booking confirmed, ticket ready)
5. Opt-in mechanism for SMS
6. Track SMS delivery status

Acceptance Criteria:
✓ SMS sends via Twilio
✓ Templates configurable
✓ Delivery status tracked
✓ Opt-in respected
```

#### 10.7 Notification Preference Center (4 hours) - Mid-level
```
Files to Create:
- frontend/src/app/profile/notifications/page.tsx
- backend/src/modules/users/notification-preferences.controller.ts

Implementation:
1. Customer preference page
2. Options: Email (marketing, transactional), SMS, Push
3. Per-category preferences (bookings, orders, promotions)
4. Instant save
5. Respect in all notification code

Acceptance Criteria:
✓ All notification types listed
✓ Preferences saved correctly
✓ System respects preferences
✓ Transactional always sent (legal)
```

#### 10.8 Email Analytics Dashboard (4 hours) - Mid-level
```
Files to Create:
- frontend/src/app/admin/communications/analytics/page.tsx
- backend/src/modules/notifications/analytics.service.ts

Implementation:
1. Track open rates (via pixel)
2. Track click rates (via tracked links)
3. Bounce rate over time
4. Complaint rate
5. Charts and trends

Acceptance Criteria:
✓ Open/click rates tracked
✓ Trends visible
✓ Comparison by template
```

### Testing Tasks (6 hours)
- Test email deliverability across providers
- Test unsubscribe flow
- Test SMS integration
- Test rate limiting

### Documentation Tasks (2 hours)
- Email setup guide
- SMS provider setup
- Best practices for deliverability

### Acceptance Criteria for Sprint 10
- ✓ SPF/DKIM/DMARC configured
- ✓ Mail-tester.com score 10/10
- ✓ Bounces tracked and suppressed
- ✓ Unsubscribe works
- ✓ SMS integrated
- ✓ Rate limiting prevents spam flags
- ✓ Preference center functional

---

## SPRINT 11: Security Deep Dive
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprint 7  
**Goal:** Enterprise-grade security with professional pen test

### Development Tasks (48 hours)

#### 11.1 Manual Security Testing (16 hours) - Senior
```
Implementation:
1. Test horizontal privilege escalation (access other users' data)
2. Test vertical privilege escalation (customer → admin)
3. Test IDOR (Insecure Direct Object Reference)
4. Test business logic flaws (negative prices, free bookings)
5. Test API parameter tampering
6. Test mass assignment vulnerabilities
7. Test file upload security
8. Document all findings

Test Cases:
- Can customer access another's booking by changing ID?
- Can customer modify prices in checkout?
- Can staff access admin functions?
- Can upload execute code via image?

Acceptance Criteria:
✓ All tests documented
✓ All vulnerabilities fixed
✓ Re-tested after fixes
```

#### 11.2 API Security Hardening (8 hours) - Senior
```
Files to Modify:
- backend/src/middleware/auth.middleware.ts
- backend/src/middleware/validate.middleware.ts
- All controller files

Implementation:
1. Verify JWT on every protected endpoint
2. Check resource ownership (user can only access their data)
3. Validate all UUIDs before database queries
4. Add request size limits (prevent DOS)
5. Add response size limits
6. Sanitize error messages (no stack traces)

Acceptance Criteria:
✓ No endpoint accessible without proper auth
✓ No cross-user data leaks
✓ Request/response sizes limited
✓ Errors don't leak sensitive info
```

#### 11.3 Payment Flow Security Audit (4 hours) - Senior
```
Implementation:
1. Test price manipulation in checkout
2. Test quantity manipulation
3. Test discount code abuse
4. Test payment bypass attempts
5. Test refund authorization
6. Verify all prices calculated server-side

Test Cases:
- Can I change price in browser dev tools?
- Can I apply discount twice?
- Can I get refund without payment?

Acceptance Criteria:
✓ All prices server-calculated
✓ No client-side price trust
✓ Discount codes validated
✓ Refunds require original payment
```

#### 11.4 Third-Party Security Assessment (4 hours) - Senior
```
Implementation:
1. Audit all third-party dependencies
2. Check for known vulnerabilities (npm audit)
3. Update vulnerable packages
4. Remove unused dependencies
5. Pin dependency versions
6. Set up Dependabot/Snyk

Acceptance Criteria:
✓ Zero critical/high vulnerabilities
✓ All dependencies pinned
✓ Automated scanning enabled
```

#### 11.5 Secrets Management Audit (4 hours) - Senior
```
Implementation:
1. Scan code for hardcoded secrets (git-secrets)
2. Verify all secrets in environment variables
3. Ensure .env not committed
4. Rotate all API keys
5. Document secret rotation procedure

Acceptance Criteria:
✓ No secrets in code
✓ .env in .gitignore
✓ Git history clean
✓ Rotation procedure documented
```

#### 11.6 Input Sanitization Audit (6 hours) - Mid-level
```
Files to Modify:
- All files handling user input

Implementation:
1. Verify Zod validation on all inputs
2. Check for SQL injection vectors
3. Check for XSS vectors
4. Check for command injection
5. Check for path traversal
6. Add sanitization where missing

Acceptance Criteria:
✓ All inputs validated
✓ All SQL parameterized
✓ All outputs encoded
✓ No injection vectors found
```

#### 11.7 Professional Penetration Test (External - 24 hours + €4,000) - Third-party
```
Implementation:
1. Hire professional pen testing firm
2. Provide scope (all endpoints, auth flows, payments)
3. Give access to staging environment
4. Review findings report
5. Fix all high/critical issues
6. Re-test fixed issues
7. Get final clearance letter

Deliverables:
- Pen test report with findings
- Risk ratings for each issue
- Remediation recommendations
- Final clearance letter

Acceptance Criteria:
✓ Professional pen test completed
✓ All high/critical fixed
✓ Clearance letter received
```

#### 11.8 Security Headers Enhancement (2 hours) - Mid-level
```
Files to Modify:
- backend/src/middleware/security.middleware.ts

Implementation:
1. Configure Content-Security-Policy (strict)
2. Configure X-Frame-Options
3. Configure X-Content-Type-Options
4. Configure Referrer-Policy
5. Configure Permissions-Policy
6. Test with securityheaders.com

Target Headers:
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()

Acceptance Criteria:
✓ All security headers present
✓ securityheaders.com grade A
✓ No CSP violations
```

#### 11.9 Audit Log Enhancement (4 hours) - Mid-level
```
Files to Modify:
- backend/src/utils/activityLogger.ts
- All sensitive operations

Implementation:
1. Add IP address to all audit logs
2. Add user agent to logs
3. Add geo-location to logs
4. Log all admin actions
5. Log all payment operations
6. Log all data exports/deletions
7. Add tamper-proof log signature

Acceptance Criteria:
✓ All sensitive operations logged
✓ Logs include IP, user agent, geo
✓ Logs immutable
✓ Retention policy enforced
```

### Testing Tasks (24 hours)
- Automated security scanning (OWASP ZAP)
- Manual penetration testing
- Business logic testing
- Re-testing after fixes

### Documentation Tasks (8 hours)
- Security test report
- Remediation documentation
- Security best practices guide
- Incident response plan update

### Acceptance Criteria for Sprint 11
- ✓ Professional pen test passed
- ✓ Zero high/critical vulnerabilities
- ✓ All OWASP Top 10 tested
- ✓ Security headers grade A
- ✓ All sensitive operations audited
- ✓ Secret management audit passed

---

## SPRINT 12: Disaster Recovery & Operational Readiness
**Duration:** 1 week (40 hours)  
**Dependencies:** Sprint 8  
**Goal:** System ready for real-world incidents

### Development Tasks (28 hours)

#### 12.1 Disaster Recovery Drill (8 hours) - Senior
```
Files to Create:
- docs/DISASTER_RECOVERY_PLAN.md
- docs/RUNBOOKS/database-restoration.md
- docs/RUNBOOKS/complete-system-failure.md

Implementation:
1. Simulate complete database failure
2. Restore from backup to new database
3. Verify data integrity (checksum comparison)
4. Document time to recovery (RTO)
5. Measure data loss window (RPO)
6. Test with different failure scenarios

Scenarios to Test:
- Database corrupted → restore from backup
- Entire data center down → failover to backup region
- Accidental data deletion → point-in-time recovery
- Ransomware attack → restore from offline backup

Acceptance Criteria:
✓ Full recovery tested successfully
✓ RTO documented (target: <2 hours)
✓ RPO documented (target: <5 minutes)
✓ Runbooks validated
```

#### 12.2 RTO/RPO Definition & Monitoring (2 hours) - Senior
```
Files to Create:
- docs/SLA_DEFINITIONS.md

Implementation:
1. Define Recovery Time Objective (RTO)
2. Define Recovery Point Objective (RPO)
3. Document for each component
4. Add monitoring for backup freshness
5. Alert if backup older than RPO

Targets:
- Database: RTO 2 hours, RPO 5 minutes
- Application: RTO 30 minutes, RPO 0 (stateless)
- File Storage: RTO 4 hours, RPO 1 hour

Acceptance Criteria:
✓ RTO/RPO defined for all components
✓ Monitoring alerts configured
✓ Team trained on targets
```

#### 12.3 Database Failover Testing (4 hours) - Senior
```
Implementation:
1. Configure Supabase read replica as failover
2. Simulate primary database failure
3. Automatic promotion of replica
4. Verify application continues
5. Test write operations to new primary
6. Document failover procedure

Acceptance Criteria:
✓ Automatic failover works
✓ Application continues with <5min downtime
✓ Data integrity maintained
✓ Failover procedure documented
```

#### 12.4 Incident Response Runbooks (6 hours) - Senior + Mid-level
```
Files to Create:
- docs/RUNBOOKS/high-cpu-usage.md
- docs/RUNBOOKS/database-slow-queries.md
- docs/RUNBOOKS/payment-webhook-failures.md
- docs/RUNBOOKS/email-not-sending.md
- docs/RUNBOOKS/websocket-connection-issues.md
- docs/RUNBOOKS/ddos-attack.md

Structure per Runbook:
1. Symptoms
2. Diagnosis steps
3. Resolution steps
4. Rollback plan
5. Prevention measures

Acceptance Criteria:
✓ Runbook for top 10 issues
✓ Step-by-step instructions
✓ Tested by team member
```

#### 12.5 On-Call Rotation Setup (4 hours) - Mid-level
```
Files to Create:
- docs/ON_CALL_GUIDE.md
- docs/ESCALATION_POLICY.md

Implementation:
1. Set up PagerDuty or similar
2. Define on-call rotation schedule
3. Configure alert routing
4. Define escalation path
5. Set up incident severity levels
6. Document on-call procedures

Severity Levels:
- P0 (Critical): Payment down, site down → page immediately
- P1 (High): Feature broken, data loss risk → page within 30min
- P2 (Medium): Performance degraded → alert next day
- P3 (Low): Minor bug → weekly review

Acceptance Criteria:
✓ On-call rotation scheduled
✓ Alerts route correctly
✓ Escalation tested
✓ Team trained
```

#### 12.6 Communication Plan for Incidents (2 hours) - Mid-level
```
Files to Create:
- docs/INCIDENT_COMMUNICATION_PLAN.md
- frontend/src/components/StatusBanner.tsx

Implementation:
1. Status page setup (status.yoursite.com)
2. Email templates for incident notifications
3. Social media communication templates
4. Customer service scripts
5. Internal communication protocols

Templates:
- "We're investigating an issue..."
- "Issue identified, working on fix..."
- "Issue resolved, conducting analysis..."
- "Post-mortem report available..."

Acceptance Criteria:
✓ Status page configured
✓ Templates ready
✓ Communication workflow documented
```

#### 12.7 Post-Mortem Process (2 hours) - Senior
```
Files to Create:
- docs/POST_MORTEM_TEMPLATE.md
- docs/INCIDENT_REVIEW_PROCESS.md

Post-Mortem Template:
1. Incident summary
2. Timeline of events
3. Root cause analysis (5 Whys)
4. What went well
5. What went wrong
6. Action items with owners
7. Prevention measures

Acceptance Criteria:
✓ Template created
✓ Review process documented
✓ Action item tracking setup
```

### Testing Tasks (8 hours)
- Full disaster recovery drill
- Incident response simulation
- Communication plan test
- Runbook validation

### Documentation Tasks (4 hours)
- Finalize all runbooks
- Create quick reference cards
- Record training videos

### Acceptance Criteria for Sprint 12
- ✓ DR drill completed successfully
- ✓ RTO/RPO targets met
- ✓ Failover tested
- ✓ 10+ runbooks created
- ✓ On-call rotation live
- ✓ Incident communication plan ready

---

## SPRINT 13: Observability & Monitoring
**Duration:** 1 week (40 hours)  
**Dependencies:** Sprint 8  
**Goal:** Full visibility into system health and performance

### Development Tasks (32 hours)

#### 13.1 Distributed Tracing Setup (8 hours) - Senior
```
Files to Create:
- backend/src/config/tracing.ts
- backend/src/middleware/tracing.middleware.ts

Files to Modify:
- backend/src/index.ts
- backend/package.json (add @opentelemetry/api)

Implementation:
1. Install OpenTelemetry SDK
2. Configure Jaeger or Zipkin
3. Auto-instrument HTTP requests
4. Auto-instrument database queries
5. Add custom spans for business logic
6. Configure sampling rate (10% in production)

Acceptance Criteria:
✓ Every request traceable end-to-end
✓ Database queries visible in traces
✓ Slow requests identifiable
✓ Trace UI accessible
```

#### 13.2 Real User Monitoring (4 hours) - Mid-level
```
Files to Create:
- frontend/src/lib/rum.ts

Files to Modify:
- frontend/src/app/layout.tsx

Implementation:
1. Install RUM library (Sentry Performance, DataDog RUM, or Vercel Analytics)
2. Track Core Web Vitals (LCP, FID, CLS)
3. Track custom metrics (booking completion time)
4. Track user flows
5. Identify slow pages for real users

Metrics to Track:
- Largest Contentful Paint
- First Input Delay
- Cumulative Layout Shift
- Time to first booking
- Cart abandonment points

Acceptance Criteria:
✓ Real user metrics visible
✓ Core Web Vitals tracked
✓ Slow pages identified
✓ User flow visualization
```

#### 13.3 Business Metrics Dashboard (8 hours) - Mid-level
```
Files to Create:
- frontend/src/app/admin/analytics/business/page.tsx
- backend/src/modules/analytics/business-metrics.service.ts

Implementation:
1. Conversion rate tracking (visitors → bookings)
2. Cart abandonment rate
3. Average order value
4. Customer acquisition cost
5. Customer lifetime value
6. Booking cancellation rate
7. Revenue per available room (RevPAR)

Visualization:
- Funnel chart (visits → bookings)
- Trend lines over time
- Comparison periods
- Goal tracking

Acceptance Criteria:
✓ All metrics calculated correctly
✓ Updated in real-time
✓ Historical trends visible
✓ Export to CSV
```

#### 13.4 Custom Alert Configuration (4 hours) - Mid-level
```
Files to Create:
- backend/src/config/alerts.ts
- docs/ALERT_RUNBOOK.md

Implementation:
1. Configure alerting thresholds
2. Alert channels (email, Slack, PagerDuty)
3. Alert severity levels
4. Alert grouping (prevent spam)
5. Alert escalation

Alerts to Configure:
- Error rate >1% → P1 alert
- Response time p95 >500ms → P2 alert
- Failed payments >5/hour → P1 alert
- Disk space >80% → P2 alert
- Memory usage >85% → P2 alert
- Database connections >90% pool → P1 alert

Acceptance Criteria:
✓ All critical metrics alerted
✓ Alerts route to correct channels
✓ Escalation works
✓ Alert fatigue prevented
```

#### 13.5 Application Performance Monitoring (4 hours) - Senior
```
Files to Modify:
- backend/src/utils/logger.ts
- All service files

Implementation:
1. Track function execution times
2. Track database query times
3. Track external API call times
4. Identify N+1 queries
5. Profile CPU usage
6. Profile memory usage

Acceptance Criteria:
✓ Slow functions identified
✓ N+1 queries visible
✓ Performance trends tracked
✓ Optimization opportunities clear
```

#### 13.6 Log Aggregation & Search (4 hours) - Mid-level
```
Implementation:
1. Configure centralized logging (Datadog, CloudWatch, or Loki)
2. Structured logging format (JSON)
3. Log retention policies
4. Log search and filtering
5. Log-based alerts

Log Structure:
{
  "timestamp": "2026-01-24T10:00:00Z",
  "level": "error",
  "correlation_id": "abc-123",
  "user_id": "user-456",
  "message": "Payment failed",
  "error": { "code": "card_declined", "details": "..." }
}

Acceptance Criteria:
✓ All logs centralized
✓ Searchable by any field
✓ Retention policy enforced
✓ Alerts from logs working
```

### Testing Tasks (6 hours)
- Test distributed tracing
- Validate RUM data accuracy
- Test alert triggering
- Load test with monitoring

### Documentation Tasks (2 hours)
- Monitoring dashboard guide
- Alert runbook
- Observability best practices

### Acceptance Criteria for Sprint 13
- ✓ Distributed tracing operational
- ✓ Real user monitoring live
- ✓ Business metrics dashboard complete
- ✓ Custom alerts configured
- ✓ APM tracking performance
- ✓ Logs centralized and searchable

---

## SPRINT 14: Accessibility & Internationalization
**Duration:** 1 week (40 hours)  
**Dependencies:** Sprint 5  
**Goal:** WCAG AA compliant, truly international

### Development Tasks (32 hours)

#### 14.1 Screen Reader Testing & Fixes (8 hours) - Mid-level
```
Implementation:
1. Test with JAWS (Windows)
2. Test with NVDA (Windows)
3. Test with VoiceOver (Mac/iOS)
4. Test with TalkBack (Android)
5. Fix all navigation issues
6. Add ARIA labels where missing
7. Fix focus order
8. Add skip links

Focus Areas:
- Forms (labels, errors, validation)
- Modals (focus trap, announcements)
- Tables (headers, captions)
- Dynamic content (live regions)

Acceptance Criteria:
✓ All pages navigable by screen reader
✓ All forms fully accessible
✓ All interactive elements labeled
✓ Focus order logical
```

#### 14.2 Keyboard Navigation Audit (6 hours) - Mid-level
```
Implementation:
1. Test every page keyboard-only
2. Ensure all features accessible via keyboard
3. Add visible focus indicators
4. Fix focus traps
5. Add keyboard shortcuts (optional)
6. Test tab order

Checklist:
- Can navigate entire site with Tab/Shift+Tab
- Can activate all buttons with Enter/Space
- Can close modals with Escape
- Dropdowns work with arrow keys
- No focus traps

Acceptance Criteria:
✓ All features keyboard accessible
✓ Focus indicators visible
✓ Tab order logical
✓ Escape closes modals
```

#### 14.3 Focus Management in Modals (4 hours) - Mid-level
```
Files to Modify:
- All modal components

Implementation:
1. Trap focus inside modal when open
2. Return focus to trigger on close
3. Focus first interactive element on open
4. Allow Escape to close
5. Prevent background scrolling
6. Announce modal opening to screen readers

Acceptance Criteria:
✓ Focus trapped in modal
✓ Focus returns on close
✓ Keyboard navigation works
✓ Screen reader announces
```

#### 14.4 RTL Layout for Arabic (6 hours) - Mid-level
```
Files to Modify:
- frontend/src/app/layout.tsx
- frontend/src/styles/globals.css
- All component styles

Implementation:
1. Add dir="rtl" when Arabic selected
2. Flip layouts using CSS logical properties
3. Test all pages in RTL mode
4. Fix alignment issues
5. Test navigation in RTL
6. Verify forms in RTL

CSS Changes:
- margin-left → margin-inline-start
- padding-right → padding-inline-end
- text-align: left → text-align: start

Acceptance Criteria:
✓ All pages flip correctly
✓ Text reads right-to-left
✓ Icons mirrored where appropriate
✓ Forms work in RTL
```

#### 14.5 Date/Number Formatting Internationalization (4 hours) - Mid-level
```
Files to Create:
- frontend/src/utils/intl-formatters.ts

Files to Modify:
- All date displays
- All number displays
- All currency displays

Implementation:
1. Use Intl.DateTimeFormat for dates
2. Use Intl.NumberFormat for numbers
3. Use Intl.NumberFormat for currency
4. Support Arabic-Indic numerals (٠-٩)
5. Support different calendar systems

Examples:
// English: January 24, 2026
// Arabic: ٢٤ يناير ٢٠٢٦
// French: 24 janvier 2026

Acceptance Criteria:
✓ Dates formatted per locale
✓ Numbers formatted per locale
✓ Currency formatted per locale
✓ Arabic numerals display correctly
```

#### 14.6 Professional Translation Review (8 hours) - External
```
Implementation:
1. Export all AR/FR translations
2. Send to professional translator
3. Review auto-translations
4. Fix awkward phrasings
5. Verify context appropriateness
6. Update translation files

Focus Areas:
- Legal terminology (Terms, Privacy)
- Booking/payment terminology
- Error messages
- Marketing copy

Acceptance Criteria:
✓ All translations professionally reviewed
✓ No auto-translation artifacts
✓ Context-appropriate phrasing
✓ Consistent terminology
```

#### 14.7 User Testing with Disabled Users (8 hours) - External
```
Implementation:
1. Recruit 3-5 users with disabilities
2. Observe them using the system
3. Identify friction points
4. Document accessibility issues
5. Prioritize fixes
6. Re-test after fixes

User Profiles:
- Blind user with screen reader
- Low vision user with magnification
- Motor disability user (keyboard only)
- Deaf user (captions needed?)

Acceptance Criteria:
✓ User testing completed
✓ Issues documented
✓ Priority fixes completed
✓ Positive user feedback
```

### Testing Tasks (6 hours)
- Automated accessibility scan (axe, WAVE)
- Manual keyboard testing
- Screen reader testing
- RTL layout testing

### Documentation Tasks (2 hours)
- Accessibility statement page
- Internationalization guide
- Translation contribution guide

### Acceptance Criteria for Sprint 14
- ✓ WCAG AA compliant (verified)
- ✓ All pages keyboard accessible
- ✓ Screen reader tested
- ✓ RTL layout working
- ✓ All locales formatted correctly
- ✓ Professional translation review complete
- ✓ User testing passed

---

## SPRINT 15: User Acceptance Testing & Polish
**Duration:** 2 weeks (80 hours)  
**Dependencies:** Sprints 1-14  
**Goal:** Real users validate system, final polish

### UAT Phase 1: Beta User Testing (Week 1 - 40 hours)

#### 15.1 Beta User Recruitment & Onboarding (8 hours) - Mid-level
```
Implementation:
1. Recruit 5-10 beta users (resort staff/customers)
2. Create test accounts with realistic data
3. Provide training materials
4. Set up feedback channels (Slack, survey)
5. Define test scenarios

User Profiles:
- 2 resort managers (admin testing)
- 2 kitchen staff (restaurant module)
- 2 front desk staff (bookings module)
- 3 customers (end-to-end flows)

Acceptance Criteria:
✓ 8+ beta users recruited
✓ Accounts created
✓ Training completed
✓ Feedback channels ready
```

#### 15.2 UAT Test Plan Creation (6 hours) - Senior
```
Files to Create:
- docs/UAT_TEST_PLAN.md
- docs/UAT_SCENARIOS.md

Test Scenarios:
1. Customer: Browse menu, order food, track order
2. Customer: Search chalets, book 3 nights, modify booking
3. Customer: Buy pool ticket, scan QR, order food from pool
4. Kitchen Staff: Receive order, update status, mark complete
5. Front Desk: Check in guest, assign room, handle complaint
6. Admin: Generate revenue report, configure promotion, manage users

Each Scenario:
- Pre-conditions (data setup)
- Steps to perform
- Expected results
- Success criteria

Acceptance Criteria:
✓ 20+ test scenarios defined
✓ All major features covered
✓ Clear success criteria
```

#### 15.3 Feedback Collection System (4 hours) - Junior
```
Files to Create:
- frontend/src/components/FeedbackWidget.tsx
- backend/src/modules/feedback/feedback.controller.ts
- migrations/YYYYMMDD_user_feedback.sql

Database:
CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  page_url TEXT,
  feedback_type VARCHAR(20), -- 'bug', 'suggestion', 'praise'
  message TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

Implementation:
1. Floating feedback button on all pages
2. Form: type, message, screenshot
3. Auto-capture page URL, user info
4. Send to admin dashboard
5. Email notification on critical bugs

Acceptance Criteria:
✓ Feedback button visible
✓ Easy to submit feedback
✓ Admin receives notifications
✓ Screenshots attached
```

#### 15.4 UAT Execution Monitoring (16 hours) - Mid-level
```
Implementation:
1. Daily stand-ups with beta users
2. Monitor usage analytics
3. Track scenario completion rates
4. Triage incoming bugs
5. Prioritize fixes (P0/P1/P2/P3)
6. Document edge cases discovered

Daily Tasks:
- Review feedback submissions
- Categorize and assign bugs
- Answer user questions
- Update documentation based on confusion
- Track progress on scenario completion

Acceptance Criteria:
✓ Daily check-ins completed
✓ All feedback reviewed
✓ Bugs triaged within 24h
✓ P0/P1 bugs fixed within 48h
```

#### 15.5 Bug Fixing Sprint (20 hours) - Senior + Mid-level
```
Implementation:
1. Fix all P0 (critical) bugs
2. Fix all P1 (high) bugs
3. Fix P2 (medium) bugs if time allows
4. Document P3 (low) bugs for backlog
5. Re-test fixes with beta users

Typical Bugs Expected:
- Edge cases in validation
- UI/UX confusion points
- Performance issues with real data
- Mobile-specific issues
- Browser-specific issues

Acceptance Criteria:
✓ Zero P0 bugs remaining
✓ All P1 bugs fixed
✓ Fixes verified by beta users
```

### UAT Phase 2: Final Polish (Week 2 - 40 hours)

#### 15.6 UX Friction Point Resolution (12 hours) - Mid-level
```
Implementation:
1. Analyze beta user feedback for friction
2. Watch session recordings (if available)
3. Identify confusing UI elements
4. Simplify complex flows
5. Add helper text where needed
6. Improve error messages

Common Friction Points:
- Unclear form labels
- Too many steps in checkout
- Confusing navigation
- Unclear booking status
- Overwhelming admin dashboard

Acceptance Criteria:
✓ Top 10 friction points identified
✓ All addressed with UX improvements
✓ Beta users validate improvements
```

#### 15.7 Performance Optimization Based on Real Usage (8 hours) - Senior
```
Implementation:
1. Analyze real user performance data
2. Identify slowest pages
3. Optimize slow database queries
4. Add caching where beneficial
5. Optimize images
6. Reduce JavaScript bundle size

Targets from Real Data:
- Homepage: <2s load time
- Booking page: <3s load time
- Admin dashboard: <4s load time

Acceptance Criteria:
✓ All targets met
✓ No page >5s load time
✓ Lighthouse scores improved
```

#### 15.8 Mobile Experience Polish (8 hours) - Mid-level
```
Implementation:
1. Test on real devices (iOS, Android)
2. Fix touch target sizes (<44px)
3. Fix horizontal scrolling
4. Optimize mobile forms
5. Test mobile payments
6. Test mobile camera (QR scanning)

Devices to Test:
- iPhone 13/14/15
- Samsung Galaxy S22/S23
- iPad
- Various screen sizes (320px - 428px)

Acceptance Criteria:
✓ Works on all devices
✓ No horizontal scroll
✓ Touch targets adequate
✓ QR scanning works
```

#### 15.9 Content & Copywriting Review (6 hours) - Mid-level
```
Implementation:
1. Review all user-facing text
2. Fix typos and grammar
3. Improve clarity
4. Ensure consistent tone
5. Update help text
6. Improve error messages

Areas to Review:
- All form labels and placeholders
- All error messages
- All success messages
- Email subject lines and content
- Admin interface instructions

Acceptance Criteria:
✓ Zero typos
✓ Consistent tone
✓ Clear instructions
✓ Professional copy
```

#### 15.10 Final Regression Testing (12 hours) - QA
```
Implementation:
1. Run full E2E test suite
2. Manual testing of critical paths
3. Cross-browser testing
4. Cross-device testing
5. Test all integrations
6. Verify no regressions from bug fixes

Test Coverage:
- All UAT scenarios
- All payment flows
- All email flows
- All PDF generation
- All real-time features

Acceptance Criteria:
✓ All E2E tests pass
✓ All critical paths verified
✓ No regressions found
✓ All browsers/devices tested
```

### Documentation Tasks (8 hours)
- Update documentation based on UAT findings
- Create video tutorials for common tasks
- Update FAQ with beta user questions
- Finalize user manual

### Acceptance Criteria for Sprint 15
- ✓ 8+ beta users completed testing
- ✓ 90%+ scenario completion rate
- ✓ Zero P0/P1 bugs remaining
- ✓ All friction points addressed
- ✓ Performance targets met
- ✓ Mobile experience polished
- ✓ Content review complete
- ✓ Full regression test passed

---

## SPRINT 16: Pre-Launch Checklist & Handoff
**Duration:** 1 week (40 hours)  
**Dependencies:** Sprint 15  
**Goal:** Final verification before production launch

### Pre-Launch Tasks (32 hours)

#### 16.1 100-Point Launch Checklist (8 hours) - Senior
```
Files to Create:
- docs/LAUNCH_CHECKLIST.md

Checklist Categories:

INFRASTRUCTURE (20 items)
✓ Production database configured
✓ Database backups scheduled and tested
✓ Redis configured with persistence
✓ CDN configured and tested
✓ SSL certificate installed (A+ rating)
✓ DNS configured correctly
✓ Load balancer configured
✓ Health checks operational
✓ Monitoring dashboards live
✓ Alerting configured and tested
✓ Log aggregation operational
✓ Error tracking (Sentry) configured
✓ Uptime monitoring configured
✓ DDoS protection enabled
✓ Firewall rules configured
✓ Backup restore tested successfully
✓ Disaster recovery plan tested
✓ Staging environment matches production
✓ Environment variables documented
✓ Secrets rotated for production

SECURITY (15 items)
✓ Penetration test passed
✓ All high/critical vulnerabilities fixed
✓ Security headers configured (grade A)
✓ Rate limiting enabled
✓ CORS configured correctly
✓ Authentication tested thoroughly
✓ Authorization tested thoroughly
✓ Payment security verified
✓ Data encryption at rest verified
✓ HTTPS enforced (no HTTP)
✓ Session management secure
✓ CSRF protection enabled
✓ XSS protection verified
✓ SQL injection tests passed
✓ Secrets not in code

FUNCTIONALITY (25 items)
✓ All core features working
✓ All integrations tested
✓ All payment flows tested
✓ All email flows tested
✓ All SMS flows tested (if applicable)
✓ All webhooks tested
✓ Real-time features working
✓ PDF generation working
✓ Image upload working
✓ Translation working (all languages)
✓ Admin dashboard functional
✓ User dashboard functional
✓ Kitchen display working
✓ Pool QR scanning working
✓ Booking modification working
✓ Cancellation working with refunds
✓ Membership system working
✓ Promotional pricing working
✓ Table management working
✓ Inventory tracking working
✓ Guest preferences working
✓ Reports generating correctly
✓ Export functionality working
✓ Search functionality working
✓ All forms validated

PERFORMANCE (10 items)
✓ Load tested (100 concurrent users)
✓ Homepage loads <2s
✓ API responses <200ms (p95)
✓ Database queries optimized
✓ Images optimized
✓ Lighthouse score >90
✓ Bundle size optimized
✓ Caching configured
✓ CDN cache hit rate >90%
✓ No memory leaks

COMPLIANCE (10 items)
✓ GDPR compliance verified
✓ Cookie consent implemented
✓ Privacy policy published
✓ Terms of service published
✓ Data retention policies configured
✓ Right to deletion working
✓ Data export working
✓ Accessibility (WCAG AA) verified
✓ Email deliverability verified
✓ Legal review completed

DOCUMENTATION (10 items)
✓ API documentation complete
✓ Database ERD created
✓ Deployment guide tested
✓ User manual complete
✓ Admin guide complete
✓ Developer onboarding guide
✓ Runbooks for common issues
✓ Incident response plan
✓ Disaster recovery plan
✓ All README files updated

THIRD-PARTY SERVICES (10 items)
✓ Supabase production project configured
✓ Stripe production keys configured
✓ SendGrid/SMTP production configured
✓ Twilio production configured (if using SMS)
✓ Weather API production key (if using)
✓ Translation API production key (if using)
✓ CDN production account
✓ Monitoring service production account
✓ All webhooks configured with production URLs
✓ All API keys rotated for production

Acceptance Criteria:
✓ 100/100 items checked
✓ All team members reviewed
✓ Sign-off from technical lead
```

#### 16.2 Production Environment Setup (8 hours) - Senior
```
Implementation:
1. Provision production servers/services
2. Configure production database
3. Set up production Redis
4. Configure production CDN
5. Install SSL certificate
6. Configure environment variables
7. Set up monitoring and alerting
8. Test production deployment

Acceptance Criteria:
✓ Production environment ready
✓ All services operational
✓ Test deployment successful
✓ Monitoring functional
```

#### 16.3 Data Migration Strategy (4 hours) - Senior
```
Files to Create:
- scripts/production-data-migration.sql
- docs/DATA_MIGRATION_PLAN.md

Implementation:
1. Document current data state
2. Plan migration sequence
3. Create migration scripts
4. Test on production-like data
5. Plan rollback strategy
6. Schedule migration window

Acceptance Criteria:
✓ Migration tested on staging
✓ Rollback plan documented
✓ Migration window scheduled
✓ Team trained on procedure
```

#### 16.4 Launch Day Runbook (4 hours) - Senior
```
Files to Create:
- docs/LAUNCH_DAY_RUNBOOK.md

Content:
1. Pre-launch checklist (final verification)
2. Launch sequence (step-by-step)
3. Post-launch monitoring (first 24h)
4. Rollback procedure (if needed)
5. Communication plan
6. Team assignments

Timeline:
T-24h: Final verification
T-4h: Team briefing
T-1h: Final systems check
T-0: Launch
T+1h: First health check
T+4h: Extended monitoring
T+24h: Launch retrospective

Acceptance Criteria:
✓ Runbook complete and clear
✓ All team members reviewed
✓ Rollback plan tested
✓ Communication templates ready
```

#### 16.5 Training Sessions (12 hours) - Mid-level
```
Implementation:
1. Admin user training (4 hours)
2. Kitchen staff training (2 hours)
3. Front desk staff training (2 hours)
4. Pool staff training (2 hours)
5. Record training sessions
6. Create training materials

Training Topics:
- System overview
- Role-specific features
- Common workflows
- Troubleshooting
- How to get support

Acceptance Criteria:
✓ All staff trained
✓ Training recorded
✓ Materials provided
✓ Questions answered
```

#### 16.6 Handoff Package Creation (8 hours) - Senior
```
Files to Create:
- HANDOFF_PACKAGE.md
- handoff/source-code.zip
- handoff/documentation.zip
- handoff/credentials.encrypted
- handoff/training-videos/

Contents:
1. Complete source code (Git repository)
2. All documentation (API, ERD, guides)
3. Access credentials (encrypted)
4. Server details and access
5. Third-party account details
6. Training videos
7. Known issues document
8. Future enhancement roadmap
9. Support contact information
10. License information

Acceptance Criteria:
✓ All materials included
✓ Documentation complete
✓ Credentials provided securely
✓ Handoff meeting scheduled
```

### Testing Tasks (6 hours)
- Final smoke test on production
- Final security scan
- Final performance test
- Final accessibility audit

### Documentation Tasks (2 hours)
- Final documentation review
- Update README with launch date
- Create release notes

### Acceptance Criteria for Sprint 16
- ✓ 100-point checklist complete
- ✓ Production environment ready
- ✓ Data migration tested
- ✓ Launch runbook finalized
- ✓ All staff trained
- ✓ Handoff package complete
- ✓ Ready for launch

---

### What This Completes

With these additions, the system will be:

✅ **Infrastructure:** Production-grade scalability, CDN, load balancing, failover
✅ **Payments:** All edge cases, multi-currency, local methods, chargeback handling
✅ **Email:** Inbox delivery guaranteed, bounce handling, unsubscribe compliance
✅ **Security:** Professional pen test, all OWASP Top 10, security headers grade A
✅ **Reliability:** Disaster recovery tested, incident response ready, 99.9% uptime capable
✅ **Observability:** Full tracing, RUM, business metrics, comprehensive alerting
✅ **Accessibility:** WCAG AA compliant, screen reader tested, keyboard accessible
✅ **International:** RTL working, proper date/number formatting, professional translations
✅ **User-Validated:** Real users tested, friction removed, bugs fixed
✅ **Launch-Ready:** 100-point checklist, runbooks, trained staff, handoff complete

---


BUILD LOCALLY TO CHECK EVERYTHING WORKS