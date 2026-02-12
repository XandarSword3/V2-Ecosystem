# V2 Resort Backend

A TypeScript Express.js API server powering the V2 Resort Management System. This backend provides RESTful APIs for hospitality operations including restaurant management, accommodation bookings, pool ticketing, and administrative functions.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Getting Started](#getting-started)
4. [Configuration](#configuration)
5. [Module System](#module-system)
6. [Authentication & Authorization](#authentication--authorization)
7. [Database Layer](#database-layer)
8. [API Routes](#api-routes)
9. [Middleware Stack](#middleware-stack)
10. [Services](#services)
11. [WebSocket Integration](#websocket-integration)
12. [Testing](#testing)
13. [Deployment](#deployment)

---

## Architecture Overview

The backend follows a **modular monolith** architecture where each business domain (restaurant, chalets, pool, etc.) is encapsulated in its own module with clear boundaries.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Express Application                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Middleware Pipeline                          │ │
│  │  Security → Auth → Rate Limit → Validation → Request Logger    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Route Handlers                               │ │
│  │  /api/v1/auth  │  /api/v1/restaurant  │  /api/v1/chalets  │... │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Business Modules                             │ │
│  │  auth │ restaurant │ chalets │ pool │ admin │ payments │ ...   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Shared Services                              │ │
│  │  Email │ Scheduler │ 2FA │ Currency │ Notifications │ ...      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Data Layer                                   │ │
│  │  Supabase Client  │  Drizzle ORM  │  Redis Cache              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Supabase as Primary Database**: Uses Supabase PostgreSQL with Row Level Security (RLS) policies. Falls back to HTTP API when direct connection unavailable.

2. **Module-Based Organization**: Each business domain is self-contained with its own routes, controllers, and services.

3. **JWT-Based Authentication**: Stateless authentication with access/refresh token pattern and optional 2FA.

4. **Real-time Updates**: Socket.io for live kitchen display, order tracking, and notifications.

5. **White-Label Support**: Terminology system and generic routes allow rebranding without code changes.

---

## Directory Structure

```
backend/
├── src/
│   ├── index.ts              # Application entry point
│   ├── app.ts                # Express app configuration
│   ├── constants.ts          # Application constants
│   │
│   ├── config/               # Configuration management
│   │   ├── index.ts          # Main config export
│   │   ├── database.ts       # Database configuration
│   │   ├── env.ts            # Environment validation
│   │   ├── stripe.ts         # Stripe payment config
│   │   ├── swagger.ts        # API documentation config
│   │   └── validation.ts     # Config validation schemas
│   │
│   ├── controllers/          # Standalone controllers
│   │   └── health.controller.ts
│   │
│   ├── database/             # Database layer
│   │   ├── connection.ts     # DB connection management
│   │   ├── supabase.ts       # Supabase client setup
│   │   ├── schema/           # Drizzle ORM schemas
│   │   ├── migrations/       # SQL migrations
│   │   ├── seed.ts           # Data seeding
│   │   └── migrate.ts        # Migration runner
│   │
│   ├── middleware/           # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── csrf.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── moduleGuard.middleware.ts
│   │   ├── security.middleware.ts
│   │   └── ... (16 total)
│   │
│   ├── modules/              # Business domain modules
│   │   ├── admin/            # Admin dashboard
│   │   ├── auth/             # Authentication
│   │   ├── chalets/          # Accommodation bookings
│   │   ├── coupons/          # Discount coupons
│   │   ├── giftcards/        # Gift card management
│   │   ├── housekeeping/     # Housekeeping tasks
│   │   ├── inventory/        # Stock management
│   │   ├── loyalty/          # Loyalty points
│   │   ├── manager/          # Manager dashboard
│   │   ├── multi-property/   # Multi-property support
│   │   ├── payments/         # Stripe integration
│   │   ├── pool/             # Pool ticketing
│   │   ├── reporting/        # Analytics/reports
│   │   ├── restaurant/       # Restaurant/dining
│   │   ├── reviews/          # Customer reviews
│   │   ├── snack/            # Snack bar
│   │   ├── staff/            # Staff management
│   │   ├── support/          # Customer support
│   │   └── users/            # User management
│   │
│   ├── routes/               # API route definitions
│   │   ├── v1.routes.ts      # Versioned API routes
│   │   ├── generic.routes.ts # White-label generic routes
│   │   ├── terminology.routes.ts
│   │   └── translation.routes.ts
│   │
│   ├── services/             # Shared services
│   │   ├── email.service.ts
│   │   ├── scheduler.service.ts
│   │   ├── two-factor.service.ts
│   │   ├── currency.service.ts
│   │   ├── stripe-platform.service.ts
│   │   └── ... (30+ services)
│   │
│   ├── socket/               # WebSocket handlers
│   │   └── index.ts          # Socket.io setup
│   │
│   ├── types/                # TypeScript definitions
│   │   ├── index.ts          # Express type extensions
│   │   └── express.d.ts      # Request augmentation
│   │
│   ├── utils/                # Utility functions
│   │   ├── logger.ts         # Winston logging
│   │   ├── sentry.ts         # Error tracking
│   │   └── ...
│   │
│   └── validation/           # Zod validation schemas
│       └── ...
│
├── tests/
│   ├── unit/                 # Unit tests by module
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
│
├── docs/                     # API documentation
│   ├── API_ENDPOINTS.md
│   ├── DATABASE_ERD.md
│   └── ...
│
├── prisma/                   # Prisma schema (legacy)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── Dockerfile
```

---

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn
- Supabase account (free tier works)
- Redis (optional, for caching)

### Installation

```bash
# Navigate to backend directory
cd v2-resort/backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment variables (see Configuration section)
# Edit .env with your credentials

# Run development server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production build |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Check code style |
| `npm run lint:fix` | Fix linting issues |
| `npm run db:reset` | Reset database to initial state |

---

## Configuration

### Environment Variables

Configuration is managed via environment variables. Required variables are validated at startup.

**Required for Production:**
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Authentication (min 32 characters)
JWT_SECRET=your-super-secure-secret-min-32-chars
JWT_REFRESH_SECRET=another-super-secure-secret-min-32-chars

# Stripe Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxx
EMAIL_FROM=noreply@yourdomain.com
```

**Optional:**
```env
# Server
PORT=3005
NODE_ENV=production
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# JWT Expiration
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Sentry (error tracking)
SENTRY_DSN=https://xxx@sentry.io/xxx

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
```

### Configuration Module

Configuration is centralized in [src/config/index.ts](src/config/index.ts):

```typescript
import { config } from './config/index.js';

// Access configuration
config.port          // Server port (default: 3005)
config.env           // Environment (development/production/test)
config.jwt.secret    // JWT signing secret
config.supabase.url  // Supabase project URL
config.stripe.secretKey  // Stripe API key
```

---

## Module System

Each business module follows a consistent structure:

```
modules/restaurant/
├── README.md                    # Module documentation
├── restaurant.routes.ts         # Route definitions
├── controllers/
│   ├── menu.controller.ts       # Menu CRUD operations
│   ├── order.controller.ts      # Order processing
│   └── table.controller.ts      # Table management
├── services/
│   └── kitchen.service.ts       # Kitchen display logic
└── waitlist/
    ├── waitlist.routes.ts       # Waitlist endpoints
    └── waitlist.controller.ts   # Waitlist logic
```

### Module Registration

Modules are registered in [src/routes/v1.routes.ts](src/routes/v1.routes.ts):

```typescript
// Core routes (always active)
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

// Module-protected routes (require module to be enabled)
router.use('/restaurant', requireModule('restaurant'), restaurantRoutes);
router.use('/chalets', requireModule('chalets'), chaletRoutes);
router.use('/pool', requireModule('pool'), poolRoutes);
```

### Module Guard

The `requireModule` middleware checks if a module is enabled in `site_settings`:

```typescript
// Automatically rejects requests if module is disabled
router.use('/restaurant', requireModule('restaurant'), restaurantRoutes);
// Returns 403 if restaurant module is disabled
```

---

## Authentication & Authorization

### Authentication Flow

```
1. Login Request
   POST /api/v1/auth/login
   { email, password }
        ↓
2. Validate Credentials
   - Check user exists
   - Verify password hash
   - Check account lockout
        ↓
3. Check 2FA
   - If 2FA enabled, return requires_2fa: true
   - Client must call /api/v1/auth/2fa/verify
        ↓
4. Generate Tokens
   - Access token (15 min default)
   - Refresh token (7 days default)
        ↓
5. Return Response
   { accessToken, refreshToken, user }
```

### Token Structure

```typescript
// Access Token Payload
{
  userId: string;
  email: string;
  roles: string[];      // ['customer', 'staff', 'admin', 'super_admin']
  iat: number;
  exp: number;
}
```

### Authorization Middleware

```typescript
import { authenticate, authorize } from './middleware/auth.middleware';

// Require authentication only
router.get('/profile', authenticate, getProfile);

// Require specific roles
router.get('/admin/users', authenticate, authorize('admin', 'super_admin'), getUsers);

// Require specific permission
router.post('/refund', authenticate, requirePermission('payments.refund'), processRefund);
```

### Role Hierarchy

| Role | Description | Inherits From |
|------|-------------|---------------|
| `customer` | Default registered user | - |
| `staff` | General staff member | customer |
| `restaurant_staff` | Restaurant operations | staff |
| `restaurant_admin` | Restaurant management | restaurant_staff |
| `admin` | System administrator | All staff roles |
| `super_admin` | Full system access | All roles |

---

## Database Layer

### Connection Strategy

The backend uses a dual-connection strategy:

1. **Direct PostgreSQL** (preferred): Drizzle ORM with connection pooling
2. **Supabase Client** (fallback): HTTP API when direct connection fails

```typescript
// src/database/connection.ts
export async function initializeDatabase() {
  try {
    // Try direct PostgreSQL connection
    pool = new Pool({ connectionString: config.database.url });
    db = drizzle(pool, { schema });
    return db;
  } catch {
    // Fallback to Supabase HTTP client
    supabase = getSupabaseAdmin();
    return null;
  }
}
```

### Common Database Operations

```typescript
import { getSupabase } from './database/connection.js';

// Query data
const supabase = getSupabase();
const { data, error } = await supabase
  .from('menu_items')
  .select('*')
  .eq('category_id', categoryId)
  .order('sort_order');

// Insert data
const { data, error } = await supabase
  .from('orders')
  .insert({ customer_name, items, total })
  .select()
  .single();

// Update data
const { data, error } = await supabase
  .from('orders')
  .update({ status: 'completed' })
  .eq('id', orderId)
  .select()
  .single();
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts and profiles |
| `roles` | Role definitions |
| `user_roles` | User-role assignments |
| `modules` | Enabled business modules |
| `site_settings` | System configuration |
| `menu_categories` | Restaurant menu categories |
| `menu_items` | Restaurant menu items |
| `restaurant_orders` | Restaurant orders |
| `chalets` | Accommodation units |
| `chalet_bookings` | Accommodation reservations |
| `pool_sessions` | Pool time slots |
| `pool_tickets` | Pool entry tickets |
| `payments` | Payment records |

---

## API Routes

### Route Versioning

All API routes are versioned under `/api/v1/`:

```
GET    /api/v1/                    # API version info
GET    /api/v1/auth/me             # Current user
POST   /api/v1/auth/login          # Login
POST   /api/v1/auth/register       # Register
GET    /api/v1/restaurant/menu     # Full menu
POST   /api/v1/restaurant/orders   # Create order
GET    /api/v1/chalets             # List chalets
POST   /api/v1/chalets/bookings    # Create booking
GET    /api/v1/pool/sessions       # Available sessions
POST   /api/v1/pool/tickets        # Purchase ticket
```

### Health Endpoints

```
GET /health          # Basic liveness check
GET /api/health      # Alias for /health
GET /health/ready    # Readiness probe (checks DB)
```

### Public vs Protected Routes

```typescript
// Public routes (no auth required)
router.get('/menu', menuController.getFullMenu);
router.get('/chalets', chaletController.getChalets);

// Protected routes (require authentication)
router.get('/my-orders', authenticate, orderController.getMyOrders);

// Admin routes (require specific role)
router.get('/admin/users', authenticate, authorize('admin'), getUsers);
```

### API Response Format

All endpoints return consistent JSON responses:

```typescript
// Success response
{
  success: true,
  data: { ... }
}

// Error response
{
  success: false,
  error: "Error message",
  details?: { ... }  // Optional validation errors
}

// Paginated response
{
  success: true,
  data: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8
  }
}
```

---

## Middleware Stack

Middleware is applied in specific order in [src/app.ts](src/app.ts):

### Order of Execution

1. **Sentry Request Handler** - Error tracking initialization
2. **Helmet** - Security headers (CSP, HSTS, etc.)
3. **CORS** - Cross-origin request handling
4. **Compression** - Response compression
5. **Cookie Parser** - Parse cookies for CSRF
6. **Body Parser** - JSON/URL-encoded body parsing
7. **CSRF Protection** - Prevent CSRF attacks
8. **Morgan** - Request logging (dev only)
9. **Route Handlers** - Business logic
10. **Error Handler** - Catch-all error handling

### Key Middleware

**auth.middleware.ts**
```typescript
// Verifies JWT and attaches user to request
authenticate(req, res, next)

// Checks user has required role
authorize('admin', 'staff')(req, res, next)

// Checks user has specific permission
requirePermission('payments.refund')(req, res, next)
```

**rateLimit.middleware.ts**
```typescript
// General API rate limiting
apiLimiter           // 100 requests/minute

// Auth-specific limits
authLimiter          // 5 login attempts/15 minutes

// Per-user limits
userRateLimiter      // Based on user tier
```

**validation.middleware.ts**
```typescript
// Validates request body against Zod schema
validate(schema)(req, res, next)
```

**moduleGuard.middleware.ts**
```typescript
// Checks if business module is enabled
requireModule('restaurant')(req, res, next)
```

---

## Services

Shared services provide cross-cutting functionality:

### Email Service

[src/services/email.service.ts](src/services/email.service.ts)

```typescript
import { emailService } from './services/email.service.js';

// Send transactional email
await emailService.send({
  to: 'customer@example.com',
  subject: 'Order Confirmation',
  template: 'order-confirmation',
  context: { orderNumber: '12345', items: [...] }
});

// Send with attachment
await emailService.send({
  to: 'customer@example.com',
  subject: 'Your Invoice',
  html: '<p>Please find attached...</p>',
  attachments: [{ filename: 'invoice.pdf', content: pdfBuffer }]
});
```

### Scheduler Service

[src/services/scheduler.service.ts](src/services/scheduler.service.ts)

```typescript
import { SchedulerService } from './services/scheduler.service.js';

// Initialize on startup
SchedulerService.init();

// Scheduled tasks:
// - Booking reminders (daily at 9 AM)
// - Report generation (weekly)
// - Session cleanup (hourly)
// - Email bounce processing (every 6 hours)
```

### Two-Factor Authentication

[src/services/two-factor.service.ts](src/services/two-factor.service.ts)

```typescript
import { TwoFactorService } from './services/two-factor.service.js';

// Generate secret and QR code
const { secret, qrCode } = await TwoFactorService.generateSecret(userId);

// Verify TOTP code
const isValid = await TwoFactorService.verifyToken(userId, code);

// Generate backup codes
const backupCodes = await TwoFactorService.generateBackupCodes(userId);
```

### Currency Service

[src/services/currency.service.ts](src/services/currency.service.ts)

```typescript
import { CurrencyService } from './services/currency.service.js';

// Convert between currencies
const amountInEUR = await CurrencyService.convert(100, 'USD', 'EUR');

// Get available currencies
const currencies = await CurrencyService.getAvailable();
```

---

## WebSocket Integration

Real-time features use Socket.io for live updates:

### Server Setup

[src/socket/index.ts](src/socket/index.ts)

```typescript
import { initializeSocketServer } from './socket/index.js';

// Initialize with HTTP server
const server = http.createServer(app);
initializeSocketServer(server);
```

### Events

**Kitchen Display Updates:**
```typescript
// Server emits when order status changes
io.to('kitchen').emit('order:update', {
  orderId: '123',
  status: 'preparing',
  items: [...]
});
```

**Order Tracking:**
```typescript
// Client subscribes to their order
socket.emit('track:order', { orderId: '123' });

// Server sends updates
socket.on('order:status', (data) => {
  // { orderId: '123', status: 'ready' }
});
```

### Authentication

WebSocket connections require JWT authentication:

```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const payload = verifyToken(token);
  socket.data.user = payload;
  next();
});
```

---

## Testing

### Test Structure

```
tests/
├── unit/
│   ├── auth/
│   │   └── auth.controller.test.ts
│   ├── restaurant/
│   │   ├── menu.controller.test.ts
│   │   └── order.controller.test.ts
│   └── ...
├── integration/
│   └── api/
│       └── auth.test.ts
└── e2e/
    └── flows/
        └── order-flow.test.ts
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# With coverage
npm run test:coverage

# Specific file
npm test -- tests/unit/auth/auth.controller.test.ts

# Watch mode
npm test -- --watch
```

### Test Utilities

```typescript
// tests/utils/test-helpers.ts
import { createTestUser, createTestOrder, mockSupabase } from './test-helpers';

// Create authenticated request
const { token, user } = await createTestUser({ role: 'admin' });

// Mock Supabase responses
mockSupabase.from('orders').select.mockResolvedValue({
  data: [{ id: '1', status: 'pending' }],
  error: null
});
```

---

## Deployment

### Docker Deployment

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3005
CMD ["node", "dist/index.js"]
```

### Health Checks

Configure health checks for container orchestration:

```yaml
# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3005/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Environment-Specific Configuration

| Environment | Database | Logging | Rate Limits |
|-------------|----------|---------|-------------|
| Development | Supabase (dev project) | Debug | Relaxed |
| Staging | Supabase (staging) | Info | Production-like |
| Production | Supabase (production) | Warn/Error | Strict |

---

## Further Reading

- [API Documentation](docs/API_ENDPOINTS.md) - Complete API reference
- [Database Schema](docs/DATABASE_ERD.md) - Entity relationship diagram
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - Production deployment
- [Module READMEs](src/modules/) - Individual module documentation
