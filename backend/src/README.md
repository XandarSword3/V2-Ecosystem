# Backend Source Code Architecture

This directory contains the core backend application for the V2 Resort Management Platform.

## Directory Structure

```
src/
├── app.ts              # Express app configuration (middleware, routes, error handling)
├── index.ts            # Application entry point
├── config/             # Environment and app configuration
├── database/           # Database connection, migrations, seeds
├── docs/               # API documentation (Swagger/OpenAPI)
├── lib/                # Shared utilities and helpers
├── middleware/         # Express middleware (auth, validation, rate limiting)
├── modules/            # Business domain modules (restaurant, pool, chalets, etc.)
├── scripts/            # CLI scripts for maintenance and seeding
├── services/           # Cross-cutting services (email, scheduling, webhooks)
├── socket/             # WebSocket (Socket.io) handlers for real-time features
├── types/              # TypeScript type definitions
├── utils/              # Utility functions (logger, formatters, validators)
└── validation/         # Request validation schemas (Zod)
```

## Core Components

### App Configuration (`app.ts`)

The main Express application with:
- **Security**: Helmet, CORS, CSRF protection
- **Rate Limiting**: Per-route and global limits
- **Authentication**: JWT-based with refresh tokens
- **Request Parsing**: JSON, URL-encoded, cookies
- **Error Handling**: Centralized error middleware

### Modules Architecture

Each business module follows a consistent structure:
```
modules/
├── admin/           # Super admin features (users, settings, audit)
├── auth/            # Authentication & authorization
├── chalets/         # Chalet booking management
├── payments/        # Stripe integration & checkout
├── pool/            # Pool session management
├── restaurant/      # Menu, orders, kitchen display
├── reviews/         # Customer feedback system
├── snack/           # Snack bar operations
├── support/         # Customer support tickets
└── users/           # User profile management
```

Each module contains:
- `*.controller.ts` - Request handlers
- `*.routes.ts` - Route definitions
- `*.service.ts` - Business logic (optional)

### Database Layer

- **Connection**: PostgreSQL via Supabase
- **Query Builder**: Raw SQL with parameterized queries
- **Migrations**: Incremental schema changes
- **Seeds**: Development data population

### Real-time Features (`socket/`)

Socket.io integration for:
- Order status updates (kitchen → customer)
- Live user tracking (admin dashboard)
- Notification delivery
- Chat support

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `@supabase/supabase-js` | Database client |
| `socket.io` | WebSocket server |
| `stripe` | Payment processing |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT authentication |
| `zod` | Request validation |
| `helmet` | Security headers |
| `winston` | Structured logging |

## Environment Variables

Required environment variables:

```env
# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email (optional)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=

# Development
NODE_ENV=development
PORT=3001
```

## Running the Backend

```bash
# Development with hot reload
npm run dev

# Production build
npm run build
npm start

# Database seed
npm run seed
```

## Testing

The backend has comprehensive test coverage:

| Category | Tests | Coverage |
|----------|-------|----------|
| Unit Tests | 3,814 | 71.26% statements |
| Integration Tests | 58 | Full scenario coverage |
| Stress Tests | 72 bots | Load testing |

```bash
# Unit tests
npm test

# With coverage report
npm run test:coverage

# Integration tests (requires Docker)
npm run test:integration

# Stress testing with bots
npm run stress-test
```

## API Documentation

Swagger UI available at `/api/docs` when running in development mode.

---

See individual module READMEs for detailed API documentation.
