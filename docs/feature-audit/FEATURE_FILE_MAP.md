# V2 Resort — Feature-to-File Map

**Generated:** 2026-02-08
**Purpose:** Reverse index mapping source files → Feature IDs

---

## Frontend Files → Features

### Pages (app/ directory)

| Frontend Path | Feature IDs |
|--------------|-------------|
| `app/page.tsx` | CUS-HOME-001 → 012 |
| `app/login/page.tsx` | CUS-AUTH-001 → 007 |
| `app/register/page.tsx` | CUS-AUTH-008, CUS-AUTH-009 |
| `app/forgot-password/page.tsx` | CUS-AUTH-010 |
| `app/reset-password/page.tsx` | CUS-AUTH-011 |
| `app/restaurant/page.tsx` | CUS-REST-001 → 013 |
| `app/restaurant/cart/page.tsx` | CUS-REST-014 → 025 |
| `app/restaurant/confirmation/page.tsx` | CUS-REST-026, CUS-REST-027 |
| `app/restaurant/reserve/page.tsx` | CUS-REST-028, CUS-REST-029 |
| `app/restaurant/waitlist/page.tsx` | CUS-REST-030, CUS-REST-031 |
| `app/chalets/page.tsx` | CUS-CHAL-001 → 003 |
| `app/chalets/[id]/page.tsx` | CUS-CHAL-004 → 013 |
| `app/chalets/booking-confirmation/page.tsx` | CUS-CHAL-014 |
| `app/pool/page.tsx` | CUS-POOL-001 → 005 |
| `app/pool/confirmation/page.tsx` | CUS-POOL-006, CUS-POOL-007 |
| `app/snack-bar/page.tsx` | CUS-SNCK-001 → 004 |
| `app/snack-bar/cart/page.tsx` | CUS-SNCK-005 → 008 |
| `app/snack-bar/confirmation/page.tsx` | CUS-SNCK-009 |
| `app/giftcards/page.tsx` | CUS-GFT-001 → 006 |
| `app/account/giftcards/page.tsx` | CUS-GFT-007, CUS-GFT-008 |
| `app/account/loyalty/page.tsx` | CUS-LOY-001 → 006 |
| `app/profile/page.tsx` | CUS-ACCT-001 → 004, CUS-CHAL-015 → 017, CUS-POOL-008 → 009 |
| `app/order/page.tsx` | CUS-ACCT-005 → 007 |
| `app/cancellation/page.tsx` | CUS-ACCT-008 |
| `app/account/privacy/page.tsx` | CUS-GDPR-001 → 006 |
| `app/[slug]/page.tsx` | CUS-MOD-001 → 003 |
| `app/[slug]/cart/page.tsx` | CUS-MOD-004, CUS-MOD-005 |
| `app/[slug]/confirmation/page.tsx` | CUS-MOD-006 |
| `app/contact/page.tsx` | CUS-STATIC-001 |
| `app/privacy/page.tsx` | CUS-STATIC-002 |
| `app/terms/page.tsx` | CUS-STATIC-003 |
| `app/offline/page.tsx` | CUS-STATIC-004 |
| `app/cart/page.tsx` | CUS-CART-001 → 005 |
| `app/kiosk/page.tsx` | KSK-001 → 012 |
| `app/staff/layout.tsx` | STF-NAV-001 → 009 |
| `app/staff/page.tsx` | STF-DASH-001 → 006 |
| `app/staff/restaurant/page.tsx` | STF-REST-001 → 006 |
| `app/staff/chalets/page.tsx` | STF-CHAL-001 → 011 |
| `app/staff/pool/page.tsx` | STF-POOL-001 → 008, STF-POOL-011 |
| `app/staff/pool/components/MaintenanceTab.tsx` | STF-POOL-009, STF-POOL-010 |
| `app/staff/snack/page.tsx` | STF-SNCK-001 → 007 |
| `app/staff/bookings/page.tsx` | STF-BOOK-001 → 005 |
| `app/staff/customers/page.tsx` | STF-CUST-001 → 004 |
| `app/staff/scanner/page.tsx` | STF-SCAN-001 → 005 |
| `app/staff/modules/[slug]/*` | STF-MOD-001 → 008 |
| `app/staff/manager/page.tsx` | MGR-DASH-001 → 008, MGR-APPR-001 → 003, MGR-STAFF-001 → 002, MGR-RPT-001 → 004 |
| `app/admin/page.tsx` | ADM-DASH-001 → 008 |
| `app/admin/orders/page.tsx` | ADM-ORD-001 → 007 |
| `app/admin/[slug]/categories/page.tsx` | ADM-REST-001 → 004 |
| `app/admin/[slug]/menu/page.tsx` | ADM-REST-005 → 009 |
| `app/admin/[slug]/modifiers/page.tsx` | ADM-REST-010 → 012 |
| `app/admin/[slug]/tables/page.tsx` | ADM-REST-013 |
| `app/admin/[slug]/reservations/page.tsx` | ADM-REST-014 |
| `app/admin/[slug]/waitlist/page.tsx` | ADM-REST-015 |
| `app/admin/[slug]/orders/page.tsx` | ADM-REST-016 |
| `app/admin/[slug]/bookings/page.tsx` | ADM-CHAL-001 |
| `app/admin/[slug]/pricing/page.tsx` | ADM-CHAL-002 |
| `app/admin/[slug]/addons/page.tsx` | ADM-CHAL-003 |
| `app/admin/[slug]/sessions/page.tsx` | ADM-POOL-001 |
| `app/admin/[slug]/tickets/page.tsx` | ADM-POOL-002 |
| `app/admin/[slug]/capacity/page.tsx` | ADM-POOL-003 |
| `app/admin/inventory/page.tsx` | ADM-INV-001 → 011 |
| `app/admin/housekeeping/page.tsx` | ADM-HSK-001 → 006 |
| `app/admin/users/page.tsx` | ADM-USR-001 |
| `app/admin/users/customers/page.tsx` | ADM-USR-002 |
| `app/admin/users/staff/page.tsx` | ADM-USR-003 |
| `app/admin/users/admins/page.tsx` | ADM-USR-004 |
| `app/admin/users/create/page.tsx` | ADM-USR-005 |
| `app/admin/users/[id]/page.tsx` | ADM-USR-006 → 008 |
| `app/admin/users/roles/page.tsx` | ADM-USR-009, ADM-USR-010 |
| `app/admin/users/live/page.tsx` | ADM-USR-011 |
| `app/admin/loyalty/page.tsx` | ADM-LOY-001 → 005 |
| `app/admin/giftcards/page.tsx` | ADM-GFT-001 → 005 |
| `app/admin/coupons/page.tsx` | ADM-CPN-001 → 006 |
| `app/admin/reviews/page.tsx` | ADM-REV-001 → 004 |
| `app/admin/modules/page.tsx` | ADM-MOD-001 → 005 |
| `app/admin/modules/builder/[id]/page.tsx` | ADM-MOD-006 → 010 |
| `app/admin/reports/page.tsx` | ADM-RPT-001, ADM-RPT-003 → 005, ADM-RPT-007 |
| `app/admin/reports/analytics/page.tsx` | ADM-RPT-002 |
| `app/admin/reports/scheduled/page.tsx` | ADM-RPT-006, ADM-RPT-008 |
| `app/admin/settings/page.tsx` | ADM-SET-001 |
| `app/admin/settings/appearance/page.tsx` | ADM-SET-002 |
| `app/admin/settings/navbar/page.tsx` | ADM-SET-003 |
| `app/admin/settings/homepage/page.tsx` | ADM-SET-004 |
| `app/admin/settings/footer/page.tsx` | ADM-SET-005 |
| `app/admin/settings/translations/page.tsx` | ADM-SET-006 |
| `app/admin/settings/payments/page.tsx` | ADM-SET-007 |
| `app/admin/settings/tax/page.tsx` | ADM-SET-008 |
| `app/admin/settings/notifications/page.tsx` | ADM-SET-009 |
| `app/admin/settings/backups/page.tsx` | ADM-SET-010, ADM-SET-011 |
| `app/admin/integrations/quickbooks/page.tsx` | ADM-SET-012 |
| `app/admin/channels/page.tsx` | ADM-CHN-001 → 006 |
| `app/admin/audit/page.tsx` | ADM-AUD-001, ADM-AUD-002 |
| `app/admin/properties/page.tsx` | ADM-AUD-003 |
| `app/admin/customizations/page.tsx` | ADM-CUST-001 → 004 |
| `app/admin/terminology/page.tsx` | ADM-TERM-001 → 003 |
| `app/admin/kiosk/page.tsx` | ADM-KSK-001, ADM-KSK-002 |
| `app/[slug]/admin/settings/branding/page.tsx` | ADM-MSET-001 |
| `app/[slug]/admin/settings/email/page.tsx` | ADM-MSET-002 |
| `app/[slug]/admin/settings/pricing/page.tsx` | ADM-MSET-003, ADM-MSET-004 |

