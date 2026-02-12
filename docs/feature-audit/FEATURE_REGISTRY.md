# V2 Resort — Complete Feature Registry

**Generated:** 2026-02-08
**Total Features:** 637 (micro-level)
**Granularity:** Every distinct user action, form, display, and control

---

## Summary by Category

| Category | Code | Feature Count |
|----------|------|---------------|
| Customer | CUS | 183 |
| Staff | STF | 128 |
| Manager | MGR | 42 |
| Admin | ADM | 234 |
| System / Cross-cutting | SYS | 38 |
| Kiosk | KSK | 12 |
| **Total** | | **637** |

---

## Feature ID Format

`{CATEGORY}-{MODULE}-{NNN}`

**Categories:** CUS (Customer), STF (Staff), MGR (Manager), ADM (Admin), SYS (System), KSK (Kiosk)

**Modules:** AUTH, REST, CHAL, POOL, SNCK, GFT, LOY, CPN, BOOK, PAY, INV, HSK, MOD, SET, USR, RPT, REV, NOTIF, MKT, MSG, I18N, GDPR, CHN, POS, CUST, NAV, HOME, CART, PROMO, AUD, TERM

---

## A. CUSTOMER FEATURES (CUS-*) — 183 Features

### A1. Homepage & Navigation (CUS-HOME / CUS-NAV)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-HOME-001 | Hero Carousel Auto-Rotate | / | Display | app/page.tsx | GET /settings (homepage) | ✅ |
| CUS-HOME-002 | Hero Carousel Dot Navigation | / | Navigation | app/page.tsx | - | ✅ |
| CUS-HOME-003 | Hero Primary CTA Button | / | Navigation | app/page.tsx | - | ✅ |
| CUS-HOME-004 | Hero Secondary CTA Button | / | Navigation | app/page.tsx | - | ✅ |
| CUS-HOME-005 | Weather Widget Display | / | Display | components/WeatherWidget.tsx | GET /weather | ✅ |
| CUS-HOME-006 | Dynamic Service Cards Grid | / | Navigation | app/page.tsx | GET /modules | ✅ |
| CUS-HOME-007 | Animated Stats Row | / | Display | app/page.tsx | - | ✅ |
| CUS-HOME-008 | Features Section | / | Display | app/page.tsx | - | ✅ |
| CUS-HOME-009 | Testimonials Carousel | / | Display | app/page.tsx | - | ✅ |
| CUS-HOME-010 | Bottom CTA Section | / | Navigation | app/page.tsx | - | ✅ |
| CUS-HOME-011 | Interactive Resort Map | / | Interactive | components/InteractiveResortMap.tsx | - | ✅ |
| CUS-HOME-012 | Scroll Indicator | / | Display | app/page.tsx | - | ✅ |
| CUS-NAV-001 | Logo / Home Link | Global | Navigation | components/Header.tsx | - | ✅ |
| CUS-NAV-002 | Desktop Navigation Bar | Global | Navigation | components/Header.tsx | GET /modules | ✅ |
| CUS-NAV-003 | Mobile Hamburger Menu | Global | Navigation | components/Header.tsx | - | ✅ |
| CUS-NAV-004 | Mobile Navigation Drawer | Global | Navigation | components/Header.tsx | - | ✅ |
| CUS-NAV-005 | Cart Icon with Badge | Global | Navigation | components/Header.tsx | - | ✅ |
| CUS-NAV-006 | Sign In Button | Global | Navigation | components/Header.tsx | - | ✅ |
| CUS-NAV-007 | Register Button | Global | Navigation | components/Header.tsx | - | ✅ |
| CUS-NAV-008 | Profile Link | Global | Navigation | components/Header.tsx | - | ✅ |
| CUS-NAV-009 | Cookie Banner — Accept All | Global | Action | components/CookieConsentBanner.tsx | - | ✅ |
| CUS-NAV-010 | Cookie Banner — Reject Non-Essential | Global | Action | components/CookieConsentBanner.tsx | - | ✅ |
| CUS-NAV-011 | Cookie Preferences Modal | Global | Modal | components/CookieConsentBanner.tsx | - | ✅ |
| CUS-NAV-012 | Cookie Category Toggles | Global | Toggle | components/CookieConsentBanner.tsx | - | ✅ |
| CUS-NAV-013 | Live Chat / Contact Widget | Global | Form | components/LiveChatWidget.tsx | POST /support/contact | ✅ |
| CUS-NAV-014 | Wishlist Heart Toggle | Various | Action | components/Wishlist.tsx | - | ✅ |
| CUS-NAV-015 | Wishlist Panel | Various | Display | components/Wishlist.tsx | - | ✅ |

### A2. Authentication (CUS-AUTH)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-AUTH-001 | Email/Password Login | /login | Form | app/login/page.tsx | POST /auth/login | ✅ |
| CUS-AUTH-002 | Show/Hide Password Toggle | /login | Toggle | app/login/page.tsx | - | ✅ |
| CUS-AUTH-003 | Forgot Password Link | /login | Navigation | app/login/page.tsx | - | ✅ |
| CUS-AUTH-004 | Google OAuth Login | /login | Action | app/login/page.tsx | GET /auth/google | ✅ |
| CUS-AUTH-005 | Facebook OAuth Login | /login | Action | app/login/page.tsx | GET /auth/facebook | ✅ |
| CUS-AUTH-006 | Apple OAuth Login | /login | Action | app/login/page.tsx | GET /auth/apple | ✅ |
| CUS-AUTH-007 | 2FA Code Verification | /login | Form | app/login/page.tsx | POST /auth/2fa/verify | ✅ |
| CUS-AUTH-008 | Register Account | /register | Form | app/register/page.tsx | POST /auth/register | ✅ |
| CUS-AUTH-009 | Password Strength Meter | /register | Display | components/PasswordStrengthMeter.tsx | - | ✅ |
| CUS-AUTH-010 | Forgot Password Request | /forgot-password | Form | app/forgot-password/page.tsx | POST /auth/forgot-password | ✅ |
| CUS-AUTH-011 | Reset Password | /reset-password | Form | app/reset-password/page.tsx | POST /auth/reset-password | ✅ |
| CUS-AUTH-012 | Session Timeout Monitor | Global | Action | components/SessionTimeoutMonitor.tsx | - | ✅ |

### A3. Restaurant (CUS-REST)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-REST-001 | Browse Menu Categories | /restaurant | Display | app/restaurant/page.tsx | GET /restaurant/menu/categories | ✅ |
| CUS-REST-002 | Filter by Category | /restaurant | Filter | app/restaurant/page.tsx | - | ✅ |
| CUS-REST-003 | Search Menu Items | /restaurant | Filter | app/restaurant/page.tsx | - | ✅ |
| CUS-REST-004 | View Menu Item Card | /restaurant | Display | app/restaurant/page.tsx | GET /restaurant/menu/items | ✅ |
| CUS-REST-005 | View Featured Items | /restaurant | Display | app/restaurant/page.tsx | GET /restaurant/menu/featured | ✅ |
| CUS-REST-006 | Dietary Filter Tags | /restaurant | Filter | app/restaurant/page.tsx | - | ✅ |
| CUS-REST-007 | Add Item to Cart | /restaurant | Action | app/restaurant/page.tsx | - | ✅ |
| CUS-REST-008 | Open Modifier Selection Modal | /restaurant | Modal | components/restaurant/ModifierSelectionModal.tsx | GET /restaurant/menu/items/:id/modifiers | ✅ |
| CUS-REST-009 | Select Required Modifiers | /restaurant | Form | components/restaurant/ModifierSelectionModal.tsx | - | ✅ |
| CUS-REST-010 | Select Optional Modifiers | /restaurant | Form | components/restaurant/ModifierSelectionModal.tsx | - | ✅ |
| CUS-REST-011 | Open Customization Selector | /restaurant | Modal | components/customization/CustomizationSelector.tsx | GET /customizations/entity/:id/public | ✅ |
| CUS-REST-012 | Select Customization Options | /restaurant | Form | components/customization/CustomizationSelector.tsx | - | ✅ |
| CUS-REST-013 | Adjust Item Quantity | /restaurant | Action | app/restaurant/page.tsx | - | ✅ |
| CUS-REST-014 | View Cart Page | /restaurant/cart | Display | app/restaurant/cart/page.tsx | - | ✅ |
| CUS-REST-015 | Update Cart Item Quantity | /restaurant/cart | Action | app/restaurant/cart/page.tsx | - | ✅ |
| CUS-REST-016 | Remove Cart Item | /restaurant/cart | Action | app/restaurant/cart/page.tsx | - | ✅ |
| CUS-REST-017 | Apply Coupon Code | /restaurant/cart | Form | components/customer/CouponInput.tsx | POST /coupons/validate | ✅ |
| CUS-REST-018 | Apply Gift Card | /restaurant/cart | Form | app/restaurant/cart/page.tsx | POST /giftcards/redeem | ✅ |
| CUS-REST-019 | Apply Loyalty Points | /restaurant/cart | Action | app/restaurant/cart/page.tsx | POST /loyalty/redeem | ✅ |
| CUS-REST-020 | Select Order Type (dine-in/takeaway/delivery) | /restaurant/cart | Form | app/restaurant/cart/page.tsx | - | ✅ |
| CUS-REST-021 | Enter Table Number | /restaurant/cart | Form | app/restaurant/cart/page.tsx | - | ✅ |
| CUS-REST-022 | Enter Special Instructions | /restaurant/cart | Form | app/restaurant/cart/page.tsx | - | ✅ |
| CUS-REST-023 | Stripe Card Payment | /restaurant/cart | Form | components/payments/StripePayment.tsx | POST /payments/create-intent | ✅ |
| CUS-REST-024 | Cash Payment Option | /restaurant/cart | Action | app/restaurant/cart/page.tsx | POST /payments/record-cash | ✅ |
| CUS-REST-025 | Place Order | /restaurant/cart | Action | app/restaurant/cart/page.tsx | POST /restaurant/orders | ✅ |
| CUS-REST-026 | Order Confirmation Display | /restaurant/confirmation | Display | app/restaurant/confirmation/page.tsx | - | ✅ |
| CUS-REST-027 | Track Order Status (real-time) | /restaurant/confirmation | Display | app/restaurant/confirmation/page.tsx | GET /restaurant/orders/:id/status | ✅ |
| CUS-REST-028 | Make Table Reservation | /restaurant/reserve | Form | app/restaurant/reserve/page.tsx | POST /restaurant/reservations | ✅ |
| CUS-REST-029 | Check Reservation Availability | /restaurant/reserve | Action | app/restaurant/reserve/page.tsx | GET /restaurant/reservations/availability | ✅ |
| CUS-REST-030 | Join Waitlist | /restaurant/waitlist | Form | app/restaurant/waitlist/page.tsx | POST /restaurant/waitlist/join | ✅ |
| CUS-REST-031 | View Waitlist Position | /restaurant/waitlist | Display | app/restaurant/waitlist/page.tsx | GET /restaurant/waitlist/:id | ✅ |

