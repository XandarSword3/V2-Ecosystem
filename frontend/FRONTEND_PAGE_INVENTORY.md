# EXHAUSTIVE FRONTEND PAGE & ROUTE INVENTORY

**Generated:** Audit Document  
**Framework:** Next.js 15 (App Router)  
**Total Pages:** 107 `page.tsx` files  
**Total Layouts:** 8 `layout.tsx` files  
**Locales:** en, ar, fr (RTL support for Arabic)  

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Layouts (8)](#2-layouts)
3. [Public Pages (10)](#3-public-pages)
4. [Customer Module Pages — Hardcoded (17)](#4-customer-module-pages--hardcoded)
5. [Customer Module Pages — Dynamic [slug] (6)](#5-customer-module-pages--dynamic-slug)
6. [Account / Profile Pages (4)](#6-account--profile-pages)
7. [Admin Pages — Core (4)](#7-admin-pages--core)
8. [Admin Pages — User Management (8)](#8-admin-pages--user-management)
9. [Admin Pages — Settings (10)](#9-admin-pages--settings)
10. [Admin Pages — Business Operations (14)](#10-admin-pages--business-operations)
11. [Admin Pages — Dynamic Module Management [slug] (14)](#11-admin-pages--dynamic-module-management-slug)
12. [Admin Pages — Per-Module Settings [slug]/admin/settings (3)](#12-admin-pages--per-module-settings)
13. [Staff Pages (14)](#13-staff-pages)
14. [State Management (Stores)](#14-state-management)
15. [API Layer](#15-api-layer)
16. [Component Library](#16-component-library)
17. [Hooks](#17-hooks)
18. [Summary Statistics](#18-summary-statistics)

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, `src/app/` directory routing) |
| Language | TypeScript |
| State (server) | TanStack React Query |
| State (client) | Zustand (persisted) |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Forms | react-hook-form + Zod validation |
| i18n | next-intl (en, ar, fr) |
| Real-time | Socket.io (`useSocket` hook) |
| Payments | Stripe (`StripePayment` component) |
| Toast | Sonner |
| Icons | Lucide React |
| Drag & Drop | @dnd-kit |
| HTTP | Axios (centralized `api` instance) |

### Dynamic Module System
Modules are database-driven entities with three `template_type` values:
- **`menu_service`** — Menu items, categories, orders, modifiers, tables, reservations, waitlist
- **`multi_day_booking`** — Bookable units (chalets), pricing rules, add-ons, bookings
- **`session_access`** — Time-slotted sessions, tickets, capacity management

Hardcoded routes exist for legacy modules (restaurant, pool, chalets, snack-bar). Dynamic `[slug]` routes handle any module created through the admin module builder.

### Authentication & Roles
- Auth context: `useAuth()` from `@/lib/auth-context`
- Roles: `super_admin`, `admin`, `restaurant_staff`, `restaurant_admin`, `restaurant_manager`, `pool_staff`, `pool_admin`, `chalets_staff`, `chalets_admin`, `snack_staff`, `snack_admin`, `customer`
- 2FA: TOTP + backup codes
- Token: JWT with refresh token rotation

---

## 2. LAYOUTS

### 2.1 Root Layout
| Property | Value |
|---|---|
| **File** | `src/app/layout.tsx` (168 lines) |
| **Type** | Server Component |
| **Route** | Wraps all pages |
| **Auth** | None |
| **Fetches** | `GET /api/v1/settings` (site settings, business name, theme, modules) |
| **Renders** | `<Header>`, `<Footer>`, `<PageTransition>`, `<Toaster>`, `<ThemeInjector>`, `<CookieConsentBanner>`, `<DirectionSync>`, `<SessionTimeoutMonitor>`, `<PageTracker>`, `<LiveChatWidget>` |
| **Features** | Theme detection script (beach/mountain/sunset/forest/midnight/luxury), RTL for `ar` locale, PWA manifest/service-worker registration, structured data (Organization JSON-LD), preconnect hints |
| **Fonts** | Inter, Cairo (Arabic) |

### 2.2 Admin Layout
| Property | Value |
|---|---|
| **File** | `src/app/admin/layout.tsx` (832 lines) |
| **Type** | Client Component |
| **Route** | Wraps `/admin/*` |
| **Auth** | `admin` or `super_admin` role required; redirects to `/login` |
| **Features** | Collapsible sidebar with search, categorized navigation (Dashboard, Modules, dynamically-generated module nav items, Users, Settings, Reports, Tools, Integrations), notifications bell with polling (30s), profile menu, breadcrumbs, mobile hamburger menu |
| **Dynamic Nav** | Modules fetched from DB populate nav items with template-appropriate sub-links (menu/categories/orders for menu_service; bookings/pricing/addons for multi_day_booking; sessions/tickets/capacity for session_access). Navigation filtered by `filterNavigationByRole()` |
| **State** | `useSiteSettings()` for modules, `useAuth()` for user/role |

### 2.3 Staff Layout
| Property | Value |
|---|---|
| **File** | `src/app/staff/layout.tsx` (463 lines) |
| **Type** | Client Component |
| **Route** | Wraps `/staff/*` |
| **Auth** | Staff, admin, or manager roles required; redirects to `/login` |
| **Features** | Sidebar navigation (Dashboard, Scanner, legacy module links, dynamic module links), notifications polling (30s), profile menu, role-based filtering with legacy role mapping |
| **Dynamic Nav** | Modules populate staff nav; template-appropriate links generated per module |

### 2.4 [slug] Layout (Public Module)
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/layout.tsx` |
| **Type** | Server Component |
| **Route** | Wraps `/[slug]/*` |
| **Auth** | None |
| **Features** | Dynamic metadata from slug (title, description), breadcrumb structured data (JSON-LD), sr-only semantic HTML for SEO |

### 2.5 Admin [slug] Layout
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/layout.tsx` |
| **Type** | Client Component |
| **Route** | Wraps `/admin/[slug]/*` |
| **Auth** | Inherited from admin layout |
| **Features** | Resolves module from slug via `useSiteSettings`, loading spinner, redirects to `/admin` if module not found |

### 2.6 Restaurant Layout
| Property | Value |
|---|---|
| **File** | `src/app/restaurant/layout.tsx` |
| **Type** | Server Component |
| **Route** | Wraps `/restaurant/*` |
| **Features** | SEO metadata (title: "Restaurant", description) |

### 2.7 Pool Layout
| Property | Value |
|---|---|
| **File** | `src/app/pool/layout.tsx` |
| **Type** | Server Component |
| **Route** | Wraps `/pool/*` |
| **Features** | SEO metadata (title: "Pool & Water Park") |

### 2.8 Snack Bar Layout
| Property | Value |
|---|---|
| **File** | `src/app/snack-bar/layout.tsx` |
| **Type** | Server Component |
| **Route** | Wraps `/snack-bar/*` |
| **Features** | SEO metadata (title: "Snack Bar") |

---

## 3. PUBLIC PAGES

### 3.1 Homepage
| Property | Value |
|---|---|
| **File** | `src/app/page.tsx` (844 lines) |
| **Route** | `/` |
| **Auth** | Public |
| **Displays** | Hero slider carousel (auto-rotate 6s, parallax), dynamic services grid from active modules, CMS-configurable sections: features, stats counter, testimonials, interactive resort map, CTA |
| **Components** | `InteractiveResortMap`, `LiveChatWidget`, `TestimonialsCarousel`, `WeatherWidget`, `ParallaxHero` |
| **Data** | Site settings from context (modules, homepage sections) |
| **States** | Loading shimmer, empty sections hidden via CMS toggles |
| **API** | None direct (uses settings context hydrated from layout) |

### 3.2 Login
| Property | Value |
|---|---|
| **File** | `src/app/login/page.tsx` (414 lines) |
| **Route** | `/login` |
| **Auth** | Public (redirects if already logged in) |
| **Displays** | Email/password form, 2FA verification form (TOTP code or backup code), "Remember Me" option, social login placeholders |
| **Actions** | Login, 2FA verify |
| **API** | `authApi.login(email, password)` → `POST /auth/login`, `verify2FA(userId, code, isBackupCode)` → `POST /auth/2fa/verify` |
| **States** | Loading, error messages, 2FA challenge state |
| **Redirects** | admin→`/admin`, staff→`/staff`, customer→`/` |

### 3.3 Register
| Property | Value |
|---|---|
| **File** | `src/app/register/page.tsx` (258 lines) |
| **Route** | `/register` |
| **Auth** | Public |
| **Displays** | Registration form: full name, email, phone, password, confirm password |
| **Validation** | Client-side (password match, email format, name length) |
| **API** | `POST /auth/register` |
| **States** | Loading, success → redirect to `/login`, error toast |
| **Components** | `PasswordStrengthMeter` |

### 3.4 Forgot Password
| Property | Value |
|---|---|
| **File** | `src/app/forgot-password/page.tsx` (154 lines) |
| **Route** | `/forgot-password` |
| **Auth** | Public |
| **Displays** | Email input form, success "Check Your Email" state |
| **API** | `authApi.forgotPassword(email)` → `POST /auth/forgot-password` |
| **States** | Loading, submitted success, error |

### 3.5 Reset Password
| Property | Value |
|---|---|
| **File** | `src/app/reset-password/page.tsx` (209 lines) |
| **Route** | `/reset-password?token=<token>` |
| **Auth** | Public (requires valid token) |
| **Displays** | New password + confirm password form |
| **API** | `authApi.resetPassword(token, newPassword)` → `POST /auth/reset-password` |
| **States** | Loading, success → auto-redirect to `/login`, error, missing token warning |

### 3.6 Contact
| Property | Value |
|---|---|
| **File** | `src/app/contact/page.tsx` (286 lines) |
| **Route** | `/contact` |
| **Auth** | Public |
| **Displays** | Contact form (name, email, phone, subject, message), CMS-configured contact info (address, phone, email, hours), embedded map |
| **API** | `supportApi.submitContact(data)` → `POST /support/contact` |
| **States** | Loading, success, error, validation |

### 3.7 Terms of Service
| Property | Value |
|---|---|
| **File** | `src/app/terms/page.tsx` (126 lines) |
| **Route** | `/terms` |
| **Auth** | Public |
| **Displays** | CMS-driven or i18n-translated terms sections |
| **Data** | Site settings (business name, terms content) |

### 3.8 Privacy Policy
| Property | Value |
|---|---|
| **File** | `src/app/privacy/page.tsx` (126 lines) |
| **Route** | `/privacy` |
| **Auth** | Public |
| **Displays** | CMS-driven or i18n-translated privacy policy sections |
| **Data** | Site settings (business name, privacy content) |

### 3.9 Cancellation / Refund Policy
| Property | Value |
|---|---|
| **File** | `src/app/cancellation/page.tsx` (122 lines) |
| **Route** | `/cancellation` |
| **Auth** | Public |
| **Displays** | CMS-driven refund/cancellation policy |
| **Data** | Site settings |

### 3.10 Offline (PWA Fallback)
| Property | Value |
|---|---|
| **File** | `src/app/offline/page.tsx` |
| **Route** | `/offline` |
| **Auth** | Public |
| **Displays** | PWA offline fallback page with retry button |
| **Purpose** | Service worker serves this page when the user is offline |

---

## 4. CUSTOMER MODULE PAGES — HARDCODED

### Restaurant (5 pages)

#### 4.1 Restaurant Menu
| Property | Value |
|---|---|
| **File** | `src/app/restaurant/page.tsx` (170 lines) |
| **Route** | `/restaurant` |
| **Auth** | Public |
| **Displays** | Menu items by category, dietary filters (vegetarian/vegan/gluten-free), featured dishes, search |
| **Actions** | Add to cart (with modifier/customization modal) |
| **API** | `restaurantApi.getMenu(moduleId)` → `GET /restaurant/menu` |
| **State** | `useCartStore` (Zustand), loading skeleton, empty menu |
| **Components** | Category tabs, menu item cards, modifier selection modal |

#### 4.2 Restaurant Cart / Checkout
| Property | Value |
|---|---|
| **File** | `src/app/restaurant/cart/page.tsx` (927 lines) |
| **Route** | `/restaurant/cart` |
| **Auth** | Public (guest checkout allowed) |
| **Displays** | Multi-step checkout wizard: cart review → customer details → payment |
| **Order Types** | `dine_in`, `takeaway`, `delivery` |
| **Payment** | Cash, Card (Stripe via `StripePayment` component) |
| **Discounts** | Coupon codes, gift card redemption, loyalty points |
| **Calculations** | Dynamic tax rate, service charge, delivery fee (from settings) |
| **API** | `restaurantApi.createOrder(data)` → `POST /restaurant/orders` |
| **State** | `useCartStore` (restaurant items), multi-step form state, Stripe payment intent |
| **Actions** | Apply coupon, apply gift card, redeem loyalty points, select table, enter delivery address |

#### 4.3 Restaurant Reservation
| Property | Value |
|---|---|
| **File** | `src/app/restaurant/reserve/page.tsx` (489 lines) |
| **Route** | `/restaurant/reserve` |
| **Auth** | Public |
| **Displays** | Multi-step: select date/time → party size → guest details → special requests → confirmation |
| **API** | `GET /restaurant/tables/available` (availability), `POST /restaurant/reservations` (create) |
| **States** | Loading, no availability, success with reservation details |

#### 4.4 Restaurant Waitlist
| Property | Value |
|---|---|
| **File** | `src/app/restaurant/waitlist/page.tsx` (329 lines) |
| **Route** | `/restaurant/waitlist` |
| **Auth** | Public |
| **Displays** | Join waitlist form (name, phone, party size), status tracker (polls every 30s) |
| **API** | `POST /restaurant/waitlist` (join), `GET /restaurant/waitlist/:id` (status) |
| **States** | Join form, waiting status with position/estimated wait, notified, seated |

#### 4.5 Restaurant Order Confirmation
| Property | Value |
|---|---|
| **File** | `src/app/restaurant/confirmation/page.tsx` (336 lines) |
| **Route** | `/restaurant/confirmation?id=<orderId>` |
| **Auth** | Public |
| **Displays** | Order summary, items with modifiers, totals, payment info, QR code |
| **API** | `restaurantApi.getOrderStatus(id)` → `GET /restaurant/orders/:id` |
| **States** | Loading, order found, order not found |

---

### Pool (2 pages)

#### 4.6 Pool — Sessions & Tickets
| Property | Value |
|---|---|
| **File** | `src/app/pool/page.tsx` (696 lines) |
| **Route** | `/pool` |
| **Auth** | Public |
| **Displays** | Date picker, session cards with real-time availability, ticket type selection (adult/child/family/VIP), purchase form |
| **API** | `poolApi.getAvailability(date, moduleId)` → `GET /pool/availability`, `poolApi.purchaseTicket(data)` → `POST /pool/tickets`, `poolApi.getMyTickets()` → `GET /pool/my-tickets` |
| **Real-time** | Socket.io for live availability updates |
| **Payment** | Cash, Card (Stripe) |
| **States** | Loading, no sessions, sold out, purchase success |

#### 4.7 Pool Confirmation
| Property | Value |
|---|---|
| **File** | `src/app/pool/confirmation/page.tsx` (259 lines) |
| **Route** | `/pool/confirmation?id=<ticketId>` |
| **Auth** | Public |
| **Displays** | Ticket details, session info, QR code, guest count |
| **API** | `poolApi.getTicket(id)` → `GET /pool/tickets/:id` |

---

### Chalets (3 pages)

#### 4.8 Chalets Listing
| Property | Value |
|---|---|
| **File** | `src/app/chalets/page.tsx` (477 lines) |
| **Route** | `/chalets` |
| **Auth** | Public |
| **Displays** | Chalet cards with images, amenity icons, capacity, pricing, deposit percentage (from settings) |
| **API** | `chaletsApi.getChalets(moduleId)` → `GET /chalets` |
| **Actions** | Navigate to detail page |
| **States** | Loading skeleton, empty list |

#### 4.9 Chalet Detail / Booking
| Property | Value |
|---|---|
| **File** | `src/app/chalets/[id]/page.tsx` (620 lines) |
| **Route** | `/chalets/:id` |
| **Auth** | Public |
| **Displays** | Image gallery (lightbox), amenity list, description, date picker (check-in/out), guest count, add-on selection, price breakdown, booking form |
| **API** | `chaletsApi.getChalet(id)` → `GET /chalets/:id`, `chaletsApi.getAddOns(moduleId)` → `GET /chalets/add-ons`, availability check |
| **Actions** | Select dates, select add-ons, submit booking |
| **Payment** | Cash, Card (Stripe), deposit option |
| **States** | Loading, not found, unavailable dates, booking success |

#### 4.10 Chalet Booking Confirmation
| Property | Value |
|---|---|
| **File** | `src/app/chalets/booking-confirmation/page.tsx` (253 lines) |
| **Route** | `/chalets/booking-confirmation?id=<bookingId>` |
| **Auth** | Public |
| **Displays** | Booking details, dates, chalet info, add-ons, payment summary |
| **API** | `chaletsApi.getBookingDetails(id)` → `GET /chalets/bookings/:id` |

---

### Snack Bar (3 pages)

#### 4.11 Snack Bar Menu
| Property | Value |
|---|---|
| **File** | `src/app/snack-bar/page.tsx` (542 lines) |
| **Route** | `/snack-bar` |
| **Auth** | Public |
| **Displays** | Category-based menu (sandwich, drink, snack, ice_cream), item cards with images, search |
| **API** | `snackApi.getItems()` → `GET /snack/items` |
| **State** | `useCartStore` (snack items) |
| **Actions** | Add to cart, adjust quantity |

#### 4.12 Snack Bar Cart / Checkout
| Property | Value |
|---|---|
| **File** | `src/app/snack-bar/cart/page.tsx` (372 lines) |
| **Route** | `/snack-bar/cart` |
| **Auth** | Public (guest checkout) |
| **Displays** | Cart items, customer info form, pickup location |
| **API** | `snackApi.createOrder(data)` → `POST /snack/orders` |
| **Payment** | Cash |
| **States** | Empty cart, loading, success → redirect to confirmation |

#### 4.13 Snack Bar Confirmation
| Property | Value |
|---|---|
| **File** | `src/app/snack-bar/confirmation/page.tsx` |
| **Route** | `/snack-bar/confirmation?id=<orderId>` |
| **Auth** | Public |
| **Displays** | Order summary, items, estimated pickup time |
| **API** | `snackApi.getOrder(id)` → `GET /snack/orders/:id` |

---

### Shared Customer Pages (4 pages)

#### 4.14 Unified Cart
| Property | Value |
|---|---|
| **File** | `src/app/cart/page.tsx` (219 lines) |
| **Route** | `/cart` |
| **Auth** | Public |
| **Displays** | All cart items grouped by module (restaurant, snack, dynamic modules) |
| **Actions** | Navigate to module-specific checkout (`/{slug}/cart`) |
| **State** | `useCartStore` (all item arrays) |

#### 4.15 Table-Side QR Ordering
| Property | Value |
|---|---|
| **File** | `src/app/order/page.tsx` (530 lines) |
| **Route** | `/order?table=<tableNumber>` |
| **Auth** | Public (QR code scanned at table) |
| **Displays** | Menu by category, local cart, order summary |
| **API** | `GET /restaurant/menu` (menu), `POST /restaurant/orders` (submit with table_number) |
| **States** | Loading, empty menu, order submitted confirmation |

#### 4.16 Gift Cards (Public)
| Property | Value |
|---|---|
| **File** | `src/app/giftcards/page.tsx` (583 lines) |
| **Route** | `/giftcards` |
| **Auth** | Public (guests can purchase) |
| **Displays** | Gift card templates, custom amount input, recipient details form, balance check tab |
| **API** | `GET /giftcards/templates`, `POST /giftcards/purchase`, `GET /giftcards/balance?code=` |
| **Payment** | Card (Stripe) |
| **States** | Template selection, purchase form, success with gift card code |

#### 4.17 Kiosk (Self-Service)
| Property | Value |
|---|---|
| **File** | `src/app/kiosk/page.tsx` (151 lines) |
| **Route** | `/kiosk?device=<deviceId>` |
| **Auth** | Public (device-specific) |
| **Displays** | Multi-step self-service flow: idle → identify (booking number/QR) → confirm guest → payment/key → complete |
| **Purpose** | Self-service check-in/check-out for guests |
| **API** | Device-specific API calls |

---

## 5. CUSTOMER MODULE PAGES — DYNAMIC [slug]

These pages handle any dynamically-created module via its slug.

#### 5.1 Dynamic Module Page
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/page.tsx` |
| **Route** | `/:slug` |
| **Auth** | Public |
| **Logic** | Resolves module by slug from settings, renders by `template_type`: |
| | • `menu_service` → `<MenuService>` component |
| | • `multi_day_booking` → `<BookingService>` component |
| | • `session_access` → `<SessionService>` component |
| | • If module has `settings.layout` → `<DynamicModuleRenderer>` (visual layout) |
| **States** | Loading, module not found (404), module disabled ("feature unavailable") |

#### 5.2 Dynamic Unit Detail
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/[unitId]/page.tsx` (443 lines) |
| **Route** | `/:slug/:unitId` |
| **Auth** | Public |
| **Displays** | Booking unit detail (image gallery, amenities, date picker, add-ons, booking form) — mirrors chalets/[id] |
| **API** | `chaletsApi.getChalet(unitId)`, `chaletsApi.getAddOns(moduleId)` |

#### 5.3 Dynamic Cart / Checkout
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/cart/page.tsx` (915 lines) |
| **Route** | `/:slug/cart` |
| **Auth** | Public |
| **Displays** | Module-specific checkout (mirrors restaurant cart pattern) with Stripe, coupons, gift cards, loyalty points |
| **API** | Module-specific order creation endpoint |

#### 5.4 Dynamic Confirmation
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/confirmation/page.tsx` (492 lines) |
| **Route** | `/:slug/confirmation?id=<id>` |
| **Auth** | Public |
| **Logic** | Handles 3 confirmation types based on template_type: |
| | • `session_access` → SessionTicket confirmation |
| | • `menu_service` → OrderConfirmation |
| | • `multi_day_booking` → BookingConfirmation |

#### 5.5 Dynamic Waitlist
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/waitlist/page.tsx` (221 lines) |
| **Route** | `/:slug/waitlist` |
| **Auth** | Public |
| **Displays** | Generic waitlist join/status for any module |
| **API** | `POST /:slug/waitlist`, `GET /:slug/waitlist/:id` |

#### 5.6 Dynamic Reservation
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/reserve/page.tsx` (293 lines) |
| **Route** | `/:slug/reserve` |
| **Auth** | Public |
| **Displays** | Generic reservation flow for any module |
| **API** | `GET /:slug/tables/available`, `POST /:slug/reservations` |

---

## 6. ACCOUNT / PROFILE PAGES

#### 6.1 Profile
| Property | Value |
|---|---|
| **File** | `src/app/profile/page.tsx` (614 lines) |
| **Route** | `/profile` |
| **Auth** | Authenticated (customer+) |
| **Displays** | Tabs: Profile (edit name/phone/avatar), Orders (history + status), Snack Orders, Bookings (chalet), Tickets (pool) |
| **Actions** | Edit profile, enable/disable 2FA, view order details |
| **API** | `authApi.getProfile()`, `GET /restaurant/my-orders`, `GET /snack/orders/my`, `GET /chalets/my-bookings`, `GET /pool/my-tickets` |
| **2FA** | Setup flow: generate QR → verify code → show backup codes |

#### 6.2 Account — Loyalty
| Property | Value |
|---|---|
| **File** | `src/app/account/loyalty/page.tsx` (381 lines) |
| **Route** | `/account/loyalty` |
| **Auth** | Authenticated (redirects to `/login` if not) |
| **Displays** | Current points balance, tier name + progress bar to next tier, transaction history (earned/redeemed), benefits list |
| **API** | `GET /loyalty/me`, `GET /loyalty/me/transactions`, `GET /loyalty/tiers` |
| **States** | Loading, no loyalty account, empty transactions |

#### 6.3 Account — Privacy (GDPR)
| Property | Value |
|---|---|
| **File** | `src/app/account/privacy/page.tsx` (661 lines) |
| **Route** | `/account/privacy` |
| **Auth** | Authenticated |
| **Displays** | GDPR privacy dashboard with tabs: Consents (marketing, analytics, personalization toggles), Data Export (request download), Deletion Requests (request account deletion), Data Sharing Log (third-party sharing audit trail) |
| **API** | Privacy dashboard endpoint (consents CRUD, export request, deletion request) |

#### 6.4 Account — Gift Cards
| Property | Value |
|---|---|
| **File** | `src/app/account/giftcards/page.tsx` (298 lines) |
| **Route** | `/account/giftcards` |
| **Auth** | Authenticated |
| **Displays** | Tabs: Purchase (link to `/giftcards`), My Cards (owned gift cards with balances), Transactions (usage history) |
| **API** | `GET /giftcards/my-cards`, `GET /giftcards/transactions` |

---

## 7. ADMIN PAGES — CORE

#### 7.1 Admin Dashboard
| Property | Value |
|---|---|
| **File** | `src/app/admin/page.tsx` (571 lines) |
| **Route** | `/admin` |
| **Auth** | Admin/Super Admin |
| **Displays** | Today's stats cards (orders, revenue, bookings, tickets), trend indicators (↑/↓ vs yesterday), revenue chart, recent orders list with status badges |
| **Real-time** | Socket.io for live stat updates |
| **API** | Dashboard stats endpoint |
| **States** | Loading skeletons, empty states |

#### 7.2 Admin Modules
| Property | Value |
|---|---|
| **File** | `src/app/admin/modules/page.tsx` (464 lines) |
| **Route** | `/admin/modules` |
| **Auth** | Admin |
| **Displays** | Module list with name, slug, template_type badge, active/inactive toggle, edit/delete actions |
| **Actions** | Create module (name, slug, template_type, icon, description), edit, delete (with force option), toggle active |
| **API** | `modulesApi.getAll()`, `modulesApi.create()`, `modulesApi.update()`, `modulesApi.delete()` |
| **States** | Loading, empty list, delete confirmation dialog |

#### 7.3 Module Builder (Visual Editor)
| Property | Value |
|---|---|
| **File** | `src/app/admin/modules/builder/[id]/page.tsx` (187 lines) |
| **Route** | `/admin/modules/builder/:id` |
| **Auth** | Admin |
| **Displays** | Visual drag-and-drop page builder canvas with component palette |
| **Features** | @dnd-kit drag & drop, undo/redo history, zoom controls, preview toggle, save layout |
| **State** | `module-builder-store` (Zustand) |
| **API** | Saves layout as JSON to `module.settings.layout` |

#### 7.4 Dynamic Module Dashboard
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/page.tsx` (148 lines) |
| **Route** | `/admin/:slug` |
| **Auth** | Admin |
| **Displays** | Quick-link cards to sub-pages based on template_type: |
| | • `menu_service` → Menu Items, Categories, Orders |
| | • `multi_day_booking` → Bookings, Pricing |
| | • `session_access` → Sessions, Tickets |
| **Logic** | Resolves module by slug, renders appropriate dashboard grid |

---

## 8. ADMIN PAGES — USER MANAGEMENT

#### 8.1 Users Index (Redirect)
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/page.tsx` |
| **Route** | `/admin/users` |
| **Auth** | Admin |
| **Action** | Redirects to `/admin/users/customers` |

#### 8.2 Live Users
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/live/page.tsx` (498 lines) |
| **Route** | `/admin/users/live` |
| **Auth** | Admin |
| **Displays** | Real-time online users list with session duration, current page, role badge |
| **Real-time** | WebSocket for live presence tracking |
| **API** | WebSocket events for user connect/disconnect |

#### 8.3 Staff List
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/staff/page.tsx` (7 lines) |
| **Route** | `/admin/users/staff` |
| **Auth** | Admin |
| **Renders** | `<UserList type="staff">` component |

#### 8.4 Admin List
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/admins/page.tsx` (7 lines) |
| **Route** | `/admin/users/admins` |
| **Auth** | Admin |
| **Renders** | `<UserList type="admin">` component |

#### 8.5 Customer List
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/customers/page.tsx` (7 lines) |
| **Route** | `/admin/users/customers` |
| **Auth** | Admin |
| **Renders** | `<UserList type="customer">` component |

#### 8.6 Roles & Permissions
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/roles/page.tsx` (337 lines) |
| **Route** | `/admin/users/roles` |
| **Auth** | Admin |
| **Displays** | Role list with permission matrices, create/edit role modal |
| **Actions** | Create role, edit permissions (CRUD per resource), delete role |
| **API** | `GET /admin/roles`, `POST /admin/roles`, `PUT /admin/roles/:id`, `DELETE /admin/roles/:id` |

#### 8.7 Create User
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/create/page.tsx` (298 lines) |
| **Route** | `/admin/users/create` |
| **Auth** | Admin |
| **Displays** | User creation form: name, email, phone, password, role selection |
| **API** | `POST /admin/users` |

#### 8.8 User Detail / Edit
| Property | Value |
|---|---|
| **File** | `src/app/admin/users/[id]/page.tsx` (434 lines) |
| **Route** | `/admin/users/:id` |
| **Auth** | Admin |
| **Displays** | User profile, edit form, role assignment, permission overrides, activity log |
| **Actions** | Update profile, change role, set per-user permission overrides, deactivate/activate |
| **API** | `GET /admin/users/:id`, `PUT /admin/users/:id`, permission override endpoints |

---

## 9. ADMIN PAGES — SETTINGS

#### 9.1 General Settings
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/page.tsx` (622 lines) |
| **Route** | `/admin/settings` |
| **Auth** | Admin |
| **Displays** | Business info (name, tagline, description, logo, address), contact info, operational settings, module configuration |
| **API** | `GET /settings`, `PUT /settings` |

#### 9.2 Navbar Configuration
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/navbar/page.tsx` (350 lines) |
| **Route** | `/admin/settings/navbar` |
| **Auth** | Admin |
| **Displays** | Navbar link list with drag-and-drop reordering |
| **Actions** | Add link (internal page, external URL, or module link), edit, delete, reorder |
| **API** | `GET /settings/navbar`, `PUT /settings/navbar` |

#### 9.3 Translations
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/translations/page.tsx` (1074 lines) |
| **Route** | `/admin/settings/translations` |
| **Auth** | Admin |
| **Displays** | Translation key/value editor with locale tabs (en, ar, fr), search, namespace grouping |
| **Actions** | Edit translation, auto-translate via API, import/export JSON, bulk operations |
| **API** | `GET /settings/translations`, `PUT /settings/translations`, `POST /settings/translations/auto-translate` |

#### 9.4 Notifications
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/notifications/page.tsx` (1174 lines) |
| **Route** | `/admin/settings/notifications` |
| **Auth** | Admin |
| **Displays** | Notification templates (email, SMS, push), trigger configuration, scheduling, recipient rules |
| **Actions** | Create/edit notification template, set triggers (on order, on booking, etc.), schedule, test send |
| **API** | `GET /settings/notifications`, `POST /settings/notifications`, `PUT /settings/notifications/:id` |

#### 9.5 Tax Configuration
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/tax/page.tsx` (711 lines) |
| **Route** | `/admin/settings/tax` |
| **Auth** | Admin |
| **Displays** | Multi-rate tax setup: VAT, sales tax, service charge, tourism tax |
| **Actions** | Configure tax rates per category, set inclusive/exclusive tax, apply per module |
| **API** | `GET /settings/tax`, `PUT /settings/tax` |

#### 9.6 Homepage CMS
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/homepage/page.tsx` (565 lines) |
| **Route** | `/admin/settings/homepage` |
| **Auth** | Admin |
| **Displays** | Homepage section manager: hero slides (image/title/subtitle/CTA), features section, stats, testimonials, map, CTA |
| **Actions** | Add/edit/remove hero slides, toggle sections on/off, reorder sections |
| **API** | `GET /settings/homepage`, `PUT /settings/homepage` |

#### 9.7 Payments
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/payments/page.tsx` (637 lines) |
| **Route** | `/admin/settings/payments` |
| **Auth** | Admin |
| **Displays** | Payment history with stats (total, refunds, pending), Stripe configuration (API keys, webhook), payment method toggles |
| **API** | `GET /admin/payments`, `GET /admin/payments/stats`, `PUT /settings/payments` |

#### 9.8 Backups
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/backups/page.tsx` (529 lines) |
| **Route** | `/admin/settings/backups` |
| **Auth** | Admin |
| **Displays** | Backup list with size, date, type (manual/scheduled) |
| **Actions** | Create backup, download backup, restore from backup, delete old backups |
| **API** | `GET /admin/backups`, `POST /admin/backups`, `POST /admin/backups/:id/restore`, `DELETE /admin/backups/:id` |

#### 9.9 Footer Configuration
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/footer/page.tsx` (461 lines) |
| **Route** | `/admin/settings/footer` |
| **Auth** | Admin |
| **Displays** | Footer column editor (title + links), social media links, copyright text |
| **Actions** | Add/edit/remove columns, add/edit links, configure social icons |
| **API** | `GET /settings/footer`, `PUT /settings/footer` |

#### 9.10 Appearance / Theme
| Property | Value |
|---|---|
| **File** | `src/app/admin/settings/appearance/page.tsx` (587 lines) |
| **Route** | `/admin/settings/appearance` |
| **Auth** | Admin |
| **Displays** | Theme selector (beach/mountain/sunset/forest/midnight/luxury), weather effects toggle, sound settings, transition style picker |
| **Actions** | Select theme, toggle effects, preview |
| **API** | `PUT /settings/appearance` |
| **State** | `useSettingsStore` for local preferences |

---

## 10. ADMIN PAGES — BUSINESS OPERATIONS

#### 10.1 Orders (Cross-Module)
| Property | Value |
|---|---|
| **File** | `src/app/admin/orders/page.tsx` (578 lines) |
| **Route** | `/admin/orders` |
| **Auth** | Admin |
| **Displays** | All orders across modules with status filters, search, date range, real-time updates |
| **Real-time** | WebSocket for new/updated orders |
| **Actions** | Update status, view details, filter by module/status/date |
| **API** | `GET /admin/orders`, `PUT /admin/orders/:id/status` |

#### 10.2 Coupons
| Property | Value |
|---|---|
| **File** | `src/app/admin/coupons/page.tsx` (666 lines) |
| **Route** | `/admin/coupons` |
| **Auth** | Admin |
| **Displays** | Coupon list with code, type, value, usage stats, expiry |
| **Discount Types** | `percentage`, `fixed`, `free_item` |
| **Actions** | Create, edit, delete, toggle active, set usage limits/expiry/min order |
| **API** | `GET /admin/coupons`, `POST /admin/coupons`, `PUT /admin/coupons/:id`, `DELETE /admin/coupons/:id` |

#### 10.3 Gift Cards (Admin)
| Property | Value |
|---|---|
| **File** | `src/app/admin/giftcards/page.tsx` (596 lines) |
| **Route** | `/admin/giftcards` |
| **Auth** | Admin |
| **Displays** | Gift card list (code, balance, recipient, status), template manager |
| **Actions** | View details, adjust balance, deactivate, manage templates |
| **API** | `GET /admin/giftcards`, `PUT /admin/giftcards/:id` |

#### 10.4 Channels (OTA)
| Property | Value |
|---|---|
| **File** | `src/app/admin/channels/page.tsx` (577 lines) |
| **Route** | `/admin/channels` |
| **Auth** | Admin |
| **Displays** | OTA channel list (Booking.com, Expedia, Airbnb, TripAdvisor, Hotels.com, Agoda), connection status, sync status |
| **Actions** | Connect/disconnect channel, configure sync rules, force sync, view sync log |
| **API** | `GET /admin/channels`, `POST /admin/channels/:id/connect`, `POST /admin/channels/:id/sync` |

#### 10.5 Inventory
| Property | Value |
|---|---|
| **File** | `src/app/admin/inventory/page.tsx` (1321 lines) |
| **Route** | `/admin/inventory` |
| **Auth** | Admin |
| **Displays** | Full inventory management: categories, items with stock levels, low-stock alerts, cost tracking, supplier info |
| **Actions** | CRUD items, adjust stock (add/remove/set), create categories, bulk import/export, set reorder levels |
| **API** | `inventoryApi.getItems()`, CRUD endpoints, stock adjustment endpoints |

#### 10.6 Reviews
| Property | Value |
|---|---|
| **File** | `src/app/admin/reviews/page.tsx` (435 lines) |
| **Route** | `/admin/reviews` |
| **Auth** | Admin |
| **Displays** | Review list by service type, rating distribution, response management |
| **Actions** | Respond to review, flag inappropriate, filter by rating/service/date |
| **API** | `GET /admin/reviews`, `POST /admin/reviews/:id/respond` |

#### 10.7 Reports — Revenue
| Property | Value |
|---|---|
| **File** | `src/app/admin/reports/page.tsx` (681 lines) |
| **Route** | `/admin/reports` |
| **Auth** | Admin |
| **Displays** | Revenue reports with charts, occupancy data, customer analytics, date range filters |
| **API** | `GET /admin/reports/revenue`, `GET /admin/reports/occupancy`, `GET /admin/reports/customers` |

#### 10.8 Reports — Scheduled
| Property | Value |
|---|---|
| **File** | `src/app/admin/reports/scheduled/page.tsx` (506 lines) |
| **Route** | `/admin/reports/scheduled` |
| **Auth** | Admin |
| **Displays** | Scheduled report list with frequency (daily/weekly/monthly), recipients, last run |
| **Actions** | Create, edit, delete, toggle active, set recipients |
| **API** | `GET /admin/reports/scheduled`, CRUD endpoints |

#### 10.9 Reports — Analytics
| Property | Value |
|---|---|
| **File** | `src/app/admin/reports/analytics/page.tsx` (743 lines) |
| **Route** | `/admin/reports/analytics` |
| **Auth** | Admin |
| **Displays** | 10 report categories: Executive Summary, Sales Analysis, Occupancy, Customer Insights, Staff Performance, Revenue Breakdown, Peak Times, Channel Performance, Menu Performance, Season Comparison |
| **API** | `GET /admin/reports/analytics/:type` |

#### 10.10 Properties (Multi-Property)
| Property | Value |
|---|---|
| **File** | `src/app/admin/properties/page.tsx` (632 lines) |
| **Route** | `/admin/properties` |
| **Auth** | Admin |
| **Displays** | Property list (name, address, status), create/edit property modal |
| **Actions** | CRUD properties, set as primary, configure per-property settings |
| **API** | `GET /admin/properties`, CRUD endpoints |

#### 10.11 Audit Log
| Property | Value |
|---|---|
| **File** | `src/app/admin/audit/page.tsx` (468 lines) |
| **Route** | `/admin/audit` |
| **Auth** | Admin |
| **Displays** | Audit log table: timestamp, user, action (CREATE/UPDATE/DELETE/LOGIN), resource type, details, IP address |
| **Filters** | Action type, resource type, user, date range |
| **API** | `GET /admin/audit` |

#### 10.12 Terminology
| Property | Value |
|---|---|
| **File** | `src/app/admin/terminology/page.tsx` (139 lines) |
| **Route** | `/admin/terminology` |
| **Auth** | Admin |
| **Displays** | Customizable business terminology labels (e.g., "Chalet" → "Villa", "Pool" → "Aqua Park") |
| **Actions** | Edit terminology mappings per entity category (unit, facility, dining) |
| **API** | terminology settings endpoint |

#### 10.13 Loyalty Program (Admin)
| Property | Value |
|---|---|
| **File** | `src/app/admin/loyalty/page.tsx` (890 lines) |
| **Route** | `/admin/loyalty` |
| **Auth** | Admin |
| **Displays** | Tabs: Tiers (Bronze/Silver/Gold/Platinum config), Accounts (member list, points balances), Points (earning rules), Rewards (redeemable rewards catalog) |
| **Actions** | CRUD tiers, adjust member points, configure earning rules (points per $), manage rewards |
| **API** | `GET /admin/loyalty/tiers`, `GET /admin/loyalty/accounts`, CRUD endpoints |

#### 10.14 Kiosk Management
| Property | Value |
|---|---|
| **File** | `src/app/admin/kiosk/page.tsx` (451 lines) |
| **Route** | `/admin/kiosk` |
| **Auth** | Admin |
| **Displays** | Kiosk device list (name, location, status: online/offline, last heartbeat) |
| **Actions** | Register device, edit, deactivate, send restart command |
| **API** | `GET /admin/kiosk/devices`, CRUD endpoints |

---

## 11. ADMIN PAGES — DYNAMIC MODULE MANAGEMENT [slug]

These pages provide per-module management under `/admin/:slug/...`.

#### 11.1 Menu Items
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/menu/page.tsx` (913 lines) |
| **Route** | `/admin/:slug/menu` |
| **Auth** | Admin |
| **Template** | `menu_service` |
| **Displays** | Menu item list: name (en + ar), price, category, image, availability, featured, dietary flags (vegetarian/spicy), allergens, recipe (linked inventory items) |
| **Actions** | CRUD items, upload image, set allergens, link recipe ingredients, toggle featured/available |
| **API** | `GET /restaurant/menu?moduleId=`, `POST /restaurant/menu`, `PUT /restaurant/menu/:id`, `DELETE /restaurant/menu/:id` |

#### 11.2 Categories
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/categories/page.tsx` (300 lines) |
| **Route** | `/admin/:slug/categories` |
| **Auth** | Admin |
| **Template** | `menu_service` |
| **Displays** | Category list with name, description, sort order, item count, active toggle |
| **Actions** | CRUD categories, reorder (drag handle) |
| **API** | `GET /restaurant/categories?moduleId=`, CRUD endpoints |

#### 11.3 Orders (Per-Module)
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/orders/page.tsx` (361 lines) |
| **Route** | `/admin/:slug/orders` |
| **Auth** | Admin |
| **Template** | `menu_service` |
| **Displays** | Order kanban/list: order number, status (pending→confirmed→preparing→ready→delivered→cancelled), items, total, table number, customer, time elapsed |
| **Real-time** | Socket.io for new orders + status changes |
| **Actions** | Update order status (advance through flow), search |
| **API** | `GET /restaurant/staff/orders?moduleId=`, `PUT /restaurant/staff/orders/:id/status` |

#### 11.4 Modifiers
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/modifiers/page.tsx` (714 lines) |
| **Route** | `/admin/:slug/modifiers` |
| **Auth** | Admin |
| **Template** | `menu_service` |
| **Displays** | Modifier groups with expandable options: group name (en + ar), selection rules (min/max), required flag, options (name, price adjustment, type: add/remove/swap, default, max quantity) |
| **Actions** | CRUD groups and options, reorder |
| **API** | `GET /restaurant/modifiers?moduleId=`, CRUD endpoints |

#### 11.5 Tables
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/tables/page.tsx` (372 lines) |
| **Route** | `/admin/:slug/tables` |
| **Auth** | Admin |
| **Template** | `menu_service` |
| **Displays** | Table grid: number, capacity, availability status, location, QR code |
| **Actions** | CRUD tables, generate QR code (links to `/order?table=N`), toggle availability |
| **API** | `GET /restaurant/staff/tables?moduleId=`, CRUD endpoints |

#### 11.6 Reservations
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/reservations/page.tsx` (446 lines) |
| **Route** | `/admin/:slug/reservations` |
| **Auth** | Admin |
| **Template** | `menu_service` |
| **Displays** | Reservation list: date, time, party size, guest name/phone, status (pending/confirmed/seated/completed/cancelled/no_show), table assignment |
| **Actions** | Create reservation, update status, assign table, add walk-in, date navigation |
| **API** | React Query: `GET /restaurant/reservations?moduleId=`, mutation endpoints |

#### 11.7 Waitlist
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/waitlist/page.tsx` (487 lines) |
| **Route** | `/admin/:slug/waitlist` |
| **Auth** | Admin |
| **Template** | `menu_service` |
| **Displays** | Waitlist queue: position, guest name, party size, phone, status (waiting/notified/seated/cancelled/no_show), estimated wait, time joined |
| **Actions** | Add entry, notify guest (SMS), seat, cancel, mark no-show |
| **API** | React Query: `GET /:slug/waitlist?moduleId=`, mutation endpoints |

#### 11.8 Sessions
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/sessions/page.tsx` (480 lines) |
| **Route** | `/admin/:slug/sessions` |
| **Auth** | Admin |
| **Template** | `session_access` |
| **Displays** | Session list: name (en + ar), start/end time, adult/child price, max capacity, current occupancy, active toggle, day-of-week schedule, icon (Sun/Sunset/Moon by time) |
| **Actions** | CRUD sessions, set price, set capacity, configure day-of-week availability |
| **API** | `GET /pool/sessions?moduleId=`, CRUD endpoints |

#### 11.9 Tickets
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/tickets/page.tsx` (365 lines) |
| **Route** | `/admin/:slug/tickets` |
| **Auth** | Admin |
| **Template** | `session_access` |
| **Displays** | Ticket list: ticket number, type (adult/child/family/VIP), status (pending/active/valid/used/expired/cancelled), date, price, customer info, payment status, QR code |
| **Actions** | View detail modal, filter by status |
| **API** | `GET /pool/tickets?moduleId=` |

#### 11.10 Capacity
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/capacity/page.tsx` (235 lines) |
| **Route** | `/admin/:slug/capacity` |
| **Auth** | Admin |
| **Template** | `session_access` |
| **Displays** | Capacity settings: max capacity, current capacity (live), warning threshold, utilization percentage bar |
| **Actions** | Update max capacity, update warning threshold |
| **API** | `GET /pool/capacity?moduleId=`, `PUT /pool/capacity` |

#### 11.11 Bookings
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/bookings/page.tsx` (424 lines) |
| **Route** | `/admin/:slug/bookings` |
| **Auth** | Admin |
| **Template** | `multi_day_booking` |
| **Displays** | Booking list: booking number, status (pending/confirmed/checked_in/checked_out/cancelled/no_show), dates, unit name, guest info, total amount, add-ons, payment status |
| **Actions** | Update status (confirm, check-in, check-out, cancel), view detail modal, search, date filter |
| **API** | `GET /chalets/bookings?moduleId=`, `PUT /chalets/bookings/:id/status` |

#### 11.12 Pricing Rules
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/pricing/page.tsx` (394 lines) |
| **Route** | `/admin/:slug/pricing` |
| **Auth** | Admin |
| **Template** | `multi_day_booking` |
| **Displays** | Pricing rule list: name, base price, weekend price, holiday price, per-guest price, min/max guests, date range, active toggle |
| **Actions** | CRUD pricing rules, set seasonal rates |
| **API** | `GET /chalets/pricing-rules?moduleId=`, CRUD endpoints |

#### 11.13 Add-ons
| Property | Value |
|---|---|
| **File** | `src/app/admin/[slug]/addons/page.tsx` (370 lines) |
| **Route** | `/admin/:slug/addons` |
| **Auth** | Admin |
| **Template** | `multi_day_booking` |
| **Displays** | Add-on list: name (en + ar), description, price, image, availability toggle |
| **Actions** | CRUD add-ons, upload image |
| **API** | `GET /chalets/add-ons?moduleId=`, CRUD endpoints |

#### 11.14 Customizations
| Property | Value |
|---|---|
| **File** | `src/app/admin/customizations/page.tsx` (1271 lines) |
| **Route** | `/admin/customizations` |
| **Auth** | Admin |
| **Displays** | Customization group manager: groups with options, entity type mapping (menu_item/chalet/pool_session), selection mode (single/multiple/quantity), price types (fixed/percentage/per_unit/per_night/per_person) |
| **Types** | `add`, `remove`, `swap`, `upgrade`, `replace` |
| **Actions** | CRUD customization groups and options, assign to entity types, set pricing, filter by module |
| **API** | Customization endpoints |

---

## 12. ADMIN PAGES — PER-MODULE SETTINGS

These are accessible under `/:slug/admin/settings/...` (public route with admin auth).

#### 12.1 Module Pricing Settings
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/admin/settings/pricing/page.tsx` (815 lines) |
| **Route** | `/:slug/admin/settings/pricing` |
| **Auth** | Admin |
| **Displays** | Comprehensive pricing configuration: base prices, seasonal rates, group discounts, early bird discounts, package deals |

#### 12.2 Email Configuration
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/admin/settings/email/page.tsx` (466 lines) |
| **Route** | `/:slug/admin/settings/email` |
| **Auth** | Admin |
| **Displays** | Email provider setup: SMTP, SendGrid, Amazon SES, Mailgun, Postmark |
| **Actions** | Configure provider, test connection, set sender info |

#### 12.3 Branding
| Property | Value |
|---|---|
| **File** | `src/app/[slug]/admin/settings/branding/page.tsx` (940 lines) |
| **Route** | `/:slug/admin/settings/branding` |
| **Auth** | Admin |
| **Displays** | Business branding: logo upload, primary/secondary colors, typography, contact info, social links |

---

## 13. STAFF PAGES

#### 13.1 Staff Dashboard
| Property | Value |
|---|---|
| **File** | `src/app/staff/page.tsx` (383 lines) |
| **Route** | `/staff` |
| **Auth** | Staff/Manager/Admin |
| **Displays** | Quick stats (pending orders, completed today, issues, avg response time), module quick-links (dynamically generated from active modules), recent activity feed |
| **Real-time** | Socket.io for live updates |
| **API** | Staff dashboard stats endpoint |

#### 13.2 QR Scanner
| Property | Value |
|---|---|
| **File** | `src/app/staff/scanner/page.tsx` (329 lines) |
| **Route** | `/staff/scanner` |
| **Auth** | Staff |
| **Displays** | Manual code input (optimized for barcode scanner hardware), validation result (success/fail), scan history log |
| **Actions** | Validate ticket/booking QR code → check-in/mark as used |
| **API** | `POST /pool/tickets/validate` (or booking validate endpoint) |
| **States** | Idle, scanning, success (green), failure (red), history |

#### 13.3 Restaurant Staff (Kitchen Display)
| Property | Value |
|---|---|
| **File** | `src/app/staff/restaurant/page.tsx` (435 lines) |
| **Route** | `/staff/restaurant` |
| **Auth** | Restaurant staff/admin/manager |
| **Displays** | Kitchen display board: order cards with order number, type (dine_in/takeaway/delivery), items with modifiers, table number, time elapsed, status |
| **Real-time** | `useRestaurantOrders()` hook (Socket.io) for live order stream |
| **Actions** | Advance order status through flow (pending→confirmed→preparing→ready→served→completed), cancel order |
| **Status Flow** | pending → confirmed → preparing → ready → served → completed |

#### 13.4 Snack Staff
| Property | Value |
|---|---|
| **File** | `src/app/staff/snack/page.tsx` (492 lines) |
| **Route** | `/staff/snack` |
| **Auth** | Snack staff |
| **Displays** | Snack order list with status cards, filter (active/all), search |
| **Real-time** | Socket.io for new orders |
| **Actions** | Advance order status (pending→preparing→ready→delivered→completed), cancel |
| **API** | `GET /snack/staff/orders`, `PUT /snack/staff/orders/:id/status` |

#### 13.5 Pool Staff
| Property | Value |
|---|---|
| **File** | `src/app/staff/pool/page.tsx` (686 lines) |
| **Route** | `/staff/pool` |
| **Auth** | Pool staff |
| **Displays** | Tabs: Tickets (today's tickets with validation), Capacity (live capacity by session), Maintenance |
| **Real-time** | Socket.io for ticket scans / capacity changes |
| **Actions** | Validate ticket (scan/manual), record entry/exit, view capacity gauge |
| **API** | `GET /pool/staff/tickets`, `POST /pool/tickets/validate`, capacity endpoints |
| **Components** | `MaintenanceTab` (sub-component for pool maintenance tasks) |

#### 13.6 Chalets Staff
| Property | Value |
|---|---|
| **File** | `src/app/staff/chalets/page.tsx` (582 lines) |
| **Route** | `/staff/chalets` |
| **Auth** | Chalets staff |
| **Displays** | Booking list with status cards: booking number, chalet name, dates, guest info, payment, add-ons, special requests |
| **Real-time** | Socket.io |
| **Actions** | Check-in, check-out, cancel, mark no-show, search, filter by status |
| **API** | `GET /chalets/staff/bookings`, `PUT /chalets/bookings/:id/status` |

#### 13.7 Bookings Staff (Generic)
| Property | Value |
|---|---|
| **File** | `src/app/staff/bookings/page.tsx` (345 lines) |
| **Route** | `/staff/bookings` |
| **Auth** | Staff |
| **Displays** | Cross-module booking list with pagination, status badges, guest info, chalet/unit names |
| **Actions** | Check-in, check-out, view details, search, paginate |
| **API** | `GET /chalets/staff/bookings` with pagination |

#### 13.8 Customer Lookup
| Property | Value |
|---|---|
| **File** | `src/app/staff/customers/page.tsx` (363 lines) |
| **Route** | `/staff/customers` |
| **Auth** | Staff |
| **Displays** | Customer search (by phone/email/name), customer profile card with: loyalty tier/points, gift card balance, recent orders, recent bookings |
| **Actions** | Search customer, view history |
| **API** | `GET /staff/customers/search?type=&query=` |
| **States** | Empty search, searching, found, not found |

#### 13.9 Manager Dashboard
| Property | Value |
|---|---|
| **File** | `src/app/staff/manager/page.tsx` (713 lines) |
| **Route** | `/staff/manager` |
| **Auth** | Manager role required |
| **Displays** | Tabs: Overview (revenue stats, pending/completed orders, active staff, issues), Approvals (pending refunds/discounts/overrides/voids), Staff (active staff list with performance), Reports (quick revenue breakdown) |
| **Actions** | Approve/reject pending requests (refunds, discounts), export report |
| **API** | `GET /staff/manager/overview`, `GET /staff/manager/approvals`, `PUT /staff/manager/approvals/:id` |

#### 13.10 Dynamic Module Staff Page
| Property | Value |
|---|---|
| **File** | `src/app/staff/[slug]/page.tsx` (71 lines) |
| **Route** | `/staff/:slug` |
| **Auth** | Staff |
| **Logic** | Fetches module by slug, renders by template_type: |
| | • `menu_service` → `<KitchenView>` component |
| | • `session_access` → `<SessionAccessDashboard>` component |
| | • `multi_day_booking` → `<MultiDayBookingDashboard>` component |
| **States** | Loading spinner, module not found, unsupported type |

#### 13.11 Dynamic Module Sessions (Staff)
| Property | Value |
|---|---|
| **File** | `src/app/staff/[slug]/sessions/page.tsx` (109 lines) |
| **Route** | `/staff/:slug/sessions` |
| **Auth** | Staff |
| **Displays** | Session cards: name, time, capacity, price, active badge |
| **API** | `GET /:slug/sessions` |

#### 13.12 Dynamic Module Capacity (Staff)
| Property | Value |
|---|---|
| **File** | `src/app/staff/[slug]/capacity/page.tsx` (144 lines) |
| **Route** | `/staff/:slug/capacity` |
| **Auth** | Staff |
| **Displays** | Live capacity per session: progress bars, sold/admitted/pending/available counts |
| **Polling** | Refreshes every 30 seconds |
| **API** | `GET /:slug/staff/capacity` |

#### 13.13 Dynamic Module Tickets (Staff)
| Property | Value |
|---|---|
| **File** | `src/app/staff/[slug]/tickets/page.tsx` (204 lines) |
| **Route** | `/staff/:slug/tickets` |
| **Auth** | Staff |
| **Displays** | Today's tickets list with validation, manual QR code input, scan history |
| **Actions** | Validate ticket (manual code entry), view ticket details |
| **API** | `GET /:slug/staff/tickets/today`, `POST /:slug/tickets/validate` |

#### 13.14 Dynamic Module Staff (via modules/)
| Property | Value |
|---|---|
| **File** | `src/app/staff/modules/[slug]/page.tsx` |
| **Route** | `/staff/modules/:slug` |
| **Auth** | Staff |
| **Note** | Duplicate/alternate path for dynamic module staff view — same behavior as `staff/[slug]` (renders KitchenView / SessionAccessDashboard / MultiDayBookingDashboard) |

---

## 14. REMAINING ADMIN PAGES

#### 14.1 Integrations Hub
| Property | Value |
|---|---|
| **File** | `src/app/admin/integrations/page.tsx` (116 lines) |
| **Route** | `/admin/integrations` |
| **Auth** | Admin |
| **Displays** | Integration cards: QuickBooks (available), Stripe, Mailchimp, Google Analytics, Zapier, Twilio (all "coming soon") |
| **Actions** | Navigate to integration-specific pages |

#### 14.2 QuickBooks Integration
| Property | Value |
|---|---|
| **File** | `src/app/admin/integrations/quickbooks/page.tsx` (571 lines) |
| **Route** | `/admin/integrations/quickbooks` |
| **Auth** | Admin |
| **Displays** | Tabs: Connection (status, company info, connect/disconnect), Settings (sync toggles, account mapping), History (sync log with records processed/synced/failed) |
| **Actions** | Connect to QuickBooks, disconnect, configure auto-sync, manual sync trigger, map accounts |
| **API** | QuickBooks integration endpoints (connect, disconnect, sync, history, mappings) |

#### 14.3 Housekeeping
| Property | Value |
|---|---|
| **File** | `src/app/admin/housekeeping/page.tsx` (717 lines) |
| **Route** | `/admin/housekeeping` |
| **Auth** | Admin |
| **Displays** | Task board: tasks with chalet/room, type, priority (low/normal/high/urgent), status (pending/in_progress/completed/cancelled/on_hold), assignee, time tracking, checklist |
| **Actions** | Create task, assign staff, start/pause/complete task, set priority, filter by status/priority/assignee |
| **Task Types** | Configurable (with estimated duration and checklist template) |
| **API** | `GET /admin/housekeeping/tasks`, CRUD endpoints, status update endpoints |

---

## 15. STATE MANAGEMENT

### 15.1 Zustand Stores

| Store | File | Purpose |
|---|---|---|
| `useCartStore` | `src/stores/cartStore.ts` (195 lines) | Persisted cart with 3 item arrays: `items` (generic), `restaurantItems`, `snackItems`. Supports modifiers via unique key generation. Actions: add/remove/updateQuantity/updateInstructions/clear per array. Totals computed from items + modifier adjustments. |
| `useSettingsStore` | `src/stores/settingsStore.ts` (87 lines) | Persisted user preferences: resort theme, animations toggle, reduced motion, sound, notification sound, currency (USD/EUR/LBP with exchange rates), page transition style, loading animation toggle. |
| `module-builder-store` | `src/store/module-builder-store.ts` | Zustand store for the drag-and-drop module builder: components, layout, undo/redo history, zoom level, selected component. |

### 15.2 Context Providers

| Context | File | Purpose |
|---|---|---|
| Auth | `src/lib/auth-context.tsx` | `useAuth()` — user object, login/logout/register/verify2FA, isAuthenticated, isLoading, role checks |
| Site Settings | `src/lib/settings-context.tsx` | `useSiteSettings()` — modules, business settings, theme, terminology, cached from server |
| Settings Hydration | `src/lib/hydrate-settings.tsx` | Server→client settings hydration for SSR |

---

## 16. API LAYER

### 16.1 Centralized API Client
**File:** `src/lib/api.ts` (436 lines)

| Export | Base Path | Methods |
|---|---|---|
| `api` (default) | Axios instance, base: `{BACKEND_URL}/api/v1` | All HTTP methods, auto-attaches JWT from cookies, handles 401 refresh |
| `authApi` | `/auth/*` | login, register, logout, refreshToken, forgotPassword, resetPassword, getProfile, 2FA (setup, enable, disable, verify, regenerateBackupCodes) |
| `restaurantApi` | `/restaurant/*` | getMenu, getMenuByCategory, createOrder, getMyOrders, getOrderStatus |
| `snackApi` | `/snack/*` | getItems, createOrder, getMyOrders, getOrder |
| `chaletsApi` | `/chalets/*` | getChalets, getChalet, getAvailability, getAddOns, createBooking, getMyBookings, getBookingDetails |
| `poolApi` | `/pool/*` | getSessions, getSession, getSessionAvailability, getAvailability, purchaseTicket, getMyTickets, getTicket |
| `modulesApi` | `/admin/modules/*` | getAll, getById, create, update, delete |
| `inventoryApi` | `/inventory/*` | getItems, getRecipe, updateRecipe, getSessionRecipe, updateSessionRecipe |
| `paymentsApi` | `/payments/*` | createPaymentIntent |
| `supportApi` | `/support/*` | submitContact |

### 16.2 Server API
**File:** `src/lib/server-api.ts` — Server-side API calls for SSR/SSG (settings fetch in root layout)

### 16.3 Services
**File:** `src/services/beta-testing.service.ts` — Beta testing feature flag service

---

## 17. COMPONENT LIBRARY

### 17.1 UI Components (`src/components/ui/` — 28 files)
Accordion, Alert, AlertDialog, AnimatedComponents, Badge, Button, Calendar, Card, Checkbox, ContextMenu, Dialog, Form, Input, Label, Popover, Portal, Progress, QRCode, Select, Separator, Skeleton, Slider, Switch, Table, Tabs, Textarea, Tooltip, TranslatedText

### 17.2 Feature Components (select)
| Component | File | Purpose |
|---|---|---|
| Footer | `src/components/Footer.tsx` | Site footer (CMS-configured columns/links/socials) |
| InteractiveResortMap | `src/components/InteractiveResortMap.tsx` | SVG resort map with clickable areas |
| LiveChatWidget | `src/components/LiveChatWidget.tsx` | Live chat bubble |
| TestimonialsCarousel | `src/components/TestimonialsCarousel.tsx` | Testimonial slider |
| WeatherWidget | `src/components/WeatherWidget.tsx` | Current weather display |
| ParallaxHero | `src/components/ParallaxHero.tsx` | Parallax scrolling hero section |
| KitchenDisplayBoard | `src/components/KitchenDisplayBoard.tsx` | Restaurant kitchen display |
| RestaurantFloorPlan | `src/components/RestaurantFloorPlan.tsx` | Visual table layout |
| ErrorBoundary | `src/components/ErrorBoundary.tsx` | React error boundary |
| LanguageSwitcher | `src/components/LanguageSwitcher.tsx` | en/ar/fr locale switcher |
| CurrencySwitcher | `src/components/CurrencySwitcher.tsx` | USD/EUR/LBP currency switcher |
| CookieConsentBanner | `src/components/CookieConsentBanner.tsx` | GDPR cookie consent |
| SessionTimeoutMonitor | `src/components/SessionTimeoutMonitor.tsx` | Idle session timeout warning |
| DepthElements | `src/components/DepthElements.tsx` | 3D depth visual effects |
| DirectionSync | `src/components/DirectionSync.tsx` | RTL/LTR direction sync |
| BookingModificationModal | `src/components/BookingModificationModal.tsx` | Modify existing booking |
| Wishlist | `src/components/Wishlist.tsx` | Saved items wishlist |
| ThemeProvider | `src/components/ThemeProvider.tsx` | Dark/light mode provider |
| ThemeToggle | `src/components/ThemeToggle.tsx` | Dark/light toggle button |
| ThemeInjector | `src/components/ThemeInjector.tsx` | CSS variable injection for resort themes |
| PasswordStrengthMeter | `src/components/PasswordStrengthMeter.tsx` | Password strength indicator |
| PageTracker | `src/components/PageTracker.tsx` | Analytics page view tracking |

### 17.3 Module Components (`src/components/modules/`)
| Component | Purpose |
|---|---|
| `MenuService.tsx` | Generic menu service renderer for dynamic modules |
| `BookingService.tsx` | Generic booking service renderer for dynamic modules |
| `SessionService.tsx` | Generic session/ticket service renderer for dynamic modules |

### 17.4 Staff Components (`src/components/staff/`)
| Component | Purpose |
|---|---|
| `KitchenView.tsx` | Kitchen display for any menu_service module |
| `SessionAccessDashboard.tsx` | Staff dashboard for any session_access module |
| `types.ts` | Shared staff type definitions |

### 17.5 Admin Components (`src/components/admin/`)
- `ColorPicker.tsx` — Color selection for branding
- `FontSelector.tsx` — Font selection for branding
- `WeatherWidgetConfig.tsx` — Weather widget admin config
- `RoleAssignmentModal.tsx` — Role assignment dialog
- `restaurant/` — Restaurant-specific admin components
- `users/` — User management components (UserList, etc.)

### 17.6 Other Component Directories
- `src/components/payments/` — StripePayment, payment form components
- `src/components/pos/` — Point-of-sale components
- `src/components/pos-templates/` — POS receipt templates
- `src/components/pwa/` — PWA install prompt, offline indicator
- `src/components/effects/` — Visual effects (weather, particles)
- `src/components/layout/` — Layout components (Header, PageTransition)
- `src/components/common/` — Shared utilities
- `src/components/customer/` — Customer-facing shared components
- `src/components/customization/` — Customization selection UI
- `src/components/chalets/` — Chalet-specific components
- `src/components/settings/` — Settings form components
- `src/components/module-builder/` — Drag-and-drop builder components
- `src/components/providers/` — Context providers wrapper

---

## 18. HOOKS

| Hook | File | Purpose |
|---|---|---|
| `useCustomizations` | `src/hooks/useCustomizations.ts` | Fetch and manage customization groups for entities |
| `useIdleTimer` | `src/hooks/useIdleTimer.ts` | Detect user inactivity for session timeout |
| `useSocket` | `src/hooks/useSocket.ts` | Socket.io connection hook |
| `useTerminology` | `src/hooks/useTerminology.ts` | Get customized terminology labels |
| `useThemeSettings` | `src/hooks/useThemeSettings.ts` | Access theme configuration |
| `useDebounce` | `src/utils/performance` | Debounce utility |

Socket hooks in `src/lib/socket.ts`:
- `useSocket()` — Base socket connection
- `useRestaurantOrders()` — Real-time restaurant order stream

---

## 19. SUMMARY STATISTICS

| Metric | Count |
|---|---|
| Total `page.tsx` files | **107** |
| Total `layout.tsx` files | **8** |
| Public pages (no auth) | **10** |
| Customer module pages (hardcoded) | **17** |
| Customer module pages (dynamic [slug]) | **6** |
| Account/profile pages | **4** |
| Admin core pages | **4** |
| Admin user management pages | **8** |
| Admin settings pages | **10** |
| Admin business operations pages | **14** |
| Admin dynamic module [slug] pages | **14** |
| Admin per-module settings pages | **3** |
| Staff pages | **14** |
| Remaining admin pages (integrations, housekeeping, customizations) | **3** |
| **Accounted Total** | **107** |

### Route Summary by Auth Level

| Auth Level | Routes |
|---|---|
| **Public** | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/contact`, `/terms`, `/privacy`, `/cancellation`, `/offline`, `/restaurant`, `/restaurant/cart`, `/restaurant/reserve`, `/restaurant/waitlist`, `/restaurant/confirmation`, `/pool`, `/pool/confirmation`, `/chalets`, `/chalets/:id`, `/chalets/booking-confirmation`, `/snack-bar`, `/snack-bar/cart`, `/snack-bar/confirmation`, `/cart`, `/order`, `/giftcards`, `/kiosk`, `/:slug`, `/:slug/:unitId`, `/:slug/cart`, `/:slug/confirmation`, `/:slug/waitlist`, `/:slug/reserve` |
| **Authenticated (Customer+)** | `/profile`, `/account/loyalty`, `/account/privacy`, `/account/giftcards` |
| **Staff** | `/staff`, `/staff/scanner`, `/staff/restaurant`, `/staff/snack`, `/staff/pool`, `/staff/chalets`, `/staff/bookings`, `/staff/customers`, `/staff/:slug`, `/staff/:slug/sessions`, `/staff/:slug/capacity`, `/staff/:slug/tickets`, `/staff/modules/:slug` |
| **Manager** | `/staff/manager` |
| **Admin** | `/admin`, `/admin/modules`, `/admin/modules/builder/:id`, `/admin/:slug` (+ 13 sub-pages), `/admin/users/*` (8 pages), `/admin/settings/*` (10 pages), `/admin/orders`, `/admin/coupons`, `/admin/giftcards`, `/admin/channels`, `/admin/inventory`, `/admin/reviews`, `/admin/reports/*` (3 pages), `/admin/properties`, `/admin/audit`, `/admin/terminology`, `/admin/loyalty`, `/admin/kiosk`, `/admin/customizations`, `/admin/integrations`, `/admin/integrations/quickbooks`, `/admin/housekeeping`, `/:slug/admin/settings/*` (3 pages) |

---

*End of exhaustive inventory.*
