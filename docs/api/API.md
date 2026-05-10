<!-- Last updated: 2026-05-10 -->

# API Reference

> **Base URL:** `http://localhost:3005` (development) | **Version:** v1 | **Modules:** 37 | **Engines:** 4

This document provides a reference of confirmed API endpoints. All endpoints are verified against the actual route files in `backend/src/routes/` and `backend/src/modules/`.

---

## Base URL & Ports

| Environment | URL | Port |
|-------------|-----|------|
| Development | `http://localhost:3005` | Backend: 3005, Frontend: 3000 |
| Production | `https://api.yourresort.com` | 443 |

---

## Authentication

Most endpoints require authentication via JWT Bearer token:

```
Authorization: Bearer <access_token>
```

Tokens are issued on login and expire after 15 minutes. Use `/auth/refresh` with a refresh token to obtain new access tokens.

---

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

## Auth Module (`/api/auth`)

### POST /auth/register

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "fullName": "John Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "roles": ["customer"]
  }
}
```

### POST /auth/login

Authenticate and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "roles": ["customer"]
    }
  }
}
```

### POST /auth/refresh

Get a new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

### POST /auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password

Reset password with token from email.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123"
}
```

---

## Engine-Based Transaction API (`/api/v1`)

The unified transaction API supports all 4 engine types through a common interface.

### POST /api/v1/payments/intent

Create a payment intent for any transaction type. The engine is determined by the `referenceType`.

**Request:**
```json
{
  "amount": 125.00,
  "currency": "usd",
  "referenceType": "instant_transaction",
  "lineItems": [
    {
      "name": "Menu Item",
      "unitPrice": 25.00,
      "quantity": 2
    }
  ],
  "couponCode": "SUMMER10",
  "giftCardCodes": ["GIFT123"],
  "loyaltyPointsToRedeem": 50
}
```

**Reference Types (Engine Mapping):**
- `instant_transaction` → POS orders, food service
- `time_exclusive_reservation` → Chalet bookings, room reservations
- `shared_capacity_access` → Pool tickets, gym sessions
- `ongoing_entitlement` → Memberships, subscriptions

**Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "transactionId": "uuid",
    "amount": 125.00,
    "discounts": {
      "coupon": 12.50,
      "giftCard": 25.00,
      "loyalty": 5.00
    },
    "finalAmount": 82.50
  }
}
```

### GET /api/v1/transactions/:id