### A4. Chalets (CUS-CHAL)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-CHAL-001 | Browse Chalet Listings | /chalets | Display | app/chalets/page.tsx | GET /chalets | ✅ |
| CUS-CHAL-002 | Filter by Date Range | /chalets | Filter | app/chalets/page.tsx | - | ✅ |
| CUS-CHAL-003 | Filter by Guest Count | /chalets | Filter | app/chalets/page.tsx | - | ✅ |
| CUS-CHAL-004 | View Chalet Detail | /chalets/[id] | Display | app/chalets/[id]/page.tsx | GET /chalets/:id | ✅ |
| CUS-CHAL-005 | View Chalet Image Gallery | /chalets/[id] | Display | app/chalets/[id]/page.tsx | - | ✅ |
| CUS-CHAL-006 | Check Availability Calendar | /chalets/[id] | Interactive | components/chalets/AvailabilityCalendar.tsx | GET /chalets/:id/availability | ✅ |
| CUS-CHAL-007 | Select Booking Dates | /chalets/[id] | Form | app/chalets/[id]/page.tsx | - | ✅ |
| CUS-CHAL-008 | Set Guest Count | /chalets/[id] | Form | app/chalets/[id]/page.tsx | - | ✅ |
| CUS-CHAL-009 | Select Add-Ons | /chalets/[id] | Form | app/chalets/[id]/page.tsx | GET /chalets/add-ons | ✅ |
| CUS-CHAL-010 | View Price Breakdown | /chalets/[id] | Display | app/chalets/[id]/page.tsx | - | ✅ |
| CUS-CHAL-011 | Enter Special Requests | /chalets/[id] | Form | app/chalets/[id]/page.tsx | - | ✅ |
| CUS-CHAL-012 | Proceed to Payment | /chalets/[id] | Action | app/chalets/[id]/page.tsx | - | ✅ |
| CUS-CHAL-013 | Complete Booking Payment | /chalets/[id] | Form | app/chalets/[id]/page.tsx | POST /chalets/bookings | ✅ |
| CUS-CHAL-014 | Booking Confirmation Display | /chalets/booking-confirmation | Display | app/chalets/booking-confirmation/page.tsx | - | ✅ |
| CUS-CHAL-015 | View My Bookings | /profile | Display | app/profile/page.tsx | GET /chalets/my-bookings | ✅ |
| CUS-CHAL-016 | Cancel Booking | /profile | Action | app/profile/page.tsx | POST /chalets/bookings/:id/cancel | ✅ |
| CUS-CHAL-017 | Modify Booking (BookingModificationModal) | /profile | Modal | components/BookingModificationModal.tsx | PUT /bookings/chalets/:id/dates | ✅ |

### A5. Pool (CUS-POOL)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-POOL-001 | View Pool Sessions | /pool | Display | app/pool/page.tsx | GET /pool/sessions | ✅ |
| CUS-POOL-002 | Check Session Availability | /pool | Display | app/pool/page.tsx | GET /pool/availability | ✅ |
| CUS-POOL-003 | Select Ticket Type (adult/child/family/vip) | /pool | Form | app/pool/page.tsx | - | ✅ |
| CUS-POOL-004 | Select Guest Count | /pool | Form | app/pool/page.tsx | - | ✅ |
| CUS-POOL-005 | Purchase Pool Ticket | /pool | Action | app/pool/page.tsx | POST /pool/tickets | ✅ |
| CUS-POOL-006 | View Ticket QR Code | /pool/confirmation | Display | app/pool/confirmation/page.tsx | - | ✅ |
| CUS-POOL-007 | Pool Ticket Confirmation | /pool/confirmation | Display | app/pool/confirmation/page.tsx | - | ✅ |
| CUS-POOL-008 | View My Tickets | /profile | Display | app/profile/page.tsx | GET /pool/my-tickets | ✅ |
| CUS-POOL-009 | Cancel Pool Ticket | /profile | Action | app/profile/page.tsx | DELETE /pool/tickets/:id | ✅ |

### A6. Snack Bar (CUS-SNCK)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-SNCK-001 | Browse Snack Categories | /snack-bar | Display | app/snack-bar/page.tsx | GET /snack/categories | ✅ |
| CUS-SNCK-002 | Browse Snack Items | /snack-bar | Display | app/snack-bar/page.tsx | GET /snack/items | ✅ |
| CUS-SNCK-003 | Filter by Category | /snack-bar | Filter | app/snack-bar/page.tsx | - | ✅ |
| CUS-SNCK-004 | Add to Cart | /snack-bar | Action | app/snack-bar/page.tsx | - | ✅ |
| CUS-SNCK-005 | View Cart | /snack-bar/cart | Display | app/snack-bar/cart/page.tsx | - | ✅ |
| CUS-SNCK-006 | Update Cart Quantities | /snack-bar/cart | Action | app/snack-bar/cart/page.tsx | - | ✅ |
| CUS-SNCK-007 | Remove Cart Items | /snack-bar/cart | Action | app/snack-bar/cart/page.tsx | - | ✅ |
| CUS-SNCK-008 | Place Snack Order | /snack-bar/cart | Action | app/snack-bar/cart/page.tsx | POST /snack/orders | ✅ |
| CUS-SNCK-009 | Order Confirmation | /snack-bar/confirmation | Display | app/snack-bar/confirmation/page.tsx | - | ✅ |

### A7. Gift Cards (CUS-GFT)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-GFT-001 | Browse Gift Card Templates | /giftcards | Display | app/giftcards/page.tsx | GET /giftcards/templates | ✅ |
| CUS-GFT-002 | Select Gift Card Amount | /giftcards | Form | app/giftcards/page.tsx | - | ✅ |
| CUS-GFT-003 | Enter Custom Amount | /giftcards | Form | app/giftcards/page.tsx | - | ✅ |
| CUS-GFT-004 | Enter Recipient Details | /giftcards | Form | app/giftcards/page.tsx | - | ✅ |
| CUS-GFT-005 | Enter Personal Message | /giftcards | Form | app/giftcards/page.tsx | - | ✅ |
| CUS-GFT-006 | Purchase Gift Card | /giftcards | Action | app/giftcards/page.tsx | POST /giftcards/purchase | ✅ |
| CUS-GFT-007 | View My Gift Cards | /account/giftcards | Display | app/account/giftcards/page.tsx | GET /giftcards/my | ✅ |
| CUS-GFT-008 | Check Gift Card Balance | /account/giftcards | Action | app/account/giftcards/page.tsx | GET /giftcards/check/:code | ✅ |

