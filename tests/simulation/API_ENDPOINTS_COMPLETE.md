# V2 Ecosystem Backend - Complete API Endpoints Audit

**Generated:** February 3, 2026  
**Base URL:** `/api/v1`

---

## Table of Contents

1. [Authentication & Users](#1-authentication--users)
2. [Kiosk Management](#2-kiosk-management)
3. [Device Management](#3-device-management)
4. [Restaurant & Waitlist](#4-restaurant--waitlist)
5. [Pool & Spa Management](#5-pool--spa-management)
6. [Chalet Bookings](#6-chalet-bookings)
7. [Snack Bar](#7-snack-bar)
8. [Marketing Campaigns](#8-marketing-campaigns)
9. [Loyalty Program](#9-loyalty-program)
10. [Gift Cards](#10-gift-cards)
11. [Coupons & Promotions](#11-coupons--promotions)
12. [Housekeeping](#12-housekeeping)
13. [Inventory Management](#13-inventory-management)
14. [Reporting & Analytics](#14-reporting--analytics)
15. [Revenue Management](#15-revenue-management)
16. [Channel Management](#16-channel-management)
17. [Rate Parity](#17-rate-parity)
18. [Multi-Property](#18-multi-property)
19. [Group Bookings](#19-group-bookings)
20. [Guest Messaging](#20-guest-messaging)
21. [Mobile Check-in](#21-mobile-check-in)
22. [Internationalization (i18n)](#22-internationalization-i18n)
23. [GDPR & Privacy](#23-gdpr--privacy)
24. [Staff Management](#24-staff-management)
25. [Manager Approvals](#25-manager-approvals)
26. [Payments](#26-payments)
27. [POS Hardware](#27-pos-hardware)
28. [Finance & Cash Management](#28-finance--cash-management)
29. [Admin Panel](#29-admin-panel)
30. [Reviews](#30-reviews)
31. [Support](#31-support)
32. [QuickBooks Integration](#32-quickbooks-integration)
33. [White-Label & Terminology](#33-white-label--terminology)
34. [Generic Routes](#34-generic-routes)

---

## 1. Authentication & Users

### Auth Routes (`/api/v1/auth`)

| Method | Endpoint | Description | Auth | Params/Body |
|--------|----------|-------------|------|-------------|
| POST | `/register` | Register new user | Public | `email`, `password`, `first_name`, `last_name` |
| POST | `/login` | User login | Public | `email`, `password` |
| POST | `/refresh` | Refresh access token | Public | `refreshToken` |
| POST | `/forgot-password` | Request password reset | Public | `email` |
| POST | `/reset-password` | Reset password | Public | `token`, `password` |
| GET | `/me` | Get current user | Auth | - |
| POST | `/logout` | Logout user | Auth | - |
| PUT | `/change-password` | Change password | Auth | `currentPassword`, `newPassword` |

### OAuth Routes (`/api/v1/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/google` | Initiate Google OAuth | Public |
| GET | `/google/callback` | Google OAuth callback | Public |
| GET | `/facebook` | Initiate Facebook OAuth | Public |
| GET | `/facebook/callback` | Facebook OAuth callback | Public |
| GET | `/apple` | Initiate Apple OAuth | Public |
| POST | `/apple/callback` | Apple OAuth callback | Public |

### 2FA Routes (`/api/v1/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/2fa/verify` | Verify 2FA code | Semi-public |
| GET | `/2fa/status` | Get 2FA status | Auth |
| POST | `/2fa/setup` | Initialize 2FA setup | Auth |
| POST | `/2fa/enable` | Enable 2FA | Auth |
| POST | `/2fa/disable` | Disable 2FA | Auth |
| POST | `/2fa/backup-codes` | Regenerate backup codes | Auth |

### Biometric Auth (`/api/v1/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/biometric/authenticate-begin` | Begin biometric auth | Public |
| POST | `/biometric/authenticate-complete` | Complete biometric auth | Public |
| POST | `/biometric/register-begin` | Begin credential registration | Auth |
| POST | `/biometric/register-complete` | Complete credential registration | Auth |
| GET | `/biometric/credentials` | List registered credentials | Auth |
| DELETE | `/biometric/credentials/:id` | Delete credential | Auth |

### User Routes (`/api/v1/users`)

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/me/data` | GDPR: Export user data | Auth | - |
| DELETE | `/me/data` | GDPR: Delete user data | Auth | - |
| POST | `/me/data/portable` | GDPR: Portable data export | Auth | - |
| GET | `/profile` | Get user profile | Auth | - |
| PUT | `/profile` | Update user profile | Auth | - |
| GET | `/` | List all users | Auth | super_admin, admin |
| GET | `/:id` | Get user by ID | Auth | super_admin, admin |
| PUT | `/:id/roles` | Update user roles | Auth | super_admin |

---

## 2. Kiosk Management

### Routes: `/api/v1/kiosk`

#### Device Management (Staff Only)

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/devices/:propertyId` | Register new kiosk device | Auth | admin, manager |
| GET | `/devices/:deviceId` | Get device by ID | Auth | admin, manager, front_desk |
| GET | `/devices/property/:propertyId` | Get all property devices | Auth | admin, manager, front_desk |
| PATCH | `/devices/:deviceId/status` | Update device status | Device Token | - |
| PATCH | `/devices/:deviceId/config` | Update device config | Auth | admin, manager |
| POST | `/devices/:deviceId/maintenance` | Set maintenance mode | Auth | admin, manager |
| DELETE | `/devices/:deviceId` | Deactivate device | Auth | admin, manager |
| POST | `/devices/:deviceId/heartbeat` | Device heartbeat | Device Token | - |

#### Session Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/sessions/:kioskId` | Start session | Public |
| GET | `/sessions/:sessionId` | Get session | Public |
| PATCH | `/sessions/:sessionId/step` | Update session step | Public |
| POST | `/sessions/:sessionId/abandon` | Abandon session | Public |
| POST | `/sessions/:sessionId/transfer` | Transfer to desk | Public |

#### Check-in/Check-out (Guest Facing)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/checkin/:kioskId` | Initiate check-in | Public |
| POST | `/checkin/:sessionId/complete` | Complete check-in | Public |
| POST | `/checkout/:kioskId` | Initiate check-out | Public |
| POST | `/checkout/:sessionId/complete` | Complete check-out | Public |

#### Transactions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/transactions/:sessionId/:kioskId/id-scan` | Scan ID | Public |
| POST | `/transactions/:sessionId/:kioskId/key-encode` | Encode key | Public |
| POST | `/transactions/:sessionId/:kioskId/payment` | Process payment | Public |
| POST | `/transactions/:sessionId/:kioskId/receipt` | Print receipt | Public |

#### Key Stock (Staff Only)

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/key-stock/:kioskId` | Get key stock | Auth | admin, manager, front_desk |
| POST | `/key-stock/:kioskId/refill` | Refill key stock | Auth | admin, manager, front_desk |

#### Hardware Events

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/hardware-events/:kioskId` | Log hardware event | Public | - |
| POST | `/hardware-events/:eventId/resolve` | Resolve hardware event | Auth | admin, manager, maintenance |
| GET | `/hardware-events` | Get unresolved events | Auth | admin, manager, front_desk, maintenance |

#### Screen Flows

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/flows/:propertyId/:flowType` | Get flow configuration | Public |
| GET | `/flows/:flowId/content/:stepKey` | Get screen content | Public |

#### Analytics

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/analytics/:propertyId` | Get kiosk analytics | Auth | admin, manager |

---

## 3. Device Management

### Routes: `/api/v1/devices`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register device for push notifications | Auth |
| DELETE | `/unregister` | Unregister device (soft delete) | Auth |
| GET | `/` | Get all registered devices for user | Auth |
| PATCH | `/:deviceId/preferences` | Update device notification preferences | Auth |
| DELETE | `/:deviceId` | Remove specific device (hard delete) | Auth |
| POST | `/logout-all` | Logout from all devices | Auth |

**Body for `/register`:**
```json
{
  "deviceToken": "string (required)",
  "platform": "ios | android | web (required)",
  "deviceName": "string (optional)",
  "appVersion": "string (optional)",
  "deviceModel": "string (optional)",
  "osVersion": "string (optional)",
  "notificationsEnabled": "boolean (optional)"
}
```

---

## 4. Restaurant & Waitlist

### Waitlist Routes: `/api/v1/restaurant/waitlist`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/join` | Join waitlist | Public | - |
| POST | `/` | Join waitlist (alt) | Public | - |
| GET | `/` | Get waitlist | Public | - |
| GET | `/:id` | Get single entry | Public | - |
| PATCH | `/:id/status` | Update status | Auth | staff, admin, manager |
| POST | `/:id/notify` | Notify entry | Auth | staff, admin, manager |
| DELETE | `/:id` | Delete entry | Auth | staff, admin, manager |

### Restaurant Routes: `/api/v1/restaurant`

#### Public Menu Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/menu` | Get full menu | Public |
| GET | `/menu/categories` | Get categories | Public |
| GET | `/menu/items` | Get menu items | Public |
| GET | `/menu/items/:id` | Get menu item | Public |
| GET | `/menu/featured` | Get featured items | Public |
| GET | `/categories` | Get categories (alt) | Public |
| GET | `/items` | Get items (alt) | Public |

#### Customer Order Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/orders` | Create order | Optional |
| GET | `/orders/:id` | Get order | Optional |
| GET | `/orders/:id/status` | Get order status | Optional |
| GET | `/my-orders` | Get my orders | Auth |

#### Staff Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/staff/orders` | Get all orders | Auth | staff, restaurant_* |
| GET | `/staff/orders/live` | Get live orders | Auth | staff, restaurant_* |
| PATCH | `/staff/orders/:id/status` | Update order status | Auth | staff, restaurant_* |
| GET | `/staff/tables` | Get tables | Auth | staff, restaurant_* |
| PATCH | `/staff/tables/:id` | Update table | Auth | staff, restaurant_* |

#### Reservations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/reservations` | Get all reservations | Auth | staff |
| GET | `/reservations/availability` | Check availability | Public | - |
| POST | `/reservations` | Create reservation | Public | - |
| PATCH | `/reservations/:id` | Update reservation | Auth | staff |
| POST | `/reservations/:id/assign-table` | Assign table | Auth | staff |
| GET | `/reservations/:id` | Get single reservation | Auth | staff |

#### Tables (Public)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/tables` | Get tables | Public |
| GET | `/tables/available` | Get available tables | Public |

#### Admin Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/admin/categories` | Create category | Auth | admin |
| PUT | `/admin/categories/:id` | Update category | Auth | admin |
| DELETE | `/admin/categories/:id` | Delete category | Auth | admin |
| POST | `/admin/items` | Create menu item | Auth | admin |
| PUT | `/admin/items/:id` | Update menu item | Auth | admin |
| DELETE | `/admin/items/:id` | Delete menu item | Auth | admin |
| PATCH | `/admin/items/:id/availability` | Toggle availability | Auth | admin |
| GET | `/admin/orders` | Get all orders | Auth | admin |
| PUT | `/admin/orders/:id/status` | Update order status | Auth | admin |
| POST | `/admin/tables` | Create table | Auth | admin |
| DELETE | `/admin/tables/:id` | Delete table | Auth | admin |
| GET | `/admin/reports/daily` | Get daily report | Auth | admin |
| GET | `/admin/reports/sales` | Get sales report | Auth | admin |

### Modifiers Routes: `/api/v1/restaurant/modifiers`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/` | Get modifier groups | Public | - |
| POST | `/` | Create modifier group | Auth | admin |
| PUT | `/:id` | Update modifier group | Auth | admin |
| DELETE | `/:id` | Delete modifier group | Auth | admin |

---

## 5. Pool & Spa Management

### Routes: `/api/v1/pool`

#### Public Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/sessions` | Get sessions | Public |
| GET | `/sessions/:id` | Get session | Public |
| GET | `/availability` | Get availability | Public |
| GET | `/settings` | Get pool settings | Public |

#### Customer Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/tickets` | Purchase ticket | Optional |
| GET | `/tickets/:id` | Get ticket | Optional |
| DELETE | `/tickets/:id` | Cancel ticket | Auth |
| GET | `/my-tickets` | Get my tickets | Auth |

#### Staff Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/staff/validate` | Validate ticket | Auth | pool_staff, pool_admin |
| POST | `/tickets/:id/entry` | Record entry | Auth | pool_staff, pool_admin |
| POST | `/tickets/:id/exit` | Record exit | Auth | pool_staff, pool_admin |
| GET | `/staff/capacity` | Get current capacity | Auth | pool_staff, pool_admin |
| GET | `/staff/tickets/today` | Get today's tickets | Auth | pool_staff, pool_admin |
| GET | `/staff/maintenance` | Get maintenance logs | Auth | pool_staff, pool_admin |
| POST | `/staff/maintenance` | Create maintenance log | Auth | pool_staff, pool_admin |

#### Bracelet Management

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/tickets/:id/bracelet` | Assign bracelet | Auth | pool_staff, pool_admin |
| DELETE | `/tickets/:id/bracelet` | Return bracelet | Auth | pool_staff, pool_admin |
| GET | `/staff/bracelets/active` | Get active bracelets | Auth | pool_staff, pool_admin |
| GET | `/staff/bracelets/search` | Search by bracelet | Auth | pool_staff, pool_admin |

#### Admin Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| PUT | `/admin/settings` | Update settings | Auth | pool_admin |
| POST | `/admin/reset-occupancy` | Reset occupancy | Auth | pool_admin |
| POST | `/admin/sessions` | Create session | Auth | pool_admin |
| PUT | `/admin/sessions/:id` | Update session | Auth | pool_admin |
| DELETE | `/admin/sessions/:id` | Delete session | Auth | pool_admin |
| GET | `/admin/reports/daily` | Get daily report | Auth | pool_admin |

---

## 6. Chalet Bookings

### Routes: `/api/v1/chalets`

#### Public Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/add-ons` | Get add-ons | Public |
| GET | `/` | Get chalets | Public |
| GET | `/:id` | Get chalet | Public |
| GET | `/:id/availability` | Get availability | Public |

#### Customer Booking Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/bookings` | Create booking | Optional |
| GET | `/bookings/:id` | Get booking | Optional |
| POST | `/bookings/:id/cancel` | Cancel booking | Optional |
| GET | `/my-bookings` | Get my bookings | Auth |

#### Staff Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/staff/bookings` | Get staff bookings | Auth | chalet_staff, chalet_admin |
| GET | `/staff/bookings/today` | Get today's bookings | Auth | chalet_staff, chalet_admin |
| PATCH | `/staff/bookings/:id/check-in` | Check-in | Auth | chalet_staff, chalet_admin |
| PATCH | `/staff/bookings/:id/check-out` | Check-out | Auth | chalet_staff, chalet_admin |
| PATCH | `/staff/bookings/:id/status` | Update status | Auth | chalet_staff, chalet_admin |

#### Admin Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/admin/add-ons` | Get admin add-ons | Auth | chalet_admin |
| POST | `/admin/chalets` | Create chalet | Auth | chalet_admin |
| PUT | `/admin/chalets/:id` | Update chalet | Auth | chalet_admin |
| DELETE | `/admin/chalets/:id` | Delete chalet | Auth | chalet_admin |
| POST | `/admin/add-ons` | Create add-on | Auth | chalet_admin |
| PUT | `/admin/add-ons/:id` | Update add-on | Auth | chalet_admin |
| DELETE | `/admin/add-ons/:id` | Delete add-on | Auth | chalet_admin |
| GET | `/admin/price-rules` | Get price rules | Auth | chalet_admin |
| POST | `/admin/price-rules` | Create price rule | Auth | chalet_admin |
| PUT | `/admin/price-rules/:id` | Update price rule | Auth | chalet_admin |
| DELETE | `/admin/price-rules/:id` | Delete price rule | Auth | chalet_admin |
| GET | `/admin/settings` | Get settings | Auth | chalet_admin |
| PUT | `/admin/settings` | Update settings | Auth | chalet_admin |

---

## 7. Snack Bar

### Routes: `/api/v1/snack`

#### Public Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/categories` | Get categories | Public |
| GET | `/items` | Get items | Public |
| GET | `/items/:id` | Get item | Public |

#### Customer Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/orders` | Create order | Optional |
| GET | `/orders/my` | Get my orders | Auth |
| GET | `/orders/:id` | Get order | Public |
| GET | `/orders/:id/status` | Get order status | Public |

#### Staff Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/staff/orders` | Get staff orders | Auth | snack_bar_staff, snack_bar_admin |
| GET | `/staff/orders/live` | Get live orders | Auth | snack_bar_staff, snack_bar_admin |
| PATCH | `/staff/orders/:id/status` | Update status | Auth | snack_bar_staff, snack_bar_admin |

#### Admin Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/admin/categories` | Create category | Auth | snack_bar_admin |
| PUT | `/admin/categories/:id` | Update category | Auth | snack_bar_admin |
| DELETE | `/admin/categories/:id` | Delete category | Auth | snack_bar_admin |
| POST | `/admin/items` | Create item | Auth | snack_bar_admin |
| PUT | `/admin/items/:id` | Update item | Auth | snack_bar_admin |
| DELETE | `/admin/items/:id` | Delete item | Auth | snack_bar_admin |
| PATCH | `/admin/items/:id/availability` | Toggle availability | Auth | snack_bar_admin |

---

## 8. Marketing Campaigns

### Routes: `/api/v1/marketing`

#### Tracking (Public)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/track/open/:sendId` | Track email open | Public |
| GET | `/track/click/:sendId` | Track email click | Public |
| POST | `/unsubscribe/:propertyId/:guestId` | Handle unsubscribe | Public |

#### Segments

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/properties/:propertyId/segments` | Create segment | Auth | admin, manager, marketing |
| GET | `/properties/:propertyId/segments` | Get segments | Auth | admin, manager, marketing |
| GET | `/segments/:segmentId/members` | Get segment members | Auth | admin, manager, marketing |
| POST | `/segments/:segmentId/calculate` | Calculate members | Auth | admin, manager, marketing |
| POST | `/segments/:segmentId/add` | Add to segment | Auth | admin, manager, marketing |
| POST | `/segments/:segmentId/remove` | Remove from segment | Auth | admin, manager, marketing |

#### Email Templates

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/properties/:propertyId/templates` | Create template | Auth | admin, manager, marketing |
| GET | `/properties/:propertyId/templates` | Get templates | Auth | admin, manager, marketing |
| PATCH | `/templates/:templateId` | Update template | Auth | admin, manager, marketing |
| POST | `/templates/:templateId/duplicate` | Duplicate template | Auth | admin, manager, marketing |

#### Email Journeys

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/properties/:propertyId/journeys` | Create journey | Auth | admin, manager, marketing |
| GET | `/properties/:propertyId/journeys` | Get journeys | Auth | admin, manager, marketing |
| GET | `/journeys/:journeyId` | Get journey with steps | Auth | admin, manager, marketing |
| POST | `/journeys/:journeyId/activate` | Activate journey | Auth | admin, manager, marketing |
| POST | `/journeys/:journeyId/pause` | Pause journey | Auth | admin, manager, marketing |
| POST | `/journeys/:journeyId/enroll` | Enroll in journey | Auth | admin, manager, marketing |
| GET | `/journeys/:journeyId/analytics` | Get journey analytics | Auth | admin, manager, marketing |

#### Campaigns

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/properties/:propertyId/campaigns` | Create campaign | Auth | admin, manager, marketing |
| GET | `/properties/:propertyId/campaigns` | Get campaigns | Auth | admin, manager, marketing |
| POST | `/campaigns/:campaignId/send` | Send campaign | Auth | admin, manager, marketing |
| POST | `/campaigns/:campaignId/schedule` | Schedule campaign | Auth | admin, manager, marketing |
| POST | `/campaigns/:campaignId/cancel` | Cancel campaign | Auth | admin, manager, marketing |
| GET | `/campaigns/:campaignId/analytics` | Get analytics | Auth | admin, manager, marketing |

#### Automations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/properties/:propertyId/automations` | Create automation | Auth | admin, manager, marketing |
| GET | `/properties/:propertyId/automations` | Get automations | Auth | admin, manager, marketing |
| POST | `/automations/:automationId/trigger` | Trigger automation | Auth | admin, manager, marketing, system |

#### Promo Codes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/properties/:propertyId/promo-codes` | Create promo code | Auth | admin, manager, marketing |
| POST | `/properties/:propertyId/promo-codes/validate` | Validate promo code | Auth | admin, manager, front_desk, system |

---

## 9. Loyalty Program

### Routes: `/api/v1/loyalty`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/calculate` | Calculate points | Public | - |
| GET | `/me` | Get my account | Auth | - |
| GET | `/me/transactions` | Get my transactions | Auth | - |
| GET | `/settings` | Get settings | Public | - |
| GET | `/tiers` | Get tiers | Public | - |
| GET | `/accounts` | Get all accounts | Auth | admin, super_admin |
| GET | `/accounts/:userId` | Get account | Auth | admin, super_admin, staff |
| GET | `/accounts/:userId/transactions` | Get transactions | Auth | admin, super_admin, staff |
| GET | `/stats` | Get stats | Auth | admin, super_admin |
| POST | `/earn` | Earn points | Auth | admin, super_admin, staff |
| POST | `/redeem` | Redeem points | Auth | admin, super_admin, staff |
| POST | `/adjust` | Adjust points | Auth | admin, super_admin |
| POST | `/accounts/:accountId/adjust` | Adjust by account ID | Auth | admin, super_admin |
| PUT | `/settings` | Update settings | Auth | admin, super_admin |
| PUT | `/tiers/:tierId` | Update tier | Auth | admin, super_admin |

---

## 10. Gift Cards

### Routes: `/api/v1/giftcards`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/templates` | Get templates | Public | - |
| GET | `/check/:code` | Check balance | Public | - |
| POST | `/purchase` | Purchase gift card | Auth | - |
| GET | `/my` | Get my gift cards | Auth | - |
| POST | `/redeem` | Redeem gift card | Auth | - |
| GET | `/` | Get all gift cards | Auth | admin, super_admin |
| GET | `/admin` | Get all (alt) | Auth | admin, super_admin |
| GET | `/stats` | Get stats | Auth | admin, super_admin |
| GET | `/admin/stats` | Get stats (alt) | Auth | admin, super_admin |
| GET | `/:id` | Get gift card | Auth | admin, super_admin |
| POST | `/` | Create gift card | Auth | admin, super_admin |
| POST | `/admin` | Create (alt) | Auth | admin, super_admin |
| PUT | `/:id/disable` | Disable gift card | Auth | admin, super_admin |
| PUT | `/admin/:id/disable` | Disable (alt) | Auth | admin, super_admin |
| POST | `/templates` | Create template | Auth | admin, super_admin |
| PUT | `/templates/:id` | Update template | Auth | admin, super_admin |

---

## 11. Coupons & Promotions

### Coupon Routes: `/api/v1/coupons`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/active` | Get active coupons | Public | - |
| POST | `/validate` | Validate coupon | Public | - |
| POST | `/apply` | Apply coupon | Auth | - |
| GET | `/` | Get all coupons | Auth | admin, super_admin |
| GET | `/stats` | Get stats | Auth | admin, super_admin |
| GET | `/generate-code` | Generate code | Auth | admin, super_admin |
| GET | `/:id` | Get coupon | Auth | admin, super_admin |
| POST | `/` | Create coupon | Auth | admin, super_admin |
| PUT | `/:id` | Update coupon | Auth | admin, super_admin |
| DELETE | `/:id` | Delete coupon | Auth | admin, super_admin |

### Promotions Routes: `/api/v1/promotions`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/coupons/apply` | Apply coupon | Auth | - |
| POST | `/coupons` | Create coupon | Auth | admin, super_admin |
| GET | `/coupons/abuse-report` | Get abuse report | Auth | admin, super_admin |
| POST | `/gift-cards` | Issue gift card | Auth | - |
| GET | `/gift-cards/:code/balance` | Check balance | Auth | - |
| POST | `/gift-cards/redeem` | Redeem gift card | Auth | - |
| GET | `/gift-cards/liability-report` | Liability report | Auth | admin, super_admin |
| POST | `/loyalty/award` | Award points | Auth | staff, admin, super_admin |
| POST | `/loyalty/redeem` | Redeem points | Auth | - |
| GET | `/loyalty/users/:userId/status` | Get loyalty status | Auth | - |
| POST | `/loyalty/users/:userId/flag-fraud` | Flag fraud | Auth | admin, super_admin |
| POST | `/loyalty/expire-points` | Expire points | Auth | admin, super_admin |

---

## 12. Housekeeping

### Routes: `/api/v1/housekeeping`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/task-types` | Get task types | Auth | - |
| GET | `/my-tasks` | Get my tasks | Auth | staff, admin, super_admin |
| POST | `/tasks/:id/start` | Start task | Auth | staff, admin, super_admin |
| POST | `/tasks/:id/complete` | Complete task | Auth | staff, admin, super_admin |
| POST | `/tasks/:id/issue` | Report issue | Auth | staff, admin, super_admin |
| GET | `/tasks` | Get all tasks | Auth | admin, super_admin |
| GET | `/tasks/:id` | Get task | Auth | admin, super_admin, staff |
| POST | `/tasks` | Create task | Auth | admin, super_admin |
| PUT | `/tasks/:id` | Update task | Auth | admin, super_admin |
| POST | `/tasks/:id/assign` | Assign task | Auth | admin, super_admin |
| GET | `/schedules` | Get schedules | Auth | admin, super_admin |
| POST | `/schedules` | Create schedule | Auth | admin, super_admin |
| PUT | `/schedules/:id` | Update schedule | Auth | admin, super_admin |
| DELETE | `/schedules/:id` | Delete schedule | Auth | admin, super_admin |
| GET | `/staff` | Get available staff | Auth | admin, super_admin |
| GET | `/stats` | Get stats | Auth | admin, super_admin |
| POST | `/generate-scheduled` | Generate scheduled tasks | Auth | admin, super_admin |

---

## 13. Inventory Management

### Routes: `/api/v1/inventory`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/categories` | Get categories | Auth | staff, admin, super_admin |
| POST | `/categories` | Create category | Auth | admin, super_admin |
| PUT | `/categories/:id` | Update category | Auth | admin, super_admin |
| DELETE | `/categories/:id` | Delete category | Auth | admin, super_admin |
| GET | `/items` | Get items | Auth | staff, admin, super_admin |
| GET | `/items/:id` | Get item | Auth | staff, admin, super_admin |
| POST | `/items` | Create item | Auth | admin, super_admin |
| PUT | `/items/:id` | Update item | Auth | admin, super_admin |
| DELETE | `/items/:id` | Delete item | Auth | admin, super_admin |
| POST | `/items/:itemId/link-menu` | Link to menu item | Auth | admin, super_admin |
| GET | `/transactions` | Get transactions | Auth | staff, admin, super_admin |
| POST | `/transactions` | Record transaction | Auth | staff, admin, super_admin |
| POST | `/transactions/bulk` | Bulk transaction | Auth | admin, super_admin |
| GET | `/alerts` | Get alerts | Auth | staff, admin, super_admin |
| POST | `/alerts/:id/resolve` | Resolve alert | Auth | staff, admin, super_admin |
| GET | `/stats` | Get stats | Auth | admin, super_admin |
| GET | `/report` | Generate report | Auth | admin, super_admin |
| POST | `/check-expiring` | Check expiring items | Auth | admin, super_admin |

---

## 14. Reporting & Analytics

### Reports Routes: `/api/v1/reports`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/executive-overview` | Executive overview | Auth | admin, super_admin, manager |
| GET | `/daily-sales` | Daily sales report | Auth | admin, super_admin, manager |
| GET | `/hourly-metrics` | Hourly metrics | Auth | admin, super_admin, manager |
| GET | `/cash-card-variance` | Cash/card variance | Auth | admin, super_admin, manager |
| GET | `/order-flow` | Order flow | Auth | admin, super_admin, manager |
| GET | `/customer-intelligence` | Customer intelligence | Auth | admin, super_admin, manager |
| GET | `/cohort-analysis` | Cohort analysis | Auth | admin, super_admin, manager |
| GET | `/product-performance` | Product performance | Auth | admin, super_admin, manager |
| GET | `/menu-performance` | Menu performance | Auth | admin, super_admin, manager |
| GET | `/payments-finance` | Payments & finance | Auth | admin, super_admin, manager |
| GET | `/stripe-reconciliation` | Stripe reconciliation | Auth | admin, super_admin, manager |
| GET | `/capacity-utilization` | Capacity utilization | Auth | admin, super_admin, manager |
| GET | `/staff-performance` | Staff performance | Auth | admin, super_admin, manager |
| GET | `/comparative-analysis` | Comparative analysis | Auth | admin, super_admin, manager |
| GET | `/time-series` | Time series | Auth | admin, super_admin, manager |
| GET | `/audit` | Audit report | Auth | admin, super_admin, manager |
| GET | `/export` | Export report | Auth | admin, super_admin, manager |
| GET | `/export-comprehensive` | Comprehensive export | Auth | admin, super_admin, manager |
| POST | `/trigger-aggregation` | Trigger aggregation | Auth | admin, super_admin, manager |

### Reporting Routes: `/api/v1/reporting`

#### Report Templates

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/templates` | Get templates | Auth | - |
| GET | `/templates/:id` | Get template | Auth | - |
| POST | `/templates` | Create template | Auth | admin, manager |
| PUT | `/templates/:id` | Update template | Auth | admin, manager |
| DELETE | `/templates/:id` | Delete template | Auth | admin, manager |

#### Report Execution

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/execute/:templateId` | Execute report | Auth |
| POST | `/export/:templateId` | Export report | Auth |

#### Saved Reports

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/saved` | Get saved reports | Auth |
| POST | `/saved` | Save report | Auth |
| PUT | `/saved/:id` | Update saved report | Auth |
| DELETE | `/saved/:id` | Delete saved report | Auth |

#### KPIs

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/kpis` | Get KPIs | Auth | - |
| POST | `/kpis/targets` | Set KPI target | Auth | admin, manager |

#### Financial Reports

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/financial/revenue` | Revenue report | Auth |
| GET | `/financial/occupancy` | Occupancy report | Auth |
| GET | `/financial/channels` | Channel performance | Auth |

#### Operational Reports

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/operational/housekeeping` | Housekeeping report | Auth |
| GET | `/operational/maintenance` | Maintenance report | Auth |

#### Scheduled Reports

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/scheduled` | Get scheduled reports | Auth | - |
| POST | `/scheduled` | Create scheduled report | Auth | admin, manager |
| PUT | `/scheduled/:id` | Update scheduled report | Auth | admin, manager |
| DELETE | `/scheduled/:id` | Delete scheduled report | Auth | admin, manager |
| POST | `/scheduled/:id/run` | Run scheduled report | Auth | admin, manager |

#### Dashboards

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/dashboards` | Get dashboards | Auth | - |
| GET | `/dashboards/:id` | Get dashboard | Auth | - |
| POST | `/dashboards` | Create dashboard | Auth | admin, manager |
| POST | `/dashboards/:dashboardId/widgets` | Add widget | Auth | admin, manager |
| PATCH | `/dashboards/widgets/:widgetId/layout` | Update widget layout | Auth | admin, manager |
| DELETE | `/dashboards/widgets/:widgetId` | Delete widget | Auth | admin, manager |

#### Data Snapshots

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/snapshots` | Create snapshot | Auth | admin |
| POST | `/snapshots/lock-month` | Lock month snapshot | Auth | admin |

---

## 15. Revenue Management

### Routes: `/api/v1/revenue`

#### Demand Forecasting

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/forecasts/generate` | Generate forecasts | Auth | admin, manager |
| GET | `/forecasts` | Get forecasts | Auth | - |

#### Pricing Rules

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/rules` | Get pricing rules | Auth | - |
| POST | `/rules` | Create pricing rule | Auth | admin, manager |
| PUT | `/rules/:id` | Update pricing rule | Auth | admin, manager |
| DELETE | `/rules/:id` | Delete pricing rule | Auth | admin, manager |

#### Dynamic Pricing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/calculate-rate` | Calculate rate | Auth |
| GET | `/calculate-rates-range` | Calculate range rates | Auth |

#### Pricing Calendar

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/calendar` | Get pricing calendar | Auth | - |
| PUT | `/calendar/:roomTypeId/:date` | Update pricing | Auth | admin, manager |
| POST | `/calendar/bulk` | Bulk update pricing | Auth | admin, manager |

#### Rate Recommendations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/recommendations/generate` | Generate recommendations | Auth | admin, manager |
| GET | `/recommendations` | Get recommendations | Auth | - |
| POST | `/recommendations/:id/respond` | Respond to recommendation | Auth | admin, manager |

#### Market Events

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/events` | Get market events | Auth | - |
| POST | `/events` | Create market event | Auth | admin, manager |
| PUT | `/events/:id` | Update market event | Auth | admin, manager |
| DELETE | `/events/:id` | Delete market event | Auth | admin, manager |

#### Competitor Rates

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/competitors` | Record competitor rate | Auth | admin, manager |
| GET | `/competitors` | Get competitor rates | Auth | - |

#### Seasonality Patterns

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/seasonality` | Get seasonality patterns | Auth | - |
| POST | `/seasonality` | Create pattern | Auth | admin, manager |
| PUT | `/seasonality/:id` | Update pattern | Auth | admin, manager |

#### Yield Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/yield-log` | Get yield log | Auth |

#### Revenue Analytics

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/analytics/summary` | Revenue summary | Auth |
| GET | `/analytics/by-room-type` | Revenue by room type | Auth |

---

## 16. Channel Management

### Routes: `/api/v1/channels`

#### Connections

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/properties/:propertyId/connections` | Get connections | Auth | admin, super_admin |
| POST | `/properties/:propertyId/connections` | Create connection | Auth | admin, super_admin |
| GET | `/connections/:connectionId` | Get connection | Auth | admin, super_admin |
| POST | `/connections/:connectionId/activate` | Activate connection | Auth | admin, super_admin |
| POST | `/connections/:connectionId/pause` | Pause connection | Auth | admin, super_admin |
| DELETE | `/connections/:connectionId` | Delete connection | Auth | admin, super_admin |

#### Room Mappings

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/connections/:connectionId/room-mappings` | Get room mappings | Auth | admin, super_admin |
| POST | `/connections/:connectionId/room-mappings` | Create room mapping | Auth | admin, super_admin |
| PUT | `/room-mappings/:mappingId` | Update room mapping | Auth | admin, super_admin |
| DELETE | `/room-mappings/:mappingId` | Delete room mapping | Auth | admin, super_admin |

#### Rate Mappings

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/connections/:connectionId/rate-mappings` | Get rate mappings | Auth | admin, super_admin |
| POST | `/connections/:connectionId/rate-mappings` | Create rate mapping | Auth | admin, super_admin |

#### Sync

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/connections/:connectionId/sync/availability` | Sync availability | Auth | admin, super_admin |
| POST | `/connections/:connectionId/sync/rates` | Sync rates | Auth | admin, super_admin |
| GET | `/connections/:connectionId/sync-log` | Get sync log | Auth | admin, super_admin |
| POST | `/sync/all` | Full sync all | Auth | admin, super_admin |

#### Reservations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/connections/:connectionId/reservations` | Get reservations | Auth | admin, super_admin |

#### Webhooks (No Auth - Signature Verified)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/siteminder/:property_id/:channel` | SiteMinder webhook |
| POST | `/webhooks/ota/:property_id/:channel` | OTA webhook |

---

## 17. Rate Parity

### Routes: `/api/v1/rate-parity`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/properties/:propertyId/config` | Get parity config | Auth | admin, super_admin |
| PUT | `/properties/:propertyId/config` | Update config | Auth | admin, super_admin |
| POST | `/properties/:propertyId/check` | Run parity check | Auth | admin, super_admin |
| POST | `/properties/:propertyId/check/full` | Full parity check | Auth | admin, super_admin |
| GET | `/properties/:propertyId/history` | Get check history | Auth | admin, super_admin |
| GET | `/properties/:propertyId/alerts` | Get alerts | Auth | admin, super_admin |
| POST | `/alerts/:alertId/acknowledge` | Acknowledge alert | Auth | admin, super_admin |
| POST | `/alerts/:alertId/resolve` | Resolve alert | Auth | admin, super_admin |
| POST | `/alerts/:alertId/ignore` | Ignore alert | Auth | admin, super_admin |
| GET | `/properties/:propertyId/dashboard` | Get dashboard | Auth | admin, super_admin |

---

## 18. Multi-Property

### Routes: `/api/v1/multi-property`

#### User Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/my-properties` | Get my properties | Auth |
| POST | `/switch-property` | Switch property | Auth |

#### Property Groups (Admin)

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/groups` | Get property groups | Auth | admin, super_admin |
| POST | `/groups` | Create property group | Auth | super_admin |
| GET | `/groups/:groupId` | Get property group | Auth | admin, super_admin |
| PUT | `/groups/:groupId` | Update property group | Auth | super_admin |
| GET | `/groups/:groupId/summary` | Get group summary | Auth | admin, super_admin |
| POST | `/groups/:groupId/properties` | Add property to group | Auth | super_admin |
| DELETE | `/properties/:propertyId/group` | Remove property | Auth | super_admin |

#### Benchmarking

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/groups/:groupId/benchmarks` | Get benchmarks | Auth | admin, super_admin |
| POST | `/groups/:groupId/benchmarks/calculate` | Calculate benchmarks | Auth | admin, super_admin |

#### Access Management

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/access/property/grant` | Grant property access | Auth | super_admin |
| POST | `/access/property/revoke` | Revoke property access | Auth | super_admin |
| POST | `/access/group/grant` | Grant group access | Auth | super_admin |
| POST | `/access/group/revoke` | Revoke group access | Auth | super_admin |

---

## 19. Group Bookings

### Routes: `/api/v1/groups`

#### Group Reservations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/properties/:propertyId/groups` | Create group reservation | Auth | admin, manager, sales |
| GET | `/properties/:propertyId/groups` | Get group reservations | Auth | admin, manager, sales, front_desk |
| GET | `/groups/:groupId` | Get group by ID | Auth | admin, manager, sales, front_desk |
| PATCH | `/groups/:groupId` | Update group reservation | Auth | admin, manager, sales |
| POST | `/groups/:groupId/cancel` | Cancel group reservation | Auth | admin, manager |

#### Room Blocks

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/groups/:groupId/blocks` | Add room block | Auth | admin, manager, sales |
| POST | `/groups/:groupId/blocks/range` | Add blocks for date range | Auth | admin, manager, sales |
| POST | `/blocks/:blockId/release` | Release room block | Auth | admin, manager, sales |

#### Group Bookings

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/groups/:groupId/bookings` | Add group booking | Auth | admin, manager, sales, front_desk |
| POST | `/groups/:groupId/rooming-list` | Import rooming list | Auth | admin, manager, sales |
| POST | `/group-bookings/:bookingId/cancel` | Cancel group booking | Auth | admin, manager, sales, front_desk |

#### Group Events

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/groups/:groupId/events` | Add group event | Auth | admin, manager, sales |
| PATCH | `/events/:eventId` | Update group event | Auth | admin, manager, sales |

#### Contracts

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/groups/:groupId/contract` | Generate contract | Auth | admin, manager, sales |
| POST | `/contracts/:contractId/sign` | Sign contract | Auth | admin, manager, sales |

#### Invoices & Payments

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/groups/:groupId/invoices` | Create invoice | Auth | admin, manager, sales |
| POST | `/groups/:groupId/payments` | Record payment | Auth | admin, manager, front_desk |

#### Activity Log

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/groups/:groupId/activity` | Get activity log | Auth | admin, manager, sales |

#### Cutoff Management

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/groups/process-cutoffs` | Process cutoffs | Auth | admin, manager |
| GET | `/properties/:propertyId/groups/upcoming-cutoffs` | Get upcoming cutoffs | Auth | admin, manager, sales |

---

## 20. Guest Messaging

### Routes: `/api/v1/messaging`

#### Channel Configuration (Admin)

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/channels/:propertyId` | Configure channel | Auth | admin, manager |
| GET | `/channels/:propertyId/:channelType` | Get channel | Auth | admin, manager |
| POST | `/channels/:channelId/verify` | Verify channel | Auth | admin, manager |

#### Guest Preferences

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| PUT | `/preferences/:guestId/:propertyId` | Update preferences | Auth | admin, manager, front_desk |
| GET | `/preferences/:guestId/:propertyId` | Get preferences | Auth | admin, manager, front_desk |

#### Conversations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/conversations/:propertyId` | Create conversation | Auth | admin, manager, front_desk, concierge |
| GET | `/conversations/:conversationId` | Get conversation | Auth | admin, manager, front_desk, concierge |
| GET | `/conversations/property/:propertyId` | Get property conversations | Auth | admin, manager, front_desk, concierge |
| POST | `/conversations/:conversationId/assign` | Assign conversation | Auth | admin, manager, front_desk |
| PATCH | `/conversations/:conversationId/priority` | Update priority | Auth | admin, manager, front_desk |
| POST | `/conversations/:conversationId/resolve` | Resolve conversation | Auth | admin, manager, front_desk, concierge |
| POST | `/conversations/:conversationId/reopen` | Reopen conversation | Auth | admin, manager, front_desk |
| POST | `/conversations/:conversationId/read` | Mark as read | Auth | admin, manager, front_desk, concierge |

#### Messages

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/conversations/:conversationId/messages` | Send message | Auth | admin, manager, front_desk, concierge |
| GET | `/conversations/:conversationId/messages` | Get messages | Auth | admin, manager, front_desk, concierge |

#### Templates

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/templates/:propertyId` | Create template | Auth | admin, manager |
| GET | `/templates/:templateId` | Get template | Auth | admin, manager, front_desk, concierge |
| GET | `/templates/property/:propertyId` | Get property templates | Auth | admin, manager, front_desk, concierge |
| POST | `/templates/:templateId/render` | Render template | Auth | admin, manager, front_desk, concierge |

#### Canned Responses

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/canned-responses/:propertyId` | Create response | Auth | admin, manager |
| GET | `/canned-responses/:propertyId` | Get responses | Auth | admin, manager, front_desk, concierge |
| POST | `/canned-responses/:responseId/use` | Use response | Auth | admin, manager, front_desk, concierge |

#### Webhooks (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/:channelId` | Provider webhook |

#### Analytics

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/analytics/:propertyId` | Get analytics | Auth | admin, manager |

---

## 21. Mobile Check-in

### Routes: `/api/v1/mobile-checkin`

#### Pre-Arrival Registration

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/registrations/booking/:bookingId` | Create registration | Auth | admin, manager, front_desk |
| GET | `/registrations/token/:token` | Get by access token | Public | - |
| PATCH | `/registrations/:registrationId` | Update registration | Public | - |
| POST | `/registrations/:registrationId/submit` | Submit for review | Public | - |
| POST | `/registrations/:registrationId/approve` | Approve registration | Auth | admin, manager, front_desk |
| POST | `/registrations/:registrationId/reject` | Reject registration | Auth | admin, manager, front_desk |
| GET | `/registrations/pending/:propertyId` | Get pending | Auth | admin, manager, front_desk |

#### Documents

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/registrations/:registrationId/documents` | Upload document | Public | - |
| POST | `/documents/:documentId/verify` | Verify document | Auth | admin, manager, front_desk |
| GET | `/guests/:guestId/documents` | Get guest documents | Auth | admin, manager, front_desk |

#### Signatures

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/registrations/:registrationId/signature` | Capture signature | Public |

#### Terms

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/guests/:guestId/terms/:termsId/accept` | Accept terms | Public |
| GET | `/terms/:propertyId/:termsType` | Get current terms | Public |

#### Mobile Keys

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/keys/booking/:bookingId` | Request mobile key | Optional | - |
| GET | `/keys/:keyId` | Get mobile key | Optional | - |
| GET | `/keys/booking/:bookingId` | Get key by booking | Optional | - |
| DELETE | `/keys/:keyId` | Revoke mobile key | Auth | admin, manager, front_desk |
| POST | `/keys/:keyId/validate` | Validate key access | Public | - |

#### Check-in Sessions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/sessions/booking/:bookingId` | Start check-in session | Optional |
| PATCH | `/sessions/:sessionId` | Update session | Public |
| POST | `/sessions/:sessionId/complete` | Complete check-in | Public |

#### Push Notifications

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/push/register/:guestId/:propertyId` | Register push token | Public | - |
| POST | `/push/reminder/:bookingId` | Send check-in reminder | Auth | admin, manager, front_desk |
| POST | `/push/room-ready/:bookingId` | Send room ready | Auth | admin, manager, front_desk, housekeeping |

---

## 22. Internationalization (i18n)

### Routes: `/api/v1/i18n`

#### Language Configuration

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/languages/:propertyId/:languageCode` | Enable language | Auth | admin, manager |
| DELETE | `/languages/:propertyId/:languageCode` | Disable language | Auth | admin, manager |
| GET | `/languages/:propertyId` | Get property languages | Optional | - |

#### Translation Keys (Admin)

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/keys` | Create translation key | Auth | admin |
| GET | `/keys` | Get translation keys | Auth | admin, manager |

#### Translations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| PUT | `/translations/:keyPath/:languageCode` | Set translation | Auth | admin, manager |
| POST | `/translations/bulk` | Bulk set translations | Auth | admin, manager |
| GET | `/translations/:keyPath/:languageCode` | Get translation | Optional | - |
| POST | `/translations/:translationId/approve` | Approve translation | Auth | admin, manager |
| POST | `/translations/:translationId/reject` | Reject translation | Auth | admin, manager |

#### Bundles (Public)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/bundles/:languageCode` | Get translation bundle | Public |
| POST | `/bundles/:languageCode/regenerate` | Regenerate bundle | Auth |
| GET | `/bundles/:languageCode/:context/checksum` | Get bundle checksum | Public |

#### Content Translations

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| PUT | `/content/:entityType/:entityId/:fieldName/:languageCode` | Translate content | Auth | admin, manager |
| GET | `/content/:entityType/:entityId/:fieldName/:languageCode` | Get content translation | Optional | - |
| GET | `/content/:entityType/:entityId/:languageCode` | Get entity translations | Optional | - |
| POST | `/content/:entityType/:entityId/:languageCode/publish` | Publish translation | Auth | admin, manager |

#### Guest Preferences

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| PUT | `/guests/:guestId/language` | Set guest language | Auth | admin, manager, front_desk |
| GET | `/guests/:guestId/language` | Get guest language | Auth | admin, manager, front_desk |
| GET | `/detect` | Auto-detect language | Public | - |

#### Progress & Reports

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/progress/:propertyId/:languageCode` | Get translation progress | Auth | admin, manager |
| GET | `/missing/:languageCode` | Get missing translations | Auth | admin, manager |

#### Utilities

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/interpolate` | Interpolate string | Public |

---

## 23. GDPR & Privacy

### Routes: `/api/v1/gdpr`

#### User Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/dashboard` | Get privacy dashboard | Auth |
| POST | `/export/request` | Request data export | Auth |
| GET | `/export/status` | Get export status | Auth |
| GET | `/export/download/:requestId` | Download export | Auth |
| POST | `/deletion/request` | Request deletion | Auth |
| GET | `/deletion/status` | Get deletion status | Auth |
| GET | `/consents` | Get consents | Auth |
| PUT | `/consents` | Update consent | Auth |
| PUT | `/consents/bulk` | Bulk update consents | Auth |
| GET | `/processing-log` | Get processing log | Auth |
| GET | `/data-sharing` | Get data sharing log | Auth |

#### Admin Routes

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/admin/retention-policies` | Get retention policies | Auth | admin, super_admin |
| PUT | `/admin/retention-policies/:policyId` | Update policy | Auth | admin, super_admin |
| GET | `/admin/deletion-requests` | List deletion requests | Auth | admin, super_admin |
| POST | `/admin/deletion-requests/:requestId/approve` | Approve deletion | Auth | admin, super_admin |
| POST | `/admin/deletion-requests/:requestId/reject` | Reject deletion | Auth | admin, super_admin |
| POST | `/admin/cleanup/retention` | Trigger retention cleanup | Auth | admin, super_admin |
| POST | `/admin/cleanup/exports` | Cleanup expired exports | Auth | admin, super_admin |

---

## 24. Staff Management

### Routes: `/api/v1/staff`

#### Shifts Management

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/shifts/me` | Get my shifts | Auth | - |
| GET | `/shifts` | Get all shifts | Auth | admin, super_admin, manager |
| GET | `/shifts/staff/:staffId` | Get staff shifts | Auth | admin, super_admin, manager |
| POST | `/shifts` | Create shift | Auth | admin, super_admin, manager |
| PUT | `/shifts/:id` | Update shift | Auth | admin, super_admin, manager |
| DELETE | `/shifts/:id` | Delete shift | Auth | admin, super_admin, manager |
| POST | `/shifts/:id/clock-in` | Clock in | Auth | all staff |
| POST | `/shifts/:id/clock-out` | Clock out | Auth | all staff |

#### Staff Assignments

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/assignments` | Get assignments | Auth | admin, super_admin, manager |
| GET | `/assignments/me` | Get my assignment | Auth | - |
| PUT | `/staff/:staffId/assignments` | Update assignments | Auth | admin, super_admin, manager |
| POST | `/assignments/bulk` | Bulk assign staff | Auth | admin, super_admin, manager |

#### Shift Swap Workflow

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/shifts/swap` | Request shift swap | Auth | all staff |
| GET | `/shifts/swap/me` | Get my swap requests | Auth | - |
| GET | `/shifts/swap` | Get all swap requests | Auth | admin, super_admin, manager |
| PUT | `/shifts/swap/:id/respond` | Respond to swap | Auth | all staff |
| PUT | `/shifts/swap/:id/approve` | Approve swap | Auth | admin, super_admin, manager |
| DELETE | `/shifts/swap/:id` | Cancel swap request | Auth | all staff |

#### Time Tracking

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/time-tracking` | Get time tracking report | Auth | admin, super_admin, manager |
| POST | `/shifts/:shiftId/adjustments` | Add time adjustment | Auth | admin, super_admin, manager |

---

## 25. Manager Approvals

### Routes: `/api/v1/manager`

#### Approvals

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/approvals` | Create approval | Auth | - |
| GET | `/approvals/pending` | Get pending approvals | Auth | admin, super_admin, manager, *_manager |
| GET | `/approvals` | Get all approvals | Auth | admin, super_admin, manager, *_manager |
| GET | `/approvals/stats` | Get approval stats | Auth | admin, super_admin, manager |
| PUT | `/approvals/:id/review` | Review approval | Auth | admin, super_admin, manager, *_manager |

#### Shifts

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/shifts/my` | Get my shifts | Auth | - |
| GET | `/shifts/current` | Get current shift | Auth | - |
| POST | `/shifts/:id/clock-in` | Clock in | Auth | - |
| POST | `/shifts/:id/clock-out` | Clock out | Auth | - |
| GET | `/shifts` | Get all shifts | Auth | admin, super_admin, manager, *_manager |
| GET | `/shifts/today` | Get today's schedule | Auth | admin, super_admin, manager, *_manager |
| POST | `/shifts` | Create shift | Auth | admin, super_admin, manager |
| PUT | `/shifts/:id` | Update shift | Auth | admin, super_admin, manager |
| DELETE | `/shifts/:id` | Delete shift | Auth | admin, super_admin, manager |

---

## 26. Payments

### Routes: `/api/v1/payments`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/webhook/stripe` | Stripe webhook | Public | - |
| POST | `/create-intent` | Create payment intent | Optional | - |
| GET | `/methods` | Get payment methods | Auth | - |
| POST | `/record-cash` | Record cash payment | Auth | staff |
| POST | `/record-manual` | Record manual payment | Auth | staff |
| GET | `/transactions` | Get transactions | Auth | super_admin |
| GET | `/transactions/:id` | Get transaction | Auth | super_admin |
| POST | `/transactions/:id/refund` | Refund payment | Auth | super_admin |

---

## 27. POS Hardware

### Routes: `/api/v1/pos`

#### Stripe Terminal

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/terminal/connection-token` | Create connection token | Auth | admin, super_admin, manager, staff |
| POST | `/terminal/payment-intent` | Create terminal payment intent | Auth | admin, super_admin, manager, staff |
| POST | `/terminal/capture` | Capture terminal payment | Auth | admin, super_admin, manager, staff |
| POST | `/terminal/cancel` | Cancel terminal payment | Auth | admin, super_admin, manager, staff |
| GET | `/terminal/readers` | List readers | Auth | admin, super_admin, manager, staff |
| POST | `/terminal/readers` | Register reader | Auth | admin, super_admin |
| POST | `/terminal/location` | Get or create location | Auth | admin, super_admin |

#### Printer

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/print` | Print to network printer | Auth | admin, super_admin, manager, staff |
| POST | `/open-drawer` | Open cash drawer | Auth | admin, super_admin, manager, staff |
| GET | `/printer/status` | Get printer status | Auth | admin, super_admin, manager, staff |
| POST | `/printer/config` | Save printer config | Auth | admin, super_admin |
| GET | `/printer/config` | Get printer config | Auth | admin, super_admin, manager, staff |

---

## 28. Finance & Cash Management

### Routes: `/api/v1/finance`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | `/open` | Open cash drawer | Auth | - |
| POST | `/close` | Close cash drawer | Auth | - |
| POST | `/transaction` | Record transaction | Auth | - |
| GET | `/` | Get drawers | Auth | admin, super_admin, manager, accountant |

---

## 29. Admin Panel

### Routes: `/api/v1/admin`

#### Dashboard

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/dashboard` | Get dashboard | Auth | manager |
| GET | `/dashboard/revenue` | Get revenue stats | Auth | manager |

#### Modules

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/modules` | Get modules | Auth | - |
| GET | `/modules/:id` | Get module | Auth | - |
| POST | `/modules` | Create module | Auth | super_admin |
| PUT | `/modules/:id` | Update module | Auth | - |
| DELETE | `/modules/:id` | Delete module | Auth | - |

#### Users

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/users` | Get users | Auth | manager |
| POST | `/users` | Create user | Auth | manager |
| GET | `/users/:id` | Get user details | Auth | manager |
| PUT | `/users/:id` | Update user | Auth | manager |
| PUT | `/users/:id/roles` | Update user roles | Auth | super_admin |
| DELETE | `/users/:id` | Delete user | Auth | super_admin |
| PUT | `/users/:id/permissions` | Update permissions | Auth | super_admin |

#### Roles & Permissions

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/roles` | Get roles | Auth | super_admin |
| POST | `/roles` | Create role | Auth | super_admin |
| PUT | `/roles/:id` | Update role | Auth | super_admin |
| DELETE | `/roles/:id` | Delete role | Auth | super_admin |
| GET | `/roles/:id/permissions` | Get role permissions | Auth | super_admin |
| PUT | `/roles/:id/permissions` | Update role permissions | Auth | super_admin |
| GET | `/permissions` | Get all permissions | Auth | super_admin |

#### Settings

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/settings` | Get settings | Auth | super_admin |
| PUT | `/settings` | Update settings | Auth | super_admin |

#### File Uploads

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/uploads` | List files | Auth | manager |
| POST | `/uploads` | Upload file | Auth | manager |
| DELETE | `/uploads/:path(*)` | Delete file | Auth | manager |
| GET | `/branding` | Get branding | Auth | manager |

#### Audit Logs

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/audit-logs` | Get audit logs | Auth | super_admin |
| GET | `/audit-logs/:resource` | Get by resource | Auth | super_admin |
| GET | `/audit-logs/:resource/:resourceId` | Get by resource ID | Auth | super_admin |

#### Backups

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/backups` | Get backups | Auth | super_admin |
| POST | `/backups` | Create backup | Auth | super_admin |
| GET | `/backups/:id/download` | Download backup | Auth | super_admin |
| POST | `/backups/restore` | Restore backup | Auth | super_admin |
| DELETE | `/backups/:id` | Delete backup | Auth | super_admin |

#### Reports

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/reports/overview` | Get overview report | Auth | manager |
| GET | `/reports/occupancy` | Get occupancy report | Auth | manager |
| GET | `/reports/customers` | Get customer analytics | Auth | manager |
| GET | `/reports/export` | Export report | Auth | manager |

#### Scheduled Reports

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/reports/scheduled` | Get scheduled reports | Auth | manager |
| POST | `/reports/scheduled` | Create scheduled report | Auth | manager |
| PUT | `/reports/scheduled/:id` | Update scheduled report | Auth | manager |
| DELETE | `/reports/scheduled/:id` | Delete scheduled report | Auth | manager |
| POST | `/reports/scheduled/:id/send` | Send report now | Auth | manager |
| GET | `/reports/preview` | Preview report | Auth | manager |

#### Notifications

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/notifications` | Get notifications | Auth | manager |
| GET | `/notifications/broadcasts` | Get broadcasts | Auth | manager |
| GET | `/notifications/priorities` | Get priorities | Auth | manager |
| PUT | `/notifications/:id/read` | Mark as read | Auth | manager |
| PUT | `/notifications/read-all` | Mark all as read | Auth | manager |
| POST | `/notifications/broadcast` | Broadcast notification | Auth | manager |
| POST | `/notifications/delete-multiple` | Delete multiple | Auth | manager |
| POST | `/notifications/process-scheduled` | Process scheduled | Auth | manager |
| DELETE | `/notifications/:id` | Delete notification | Auth | manager |

#### Notification Templates

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/notifications/templates` | Get templates | Auth | manager |
| GET | `/notifications/templates/:id` | Get template | Auth | manager |
| POST | `/notifications/templates` | Create template | Auth | manager |
| PUT | `/notifications/templates/:id` | Update template | Auth | manager |
| DELETE | `/notifications/templates/:id` | Delete template | Auth | manager |
| POST | `/notifications/templates/:id/send` | Send from template | Auth | manager |

#### Translation Management

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/translations/status` | Get translation status | Auth | manager |
| GET | `/translations/missing` | Get missing translations | Auth | manager |
| GET | `/translations/stats` | Get translation stats | Auth | manager |
| PUT | `/translations/:table/:id` | Update translation | Auth | manager |
| POST | `/translations/auto-translate` | Auto translate | Auth | manager |
| POST | `/translations/batch-translate` | Batch auto translate | Auth | manager |
| GET | `/translations/languages` | Get supported languages | Auth | super_admin |
| POST | `/translations/languages` | Add language | Auth | super_admin |
| PUT | `/translations/languages/:code` | Update language | Auth | super_admin |
| DELETE | `/translations/languages/:code` | Delete language | Auth | super_admin |
| GET | `/translations/frontend/compare` | Compare frontend translations | Auth | super_admin |
| POST | `/translations/frontend/update` | Update frontend translation | Auth | super_admin |
| GET | `/translations/ui` | Get UI translations | Auth | manager |
| POST | `/translations/ui` | Upsert UI translation | Auth | manager |
| POST | `/translations/ui/publish` | Publish translations | Auth | super_admin |

#### Delete Preview

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/delete-preview/:entityType/:entityId` | Get delete preview | Auth | manager |

#### Soft Delete Management

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/deleted/:entityType` | Get deleted records | Auth | manager |
| POST | `/deleted/:entityType/:entityId/restore` | Restore record | Auth | manager |
| DELETE | `/deleted/:entityType/:entityId/permanent` | Permanent delete | Auth | super_admin |
| POST | `/soft-delete/:entityType/:entityId` | Soft delete | Auth | manager |

---

## 30. Reviews

### Routes: `/api/v1/reviews`

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/` | Get approved reviews | Public | - |
| POST | `/` | Create review | Auth | - |
| GET | `/admin` | Get all reviews | Auth | admin, super_admin |
| PATCH | `/:id/status` | Update review status | Auth | admin, super_admin |
| PUT | `/:id/approve` | Approve review | Auth | admin, super_admin |
| PUT | `/:id/reject` | Reject review | Auth | admin, super_admin |
| DELETE | `/:id` | Delete review | Auth | admin, super_admin |

---

## 31. Support

### Routes: `/api/v1/support`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/contact` | Submit contact form | Public |
| GET | `/faq` | Get FAQs | Public |

---

## 32. QuickBooks Integration

### Routes: `/api/v1/integrations/quickbooks` (CURRENTLY DISABLED)

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/status` | Get connection status | Auth | admin, super_admin, accountant |
| POST | `/connect` | Initiate connection | Auth | admin, super_admin, accountant |
| GET | `/callback` | OAuth callback | Public | - |
| POST | `/:connectionId/disconnect` | Disconnect | Auth | admin, super_admin, accountant |
| GET | `/:connectionId/accounts` | Get accounts | Auth | admin, super_admin, accountant |
| GET | `/:connectionId/mappings` | Get account mappings | Auth | admin, super_admin, accountant |
| POST | `/:connectionId/mappings` | Save account mapping | Auth | admin, super_admin, accountant |
| DELETE | `/:connectionId/mappings/:mappingId` | Delete mapping | Auth | admin, super_admin, accountant |
| POST | `/:connectionId/sync` | Trigger sync | Auth | admin, super_admin, accountant |
| GET | `/:connectionId/sync/history` | Get sync history | Auth | admin, super_admin, accountant |
| GET | `/:connectionId/sync/pending` | Get pending transactions | Auth | admin, super_admin, accountant |
| POST | `/:connectionId/sync/retry/:transactionId` | Retry transaction | Auth | admin, super_admin, accountant |
| PATCH | `/:connectionId/settings` | Update settings | Auth | admin, super_admin, accountant |

---

## 33. White-Label & Terminology

### Terminology Routes: `/api/v1/terminology`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get terminology | Public |
| GET | `/admin` | Get all overrides | Public |
| POST | `/` | Update terminology | Public |
| POST | `/bulk` | Bulk update terminology | Public |

### Translation Routes: `/api/v1/translations`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get all translations | Public |
| GET | `/:namespace` | Get namespace translations | Public |
| POST | `/` | Update translation | Public |

---

## 34. Generic Routes

### Routes: `/api/v1/units` (Alias for Chalets)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get chalets | Public |
| GET | `/:id` | Get chalet | Public |
| POST | `/` | Create chalet | Auth |
| PUT | `/:id` | Update chalet | Auth |
| DELETE | `/:id` | Delete chalet | Auth |

### Routes: `/api/v1/facilities` (Alias for Pool)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/sessions` | Get sessions | Public |
| GET | `/tickets` | Get today's tickets | Auth |
| POST | `/tickets` | Purchase ticket | Public |

### Routes: `/api/v1/dining` (Alias for Restaurant)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/menu` | Get full menu | Public |
| GET | `/orders` | Get staff orders | Auth |
| POST | `/orders` | Create order | Public |

---

## Public/Utility Routes

### Health & Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/api/health` | API health check |
| GET | `/health/ready` | Readiness probe with DB check |
| GET | `/api/settings` | Get public settings |
| GET | `/api/modules` | Get modules |
| GET | `/api/weather` | Get weather data |
| GET | `/api/settings/tax` | Get tax settings |
| PUT | `/api/settings/tax` | Update tax settings (admin) |
| GET | `/api/csrf-token` | Get CSRF token |

### Unsubscribe

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/unsubscribe` | Render unsubscribe page |
| POST | `/unsubscribe` | Handle unsubscribe |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total Modules** | 34 |
| **Total Endpoints** | ~450+ |
| **Public Endpoints** | ~80 |
| **Authenticated Endpoints** | ~370+ |
| **Admin-Only Endpoints** | ~120+ |

### Key Feature Areas:

1. **Self-Service Kiosk** - 25+ endpoints for check-in/out automation
2. **Restaurant/Waitlist** - 40+ endpoints for full dining management
3. **Pool/Spa** - 20+ endpoints including bracelet tracking
4. **Marketing** - 30+ endpoints for campaigns, journeys, segments
5. **Loyalty Program** - 15+ endpoints with tier management
6. **Revenue Management** - 25+ endpoints for dynamic pricing
7. **Channel Management** - 20+ endpoints for OTA integration
8. **Mobile Check-in** - 25+ endpoints for contactless experience
9. **Reporting** - 35+ endpoints for comprehensive analytics
10. **Admin Panel** - 60+ endpoints for full system management
