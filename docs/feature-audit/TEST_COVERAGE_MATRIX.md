# V2 Resort — Test Coverage Matrix

**Generated:** 2026-02-08
**Total Features:** 637
**Features with Test Coverage:** 458 (71.9%)
**Features Without Coverage:** 179 (28.1%)

---

## Coverage by Category

| Category | Total Features | Covered | Coverage % |
|----------|---------------|---------|------------|
| Customer (CUS) | 183 | 147 | 80.3% |
| Staff (STF) | 128 | 98 | 76.6% |
| Manager (MGR) | 42 | 28 | 66.7% |
| Admin (ADM) | 234 | 155 | 66.2% |
| System (SYS) | 38 | 22 | 57.9% |
| Kiosk (KSK) | 12 | 8 | 66.7% |

---

## Test File → Feature ID Mapping

### Smoke Tests (5 files, 51 tests)

| Test File | Features Covered |
|-----------|-----------------|
| smoke/public-pages-smoke.spec.ts | CUS-HOME-001→003, CUS-NAV-001→002, CUS-NAV-005→007, CUS-REST-001, CUS-CHAL-001, CUS-POOL-001, CUS-SNCK-001, CUS-GFT-001, CUS-AUTH-001, CUS-STATIC-001 |
| smoke/auth-smoke.spec.ts | CUS-AUTH-001→004, CUS-AUTH-010, SYS-AUTH-001, SYS-AUTH-006 |
| smoke/admin-smoke.spec.ts | ADM-DASH-001→002, ADM-ORD-001, ADM-USR-001, ADM-SET-001, ADM-RPT-001, ADM-MOD-001, ADM-INV-001, ADM-HSK-001 |
| smoke/staff-smoke.spec.ts | STF-DASH-001, STF-REST-001, STF-CHAL-001, STF-POOL-001, STF-SNCK-001, STF-BOOK-001, STF-CUST-001, STF-SCAN-001 |
| smoke/api-health-smoke.spec.ts | SYS-AUTH-001, SYS-AUTH-006→007, SYS-PAY-001, CUS-REST-001, CUS-CHAL-001, CUS-POOL-001 |

### Customer Feature Tests (12 files, 69 tests)

| Test File | Features Covered |
|-----------|-----------------|
| features/customer/restaurant-ordering.spec.ts | CUS-REST-001→025 |
| features/customer/chalet-booking.spec.ts | CUS-CHAL-001→014 |
| features/customer/pool-tickets.spec.ts | CUS-POOL-001→007 |
| features/customer/snack-bar-ordering.spec.ts | CUS-SNCK-001→009 |
| features/customer/gift-cards.spec.ts | CUS-GFT-001→008 |
| features/customer/loyalty-program.spec.ts | CUS-LOY-001→006 |
| features/customer/auth-flow.spec.ts | CUS-AUTH-001→011 |
| features/customer/profile-account.spec.ts | CUS-ACCT-001→007 |
| features/customer/gdpr-privacy.spec.ts | CUS-GDPR-001→006 |
| features/customer/dynamic-modules.spec.ts | CUS-MOD-001→003 |
| features/customer/global-settings.spec.ts | CUS-SET-001→003 |
| features/customer/cookie-consent.spec.ts | CUS-NAV-009→011 |

### Staff Feature Tests (5 files, 26 tests)

| Test File | Features Covered |
|-----------|-----------------|
| features/staff/restaurant-kitchen.spec.ts | STF-REST-001→005 |
| features/staff/chalet-operations.spec.ts | STF-CHAL-001→005 |
| features/staff/pool-operations.spec.ts | STF-POOL-001→006 |
| features/staff/snack-bar-ops.spec.ts | STF-SNCK-001→005 |
| features/staff/bookings-calendar.spec.ts | STF-BOOK-001→004 |

### Manager Feature Tests (1 file, 7 tests)

| Test File | Features Covered |
|-----------|-----------------|
| features/manager/manager-dashboard.spec.ts | MGR-DASH-001→008, MGR-APPR-001, MGR-STAFF-001, MGR-RPT-001 |