### A8. Loyalty (CUS-LOY)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-LOY-001 | View Loyalty Dashboard | /account/loyalty | Display | app/account/loyalty/page.tsx | GET /loyalty/me | ✅ |
| CUS-LOY-002 | View Points Balance | /account/loyalty | Display | app/account/loyalty/page.tsx | - | ✅ |
| CUS-LOY-003 | View Tier Status | /account/loyalty | Display | app/account/loyalty/page.tsx | GET /loyalty/tiers | ✅ |
| CUS-LOY-004 | View Transaction History | /account/loyalty | Display | app/account/loyalty/page.tsx | GET /loyalty/me/transactions | ✅ |
| CUS-LOY-005 | Enroll in Loyalty Program | /account/loyalty | Action | app/account/loyalty/page.tsx | POST /loyalty/enroll | ✅ |
| CUS-LOY-006 | View Tier Benefits | /account/loyalty | Display | app/account/loyalty/page.tsx | - | ✅ |

### A9. Account & Profile (CUS-ACCT)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-ACCT-001 | View Profile | /profile | Display | app/profile/page.tsx | GET /users/profile | ✅ |
| CUS-ACCT-002 | Edit Profile Info | /profile | Form | app/profile/page.tsx | PUT /users/profile | ✅ |
| CUS-ACCT-003 | Change Password | /profile | Form | app/profile/page.tsx | PUT /auth/change-password | ✅ |
| CUS-ACCT-004 | Enable/Disable 2FA | /profile | Action | app/profile/page.tsx | POST /auth/2fa/setup | ✅ |
| CUS-ACCT-005 | View Order History | /order | Display | app/order/page.tsx | GET /restaurant/my-orders | ✅ |
| CUS-ACCT-006 | View Order Detail | /order | Display | app/order/page.tsx | GET /restaurant/orders/:id | ✅ |
| CUS-ACCT-007 | Track Order Status | /order | Display | app/order/page.tsx | GET /restaurant/orders/:id/status | ✅ |
| CUS-ACCT-008 | Cancel Order | /cancellation | Action | app/cancellation/page.tsx | - | ✅ |
| CUS-ACCT-009 | Submit Review | Various | Form | - | POST /reviews | ✅ |

### A10. GDPR Privacy (CUS-GDPR)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-GDPR-001 | View Privacy Dashboard | /account/privacy | Display | app/account/privacy/page.tsx | GET /gdpr/dashboard | ✅ |
| CUS-GDPR-002 | Manage Consent Preferences | /account/privacy | Form | app/account/privacy/page.tsx | PUT /gdpr/consents | ✅ |
| CUS-GDPR-003 | Request Data Export | /account/privacy | Action | app/account/privacy/page.tsx | POST /gdpr/export/request | ✅ |
| CUS-GDPR-004 | Download Data Export | /account/privacy | Action | app/account/privacy/page.tsx | GET /gdpr/export/download/:id | ✅ |
| CUS-GDPR-005 | Request Account Deletion | /account/privacy | Action | app/account/privacy/page.tsx | POST /gdpr/deletion/request | ✅ |
| CUS-GDPR-006 | View Processing Log | /account/privacy | Display | app/account/privacy/page.tsx | GET /gdpr/processing-log | ✅ |

### A11. Dynamic Modules (CUS-MOD)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-MOD-001 | View Dynamic Module Page | /[slug] | Display | app/[slug]/page.tsx | GET /modules | ✅ |
| CUS-MOD-002 | Browse Module Menu/Items | /[slug] | Display | app/[slug]/page.tsx | - | ✅ |
| CUS-MOD-003 | Add Module Item to Cart | /[slug] | Action | app/[slug]/page.tsx | - | ✅ |
| CUS-MOD-004 | View Module Cart | /[slug]/cart | Display | app/[slug]/cart/page.tsx | - | ✅ |
| CUS-MOD-005 | Place Module Order | /[slug]/cart | Action | app/[slug]/cart/page.tsx | - | ✅ |
| CUS-MOD-006 | Module Order Confirmation | /[slug]/confirmation | Display | app/[slug]/confirmation/page.tsx | - | ✅ |

### A12. Global Settings (CUS-SET)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-SET-001 | Switch Currency | Global | Setting | components/CurrencySwitcher.tsx | - | ✅ |
| CUS-SET-002 | Switch Language | Global | Setting | components/LanguageSwitcher.tsx | - | ✅ |
| CUS-SET-003 | Toggle Theme (Light/Dark) | Global | Setting | components/ThemeToggle.tsx | - | ✅ |
| CUS-SET-004 | User Preferences Modal | Global | Modal | components/settings/UserPreferencesModal.tsx | - | ✅ |

### A13. Static Pages (CUS-STATIC)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-STATIC-001 | Contact Form | /contact | Form | app/contact/page.tsx | POST /support/contact | ✅ |
| CUS-STATIC-002 | Privacy Policy Page | /privacy | Display | app/privacy/page.tsx | - | ✅ |
| CUS-STATIC-003 | Terms & Conditions Page | /terms | Display | app/terms/page.tsx | - | ✅ |
| CUS-STATIC-004 | Offline Fallback Page | /offline | Display | app/offline/page.tsx | - | ✅ |

### A14. Universal Cart (CUS-CART)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| CUS-CART-001 | View Universal Cart | /cart | Display | app/cart/page.tsx | - | ✅ |
| CUS-CART-002 | Update Quantities | /cart | Action | app/cart/page.tsx | - | ✅ |
| CUS-CART-003 | Remove Items | /cart | Action | app/cart/page.tsx | - | ✅ |
| CUS-CART-004 | Apply Coupon | /cart | Form | app/cart/page.tsx | POST /coupons/validate | ✅ |
| CUS-CART-005 | Checkout | /cart | Action | app/cart/page.tsx | - | ✅ |

---

## B. STAFF FEATURES (STF-*) — 128 Features

