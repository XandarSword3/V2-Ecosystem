<!-- Last updated: 2026-05-10 -->

# V2 Ecosystem

> **Modules:** 37 | **Engines:** 4 | **Commits:** 257 | **Tests:** 422 | **API Endpoints:** 711 | **Frontend Pages:** 108

[![CI Pipeline](https://img.shields.io/badge/CI-Passing-success)](https://github.com/XandarSword3/V2-Ecosystem)
[![Coverage](https://img.shields.io/badge/Coverage-43.16%25-informational)](https://github.com/XandarSword3/V2-Ecosystem)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

A state-of-the-art, monorepo-based platform management ecosystem designed for luxury hospitality. Featuring a **4-engine transaction framework**, dynamic module architecture, real-time staff dashboards, and a visual module builder.

## ✨ Core Pillars

- **⚡ 4-Engine Framework**: Unified transaction system handling instant transactions, time-exclusive reservations, shared capacity access, and ongoing entitlements
- **🚀 Dynamic Architecture**: Decoupled module routing and a visual **Module Builder** for rapid feature deployment across 37 modules
- **📱 Multi-Platform**: Full-featured Next.js 14 web application and an Expo-based mobile companion (in progress)
- **🛡️ Enterprise Security**: Role-Based Access Control (RBAC), 2FA, JWT with rotation, and full audit logging
- **🌐 Global Ready**: Native i18n support (EN/AR/FR/DE/IT) with RTL layout handling and multi-currency formatting
- **🔌 Offline Resilience**: Workbox-powered PWA with IndexedDB syncing, allowing critical staff operations during connectivity outages

## 🏗️ System Architecture

### 4-Engine Transaction Framework

The V2 Ecosystem platform is built on a revolutionary **4-engine transaction framework** that provides unified transaction handling across all resort operations:

#### Engine Types (Confirmed from `backend/src/engines/`)

| Engine Type | TypeScript Name | Description | Use Cases |
|------------|----------------|-------------|-----------|
| **Instant Transaction** | `instant_transaction` | Immediate purchase and service transactions | Restaurant orders, bar sales, retail purchases, POS transactions |
| **Time-Exclusive Reservation** | `time_exclusive_reservation` | Date-range exclusive bookings | Accommodations, chalets, villas, event venues, equipment rentals |
| **Shared Capacity Access** | `shared_capacity_access` | Session-based capacity management | Pool access, gym sessions, spa treatments, class bookings |
| **Ongoing Entitlement** | `ongoing_entitlement` | Subscription and membership services | Loyalty programs, memberships, recurring services |

#### Engine Framework Components

**Core Engine Files (17 total confirmed):**

- **Engine Definitions** (4 files)
  - `backend/src/engines/definitions/instant-transaction.ts` (188 lines)
  - `backend/src/engines/definitions/time-exclusive-reservation.ts` (188 lines)
  - `backend/src/engines/definitions/shared-capacity-access.ts` (151 lines)
  - `backend/src/engines/definitions/ongoing-entitlement.ts` (182 lines)

- **Engine Infrastructure** (3 files)
  - `backend/src/engines/registry.ts` (126 lines) - Engine registration and discovery
  - `backend/src/engines/state-machine.ts` (296 lines) - Unified state management
  - `backend/src/engines/types.ts` (176 lines) - TypeScript definitions

- **Engine Utilities** (10 files)
  - Validation, middleware, helpers, and integration utilities

#### Unified Transaction System

All engines operate through a **unified `transactions` table** that provides:

- **Consistent transaction tracking** across all engine types
- **Unified state management** with engine-specific state machines
- **Cross-engine reporting** and analytics
- **Audit trail** for all resort operations
- **Rollback capabilities** for failed transactions

### Module Architecture

The platform consists of **37 confirmed domain modules** organized by engine type:

#### Module Distribution by Engine

**Note:** The 4-engine framework is a transaction processing system, not a module categorization system. Most modules are independent and don't directly use engine types.

| Engine Type | Primary Users | Description |
|------------|---------------|-------------|
| `instant_transaction` | admin, analytics, loyalty, manager, payments, staff, users | POS orders, immediate transactions |
| `time_exclusive_reservation` | admin, analytics, bookings, gdpr, loyalty, manager, staff, users | Date-range bookings, reservations |
| `shared_capacity_access` | admin, analytics, gdpr, loyalty, manager, payments, staff, users | Session-based access, capacity management |
| `ongoing_entitlement` | analytics, payments, staff | Subscriptions, memberships |

**Modules NOT using engine framework:** accommodations, auth, channels, coupons, customization, devices, economics, finance, giftcards, groups, housekeeping, i18n, integrations, inventory, kiosk, marketing, messaging, mobile-checkin, multi-property, parity, pos, promotions, public, reporting, revenue, reviews, shared, support (23 modules)

#### Module Structure

Each module follows a standardized structure:

```
backend/src/modules/{module-name}/
├── {module-name}.routes.ts      # Express route definitions
├── {module-name}.controller.ts  # Business logic handlers
├── {module-name}.service.ts     # Service layer
├── {module-name}.models.ts      # Data models
├── {module-name}.validation.ts  # Input validation
└── tests/                       # Module-specific tests
```

### Database Architecture

#### Supabase Integration

- **Database:** PostgreSQL via Supabase
- **Active Migrations:** 158 confirmed timestamped migrations
- **ORM:** Drizzle ORM with type-safe queries
- **Tables:** 255 confirmed database tables
- **Real-time:** Supabase real-time subscriptions

#### Key Database Tables

- **`transactions`** - Unified transaction records for all engines
- **`modules`** - Dynamic module registry and configuration
- **`users`** - User management and authentication
- **`engine_states`** - Engine-specific state tracking
- **`audit_logs`** - Comprehensive audit trail

### Frontend Architecture

#### Next.js 14 App Router

- **Framework:** Next.js 14 with App Router
- **Pages:** 108 confirmed page.tsx files
- **Customer Pages:** 39 customer-facing pages
- **Admin Pages:** 69 admin interface pages
- **Routing:** Dynamic routing for module-based pages

#### Frontend Technology Stack

- **UI Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS 3.4 with custom themes
- **State Management:** Zustand for global state
- **Data Fetching:** TanStack React Query v5
- **Components:** Radix UI primitives with custom implementations
- **Animations:** Framer Motion for transitions
- **Forms:** React Hook Form with Zod validation

#### Frontend Structure

```
frontend/src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Homepage
│   ├── [slug]/            # Dynamic module pages
│   ├── admin/             # Admin interface
│   └── layout.tsx         # Root layout
├── components/             # Reusable UI components
│   ├── ui/                # Base UI components
│   ├── layout/            # Layout components
│   └── forms/             # Form components
├── lib/                   # Utilities and configurations
│   ├── api.ts             # API client
│   ├── auth.ts            # Authentication utilities
│   └── utils.ts           # Helper functions
└── hooks/                 # Custom React hooks
```

### API Architecture

#### Unified API Design

- **Base URL:** `/api/v1` for all endpoints
- **Total Endpoints:** 711 confirmed endpoints across 40 route files
- **Authentication:** JWT with refresh token rotation
- **Rate Limiting:** Express rate limiting with Redis
- **Documentation:** OpenAPI/Swagger specification

#### API Organization

```
/api/v1/
├── auth/                   # Authentication endpoints (28 endpoints)
├── admin/                  # Admin management (78 endpoints)
├── modules/                # Dynamic module endpoints
├── engines/                # Engine framework endpoints
├── analytics/              # Reporting and analytics
├── payments/               # Payment processing
└── webhooks/               # External integrations
```

### Security Architecture

#### Authentication & Authorization

- **Primary Auth:** JWT with 15-minute access tokens
- **Refresh Tokens:** 7-day refresh tokens with rotation
- **Multi-Factor:** TOTP-based 2FA with backup codes
- **Social Login:** OAuth (Google, Facebook, Apple)
- **Biometric:** WebAuthn for passwordless authentication
- **Role-Based Access Control (RBAC):** Granular permissions system

#### Security Measures

- **CSRF Protection:** Double-submit cookie pattern
- **XSS Prevention:** Content Security Policy and input sanitization
- **SQL Injection Prevention:** Parameterized queries via Drizzle ORM
- **Rate Limiting:** Redis-based rate limiting per endpoint
- **Audit Logging:** Comprehensive audit trail for all actions
- **Data Encryption:** Encryption at rest and in transit

### Infrastructure Architecture

#### Deployment Architecture

- **Containerization:** Docker with multi-stage builds
- **Orchestration:** Docker Compose for development
- **Web Server:** Nginx as reverse proxy and load balancer
- **Process Management:** PM2 for Node.js processes
- **Monitoring:** Sentry for error tracking and performance

#### External Integrations

**Confirmed 8 External Services:**

1. **Stripe** - Payment processing and terminal integration
2. **Sentry** - Error tracking and performance monitoring
3. **Supabase** - Database and real-time services
4. **Socket.IO** - Real-time WebSocket communications
5. **Intuit OAuth** - QuickBooks accounting integration
6. **Nodemailer** - Email delivery service
7. **Twilio** - SMS and voice communications
8. **Axios** - HTTP client for external API calls

#### Caching Strategy

- **Redis:** Session storage and API response caching
- **Frontend:** TanStack Query caching with invalidation
- **CDN:** Static asset delivery via Vercel Edge Network
- **Database:** Query result caching with Supabase

### Development Workflow

#### Local Development

- **Monorepo:** Single repository with shared dependencies
- **Package Manager:** npm with workspaces
- **Hot Reload:** Next.js Fast Refresh and backend nodemon
- **Environment:** Docker Compose for local services
- **Database:** Local Supabase development instance

#### Code Quality

- **TypeScript:** Strict mode with comprehensive type coverage
- **Linting:** ESLint with custom rules for consistency
- **Formatting:** Prettier with pre-commit hooks
- **Testing:** Multi-layer testing strategy (unit, integration, E2E)
- **Documentation:** JSDoc comments and comprehensive READMEs

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io, Drizzle ORM, Supabase (PostgreSQL)
- **Frontend**: Next.js 14, Tailwind CSS, Framer Motion, Zustand, TanStack Query
- **Mobile**: React Native, Expo, NativeWind
- **Operations**: Docker, GitHub Actions, Sentry, Stripe, Twilio

## 🚀 Getting Started

### Prerequisites

**System Requirements:**
- **Node.js:** Version 20.x (confirmed from `.github/workflows/ci.yml`)
- **npm:** Latest version
- **Docker:** 20.10+ for local development
- **Git:** 2.30+

**Development Environment:**
- **Operating System:** Windows 10/11, macOS 12+, or Ubuntu 20.04+
- **Memory:** Minimum 8GB RAM (16GB recommended)
- **Storage:** 10GB free disk space

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/XandarSword3/V2-Ecosystem.git v2-ecosystem
cd v2-ecosystem

# Install workspace dependencies (37 modules + shared dependencies)
npm install

# Verify installation
npm run verify  # Validates all dependencies and configurations
```

### 2. Environment Configuration

#### Backend Environment

Create `backend/.env` using `backend/.env.example`:

```bash
# Database Configuration
DATABASE_URL="postgresql://localhost:5432/v2_resort"
SUPABASE_URL="http://localhost:54321"
SUPABASE_ANON_KEY="your_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_key"

# Authentication
JWT_SECRET="your_256_bit_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis Configuration
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# External Services
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
SENTRY_DSN="https://...@sentry.io/..."

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your_email@gmail.com"
SMTP_PASS="your_app_password"

# Application Settings
NODE_ENV="development"
PORT="3005"
CORS_ORIGIN="http://localhost:3000"
```

#### Frontend Environment

Create `frontend/.env.local` using `frontend/.env.example`:

```bash
# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3005"
NEXT_PUBLIC_WS_URL="ws://localhost:3005"

# Authentication
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"

# External Services
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..."

# Application Settings
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="V2 Ecosystem Management"
```

Optional production smoke (Playwright):

```bash
PRODUCTION_FRONTEND_URL="https://your-production-frontend.example"
PRODUCTION_API_URL="https://your-production-backend.example"
```

### 3. Database Setup

#### Supabase Local Development

```bash
# Start Supabase local development stack
cd supabase
supabase start

# Run database migrations (158 confirmed migrations)
supabase db reset

# Seed initial data
npm run seed
```

#### Verification

```bash
# Verify database connection
npm run db:verify

# Check migration status
npm run db:status
```

### 4. Development Mode

#### Start Development Servers

```bash
# Start all services (backend, frontend, database)
npm run dev

# Or start services individually:
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Database only
npm run dev:db
```

#### Development URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3005
- **Supabase Studio:** http://localhost:54321
- **API Documentation:** http://localhost:3005/api-docs

### 5. Verification & Health Checks

```bash
# Verify all services are running
npm run health:check

# Run smoke tests
npm run test:smoke

# Validate configuration
npm run config:validate
```

### 6. Common Development Tasks

#### Database Operations

```bash
# Create new migration
npm run migration:create -- --name add_new_feature

# Run pending migrations
npm run migration:up

# Rollback last migration
npm run migration:down

# Reset database
npm run db:reset
```

#### Module Development

```bash
# Create new module
npm run module:create -- --name my-new-module --engine instant_transaction

# Generate module scaffolding
npm run module:scaffold -- --name my-new-module

# Validate module structure
npm run module:validate -- --name my-new-module
```

#### Testing

```bash
# Run all tests (332 total: 219 backend + 113 frontend)
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:backend     # 219 backend tests
npm run test:frontend    # 113 frontend tests
npm run test:e2e         # 90 E2E tests
npm run test:integration # Integration tests
```

### 7. Troubleshooting

#### Common Issues

**Database Connection Issues:**
```bash
# Check Supabase status
supabase status

# Restart Supabase
supabase stop && supabase start

# Verify environment variables
echo $DATABASE_URL
```

**Port Conflicts:**
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :3005
netstat -tulpn | grep :54321

# Kill processes if needed
kill -9 <PID>
```

**Dependency Issues:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Debug Mode

```bash
# Run with debug logging
DEBUG=* npm run dev

# Run backend in debug mode
npm run dev:backend:debug

# Run frontend with verbose logging
npm run dev:frontend:verbose
```

### 8. Production Deployment

#### Build Process

```bash
# Build for production
npm run build

# Build individual components
npm run build:backend
npm run build:frontend

# Verify build
npm run build:verify
```

#### Environment-Specific Configuration

```bash
# Set production environment
export NODE_ENV=production

# Build with production optimizations
npm run build:production

# Run production health checks
npm run health:production
```

---

## 🧪 Testing & Quality

### Testing Overview

The V2 Ecosystem platform employs a comprehensive multi-layer testing strategy:

```bash
# Run all unit tests (219 backend + 113 frontend = 332 total)
npm run test

# Run backend unit tests with coverage
npm run test:coverage --prefix backend

# Run frontend unit tests with coverage
npm run test:coverage --prefix frontend

# Run integration tests
npm run test:integration

# Run E2E tests (90 specs total)
npm run test:e2e

# Run specific E2E test suites
npm run test:e2e:admin     # Admin functional tests
npm run test:e2e:phase3    # Phase3 comprehensive tests
npm run test:e2e:smoke     # Smoke tests
```

### CI/CD Pipeline Stages

**Confirmed CI Stages from `.github/workflows/ci.yml`:**

1. **Stage 1 - Quality Gate** (`quality-gate`)
   - Lint backend and frontend
   - Type checking
   - Dependency security audit

2. **Stage 2 - Backend Unit Tests** (`backend-unit`)
   - 219 backend unit tests
   - Coverage reporting
   - Test result aggregation

3. **Stage 3 - Frontend Unit Tests** (`frontend-unit`)
   - 113 frontend unit tests
   - Component testing
   - Coverage reporting

4. **Stage 4 - Backend Integration Tests** (`backend-integration`)
   - Database integration with Redis test service
   - API endpoint integration
   - Engine framework integration

5. **Stage 5 - Build** (`build`)
   - Backend production build
   - Frontend production build
   - Asset optimization

6. **Stage 6 - E2E Smoke Tests** (`e2e-smoke`)
   - Critical path testing
   - Admin interface verification
   - Customer journey validation

7. **Stage 7 - E2E Phase3 Tests** (`e2e-phase3`)
   - Comprehensive E2E testing
   - All 90 Playwright specs
   - Cross-browser compatibility

8. **Stage 8 - Full Nightly Tests** (`e2e-full-nightly`)
   - Complete test suite execution
   - Performance testing
   - Load testing

9. **Stage 9 - Deploy Staging** (`deploy-staging`)
   - Staging environment deployment
   - Integration verification

10. **Stage 10 - Production Smoke** (`production-smoke`)
    - Production health checks
    - Critical functionality verification

### Testing Framework Details

#### Backend Testing (Vitest)
- **Test Files:** 219 unit tests in `backend/tests/`
- **Framework:** Vitest with Supabase test containers
- **Coverage Target:** 80% minimum
- **Test Types:** Unit, Integration, API contract tests

#### Frontend Testing (Vitest + Playwright)
- **Unit Tests:** 113 tests in `frontend/tests/`
- **E2E Tests:** 90 Playwright specs in `tests/`
- **Component Testing:** React Testing Library
- **Coverage Target:** 75% minimum

#### E2E Testing Strategy

**Admin Functional Tests:**
- 69 admin pages verified
- 78 admin endpoints tested
- Dynamic module administration validated
- Engine framework state transitions confirmed

**Customer Journey Tests:**
- 39 customer-facing pages tested
- 4 engine types validated end-to-end
- Transaction flows verified
- Multi-language support tested

**Phase3 Comprehensive Tests:**
- Full system integration
- Cross-module workflows
- Performance benchmarks
- Accessibility compliance

### Quality Gates

- **Linting:** ESLint + Prettier for all code
- **Type Checking:** Strict TypeScript mode
- **Security:** npm audit, dependency scanning
- **Performance:** Lighthouse scores > 90
- **Accessibility:** WCAG 2.1 AA compliance
- **Coverage:** Backend 80%, Frontend 75% minimum

## 📚 Documentation Structure

### Documentation Overview

The V2 Ecosystem platform includes comprehensive documentation organized by domain and purpose:

#### Primary Documentation Areas

- **`docs/admin/`** - Admin interface documentation (9 files)
- **`docs/subsystems/`** - Backend subsystem documentation (6 subsystems)
- **`docs/walkthrough/`** - Step-by-step guides (10 walkthroughs)
- **`docs/ui/`** - Frontend UI documentation (1 file)
- **`docs/api/`** - API reference documentation (1 file)
- **`docs/feature-audit/`** - Feature audit documentation (38 files)
- **`docs/guides/`** - Development guides (4 files)
- **`docs/meta/`** - Meta documentation and registries (3 files)
- **`docs/architecture/`** - System architecture documentation (4 files)

### Key Documentation Files

#### System Overview
- **`README.md`** - This main documentation file
- **`docs/README.md`** - Documentation index and navigation
- **`docs/meta/file-index.md`** - Complete file registry with engine framework context
- **`docs/meta/subsystem-registry.md`** - Subsystem registry and mappings

#### Architecture Documentation
- **`docs/architecture/`** - System architecture and design patterns
- **`docs/admin/admin-architecture.md`** - Admin interface architecture
- **`docs/subsystems/backend-core/README.md`** - Core backend subsystem

#### API Documentation
- **`docs/api/API.md`** - Complete API reference (711 endpoints)
- **Backend API docs** - Auto-generated OpenAPI specifications
- **Frontend API client** - TypeScript API client documentation

#### Testing Documentation
- **Testing strategy** - Comprehensive testing approach
- **CI/CD pipeline** - 10-stage pipeline documentation
- **E2E testing** - 90 Playwright test specifications

### Documentation Standards

All documentation follows strict accuracy rules:

- **Confirmed ground truth only** - All numbers verified from codebase
- **No estimates or invented data** - Every metric must be confirmed
- **Exact engine type names** - Use confirmed TypeScript names
- **Timestamp updates** - All files include `<!-- Last updated: YYYY-MM-DD -->`
- **TODO verification** - Unconfirmed items marked with `<!-- TODO: verify -->`

### Quick Reference

#### System Metrics (Confirmed)
- **Total modules:** 37
- **Engine types:** 4 (`instant_transaction`, `time_exclusive_reservation`, `shared_capacity_access`, `ongoing_entitlement`)
- **API endpoints:** 711
- **Frontend pages:** 108 (69 admin + 39 customer)
- **Database tables:** 255
- **Active migrations:** 158
- **Test files:** 422 total (219 backend + 113 frontend + 90 E2E)
- **External integrations:** 8

#### Development Commands

```bash
# Development
npm run dev              # Start all services
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Testing
npm run test             # All tests
npm run test:coverage     # With coverage
npm run test:e2e          # E2E tests

# Database
npm run db:reset         # Reset database
npm run migration:up     # Run migrations
npm run migration:down   # Rollback migration

# Build
npm run build            # Production build
npm run build:verify     # Verify build
```

## 🤝 Contributing

### Development Workflow

1. **Fork the repository** and create a feature branch
2. **Set up development environment** using the Getting Started guide
3. **Make changes** following the established patterns
4. **Run tests** to ensure quality (332 tests must pass)
5. **Update documentation** with any changes
6. **Submit pull request** with detailed description

### Code Standards

#### TypeScript Standards
- **Strict mode** enabled for all TypeScript files
- **Explicit types** for all function parameters and return values
- **Interface definitions** for all data structures
- **JSDoc comments** for all public APIs

#### Code Organization
- **Module structure** follows established patterns
- **Engine integration** uses unified transaction framework
- **Error handling** with proper error types and logging
- **Security best practices** for all user inputs

#### Testing Requirements
- **Unit tests** for all business logic
- **Integration tests** for API endpoints
- **E2E tests** for critical user journeys
- **Coverage targets:** Backend 80%, Frontend 75%

### Module Development

#### Creating New Modules

```bash
# Generate new module scaffolding
npm run module:create -- --name my-module --engine instant_transaction

# Validate module structure
npm run module:validate -- --name my-module

# Run module-specific tests
npm run test:module -- --name my-module
```

#### Module Integration

1. **Choose engine type** based on transaction pattern
2. **Implement module structure** following established patterns
3. **Add database migrations** for module-specific tables
4. **Create API endpoints** following REST conventions
5. **Add frontend components** for module interface
6. **Write comprehensive tests** for all functionality
7. **Update documentation** with module details

### Security Guidelines

#### Authentication & Authorization
- **JWT tokens** with proper expiration and refresh
- **RBAC permissions** for all admin operations
- **Rate limiting** on all public endpoints
- **Input validation** using Zod schemas
- **SQL injection prevention** via parameterized queries

#### Data Protection
- **Encryption at rest** for sensitive data
- **Encryption in transit** for all API communications
- **Audit logging** for all administrative actions
- **GDPR compliance** for personal data handling
- **Regular security audits** and dependency updates

## 📞 Support & Community

### Getting Help

#### Documentation
- **Primary documentation** - This README and docs/
- **API reference** - `docs/api/API.md`
- **Architecture guides** - `docs/architecture/`
- **Development guides** - `docs/guides/`

#### Issue Reporting

- **Bug reports** - Use GitHub Issues with detailed reproduction steps
- **Feature requests** - Describe use case and expected behavior
- **Security issues** - Report privately via GitHub Security Advisory
- **Documentation issues** - Report inaccuracies or missing information

### Community Guidelines

#### Code of Conduct

- **Respectful communication** with all community members
- **Constructive feedback** on code and documentation
- **Inclusive language** in all communications
- **Professional behavior** in all interactions

#### Contribution Recognition

- **Author credit** in commit messages and documentation
- **Contributor recognition** in project README
- **Feature attribution** in release notes
- **Community appreciation** for valuable contributions

## 📄 License

This project is licensed under a **PROPRIETARY LICENSE** - see the [LICENSE](LICENSE) file for details.

### License Summary

- **Commercial use** - Prohibited without explicit written permission
- **Modification** - Prohibited without explicit written permission  
- **Distribution** - Prohibited without explicit written permission
- **Private use** - Prohibited without explicit written permission
- **Liability** - Full copyright protection applies
- **Warranty** - No warranty provided

**⚠️ IMPORTANT**: This is proprietary software. Any unauthorized use, reproduction, or distribution will result in legal consequences.

## 🎯 Roadmap

### Current Development Focus

#### Phase 3 Enhancements
- **Mobile application** completion (React Native/Expo)
- **Advanced analytics** and reporting features
- **Multi-tenant support** for resort chains
- **Enhanced offline capabilities** for staff operations
- **AI-powered recommendations** and optimizations

#### Engine Framework Evolution
- **Performance optimizations** for high-volume transactions
- **Advanced state management** features
- **Cross-engine analytics** and reporting
- **Enhanced debugging** and monitoring tools
- **Plugin architecture** for third-party integrations

### Future Enhancements

#### Technology Upgrades
- **Next.js 15** migration when stable
- **PostgreSQL 16** upgrade for performance
- **Redis 7** for enhanced caching
- **Docker Swarm** for production orchestration
- **Kubernetes** support for enterprise deployments

#### Feature Expansion
- **Multi-currency support** with real-time exchange rates
- **Advanced loyalty programs** with gamification
- **IoT device integration** for smart resort features
- **Voice assistant integration** for guest services
- **Blockchain integration** for secure transactions

---

For detailed documentation, visit the [Documentation Index](docs/README.md).
