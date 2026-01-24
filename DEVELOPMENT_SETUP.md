# V2 Resort Development Environment Setup

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

```bash
# Clone the repository
git clone <repository-url>
cd v2-resort

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install shared types
cd ../shared
npm install

# Return to root
cd ..
```

### 2. Environment Configuration

```bash
# Backend configuration
cd backend
cp .env.example .env

# Frontend configuration
cd ../frontend
cp .env.example .env.local
```

### 3. Database Setup

#### Option A: Local Supabase (Recommended for Development)
```bash
# Start Supabase locally
npx supabase start

# Run migrations
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

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: (Optional) Redis for caching
docker run -d -p 6379:6379 redis:7-alpine
```

### 5. Verify Installation

- Frontend: http://localhost:3000
- Backend API: http://localhost:3005/api
- API Documentation: http://localhost:3005/api-docs
- Supabase Studio: http://localhost:54323

---

## Environment Variables Reference

### Backend (.env)

```bash
# Server
PORT=3005
NODE_ENV=development
API_VERSION=v1

# Database (Supabase)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12

# Redis (Optional - for caching)
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

```bash
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

## Common Tasks

### Running Tests

```bash
# Backend unit tests
cd backend
npm test

# Backend with coverage
npm run test:coverage

# Frontend tests
cd frontend
npm test

# E2E tests (requires running servers)
cd ../
npx playwright test
```

### Database Operations

```bash
# Create a new migration
npx supabase migration new <migration_name>

# Apply migrations
npx supabase db reset  # Full reset
npx supabase migration up  # Apply pending

# Generate types from database
npx supabase gen types typescript --local > ../shared/types/database.ts
```

### Code Quality

```bash
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

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Reset everything
docker-compose down -v
docker-compose up -d --build
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3005
# Kill process
taskkill /PID <pid> /F
```

### Database Connection Issues
1. Ensure Supabase is running: `npx supabase status`
2. Check DATABASE_URL in .env
3. Try resetting: `npx supabase db reset`

### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Redis Connection Issues
- Ensure Redis is running: `docker ps | grep redis`
- Set `REDIS_ENABLED=false` to disable caching

---

## IDE Setup (VS Code)

### Recommended Extensions
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features
- Prisma (for database)
- REST Client (for API testing)

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
1. Run the seed script to populate test data: `npm run seed`
2. Create a test user account at http://localhost:3000/register
3. Access admin panel at http://localhost:3000/admin (requires admin role)
4. Review API documentation at http://localhost:3005/api-docs