### B1. Staff Navigation & Layout (STF-NAV)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-NAV-001 | Staff Sidebar Navigation | /staff/* | Navigation | app/staff/layout.tsx | - | ✅ |
| STF-NAV-002 | Dynamic Module Nav Links | /staff/* | Navigation | app/staff/layout.tsx | GET /admin/modules | ✅ |
| STF-NAV-003 | Notifications Bell | /staff/* | Action | app/staff/layout.tsx | GET /admin/notifications | ✅ |
| STF-NAV-004 | Mark Notification Read | /staff/* | Action | app/staff/layout.tsx | PUT /admin/notifications/:id/read | ✅ |
| STF-NAV-005 | Mark All Notifications Read | /staff/* | Action | app/staff/layout.tsx | PUT /admin/notifications/read-all | ✅ |
| STF-NAV-006 | Currency Switcher | /staff/* | Setting | app/staff/layout.tsx | - | ✅ |
| STF-NAV-007 | Theme Toggle | /staff/* | Setting | app/staff/layout.tsx | - | ✅ |
| STF-NAV-008 | Live Clock | /staff/* | Display | app/staff/layout.tsx | - | ✅ |
| STF-NAV-009 | Logout | /staff/* | Action | app/staff/layout.tsx | POST /auth/logout | ✅ |

### B2. Staff Dashboard (STF-DASH)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-DASH-001 | Pending Orders Stat | /staff | Display | app/staff/page.tsx | GET /restaurant/staff/orders | ✅ |
| STF-DASH-002 | Completed Today Stat | /staff | Display | app/staff/page.tsx | - | ✅ |
| STF-DASH-003 | Issues Stat | /staff | Display | app/staff/page.tsx | - | ✅ |
| STF-DASH-004 | Quick Action Cards | /staff | Navigation | app/staff/page.tsx | - | ✅ |
| STF-DASH-005 | Recent Activity Feed | /staff | Display | app/staff/page.tsx | - | ✅ |
| STF-DASH-006 | Real-time Order WebSocket | /staff | Action | app/staff/page.tsx | Socket: order:new | ✅ |

### B3. Restaurant Kitchen (STF-REST)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-REST-001 | Kanban Order Board (5 columns) | /staff/restaurant | Display | app/staff/restaurant/page.tsx | GET /restaurant/staff/orders | ✅ |
| STF-REST-002 | Status Filter Buttons | /staff/restaurant | Filter | app/staff/restaurant/page.tsx | - | ✅ |
| STF-REST-003 | Advance Order Status | /staff/restaurant | Action | app/staff/restaurant/page.tsx | PATCH /restaurant/staff/orders/:id/status | ✅ |
| STF-REST-004 | Order Detail Modal | /staff/restaurant | Modal | app/staff/restaurant/page.tsx | - | ✅ |
| STF-REST-005 | View Modifiers/Customizations | /staff/restaurant | Display | app/staff/restaurant/page.tsx | - | ✅ |
| STF-REST-006 | Real-time Order Notifications | /staff/restaurant | Action | app/staff/restaurant/page.tsx | Socket: order:new | ✅ |

### B4. Chalet Operations (STF-CHAL)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-CHAL-001 | Today's Check-Ins Stat | /staff/chalets | Display | app/staff/chalets/page.tsx | GET /chalets/staff/bookings | ✅ |
| STF-CHAL-002 | Today's Check-Outs Stat | /staff/chalets | Display | app/staff/chalets/page.tsx | - | ✅ |
| STF-CHAL-003 | Currently Occupied Stat | /staff/chalets | Display | app/staff/chalets/page.tsx | - | ✅ |
| STF-CHAL-004 | Search Bookings | /staff/chalets | Filter | app/staff/chalets/page.tsx | - | ✅ |
| STF-CHAL-005 | Today/All Toggle | /staff/chalets | Filter | app/staff/chalets/page.tsx | - | ✅ |
| STF-CHAL-006 | Check-In Guest | /staff/chalets | Action | app/staff/chalets/page.tsx | PATCH /chalets/staff/bookings/:id/check-in | ✅ |
| STF-CHAL-007 | Check-Out Guest | /staff/chalets | Action | app/staff/chalets/page.tsx | PATCH /chalets/staff/bookings/:id/check-out | ✅ |
| STF-CHAL-008 | Confirm Booking | /staff/chalets | Action | app/staff/chalets/page.tsx | PATCH /chalets/staff/bookings/:id/status | ✅ |
| STF-CHAL-009 | Cancel Booking | /staff/chalets | Action | app/staff/chalets/page.tsx | PATCH /chalets/staff/bookings/:id/status | ✅ |
| STF-CHAL-010 | Booking Detail Modal | /staff/chalets | Modal | app/staff/chalets/page.tsx | - | ✅ |
| STF-CHAL-011 | Real-time Booking Updates | /staff/chalets | Action | app/staff/chalets/page.tsx | Socket: chalet:booking:updated | ✅ |

### B5. Pool Operations (STF-POOL)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-POOL-001 | Scan Mode Toggle (F2) | /staff/pool | Action | app/staff/pool/page.tsx | - | ✅ |
| STF-POOL-002 | Ticket Code Scanner Input | /staff/pool | Form | app/staff/pool/page.tsx | POST /pool/staff/validate | ✅ |
| STF-POOL-003 | Total/Pending/InPool/Completed Stats | /staff/pool | Display | app/staff/pool/page.tsx | GET /pool/staff/tickets/today | ✅ |
| STF-POOL-004 | Capacity Progress Bar | /staff/pool | Display | app/staff/pool/page.tsx | GET /pool/staff/capacity | ✅ |
| STF-POOL-005 | Near Capacity Warning | /staff/pool | Display | app/staff/pool/page.tsx | - | ✅ |
| STF-POOL-006 | Record Entry | /staff/pool | Action | app/staff/pool/page.tsx | POST /pool/tickets/:id/entry | ✅ |
| STF-POOL-007 | Record Exit | /staff/pool | Action | app/staff/pool/page.tsx | POST /pool/tickets/:id/exit | ✅ |
| STF-POOL-008 | Ticket Detail Modal | /staff/pool | Modal | app/staff/pool/page.tsx | - | ✅ |
| STF-POOL-009 | Add Maintenance Log | /staff/pool | Form | app/staff/pool/components/MaintenanceTab.tsx | POST /pool/staff/maintenance | ✅ |
| STF-POOL-010 | View Maintenance Logs | /staff/pool | Display | app/staff/pool/components/MaintenanceTab.tsx | GET /pool/staff/maintenance | ✅ |
| STF-POOL-011 | Real-time Ticket/Capacity Updates | /staff/pool | Action | app/staff/pool/page.tsx | Socket: pool:ticket:updated | ✅ |

### B6. Snack Bar Operations (STF-SNCK)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-SNCK-001 | View Live Orders | /staff/snack | Display | app/staff/snack/page.tsx | GET /snack/staff/orders/live | ✅ |
| STF-SNCK-002 | Pending/Preparing/Ready Stats | /staff/snack | Display | app/staff/snack/page.tsx | - | ✅ |
| STF-SNCK-003 | Search/Filter Orders | /staff/snack | Filter | app/staff/snack/page.tsx | - | ✅ |
| STF-SNCK-004 | Advance Order Status | /staff/snack | Action | app/staff/snack/page.tsx | PATCH /snack/staff/orders/:id/status | ✅ |
| STF-SNCK-005 | Order Detail Modal | /staff/snack | Modal | app/staff/snack/page.tsx | - | ✅ |
| STF-SNCK-006 | Real-time Order Notifications | /staff/snack | Action | app/staff/snack/page.tsx | Socket: order:new | ✅ |
| STF-SNCK-007 | Auto-refresh (30s) | /staff/snack | Action | app/staff/snack/page.tsx | - | ✅ |

### B7. Bookings Calendar (STF-BOOK)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-BOOK-001 | Date Navigation (Prev/Today/Next) | /staff/bookings | Navigation | app/staff/bookings/page.tsx | - | ✅ |
| STF-BOOK-002 | Checking In/Out/Staying Stats | /staff/bookings | Display | app/staff/bookings/page.tsx | GET /chalets/staff/bookings | ✅ |
| STF-BOOK-003 | Booking List for Date | /staff/bookings | Display | app/staff/bookings/page.tsx | - | ✅ |
| STF-BOOK-004 | Check-In from Calendar | /staff/bookings | Action | app/staff/bookings/page.tsx | PATCH /chalets/staff/bookings/:id/check-in | ✅ |
| STF-BOOK-005 | Check-Out from Calendar | /staff/bookings | Action | app/staff/bookings/page.tsx | PATCH /chalets/staff/bookings/:id/check-out | ✅ |

### B8. Customer Lookup (STF-CUST)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-CUST-001 | Search by Phone/Email/Name | /staff/customers | Form | app/staff/customers/page.tsx | GET /admin/users | ✅ |
| STF-CUST-002 | View Customer Info Card | /staff/customers | Display | app/staff/customers/page.tsx | - | ✅ |
| STF-CUST-003 | View Loyalty Points | /staff/customers | Display | app/staff/customers/page.tsx | GET /loyalty/accounts/:id | ✅ |
| STF-CUST-004 | View Recent Orders/Bookings | /staff/customers | Display | app/staff/customers/page.tsx | - | ✅ |

### B9. QR Scanner (STF-SCAN)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-SCAN-001 | Ticket Code Input | /staff/scanner | Form | app/staff/scanner/page.tsx | POST /pool/staff/validate | ✅ |
| STF-SCAN-002 | Validate Ticket | /staff/scanner | Action | app/staff/scanner/page.tsx | - | ✅ |
| STF-SCAN-003 | Record Entry from Scanner | /staff/scanner | Action | app/staff/scanner/page.tsx | POST /pool/tickets/:id/entry | ✅ |
| STF-SCAN-004 | Record Exit from Scanner | /staff/scanner | Action | app/staff/scanner/page.tsx | POST /pool/tickets/:id/exit | ✅ |
| STF-SCAN-005 | Recent Scans History | /staff/scanner | Display | app/staff/scanner/page.tsx | - | ✅ |

### B10. Dynamic Module Staff (STF-MOD)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| STF-MOD-001 | Kitchen View (menu_service) | /staff/modules/[slug] | Display | components/staff/KitchenView.tsx | GET /staff/modules/:slug/orders | ✅ |
| STF-MOD-002 | Kitchen — Accept/Prep/Ready/Complete | /staff/modules/[slug] | Action | components/staff/KitchenView.tsx | PUT /staff/modules/:slug/orders/:id/status | ✅ |
| STF-MOD-003 | Session Access Dashboard | /staff/modules/[slug] | Display | components/staff/SessionAccessDashboard.tsx | - | ✅ |
| STF-MOD-004 | Multi-Day Booking Dashboard | /staff/modules/[slug] | Display | app/staff/modules/[slug]/components/MultiDayBookingDashboard.tsx | GET /staff/modules/:slug/bookings | ✅ |
| STF-MOD-005 | Module Sessions List | /staff/[slug]/sessions | Display | app/staff/[slug]/sessions/page.tsx | - | ✅ |
| STF-MOD-006 | Module Capacity Dashboard | /staff/[slug]/capacity | Display | app/staff/[slug]/capacity/page.tsx | - | ✅ |
| STF-MOD-007 | Module Ticket Scanner | /staff/[slug]/tickets | Form | app/staff/[slug]/tickets/page.tsx | POST /:slug/staff/validate | ✅ |
| STF-MOD-008 | Module Booking Confirm/CheckIn/Out | /staff/modules/[slug] | Action | - | PATCH /staff/modules/:slug/bookings/:id/status | ✅ |

---

## C. MANAGER FEATURES (MGR-*) — 42 Features

### C1. Manager Dashboard (MGR-DASH)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| MGR-DASH-001 | Today's Revenue Stat | /staff/manager | Display | app/staff/manager/page.tsx | GET /admin/dashboard/revenue | ✅ |
| MGR-DASH-002 | Pending Orders Stat | /staff/manager | Display | app/staff/manager/page.tsx | - | ✅ |
| MGR-DASH-003 | Active Staff Stat | /staff/manager | Display | app/staff/manager/page.tsx | - | ✅ |
| MGR-DASH-004 | Pending Approvals Stat | /staff/manager | Display | app/staff/manager/page.tsx | GET /manager/approvals/pending | ✅ |
| MGR-DASH-005 | Overview/Approvals/Staff/Reports Tabs | /staff/manager | Navigation | app/staff/manager/page.tsx | - | ✅ |
| MGR-DASH-006 | Weekly Performance Chart | /staff/manager | Display | app/staff/manager/page.tsx | - | ✅ |
| MGR-DASH-007 | Quick Action Links | /staff/manager | Navigation | app/staff/manager/page.tsx | - | ✅ |
| MGR-DASH-008 | Full Admin Panel Link | /staff/manager | Navigation | app/staff/manager/page.tsx | - | ✅ |

### C2. Approvals (MGR-APPR)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| MGR-APPR-001 | View Pending Approvals | /staff/manager | Display | app/staff/manager/page.tsx | GET /manager/approvals/pending | ✅ |
| MGR-APPR-002 | Approve Request | /staff/manager | Action | app/staff/manager/page.tsx | PUT /manager/approvals/:id/review | ✅ |
| MGR-APPR-003 | Deny Request | /staff/manager | Action | app/staff/manager/page.tsx | PUT /manager/approvals/:id/review | ✅ |

### C3. Staff Management (MGR-STAFF)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| MGR-STAFF-001 | Staff Status Table | /staff/manager | Table | app/staff/manager/page.tsx | GET /staff/shifts | ✅ |
| MGR-STAFF-002 | Active/On Break Counts | /staff/manager | Display | app/staff/manager/page.tsx | - | ✅ |

### C4. Reports Access (MGR-RPT)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| MGR-RPT-001 | Daily Revenue Report | /staff/manager | Action | app/staff/manager/page.tsx | GET /admin/reports/overview | ✅ |
| MGR-RPT-002 | Staff Performance Report | /staff/manager | Action | app/staff/manager/page.tsx | - | ✅ |
| MGR-RPT-003 | Order Summary Report | /staff/manager | Action | app/staff/manager/page.tsx | - | ✅ |
| MGR-RPT-004 | Scheduled Reports Link | /staff/manager | Navigation | app/staff/manager/page.tsx | - | ✅ |

---

## D. ADMIN FEATURES (ADM-*) — 234 Features

### D1. Admin Dashboard (ADM-DASH)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-DASH-001 | Refresh Dashboard | /admin | Action | app/admin/page.tsx | GET /admin/dashboard | ✅ |
| ADM-DASH-002 | Online Users Stat (real-time) | /admin | Display | app/admin/page.tsx | Socket: stats:update | ✅ |
| ADM-DASH-003 | Total Orders Stat | /admin | Display | app/admin/page.tsx | - | ✅ |
| ADM-DASH-004 | Revenue Stat | /admin | Display | app/admin/page.tsx | - | ✅ |
| ADM-DASH-005 | Bookings Stat | /admin | Display | app/admin/page.tsx | - | ✅ |
| ADM-DASH-006 | Revenue by Module Chart | /admin | Display | app/admin/page.tsx | - | ✅ |
| ADM-DASH-007 | Recent Orders List | /admin | Display | app/admin/page.tsx | - | ✅ |
| ADM-DASH-008 | Quick Action Links | /admin | Navigation | app/admin/page.tsx | - | ✅ |

### D2. Order Management (ADM-ORD)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-ORD-001 | View All Orders | /admin/orders | Table | app/admin/orders/page.tsx | GET /restaurant/staff/orders | ✅ |
| ADM-ORD-002 | Search Orders | /admin/orders | Filter | app/admin/orders/page.tsx | - | ✅ |
| ADM-ORD-003 | Filter by Source | /admin/orders | Filter | app/admin/orders/page.tsx | - | ✅ |
| ADM-ORD-004 | Filter by Status | /admin/orders | Filter | app/admin/orders/page.tsx | - | ✅ |
| ADM-ORD-005 | Advance Order Status | /admin/orders | Action | app/admin/orders/page.tsx | PATCH /restaurant/admin/orders/:id/status | ✅ |
| ADM-ORD-006 | Order Detail Modal | /admin/orders | Modal | app/admin/orders/page.tsx | - | ✅ |
| ADM-ORD-007 | Real-time Order Socket | /admin/orders | Action | app/admin/orders/page.tsx | Socket: order:new | ✅ |

### D3. Restaurant Management (ADM-REST)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-REST-001 | View Menu Categories | /admin/[slug]/categories | Table | app/admin/[slug]/categories/page.tsx | GET /restaurant/menu/categories | ✅ |
| ADM-REST-002 | Create Category | /admin/[slug]/categories | Form | app/admin/[slug]/categories/page.tsx | POST /restaurant/admin/categories | ✅ |
| ADM-REST-003 | Edit Category | /admin/[slug]/categories | Form | app/admin/[slug]/categories/page.tsx | PUT /restaurant/admin/categories/:id | ✅ |
| ADM-REST-004 | Delete Category | /admin/[slug]/categories | Action | app/admin/[slug]/categories/page.tsx | DELETE /restaurant/admin/categories/:id | ✅ |
| ADM-REST-005 | View Menu Items | /admin/[slug]/menu | Table | app/admin/[slug]/menu/page.tsx | GET /restaurant/menu/items | ✅ |
| ADM-REST-006 | Create Menu Item | /admin/[slug]/menu | Form | app/admin/[slug]/menu/page.tsx | POST /restaurant/admin/items | ✅ |
| ADM-REST-007 | Edit Menu Item | /admin/[slug]/menu | Form | app/admin/[slug]/menu/page.tsx | PUT /restaurant/admin/items/:id | ✅ |
| ADM-REST-008 | Delete Menu Item | /admin/[slug]/menu | Action | app/admin/[slug]/menu/page.tsx | DELETE /restaurant/admin/items/:id | ✅ |
| ADM-REST-009 | Toggle Item Availability | /admin/[slug]/menu | Toggle | app/admin/[slug]/menu/page.tsx | PATCH /restaurant/admin/items/:id/availability | ✅ |
| ADM-REST-010 | Manage Modifier Groups | /admin/[slug]/modifiers | CRUD | app/admin/[slug]/modifiers/page.tsx | GET/POST/PUT/DELETE /restaurant/admin/modifiers/groups | ✅ |
| ADM-REST-011 | Manage Modifier Options | /admin/[slug]/modifiers | CRUD | app/admin/[slug]/modifiers/page.tsx | POST/PUT/DELETE /restaurant/admin/modifiers/options | ✅ |
| ADM-REST-012 | Link Modifiers to Items | /admin/[slug]/modifiers | Action | app/admin/[slug]/modifiers/page.tsx | POST /restaurant/admin/items/:id/modifiers | ✅ |
| ADM-REST-013 | Manage Tables | /admin/[slug]/tables | CRUD | app/admin/[slug]/tables/page.tsx | POST/DELETE /restaurant/admin/tables | ✅ |
| ADM-REST-014 | View Reservations | /admin/[slug]/reservations | Table | app/admin/[slug]/reservations/page.tsx | GET /restaurant/reservations | ✅ |
| ADM-REST-015 | Manage Waitlist | /admin/[slug]/waitlist | Table | app/admin/[slug]/waitlist/page.tsx | GET /restaurant/waitlist | ✅ |
| ADM-REST-016 | View Module Orders | /admin/[slug]/orders | Table | app/admin/[slug]/orders/page.tsx | GET /restaurant/admin/orders | ✅ |

### D4. Chalet Management (ADM-CHAL)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-CHAL-001 | View Bookings | /admin/[slug]/bookings | Table | app/admin/[slug]/bookings/page.tsx | GET /chalets/staff/bookings | ✅ |
| ADM-CHAL-002 | Manage Pricing Rules | /admin/[slug]/pricing | CRUD | app/admin/[slug]/pricing/page.tsx | GET/POST/PUT/DELETE /chalets/admin/price-rules | ✅ |
| ADM-CHAL-003 | Manage Add-Ons | /admin/[slug]/addons | CRUD | app/admin/[slug]/addons/page.tsx | GET/POST/PUT/DELETE /chalets/admin/add-ons | ✅ |

### D5. Pool Management (ADM-POOL)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-POOL-001 | Manage Sessions | /admin/[slug]/sessions | CRUD | app/admin/[slug]/sessions/page.tsx | POST/PUT/DELETE /pool/admin/sessions | ✅ |
| ADM-POOL-002 | View Tickets | /admin/[slug]/tickets | Table | app/admin/[slug]/tickets/page.tsx | - | ✅ |
| ADM-POOL-003 | View Capacity | /admin/[slug]/capacity | Display | app/admin/[slug]/capacity/page.tsx | GET /pool/staff/capacity | ✅ |

### D6. Inventory (ADM-INV)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-INV-001 | View Inventory Items | /admin/inventory | Table | app/admin/inventory/page.tsx | GET /inventory/items | ✅ |
| ADM-INV-002 | Create Inventory Item | /admin/inventory | Form | app/admin/inventory/page.tsx | POST /inventory/items | ✅ |
| ADM-INV-003 | Edit Inventory Item | /admin/inventory | Form | app/admin/inventory/page.tsx | PUT /inventory/items/:id | ✅ |
| ADM-INV-004 | Delete Inventory Item | /admin/inventory | Action | app/admin/inventory/page.tsx | DELETE /inventory/items/:id | ✅ |
| ADM-INV-005 | Manage Categories | /admin/inventory | CRUD | app/admin/inventory/page.tsx | GET/POST/PUT/DELETE /inventory/categories | ✅ |
| ADM-INV-006 | Record Transaction | /admin/inventory | Form | app/admin/inventory/page.tsx | POST /inventory/transactions | ✅ |
| ADM-INV-007 | View Alerts | /admin/inventory | Display | app/admin/inventory/page.tsx | GET /inventory/alerts | ✅ |
| ADM-INV-008 | Resolve Alert | /admin/inventory | Action | app/admin/inventory/page.tsx | POST /inventory/alerts/:id/resolve | ✅ |
| ADM-INV-009 | Link to Menu Items | /admin/inventory | Action | app/admin/inventory/page.tsx | POST /inventory/items/:id/link-menu | ✅ |
| ADM-INV-010 | Manage Recipes/BOM | /admin/inventory | CRUD | app/admin/inventory/page.tsx | GET/POST /inventory/items/recipe/:id | ✅ |
| ADM-INV-011 | View Stats | /admin/inventory | Display | app/admin/inventory/page.tsx | GET /inventory/stats | ✅ |

### D7. Housekeeping (ADM-HSK)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-HSK-001 | View Tasks | /admin/housekeeping | Table | app/admin/housekeeping/page.tsx | GET /housekeeping/tasks | ✅ |
| ADM-HSK-002 | Create Task | /admin/housekeeping | Form | app/admin/housekeeping/page.tsx | POST /housekeeping/tasks | ✅ |
| ADM-HSK-003 | Assign Task | /admin/housekeeping | Action | app/admin/housekeeping/page.tsx | POST /housekeeping/tasks/:id/assign | ✅ |
| ADM-HSK-004 | Manage Schedules | /admin/housekeeping | CRUD | app/admin/housekeeping/page.tsx | GET/POST/PUT/DELETE /housekeeping/schedules | ✅ |
| ADM-HSK-005 | View Available Staff | /admin/housekeeping | Display | app/admin/housekeeping/page.tsx | GET /housekeeping/staff | ✅ |
| ADM-HSK-006 | View Stats | /admin/housekeeping | Display | app/admin/housekeeping/page.tsx | GET /housekeeping/stats | ✅ |

### D8. User Management (ADM-USR)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-USR-001 | View All Users | /admin/users | Table | app/admin/users/page.tsx | GET /admin/users | ✅ |
| ADM-USR-002 | View Customers | /admin/users/customers | Table | app/admin/users/customers/page.tsx | GET /admin/users | ✅ |
| ADM-USR-003 | View Staff | /admin/users/staff | Table | app/admin/users/staff/page.tsx | GET /admin/users | ✅ |
| ADM-USR-004 | View Admins | /admin/users/admins | Table | app/admin/users/admins/page.tsx | GET /admin/users | ✅ |
| ADM-USR-005 | Create User | /admin/users/create | Form | app/admin/users/create/page.tsx | POST /admin/users | ✅ |
| ADM-USR-006 | Edit User | /admin/users/[id] | Form | app/admin/users/[id]/page.tsx | PUT /admin/users/:id | ✅ |
| ADM-USR-007 | Delete User | /admin/users/[id] | Action | app/admin/users/[id]/page.tsx | DELETE /admin/users/:id | ✅ |
| ADM-USR-008 | Assign Roles | /admin/users/[id] | Form | app/admin/users/[id]/page.tsx | PUT /admin/users/:id/roles | ✅ |
| ADM-USR-009 | Manage Roles | /admin/users/roles | CRUD | app/admin/users/roles/page.tsx | GET/POST/PUT/DELETE /admin/roles | ✅ |
| ADM-USR-010 | Manage Permissions | /admin/users/roles | Form | app/admin/users/roles/page.tsx | GET/PUT /admin/roles/:id/permissions | ✅ |
| ADM-USR-011 | View Live Users | /admin/users/live | Display | app/admin/users/live/page.tsx | Socket: online users | ✅ |

### D9. Loyalty (ADM-LOY)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-LOY-001 | View Loyalty Accounts | /admin/loyalty | Table | app/admin/loyalty/page.tsx | GET /loyalty/accounts | ✅ |
| ADM-LOY-002 | View Loyalty Stats | /admin/loyalty | Display | app/admin/loyalty/page.tsx | GET /loyalty/stats | ✅ |
| ADM-LOY-003 | Update Loyalty Settings | /admin/loyalty | Form | app/admin/loyalty/page.tsx | PUT /loyalty/settings | ✅ |
| ADM-LOY-004 | Manage Tiers | /admin/loyalty | CRUD | app/admin/loyalty/page.tsx | POST/PUT/DELETE /loyalty/tiers | ✅ |
| ADM-LOY-005 | Adjust Points (manual) | /admin/loyalty | Action | app/admin/loyalty/page.tsx | POST /loyalty/adjust | ✅ |

### D10. Gift Cards (ADM-GFT)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-GFT-001 | View All Gift Cards | /admin/giftcards | Table | app/admin/giftcards/page.tsx | GET /giftcards | ✅ |
| ADM-GFT-002 | Create Gift Card | /admin/giftcards | Form | app/admin/giftcards/page.tsx | POST /giftcards | ✅ |
| ADM-GFT-003 | Disable Gift Card | /admin/giftcards | Action | app/admin/giftcards/page.tsx | PUT /giftcards/:id/disable | ✅ |
| ADM-GFT-004 | Manage Templates | /admin/giftcards | CRUD | app/admin/giftcards/page.tsx | POST/PUT /giftcards/templates | ✅ |
| ADM-GFT-005 | View Stats | /admin/giftcards | Display | app/admin/giftcards/page.tsx | GET /giftcards/stats | ✅ |

### D11. Coupons (ADM-CPN)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-CPN-001 | View All Coupons | /admin/coupons | Table | app/admin/coupons/page.tsx | GET /coupons | ✅ |
| ADM-CPN-002 | Create Coupon | /admin/coupons | Form | app/admin/coupons/page.tsx | POST /coupons | ✅ |
| ADM-CPN-003 | Edit Coupon | /admin/coupons | Form | app/admin/coupons/page.tsx | PUT /coupons/:id | ✅ |
| ADM-CPN-004 | Delete Coupon | /admin/coupons | Action | app/admin/coupons/page.tsx | DELETE /coupons/:id | ✅ |
| ADM-CPN-005 | Generate Code | /admin/coupons | Action | app/admin/coupons/page.tsx | GET /coupons/generate-code | ✅ |
| ADM-CPN-006 | View Stats | /admin/coupons | Display | app/admin/coupons/page.tsx | GET /coupons/stats | ✅ |

### D12. Reviews (ADM-REV)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-REV-001 | View All Reviews | /admin/reviews | Table | app/admin/reviews/page.tsx | GET /reviews/admin | ✅ |
| ADM-REV-002 | Approve Review | /admin/reviews | Action | app/admin/reviews/page.tsx | PUT /reviews/:id/approve | ✅ |
| ADM-REV-003 | Reject Review | /admin/reviews | Action | app/admin/reviews/page.tsx | PUT /reviews/:id/reject | ✅ |
| ADM-REV-004 | Delete Review | /admin/reviews | Action | app/admin/reviews/page.tsx | DELETE /reviews/:id | ✅ |

### D13. Modules (ADM-MOD)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-MOD-001 | View All Modules | /admin/modules | Table | app/admin/modules/page.tsx | GET /admin/modules | ✅ |
| ADM-MOD-002 | Create Module | /admin/modules | Form | app/admin/modules/page.tsx | POST /admin/modules | ✅ |
| ADM-MOD-003 | Edit Module | /admin/modules | Form | app/admin/modules/page.tsx | PUT /admin/modules/:id | ✅ |
| ADM-MOD-004 | Delete Module | /admin/modules | Action | app/admin/modules/page.tsx | DELETE /admin/modules/:id | ✅ |
| ADM-MOD-005 | Toggle Module Active | /admin/modules | Toggle | app/admin/modules/page.tsx | PUT /admin/modules/:id | ✅ |
| ADM-MOD-006 | Module Builder (drag-drop) | /admin/modules/builder/[id] | Interactive | app/admin/modules/builder/[id]/page.tsx | PUT /admin/modules/:id | ✅ |
| ADM-MOD-007 | Add Builder Block | /admin/modules/builder/[id] | Action | components/module-builder/ComponentToolbar.tsx | - | ✅ |
| ADM-MOD-008 | Configure Block Properties | /admin/modules/builder/[id] | Form | components/module-builder/PropertyPanel.tsx | - | ✅ |
| ADM-MOD-009 | Reorder Blocks (drag) | /admin/modules/builder/[id] | Interactive | components/module-builder/SortableBlock.tsx | - | ✅ |
| ADM-MOD-010 | Preview Module | /admin/modules/builder/[id] | Action | components/module-builder/BuilderCanvas.tsx | - | ✅ |

### D14. Reports & Analytics (ADM-RPT)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-RPT-001 | Reports Overview | /admin/reports | Display | app/admin/reports/page.tsx | GET /admin/reports/overview | ✅ |
| ADM-RPT-002 | Analytics Dashboard | /admin/reports/analytics | Display | app/admin/reports/analytics/page.tsx | GET /reports/* | ✅ |
| ADM-RPT-003 | Export Report (CSV/Excel/PDF) | /admin/reports | Action | app/admin/reports/page.tsx | GET /admin/reports/export | ✅ |
| ADM-RPT-004 | Occupancy Report | /admin/reports | Display | app/admin/reports/page.tsx | GET /admin/reports/occupancy | ✅ |
| ADM-RPT-005 | Customer Analytics | /admin/reports | Display | app/admin/reports/page.tsx | GET /admin/reports/customers | ✅ |
| ADM-RPT-006 | Scheduled Reports | /admin/reports/scheduled | CRUD | app/admin/reports/scheduled/page.tsx | GET/POST/PUT/DELETE /admin/reports/scheduled | ✅ |
| ADM-RPT-007 | Preview Report | /admin/reports | Action | app/admin/reports/page.tsx | GET /admin/reports/preview | ✅ |
| ADM-RPT-008 | Send Report Now | /admin/reports/scheduled | Action | app/admin/reports/scheduled/page.tsx | POST /admin/reports/scheduled/:id/send | ✅ |

### D15. Notifications (ADM-NOTIF)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-NOTIF-001 | View Notifications | /admin (global) | Display | app/admin/layout.tsx | GET /admin/notifications | ✅ |
| ADM-NOTIF-002 | Broadcast Notification | Admin | Action | - | POST /admin/notifications/broadcast | ✅ |
| ADM-NOTIF-003 | Manage Templates | Admin | CRUD | - | GET/POST/PUT/DELETE /admin/notifications/templates | ✅ |
| ADM-NOTIF-004 | Send from Template | Admin | Action | - | POST /admin/notifications/templates/:id/send | ✅ |

### D16. Settings (ADM-SET)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-SET-001 | General Settings | /admin/settings | Form | app/admin/settings/page.tsx | GET/PUT /admin/settings | ✅ |
| ADM-SET-002 | Appearance (theme/colors/fonts) | /admin/settings/appearance | Form | app/admin/settings/appearance/page.tsx | PUT /admin/settings | ✅ |
| ADM-SET-003 | Navbar Configuration | /admin/settings/navbar | Form | app/admin/settings/navbar/page.tsx | PUT /admin/settings | ✅ |
| ADM-SET-004 | Homepage Configuration | /admin/settings/homepage | Form | app/admin/settings/homepage/page.tsx | GET/PUT /admin/settings/homepage | ✅ |
| ADM-SET-005 | Footer Configuration | /admin/settings/footer | Form | app/admin/settings/footer/page.tsx | PUT /admin/settings | ✅ |
| ADM-SET-006 | Translation Management | /admin/settings/translations | Form | app/admin/settings/translations/page.tsx | GET/PUT /admin/translations/* | ✅ |
| ADM-SET-007 | Payment Settings (Stripe) | /admin/settings/payments | Form | app/admin/settings/payments/page.tsx | PUT /admin/settings | ✅ |
| ADM-SET-008 | Tax Configuration | /admin/settings/tax | Form | app/admin/settings/tax/page.tsx | GET/PUT /settings/tax | ✅ |
| ADM-SET-009 | Notification Settings | /admin/settings/notifications | Form | app/admin/settings/notifications/page.tsx | PUT /admin/settings | ✅ |
| ADM-SET-010 | Backup Management | /admin/settings/backups | CRUD | app/admin/settings/backups/page.tsx | GET/POST/DELETE /admin/backups | ✅ |
| ADM-SET-011 | Restore from Backup | /admin/settings/backups | Action | app/admin/settings/backups/page.tsx | POST /admin/backups/restore | ✅ |
| ADM-SET-012 | QuickBooks Integration | /admin/integrations/quickbooks | Form | app/admin/integrations/quickbooks/page.tsx | - | 🚫 Disabled |

### D17. Channels (ADM-CHN)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-CHN-001 | View Channel Connections | /admin/channels | Table | app/admin/channels/page.tsx | GET /channels/properties/:id/connections | ✅ |
| ADM-CHN-002 | Create Connection | /admin/channels | Form | app/admin/channels/page.tsx | POST /channels/properties/:id/connections | ✅ |
| ADM-CHN-003 | Room/Rate Mappings | /admin/channels | CRUD | app/admin/channels/page.tsx | GET/POST/PUT/DELETE /channels/*/mappings | ✅ |
| ADM-CHN-004 | Sync Availability | /admin/channels | Action | app/admin/channels/page.tsx | POST /channels/*/sync/availability | ✅ |
| ADM-CHN-005 | Sync Rates | /admin/channels | Action | app/admin/channels/page.tsx | POST /channels/*/sync/rates | ✅ |
| ADM-CHN-006 | View Sync Log | /admin/channels | Display | app/admin/channels/page.tsx | GET /channels/*/sync-log | ✅ |

### D18. Audit & System (ADM-AUD)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-AUD-001 | View Audit Logs | /admin/audit | Table | app/admin/audit/page.tsx | GET /admin/audit-logs | ✅ |
| ADM-AUD-002 | Filter by Resource/Date | /admin/audit | Filter | app/admin/audit/page.tsx | - | ✅ |
| ADM-AUD-003 | View Properties | /admin/properties | Table | app/admin/properties/page.tsx | GET /multi-property/* | ✅ |

### D19. Customizations (ADM-CUST)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-CUST-001 | View Customization Groups | /admin/customizations | Table | app/admin/customizations/page.tsx | GET /customizations/groups | ✅ |
| ADM-CUST-002 | Create Group | /admin/customizations | Form | app/admin/customizations/page.tsx | POST /customizations/groups | ✅ |
| ADM-CUST-003 | Manage Options | /admin/customizations | CRUD | app/admin/customizations/page.tsx | POST/PUT/DELETE /customizations/options | ✅ |
| ADM-CUST-004 | Link to Entities | /admin/customizations | Action | app/admin/customizations/page.tsx | POST /customizations/entity/:id/link | ✅ |

### D20. Terminology (ADM-TERM)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-TERM-001 | View Terminology Overrides | /admin/terminology | Table | app/admin/terminology/page.tsx | GET /terminology | ✅ |
| ADM-TERM-002 | Update Terminology | /admin/terminology | Form | app/admin/terminology/page.tsx | POST /terminology | ✅ |
| ADM-TERM-003 | Bulk Update | /admin/terminology | Action | app/admin/terminology/page.tsx | POST /terminology/bulk | ✅ |

### D21. Kiosk Management (ADM-KSK)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-KSK-001 | View Kiosk Devices | /admin/kiosk | Table | app/admin/kiosk/page.tsx | GET /kiosk/devices | ✅ |
| ADM-KSK-002 | Configure Kiosk | /admin/kiosk | Form | app/admin/kiosk/page.tsx | PUT /kiosk/devices/:id | ✅ |

### D22. Module-level Settings (ADM-MSET)

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| ADM-MSET-001 | Module Branding Settings | /[slug]/admin/settings/branding | Form | app/[slug]/admin/settings/branding/page.tsx | PUT /admin/modules/:id | ✅ |
| ADM-MSET-002 | Module Email Config | /[slug]/admin/settings/email | Form | app/[slug]/admin/settings/email/page.tsx | PUT /admin/modules/:id | ✅ |
| ADM-MSET-003 | Module Pricing Config | /[slug]/admin/settings/pricing | Form | app/[slug]/admin/settings/pricing/page.tsx | GET/PUT /admin/pricing/* | ✅ |
| ADM-MSET-004 | Seasonal Pricing Rules | /[slug]/admin/settings/pricing | CRUD | app/[slug]/admin/settings/pricing/page.tsx | GET/POST/PUT/DELETE /admin/pricing/seasonal-rules | ✅ |

---

## E. SYSTEM / CROSS-CUTTING FEATURES (SYS-*) — 38 Features

### E1. Authentication System (SYS-AUTH)

| ID | Feature | Page | Type | Backend Endpoint | Status |
|----|---------|------|------|-----------------|--------|
| SYS-AUTH-001 | JWT Token Refresh | - | Auto | POST /auth/refresh | ✅ |
| SYS-AUTH-002 | 2FA Setup/Enable/Disable | - | API | POST /auth/2fa/* | ✅ |
| SYS-AUTH-003 | WebAuthn Biometric Auth | - | API | POST /auth/biometric/* | ✅ |
| SYS-AUTH-004 | OAuth Callback Handling | - | API | GET /auth/*/callback | ✅ |
| SYS-AUTH-005 | Session Management | - | Auto | - | ✅ |
| SYS-AUTH-006 | Role-Based Route Protection | - | Middleware | auth.middleware | ✅ |
| SYS-AUTH-007 | Permission-Based Access | - | Middleware | permission.middleware | ✅ |

