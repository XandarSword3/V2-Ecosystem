# Backend Middleware

Express middleware for authentication, validation, rate limiting, and request processing.

## Available Middleware

| Middleware | Purpose |
|------------|---------|
| `authenticate` | JWT token verification |
| `authorize` | Permission-based access control |
| `validateRequest` | Zod schema validation |
| `rateLimiter` | Request rate limiting |
| `csrfProtection` | CSRF token validation |
| `errorHandler` | Centralized error handling |
| `requestLogger` | Request/response logging |

## Authentication (`auth.ts`)

### `authenticate`

Verifies JWT access token and attaches user to request:

```typescript
import { authenticate } from '@/middleware/auth';

router.get('/profile', authenticate, (req, res) => {
  // req.user is available
  res.json(req.user);
});
```

### `authorize(permission: string)`

Checks if authenticated user has required permission:

```typescript
import { authenticate, authorize } from '@/middleware/auth';

router.delete('/users/:id', 
  authenticate, 
  authorize('admin.users.manage'),
  userController.deleteUser
);
```

### `optionalAuth`

Attaches user if token present, but doesn't require it:

```typescript
router.get('/menu', optionalAuth, (req, res) => {
  // req.user may or may not be set
  const isStaff = req.user?.roles?.includes('staff');
});
```

## Validation (`validation.ts`)

Validates request body/query/params against Zod schemas:

```typescript
import { validateRequest } from '@/middleware/validation';
import { createOrderSchema } from '@/validation/orders';

router.post('/orders',
  authenticate,
  validateRequest(createOrderSchema),
  orderController.create
);
```

### Validation Schema Example

```typescript
// validation/orders.ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().min(1).max(10)
    })).min(1),
    notes: z.string().max(500).optional(),
    deliveryType: z.enum(['pickup', 'delivery', 'dine-in'])
  }),
  params: z.object({}),
  query: z.object({})
});
```

## Rate Limiting (`rateLimiter.ts`)

Prevents abuse by limiting request frequency:

```typescript
import { rateLimiter, strictRateLimiter } from '@/middleware/rateLimiter';

// Standard limit: 100 requests per minute
router.get('/menu', rateLimiter, menuController.list);

// Strict limit: 5 requests per minute (for sensitive operations)
router.post('/auth/login', strictRateLimiter, authController.login);
```

### Configuration

```typescript
// Standard limiter
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 100,               // 100 requests
  message: { error: 'Too many requests' }
});

// Strict limiter for auth endpoints
const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true  // Only count failed attempts
});
```

## CSRF Protection (`csrf.ts`)

Protects against cross-site request forgery:

```typescript
import { csrfProtection, csrfToken } from '@/middleware/csrf';

// Get CSRF token
router.get('/csrf-token', csrfToken);

// Validate CSRF token on state-changing requests
router.post('/orders', csrfProtection, orderController.create);
```

## Error Handler (`errorHandler.ts`)

Centralized error handling with consistent response format:

```typescript
// In app.ts
app.use(errorHandler);

// In controllers - just throw errors
throw new ValidationError('Invalid input', details);
throw new NotFoundError('Order not found');
throw new UnauthorizedError('Invalid credentials');
throw new ForbiddenError('Permission denied');
```

### Error Classes

```typescript
import { 
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalError
} from '@/lib/errors';

// All produce consistent JSON responses:
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Order not found",
    "details": null
  }
}
```

## Request Logger (`logger.ts`)

Logs all incoming requests:

```typescript
import { requestLogger } from '@/middleware/logger';

app.use(requestLogger);

// Logs:
// [2026-01-14 10:30:00] GET /api/orders 200 45ms
// [2026-01-14 10:30:01] POST /api/orders 201 120ms
```

## Middleware Order

Apply middleware in this order in `app.ts`:

```typescript
// 1. Security headers
app.use(helmet());

// 2. CORS
app.use(cors(corsOptions));

// 3. Request parsing
app.use(express.json());
app.use(cookieParser());

// 4. Logging
app.use(requestLogger);

// 5. Rate limiting (before routes)
app.use('/api', rateLimiter);

// 6. Routes (with authenticate/authorize per-route)
app.use('/api/auth', authRoutes);
app.use('/api/orders', authenticate, orderRoutes);

// 7. Error handling (last)
app.use(errorHandler);
```

## Creating Custom Middleware

```typescript
// middleware/custom.ts
import { Request, Response, NextFunction } from 'express';

export function myMiddleware(options?: MyOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Do something
      await doSomething(req);
      next();
    } catch (error) {
      next(error); // Pass to error handler
    }
  };
}
```

---

See individual middleware files for detailed implementation and configuration options.
