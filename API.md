# API Reference

This document provides a complete reference of all API endpoints.

## Base URL

```
Development: http://localhost:3001
Production:  https://api.yourresort.com
```

## Authentication

All authenticated endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

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

## Auth Module

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
    "fullName": "John Doe"
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

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
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

## Restaurant Module

### GET /restaurant/menu

Get full menu with categories and items.

**Query Parameters:**
- `moduleId` (optional) - Filter by module

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Appetizers",
        "items": [
          {
            "id": "uuid",
            "name": "Spring Rolls",
            "price": 8.99,
            "description": "Crispy vegetable rolls"
          }
        ]
      }
    ]
  }
}
```

### POST /restaurant/orders

Create a new order.

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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    "items": [...],
    "totalAmount": 25.99
  }
}
```

### GET /restaurant/orders

Get user's orders.

**Query Parameters:**
- `status` (optional) - Filter by status
- `page` (default: 1)
- `limit` (default: 10)

---

## Pool Module

### GET /pool/sessions

Get available pool sessions.

**Query Parameters:**
- `date` - Date to check (YYYY-MM-DD)
- `moduleId` (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Morning Session",
      "startTime": "09:00",
      "endTime": "12:00",
      "adultPrice": 25.00,
      "childPrice": 15.00,
      "availableSpots": 15,
      "gender": "mixed"
    }
  ]
}
```

### POST /pool/bookings

Create a pool booking.

**Request:**
```json
{
  "sessionId": "uuid",
  "date": "2026-01-15",
  "adultCount": 2,
  "childCount": 1,
  "guests": [
    { "name": "John Doe", "type": "adult" },
    { "name": "Jane Doe", "type": "adult" },
    { "name": "Jimmy Doe", "type": "child" }
  ]
}
```

---

## Chalets Module

### GET /chalets

List all chalets.

**Query Parameters:**
- `capacity_gte` - Minimum capacity
- `amenities` - Comma-separated amenities

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Luxury Villa",
      "capacity": 6,
      "pricePerNight": 350.00,
      "amenities": ["pool", "wifi", "bbq"]
    }
  ]
}
```

### GET /chalets/:id/availability

Check chalet availability for dates.

**Query Parameters:**
- `checkIn` - Start date (YYYY-MM-DD)
- `checkOut` - End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "totalPrice": 1050.00,
    "nights": 3,
    "breakdown": [
      { "date": "2026-01-15", "price": 350.00, "isWeekend": false },
      { "date": "2026-01-16", "price": 400.00, "isWeekend": true },
      { "date": "2026-01-17", "price": 300.00, "isWeekend": false }
    ]
  }
}
```

---

## Payments Module

### POST /payments/checkout

Create a Stripe checkout session.

**Request:**
```json
{
  "type": "order",
  "referenceId": "uuid",
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_...",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

---

## Admin Module

### GET /admin/dashboard

Get dashboard statistics.

**Required Role:** `admin` or `super_admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "todayRevenue": 2540.00,
    "weeklyRevenue": 15800.00,
    "ordersToday": 45,
    "bookingsToday": 12,
    "activeUsers": 23,
    "revenueChange": 12.5
  }
}
```

### GET /admin/users

List all users.

**Query Parameters:**
- `search` - Search by name/email
- `role` - Filter by role
- `page`, `limit` - Pagination

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
| `SERVER_ERROR` | 500 | Internal server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/login` | 5 requests/minute |
| `/auth/register` | 3 requests/minute |
| `/auth/forgot-password` | 3 requests/hour |
| All other endpoints | 100 requests/minute |