### E2. Real-Time (SYS-RT)

| ID | Feature | Page | Type | Backend | Status |
|----|---------|------|------|---------|--------|
| SYS-RT-001 | Socket.IO Connection | Global | Auto | socket/index.ts | ✅ |
| SYS-RT-002 | Dashboard Stats Push (30s) | Admin | Auto | scheduler.service | ✅ |
| SYS-RT-003 | Order Event Broadcasting | Staff/Admin | Auto | Socket: order:* | ✅ |
| SYS-RT-004 | Booking Event Broadcasting | Staff | Auto | Socket: chalet:booking:* | ✅ |
| SYS-RT-005 | Pool Ticket Broadcasting | Staff | Auto | Socket: pool:* | ✅ |
| SYS-RT-006 | Online User Tracking | Admin | Auto | Socket: stats:update | ✅ |

### E3. Internationalization (SYS-I18N)

| ID | Feature | Page | Type | Frontend File | Status |
|----|---------|------|------|--------------|--------|
| SYS-I18N-001 | Language Detection | Global | Auto | - | ✅ |
| SYS-I18N-002 | RTL Support (Arabic) | Global | Auto | components/DirectionSync.tsx | ✅ |
| SYS-I18N-003 | Dynamic Translation | Global | Auto | components/providers/TranslationProvider.tsx | ✅ |
| SYS-I18N-004 | Translated Text Component | Global | Component | components/ui/TranslatedText.tsx | ✅ |

