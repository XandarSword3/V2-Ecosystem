# V2 Resort Mobile App - Feature Parity Audit

> **Audit Date:** January 20, 2026  
> **Branch:** `fix/mobile-run-stable`  
> **Status:** � Major features implemented, some gaps remain

---

## Executive Summary

The mobile app currently implements **~65%** of the web platform's functionality. Recent updates added profile editing, loyalty dashboard, gift cards, restaurant ordering, and pool booking. Staff workflows remain as the main gap.

---

## Feature Parity Matrix

| Feature | Web Exists | Mobile Exists | Status | Action Required |
|---------|------------|---------------|--------|-----------------|
| **Authentication** | | | | |
| Login (email/password) | ✅ Yes | ✅ Yes | ✅ Complete | - |
| Registration | ✅ Yes | ✅ Yes | ✅ Complete | - |
| Logout | ✅ Yes | ✅ Yes | ✅ Complete | - |
| Logout all devices | ✅ Yes | ✅ Yes | ✅ Complete | - |
| Password reset | ✅ Yes | ❌ No | ❌ Missing | Implement forgot-password flow |
| OAuth (Google/Facebook) | ✅ Yes | ❌ No | ❌ Missing | Add OAuth buttons + deep linking |
| Biometric login | ❌ No | ❌ No | 🚫 N/A | Backend ready, implement on mobile |
| **Profile & Account** | | | | |
| View profile | ✅ Yes | ✅ Yes | ✅ Complete | - |
| Edit profile | ✅ Yes | ✅ Yes | ✅ Complete | `app/profile/edit.tsx` |
| Change password | ✅ Yes | ✅ Yes | ✅ Complete | `app/profile/password.tsx` |
| Payment methods | ✅ Yes | ⚠️ Partial | ⚠️ Incomplete | Stripe native ready, UI partial |
| **Loyalty Program** | | | | |
| View tier & points | ✅ Yes | ✅ Yes | ✅ Complete | `app/loyalty/index.tsx` |
| Points history | ✅ Yes | ✅ Yes | ✅ Complete | History tab in loyalty |
| Tier benefits | ✅ Yes | ✅ Yes | ✅ Complete | Shows benefits in overview |
| Earn multipliers | ✅ Yes | ⚠️ Partial | ⚠️ Incomplete | Display at checkout needed |
| Redeem rewards | ✅ Yes | ✅ Yes | ✅ Complete | Rewards tab in loyalty |
| **Gift Cards** | | | | |
| View balance | ✅ Yes | ✅ Yes | ✅ Complete | `app/gift-cards/index.tsx` |
| Redeem code | ✅ Yes | ✅ Yes | ✅ Complete | Redeem form in gift cards |
| Purchase gift card | ✅ Yes | ✅ Yes | ✅ Complete | Purchase tab |
| Transaction history | ✅ Yes | ✅ Yes | ✅ Complete | History tab |
| **Restaurant Module** | | | | |
| View menu | ✅ Yes | ✅ Yes | ✅ Complete | `app/restaurant/index.tsx` |
| Browse categories | ✅ Yes | ✅ Yes | ✅ Complete | Category chips |
| Add to cart | ✅ Yes | ✅ Yes | ✅ Complete | Inline quantity controls |
| View cart | ✅ Yes | ✅ Yes | ✅ Complete | `app/restaurant/cart.tsx` |
| Apply coupon | ✅ Yes | ✅ Yes | ✅ Complete | Coupon section in cart |
| Place order | ✅ Yes | ✅ Yes | ✅ Complete | Order placement flow |
| Order history | ✅ Yes | ✅ Yes | ✅ Complete | `app/restaurant/orders.tsx` |
| Track order | ✅ Yes | ⚠️ Partial | ⚠️ Incomplete | Status shown, no real-time |
| **Pool Module** | | | | |
| View pool info | ✅ Yes | ✅ Yes | ✅ Complete | `app/pool/index.tsx` |
| View availability | ✅ Yes | ✅ Yes | ✅ Complete | Time slots grid |
| Book slot | ✅ Yes | ✅ Yes | ✅ Complete | Booking flow |
| View bookings | ✅ Yes | ✅ Yes | ✅ Complete | My Bookings tab |
| Cancel booking | ✅ Yes | ✅ Yes | ✅ Complete | Cancel action |
| **Chalet/Services** | | | | |
| View chalets | ✅ Yes | ✅ Yes | ⚠️ Incomplete | Basic display only |
| Book chalet | ✅ Yes | ❌ No | ❌ Missing | Implement booking |
| Request housekeeping | ✅ Yes | ❌ No | ❌ Missing | Implement service requests |
| **Payments** | | | | |
| Credit card | ✅ Yes | ⚠️ Partial | ⚠️ Incomplete | Stripe native ready, needs full UI |
| Apply coupon | ✅ Yes | ✅ Yes | ✅ Complete | In restaurant cart |
| Use loyalty points | ✅ Yes | ❌ No | ❌ Missing | Implement points slider |
| **Staff Features** | | | | |
| Staff login | ✅ Yes | ❌ No | ❌ Missing | Add role-based routing |
| Process orders | ✅ Yes | ❌ No | ❌ Missing | Implement order management |
| Validate pool tickets | ✅ Yes | ❌ No | ❌ Missing | QR scan + validation |
| **Manager Features** | | | | |
| Approve refunds | ✅ Yes | ❌ No | ❌ Missing | Implement approval flow |
| Override discounts | ✅ Yes | ❌ No | ❌ Missing | Implement override |
| **Admin Features** | | | | |
| Full admin panel | ✅ Yes | ❌ No | 🚫 Web-only | Intentionally web-only |
| **Notifications** | | | | |
| Push notifications | ✅ Yes | ⚠️ Mocked | ⚠️ Incomplete | Needs dev build |
| In-app notifications | ✅ Yes | ❌ No | ❌ Missing | Implement notification center |