Get transaction details including state, pricing, and history.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "engineType": "instant_transaction",
    "state": "confirmed",
    "amount": 82.50,
    "lineItems": [...],
    "discounts": [...],
    "createdAt": "2026-05-10T14:30:00Z",
    "stateHistory": [
      { "from": "pending", "to": "confirmed", "at": "2026-05-10T14:31:00Z" }
    ]
  }
}
```

### POST /api/v1/transactions/:id/transition

Manually trigger a state transition (staff only).

**Request:**
```json
{
  "action": "prepare",
  "reason": "Kitchen received order"
}
```

---

## Analytics API (`/api/analytics`)

### GET /api/analytics/engines

Get aggregated metrics grouped by engine type. Used by the admin cockpit.

**Response:**
```json
{
  "success": true,
  "data": {
    "instant_transaction": {
      "transactionCount": 150,
      "revenue": 4500.00,
      "averageOrderValue": 30.00
    },
    "time_exclusive_reservation": {
      "transactionCount": 45,
      "revenue": 12500.00,
      "averageBookingValue": 277.78
    },
    "shared_capacity_access": {
      "transactionCount": 200,
      "revenue": 3000.00
    },
    "ongoing_entitlement": {
      "activeSubscriptions": 85,
      "monthlyRecurringRevenue": 4200.00
    }
  }
}
```

### GET /api/analytics/dashboard

Get dashboard statistics.

**Required Role:** `admin`, `manager`, or `super_admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "revenueByEngine": {
      "instant_transaction": 4500.00,
      "time_exclusive_reservation": 12500.00,
      "shared_capacity_access": 3000.00,
      "ongoing_entitlement": 4200.00
    },
    "transactionsByEngine": {
      "instant_transaction": 150,
      "time_exclusive_reservation": 45,
      "shared_capacity_access": 200
    },
    "activeGuests": 23,
    "occupancyRate": 78.5
  }
}
```

---

## Accommodations API (`/api/accommodations`)

### GET /api/accommodations

List all accommodations (chalets, rooms).

**Query Parameters:**
- `capacity_gte` - Minimum capacity
- `amenities` - Comma-separated amenities
- `availableFrom` - Check availability from date
- `availableTo` - Check availability to date

### GET /api/accommodations/:id/availability

Check availability for specific dates.

**Query Parameters:**
- `checkIn` - Start date (YYYY-MM-DD)
- `checkOut` - End date (YYYY-MM-DD)

---

## Bookings API (`/api/bookings`)

### POST /api/bookings

Create a new booking (uses `time_exclusive_reservation` engine).

**Request:**
```json
{
  "accommodationId": "uuid",
  "checkIn": "2026-06-15",
  "checkOut": "2026-06-18",
  "guests": [
    { "name": "John Doe", "type": "adult" }
  ],
  "specialRequests": "Late check-in"
}
```

### GET /api/bookings

List user's bookings.

**Query Parameters:**
- `status` - Filter by status (pending, confirmed, checked_in, checked_out, cancelled)
- `page`, `limit` - Pagination

### PUT /api/bookings/:id

Modify an existing booking.

---

## Inventory/POS API (`/api/pos`, `/api/inventory`)

### GET /api/pos/menu

Get menu items (for modules using `instant_transaction` engine).

**Query Parameters:**
- `moduleId` - Filter by module
- `category` - Filter by category

### POST /api/pos/orders

Create a POS order (uses `instant_transaction` engine).

**Request:**
```json
{
  "moduleId": "uuid",
  "items": [
    {
      "itemId": "uuid",
      "quantity": 2,
      "specialInstructions": "No onions"
    }
  ],
  "deliveryType": "delivery",
  "deliveryAddress": "Room 205"
}
```

---

## Pool API (`/api/pool`)

### GET /api/pool/sessions

Get available pool sessions (uses `shared_capacity_access` engine).

**Query Parameters:**
- `date` - Date to check (YYYY-MM-DD)
- `moduleId` - Filter by module

### POST /api/pool/tickets

Create a pool ticket booking.

**Request:**
```json
{
  "sessionId": "uuid",
  "date": "2026-06-15",
  "adultCount": 2,
  "childCount": 1
}
```

---

## Admin API (`/api/admin`)

### GET /api/admin/dashboard

Get admin dashboard stats.

**Required Role:** `admin` or `super_admin`

### GET /api/admin/users

List all users with pagination.

**Query Parameters:**
- `search` - Search by name/email
- `role` - Filter by role (admin, manager, staff, customer)
- `page`, `limit` - Pagination

### GET /api/admin/settings

Get system settings.

### PUT /api/admin/settings

Update system settings.

---

## Route Files Reference

The following route files are confirmed in `backend/src/routes/` and `backend/src/modules/`:

| Route File | Path | Description |
|------------|------|-------------|
| `v1.routes.ts` | `/api/v1/*` | Unified transaction API (engine-based) |
| `docs.routes.ts` | `/api/docs/*` | API documentation endpoints |
| `dynamic-module.router.ts` | `/api/modules/*` | Dynamic module routing |
| `search.routes.ts` | `/api/search/*` | Global search |
| `terminology.routes.ts` | `/api/terminology/*` | Terminology system |
| `translation.routes.ts` | `/api/translations/*` | i18n endpoints |
| `unsubscribe.routes.ts` | `/unsubscribe/*` | Email unsubscribe |

Module-specific routes are located in `backend/src/modules/[module]/[module].routes.ts`.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired |
| `AUTH_UNAUTHORIZED` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `ENGINE_INVALID_TRANSITION` | 400 | Invalid state transition |
| `IDEMPOTENCY_KEY_REUSE` | 409 | Duplicate idempotency key |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/login` | 5 requests/minute |
| `/auth/register` | 3 requests/minute |
| `/auth/forgot-password` | 3 requests/hour |
| `/api/v1/payments/*` | 30 requests/minute |
| All other endpoints | 100 requests/minute |

---

## Related Documentation

- [Architecture Overview](../architecture/ARCHITECTURE.md) — Engine framework
- [Control Flow](../architecture/control-flow.md) — Request lifecycle
- [Subsystem Registry](../meta/subsystem-registry.md) — Module listing