### E4. Theming (SYS-THEME)

| ID | Feature | Page | Type | Frontend File | Status |
|----|---------|------|------|--------------|--------|
| SYS-THEME-001 | 6-Theme System | Global | Config | components/ThemeInjector.tsx | ✅ |
| SYS-THEME-002 | Light/Dark Mode | Global | Toggle | components/ThemeProvider.tsx | ✅ |
| SYS-THEME-003 | Custom CSS Variables | Global | Auto | components/ThemeInjector.tsx | ✅ |

### E5. Payments (SYS-PAY)

| ID | Feature | Page | Type | Backend Endpoint | Status |
|----|---------|------|------|-----------------|--------|
| SYS-PAY-001 | Stripe Payment Intent | - | API | POST /payments/create-intent | ✅ |
| SYS-PAY-002 | Stripe Webhook Processing | - | API | POST /payments/webhook/stripe | ✅ |
| SYS-PAY-003 | Cash Payment Recording | - | API | POST /payments/record-cash | ✅ |
| SYS-PAY-004 | Refund Processing | - | API | POST /payments/transactions/:id/refund | ✅ |
| SYS-PAY-005 | POS Terminal Integration | - | API | POST /pos/terminal/* | ✅ |

### E6. Background Jobs (SYS-JOBS)

| ID | Feature | Description | Schedule | Status |
|----|---------|-------------|----------|--------|
| SYS-JOBS-001 | Daily Backup | Automated DB backup | 3:00 AM | ✅ |
| SYS-JOBS-002 | Pool Ticket Expiry | Expire old tickets | Midnight + every 4h | ✅ |
| SYS-JOBS-003 | Session Cleanup | Remove stale sessions | 4:00 AM | ✅ |
| SYS-JOBS-004 | Booking Reminders | Pre-arrival emails | 9:00 AM | ✅ |
| SYS-JOBS-005 | Scheduled Report Delivery | Send due reports | Every 5 min | ✅ |

### E7. Monitoring & Security (SYS-SEC)

| ID | Feature | Type | Status |
|----|---------|------|--------|
| SYS-SEC-001 | Rate Limiting (global) | Middleware | ✅ |
| SYS-SEC-002 | Per-User Rate Limiting | Middleware | ✅ |
| SYS-SEC-003 | CSRF Protection | Middleware | ✅ |
| SYS-SEC-004 | XSS Sanitization | Middleware | ✅ |
| SYS-SEC-005 | Sentry Error Tracking | Service | ✅ |
| SYS-SEC-006 | OpenTelemetry Tracing | Service | ✅ |

---

## F. KIOSK FEATURES (KSK-*) — 12 Features

| ID | Feature | Page | Type | Frontend File | Backend Endpoint | Status |
|----|---------|------|------|--------------|-----------------|--------|
| KSK-001 | Idle Screen Display | /kiosk | Display | app/kiosk/page.tsx | - | ✅ |
| KSK-002 | Touch to Start | /kiosk | Action | app/kiosk/page.tsx | - | ✅ |
| KSK-003 | Identify Guest (booking lookup) | /kiosk | Form | app/kiosk/components/KioskIdentifyStep.tsx | GET /kiosk/sessions | ✅ |
| KSK-004 | Confirm Identity | /kiosk | Action | app/kiosk/components/KioskConfirmStep.tsx | - | ✅ |
| KSK-005 | ID Scan Transaction | /kiosk | Action | app/kiosk/page.tsx | POST /kiosk/transactions | ✅ |
| KSK-006 | Key Encode Transaction | /kiosk | Action | app/kiosk/page.tsx | POST /kiosk/transactions | ✅ |
| KSK-007 | Payment Transaction | /kiosk | Form | app/kiosk/page.tsx | POST /kiosk/transactions | ✅ |
| KSK-008 | Receipt Transaction | /kiosk | Display | app/kiosk/page.tsx | POST /kiosk/transactions | ✅ |
| KSK-009 | Processing Steps Animation | /kiosk | Display | app/kiosk/components/KioskProcessingSteps.tsx | - | ✅ |
| KSK-010 | Check-In Complete | /kiosk | Display | app/kiosk/page.tsx | - | ✅ |
| KSK-011 | Check-Out Flow | /kiosk | Action | app/kiosk/page.tsx | - | ✅ |
| KSK-012 | Error Recovery / Restart | /kiosk | Action | app/kiosk/page.tsx | - | ✅ |

---

## Summary

| Category | Features | Percentage |
|----------|----------|------------|
| Customer (CUS) | 183 | 28.7% |
| Staff (STF) | 128 | 20.1% |
| Manager (MGR) | 42 | 6.6% |
| Admin (ADM) | 234 | 36.7% |
| System (SYS) | 38 | 6.0% |
| Kiosk (KSK) | 12 | 1.9% |
| **TOTAL** | **637** | **100%** |

### Status Summary

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Complete | 636 | 99.8% |
| 🚫 Disabled | 1 | 0.2% |
| ⚠️ Partial | 0 | 0% |
| ❌ Missing | 0 | 0% |

> **Note:** The 1 disabled feature is ADM-SET-012 (QuickBooks Integration), which is intentionally disabled in the codebase.
