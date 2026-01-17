# Backend Modules

Each module encapsulates a complete business domain with its own routes, controllers, and services.

## Module Overview

| Module | Description | Key Features |
|--------|-------------|--------------|
| `admin` | Super admin functions | User management, settings, audit logs, reports |
| `auth` | Authentication | Login, register, password reset, 2FA, OAuth |
| `chalets` | Chalet bookings | Multi-day reservations, availability calendar |
| `payments` | Payment processing | Stripe checkout, webhooks, refunds |
| `pool` | Pool sessions | Time-slot booking, capacity management |
| `restaurant` | Restaurant orders | Menu, cart, kitchen display, order tracking |
| `reviews` | Customer feedback | Ratings, comments, moderation |
| `snack` | Snack bar | Quick service orders |
| `support` | Customer support | Ticket system, live chat |
| `users` | User profiles | Profile management, preferences |

## Module Structure

Each module follows a consistent pattern:

```
module-name/
├── module-name.controller.ts   # Request handlers
├── module-name.routes.ts       # Express route definitions
├── module-name.service.ts      # Business logic (if complex)
└── README.md                   # Module-specific documentation
```

## Authentication & Authorization

All modules use the shared middleware:

```typescript
import { authenticate, authorize } from '@/middleware/auth';

// Require authentication
router.get('/profile', authenticate, controller.getProfile);

// Require specific permission
router.post('/admin/users', 
  authenticate, 
  authorize('admin.users.manage'), 
  controller.createUser
);
```

## API Response Format

All endpoints return consistent JSON:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1 }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [...]
  }
}
```

## Error Handling

Use the centralized error classes:

```typescript
import { NotFoundError, ValidationError, UnauthorizedError } from '@/lib/errors';

// In controller
if (!user) {
  throw new NotFoundError('User not found');
}
```

## Database Queries

Use parameterized queries for security:

```typescript
const result = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

## Real-time Events

Emit socket events for live updates:

```typescript
import { io } from '@/socket';

// After order status change
io.to(`order-${orderId}`).emit('order-status-updated', {
  orderId,
  status: newStatus,
  updatedAt: new Date()
});
```

---

## Module Details

### Admin Module (`/admin`)

Super admin dashboard APIs:
- `GET /admin/dashboard` - Dashboard statistics
- `GET /admin/users` - List all users
- `PUT /admin/users/:id` - Update user
- `GET /admin/audit` - Audit log
- `GET /admin/modules` - System modules
- `POST /admin/modules` - Create module
- `PUT /admin/settings` - Update settings

### Auth Module (`/auth`)

Authentication endpoints:
- `POST /auth/login` - Email/password login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Invalidate session
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset
- `POST /auth/verify-email` - Email verification
- `POST /auth/2fa/setup` - Enable 2FA
- `POST /auth/2fa/verify` - Verify 2FA code

### Restaurant Module (`/restaurant`)

Menu and order management:
- `GET /restaurant/menu` - Get menu items
- `GET /restaurant/menu/:moduleId` - Module-specific menu
- `POST /restaurant/orders` - Create order
- `GET /restaurant/orders/:id` - Get order
- `PUT /restaurant/orders/:id/status` - Update status
- `GET /restaurant/kitchen` - Kitchen display orders

### Pool Module (`/pool`)

Session booking:
- `GET /pool/sessions` - Available sessions
- `POST /pool/bookings` - Book session
- `GET /pool/bookings/:id` - Booking details
- `PUT /pool/bookings/:id/cancel` - Cancel booking

### Chalets Module (`/chalets`)

Accommodation booking:
- `GET /chalets` - List chalets
- `GET /chalets/:id/availability` - Check dates
- `POST /chalets/bookings` - Create booking
- `GET /chalets/bookings` - User's bookings

### Payments Module (`/payments`)

Stripe integration:
- `POST /payments/checkout` - Create checkout session
- `POST /payments/webhook` - Stripe webhook handler
- `GET /payments/history` - Payment history
- `POST /payments/refund` - Process refund

---

See individual module README files for complete API documentation.