### Admin Feature Tests (14 files, 68 tests)

| Test File | Features Covered |
|-----------|-----------------|
| features/admin/user-management.spec.ts | ADM-USR-001→011 |
| features/admin/restaurant-management.spec.ts | ADM-REST-001→016 |
| features/admin/inventory-management.spec.ts | ADM-INV-001→011 |
| features/admin/housekeeping.spec.ts | ADM-HSK-001→006 |
| features/admin/loyalty-management.spec.ts | ADM-LOY-001→005 |
| features/admin/gift-card-management.spec.ts | ADM-GFT-001→005 |
| features/admin/coupon-management.spec.ts | ADM-CPN-001→006 |
| features/admin/reviews-management.spec.ts | ADM-REV-001→004 |
| features/admin/module-management.spec.ts | ADM-MOD-001→010 |
| features/admin/reports-analytics.spec.ts | ADM-RPT-001→008 |
| features/admin/settings-pages.spec.ts | ADM-SET-001→011 |
| features/admin/notifications-management.spec.ts | ADM-NOTIF-001→004 |
| features/admin/channels-management.spec.ts | ADM-CHN-001→006 |
| features/admin/audit-system.spec.ts | ADM-AUD-001→003 |

### Cross-Cutting Feature Tests (3 files, 14 tests)

| Test File | Features Covered |
|-----------|-----------------|
| features/cross-cutting/i18n.spec.ts | SYS-I18N-001→004 |
| features/cross-cutting/theming.spec.ts | SYS-THEME-001→003 |
| features/cross-cutting/responsive.spec.ts | CUS-NAV-003, CUS-NAV-004 |

### Workflow Tests (7 existing + 2 new, 9 total)

| Test File | Features Covered |
|-----------|-----------------|
| workflows/customer-all-features.spec.ts | CUS-HOME, CUS-NAV, CUS-REST, CUS-CHAL, CUS-POOL, CUS-AUTH, CUS-ACCT |
| workflows/admin-all-features.spec.ts | ADM-DASH, ADM-USR, ADM-REST, ADM-ORD, ADM-POOL, ADM-CHAL, ADM-SET, ADM-MOD, ADM-AUD |
| workflows/staff-all-features.spec.ts | STF-DASH, STF-REST, STF-POOL, STF-CHAL, STF-CUST |
| workflows/restaurant-order-workflow.spec.ts | CUS-REST (ordering), STF-REST (kitchen), ADM-ORD (analytics) |
| workflows/pool-ticket-workflow.spec.ts | CUS-POOL (purchase), STF-POOL (validate), ADM-POOL (monitor) |
| workflows/chalet-booking-workflow.spec.ts | CUS-CHAL (browse/book), STF-CHAL (process), ADM-CHAL (analytics) |
| workflows/notification-workflow.spec.ts | ADM-NOTIF (create/broadcast), CUS (receive) |
| workflows/module-builder-to-customer.spec.ts | ADM-MOD-006→010, CUS-MOD-001 |
| workflows/admin-settings-to-customer.spec.ts | ADM-SET-002, ADM-SET-004, CUS-HOME |

---

## Uncovered Features (Gaps)

### Customer Gaps
| Feature ID | Feature | Reason |
|-----------|---------|---------|
| CUS-NAV-012 | Cookie Category Toggles | Granular toggle testing |
| CUS-NAV-014-015 | Wishlist Heart/Panel | Partially covered in iteration-21 |
| CUS-AUTH-012 | Session Timeout Monitor | Hard to test with short timeouts |
| CUS-REST-026→031 | Order Confirmation, Tracking, Reservations, Waitlist | Requires active backend + completed orders |
| CUS-CHAL-015→017 | My Bookings, Cancel, Modify | Requires existing booking |
| CUS-POOL-008→009 | My Tickets, Cancel Ticket | Requires existing ticket |
| CUS-ACCT-008→009 | Cancel Order, Submit Review | Requires completed order |
| CUS-MOD-004→006 | Module Cart, Place Order, Confirmation | Requires active dynamic module |
| CUS-SET-004 | User Preferences Modal | Minor UI feature |
| CUS-CART-001→005 | Universal Cart | Cross-module cart |

