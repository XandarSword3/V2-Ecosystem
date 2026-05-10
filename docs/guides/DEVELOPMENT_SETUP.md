<!-- Last updated: 2026-05-10 -->

# V2 Resort Development Environment Setup

> **Modules:** 37 | **Engines:** 4 | **Migrations:** 158 | **Node:** 20.x

This guide covers setting up the V2 Resort development environment with the 4-engine transaction framework.

---

## Prerequisites

### Required Software
- **Node.js** 20.x LTS or higher
- **npm** 10.x or higher (comes with Node.js)
- **Git** 2.40+
- **Docker** 24.x+ and Docker Compose 2.x+
- **Supabase CLI** 1.100.0+

### Optional (Recommended)
- **Redis** 7.x (for caching/rate limiting)
- **VS Code** with recommended extensions
- **Mailhog** (for local email testing)

---

## Quick Start

### 1. Clone and Install Dependencies

```powershell
# Clone the repository
git clone <repository-url>
cd v2-resort

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ..\frontend
npm install

# Install shared types
cd ..\shared
npm install

# Return to root
cd ..
```

### 2. Environment Configuration

```powershell
# Backend configuration
cd backend
copy .env.example .env

# Frontend configuration
cd ..\frontend
copy .env.example .env.local
```

### 3. Database Setup

#### Option A: Local Supabase (Recommended for Development)
```powershell
# Start Supabase locally
npx supabase start

# Run migrations (160 active migrations)
npx supabase db reset
```

#### Option B: Remote Supabase
1. Create a project at https://supabase.com
2. Copy the connection details to `.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://...
   ```

### 4. Start Development Servers

```powershell
# Terminal 1: Backend (Port 3005)
cd backend
npm run dev

# Terminal 2: Frontend (Port 3000)
cd frontend
npm run dev

# Terminal 3: (Optional) Redis for caching
docker run -d -p 6379:6379 redis:7-alpine
```

### 5. Verify Installation

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | Next.js 14 App |
| Backend API | http://localhost:3005/api | Express.js API |
| API Documentation | http://localhost:3005/api-docs | Swagger/OpenAPI |
| Supabase Studio | http://localhost:54323 | Database GUI |

---

## Environment Variables Reference

### Backend (.env)

```powershell
# Server
PORT=3005
NODE_ENV=development
API_VERSION=v1

# Database (Supabase PostgreSQL 15)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-key-min-32-chars

# Redis 7 (Optional - for caching/sessions)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Email (Required for auth flows)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@v2resort.local

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLIC_KEY=pk_test_...

# External Services
GOOGLE_TRANSLATE_API_KEY=
OPENWEATHER_API_KEY=

# Security
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_ENABLED=true

# Monitoring
SENTRY_DSN=
LOG_LEVEL=debug
```

### Frontend (.env.local)

```powershell
# API
NEXT_PUBLIC_API_URL=http://localhost:3005/api
NEXT_PUBLIC_WS_URL=ws://localhost:3005

# Supabase (for client-side auth)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=V2 Resort

# Analytics (Optional)
NEXT_PUBLIC_GA_ID=
```

---

## Engine Framework Development

The V2 platform uses 4 unified engines for all transactions. When developing:

| Engine | Reference Type | Development Notes |
|--------|---------------|-------------------|
| `instant_transaction` | POS orders, food service | Test with `/api/v1/payments/intent` |
| `time_exclusive_reservation` | Chalet bookings, rooms | Test state transitions |
| `shared_capacity_access` | Pool sessions, gym | Test capacity limits |
| `ongoing_entitlement` | Memberships, subscriptions | Test recurring billing |

**Engine Files:**
- `backend/src/engines/definitions/` — Engine type definitions
- `backend/src/engines/registry.ts` — Engine factory
- `backend/src/engines/state-machine.ts` — State transitions

---

## Common Tasks

### Running Tests (219 backend, 113 frontend, 90 E2E)

```powershell
# Backend unit tests
cd backend
npm run test:unit

# Backend with coverage
npm run test:coverage

# Frontend tests
cd ..\frontend
npm test

# E2E tests (requires running servers)
cd ..
npx playwright test -c playwright.config.ts
```

### Database Operations (160 Active Migrations)

```powershell
# Create a new migration
npx supabase migration new <migration_name>

# Apply migrations
npx supabase db reset  # Full reset
npx supabase migration up  # Apply pending

# Generate types from database
npx supabase gen types typescript --local > ..\shared\types\database.ts
```

### Code Quality

```powershell
# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

---

## Docker Development

For full containerized development:

```powershell
# Start all services (Postgres 15 + Redis 7)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Reset everything
docker-compose down -v
docker-compose up -d --build
```

### Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:15-alpine | 5432 | Database |
| redis | redis:7-alpine | 6379 | Cache/Sessions |

---

## Troubleshooting

### Port Already in Use
```powershell
# Find process using port (PowerShell)
Get-NetTCPConnection -LocalPort 3005 | Select-Object LocalPort, OwningProcess
# Kill process
Stop-Process -Id <pid> -Force
```

### Database Connection Issues
1. Ensure Supabase is running: `npx supabase status`
2. Check DATABASE_URL in .env
3. Try resetting: `npx supabase db reset`

### Module Not Found Errors
```powershell
# Clear node_modules and reinstall (PowerShell)
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### Redis Connection Issues
- Ensure Redis is running: `docker ps | Select-String redis`
- Set `REDIS_ENABLED=false` to disable caching

### Engine Framework Issues
- Verify engine types: Check `backend/src/engines/types.ts`
- Test engine resolution: Use `/api/v1/payments/intent` with different `referenceType`
- Check state machine: Review `backend/src/engines/state-machine.ts`

---

## IDE Setup (VS Code)

### Recommended Extensions
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features
- Prisma (for database)
- REST Client (for API testing)
- Thunder Client (alternative to REST Client)

### Workspace Settings (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Next Steps

After setup is complete:
1. Run the seed script: `npm run seed`
2. Create test user: http://localhost:3000/register
3. Access admin panel: http://localhost:3000/admin (requires admin role)
4. Review API docs: http://localhost:3005/api-docs
5. Test engine framework: Try creating transactions with different engine types

---

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local full-stack (Postgres 15, Redis 7, backend, frontend) |
| `docker-compose.supabase.yml` | Supabase workflows without Docker Desktop |
| `backend/docker-compose.test.yml` | Isolated Postgres/Redis for integration tests |

---

## Related Documentation

- [Architecture Overview](../architecture/ARCHITECTURE.md) — Engine framework
- [Testing Guide](./TESTING.md) — 7-stage CI pipeline
- [API Reference](../api/API.md) — Engine-based endpoints
- [Subsystem Registry](../meta/subsystem-registry.md) — 37 modules
