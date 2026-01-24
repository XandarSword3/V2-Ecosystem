# API v1 Contract Definition

> **Rule**: Only documented, stable, externally consumable routes belong in OpenAPI v1.
> Anything else stays undocumented and is excluded from contract tests.

## Official v1 Endpoints (Mobile App Contract)

These are the ONLY endpoints that mobile apps should consume:

### Auth (Public + Authenticated)
- `POST /auth/register` - Public registration
- `POST /auth/login` - Public login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - Logout (auth required)
- `GET /auth/me` - Get current user (auth required)
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset with token
- `PUT /auth/change-password` - Change password (auth required)
- `GET /auth/2fa/status` - 2FA status (auth required)
- `POST /auth/2fa/setup` - Setup 2FA (auth required)
- `POST /auth/2fa/verify` - Verify 2FA code
- `POST /auth/2fa/disable` - Disable 2FA (auth required)

### Devices (Push Notifications)
- `GET /devices` - List user devices (auth required)
- `POST /devices/register` - Register device (auth required)
- `DELETE /devices/{deviceId}` - Unregister device (auth required)

### Restaurant (Public + Auth)
- `GET /restaurant/menu` - Public menu
- `POST /restaurant/orders` - Create order (optional auth)
- `GET /restaurant/orders/{id}` - Get order
- `GET /restaurant/orders/{id}/status` - Order status

### Chalets (Public + Auth)
- `GET /chalets` - List chalets (public)
- `GET /chalets/{id}` - Chalet details (public)
- `GET /chalets/{id}/availability` - Check availability (public)
- `POST /chalets/bookings` - Create booking (auth required)

### Pool (Public + Auth)
- `GET /pool/sessions` - List sessions (public)
- `POST /pool/tickets` - Purchase ticket (optional auth)

### Payments
- `POST /payments/create-intent` - Create payment intent (auth required)
- `GET /payments/methods` - List saved payment methods (auth required)

### Loyalty
- `GET /loyalty/me` - Get my loyalty account (auth required)
- `GET /loyalty/me/transactions` - My transactions (auth required)
- `GET /loyalty/tiers` - List tiers (public)
- `POST /loyalty/calculate` - Calculate points (public)

### Promotions (Public)
- `GET /giftcards/validate/{code}` - Validate gift card
- `POST /giftcards/purchase` - Purchase gift card
- `GET /coupons/active` - Active coupons
- `POST /coupons/validate` - Validate coupon
- `POST /coupons/apply` - Apply coupon (auth required)

### Support
- `POST /support/tickets` - Create ticket (optional auth)
- `GET /support/tickets` - My tickets (auth required)

### Reviews
- `GET /reviews` - List reviews (public)
- `POST /reviews` - Create review (auth required)

## Excluded from v1 Contract (Internal/Admin/Staff)

These routes exist but are NOT part of the mobile contract:

- `/admin/*` - All admin routes (web dashboard only)
- `/staff/*` - Staff-specific routes
- `*/admin/*` - Module admin routes (e.g., `/restaurant/admin/*`)
- Internal webhooks (e.g., `/payments/webhook`)
- Debug/health endpoints beyond `/`

## Contract Test Rule

The `openapi-lint.test.ts` tests ONLY the endpoints listed above.
If a route is not in this list, it should NOT be in the OpenAPI spec.
If a route IS in this list and missing from OpenAPI, that's a bug to fix.