---

## Role-Based Access Summary

| Role | Web Access | Mobile Access | Status |
|------|------------|---------------|--------|
| Customer | Full | ~80% complete | ✅ Good |
| Staff | Full | None | ❌ Missing |
| Manager | Full | None | ❌ Missing |
| Admin | Full | N/A (web-only) | 🚫 Intentional |

---

## New Screens Added (This Session)

| Screen | Path | Features |
|--------|------|----------|
| Profile Edit | `app/profile/edit.tsx` | Edit firstName, lastName, phone |
| Change Password | `app/profile/password.tsx` | Current + new password form |
| Loyalty Dashboard | `app/loyalty/index.tsx` | Points, tiers, rewards, history |
| Gift Cards | `app/gift-cards/index.tsx` | View, redeem, purchase, history |
| Restaurant Menu | `app/restaurant/index.tsx` | Browse, search, categories, cart |
| Restaurant Cart | `app/restaurant/cart.tsx` | Review, coupon, delivery, checkout |
| Restaurant Orders | `app/restaurant/orders.tsx` | Active/completed orders |
| Pool Booking | `app/pool/index.tsx` | Info, slots, booking, my bookings |

---

## API Endpoints Used

### Currently Implemented
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registration  
- `POST /api/auth/logout` - Logout
- `POST /api/auth/logout-all` - Logout all devices
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/me` - Current user
- `GET /api/users/me/preferences` - Theme preferences

### Required for Parity
- `PUT /api/users/me` - Update profile
- `PUT /api/users/me/password` - Change password
- `GET /api/loyalty/balance` - Loyalty balance
- `GET /api/loyalty/history` - Points history
- `GET /api/giftcards/balance/:code` - Gift card balance
- `GET /api/restaurant/menus/:moduleId` - Menu items
- `POST /api/restaurant/orders` - Place order
- `GET /api/restaurant/orders` - Order history
- `GET /api/pool/tickets` - User's tickets
- `POST /api/pool/tickets` - Book ticket
- `GET /api/chalets/bookings` - User's bookings
- `POST /api/chalets/bookings` - Book chalet
- `POST /api/payments/create-intent` - Payment
- `GET /api/coupons/validate/:code` - Validate coupon

---

## Critical Gaps - Priority Order

### P0 - App Unusable Without
1. **Profile Editing** - Users cannot update their information
2. **Menu Viewing** - Restaurant screen is static placeholder
3. **Order Placement** - No actual ordering functionality
4. **Pool Booking** - No ticket purchasing

### P1 - Core Experience
5. **Loyalty Display** - Full tier/points/history
6. **Gift Card Support** - Balance check and redemption
7. **Payment Flow** - Complete Stripe integration
8. **Order History** - View past transactions

### P2 - Staff Enablement
9. **Staff Role Detection** - Route to staff screens
10. **Order Processing** - Accept/prepare/complete orders
11. **QR Scanning** - Validate tickets/gift cards
12. **Table Management** - View assigned tables

### P3 - Enhanced Experience
13. **Push Notifications** - Requires dev build
14. **Password Reset** - Forgot password flow
15. **OAuth Login** - Google/Facebook buttons
16. **Coupon Application** - At checkout

---

## Screens to Implement

### Customer Screens
- [ ] `/profile/edit` - Profile editing form
- [ ] `/profile/password` - Change password
- [ ] `/loyalty` - Loyalty dashboard (tier, points, history)
- [ ] `/giftcards` - Gift card balance & redemption
- [ ] `/restaurant/menu/:id` - Menu browsing
- [ ] `/restaurant/cart` - Shopping cart
- [ ] `/restaurant/checkout` - Payment flow
- [ ] `/restaurant/orders` - Order history
- [ ] `/restaurant/orders/:id` - Order details
- [ ] `/pool/book` - Pool ticket booking
- [ ] `/pool/tickets` - My tickets with QR
- [ ] `/chalets/book` - Chalet booking
- [ ] `/chalets/bookings` - My bookings
- [ ] `/notifications` - Notification center

### Staff Screens
- [ ] `/staff/dashboard` - Staff home
- [ ] `/staff/orders` - Order queue
- [ ] `/staff/orders/:id` - Order details + actions
- [ ] `/staff/scan` - QR scanner
- [ ] `/staff/tables` - Table assignments
- [ ] `/staff/bookings` - Booking management

### Manager Screens
- [ ] `/manager/approvals` - Pending approvals
- [ ] `/manager/shifts` - Shift management
- [ ] `/manager/overrides` - Discount overrides

---

## Implementation Estimate

| Phase | Scope | Estimated Effort |
|-------|-------|------------------|
| P0 - Core Customer | Profile, Menu, Orders | 3-4 days |
| P1 - Full Customer | Loyalty, Gifts, Payments | 3-4 days |
| P2 - Staff | Order processing, QR scan | 4-5 days |
| P3 - Polish | Notifications, OAuth, Reset | 2-3 days |
| **Total** | | **12-16 days** |

---

## Recommendations

1. **Focus on P0 first** - The app must have core transactional functionality before release
2. **Use existing API** - All required endpoints exist in the backend
3. **Reuse web patterns** - Follow same UX flows as web for consistency
4. **QR scanning** - Use `expo-camera` and `expo-barcode-scanner`
5. **Push notifications** - Requires EAS dev build (not Expo Go)
6. **Staff features** - Essential for operational value of the app

---

## Conclusion

The mobile app has a solid foundation (auth, navigation, UI components) but lacks the transactional features that make it useful. Without menu viewing, ordering, and booking capabilities, the app cannot be released to customers.

**Current Parity: ~35%**  
**Target for MVP: ~80%** (Customer flows complete)  
**Target for Full Parity: ~95%** (Staff + Manager flows)