### Shared Components → Features

| Component Path | Feature IDs |
|---------------|-------------|
| `components/Header.tsx` | CUS-NAV-001 → 008 |
| `components/CookieConsentBanner.tsx` | CUS-NAV-009 → 012 |
| `components/LiveChatWidget.tsx` | CUS-NAV-013 |
| `components/Wishlist.tsx` | CUS-NAV-014, CUS-NAV-015 |
| `components/WeatherWidget.tsx` | CUS-HOME-005 |
| `components/InteractiveResortMap.tsx` | CUS-HOME-011 |
| `components/PasswordStrengthMeter.tsx` | CUS-AUTH-009 |
| `components/SessionTimeoutMonitor.tsx` | CUS-AUTH-012 |
| `components/restaurant/ModifierSelectionModal.tsx` | CUS-REST-008 → 010 |
| `components/customization/CustomizationSelector.tsx` | CUS-REST-011, CUS-REST-012 |
| `components/customer/CouponInput.tsx` | CUS-REST-017 |
| `components/chalets/AvailabilityCalendar.tsx` | CUS-CHAL-006 |
| `components/BookingModificationModal.tsx` | CUS-CHAL-017 |
| `components/payments/StripePayment.tsx` | CUS-REST-023 |
| `components/CurrencySwitcher.tsx` | CUS-SET-001 |
| `components/LanguageSwitcher.tsx` | CUS-SET-002 |
| `components/ThemeToggle.tsx` | CUS-SET-003 |
| `components/settings/UserPreferencesModal.tsx` | CUS-SET-004 |
| `components/staff/KitchenView.tsx` | STF-MOD-001, STF-MOD-002 |
| `components/staff/SessionAccessDashboard.tsx` | STF-MOD-003 |
| `components/module-builder/ComponentToolbar.tsx` | ADM-MOD-007 |
| `components/module-builder/PropertyPanel.tsx` | ADM-MOD-008 |
| `components/module-builder/SortableBlock.tsx` | ADM-MOD-009 |
| `components/module-builder/BuilderCanvas.tsx` | ADM-MOD-010 |
| `components/kiosk/KioskIdentifyStep.tsx` | KSK-003 |
| `components/kiosk/KioskConfirmStep.tsx` | KSK-004 |
| `components/kiosk/KioskProcessingSteps.tsx` | KSK-009 |

