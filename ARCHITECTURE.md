# Architecture Overview

This document provides a high-level overview of the V2 Resort platform architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           V2 Resort Platform                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │                 │     │                 │     │                 │   │
│  │   Frontend      │────▶│   Backend       │────▶│   Supabase      │   │
│  │   Next.js 14    │     │   Express.js    │     │   PostgreSQL    │   │
│  │                 │     │                 │     │                 │   │
│  └────────┬────────┘     └────────┬────────┘     └─────────────────┘   │
│           │                       │                                     │
│           │ WebSocket             │                                     │
│           └───────────────────────┘                                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Third-Party Services                          │   │
│  ├─────────────────┬─────────────────┬─────────────────────────────┤   │
│  │  Stripe         │  SendGrid       │  Sentry                     │   │
│  │  (Payments)     │  (Email)        │  (Error Tracking)           │   │
│  └─────────────────┴─────────────────┴─────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
v2-resort/
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── modules/      # Feature modules (auth, restaurant, pool, etc.)
│   │   ├── services/     # Shared services (email, 2FA)
│   │   ├── database/     # Database connection & seeding
│   │   ├── middleware/   # Express middleware
│   │   └── socket/       # Socket.io handlers
│   └── tests/            # Backend E2E tests
│
├── frontend/             # Next.js 14 application
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   ├── lib/          # Client libraries (API, socket)
│   │   ├── store/        # Zustand state stores
│   │   ├── types/        # Frontend TypeScript types
│   │   └── i18n/         # Internationalization
│   └── tests/            # Frontend unit tests
│
├── shared/               # Shared TypeScript types
│   └── types/            # API contracts, models
│
└── tools/                # Development & testing tools
    └── stress-test/      # Load testing bots
```

## Feature Modules

| Module | Description | Key Features |
|--------|-------------|--------------|
| **Auth** | Authentication system | JWT, 2FA, OAuth |
| **Restaurant** | Food ordering | Menu, orders, kitchen display |
| **Pool** | Session booking | Time slots, capacity, gender restrictions |
| **Chalets** | Accommodation | Multi-day booking, pricing |
| **Payments** | Stripe integration | Checkout, refunds, webhooks |
| **Admin** | Dashboard | User management, analytics |
| **Module Builder** | Visual builder | Dynamic module creation |

## Data Flow

### 1. API Request Flow

```
Client → Auth Middleware → Route Handler → Service → Database → Response
```

### 2. Real-time Updates Flow

```
Kitchen → Backend → Socket.io → All Connected Clients
```

### 3. Payment Flow

```
Client → Checkout → Stripe → Webhook → Order Confirmed → Email
```

## Tech Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js 4.18
- **Language**: TypeScript 5.3
- **Database**: Supabase PostgreSQL
- **Real-time**: Socket.io 4.8
- **Payments**: Stripe 14.25
- **Email**: SendGrid
- **Security**: bcryptjs, JWT, speakeasy (2FA)

### Frontend
- **Framework**: Next.js 14.2
- **Language**: TypeScript 5.4
- **Styling**: Tailwind CSS 3.4
- **State**: Zustand 4.5
- **Forms**: React Hook Form + Zod
- **i18n**: next-intl 3.26

### Testing
- **Unit**: Vitest
- **E2E**: Playwright
- **Load**: Custom stress test bots

## Security

1. **Authentication**: JWT with refresh tokens
2. **Authorization**: Role-based access control (RBAC)
3. **Encryption**: bcrypt password hashing (cost 12)
4. **2FA**: TOTP-based two-factor authentication
5. **Rate Limiting**: Per-route request limits
6. **Input Validation**: Zod schemas on all inputs

## Deployment

### Development

```bash
# Start all services
docker-compose up -d

# Or individually
cd backend && npm run dev
cd frontend && npm run dev
```

### Production

- **Frontend**: Vercel
- **Backend**: Render / Railway / Docker
- **Database**: Supabase Cloud

## Related Documentation

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [Testing Guide](TESTING.md)
- [User Guide](USER_GUIDE.md)
- [Development Time Estimation](DEVELOPMENT_TIME_ESTIMATION.md)
