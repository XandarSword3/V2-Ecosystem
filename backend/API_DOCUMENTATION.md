# V2 Resort API Documentation

## Overview

The V2 Resort Management Platform API provides a comprehensive REST API for managing resort operations including hotel reservations, restaurant orders, pool tickets, chalet bookings, and more.

**Base URL:** `https://your-domain.com/api`

**API Documentation:** `/api/docs` (Swagger UI)

## Authentication

### JWT Token Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Obtaining Tokens

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "roles": ["customer"] },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

### OAuth Authentication

#### Google OAuth
```http
GET /api/auth/google
```
Redirects to Google OAuth consent screen.

#### Facebook OAuth
```http
GET /api/auth/facebook
```
Redirects to Facebook OAuth consent screen.

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Auth endpoints | 5 requests | 15 minutes |
| Sensitive ops | 10 requests | 15 minutes |
| Write operations | 30 requests | 15 minutes |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "requestId": "correlation-id"
}
```

### Pagination
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Endpoints

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/api/health` | Detailed health with DB status |
| GET | `/api/metrics` | Performance metrics (admin) |

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/logout` | Logout user | Yes |
| POST | `/api/auth/refresh` | Refresh access token | No |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password with token | No |
| GET | `/api/auth/me` | Get current user | Yes |
| PUT | `/api/auth/change-password` | Change password | Yes |
| GET | `/api/auth/google` | Google OAuth redirect | No |
| GET | `/api/auth/facebook` | Facebook OAuth redirect | No |

### Two-Factor Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/2fa/status` | Get 2FA status | Yes |
| POST | `/api/auth/2fa/setup` | Initialize 2FA setup | Yes |
| POST | `/api/auth/2fa/enable` | Enable 2FA with code | Yes |
| POST | `/api/auth/2fa/disable` | Disable 2FA | Yes |
| POST | `/api/auth/2fa/verify` | Verify 2FA during login | No |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/profile` | Get user profile | Yes |
| PUT | `/api/users/profile` | Update user profile | Yes |
| GET | `/api/users/bookings` | Get user's bookings | Yes |
| GET | `/api/users/orders` | Get user's orders | Yes |

### Restaurant

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/restaurant/menu` | Get full menu | No |
| GET | `/api/restaurant/menu/:category` | Get menu by category | No |
| GET | `/api/restaurant/menu/item/:id` | Get menu item details | No |
| POST | `/api/restaurant/orders` | Create order | Optional |
| GET | `/api/restaurant/orders/:id` | Get order details | Yes |
| GET | `/api/restaurant/orders` | Get user's orders | Yes |
| PATCH | `/api/restaurant/orders/:id/status` | Update order status | Staff |

### Chalets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/chalets` | List all chalets | No |
| GET | `/api/chalets/:id` | Get chalet details | No |
| GET | `/api/chalets/:id/availability` | Check availability | No |
| POST | `/api/chalets/bookings` | Create booking | Yes |
| GET | `/api/chalets/bookings/:id` | Get booking details | Yes |
| PATCH | `/api/chalets/bookings/:id` | Update booking | Yes |
| DELETE | `/api/chalets/bookings/:id` | Cancel booking | Yes |

### Pool

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/pool/sessions` | Get available sessions | No |
| GET | `/api/pool/sessions/:date` | Get sessions for date | No |
| POST | `/api/pool/tickets` | Purchase ticket | Optional |
| GET | `/api/pool/tickets/:id` | Get ticket details | Yes |
| POST | `/api/pool/tickets/:id/check-in` | Check in ticket | Staff |

### Reviews

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/reviews` | Get all reviews | No |
| GET | `/api/reviews/:module` | Get reviews by module | No |
| POST | `/api/reviews` | Create review | Yes |
| PUT | `/api/reviews/:id` | Update review | Yes |
| DELETE | `/api/reviews/:id` | Delete review | Yes |

### Support

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/support/tickets` | Get user's tickets | Yes |
| POST | `/api/support/tickets` | Create ticket | Yes |
| GET | `/api/support/tickets/:id` | Get ticket details | Yes |
| POST | `/api/support/tickets/:id/messages` | Add message | Yes |
| PATCH | `/api/support/tickets/:id/status` | Update status | Staff |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/dashboard` | Dashboard stats | Admin |
| GET | `/api/admin/users` | List all users | Admin |
| GET | `/api/admin/users/:id` | Get user details | Admin |
| PUT | `/api/admin/users/:id` | Update user | Admin |
| DELETE | `/api/admin/users/:id` | Delete user | Admin |
| GET | `/api/admin/settings` | Get system settings | Admin |
| PUT | `/api/admin/settings` | Update settings | Admin |
| GET | `/api/admin/audit` | Get audit log | Admin |
| GET | `/api/admin/modules` | Get module status | Admin |
| PUT | `/api/admin/modules/:id` | Toggle module | Admin |

### Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/payments/create-intent` | Create payment intent | Yes |
| POST | `/api/payments/webhook` | Stripe webhook | No |
| GET | `/api/payments/:id` | Get payment details | Yes |

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `RATE_LIMITED` | Too many requests |
| `CONFLICT` | Resource already exists |
| `INTERNAL_ERROR` | Server error |

## WebSocket Events

Connect to: `wss://your-domain.com`

### Events

| Event | Description | Direction |
|-------|-------------|-----------|
| `order:created` | New order created | Server → Client |
| `order:updated` | Order status changed | Server → Client |
| `ticket:checked-in` | Pool ticket checked in | Server → Client |
| `booking:confirmed` | Booking confirmed | Server → Client |
| `notification` | Push notification | Server → Client |

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=

# Payments (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email (optional)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=

# Monitoring (optional)
SENTRY_DSN=
```

## SDK Examples

### JavaScript/TypeScript
```typescript
const api = axios.create({
  baseURL: 'https://your-domain.com/api',
  headers: { Authorization: `Bearer ${token}` }
});

// Get menu
const { data } = await api.get('/restaurant/menu');

// Create order
const order = await api.post('/restaurant/orders', {
  items: [{ menuItemId: 'uuid', quantity: 2 }],
  notes: 'No onions please'
});
```

### cURL
```bash
# Login
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get menu (no auth required)
curl https://your-domain.com/api/restaurant/menu

# Create order (with auth)
curl -X POST https://your-domain.com/api/restaurant/orders \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"uuid","quantity":2}]}'
```

## Changelog

### v1.0.0
- Initial API release
- Restaurant, Chalets, Pool modules
- JWT authentication with OAuth support
- Two-factor authentication
- Real-time WebSocket notifications
