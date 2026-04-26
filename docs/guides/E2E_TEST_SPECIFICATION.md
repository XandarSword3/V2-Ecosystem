# V2 Resort — Complete E2E Test Specification

> **Generated from**: Exhaustive source-code and documentation analysis  
> **Source files examined**: PHASE_1_SYSTEM_MAP.md (1054 lines), PHASE_2_VERIFICATION_PROGRAM.md (2604 lines), PHASE3_E2E_REPORT.md (520 lines), ARCHITECTURE.md, USER_GUIDE.md (526 lines), README_OVERVIEW.md, 41 backend route files, 6 frontend source files, 2 seed scripts, all directory structures  
> **System**: Multi-module resort management platform  
> **Stack**: Next.js 14 + Express.js 4.18 + Supabase PostgreSQL + Stripe + Socket.IO

---

## TABLE OF CONTENTS

1. [Complete Route Map (Frontend)](#1-complete-route-map-frontend)
2. [Complete API Endpoint Map (Backend)](#2-complete-api-endpoint-map-backend)
3. [Cross-Actor Workflows](#3-cross-actor-workflows)
4. [Business Rules](#4-business-rules)
5. [Admin Settings That Affect Behavior](#5-admin-settings-that-affect-behavior)
6. [Seed Data](#6-seed-data)
7. [Staff Workflows](#7-staff-workflows)
8. [Frontend Component Details](#8-frontend-component-details)
9. [Implemented vs Stubbed](#9-implemented-vs-stubbed)

---

## 1. COMPLETE ROUTE MAP (FRONTEND)

Frontend runs on Next.js 14 App Router. Port 3000 (dev) / 3002 (per USER_GUIDE).

### Public Pages (No Auth Required)

| Route | Description | Engine |
|---|---|---|
| `/` | Homepage / landing page | — |
| `/login` | Login form | — |
| `/register` | Registration form | — |
| `/forgot-password` | Password reset request (KNOWN 404) | — |
| `/reset-password` | Password reset with token | — |
| `/restaurant` | Restaurant menu display | A |
| `/restaurant/cart` | Restaurant checkout (3-step: cart → info → payment) | A |
| `/restaurant/confirmation` | Order confirmation page | A |
| `/restaurant/reserve` | Table reservation form | — |
| `/restaurant/waitlist` | Waitlist sign-up (NOT rendering per PHASE3) | — |
| `/snack-bar` | Snack bar menu display | A |
| `/snack-bar/cart` | Snack bar checkout | A |
| `/snack-bar/confirmation` | Snack order confirmation | A |
| `/chalets` | Chalet listing with amenities/pricing | B |
| `/chalets/[id]` | Chalet detail + booking form | B |
| `/chalets/booking-confirmation` | Booking confirmation | B |
| `/pool` | Pool ticket purchase (date/session/counts) | C |
| `/pool/confirmation` | Pool ticket confirmation | C |
| `/cart` | Unified cart (all modules) | — |
| `/order` | QR table-side ordering | A |
| `/giftcards` | Gift card purchase/view (KNOWN 404) | — |
| `/contact` | Contact form | — |
| `/terms` | Terms & conditions | — |
| `/privacy` | Privacy policy | — |
| `/cancellation` | Cancellation policy | — |
| `/[slug]` | Dynamic module pages (white-label) | — |

### Authenticated User Pages

| Route | Description |
|---|---|
| `/profile` | User profile management |
| `/account` | Account dashboard |
| `/account/loyalty` | Loyalty points / tier display |
| `/account/giftcards` | User's gift cards |
| `/account/privacy` | Privacy settings / data export (GDPR) |

### Kiosk Mode

| Route | Description |
|---|---|
| `/kiosk` | Self-service kiosk interface |

### Staff Panel (requires staff/admin role)

| Route | Description |
|---|---|
| `/staff` | Staff dashboard |
| `/staff/restaurant` | Kitchen display / order management |
| `/staff/snack` | Snack bar order management |
| `/staff/pool` | Pool capacity / ticket management |
| `/staff/chalets` | Chalet check-in/out management |
| `/staff/bookings` | Booking overview |
| `/staff/customers` | Customer lookup |
| `/staff/scanner` | QR/barcode ticket scanner |
| `/staff/manager` | Manager tools |
| `/staff/modules` | Module-specific staff views |

### Admin Panel (requires admin/super_admin role)

| Route | Sub-route | Description |
|---|---|---|
| `/admin` | — | Admin dashboard with metrics |
| `/admin/modules` | — | Module CRUD (enable/disable/configure) |
| `/admin/orders` | — | All orders across modules |
| `/admin/users` | `/customers` | Customer management |
| | `/staff` | Staff management |
| | `/admins` | Admin management |
| | `/roles` | Role management with permissions |
| | `/create` | User creation |
| | `/live` | Live connected users |
| `/admin/settings` | `/appearance` | Theme, branding, logo |
| | `/backups` | Backup/restore |
| | `/footer` | Footer configuration |
| | `/homepage` | Homepage layout/content |
| | `/navbar` | Navigation configuration |
| | `/notifications` | Notification templates |
| | `/payments` | Payment gateway settings |
| | `/tax` | Tax rates, service charges |
| | `/translations` | i18n management |
| `/admin/coupons` | — | Coupon CRUD |
| `/admin/giftcards` | — | Gift card management |
| `/admin/loyalty` | — | Loyalty program config (tiers, points) |
| `/admin/inventory` | — | Inventory items, categories, alerts |
| `/admin/reviews` | — | Review moderation |
| `/admin/reports` | `/scheduled` | Scheduled reports |
| | `/analytics` | Analytics dashboards |
| `/admin/audit` | — | Audit log viewer |
| `/admin/housekeeping` | — | Housekeeping tasks/schedules |
| `/admin/properties` | — | Multi-property management |
| `/admin/channels` | — | Distribution channels |
| `/admin/integrations` | — | Third-party integrations |
| `/admin/customizations` | — | White-label customization |
| `/admin/terminology` | — | Custom terminology |
| `/admin/kiosk` | — | Kiosk configuration |
| `/admin/restaurant` | `/menu` | Menu items CRUD |
| | `/categories` | Category management |
| | `/orders` | Restaurant orders |
| | `/modifiers` | Modifier groups/options |
| | `/tables` | Table management |
| | `/reservations` | Reservation management |
| | `/waitlist` | Waitlist management |
| `/admin/pool` | `/sessions` | Pool session CRUD |
| | `/tickets` | Ticket management |
| | `/capacity` | Capacity monitoring |
| `/admin/chalets` | `/bookings` | Booking management |
| | `/pricing` | Price rules, seasonal |
| | `/addons` | Add-on management |
| `/admin/snack-bar` | `/menu` | Snack menu CRUD |

---

## 2. COMPLETE API ENDPOINT MAP (BACKEND)

Backend runs at `localhost:3005/api/v1/`. All module routes are mounted through `v1.routes.ts`.

### 2.1 Auth (`/api/v1/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | None (rate-limited) | Register new user |
| `POST` | `/login` | None (rate-limited) | Login, returns JWT + refresh token |
| `POST` | `/refresh` | None | Refresh access token |
| `POST` | `/forgot-password` | None (rate-limited) | Send password reset email |
| `POST` | `/reset-password` | None (rate-limited) | Reset password with token. Body: `{token, newPassword}` |
| `GET` | `/verify-email` | None | Email verification via query param token |
| `GET` | `/google` | None | Google OAuth redirect |
| `GET` | `/google/callback` | None | Google OAuth callback |
| `GET` | `/facebook` | None | Facebook OAuth redirect |
| `GET` | `/facebook/callback` | None | Facebook OAuth callback |
| `GET` | `/apple` | None | Apple OAuth redirect |
| `POST` | `/apple/callback` | None | Apple OAuth callback (POST per Apple spec) |
| `POST` | `/2fa/verify` | None (rate-limited) | Verify 2FA code during login |
| `POST` | `/biometric/authenticate-begin` | None | WebAuthn begin (planned) |
| `POST` | `/biometric/authenticate-complete` | None | WebAuthn complete (planned) |
| `GET` | `/me` | JWT | Get current user profile |
| `POST` | `/logout` | JWT | Logout, invalidate tokens |
| `PUT` | `/change-password` | JWT | Change password |
| `POST` | `/resend-verification` | JWT | Resend email verification |
| `GET` | `/2fa/status` | JWT | Check 2FA enrollment status |
| `POST` | `/2fa/setup` | JWT | Initialize 2FA (returns QR/secret) |
| `POST` | `/2fa/enable` | JWT | Enable 2FA with code |
| `POST` | `/2fa/disable` | JWT | Disable 2FA with code |
| `POST` | `/2fa/backup-codes` | JWT | Regenerate backup codes |

### 2.2 Restaurant (`/api/v1/restaurant`)

*Requires module guard — module must be active.*

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/menu` | None | Full menu with categories. Query: `?moduleId=` |
| `GET` | `/menu/categories` | None | All categories |
| `GET` | `/menu/items` | None | All menu items |
| `GET` | `/menu/items/:id` | None | Single menu item |
| `GET` | `/menu/featured` | None | Featured items |
| `GET` | `/menu/items/:menuItemId/modifiers` | None | Modifier groups for item |
| `GET` | `/categories` | None | Alias for menu/categories |
| `GET` | `/items` | None | Alias for menu/items |
| `POST` | `/orders` | Optional | Create order. Body: items, orderType, customerName, etc. |
| `GET` | `/orders/:id` | Optional | Get order by ID |
| `GET` | `/orders/:id/status` | Optional | Get order status |
| `GET` | `/my-orders` | JWT | Current user's orders |
| `GET` | `/tables` | None | List restaurant tables |
| `GET` | `/tables/available` | None | List available tables |
| `GET` | `/tables/:id/qr` | None | Generate table QR code |
| `GET` | `/reservations/availability` | None | Check reservation availability |
| `POST` | `/reservations` | Rate-limited | Create reservation |
| **Staff** | | | |
| `GET` | `/staff/orders` | Staff | All orders for staff |
| `GET` | `/staff/orders/live` | Staff | Live orders (Socket.IO enhanced) |
| `PATCH/PUT` | `/staff/orders/:id/status` | Staff | Update order status |
| `GET` | `/staff/tables` | Staff | Staff table view |
| `PATCH` | `/staff/tables/:id` | Staff | Update table (e.g., status) |
| `GET` | `/reservations` | Staff | List all reservations |
| `PATCH` | `/reservations/:id` | Staff | Update reservation |
| `POST` | `/reservations/:id/assign-table` | Staff | Assign table to reservation |
| `GET` | `/reservations/:id` | Staff | Get single reservation |
| **Admin** | | | |
| `POST` | `/admin/categories` | Admin | Create category |
| `PUT` | `/admin/categories/:id` | Admin | Update category |
| `DELETE` | `/admin/categories/:id` | Admin | Delete category |
| `POST` | `/admin/items` | Admin | Create menu item |
| `PUT` | `/admin/items/:id` | Admin | Update menu item |
| `DELETE` | `/admin/items/:id` | Admin | Delete menu item |
| `PATCH` | `/admin/items/:id/availability` | Admin | Toggle item availability |
| `GET` | `/admin/orders` | Admin | All orders (admin view) |
| `PUT/PATCH` | `/admin/orders/:id/status` | Admin | Update order status |
| `POST` | `/admin/tables` | Admin | Create table |
| `DELETE` | `/admin/tables/:id` | Admin | Delete table |
| `GET` | `/admin/reports/daily` | Admin | Daily sales report |
| `GET` | `/admin/reports/sales` | Admin | Sales report |
| `GET` | `/admin/modifiers/groups` | Admin | List modifier groups |
| `POST` | `/admin/modifiers/groups` | Admin | Create modifier group |
| `PUT` | `/admin/modifiers/groups/:id` | Admin | Update modifier group |
| `DELETE` | `/admin/modifiers/groups/:id` | Admin | Delete modifier group |
| `POST` | `/admin/modifiers/groups/:groupId/options` | Admin | Create modifier option |
| `PUT` | `/admin/modifiers/options/:optionId` | Admin | Update modifier option |
| `DELETE` | `/admin/modifiers/options/:optionId` | Admin | Delete modifier option |
| `GET` | `/admin/items/:menuItemId/modifiers` | Admin | Get item's modifiers |
| `POST` | `/admin/items/:menuItemId/modifiers` | Admin | Set item's modifiers |
| `GET` | `/admin/modifiers/inventory-items` | Admin | Get inventory items for modifier linking |

### 2.3 Snack Bar (`/api/v1/snack`)

*Requires module guard.*

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/categories` | None | Snack categories |
| `GET` | `/items` | None | Snack items. Query: `?moduleId=` |
| `GET` | `/items/:id` | None | Single snack item |
| `POST` | `/orders` | Optional | Create snack order |
| `GET` | `/orders/my` | JWT | My snack orders |
| `GET` | `/orders/:id` | None | Get order |
| `GET` | `/orders/:id/status` | None | Get order status |
| **Staff** | | | |
| `GET` | `/staff/orders` | Staff | Staff orders view |
| `GET` | `/staff/orders/live` | Staff | Live orders |
| `PATCH/PUT` | `/staff/orders/:id/status` | Staff | Update status |
| **Admin** | | | |
| `POST` | `/admin/categories` | Admin | Create category |
| `PUT` | `/admin/categories/:id` | Admin | Update category |
| `DELETE` | `/admin/categories/:id` | Admin | Delete category |
| `POST` | `/admin/items` | Admin | Create item |
| `PUT` | `/admin/items/:id` | Admin | Update item |
| `DELETE` | `/admin/items/:id` | Admin | Delete item |
| `PATCH` | `/admin/items/:id/availability` | Admin | Toggle availability |

### 2.4 Chalets (`/api/v1/chalets`)

*Requires module guard.*

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | List all chalets. Query: `?moduleId=` |
| `GET` | `/:id` | None | Chalet detail |
| `GET` | `/:id/availability` | None | Availability for date range. Query: `?checkIn=&checkOut=` or `?startDate=&endDate=` |
| `GET` | `/add-ons` | None | List add-ons. Query: `?moduleId=` |
| `POST` | `/bookings` | Optional | Create booking. Body: chaletId, customerName, customerEmail, customerPhone, checkInDate, checkOutDate, numberOfGuests, addOns, specialRequests, paymentMethod |
| `GET` | `/bookings/:id` | Optional | Get booking details |
| `POST` | `/bookings/:id/cancel` | Optional | Cancel booking |
| `GET` | `/my-bookings` | JWT | User's bookings |
| **Staff** | | | |
| `GET` | `/staff/bookings` | Staff | All bookings |
| `GET` | `/staff/bookings/today` | Staff | Today's bookings |
| `PATCH` | `/staff/bookings/:id/check-in` | Staff | Check in guest |
| `PATCH` | `/staff/bookings/:id/check-out` | Staff | Check out guest |
| `PATCH` | `/staff/bookings/:id/status` | Staff | Update booking status |
| **Admin** | | | |
| `GET` | `/admin/add-ons` | Admin | Admin add-on view |
| `POST` | `/admin/chalets` | Admin | Create chalet |
| `PUT` | `/admin/chalets/:id` | Admin | Update chalet |
| `DELETE` | `/admin/chalets/:id` | Admin | Delete chalet |
| `POST` | `/admin/add-ons` | Admin | Create add-on |
| `PUT` | `/admin/add-ons/:id` | Admin | Update add-on |
| `DELETE` | `/admin/add-ons/:id` | Admin | Delete add-on |
| `GET` | `/admin/price-rules` | Admin | Get pricing rules |
| `POST` | `/admin/price-rules` | Admin | Create pricing rule |
| `PUT` | `/admin/price-rules/:id` | Admin | Update pricing rule |
| `DELETE` | `/admin/price-rules/:id` | Admin | Delete pricing rule |
| `GET` | `/admin/settings` | Admin | Chalet module settings |
| `PUT` | `/admin/settings` | Admin | Update chalet settings |

### 2.5 Pool (`/api/v1/pool`)

*Requires module guard.*

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/sessions` | None | List sessions. Query: `?date=&moduleId=` |
| `GET` | `/sessions/:id` | None | Single session |
| `GET` | `/availability` | None | Bulk availability with sold/available counts. Query: `?date=&moduleId=` |
| `GET` | `/settings` | None | Pool module settings |
| `POST` | `/tickets` | Optional | Purchase ticket. Body: sessionId, ticketDate, adultCount, childCount, customerName, customerPhone, paymentMethod |
| `GET` | `/tickets/:id` | Optional | Get ticket |
| `DELETE` | `/tickets/:id` | JWT | Cancel ticket |
| `GET` | `/my-tickets` | JWT | User's tickets |
| **Staff** | | | |
| `POST` | `/staff/validate` | Staff | Validate ticket by number |
| `POST` | `/tickets/:id/entry` | Staff | Record pool entry |
| `POST` | `/tickets/:id/exit` | Staff | Record pool exit |
| `GET` | `/staff/capacity` | Staff | Current live capacity |
| `GET` | `/staff/tickets/today` | Staff | Today's tickets |
| `GET` | `/staff/maintenance` | Staff | Maintenance logs |
| `POST` | `/staff/maintenance` | Staff | Create maintenance log |
| `POST` | `/tickets/:id/bracelet` | Staff | Assign bracelet to ticket |
| `DELETE` | `/tickets/:id/bracelet` | Staff | Return bracelet |
| `GET` | `/staff/bracelets/active` | Staff | Active bracelets |
| `GET` | `/staff/bracelets/search` | Staff | Search by bracelet number |
| **Admin** | | | |
| `PUT` | `/admin/settings` | Admin | Update pool settings |
| `POST` | `/admin/reset-occupancy` | Admin | Reset occupancy counter |
| `POST` | `/admin/sessions` | Admin | Create session |
| `PUT` | `/admin/sessions/:id` | Admin | Update session |
| `DELETE` | `/admin/sessions/:id` | Admin | Delete session |
| `GET` | `/admin/reports/daily` | Admin | Daily pool report |

### 2.6 Admin (`/api/v1/admin`)

*All routes require JWT + admin/super_admin role.*

| Method | Path | Auth | Description |
|---|---|---|---|
| **Modules** | | | |
| `GET` | `/modules` | Manager+ | List all modules. Query: `?activeOnly=true` |
| `GET` | `/modules/:id` | Manager+ | Get module |
| `POST` | `/modules` | super_admin | Create module |
| `PUT` | `/modules/:id` | Manager+ | Update module |
| `DELETE` | `/modules/:id` | Manager+ | Delete module. Query: `?force=true` |
| **Dashboard** | | | |
| `GET` | `/dashboard` | Manager+ | Dashboard summary |
| `GET` | `/dashboard/revenue` | Manager+ | Revenue statistics |
| **Users** | | | |
| `GET` | `/users` | Manager+ | List users. Query: `?type=customer|staff` |
| `POST` | `/users` | Manager+ | Create user |
| `GET` | `/users/:id` | Manager+ | User details |
| `PUT` | `/users/:id` | Manager+ | Update user |
| `PUT` | `/users/:id/roles` | super_admin | Update user roles |
| `DELETE` | `/users/:id` | super_admin | Delete user |
| `PUT` | `/users/:id/permissions` | super_admin | Override user permissions |
| **Roles & Permissions** | | | |
| `GET` | `/roles` | super_admin | List roles |
| `POST` | `/roles` | super_admin | Create role |
| `PUT` | `/roles/:id` | super_admin | Update role |
| `DELETE` | `/roles/:id` | super_admin | Delete role |
| `GET` | `/roles/:id/permissions` | super_admin | Get role permissions |
| `PUT` | `/roles/:id/permissions` | super_admin | Update role permissions |
| `GET` | `/permissions` | super_admin | All system permissions |
| **Settings** | | | |
| `GET` | `/settings` | super_admin | All settings |
| `PUT` | `/settings` | super_admin | Update settings |
| `GET` | `/settings/homepage` | super_admin | Homepage settings |
| `PUT` | `/settings/homepage` | super_admin | Update homepage settings |
| **Uploads & Branding** | | | |
| `GET` | `/uploads` | Manager+ | List files |
| `POST` | `/uploads` | Manager+ | Upload file |
| `DELETE` | `/uploads/:path(*)` | Manager+ | Delete file |
| `GET` | `/branding` | Manager+ | Get branding assets |
| **Audit** | | | |
| `GET` | `/audit-logs` | super_admin | All audit logs |
| `GET` | `/audit-logs/:resource` | super_admin | Audit logs by resource |
| `GET` | `/audit-logs/:resource/:resourceId` | super_admin | Audit logs by resource+ID |
| **Backups** | | | |
| `GET` | `/backups` | super_admin | List backups |
| `POST` | `/backups` | super_admin | Create backup |
| `GET` | `/backups/:id/download` | super_admin | Download backup |
| `POST` | `/backups/restore` | super_admin | Restore from backup |
| `DELETE` | `/backups/:id` | super_admin | Delete backup |
| **Notifications** | | | |
| `GET` | `/notifications` | Manager+ | Get notifications |
| `GET` | `/notifications/broadcasts` | Manager+ | Get broadcasts |
| `GET` | `/notifications/priorities` | Manager+ | Valid priorities |
| `PUT` | `/notifications/:id/read` | Manager+ | Mark read |
| `PUT` | `/notifications/read-all` | Manager+ | Mark all read |
| `POST` | `/notifications/broadcast` | Manager+ | Send broadcast |
| `POST` | `/notifications/delete-multiple` | Manager+ | Bulk delete |
| `POST` | `/notifications/process-scheduled` | Manager+ | Process scheduled |
| `DELETE` | `/notifications/:id` | Manager+ | Delete notification |
| `GET` | `/notifications/templates` | Manager+ | Get templates |
| `GET` | `/notifications/templates/:id` | Manager+ | Get template |
| `POST` | `/notifications/templates` | Manager+ | Create template |
| `PUT` | `/notifications/templates/:id` | Manager+ | Update template |
| `DELETE` | `/notifications/templates/:id` | Manager+ | Delete template |
| `POST` | `/notifications/templates/:id/send` | Manager+ | Send from template |
| **Translations** | | | |
| `GET` | `/translations/status` | Manager+ | Translation service status |
| `GET` | `/translations/missing` | Manager+ | Missing translations |
| `GET` | `/translations/stats` | Manager+ | Translation stats |
| `PUT` | `/translations/:table/:id` | Manager+ | Update translation |
| `POST` | `/translations/auto-translate` | Manager+ | Auto-translate |
| `POST` | `/translations/batch-translate` | Manager+ | Batch auto-translate |
| `GET` | `/translations/languages` | super_admin | Supported languages |
| `POST` | `/translations/languages` | super_admin | Add language |
| `PUT` | `/translations/languages/:code` | super_admin | Update language |
| `DELETE` | `/translations/languages/:code` | super_admin | Delete language |
| `GET` | `/translations/frontend/compare` | super_admin | Compare frontend translations |
| `POST` | `/translations/frontend/update` | super_admin | Update frontend translation |
| `GET` | `/translations/ui` | Manager+ | Get UI translations |
| `POST` | `/translations/ui` | Manager+ | Upsert UI translation |
| `POST` | `/translations/ui/publish` | super_admin | Publish translations |
| **Delete Management** | | | |
| `GET` | `/delete-preview/:entityType/:entityId` | Manager+ | Preview cascade delete |
| `GET` | `/deleted/:entityType` | Manager+ | Get soft-deleted records |
| `POST` | `/deleted/:entityType/:entityId/restore` | Manager+ | Restore soft-deleted |
| `DELETE` | `/deleted/:entityType/:entityId/permanent` | super_admin | Permanent delete |
| `POST` | `/soft-delete/:entityType/:entityId` | Manager+ | Soft delete entity |

### 2.7 Payments (`/api/v1/payments`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/webhook/stripe` | None (Stripe sig) | Stripe webhook handler |
| `POST` | `/create-intent` | Optional | Create Stripe PaymentIntent. Body: `{amount, referenceType, referenceId}` |
| `GET` | `/methods` | JWT | Get payment methods |
| `POST` | `/record-cash` | Staff | Record cash payment |
| `POST` | `/record-manual` | Staff | Record manual payment |
| `GET` | `/transactions` | Admin | List transactions |
| `GET` | `/transactions/:id` | Admin | Get transaction |
| `POST` | `/transactions/:id/refund` | Admin | Refund payment |

### 2.8 Loyalty (`/api/v1/loyalty`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/calculate` | None | Calculate points for amount |
| `GET` | `/me` | JWT | My loyalty account |
| `GET` | `/me/transactions` | JWT | My point transactions |
| `POST` | `/enroll` | JWT | Enroll in loyalty program |
| `GET` | `/settings` | None | Loyalty settings |
| `GET` | `/tiers` | None | Loyalty tier definitions |
| `GET` | `/accounts` | Admin | All loyalty accounts |
| `GET` | `/accounts/:userId` | Staff+ | Get user's account |
| `GET` | `/accounts/:userId/transactions` | Staff+ | User's transactions |
| `GET` | `/stats` | Admin | Loyalty stats |
| `POST` | `/earn` | Staff+ | Award points |
| `POST` | `/redeem` | Staff+ | Redeem points |
| `POST` | `/adjust` | Admin | Adjust points |
| `POST` | `/accounts/:accountId/adjust` | Admin | Adjust by account ID |
| `PUT` | `/settings` | Admin | Update loyalty settings |
| `PUT` | `/tiers/:tierId` | Admin | Update tier |
| `POST` | `/tiers` | Admin | Create tier |
| `DELETE` | `/tiers/:tierId` | Admin | Delete tier |

### 2.9 Gift Cards (`/api/v1/giftcards`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/templates` | None | Gift card templates |
| `GET` | `/check/:code` | None | Check balance by code |
| `POST` | `/purchase` | JWT | Purchase gift card |
| `GET` | `/my` | JWT | My gift cards |
| `POST` | `/redeem` | JWT | Redeem gift card |
| `GET` | `/` | Admin | All gift cards |
| `GET` | `/admin` | Admin | All gift cards (alias) |
| `GET` | `/stats` | Admin | Gift card stats |
| `GET` | `/admin/stats` | Admin | Gift card stats (alias) |
| `GET` | `/:id` | Admin | Get gift card |
| `POST` | `/` | Admin | Create gift card |
| `POST` | `/admin` | Admin | Create gift card (alias) |
| `PUT` | `/:id/disable` | Admin | Disable gift card |
| `PUT` | `/admin/:id/disable` | Admin | Disable (alias) |
| `POST` | `/templates` | Admin | Create template |
| `PUT` | `/templates/:id` | Admin | Update template |

### 2.10 Coupons (`/api/v1/coupons`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/active` | None | Active coupons |
| `POST` | `/validate` | None | Validate coupon code |
| `POST` | `/apply` | JWT | Apply coupon to order |
| `GET` | `/` | Admin | All coupons |
| `GET` | `/stats` | Admin | Coupon stats |
| `GET` | `/generate-code` | Admin | Generate unique code |
| `GET` | `/:id` | Admin | Get coupon |
| `POST` | `/` | Admin | Create coupon |
| `PUT` | `/:id` | Admin | Update coupon |
| `DELETE` | `/:id` | Admin | Delete coupon |

### 2.11 Staff (`/api/v1/staff`)

*All routes require JWT + authenticate.*

| Method | Path | Auth | Description |
|---|---|---|---|
| **Shifts** | | | |
| `GET` | `/shifts/me` | Staff | My shifts |
| `GET` | `/shifts` | Manager+ | All shifts |
| `GET` | `/shifts/staff/:staffId` | Manager+ | Staff member's shifts |
| `POST` | `/shifts` | Manager+ | Create shift |
| `PUT` | `/shifts/:id` | Manager+ | Update shift |
| `DELETE` | `/shifts/:id` | Manager+ | Delete shift |
| `POST` | `/shifts/:id/clock-in` | Staff | Clock in |
| `POST` | `/shifts/:id/clock-out` | Staff | Clock out |
| **Assignments** | | | |
| `GET` | `/assignments` | Manager+ | All assignments |
| `GET` | `/assignments/me` | Staff | My assignment |
| `PUT` | `/staff/:staffId/assignments` | Manager+ | Update staff assignments |
| `POST` | `/assignments/bulk` | Manager+ | Bulk assign |
| **Shift Swaps** | | | |
| `POST` | `/shifts/swap` | Staff | Request swap |
| `GET` | `/shifts/swap/me` | Staff | My swap requests |
| `GET` | `/shifts/swap` | Manager+ | All swap requests |
| `PUT` | `/shifts/swap/:id/respond` | Staff | Respond to swap |
| `PUT` | `/shifts/swap/:id/approve` | Manager+ | Approve swap |
| `DELETE` | `/shifts/swap/:id` | Staff | Cancel swap request |
| **Time Tracking** | | | |
| `GET` | `/time-tracking` | Manager+ | Time tracking report |
| `POST` | `/shifts/:shiftId/adjustments` | Manager+ | Add time adjustment |

### 2.12 Users (`/api/v1/users`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/me/data` | JWT | Export user data (GDPR) |
| `DELETE` | `/me/data` | JWT | Delete user data (GDPR) |
| `POST` | `/me/data/portable` | JWT | Portable data export (GDPR) |
| `GET` | `/profile` | JWT | Get profile |
| `PUT` | `/profile` | JWT | Update profile |
| `GET` | `/` | Admin | List all users |
| `GET` | `/:id` | Admin | Get user by ID |
| `PUT` | `/:id/roles` | super_admin | Update user roles |

### 2.13 Other Modules

#### Inventory (`/api/v1/inventory`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/items/recipe/:menuItemId` | Staff | Get recipe |
| `POST` | `/items/recipe/:menuItemId` | Admin | Create/update recipe |
| `GET` | `/sessions/recipe/:sessionId` | Staff | Get session recipe |
| `POST` | `/sessions/recipe/:sessionId` | Admin | Create session recipe |
| `GET` | `/categories` | Staff | Inventory categories |
| `POST` | `/categories` | Admin | Create category |
| `PUT` | `/categories/:id` | Admin | Update category |
| `DELETE` | `/categories/:id` | Admin | Delete category |
| `GET` | `/items` | Staff | Inventory items |
| `GET` | `/items/:id` | Staff | Single item |
| `POST` | `/items` | Admin | Create item |
| `PUT` | `/items/:id` | Admin | Update item |
| `DELETE` | `/items/:id` | Admin | Delete item |
| `POST` | `/items/:itemId/link-menu` | Admin | Link to menu item |
| `GET` | `/transactions` | Staff | Inventory transactions |
| `POST` | `/transactions` | Staff | Record transaction |
| `POST` | `/transactions/bulk` | Admin | Bulk transaction |
| `GET` | `/alerts` | Staff | Low stock alerts |
| `POST` | `/alerts/:id/resolve` | Staff | Resolve alert |
| `GET` | `/stats` | Admin | Inventory stats |
| `GET` | `/report` | Admin | Generate report |
| `POST` | `/check-expiring` | Admin | Check expiring items |

#### Housekeeping (`/api/v1/housekeeping`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/task-types` | JWT | List task types |
| `GET` | `/my-tasks` | Staff | My assigned tasks |
| `POST` | `/tasks/:id/start` | Staff | Start task |
| `POST` | `/tasks/:id/complete` | Staff | Complete task |
| `POST` | `/tasks/:id/issue` | Staff | Report issue |
| `GET` | `/tasks` | Admin | All tasks |
| `GET` | `/tasks/:id` | Staff+ | Get task |
| `POST` | `/tasks` | Admin | Create task |
| `PUT` | `/tasks/:id` | Admin | Update task |
| `POST` | `/tasks/:id/assign` | Admin | Assign task |
| `GET` | `/schedules` | Admin | Schedules |
| `POST` | `/schedules` | Admin | Create schedule |
| `PUT` | `/schedules/:id` | Admin | Update schedule |
| `DELETE` | `/schedules/:id` | Admin | Delete schedule |
| `GET` | `/staff` | Admin | Available staff |
| `GET` | `/stats` | Admin | Stats |
| `POST` | `/generate-scheduled` | Admin | Generate scheduled tasks |

#### Reviews (`/api/v1/reviews`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | Approved reviews |
| `POST` | `/` | JWT | Create review |
| `GET` | `/admin` | Admin | All reviews |
| `PATCH` | `/:id/status` | Admin | Update review status |
| `PUT` | `/:id/approve` | Admin | Approve review |
| `PUT` | `/:id/reject` | Admin | Reject review |
| `DELETE` | `/:id` | Admin | Delete review |

#### Reporting (`/api/v1/manager` mount)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/templates` | Staff+ | Report templates |
| `POST` | `/execute/:templateId` | Staff+ | Execute report |
| `POST` | `/export/:templateId` | Staff+ | Export report |
| `GET/POST` | `/saved` | Staff+ | Saved reports CRUD |
| `GET` | `/kpis` | Staff+ | KPIs |
| `GET` | `/financial/revenue` | Staff+ | Revenue report |
| `GET` | `/financial/occupancy` | Staff+ | Occupancy report |
| `GET` | `/financial/channels` | Staff+ | Channel performance |
| `GET` | `/operational/housekeeping` | Staff+ | Housekeeping report |
| `GET` | `/operational/maintenance` | Staff+ | Maintenance report |
| `GET/POST` | `/scheduled` | Staff+ | Scheduled reports CRUD |
| `GET/POST` | `/dashboards` | Staff+ | Dashboard CRUD |
| `POST` | `/snapshots` | Admin | Create data snapshot |
| `POST` | `/snapshots/lock-month` | Admin | Lock monthly snapshot |

#### Support (`/api/v1/support`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/contact` | None | Submit contact form. Body: `{name, email, phone?, subject, message}` |

#### Terminology (`/api/v1/terminology`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | Get terminology |
| `GET` | `/admin` | None | Admin terminology |
| `POST` | `/` | None | Create terminology |
| `POST` | `/bulk` | None | Bulk terminology |

### 2.14 Generic White-Label Routes (`/api/v1/`)

Mounted at root of v1 for white-label module access:

| Method | Path | Description |
|---|---|---|
| `GET` | `/units` | List chalets (generic) |
| `GET` | `/units/:id` | Get chalet (generic) |
| `POST` | `/units` | Create chalet (generic) |
| `PUT` | `/units/:id` | Update chalet (generic) |
| `DELETE` | `/units/:id` | Delete chalet (generic) |
| `GET` | `/facilities/sessions` | Pool sessions (generic) |
| `GET` | `/facilities/tickets` | Today's tickets (generic) |
| `POST` | `/facilities/tickets` | Purchase ticket (generic) |
| `GET` | `/dining/menu` | Menu (generic) |
| `GET` | `/dining/orders` | Staff orders (generic) |
| `POST` | `/dining/orders` | Create order (generic) |

---

## 3. CROSS-ACTOR WORKFLOWS

These are the end-to-end workflows where one actor's action must be visible/actionable by another actor.

### W-01: Restaurant Order Lifecycle

```
Customer → Places order (POST /restaurant/orders)
  ↓ Socket.IO event: "new_order"
Staff/Kitchen → Sees order on live display (GET /restaurant/staff/orders/live)
  ↓ Updates status: pending → preparing (PATCH /restaurant/staff/orders/:id/status)
  ↓ Socket.IO event: "order_status_updated"
Customer → Sees updated status on confirmation page
  ↓ Updates status: preparing → ready
  ↓ Socket.IO event: "order_status_updated"
Staff → Delivers order, marks: ready → delivered
  ↓ Side effects: loyalty points awarded, inventory deducted
Admin → Sees order in reports (GET /restaurant/admin/reports/daily)
```

**Order Status Machine**: `pending → confirmed → preparing → ready → delivered → completed`  
**Also possible**: `pending → cancelled`, `any → cancelled` (with refund trigger)

### W-02: Pool Ticket → Entry/Exit

```
Customer → Purchases ticket (POST /pool/tickets)
  ↓ Ticket number generated (e.g., POOL-XXXXXX)
  ↓ Socket.IO: capacity_updated
Staff → Scans ticket at gate (POST /pool/staff/validate)
  ↓ Returns validation result (valid/invalid/expired/used)
Staff → Records entry (POST /pool/tickets/:id/entry)
  ↓ Occupancy incremented, Socket.IO: capacity_updated
Staff → Optionally assigns bracelet (POST /pool/tickets/:id/bracelet)
  ↓ Bracelet tracked
Staff → Records exit (POST /pool/tickets/:id/exit)
  ↓ Occupancy decremented, Socket.IO: capacity_updated
Admin → Views capacity in real-time (GET /pool/staff/capacity)
```

**Ticket Status Machine**: `active → used → expired → cancelled`

### W-03: Chalet Booking → Check-in → Check-out

```
Customer → Creates booking (POST /chalets/bookings)
  ↓ Status: pending, deposit calculated (30% of base)
  ↓ Email confirmation sent
Admin/Staff → Reviews booking
  ↓ Approves: pending → confirmed (PATCH /chalets/staff/bookings/:id/status)
Staff → Day of arrival: check-in (PATCH /chalets/staff/bookings/:id/check-in)
  ↓ Status: confirmed → checked_in
  ↓ Housekeeping task auto-generated for checkout day
Staff → Departure: check-out (PATCH /chalets/staff/bookings/:id/check-out)
  ↓ Status: checked_in → checked_out
  ↓ Housekeeping task triggered (clean chalet)
```

**Booking Status Machine**: `pending → confirmed → checked_in → checked_out → completed`  
**Also**: `pending → cancelled`, `confirmed → cancelled` (with refund policy)

### W-04: Coupon Creation → Customer Redemption

```
Admin → Creates coupon (POST /coupons)
  ↓ Sets: code, discount type (percentage/fixed), min order, max uses, expiry, module scope
Customer → At checkout, enters coupon code
  ↓ Validates (POST /coupons/validate)
  ↓ Returns discount amount if valid
Customer → Submits order with coupon applied (POST /coupons/apply)
  ↓ Usage count incremented
  ↓ Discount applied pre-tax
Admin → Views stats (GET /coupons/stats)
```

### W-05: Gift Card Purchase → Redemption

```
Customer A → Purchases gift card (POST /giftcards/purchase)
  ↓ Card created with balance, code generated
Customer B → At checkout, enters gift card code
  ↓ Checks balance (GET /giftcards/check/:code)
  ↓ Balance shown
Customer B → Applies gift card during payment
  ↓ Redeems (POST /giftcards/redeem)
  ↓ Balance deducted post-tax
  ↓ Remaining balance retained
Admin → Views all cards, disables if needed (PUT /giftcards/:id/disable)
```

### W-06: Loyalty Program Flow

```
Admin → Configures tiers & point rates (PUT /loyalty/settings, POST /loyalty/tiers)
Customer → Enrolls (POST /loyalty/enroll)
  ↓ Account created at base tier
Customer → Makes purchase → Order completes
  ↓ Points auto-awarded: 1 point per $1 spent (post-discount amount)
  ↓ Tier auto-evaluated
Customer → At next checkout, redeems points
  ↓ 100 points = $1 redemption value
  ↓ Applied post-tax
Admin → Manually adjusts points if needed (POST /loyalty/adjust)
```

### W-07: Reservation → Table Assignment

```
Customer → Creates reservation (POST /restaurant/reservations)
  ↓ Body: name, email, phone, date, time, partySize, specialRequests
  ↓ Status: pending
Staff → Reviews reservations (GET /restaurant/reservations)
  ↓ Confirms: pending → confirmed (PATCH /restaurant/reservations/:id)
Customer arrives → Staff assigns table (POST /restaurant/reservations/:id/assign-table)
  ↓ Body: {tableId}
  ↓ Table status updated, reservation status → seated
```

### W-08: Housekeeping Lifecycle

```
Admin → Creates schedule (POST /housekeeping/schedules)
Admin → Generates tasks from schedule (POST /housekeeping/generate-scheduled)
  ↓ OR chalet check-out triggers auto-task
Staff → Views my tasks (GET /housekeeping/my-tasks)
Staff → Starts task (POST /housekeeping/tasks/:id/start)
  ↓ Status: pending → in_progress
Staff → Completes task (POST /housekeeping/tasks/:id/complete)
  ↓ Status: in_progress → completed
  ↓ OR reports issue (POST /housekeeping/tasks/:id/issue)
Admin → Views stats (GET /housekeeping/stats)
```

### W-09: Staff Shift Management

```
Manager → Creates shifts (POST /staff/shifts)
Staff → Views my shifts (GET /staff/shifts/me)
Staff → Clocks in (POST /staff/shifts/:id/clock-in)
Staff → Requests swap (POST /staff/shifts/swap)
Other Staff → Responds to swap (PUT /staff/shifts/swap/:id/respond)
Manager → Approves swap (PUT /staff/shifts/swap/:id/approve)
Staff → Clocks out (POST /staff/shifts/:id/clock-out)
Manager → Reviews time tracking (GET /staff/time-tracking)
```

### W-10: Review Moderation

```
Customer → Submits review (POST /reviews)
  ↓ Status: pending (not visible publicly)
Admin → Reviews all submissions (GET /reviews/admin)
Admin → Approves (PUT /reviews/:id/approve) or Rejects (PUT /reviews/:id/reject)
  ↓ Approved reviews visible publicly (GET /reviews)
```

---

## 4. BUSINESS RULES

### 4.1 Order Pricing Pipeline

The pricing calculation follows this exact sequence:

```
1. Item subtotal     = Σ (item.price + item.modifierTotal) × item.quantity
2. Tax               = subtotal × taxRate (default 11%, from settings)
3. Service charge    = subtotal × serviceChargeRate (default 10%, DINE-IN ONLY, from settings)
4. Delivery fee      = flat rate (default $5, DELIVERY ONLY, from settings)
5. Coupon discount   = applied PRE-TAX on subtotal
   - percentage: subtotal × coupon.discount_percent / 100
   - fixed: coupon.discount_amount
6. Gift card         = applied POST-TAX (deducted from total after tax)
7. Loyalty points    = applied POST-TAX (100 points = $1)
8. Final total       = subtotal + tax + serviceCharge + deliveryFee - couponDiscount - giftCard - loyaltyRedemption
9. Side effects:
   - Loyalty points earned = floor(finalTotal) (1 point per $1)
   - Inventory deducted per recipe
   - Gift card balance reduced
   - Coupon usage count incremented
```

### 4.2 Order Status Progression

**Restaurant/Snack Orders (Engine A)**:
```
pending → confirmed → preparing → ready → delivered → completed
                                                    ↘ cancelled (any stage)
```

**Chalet Bookings (Engine B)**:
```
pending → confirmed → checked_in → checked_out → completed
       ↘ cancelled                              ↘ cancelled
```

**Pool Tickets (Engine C)**:
```
active → used → expired
       ↘ cancelled
```

### 4.3 Coupon Rules

- **Types**: `percentage` (0-100%) or `fixed` (dollar amount)
- **Constraints**: min_order_amount, max_discount_amount, max_uses, max_uses_per_user
- **Scope**: optional module restriction (restaurant only, pool only, etc.)
- **Validation checks**: active flag, within date range, not expired, usage limits not exceeded
- One coupon per order (latest applied replaces previous)

### 4.4 Pool Capacity Rules

- Each session has a `capacity` (max people)
- Ticket purchase checks: `sold_count < capacity` for that session+date
- Real-time occupancy tracked via entry/exit recordings
- Admin can reset occupancy counter
- **KNOWN RACE CONDITION (H2)**: No DB-level lock on capacity check — concurrent purchases can exceed capacity

### 4.5 Chalet Pricing Rules

- **Base price** per night (weekday)
- **Weekend price** per night (Friday/Saturday — `dayOfWeek === 5 || 6`)
- **Add-ons**: `per_night` (multiplied by nights) or `one_time` (flat)
- **Deposit**: 30% of base amount (hardcoded in frontend, should come from settings)
- **Blocked dates**: Dates already booked are unavailable
- **Price rules**: Admin-defined seasonal/promotional pricing rules

### 4.6 Gift Card Rules

- Has a `balance` that decreases with each redemption
- Balance check is public: `GET /giftcards/check/:code`
- Redemption amount = `min(balance, remainingOrderTotal)`
- Applied post-tax
- **KNOWN RACE CONDITION (H1)**: No DB-level lock — concurrent redemptions can over-spend balance

### 4.7 Loyalty Point Rules

- Enrollment required (POST /loyalty/enroll)
- **Earning**: 1 point per $1 spent (on post-discount total)
- **Redemption**: 100 points = $1 (configurable via `pointsRate`)
- **Tiers**: Based on accumulated points (Bronze → Silver → Gold, etc.)
- Points applied post-tax
- Max redeemable = min(available_points, remaining_order_total × pointsRate)

### 4.8 Module Guard

- Modules can be enabled/disabled via admin
- Module guard middleware checks module status before allowing route access
- Disabled module = all routes for that module return 403/404
- 4 module types: Restaurant, Snack Bar, Chalets, Pool

### 4.9 Authentication Rules

- JWT access token + refresh token pair
- Access token has short expiry, proactively refreshed when < 60 seconds remaining
- Refresh token rotation on use (old refresh token invalidated)
- Bcrypt cost factor: 12
- Password policy enforced via `password-policy` service
- Optional TOTP 2FA with backup codes
- CSRF protection: Double Submit Cookie pattern (X-CSRF-Token header)
- Rate limiting on: login (5/15min), register, password reset, 2FA verify

### 4.10 Cart Rules (Frontend)

- Cart persisted in localStorage (`v2-resort-cart`)
- Items keyed by `uniqueKey` = `moduleId-itemId-modifierHash`
- Same item with different modifiers = separate cart entries
- Cart total = Σ `(price + modifierTotal) × quantity`
- Cart separated logically: restaurant items, snack items, other modules
- Cart cleared on successful order submission

---

## 5. ADMIN SETTINGS THAT AFFECT BEHAVIOR

### 5.1 Tax & Financial Settings

| Setting | Default | Effect |
|---|---|---|
| `tax_rate` | 0.11 (11%) | Applied to all order subtotals |
| `service_charge_rate` | 0.10 (10%) | Applied only to dine-in orders |
| `delivery_fee` | 5.00 | Applied only to delivery orders |
| `currency` | USD | Display currency (USD/EUR/LBP) |
| `stripe_public_key` | — | Enables card payment option |

### 5.2 Module Settings

| Setting | Effect |
|---|---|
| Module `is_active` flag | Enables/disables entire module (restaurant, pool, chalets, snack) |
| Module `engine_type` | Determines state machine: A=Order, B=Reservation, C=Capacity |

### 5.3 Pool Settings

| Setting | Effect |
|---|---|
| Session capacity | Max tickets per session-date |
| Session times | Start/end time per session |
| Session pricing | Adult price per session |
| Bracelet tracking | Enable/disable bracelet management |

### 5.4 Chalet Settings

| Setting | Effect |
|---|---|
| Deposit percentage | Percent of base amount required upfront (frontend default: 30%) |
| Weekend days | Which days count as weekend pricing (default: Fri/Sat) |
| Price rules | Seasonal/promotional pricing overrides |
| Blocked dates | Admin-blocked dates where no booking allowed |

### 5.5 Loyalty Settings

| Setting | Effect |
|---|---|
| Points per dollar | Earning rate (default: 1 point/$1) |
| Points redemption rate | Redemption rate (default: 100 points = $1) |
| Tier thresholds | Point thresholds for tier upgrades |
| Program enabled | Master toggle for loyalty |

### 5.6 Appearance & Branding

| Setting | Effect |
|---|---|
| `resortTheme` | Overall theme |
| `animationsEnabled` | Enable/disable Framer Motion animations |
| `soundEnabled` | Enable/disable sound effects |
| `transitionStyle` | Page transition style |
| Homepage layout | Configurable sections via `/admin/settings/homepage` |
| Navbar config | Navigation links via `/admin/settings/navbar` |
| Footer config | Footer content via `/admin/settings/footer` |
| Terminology | Custom labels for "Chalet"→"Villa", etc. |

### 5.7 Notification Settings

| Setting | Effect |
|---|---|
| Templates | Configurable notification templates for emails/push |
| Broadcast | Admin can broadcast to all users/staff |
| Scheduled | Scheduled notifications (processed via cron) |

---

## 6. SEED DATA

### 6.1 Users

| Email | Password | Role | Name |
|---|---|---|---|
| `admin@v2resort.com` | `admin123` | super_admin | Admin User |
| `manager@v2resort.com` | `staff123` | manager | Manager User |
| `receptionist@v2resort.com` | `staff123` | receptionist | Receptionist User |
| `waiter@v2resort.com` | `staff123` | waiter | Waiter User |
| `chef@v2resort.com` | `staff123` | chef | Chef User |
| `lifeguard@v2resort.com` | `staff123` | lifeguard | Lifeguard User |
| `housekeeping@v2resort.com` | `staff123` | housekeeping_staff | Housekeeping User |
| `maintenance@v2resort.com` | `staff123` | maintenance_staff | Maintenance User |

### 6.2 Roles (10 seeded)

`super_admin`, `admin`, `manager`, `staff`, `receptionist`, `waiter`, `chef`, `lifeguard`, `housekeeping_staff`, `maintenance_staff`

### 6.3 Restaurant Menu

**Categories**: Appetizers, Main Courses, Grilled, Seafood, Desserts, Beverages

| Item | Price | Category |
|---|---|---|
| Hummus | $8 | Appetizers |
| Falafel | $10 | Appetizers |
| Fattoush | $12 | Appetizers |
| Tabbouleh | $10 | Appetizers |
| Chicken Shawarma | $18 | Main Courses |
| Lamb Kofta | $22 | Main Courses |
| Mixed Grill | $35 | Grilled |
| Fresh Lemonade | $5 | Beverages |
| Arabic Coffee | $4 | Beverages |
| Mint Tea | $4 | Beverages |

### 6.4 Snack Bar Items

| Item | Price |
|---|---|
| Club Sandwich | $12 |
| Cheese Burger | $14 |
| French Fries | $6 |
| Coca Cola | $3 |
| Fresh Orange Juice | $6 |
| Vanilla Ice Cream | $5 |

### 6.5 Chalets

| Name | Capacity | Base Price | Weekend Price |
|---|---|---|---|
| Mountain View Chalet | 6 | $150/night | $200/night |
| Garden Chalet | 4 | $100/night | $140/night |
| Luxury Villa | 10 | $300/night | $400/night |
| Family Chalet | 8 | $200/night | $280/night |

### 6.6 Chalet Add-Ons

| Name | Price | Type |
|---|---|---|
| Breakfast Package | $15 | per_night |
| Extra Cleaning | $25 | one_time |
| Extra Bed | $20 | per_night |
| BBQ Package | $30 | one_time |
| Late Checkout | $40 | one_time |

### 6.7 Pool Sessions

| Name | Time | Price (Adult) | Capacity |
|---|---|---|---|
| Morning Session | 09:00-12:00 | $15 | 50 |
| Afternoon Session | 13:00-17:00 | $20 | 50 |
| Evening Session | 18:00-21:00 | $15 | 40 |

### 6.8 Restaurant Tables

| Table | Capacity | Location |
|---|---|---|
| T1 | 2 | Indoor |
| T2 | 2 | Indoor |
| T3 | 4 | Indoor |
| T4 | 4 | Indoor |
| T5 | 6 | Terrace |
| T6 | 6 | Terrace |
| T7 | 8 | Terrace |
| T8 | 8 | Garden |
| T9 | 10 | Garden |
| T10 | 10 | Garden |

---

## 7. STAFF WORKFLOWS

### 7.1 Kitchen Display System (Restaurant)

**Actor**: Chef, Waiter, Staff  
**Frontend**: `/staff/restaurant`  
**API**: Uses Socket.IO for real-time order streaming

1. Staff logs in → navigates to `/staff/restaurant`
2. Live orders stream via `GET /restaurant/staff/orders/live`
3. New orders appear via Socket.IO event `new_order`
4. Staff clicks order → updates status:
   - `pending → confirmed → preparing → ready → delivered`
   - `PATCH /restaurant/staff/orders/:id/status` with `{status: "preparing"}`
5. Status change broadcasts Socket.IO event `order_status_updated`

### 7.2 Pool Scanner / Ticket Validation

**Actor**: Lifeguard, Pool Staff  
**Frontend**: `/staff/scanner`  
**API**: `POST /pool/staff/validate`

1. Staff opens scanner page
2. Manual entry field auto-focused
3. Staff enters ticket number (or scans QR → auto-submits)
4. POST to `/pool/staff/validate` with `{ticketNumber: code}`
5. Response: success/fail with ticket details
6. Scan history maintained (last 10 scans)
7. Entry/exit recording: `POST /pool/tickets/:id/entry` and `/exit`

### 7.3 Chalet Check-in / Check-out

**Actor**: Receptionist, Chalet Staff  
**Frontend**: `/staff/chalets`

1. Staff views today's bookings: `GET /chalets/staff/bookings/today`
2. Guest arrives → Staff checks in: `PATCH /chalets/staff/bookings/:id/check-in`
3. Guest departs → Staff checks out: `PATCH /chalets/staff/bookings/:id/check-out`
4. Check-out triggers housekeeping task (side effect)

### 7.4 Pool Bracelet Management

**Actor**: Pool Staff  
**Frontend**: Part of staff pool interface

1. After ticket validation, staff assigns bracelet: `POST /pool/tickets/:id/bracelet`
2. Track active bracelets: `GET /pool/staff/bracelets/active`
3. Search guest by bracelet: `GET /pool/staff/bracelets/search`
4. Guest leaves → return bracelet: `DELETE /pool/tickets/:id/bracelet`

### 7.5 Snack Bar Order Management

**Actor**: Snack Staff  
**Frontend**: `/staff/snack`

Same pattern as restaurant kitchen display but for snack module:
- `GET /snack/staff/orders/live`
- `PATCH /snack/staff/orders/:id/status`

### 7.6 Table Management

**Actor**: Waiter, Host  
**Frontend**: Part of staff restaurant interface

1. View tables: `GET /restaurant/staff/tables`
2. Update table status (occupied/available): `PATCH /restaurant/staff/tables/:id`
3. Generate QR for table ordering: `GET /restaurant/tables/:id/qr`

---

## 8. FRONTEND COMPONENT DETAILS

### 8.1 Restaurant Checkout (`/restaurant/cart`)

**File**: `frontend/src/app/restaurant/cart/page.tsx` (927 lines)

**3-Step Flow**:
1. **Step 1 — Cart Review**: Display items, quantities, modify
2. **Step 2 — Customer Info**:
   - Customer name (required)
   - Phone number (required)
   - Table number (for dine-in)
   - Order type: `dine_in` | `takeaway` | `delivery`
3. **Step 3 — Payment**:
   - Payment method: `cash` | `card`
   - `PaymentDiscounts` component (coupons, gift cards, loyalty)
   - For card: `StripePayment` component
   - Price breakdown: subtotal, tax, service charge (if dine-in), delivery fee (if delivery), discounts, total

**Dynamic values from settings**:
- `tax_rate` (default 0.11)
- `service_charge_rate` (default 0.10, dine-in only)
- `delivery_fee` (default $5, delivery only)

### 8.2 PaymentDiscounts Component

**File**: `frontend/src/components/customer/PaymentDiscounts.tsx` (426 lines)

Collapsible panel with 3 discount sections:

1. **Coupon Section** (`CouponInput` sub-component):
   - Text input for code
   - POST `/coupons/validate` on apply
   - Shows available coupons (`AvailableCoupons`)
   - One coupon at a time (replaces previous)

2. **Gift Card Section**:
   - Text input for code
   - `GET /giftcards/check/:code` → shows balance
   - Apply button → calculates `min(balance, remainingTotal)`
   - Remove button to unapply

3. **Loyalty Points Section** (authenticated only):
   - Loads account via `GET /loyalty/me`
   - Shows available points and dollar value
   - Input for points to redeem
   - "Redeem All" button
   - Max = `min(available_points, ceil(remainingTotal × pointsRate))`

**Props**: `orderTotal`, `orderType`, `moduleId`, `onTotalChange(finalTotal, discounts[])`

### 8.3 Pool Booking (`/pool`)

**File**: `frontend/src/app/pool/page.tsx` (696 lines)

- Date picker (defaults to today)
- Sessions list loaded via `poolApi.getSessions(date, moduleId)` or `poolApi.getAvailability(date, moduleId)`
- Each session shows: name, time, price, available/total capacity
- Adult/child count selectors (increment/decrement)
- Customer name and phone fields
- Payment method: cash only (in current implementation)
- Submits to `POST /pool/tickets`
- Socket.IO subscription for real-time capacity updates

### 8.4 Chalet Detail & Booking (`/chalets/[id]`)

**File**: `frontend/src/app/chalets/[id]/page.tsx` (620 lines)

- Image carousel with prev/next
- Amenity icons (WiFi, AC, Kitchen, Parking)
- Date pickers: check-in / check-out
- Guest count selector
- Add-on selection (toggle on/off, quantity adjustment)
- Pricing calculation:
  - Per-night pricing: weekday (base_price) vs weekend (weekend_price, Fri/Sat)
  - Add-ons: per_night × nights OR one_time
  - Deposit: 30% of base amount
  - Total: base + add-ons
- Availability check: fetches blocked dates, validates no overlap
- Customer info: name (from auth), email (from auth), phone, special requests
- Submit: `POST /chalets/bookings` → redirects to `/chalets/booking-confirmation?id=`

### 8.5 Cart Store (Zustand)

**File**: `frontend/src/stores/cartStore.ts` (195 lines)

```typescript
interface CartItem {
  id: string;
  moduleId: string;      // 'restaurant' | 'snack-bar' | other
  name: string;
  price: number;
  quantity: number;
  modifiers?: Modifier[];
  uniqueKey: string;      // moduleId-id-modifierHash
}
```

- Persisted in localStorage key: `v2-resort-cart`
- `addItem(item)` — increments if same uniqueKey exists, else adds
- `removeItem(uniqueKey)` — removes entirely
- `updateQuantity(uniqueKey, quantity)` — updates or removes if 0
- `clearCart()` — removes all items
- `getRestaurantItems()` — filters moduleId === 'restaurant'
- `getSnackItems()` — filters moduleId === 'snack-bar'
- `getTotal()` — Σ `(price + modifierTotal) × quantity`

### 8.6 Auth Store (Zustand)

**File**: `frontend/src/stores/authStore.ts` (36 lines)

```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; name: string; email: string; role: string } | null;
  token: string | null;
}
```

Persisted in localStorage key: `auth-storage`

### 8.7 Settings Store (Zustand)

**File**: `frontend/src/stores/settingsStore.ts`

```typescript
interface SettingsState {
  resortTheme: string;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  currency: 'USD' | 'EUR' | 'LBP';
  transitionStyle: string;
  enableTransitions: boolean;
}
```

Persisted in localStorage key: `v2-resort-settings`

### 8.8 API Client

**File**: `frontend/src/lib/api.ts` (436 lines)

- Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:3005/api/v1`)
- `withCredentials: true` for CSRF cookies
- 30-second timeout
- Retry: 3 retries with exponential backoff (1s base, 2× factor, ±30% jitter) for 408/429/5xx on GET/HEAD/OPTIONS/PUT/DELETE
- CSRF: Double Submit Cookie pattern — fetches token if not in cookies, adds `X-CSRF-Token` header to mutations
- Auth: JWT from `localStorage.getItem('accessToken')`, proactive refresh if expiring within 60s
- Refresh: queues concurrent 401 failures, retries all after refresh completes

**Exported API objects**: `authApi`, `restaurantApi`, `snackApi`, `chaletsApi`, `poolApi`, `modulesApi`, `inventoryApi`, `paymentsApi`, `supportApi`

---

## 9. IMPLEMENTED VS STUBBED

### 9.1 Fully Implemented (Backend + Frontend + Tests)

| Feature | Evidence |
|---|---|
| Restaurant menu display & ordering | 53 route endpoints, full frontend, Playwright tests pass |
| Snack bar menu & ordering | 18 route endpoints, full frontend |
| Pool session browsing & ticket purchase | 25 route endpoints, full frontend with real-time capacity |
| Chalet listing, detail, booking | 29 route endpoints, full frontend with pricing calculator |
| Authentication (register/login/logout/refresh) | Full flow, JWT + refresh, rate limiting, CSRF |
| Admin module CRUD | Full CRUD with soft-delete support |
| Admin user management | Full CRUD with role assignment |
| Admin settings management | Settings, homepage, translations |
| Coupon system | Full lifecycle: create → validate → apply |
| Gift card system | Full lifecycle: create → check balance → redeem |
| Loyalty program | Full lifecycle: enroll → earn → redeem → tiers |
| Reviews | Create → moderate → display |
| Inventory management | Full CRUD + recipes + alerts + reports |
| Housekeeping | Tasks, schedules, auto-generation |
| Staff shifts & scheduling | Full CRUD + clock-in/out + swap system |
| Reporting system | Templates, execution, KPIs, dashboards, scheduled reports |
| Audit logging | Full audit trail |
| Backup/restore | Create, download, restore, delete |
| Socket.IO real-time | Kitchen display, capacity updates, dashboard metrics |
| i18n (3 languages) | English, Arabic (RTL), French |
| GDPR compliance | Data export, delete, portable format |
| Payment (Stripe + cash) | PaymentIntent creation, webhook handling, cash recording |
| QR ticket scanning | Manual entry + validation |
| Restaurant table management | CRUD, QR codes, reservation assignment |
| Reservation system | Create, review, assign table, status management |
| Notification system | Templates, broadcasts, scheduled |
| Terminology customization | White-label term overrides |

### 9.2 Backend Exists, Frontend Partial/Missing

| Feature | Backend Module | Frontend Status |
|---|---|---|
| Waitlist | `restaurant.routes.ts` has waitlist sub-router | Form not rendering (PHASE3 report) |
| Forgot password page | `POST /auth/forgot-password` works | Route returns 404 in dev |
| Gift cards page | `giftcard.routes.ts` full | `/giftcards` frontend returns 404 |
| Mobile check-in | `mobile-checkin.routes.ts` exists | No frontend implementation found |
| POS system | `pos-hardware.routes.ts` exists | No frontend POS interface |
| Marketing automation | `marketing.routes.ts` exists | Marketing side effects never fire (M1) |
| Messaging | `messaging.routes.ts` exists | No frontend messaging UI |
| Channels | `channel.routes.ts` exists | Possibly admin-only |
| Groups | `groups.routes.ts` exists | No frontend found |
| Finance | `finance.routes.ts` exists | No frontend found |
| Revenue management | `revenue.routes.ts` exists | No frontend found |
| Parity | `parity.routes.ts` exists | No frontend found |
| Promotions | `promotions.routes.ts` exists | Admin page exists but unclear implementation |
| Multi-property | `multi-property.routes.ts` exists | Admin page exists, likely basic |
| Kiosk mode | `kiosk.routes.ts` exists | `/kiosk` page exists, implementation depth unclear |

### 9.3 Planned but Not Implemented

| Feature | Status |
|---|---|
| Engine D (Ongoing Entitlement) | Designed in docs, no code |
| WebAuthn biometric auth | Controller exists, feature incomplete |
| Webhook retry system | Service exists, cron never fires (M2) |
| Marketing automation triggers | Service exists, never called |

### 9.4 Known Broken in Dev Environment

| Issue | Description | Impact |
|---|---|---|
| **CSRF 403** | `NEXT_PUBLIC_API_URL` may point to Render, not localhost | All mutation operations via UI fail in some setups |
| **id attribute stripping** | Next.js hydration removes `id` attributes | Playwright selectors using `#id` fail |
| `/forgot-password` 404 | Page route missing from frontend | Password reset flow broken |
| `/giftcards` 404 | Page route missing from frontend | Gift card purchasing broken |
| Waitlist form not rendering | Component conditionally not shown | Waitlist flow untestable |
| Create module button missing | Admin UI button not visible | Module creation via UI blocked |
| Create coupon button missing | Admin UI button not visible | Coupon creation via UI blocked |

### 9.5 Known Race Conditions (from PHASE_1 audit)

| ID | Severity | Description |
|---|---|---|
| H1 | HIGH | Gift card over-redemption: concurrent redemptions can exceed balance |
| H2 | HIGH | Pool capacity breach: concurrent purchases can exceed session capacity |
| H3 | HIGH | Payment webhook partial failure: multi-step webhook handler can partially succeed |
| H4 | HIGH | No database transactions: all writes are individual, no atomicity |
| H5 | HIGH | Ghost roles (e.g., `guest_services_agent`) referenced but never seeded |
| H6 | HIGH | Ghost roles with permission gaps |
| M1 | MEDIUM | Marketing automation scheduled but never fires |
| M2 | MEDIUM | Webhook retry cron scheduled but never fires |

---

## APPENDIX A: Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `new_order` | Server → Client | New order placed |
| `order_status_updated` | Server → Client | Order status changed |
| `capacity_updated` | Server → Client | Pool capacity changed |
| `dashboard_update` | Server → Client | Dashboard metric changed |
| `notification` | Server → Client | New notification |
| `booking_update` | Server → Client | Chalet booking status change |

## APPENDIX B: Cron Jobs (7 scheduled)

| Job | Schedule | Status |
|---|---|---|
| Expired token cleanup | Periodic | Active |
| Session cleanup | Periodic | Active |
| Scheduled report execution | Periodic | Active |
| Backup verification | Periodic | Active |
| Inventory expiry check | Periodic | Active |
| Marketing automation (M1) | Periodic | **Never fires** |
| Webhook retry (M2) | Periodic | **Never fires** |

## APPENDIX C: Middleware Pipeline

Request processing order:
1. `security-headers` — Helmet, CSP, HSTS
2. `cors` — Origin whitelist
3. `requestId` / `correlation-id` — UUID per request
4. `requestLogger` — Log method, path, timing
5. `csrf` — Double Submit Cookie validation
6. `rateLimit` — Global rate limiting
7. `normalizeBody` — Body normalization
8. `api-security` — Additional security checks
9. `moduleGuard` — Per-module route, checks module active
10. `auth` / `authenticate` — JWT verification
11. `roleGuard` / `authorize` — Role checking
12. `permission` — Granular permission checking
13. `validation` — Request body validation (Zod)
14. `userRateLimit` — Per-user rate limiting
15. `monitoring` — Performance monitoring

## APPENDIX D: Test Data for Pricing Assertions

### Example 1: Restaurant Dine-In Order

```
Items: 2× Chicken Shawarma ($18) + 1× Fresh Lemonade ($5)
Subtotal: $18×2 + $5×1 = $41
Tax (11%): $41 × 0.11 = $4.51
Service Charge (10%, dine-in): $41 × 0.10 = $4.10
Total: $41 + $4.51 + $4.10 = $49.61
```

### Example 2: Restaurant Delivery Order

```
Items: 1× Mixed Grill ($35) + 1× Hummus ($8)
Subtotal: $43
Tax (11%): $43 × 0.11 = $4.73
Delivery Fee: $5
Total: $43 + $4.73 + $5 = $52.73
```

### Example 3: Restaurant Order with Coupon (10% off)

```
Items: 1× Lamb Kofta ($22)
Coupon: 10% off → $22 × 0.10 = $2.20 (pre-tax discount)
Discounted subtotal: $22 - $2.20 = $19.80
Tax (11%): $19.80 × 0.11 = $2.178
Total: $19.80 + $2.178 = $21.978 → ~$21.98
```

### Example 4: Chalet Booking (3 nights, Wed-Sat)

```
Mountain View Chalet:
  Wed night: $150 (weekday)
  Thu night: $150 (weekday)
  Fri night: $200 (weekend)
Base: $500
Add-on: Breakfast Package ($15/night × 3) = $45
Add-on: BBQ Package ($30 one_time) = $30
Total: $500 + $45 + $30 = $575
Deposit (30%): $500 × 0.30 = $150
```

### Example 5: Pool Tickets

```
Afternoon Session: $20/adult
3 adults + 2 children
Total: 3 × $20 + 2 × child_price
(Note: child pricing not explicit in seed — may be $0 or derived from settings)
```

---

*End of E2E Test Specification*
