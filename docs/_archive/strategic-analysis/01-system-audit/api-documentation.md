# API Documentation
## V2 Hospitality Platform - Complete API Reference

**Base URL:** `http://localhost:3005/api/v1`  
**Authentication:** Bearer Token (JWT)  
**Total Endpoints:** 250+  
**Last Analyzed:** February 2026

---

# API OVERVIEW

## Authentication
All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format
All responses follow a consistent structure:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": { ... }
  }
}
```

---

# 1. AUTHENTICATION API

## Login/Logout

### POST /auth/login
Authenticate user with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "roles": ["customer"]
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": 3600
  }
}
```

### POST /auth/register
Register new customer account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "John Doe",
  "phone": "+1234567890"
}
```

### POST /auth/refresh
Refresh access token using refresh token.

### POST /auth/logout
Invalidate current session.

### POST /auth/forgot-password
Request password reset email.

### POST /auth/reset-password
Reset password with token from email.

### POST /auth/verify-email
Verify email address with token.

## Two-Factor Authentication

### POST /auth/2fa/setup
Initialize 2FA setup, returns QR code.

### POST /auth/2fa/verify
Verify 2FA code and enable 2FA.

### POST /auth/2fa/disable
Disable 2FA with current code.

### POST /auth/2fa/backup-codes
Generate new backup codes.

## Social Authentication

### GET /auth/oauth/google
Redirect to Google OAuth.

### GET /auth/oauth/google/callback
Handle Google OAuth callback.

### GET /auth/oauth/facebook
Redirect to Facebook OAuth.

### GET /auth/oauth/apple
Redirect to Apple Sign In.

## Biometric Authentication

### POST /auth/biometric/register
Register WebAuthn credential.

### POST /auth/biometric/authenticate
Authenticate with WebAuthn.

### DELETE /auth/biometric/:credentialId
Remove registered credential.

---

# 2. USERS API

## User Management

### GET /users
List all users (admin only).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| search | string | Search by name/email |
| role | string | Filter by role |
| status | string | Filter by status (active/inactive) |

### GET /users/:id
Get user details.

### POST /users
Create new user (admin only).

### PUT /users/:id
Update user.

### DELETE /users/:id
Soft delete user.

### GET /users/me
Get current authenticated user.

### PUT /users/me
Update current user profile.

### PUT /users/me/password
Change own password.

### POST /users/me/avatar
Upload profile avatar.

## Role Management

### GET /users/:id/roles
Get user's assigned roles.

### POST /users/:id/roles
Assign role to user.

### DELETE /users/:id/roles/:roleId
Remove role from user.

---

# 3. ROLES & PERMISSIONS API

### GET /roles
List all roles.

### GET /roles/:id
Get role details with permissions.

### POST /roles
Create new role.

### PUT /roles/:id
Update role.

### DELETE /roles/:id
Delete role (non-system only).

### GET /permissions
List all permissions.

### GET /roles/:id/permissions
Get permissions for role.

### PUT /roles/:id/permissions
Update role permissions.

---

# 4. CHALETS (ACCOMMODATION) API

## Chalet Management

### GET /chalets
List all chalets.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| checkIn | date | Available from date |
| checkOut | date | Available to date |
| capacity | number | Minimum capacity |
| priceMin | number | Minimum price |
| priceMax | number | Maximum price |
| amenities | string[] | Required amenities |

### GET /chalets/:id
Get chalet details.

### POST /chalets
Create chalet (admin).

### PUT /chalets/:id
Update chalet (admin).

### DELETE /chalets/:id
Delete chalet (admin).

### GET /chalets/:id/availability
Check availability for date range.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| checkIn | date | Start date |
| checkOut | date | End date |

**Response:**
```json
{
  "available": true,
  "blockedDates": [],
  "pricing": {
    "basePrice": 150.00,
    "seasonalMultiplier": 1.2,
    "adjustedPrice": 180.00,
    "nights": 3,
    "total": 540.00
  }
}
```

### GET /chalets/:id/pricing
Get dynamic pricing for dates.

## Bookings

### GET /bookings
List bookings (filtered by role).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| status | string | Filter by status |
| chaletId | uuid | Filter by chalet |
| userId | uuid | Filter by user (admin) |
| startDate | date | Check-in from |
| endDate | date | Check-in to |

### GET /bookings/:id
Get booking details.

### POST /bookings
Create new booking.

**Request:**
```json
{
  "chaletId": "uuid",
  "checkIn": "2024-06-15",
  "checkOut": "2024-06-18",
  "guests": 4,
  "guestName": "John Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+1234567890",
  "specialRequests": "Late check-in",
  "addons": [
    { "type": "early_checkin", "price": 50 }
  ]
}
```

### PUT /bookings/:id
Update booking.

### PUT /bookings/:id/status
Update booking status.

### POST /bookings/:id/cancel
Cancel booking.

### POST /bookings/:id/check-in
Process check-in.

### POST /bookings/:id/check-out
Process check-out.

### POST /bookings/:id/payment
Process payment for booking.

### GET /bookings/:id/invoice
Generate booking invoice.

---

# 5. POOL API

## Sessions

### GET /pool/sessions
List pool sessions.

### GET /pool/sessions/:id
Get session details.

### POST /pool/sessions
Create session (admin).

### PUT /pool/sessions/:id
Update session (admin).

### DELETE /pool/sessions/:id
Delete session (admin).

### GET /pool/sessions/:id/availability
Check session availability for date.

## Tickets

### GET /pool/tickets
List tickets (filtered by role).

### GET /pool/tickets/:id
Get ticket details.

### POST /pool/tickets
Purchase pool ticket(s).

**Request:**
```json
{
  "sessionId": "uuid",
  "sessionDate": "2024-06-15",
  "adultCount": 2,
  "childCount": 1,
  "seniorCount": 0
}
```

### POST /pool/tickets/:id/validate
Validate ticket at entrance.

### POST /pool/tickets/:id/cancel
Cancel ticket.

### POST /pool/tickets/:id/refund
Process refund.

## Memberships

### GET /pool/memberships
List membership plans.

### GET /pool/memberships/:id
Get membership details.

### POST /pool/memberships
Create membership plan (admin).

### PUT /pool/memberships/:id
Update membership plan (admin).

### GET /pool/memberships/my
Get current user's membership.

### POST /pool/memberships/:id/subscribe
Subscribe to membership.

### POST /pool/memberships/my/cancel
Cancel membership.

---

# 6. RESTAURANT API

## Menu Management

### GET /restaurant/categories
List menu categories.

### GET /restaurant/categories/:id
Get category with items.

### POST /restaurant/categories
Create category (admin).

### PUT /restaurant/categories/:id
Update category (admin).

### DELETE /restaurant/categories/:id
Delete category (admin).

### GET /restaurant/menu
List all menu items.

### GET /restaurant/menu/:id
Get menu item details.

### POST /restaurant/menu
Create menu item (admin).

### PUT /restaurant/menu/:id
Update menu item (admin).

### DELETE /restaurant/menu/:id
Delete menu item (admin).

### PUT /restaurant/menu/:id/availability
Toggle item availability.

## Modifier Groups

### GET /restaurant/modifiers
List modifier groups.

### POST /restaurant/modifiers
Create modifier group.

### PUT /restaurant/modifiers/:id
Update modifier group.

### DELETE /restaurant/modifiers/:id
Delete modifier group.

## Orders

### GET /restaurant/orders
List orders (filtered by role).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| status | string | Filter by status |
| orderType | string | dine_in, takeaway, delivery |
| tableId | uuid | Filter by table |
| serverId | uuid | Filter by server |
| startDate | datetime | Orders from |
| endDate | datetime | Orders to |

### GET /restaurant/orders/:id
Get order details with items.

### POST /restaurant/orders
Create new order.

**Request:**
```json
{
  "orderType": "dine_in",
  "tableId": "uuid",
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 2,
      "modifiers": [
        { "optionId": "uuid" }
      ],
      "specialInstructions": "No onions"
    }
  ],
  "specialInstructions": "Allergy: nuts"
}
```

### PUT /restaurant/orders/:id
Update order.

### PUT /restaurant/orders/:id/status
Update order status.

### POST /restaurant/orders/:id/items
Add items to existing order.

### PUT /restaurant/orders/:id/items/:itemId
Update order item.

### DELETE /restaurant/orders/:id/items/:itemId
Remove/void item from order.

### POST /restaurant/orders/:id/send-to-kitchen
Send order to kitchen.

### POST /restaurant/orders/:id/payment
Process order payment.

### POST /restaurant/orders/:id/split
Split order bill.

### GET /restaurant/orders/:id/receipt
Get/print receipt.

## Tables

### GET /restaurant/tables
List all tables.

### GET /restaurant/tables/:id
Get table details.

### POST /restaurant/tables
Create table (admin).

### PUT /restaurant/tables/:id
Update table (admin).

### DELETE /restaurant/tables/:id
Delete table (admin).

### PUT /restaurant/tables/:id/status
Update table status.

### POST /restaurant/tables/:id/transfer
Transfer table to another server.

### GET /restaurant/tables/layout
Get table layout/floor plan.

### PUT /restaurant/tables/layout
Update table positions.

## Reservations

### GET /restaurant/reservations
List reservations.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| date | date | Filter by date |
| status | string | Filter by status |
| tableId | uuid | Filter by table |

### GET /restaurant/reservations/:id
Get reservation details.

### POST /restaurant/reservations
Create reservation.

**Request:**
```json
{
  "date": "2024-06-15",
  "time": "19:00",
  "partySize": 4,
  "guestName": "John Doe",
  "guestPhone": "+1234567890",
  "guestEmail": "john@example.com",
  "specialRequests": "Anniversary dinner",
  "tableId": "uuid"
}
```

### PUT /restaurant/reservations/:id
Update reservation.

### PUT /restaurant/reservations/:id/status
Update reservation status.

### POST /restaurant/reservations/:id/cancel
Cancel reservation.

### POST /restaurant/reservations/:id/confirm
Confirm reservation.

### POST /restaurant/reservations/:id/seat
Seat reservation party.

## Tabs

### GET /restaurant/tabs
List open tabs.

### GET /restaurant/tabs/:id
Get tab details.

### POST /restaurant/tabs
Open new tab.

### PUT /restaurant/tabs/:id
Update tab.

### POST /restaurant/tabs/:id/close
Close and settle tab.

### POST /restaurant/tabs/:id/transfer
Transfer tab to another table/server.

## Waitlist

### GET /restaurant/waitlist
List waitlist entries.

### POST /restaurant/waitlist
Add to waitlist.

### PUT /restaurant/waitlist/:id/notify
Notify customer table is ready.

### PUT /restaurant/waitlist/:id/seat
Seat waitlist customer.

### DELETE /restaurant/waitlist/:id
Remove from waitlist.

---

# 7. INVENTORY API

## Items

### GET /inventory/items
List inventory items.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| search | string | Search by name/SKU |
| categoryId | uuid | Filter by category |
| lowStock | boolean | Show only low stock |
| supplierId | uuid | Filter by supplier |

### GET /inventory/items/:id
Get item details with stock history.

### POST /inventory/items
Create inventory item.

### PUT /inventory/items/:id
Update inventory item.

### DELETE /inventory/items/:id
Delete inventory item.

### GET /inventory/items/:id/transactions
Get stock transaction history.

### POST /inventory/items/:id/adjust
Manual stock adjustment.

**Request:**
```json
{
  "quantity": -5,
  "reason": "Damaged goods",
  "notes": "Found water damage"
}
```

### GET /inventory/items/low-stock
Get items below reorder point.

### GET /inventory/items/expiring
Get items expiring soon.

## Categories

### GET /inventory/categories
List inventory categories.

### POST /inventory/categories
Create category.

### PUT /inventory/categories/:id
Update category.

### DELETE /inventory/categories/:id
Delete category.

## Suppliers

### GET /inventory/suppliers
List suppliers.

### GET /inventory/suppliers/:id
Get supplier details.

### POST /inventory/suppliers
Create supplier.

### PUT /inventory/suppliers/:id
Update supplier.

### DELETE /inventory/suppliers/:id
Delete supplier.

## Purchase Orders

### GET /inventory/purchase-orders
List purchase orders.

### GET /inventory/purchase-orders/:id
Get PO details with line items.

### POST /inventory/purchase-orders
Create purchase order.

**Request:**
```json
{
  "supplierId": "uuid",
  "expectedDelivery": "2024-06-20",
  "items": [
    {
      "itemId": "uuid",
      "quantity": 50,
      "unitCost": 2.50
    }
  ],
  "notes": "Rush order"
}
```

### PUT /inventory/purchase-orders/:id
Update purchase order.

### POST /inventory/purchase-orders/:id/submit
Submit PO to supplier.

### POST /inventory/purchase-orders/:id/approve
Approve PO (manager).

### POST /inventory/purchase-orders/:id/receive
Receive PO delivery.

**Request:**
```json
{
  "items": [
    {
      "itemId": "uuid",
      "quantityReceived": 48,
      "batchNumber": "BATCH001",
      "expiryDate": "2024-12-31"
    }
  ],
  "notes": "2 units short"
}
```

### POST /inventory/purchase-orders/:id/cancel
Cancel purchase order.

## Recipes

### GET /inventory/recipes
List recipes.

### GET /inventory/recipes/:id
Get recipe with ingredients.

### POST /inventory/recipes
Create recipe.

### PUT /inventory/recipes/:id
Update recipe.

### DELETE /inventory/recipes/:id
Delete recipe.

### POST /inventory/recipes/:id/cost
Calculate recipe cost.

---

# 8. LOYALTY API

## Tiers

### GET /loyalty/tiers
List loyalty tiers.

### POST /loyalty/tiers
Create tier (admin).

### PUT /loyalty/tiers/:id
Update tier (admin).

## Profiles

### GET /loyalty/profile
Get current user's loyalty profile.

### GET /loyalty/profiles
List all profiles (admin).

### GET /loyalty/profiles/:id
Get specific profile.

## Transactions

### GET /loyalty/transactions
Get user's point history.

### POST /loyalty/earn
Award points.

**Request:**
```json
{
  "userId": "uuid",
  "points": 100,
  "description": "Purchase reward",
  "referenceType": "order",
  "referenceId": "uuid"
}
```

### POST /loyalty/redeem
Redeem points.

**Request:**
```json
{
  "points": 500,
  "description": "Discount redemption"
}
```

### GET /loyalty/balance/:userId
Get user's point balance.

---

# 9. PROMOTIONS API

## Coupons

### GET /coupons
List coupons.

### GET /coupons/:id
Get coupon details.

### POST /coupons
Create coupon.

### PUT /coupons/:id
Update coupon.

### DELETE /coupons/:id
Delete coupon.

### POST /coupons/validate
Validate coupon code.

**Request:**
```json
{
  "code": "SUMMER20",
  "orderTotal": 100.00,
  "orderType": "restaurant"
}
```

### POST /coupons/apply
Apply coupon to order.

## Gift Cards

### GET /gift-cards
List gift cards (admin).

### GET /gift-cards/:code
Get gift card by code.

### POST /gift-cards
Purchase/create gift card.

### GET /gift-cards/:code/balance
Check balance.

### POST /gift-cards/:code/redeem
Redeem gift card.

### POST /gift-cards/:code/reload
Add funds to gift card.

---

# 10. PAYMENTS API

### POST /payments/create-intent
Create Stripe payment intent.

**Request:**
```json
{
  "amount": 150.00,
  "currency": "USD",
  "orderType": "restaurant_order",
  "orderId": "uuid",
  "metadata": {}
}
```

### POST /payments/confirm
Confirm payment after client confirmation.

### POST /payments/refund
Process refund.

### GET /payments/history
Get payment history.

### GET /payments/:id
Get payment details.

### POST /payments/cash
Record cash payment.

### GET /payments/methods
Get user's saved payment methods.

### POST /payments/methods
Save new payment method.

### DELETE /payments/methods/:id
Delete saved payment method.

---

# 11. STAFF API

## Shifts

### GET /staff/shifts
List shifts.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| userId | uuid | Filter by employee |
| department | string | Filter by department |
| startDate | date | From date |
| endDate | date | To date |
| status | string | Filter by status |

### GET /staff/shifts/:id
Get shift details.

### POST /staff/shifts
Create shift.

### PUT /staff/shifts/:id
Update shift.

### DELETE /staff/shifts/:id
Delete shift.

### POST /staff/shifts/:id/clock-in
Clock in for shift.

### POST /staff/shifts/:id/clock-out
Clock out from shift.

### GET /staff/shifts/my
Get current user's shifts.

### GET /staff/shifts/today
Get today's scheduled shifts.

## Shift Swaps

### GET /staff/swaps
List swap requests.

### POST /staff/swaps
Request shift swap.

### PUT /staff/swaps/:id/approve
Approve swap request.

### PUT /staff/swaps/:id/reject
Reject swap request.

---

# 12. HOUSEKEEPING API

## Tasks

### GET /housekeeping/tasks
List tasks.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status |
| priority | string | Filter by priority |
| assignedTo | uuid | Filter by staff |
| locationType | string | Filter by location type |
| dueDate | date | Filter by due date |

### GET /housekeeping/tasks/:id
Get task details.

### POST /housekeeping/tasks
Create task.

### PUT /housekeeping/tasks/:id
Update task.

### PUT /housekeeping/tasks/:id/status
Update task status.

### PUT /housekeeping/tasks/:id/assign
Assign task to staff.

### POST /housekeeping/tasks/:id/start
Start working on task.

### POST /housekeeping/tasks/:id/complete
Complete task.

### GET /housekeeping/tasks/my
Get tasks assigned to current user.

### GET /housekeeping/dashboard
Get housekeeping dashboard stats.

---

# 13. REVIEWS API

### GET /reviews
List reviews.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| entityType | string | chalet, restaurant, pool |
| entityId | uuid | Specific entity |
| rating | number | Filter by rating |
| status | string | pending, approved, rejected |

### GET /reviews/:id
Get review details.

### POST /reviews
Create review.

### PUT /reviews/:id
Update review (author only).

### DELETE /reviews/:id
Delete review.

### PUT /reviews/:id/approve
Approve review (admin).

### PUT /reviews/:id/reject
Reject review (admin).

### POST /reviews/:id/respond
Respond to review (admin).

### GET /reviews/stats
Get review statistics by entity.

---

# 14. NOTIFICATIONS API

### GET /notifications
Get user's notifications.

### GET /notifications/unread-count
Get unread count.

### PUT /notifications/:id/read
Mark as read.

### PUT /notifications/read-all
Mark all as read.

### DELETE /notifications/:id
Delete notification.

### POST /notifications/preferences
Update notification preferences.

### GET /notifications/preferences
Get notification preferences.

---

# 15. ANALYTICS API

### GET /analytics/dashboard
Get main dashboard metrics.

### GET /analytics/revenue
Get revenue analytics.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| startDate | date | From date |
| endDate | date | To date |
| groupBy | string | day, week, month |
| module | string | Filter by module |

### GET /analytics/occupancy
Get accommodation occupancy rates.

### GET /analytics/pool
Get pool usage analytics.

### GET /analytics/restaurant
Get restaurant analytics.

### GET /analytics/inventory
Get inventory analytics.

### GET /analytics/customers
Get customer analytics.

### GET /analytics/staff
Get staff performance analytics.

### POST /analytics/export
Export analytics report.

---

# 16. ADMIN API

## System Settings

### GET /admin/settings
Get all system settings.

### GET /admin/settings/:key
Get specific setting.

### PUT /admin/settings/:key
Update setting.

### PUT /admin/settings
Bulk update settings.

## Modules

### GET /admin/modules
List feature modules.

### PUT /admin/modules/:id
Toggle module status.

### PUT /admin/modules/:id/settings
Update module settings.

## Audit Logs

### GET /admin/audit-logs
Get audit log entries.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| userId | uuid | Filter by user |
| action | string | Filter by action |
| entityType | string | Filter by entity type |
| startDate | datetime | From date |
| endDate | datetime | To date |

### GET /admin/audit-logs/:id
Get audit log details.

## Theme/Branding

### GET /admin/theme
Get current theme settings.

### PUT /admin/theme
Update theme/branding.

**Request:**
```json
{
  "primaryColor": "#1a73e8",
  "secondaryColor": "#4285f4",
  "logo": "base64_or_url",
  "favicon": "base64_or_url",
  "fontFamily": "Inter",
  "customCSS": "..."
}
```

### GET /admin/white-label
Get white label configuration.

### PUT /admin/white-label
Update white label settings.

## Reports

### GET /admin/reports/daily
Get daily operations report.

### GET /admin/reports/financial
Get financial summary report.

### POST /admin/reports/generate
Generate custom report.

---

# 17. WEBHOOKS API

### GET /webhooks
List configured webhooks.

### POST /webhooks
Create webhook.

**Request:**
```json
{
  "url": "https://example.com/webhook",
  "events": ["booking.created", "order.completed"],
  "secret": "webhook_secret"
}
```

### PUT /webhooks/:id
Update webhook.

### DELETE /webhooks/:id
Delete webhook.

### POST /webhooks/:id/test
Send test webhook.

---

# API ENDPOINT SUMMARY

| Module | Endpoints | Status |
|--------|-----------|--------|
| Authentication | 18 | ✅ Active |
| Users | 15 | ✅ Active |
| Roles/Permissions | 8 | ✅ Active |
| Chalets | 22 | ✅ Active |
| Pool | 20 | ✅ Active |
| Restaurant | 45 | ✅ Active |
| Inventory | 35 | ✅ Active |
| Loyalty | 12 | ✅ Active |
| Promotions | 18 | ✅ Active |
| Payments | 15 | ✅ Active |
| Staff | 15 | ✅ Active |
| Housekeeping | 14 | ✅ Active |
| Reviews | 12 | ✅ Active |
| Notifications | 8 | ✅ Active |
| Analytics | 12 | ✅ Active |
| Admin | 18 | ✅ Active |
| Webhooks | 5 | ✅ Active |
| **TOTAL** | **~282** | |

---

# ERROR CODES

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_REQUIRED | 401 | Authentication required |
| INVALID_TOKEN | 401 | Token expired or invalid |
| INSUFFICIENT_PERMISSIONS | 403 | User lacks permission |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Request validation failed |
| DUPLICATE_ENTRY | 409 | Resource already exists |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily down |

---

# RATE LIMITING

| Endpoint Type | Rate Limit |
|---------------|------------|
| Authentication | 10 req/min |
| Public APIs | 100 req/min |
| Authenticated APIs | 300 req/min |
| Admin APIs | 500 req/min |
| Webhooks | 1000 req/min |

---

*Last Updated: February 2026*
