# V2 Resort Management System

A full-stack hospitality management platform for independent resorts. Built with Next.js 14, Express, PostgreSQL, and TypeScript.

> ⚠️ **Transparency Notice**: This document reflects the actual state of the codebase as of January 2025. Every claim has been verified against the source code. Issues and limitations are documented honestly.

---

## Table of Contents

1. [What This System Does](#what-this-system-does)
2. [Technology Stack](#technology-stack)
3. [Project Statistics](#project-statistics)
4. [Module Breakdown](#module-breakdown)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Security Implementation](#security-implementation)
8. [Testing Infrastructure](#testing-infrastructure)
9. [Known Issues & Limitations](#known-issues--limitations)
10. [Deployment Requirements](#deployment-requirements)
11. [Development Setup](#development-setup)

---

## What This System Does

V2 Resort is a modular resort management platform with four business modules that can be enabled/disabled independently:

| Module | Purpose | Status |
|--------|---------|--------|
| **Restaurant** | Menu browsing, ordering, kitchen display, order tracking | ✅ Functional |
| **Chalets** | Accommodation booking, availability calendar, pricing rules | ✅ Functional |
| **Pool** | Session-based ticketing, capacity management, QR validation | ✅ Functional |
| **Snack Bar** | Quick service ordering, simpler than restaurant | ✅ Functional |

### Core Capabilities

**For Guests:**
- Browse menus with dietary filters (vegetarian, vegan, gluten-free)
- Place restaurant and snack bar orders
- Book chalets with availability checking
- Purchase pool session tickets with QR codes
- Multi-language interface (English, Arabic RTL, French)

**For Staff:**
- Kitchen display for restaurant orders
- Order status workflow management
- Chalet check-in/check-out processing
- Pool ticket QR code validation
- Real-time order notifications via WebSocket

**For Administrators:**
- User and role management
- Module enable/disable
- Menu and pricing management
- Revenue and occupancy reports
- Site branding configuration (logo, colors, contact info)
- Audit log viewing

### Advanced Platform Features

**Theming & Visual Effects:**
| Feature | Description |
|---------|-------------|
| 6 Preset Resort Themes | Beach Paradise, Mountain Retreat, Sunset Glow, Forest Haven, Midnight Oasis, Luxury Gold |
| Weather Effects | Animated snow, rain, leaves, fireflies overlays |
| Dynamic Color System | Runtime CSS variable injection with full color palettes (50-950 shades) |
| 3D Card Components | Mouse-tracking tilt cards with glare effects |
| Aurora Backgrounds | Animated gradient blob effects for hero sections |
| Parallax Sections | Scroll-based parallax with floating particles |
| Loading Screen | Luxurious first-visit animation (session-aware) |

**Real-Time Features:**
| Feature | Description |
|---------|-------------|
| WebSocket Connection Recovery | 2-minute disconnect tolerance with state recovery |
| Heartbeat Monitoring | 30-second intervals for connection health |
| Live User Presence | Track users by page, role, and activity |
| Role-Based Rooms | Broadcast to admin, staff, or specific roles |
| Business Unit Rooms | Targeted updates per module (restaurant, pool, etc.) |

**Automation & Background Jobs:**
| Feature | Description |
|---------|-------------|
| Scheduled Reports | Daily/weekly/monthly email reports (revenue, occupancy, orders) |
| Database Backups | Automated daily backups at 3:00 AM |
| Pool Ticket Expiration | Automatic expiry at midnight + every 4 hours |
| Session Cleanup | Stale sessions deleted at 4:00 AM (older than 7 days) |

**Translation System:**
| Feature | Description |
|---------|-------------|
| Multi-Provider Translation | Google Translate API + LibreTranslate fallback |
| Built-in Dictionary | Common hospitality terms pre-translated (Arabic/French) |
| Lebanese Food Terms | hummus, falafel, shawarma, etc. pre-translated |
| Translation Caching | Avoid repeated API calls |
| Bulk Translation Admin | Scan and translate all missing content |

**Additional Features:**
| Feature | Location |
|---------|----------|
| CSRF Protection | Double-submit cookie pattern middleware |
| Webhook Idempotency | Prevents duplicate Stripe event processing |
| Interactive Resort Map | Clickable SVG map with location pins |
| Wishlist System | LocalStorage-persisted favorites (chalets, menu items) |
| Review Moderation | Guest reviews with admin approval workflow |
| Contact Widget | Floating live chat/contact form |
| Module Builder | Experimental visual page builder (drag-and-drop) |

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2 | React framework with App Router |
| React | 18.3 | UI library |
| TypeScript | 5.4 | Type safety |
| Tailwind CSS | 3.4 | Styling |
| Framer Motion | 12.x | Animations |
| React Query | 5.28 | Server state management |
| Zustand | 4.5 | Client state management |
| next-intl | 3.26 | Internationalization |
| Socket.io-client | 4.7 | Real-time updates |
| Stripe.js | 3.0 | Payment integration |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.18 | HTTP framework |
| TypeScript | 5.3 | Type safety |
| PostgreSQL | 15+ | Database (via Supabase) |
| Socket.io | 4.8 | WebSocket for real-time |
| Zod | 3.25 | Input validation |
| Helmet | 7.2 | Security headers |
| Winston | 3.19 | Logging |
| Stripe | 14.25 | Payment processing |
| Nodemailer | 6.9 | Email sending |
| bcryptjs | 2.4 | Password hashing |
| jsonwebtoken | 9.0 | JWT authentication |
| node-cron | 3.0 | Scheduled tasks |
| speakeasy | 2.0 | TOTP 2FA |
| qrcode | 1.5 | QR code generation |
| dayjs | 1.11 | Date handling |

### Infrastructure
| Component | Purpose |
|-----------|---------|
| Supabase | PostgreSQL hosting + file storage |
| Redis | Optional caching layer |
| Docker Compose | Local development + deployment |
| Nginx | Reverse proxy (Docker setup) |

---

## Project Statistics

### Codebase Size
| Metric | Backend | Frontend | Total |
|--------|---------|----------|-------|
| TypeScript Files | 94 | 156 | 250 |
| Lines of Code | ~17,000 | ~42,000 | ~59,000 |

### Test Coverage (Backend Only)

**Current Coverage: 30.16% statement coverage**

| Metric | Actual | Target |
|--------|--------|--------|
| Statements | 30.16% | 30% ✅ |
| Branches | 47.67% | 47% ✅ |
| Functions | 45.09% | — |
| Lines | 30.16% | — |

**Honest Assessment**: Coverage thresholds are met, but most controllers and services have 0% coverage. The 835 passing tests primarily cover:
- Authentication utilities
- Input validation schemas
- Error handling classes
- Field normalization logic
- Middleware (partial)

**What Has No Coverage:**
- All route files (0%)
- Support module (0%)
- Backup service (0%)
- Email service (0%)
- Scheduled reports service (0%)
- Socket handlers (16%)

---

## Module Breakdown

### Restaurant Module

**Implemented Features:**
- Menu categories and items with multi-language support (EN/AR/FR)
- Dietary tags: vegetarian, vegan, gluten-free, allergens array
- Order placement with cart functionality
- Order status workflow: pending → confirmed → preparing → ready → completed/cancelled
- Kitchen display with real-time WebSocket updates
- Table management
- Special instructions per order item

**Database Tables:**
- `menu_categories` - Categories with translated names
- `menu_items` - Items with prices, dietary info, images
- `restaurant_tables` - Table definitions with capacity
- `restaurant_orders` - Order headers with totals
- `restaurant_order_items` - Line items
- `restaurant_order_status_history` - Status change audit

**API Endpoints:**
```
GET  /api/restaurant/menu              - Public menu with filters
GET  /api/restaurant/menu/:id          - Item details
GET  /api/restaurant/categories        - Category list
POST /api/restaurant/orders            - Create order
GET  /api/restaurant/orders            - List orders
GET  /api/restaurant/orders/:id        - Order details
PATCH /api/restaurant/orders/:id/status - Update status (staff)
GET  /api/restaurant/orders/live       - Kitchen display feed
```

### Chalets Module

**Implemented Features:**
- Chalet listings with amenities, capacity, images
- Base price + weekend price differentiation
- Seasonal price rules with multipliers
- Add-on services (extra bed, BBQ setup, late checkout)
- Availability calendar with double-booking prevention
- Booking workflow: pending → confirmed → checked_in → checked_out
- Guest count and number of nights calculation

**Database Tables:**
- `chalets` - Property definitions
- `chalet_add_ons` - Extra services
- `chalet_price_rules` - Seasonal pricing
- `chalet_bookings` - Reservations
- `chalet_booking_add_ons` - Selected extras per booking

**API Endpoints:**
```
GET  /api/chalets                      - List chalets
GET  /api/chalets/:id                  - Chalet details
GET  /api/chalets/:id/availability     - Check dates
POST /api/chalets/bookings             - Create booking
GET  /api/chalets/bookings             - List bookings
GET  /api/chalets/bookings/:id         - Booking details
PATCH /api/chalets/bookings/:id/status - Check-in/out (staff)
```

### Pool Module

**Implemented Features:**
- Session-based access (morning, afternoon, evening)
- Capacity limits per session
- Adult and child pricing
- QR code generation for tickets
- Staff validation interface
- Entry/exit time tracking

**Database Tables:**
- `pool_sessions` - Session definitions with times and capacity
- `pool_tickets` - Purchased tickets with QR codes

**API Endpoints:**
```
GET  /api/pool/sessions                - Available sessions
GET  /api/pool/sessions/:id            - Session details
POST /api/pool/tickets                 - Purchase ticket
GET  /api/pool/tickets/:id             - Ticket details
POST /api/pool/tickets/validate        - QR validation (staff)
PATCH /api/pool/tickets/:id/entry      - Record entry
PATCH /api/pool/tickets/:id/exit       - Record exit
```

### Snack Bar Module

**Implemented Features:**
- Simpler menu structure than restaurant
- Categories: sandwich, drink, snack, ice_cream
- Order placement and tracking
- Same status workflow as restaurant

**Database Tables:**
- `snack_items` - Menu items
- `snack_orders` - Order headers
- `snack_order_items` - Line items

**API Endpoints:**
```
GET  /api/snack/menu                   - Snack menu
POST /api/snack/orders                 - Create order
GET  /api/snack/orders                 - List orders
PATCH /api/snack/orders/:id/status     - Update status
```

### Admin Module

**Implemented Features:**
- Dashboard with statistics
- User CRUD with role assignment
- Module enable/disable toggles
- Site settings management (branding, contact info)
- Revenue and occupancy reports
- Audit log viewing
- Review moderation

**API Endpoints:**
```
GET  /api/admin/dashboard              - Statistics summary
GET  /api/admin/users                  - List users
POST /api/admin/users                  - Create user
PATCH /api/admin/users/:id             - Update user
DELETE /api/admin/users/:id            - Delete user
GET  /api/admin/modules                - List modules
PATCH /api/admin/modules/:id           - Toggle module
GET  /api/admin/settings               - Site settings
PATCH /api/admin/settings              - Update settings
GET  /api/admin/reports/revenue        - Revenue report
GET  /api/admin/audit                  - Audit logs
```

---

## Database Schema

### Core Tables

**Users & Authentication:**
```sql
users (id, email, phone, password_hash, full_name, profile_image_url, 
       preferred_language, email_verified, is_active, last_login_at, ...)
roles (id, name, display_name, description, business_unit)
user_roles (user_id, role_id, granted_by, granted_at, expires_at)
permissions (id, name, resource, action)
role_permissions (role_id, permission_id)
sessions (id, user_id, token, refresh_token, expires_at, ip_address, user_agent)
```

**Business Modules:**
```sql
modules (id, slug, name, description, is_active, settings, icon)
```

**Enums Defined:**
- `business_unit`: restaurant, snack_bar, chalets, pool, admin
- `order_status`: pending, confirmed, preparing, ready, delivered, completed, cancelled
- `payment_status`: pending, partial, paid, refunded
- `payment_method`: cash, card, whish, online
- `booking_status`: pending, confirmed, checked_in, checked_out, cancelled, no_show
- `ticket_status`: valid, used, expired, cancelled

### Indexes

The schema includes indexes on:
- `users.email`
- `sessions.user_id`, `sessions.token`
- `restaurant_orders.customer_id`, `restaurant_orders.created_at`
- `chalet_bookings.chalet_id`, `chalet_bookings.check_in_date`
- `pool_tickets.session_id`, `pool_tickets.ticket_date`
- `payments.reference_type`, `payments.reference_id`

### Migration System

There are **50+ SQL migration files** in `backend/src/database/`. The main schema is in `migration.sql` (536 lines) with incremental additions in separate files. Migration execution is via TypeScript scripts:
- `migrate.ts` - Main migration runner
- `run-migrations.ts` - Sequential migration execution

---

## API Endpoints

### Public Endpoints (No Auth Required)
```
GET  /health                   - Basic health check
GET  /healthz                  - Alternative health check
GET  /api/health               - Detailed health with DB status
GET  /api/settings             - Public site settings
GET  /api/modules              - Active modules list
```

### Authentication
```
POST /api/auth/register        - User registration
POST /api/auth/login           - Login (returns JWT)
POST /api/auth/refresh         - Refresh access token
POST /api/auth/logout          - Invalidate session
POST /api/auth/forgot-password - Request reset email
POST /api/auth/reset-password  - Reset with token
GET  /api/auth/me              - Current user info
POST /api/auth/2fa/setup       - Enable 2FA
POST /api/auth/2fa/verify      - Verify 2FA code
```

### Protected Endpoints

All module endpoints require:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. Module must be enabled in the database
3. User must have appropriate role for staff/admin endpoints

---

## Security Implementation

### What Is Implemented ✅

| Feature | Implementation | Location |
|---------|---------------|----------|
| **Password Hashing** | bcrypt with salt | `auth.service.ts` |
| **JWT Tokens** | Access (15min) + Refresh (7d) | `auth.utils.ts` |
| **Two-Factor Auth** | TOTP with QR codes, backup codes | `two-factor.service.ts` + `TwoFactorSettings.tsx` |
| **Input Validation** | Zod schemas on all endpoints | `validation/schemas.ts` |
| **Security Headers** | Helmet.js (CSP, HSTS, XSS) | `app.ts` |
| **CORS** | Origin whitelist with Vercel support | `app.ts` |
| **Rate Limiting** | Auth endpoints rate-limited | `auth.routes.ts` |
| **SQL Injection Prevention** | Parameterized queries via Supabase | All database calls |
| **XSS Prevention** | Input sanitization + no dangerouslySetInnerHTML | `fieldNormalizer.ts` |
| **Request ID Tracking** | UUID per request for log correlation | `requestId.middleware.ts` |
| **Audit Logging** | User actions logged to database | `activityLogger.ts` |

### Password Validation Rules
```
- Minimum 8 characters
- Maximum 128 characters
- Requires at least 1 uppercase letter
- Requires at least 1 lowercase letter
- Requires at least 1 number
- Requires at least 1 special character
```

### Role-Based Access Control

Predefined roles:
| Role | Access Level |
|------|-------------|
| `super_admin` | Full access to everything |
| `admin` | Administrative access |
| `restaurant_manager` | Restaurant module management |
| `restaurant_staff` | Restaurant order processing |
| `kitchen_staff` | Kitchen display only |
| `snack_staff` | Snack bar operations |
| `chalet_manager` | Chalet bookings management |
| `pool_staff` | Pool ticket validation |
| `customer` | Customer-facing features |

### Known Security Concerns ⚠️

1. **Test Passwords**: Hardcoded passwords exist in test/seed files (e.g., `admin123`, `password123`) - these are for development only
2. **Environment Variables**: Credentials in `.env` should be rotated if the file was ever committed

---

## Testing Infrastructure

### Unit Tests (Backend)

**Location:** `backend/tests/unit/`

**Test Count:** 835 tests across 46 test files

**Test Framework:** Vitest

**What Is Tested:**
- Authentication service (registration, login, tokens)
- JWT verification and middleware
- Input validation schemas (Zod)
- Field normalization and sanitization
- Error handling (AppError class)
- Cache utilities
- Socket event handling (partial)
- Order validation logic
- Booking validation logic
- CSRF middleware
- Translation service

**What Is NOT Tested:**
- Controller endpoint handlers
- Route definitions
- Database queries and transactions
- Email sending
- Backup functionality
- Scheduled reports
- Full WebSocket flows

### Integration Tests (Backend)

**Location:** `backend/tests/integration/`

**Test Count:** 58 tests across 5 scenario files

**Status:** Infrastructure complete, requires Docker to run

**Scenarios Covered:**
| Scenario | Tests | Description |
|----------|-------|-------------|
| Order Lifecycle | 9 | Customer orders → Staff processes → Complete |
| Auth Flow | 17 | Register → Login → Refresh → Password → Logout |
| Booking Cycle | 11 | Availability → Book → Check-in → Check-out |
| Pool Tickets | 9 | Browse → Purchase → Validate → Use |
| Admin Operations | 12 | Dashboard → Users → Reports |

**Running Integration Tests:**
```bash
# Start test database (requires Docker)
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm run test:integration

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Stress Testing

**Location:** `tools/stress-test/`

**Bot Configuration:**
| Role | Count | Actions |
|------|-------|---------|
| Customer | 50 | Browse menus, place orders, book chalets, buy pool tickets |
| Staff | 20 | Update order status, check-in guests, validate tickets |
| Admin | 2 | Generate reports, manage users, update settings |

**Total: 72 concurrent simulated users**

**Running Stress Tests:**
```bash
# From v2-resort directory
npm run stress-test           # Full test (72 bots)
npm run stress-test:quick     # Quick test (5 customers, 3 staff, 60s)
npm run stress-test:medium    # Medium test (25 customers, 10 staff, 5 min)
```

### Frontend Tests

**Location:** `frontend/tests/`

**Status:** Minimal - only form validation tests exist

The frontend has React Testing Library configured but very few component tests have been written.

### Playwright E2E Tests

**Location:** `v2-resort/tests/`

**Status:** Configured but require full environment setup to run

Playwright is set up with configuration at `v2-resort/playwright.config.ts`. The tests require:
- Backend server running on port 3005
- Frontend server running on port 3000
- Seeded test data (admin user, sample data)
- Test database with proper schema

To run E2E tests:
```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Terminal 3: Run tests
npx playwright test
```

---

## Known Issues & Limitations

### Build Status

✅ **Backend builds successfully** - `npm run build` passes with 0 TypeScript errors
✅ **All 835 unit tests pass**
✅ **Coverage thresholds met** (30% statements, 47% branches)

### Technical Debt

**Large Files (>500 lines):**

Backend:
- `pool.controller.ts` (1703 lines)
- `restaurant.controller.ts` (990 lines)
- `admin.service.ts` (906 lines)
- `chalet.controller.ts` (899 lines)

Frontend:
- `translations/page.tsx` (1075 lines)
- `admin/settings/page.tsx` (1028 lines)
- `admin/restaurant/page.tsx` (884 lines)

These files are candidates for refactoring into smaller, focused modules.

### Feature Gaps

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth login | Schema supports it | Not implemented |
| Stripe webhooks | Basic support | May need more testing |

### Missing Test Coverage

Critical code paths with 0% coverage:
- All route files
- Support module
- Backup service
- Email service
- Scheduled reports service
- Most controller methods

---

## Deployment Requirements

### External Services Required

| Service | Purpose | Required |
|---------|---------|----------|
| Supabase | PostgreSQL database hosting | Yes |
| SMTP Provider | Email sending (SendGrid, Mailgun, etc.) | Yes for password reset |
| Stripe | Payment processing | Yes for paid features |
| Redis | Caching | Optional |
| Sentry | Error tracking | Optional |

### Environment Variables

**Backend (required):**
```env
PORT=3001
NODE_ENV=production
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=strong-random-secret-min-32-chars
JWT_REFRESH_SECRET=different-strong-secret
FRONTEND_URL=https://your-frontend-domain.com
```

**Backend (optional):**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
REDIS_URL=redis://localhost:6379
SENTRY_DSN=https://...@sentry.io/...
```

**Frontend:**
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
NEXT_PUBLIC_SOCKET_URL=https://your-backend-domain.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Docker Deployment

A `docker-compose.yml` is provided for full-stack deployment:
```yaml
services:
  - frontend (Next.js)
  - backend (Express)
  - postgres (PostgreSQL 15)
  - redis (Redis 7)
  - nginx (Reverse proxy)
```

### Estimated Hosting Costs

| Tier | Configuration | Monthly Cost |
|------|--------------|--------------|
| Development | Supabase free tier + Vercel free | $0 |
| Small | Supabase Pro + Vercel Pro | ~$50-75 |
| Production | Dedicated VPS + Managed DB | ~$100-200 |

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (local or Supabase)
- Git

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd v2-resort

# Backend setup
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials
npm install
npm run migrate
npm run dev

# Frontend setup (new terminal)
cd frontend
cp .env.example .env
# Edit .env with API URL
npm install
npm run dev
```

### Running Tests

```bash
# Backend unit tests
cd backend
npm test

# With coverage
npm run test:coverage

# Integration tests (requires Docker)
npm run test:integration:setup
npm run test:integration
npm run test:integration:teardown

# Stress tests
cd ..
npm run stress-test:quick
```

### Project Structure

```
v2-resort/
├── backend/
│   ├── src/
│   │   ├── config/         # Environment configuration
│   │   ├── database/       # Migrations, connection, seeds
│   │   ├── middleware/     # Auth, rate-limit, logging
│   │   ├── modules/        # Business modules (auth, restaurant, etc.)
│   │   ├── services/       # Email, backup, translation
│   │   ├── socket/         # WebSocket handlers
│   │   ├── utils/          # Logger, errors, helpers
│   │   └── validation/     # Zod schemas
│   └── tests/
│       ├── unit/           # Unit tests
│       └── integration/    # Integration tests
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # API client, utilities
│   │   └── store/          # Zustand stores
│   ├── messages/           # Translation files (en, ar, fr)
│   └── tests/              # Frontend tests
├── shared/                 # Shared types
└── tools/
    └── stress-test/        # Stress testing bots
```

---

## API Documentation

Interactive API documentation available when running the backend:
- OpenAPI JSON: `GET /api/docs`
- Swagger UI: `GET /api/docs/ui`

---

## License

Proprietary. Source code is provided for customization after purchase. Resale prohibited.


---

*Last updated: January 2025*
*This README reflects actual codebase state, not aspirational features.*