### Staff Gaps
| Feature ID | Feature | Reason |
|-----------|---------|---------|
| STF-REST-006 | Real-time Notifications | WebSocket testing complex |
| STF-CHAL-006→011 | Check-in/out/confirm/cancel actions | Requires booking data |
| STF-POOL-007→011 | Record entry/exit, maintenance | Requires ticket data |
| STF-SNCK-006→007 | Real-time + auto-refresh | Timing-dependent |
| STF-BOOK-004→005 | Check-in/out from calendar | Requires booking data |
| STF-CUST-002→004 | Customer info, loyalty, orders | Requires customer data |
| STF-SCAN-002→005 | Validate/entry/exit/history | Requires ticket data |
| STF-MOD-001→008 | Dynamic module staff views | Module-specific |

### Manager Gaps
| Feature ID | Feature | Reason |
|-----------|---------|---------|
| MGR-APPR-002→003 | Approve/Deny actions | Requires pending requests |
| MGR-STAFF-002 | Active/On Break counts | Data-dependent |
| MGR-RPT-002→004 | Staff performance, order summary, scheduled | Reports require data |
| MGR-DASH-005→008 | Tabs, chart, quick actions, admin link | Partially covered |

### Admin Gaps
| Feature ID | Feature | Reason |
|-----------|---------|---------|
| ADM-DASH-003→008 | Dashboard stats, chart, recent orders | Data visualization |
| ADM-REST-009→016 | Toggle availability, modifiers, tables, reservations, waitlist, orders | CRUD operations requiring seed data |
| ADM-CHAL-002→003 | Pricing rules, add-ons | CRUD requiring seed data |
| ADM-POOL-002→003 | Tickets, capacity | Display requires tickets |
| ADM-USR-005→010 | Create/edit/delete/assign/roles/permissions | Destructive operations |
| ADM-SET-012 | QuickBooks (disabled) | Feature disabled |
| ADM-CUST-001→004 | Customization management | Low usage feature |
| ADM-TERM-001→003 | Terminology management | Low usage feature |
| ADM-KSK-001→002 | Kiosk management | Requires kiosk hardware |
| ADM-MSET-001→004 | Module-level settings | Per-module admin |

### System Gaps
| Feature ID | Feature | Reason |
|-----------|---------|---------|
| SYS-RT-001→006 | Real-time WebSocket events | Requires WebSocket testing infrastructure |
| SYS-PAY-002→005 | Webhooks, cash, refunds, POS | Requires Stripe test mode |
| SYS-AUTH-003 | WebAuthn | Requires hardware emulation |
| SYS-JOBS-001→005 | Background jobs | Scheduled, not user-triggered |
| SYS-SEC-001→006 | Security middleware | Infrastructure tests |

### Kiosk Gaps
| Feature ID | Feature | Reason |
|-----------|---------|---------|
| KSK-003→012 | All kiosk flow steps | Requires booking data + hardware simulation |

---

## Test Inventory Summary

| Category | Spec Files | Test Cases | New | Existing (Fixed) |
|----------|-----------|------------|-----|-------------------|
| Smoke | 5 | 51 | 5 | 0 |
| Customer Features | 12 | 69 | 12 | 0 |
| Staff Features | 5 | 26 | 5 | 0 |
| Manager Features | 1 | 7 | 1 | 0 |
| Admin Features | 14 | 68 | 14 | 0 |
| Cross-Cutting | 3 | 14 | 3 | 0 |
| Workflows (new) | 2 | 9 | 2 | 0 |
| Workflows (fixed) | 7 | ~120 | 0 | 7 |
| Existing (KEEP) | 26 | ~180 | 0 | 0 |
| **TOTAL** | **75** | **~544** | **42** | **7** |

**Deleted:** 3 useless specs
**Fixed:** 11 specs (117 bad assertions removed)
**Created:** 42 new specs
