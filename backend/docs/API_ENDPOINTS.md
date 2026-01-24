# V2 Resort Management System - Complete API Reference

## Base URL
- **Production:** `https://api.v2resort.com/api`
- **Staging:** `https://staging-api.v2resort.com/api`
- **Development:** `http://localhost:3001/api`

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Table of Contents

1. [Authentication](#authentication-endpoints)
2. [Users](#user-endpoints)
3. [Chalets](#chalet-endpoints)
4. [Pool](#pool-endpoints)
5. [Restaurant](#restaurant-endpoints)
6. [Admin](#admin-endpoints)
7. [Payments](#payment-endpoints)
8. [Notifications](#notification-endpoints)

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "customer",
    "createdAt": "2025-01-24T00:00:00Z"
  },
  "message": "Registration successful. Please verify your email."
}
```

**Errors:**
- `400` - Invalid input or email already exists
- `422` - Password doesn't meet requirements

---

### POST /auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "customer"
  }
}
```

**Response (200 - 2FA Required):**
```json
{
  "requires2FA": true,
  "partialToken": "partial_token_here",
  "message": "Please provide 2FA code"
}
```

**Errors:**
- `401` - Invalid credentials
- `423` - Account locked
- `429` - Too many attempts, CAPTCHA required

---

### POST /auth/2fa/authenticate
Complete login with 2FA code.

**Request Body:**
```json
{
  "partialToken": "partial_token_here",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

---

### POST /auth/refresh
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "accessToken": "new_access_token",
  "expiresIn": 3600
}
```

---

### POST /auth/logout
Logout and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

### POST /auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account exists, a reset email has been sent."
}
```

---

### POST /auth/reset-password
Reset password with token.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePassword123!"
}
```

**Response (200):**
```json
{
  "message": "Password reset successful"
}
```

---

### POST /auth/2fa/setup
🔒 **Protected** - Generate 2FA setup data.

**Response (200):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

---

### POST /auth/2fa/verify
🔒 **Protected** - Verify and enable 2FA.

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200):**
```json
{
  "enabled": true,
  "backupCodes": ["code1", "code2", "..."]
}
```

---

## User Endpoints

### GET /users/me
🔒 **Protected** - Get current user profile.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "role": "customer",
  "avatar": "https://...",
  "preferences": {
    "language": "en",
    "currency": "USD",
    "notifications": { ... }
  },
  "createdAt": "2025-01-24T00:00:00Z"
}
```

---

### PUT /users/me
🔒 **Protected** - Update current user profile.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567890",
  "preferences": {
    "language": "en",
    "notifications": {
      "email": true,
      "push": true
    }
  }
}
```

---

### PUT /users/me/password
🔒 **Protected** - Change password.

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

---

## Chalet Endpoints

### GET /chalets
Get all chalets with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| checkIn | string | Check-in date (YYYY-MM-DD) |
| checkOut | string | Check-out date (YYYY-MM-DD) |
| guests | number | Minimum guest capacity |
| minPrice | number | Minimum price per night |
| maxPrice | number | Maximum price per night |
| amenities | string[] | Required amenities |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |

**Response (200):**
```json
{
  "chalets": [
    {
      "id": "uuid",
      "name": "Ocean View Suite",
      "description": "Beautiful oceanfront chalet...",
      "capacity": 6,
      "bedrooms": 3,
      "bathrooms": 2,
      "basePrice": 250.00,
      "weekendPrice": 300.00,
      "amenities": ["wifi", "pool", "kitchen"],
      "images": ["https://..."],
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

### GET /chalets/:id
Get specific chalet details.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Ocean View Suite",
  "description": "Full description...",
  "capacity": 6,
  "bedrooms": 3,
  "bathrooms": 2,
  "basePrice": 250.00,
  "weekendPrice": 300.00,
  "amenities": ["wifi", "pool", "kitchen", "parking"],
  "images": ["https://...", "https://..."],
  "rules": ["No smoking", "No pets"],
  "checkInTime": "15:00",
  "checkOutTime": "11:00",
  "location": {
    "lat": 25.0343,
    "lng": 55.1234
  }
}
```

---

### GET /chalets/:id/availability
Check chalet availability for date range.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| checkIn | string | Yes | Start date (YYYY-MM-DD) |
| checkOut | string | Yes | End date (YYYY-MM-DD) |

**Response (200):**
```json
{
  "available": true,
  "price": {
    "nights": 3,
    "baseTotal": 750.00,
    "seasonalAdjustment": 50.00,
    "weekendSurcharge": 100.00,
    "subtotal": 900.00,
    "taxes": 90.00,
    "total": 990.00
  }
}
```

---

### POST /chalets/:id/book
🔒 **Protected** - Create a chalet booking.

**Request Body:**
```json
{
  "checkIn": "2025-08-01",
  "checkOut": "2025-08-05",
  "guests": 4,
  "guestDetails": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "specialRequests": "Early check-in if possible"
}
```

**Response (201):**
```json
{
  "booking": {
    "id": "uuid",
    "chaletId": "uuid",
    "status": "pending",
    "checkIn": "2025-08-01",
    "checkOut": "2025-08-05",
    "totalPrice": 990.00,
    "createdAt": "2025-01-24T00:00:00Z"
  },
  "paymentIntent": {
    "clientSecret": "pi_xxx_secret_xxx"
  }
}
```

---

### GET /bookings/chalets
🔒 **Protected** - Get user's chalet bookings.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| upcoming | boolean | Only future bookings |
| page | number | Page number |

**Response (200):**
```json
{
  "bookings": [
    {
      "id": "uuid",
      "chalet": {
        "id": "uuid",
        "name": "Ocean View Suite",
        "image": "https://..."
      },
      "checkIn": "2025-08-01",
      "checkOut": "2025-08-05",
      "status": "confirmed",
      "totalPrice": 990.00,
      "paymentStatus": "paid"
    }
  ]
}
```

---

### POST /bookings/chalets/:id/cancel
🔒 **Protected** - Cancel a chalet booking.

**Request Body:**
```json
{
  "reason": "Changed travel plans"
}
```

**Response (200):**
```json
{
  "booking": {
    "id": "uuid",
    "status": "cancelled",
    "cancelledAt": "2025-01-24T12:00:00Z"
  },
  "refund": {
    "amount": 742.50,
    "percentage": 75,
    "policyApplied": "moderate"
  }
}
```

---

### PUT /bookings/chalets/:id/dates
🔒 **Protected** - Modify booking dates.

**Request Body:**
```json
{
  "newCheckIn": "2025-08-03",
  "newCheckOut": "2025-08-07"
}
```

**Response (200):**
```json
{
  "booking": {
    "id": "uuid",
    "checkIn": "2025-08-03",
    "checkOut": "2025-08-07",
    "modifiedAt": "2025-01-24T12:00:00Z"
  },
  "priceDifference": {
    "original": 990.00,
    "new": 1100.00,
    "difference": 110.00,
    "paymentRequired": true
  }
}
```

---

## Pool Endpoints

### GET /pool/slots
Get available pool time slots.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| date | string | Date (YYYY-MM-DD) |

**Response (200):**
```json
{
  "date": "2025-07-15",
  "slots": [
    {
      "id": "morning",
      "name": "Morning",
      "startTime": "09:00",
      "endTime": "13:00",
      "adultPrice": 25.00,
      "childPrice": 15.00,
      "available": 50,
      "maxCapacity": 100
    },
    {
      "id": "afternoon",
      "name": "Afternoon",
      "startTime": "14:00",
      "endTime": "18:00",
      "adultPrice": 30.00,
      "childPrice": 18.00,
      "available": 35,
      "maxCapacity": 100
    }
  ]
}
```

---

### POST /pool/tickets
🔒 **Protected** - Purchase pool ticket.

**Request Body:**
```json
{
  "date": "2025-07-15",
  "slot": "morning",
  "adults": 2,
  "children": 1,
  "guestNames": ["Adult 1", "Adult 2", "Child 1"]
}
```

**Response (201):**
```json
{
  "ticket": {
    "id": "uuid",
    "date": "2025-07-15",
    "slot": "morning",
    "status": "pending",
    "qrCode": "data:image/png;base64,...",
    "totalPrice": 65.00
  },
  "paymentIntent": {
    "clientSecret": "pi_xxx_secret_xxx"
  }
}
```

---

### GET /pool/tickets
🔒 **Protected** - Get user's pool tickets.

**Response (200):**
```json
{
  "tickets": [
    {
      "id": "uuid",
      "date": "2025-07-15",
      "slot": "morning",
      "adults": 2,
      "children": 1,
      "status": "confirmed",
      "qrCode": "data:image/png;base64,...",
      "usedAt": null
    }
  ]
}
```

---

### POST /pool/tickets/:id/cancel
🔒 **Protected** - Cancel pool ticket.

**Response (200):**
```json
{
  "ticket": {
    "id": "uuid",
    "status": "cancelled"
  },
  "refund": {
    "amount": 65.00,
    "percentage": 100
  }
}
```

---

### POST /pool/validate-entry
🔒 **Protected (Staff)** - Validate pool entry QR code.

**Request Body:**
```json
{
  "qrPayload": "encrypted_qr_data"
}
```

**Response (200):**
```json
{
  "valid": true,
  "ticket": {
    "id": "uuid",
    "guestCount": 3,
    "slot": "morning"
  },
  "message": "Entry approved"
}
```

---

### GET /pool/memberships/plans
Get available membership plans.

**Response (200):**
```json
{
  "plans": [
    {
      "id": "individual",
      "name": "Individual",
      "description": "Single person membership",
      "monthlyPrice": 50.00,
      "yearlyPrice": 500.00,
      "features": ["Unlimited access", "Locker included"]
    },
    {
      "id": "family",
      "name": "Family",
      "description": "Up to 4 members",
      "monthlyPrice": 120.00,
      "yearlyPrice": 1200.00,
      "features": ["Unlimited access", "4 members", "Guest passes"]
    }
  ]
}
```

---

### POST /pool/memberships
🔒 **Protected** - Create pool membership.

**Request Body:**
```json
{
  "planId": "family",
  "billingCycle": "yearly",
  "members": [
    { "name": "John Doe", "relationship": "self" },
    { "name": "Jane Doe", "relationship": "spouse" }
  ]
}
```

---

## Restaurant Endpoints

### GET /restaurant/menu
Get restaurant menu.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| available | boolean | Only available items |

**Response (200):**
```json
{
  "categories": [
    {
      "id": "appetizers",
      "name": "Appetizers",
      "items": [
        {
          "id": "uuid",
          "name": "Caesar Salad",
          "description": "Fresh romaine...",
          "price": 12.50,
          "image": "https://...",
          "allergens": ["dairy"],
          "isAvailable": true
        }
      ]
    }
  ]
}
```

---

### POST /restaurant/reservations
🔒 **Protected** - Create table reservation.

**Request Body:**
```json
{
  "date": "2025-08-15",
  "time": "19:00",
  "partySize": 4,
  "guestName": "John Doe",
  "guestPhone": "+1234567890",
  "specialRequests": "Window seat preferred"
}
```

**Response (201):**
```json
{
  "reservation": {
    "id": "uuid",
    "date": "2025-08-15",
    "time": "19:00",
    "partySize": 4,
    "tableNumber": 5,
    "status": "confirmed",
    "confirmationCode": "RES-12345"
  }
}
```

---

### GET /restaurant/reservations
🔒 **Protected** - Get user's reservations.

**Response (200):**
```json
{
  "reservations": [
    {
      "id": "uuid",
      "date": "2025-08-15",
      "time": "19:00",
      "partySize": 4,
      "tableNumber": 5,
      "status": "confirmed"
    }
  ]
}
```

---

### POST /restaurant/orders
🔒 **Protected** - Place restaurant order.

**Request Body:**
```json
{
  "tableId": 5,
  "items": [
    { "menuItemId": "uuid", "quantity": 2, "notes": "No onions" },
    { "menuItemId": "uuid", "quantity": 1 }
  ]
}
```

**Response (201):**
```json
{
  "order": {
    "id": "uuid",
    "orderNumber": "ORD-001",
    "tableId": 5,
    "status": "pending",
    "items": [...],
    "subtotal": 45.00,
    "tax": 4.50,
    "total": 49.50
  }
}
```

---

### GET /restaurant/kitchen/orders
🔒 **Protected (Kitchen Staff)** - Get kitchen orders.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |

**Response (200):**
```json
{
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "ORD-001",
      "tableNumber": 5,
      "status": "cooking",
      "items": [
        {
          "id": "uuid",
          "name": "Caesar Salad",
          "quantity": 2,
          "notes": "No croutons",
          "status": "ready"
        }
      ],
      "createdAt": "2025-01-24T19:30:00Z",
      "waitTime": "15 min"
    }
  ]
}
```

---

### POST /restaurant/kitchen/orders/:id/start
🔒 **Protected (Kitchen Staff)** - Start preparing order.

**Response (200):**
```json
{
  "order": {
    "id": "uuid",
    "status": "cooking",
    "startedAt": "2025-01-24T19:35:00Z"
  }
}
```

---

### POST /restaurant/kitchen/orders/:id/ready
🔒 **Protected (Kitchen Staff)** - Mark order as ready.

**Response (200):**
```json
{
  "order": {
    "id": "uuid",
    "status": "ready",
    "readyAt": "2025-01-24T19:50:00Z"
  }
}
```

---

## Admin Endpoints

### GET /admin/dashboard/stats
🔒 **Protected (Admin)** - Get dashboard statistics.

**Response (200):**
```json
{
  "today": {
    "revenue": 5250.00,
    "bookings": 12,
    "poolTickets": 45,
    "restaurantOrders": 28
  },
  "trends": {
    "revenueChange": 15.5,
    "bookingsChange": 8.2
  },
  "occupancy": {
    "chalets": 75,
    "pool": 60
  }
}
```

---

### GET /admin/settings/branding
🔒 **Protected (Admin)** - Get branding settings.

**Response (200):**
```json
{
  "brandName": "V2 Resort",
  "logo": "https://...",
  "favicon": "https://...",
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#64748b",
    "accent": "#10b981"
  },
  "fonts": {
    "heading": "Inter",
    "body": "Inter"
  },
  "contact": {
    "email": "info@v2resort.com",
    "phone": "+1234567890",
    "address": "123 Resort Way"
  }
}
```

---

### PUT /admin/settings/branding
🔒 **Protected (Admin)** - Update branding settings.

**Request Body:**
```json
{
  "brandName": "V2 Resort",
  "colors": {
    "primary": "#3b82f6"
  }
}
```

---

### GET /admin/settings/pricing/seasonal-rules
🔒 **Protected (Admin)** - Get seasonal pricing rules.

**Response (200):**
```json
{
  "rules": [
    {
      "id": "uuid",
      "name": "Summer Peak",
      "startDate": "2025-06-01",
      "endDate": "2025-08-31",
      "multiplier": 1.5,
      "appliesToWeekends": true,
      "isActive": true
    }
  ]
}
```

---

### POST /admin/settings/pricing/seasonal-rules
🔒 **Protected (Admin)** - Create seasonal pricing rule.

**Request Body:**
```json
{
  "name": "Holiday Season",
  "startDate": "2025-12-20",
  "endDate": "2026-01-05",
  "multiplier": 2.0,
  "appliesToWeekends": true
}
```

---

### GET /admin/users
🔒 **Protected (Admin)** - List all users.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| role | string | Filter by role |
| search | string | Search by name/email |
| page | number | Page number |
| limit | number | Items per page |

**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "customer",
      "status": "active",
      "createdAt": "2025-01-24T00:00:00Z",
      "lastLogin": "2025-01-24T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

### GET /admin/reports/revenue
🔒 **Protected (Admin)** - Get revenue reports.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | string | Start date |
| endDate | string | End date |
| groupBy | string | day, week, month |

**Response (200):**
```json
{
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "totals": {
    "revenue": 125000.00,
    "chaletRevenue": 80000.00,
    "poolRevenue": 25000.00,
    "restaurantRevenue": 20000.00
  },
  "data": [
    {
      "date": "2025-01-01",
      "revenue": 4500.00,
      "bookings": 5
    }
  ]
}
```

---

## Payment Endpoints

### POST /payments/create-intent
🔒 **Protected** - Create payment intent.

**Request Body:**
```json
{
  "amount": 990.00,
  "currency": "usd",
  "metadata": {
    "bookingId": "uuid",
    "type": "chalet"
  }
}
```

**Response (200):**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

---

### POST /payments/webhook
Stripe webhook handler (no auth required, uses signature verification).

---

### GET /payments/history
🔒 **Protected** - Get payment history.

**Response (200):**
```json
{
  "payments": [
    {
      "id": "uuid",
      "amount": 990.00,
      "currency": "usd",
      "status": "succeeded",
      "type": "chalet_booking",
      "description": "Ocean View Suite - Aug 1-5",
      "createdAt": "2025-01-24T00:00:00Z"
    }
  ]
}
```

---

## Notification Endpoints

### GET /notifications
🔒 **Protected** - Get user notifications.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unread | boolean | Only unread |
| type | string | Filter by type |

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "booking_confirmed",
      "title": "Booking Confirmed",
      "message": "Your chalet booking has been confirmed.",
      "read": false,
      "createdAt": "2025-01-24T12:00:00Z"
    }
  ],
  "unreadCount": 3
}
```

---

### PUT /notifications/:id/read
🔒 **Protected** - Mark notification as read.

**Response (204):** No content

---

### PUT /notifications/read-all
🔒 **Protected** - Mark all notifications as read.

**Response (204):** No content

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": { }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| CONFLICT | 409 | Resource conflict (e.g., duplicate) |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

- **Standard endpoints:** 100 requests per minute
- **Authentication endpoints:** 10 requests per minute
- **Admin endpoints:** 200 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706109600
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response includes:**
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Webhooks

### Available Events

| Event | Description |
|-------|-------------|
| `booking.created` | New booking created |
| `booking.confirmed` | Booking payment confirmed |
| `booking.cancelled` | Booking cancelled |
| `payment.succeeded` | Payment successful |
| `payment.failed` | Payment failed |

### Webhook Payload

```json
{
  "event": "booking.confirmed",
  "timestamp": "2025-01-24T12:00:00Z",
  "data": {
    "bookingId": "uuid",
    "type": "chalet",
    "...": "..."
  }
}
```

---

*Last updated: January 2025*