### System Components → Features

| Component Path | Feature IDs |
|---------------|-------------|
| `components/ThemeInjector.tsx` | SYS-THEME-001, SYS-THEME-003 |
| `components/ThemeProvider.tsx` | SYS-THEME-002 |
| `components/DirectionSync.tsx` | SYS-I18N-002 |
| `components/providers/TranslationProvider.tsx` | SYS-I18N-003 |
| `components/ui/TranslatedText.tsx` | SYS-I18N-004 |

---

## Backend Files → Features

### Backend Modules (backend/src/modules/)

| Backend Module | Feature IDs |
|---------------|-------------|
| `modules/auth/` | SYS-AUTH-001 → 007, CUS-AUTH-001 → 012 |
| `modules/restaurant/` | CUS-REST-*, STF-REST-*, ADM-REST-*, ADM-ORD-* |
| `modules/chalets/` | CUS-CHAL-*, STF-CHAL-*, STF-BOOK-*, ADM-CHAL-* |
| `modules/pool/` | CUS-POOL-*, STF-POOL-*, STF-SCAN-*, ADM-POOL-* |
| `modules/snack/` | CUS-SNCK-*, STF-SNCK-* |
| `modules/giftcards/` | CUS-GFT-*, ADM-GFT-* |
| `modules/loyalty/` | CUS-LOY-*, ADM-LOY-* |
| `modules/coupons/` | ADM-CPN-* |
| `modules/reviews/` | CUS-ACCT-009, ADM-REV-* |
| `modules/inventory/` | ADM-INV-* |
| `modules/housekeeping/` | ADM-HSK-* |
| `modules/users/` | ADM-USR-* |
| `modules/modules/` | ADM-MOD-*, CUS-MOD-*, STF-MOD-* |
| `modules/reports/` | ADM-RPT-*, MGR-RPT-* |
| `modules/notifications/` | ADM-NOTIF-* |
| `modules/settings/` | ADM-SET-* |
| `modules/channels/` | ADM-CHN-* |
| `modules/audit/` | ADM-AUD-* |
| `modules/payments/` | SYS-PAY-* |
| `modules/gdpr/` | CUS-GDPR-* |
| `modules/kiosk/` | KSK-*, ADM-KSK-* |
| `modules/customization/` | ADM-CUST-*, CUS-REST-011 → 012 |
| `modules/terminology/` | ADM-TERM-* |
| `modules/multi-property/` | ADM-AUD-003 |
| `modules/pricing/` | ADM-MSET-003, ADM-MSET-004 |

### Middleware → Features

| Middleware | Feature IDs |
|-----------|-------------|
| `middleware/auth.middleware.ts` | SYS-AUTH-006 |
| `middleware/permission.middleware.ts` | SYS-AUTH-007 |
| `middleware/rateLimit.middleware.ts` | SYS-SEC-001, SYS-SEC-002 |
| `middleware/csrf.middleware.ts` | SYS-SEC-003 |
| `middleware/sanitize.middleware.ts` | SYS-SEC-004 |

### Services → Features

| Service | Feature IDs |
|---------|-------------|
| `services/scheduler.service.ts` | SYS-JOBS-001 → 005, SYS-RT-002 |
| `socket/index.ts` | SYS-RT-001 → 006 |
| `services/sentry.service.ts` | SYS-SEC-005 |
| `services/tracing.service.ts` | SYS-SEC-006 |

---

## Quick Stats

- **Frontend pages** mapping to features: 93
- **Shared components** mapping to features: 27
- **Backend modules** mapping to features: 25
- **Total source file → feature mappings**: ~145 unique paths
