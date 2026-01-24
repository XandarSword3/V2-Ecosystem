# V2 Resort Platform - System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Feature Inventory](#feature-inventory)
4. [API Reference](#api-reference)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Security](#security)
8. [Monitoring](#monitoring)

---

## System Overview

V2 Resort is a comprehensive hospitality management platform designed for resort operations. It provides end-to-end management for:

- **Restaurant & Snack Bar**: Menu management, order processing, kitchen display
- **Chalets**: Booking management, availability, check-in/check-out
- **Pool**: Ticket sales, capacity management, bracelet tracking
- **Staff**: Shift scheduling, assignments, time tracking
- **Customers**: Mobile app support, loyalty program, gift cards

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL (Supabase) |
| Real-time | Socket.IO |
| Caching | Redis (optional) |
| File Storage | Supabase Storage |
| Payments | Stripe |
| Push Notifications | Firebase Cloud Messaging |
| Email | SendGrid/SMTP |

---

## Architecture

### System Diagram
```
                    ┌─────────────────┐
                    │   CDN / Edge    │
                    │   (Vercel)      │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   Web App     │ │  Mobile App │ │  Admin App  │
    │   (Next.js)   │ │   (Native)  │ │  (Next.js)  │
    └───────┬───────┘ └──────┬──────┘ └──────┬──────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │   (Express.js)  │
                    │   Rate Limiting │
                    │   Auth/RBAC     │
                    └────────┬────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
    ▼                        ▼                        ▼
┌────────┐            ┌────────────┐            ┌─────────┐
│ Redis  │            │ PostgreSQL │            │ Storage │
│ Cache  │            │ (Supabase) │            │  Bucket │
└────────┘            └────────────┘            └─────────┘
```

### Module Structure
```
backend/src/
├── config/           # Environment configuration
├── database/         # Database connection
├── middleware/       # Auth, rate limiting, security
├── modules/
│   ├── admin/        # Admin management, backups
│   ├── auth/         # Authentication, biometric
│   ├── chalets/      # Chalet bookings
│   ├── coupons/      # Discount coupons
│   ├── devices/      # Mobile device management
│   ├── giftcards/    # Gift card system
│   ├── housekeeping/ # Maintenance tasks
│   ├── inventory/    # Stock management
│   ├── loyalty/      # Loyalty points
│   ├── manager/      # Manager dashboard
│   ├── payments/     # Stripe integration
│   ├── pool/         # Pool management
│   ├── restaurant/   # Restaurant orders
│   ├── reviews/      # Customer reviews
│   ├── snack/        # Snack bar orders
│   ├── staff/        # Staff management
│   ├── support/      # Support tickets
│   └── users/        # User profiles
├── services/         # Business logic
├── socket/           # WebSocket handlers
├── utils/            # Helpers, logging
└── validation/       # Zod schemas
```

---

## Feature Inventory

### Authentication (Phase 1 Complete)
- ✅ JWT authentication with refresh tokens
- ✅ Token versioning for logout-all-devices
- ✅ OAuth (Google, Facebook)
- ✅ Biometric/WebAuthn passkey authentication
- ✅ Password reset flow
- ✅ Session management
- ✅ Device token tracking

### Restaurant Module
- ✅ Menu categories and items
- ✅ Special offers and featured items
- ✅ Order placement (dine-in, takeaway)
- ✅ Order status tracking
- ✅ Kitchen display system
- ✅ Table management
- ✅ Receipt generation

### Chalet Module
- ✅ Chalet listing with photos
- ✅ Availability calendar
- ✅ Dynamic pricing rules
- ✅ Add-on services
- ✅ Online booking
- ✅ Check-in/check-out
- ✅ Booking cancellation

### Pool Module
- ✅ Session management
- ✅ Ticket purchasing
- ✅ Capacity tracking
- ✅ Bracelet assignment
- ✅ Entry/exit recording
- ✅ Maintenance logs

### Staff Management (Phase 4 Complete)
- ✅ Shift scheduling
- ✅ Clock in/out
- ✅ Shift assignments
- ✅ Shift swap workflow with manager approval
- ✅ Time tracking reports
- ✅ Staff roles and permissions

### Loyalty & Promotions
- ✅ Points earning on purchases
- ✅ Points redemption
- ✅ Tier system
- ✅ Gift card creation and redemption
- ✅ Coupon system with stacking rules
- ✅ Discount campaigns

### Admin Features
- ✅ Dashboard analytics
- ✅ User management
- ✅ Module builder
- ✅ Settings management
- ✅ Audit logging
- ✅ Backup management
- ✅ Delete preview with impact analysis (Phase 3)
- ✅ Soft delete with restore (Phase 3)

---

## API Reference

### Base URLs
- Development: `http://localhost:3005/api`
- Staging: `https://staging-api.v2resort.com/api`
- Production: `https://api.v2resort.com/api`

### Authentication
All protected endpoints require:
```
Authorization: Bearer <access_token>
```

### Rate Limits
| Endpoint Type | Limit |
|---------------|-------|
| General API | 1000 req/min |
| Auth endpoints | 10 req/15 min |
| Write operations | 30 req/min |
| Expensive (reports) | 10 req/hour |

### Key Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Get tokens |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Invalidate session |
| POST | /auth/biometric/register-begin | Start passkey setup |

#### Restaurant
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /restaurant/menu | Get full menu |
| POST | /restaurant/orders | Place order |
| GET | /restaurant/my-orders | User's orders |
| PATCH | /restaurant/staff/orders/:id/status | Update status |

#### Chalets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /chalets | List chalets |
| GET | /chalets/:id/availability | Check dates |
| POST | /chalets/bookings | Create booking |
| GET | /chalets/my-bookings | User's bookings |

#### Pool
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /pool/sessions | List sessions |
| POST | /pool/tickets | Purchase ticket |
| GET | /pool/my-tickets | User's tickets |
| POST | /pool/staff/validate | Validate QR |

#### Staff
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /staff/shifts/me | My shifts |
| POST | /staff/shifts/:id/clock-in | Clock in |
| POST | /staff/shifts/swap | Request swap |
| PUT | /staff/shifts/swap/:id/approve | Manager approve |

---

## Testing

### Test Suite Summary
- **130 test files**
- **4058 passing tests**
- **10 skipped** (documented complex multi-query scenarios)

### Running Tests
```bash
cd backend

# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests
npm run test:integration
```

### Load Testing
```bash
cd tools/stress-test

# 100 concurrent bookings
npx tsx load-test-bookings.ts

# 50 simultaneous orders
npx tsx load-test-orders.ts

# Full load test suite
npx tsx run-load-tests.ts
```

### E2E Testing
```bash
# Run Playwright tests
npx playwright test

# With UI
npx playwright test --ui

# Specific test file
npx playwright test tests/customer-flows.spec.ts
```

---

## Deployment

### CI/CD Pipeline (GitHub Actions)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Lint &    │────▶│    Tests    │────▶│   Build     │
│  Typecheck  │     │ (Unit/E2E)  │     │   Check     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │  Security   │────▶│   Deploy    │
                    │    Scan     │     │  (Staging)  │
                    └─────────────┘     └─────────────┘
```

### Environment Variables
```env
# Required
NODE_ENV=production
JWT_SECRET=<min-32-chars>
JWT_REFRESH_SECRET=<min-32-chars>
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=<service-key>
DATABASE_URL=postgres://...

# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Push Notifications
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/json

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Deployment Checklist
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Backup created pre-deployment
- [ ] DNS configured
- [ ] SSL certificates valid
- [ ] Rate limits configured
- [ ] Monitoring enabled

---

## Security

### Authentication Security
- JWT with short expiry (15 min access, 7 day refresh)
- Token versioning prevents old tokens after password change
- Biometric for passwordless login
- Session tracking per device

### API Security
- Rate limiting (IP + User-based)
- Input validation (Zod schemas)
- SQL injection prevention (parameterized queries)
- XSS protection (helmet.js)
- CORS configuration
- Request ID tracking

### Data Security
- Soft delete prevents accidental data loss
- Audit logging for all admin actions
- GDPR-compliant data export/deletion
- Encrypted storage for sensitive data

### Security Audits
- Rate limiting: See [RATE_LIMITING_AUDIT.md](docs/RATE_LIMITING_AUDIT.md)
- Delete safety: See [delete-preview.controller.ts](modules/admin/controllers/delete-preview.controller.ts)

---

## Monitoring

### Health Endpoints
- `GET /health` - Basic health check
- `GET /healthz` - Kubernetes probe
- `GET /api/health` - Detailed with DB/Redis status

### Metrics
- Request latency (average, P95, P99)
- Error rate
- Database connection pool
- Cache hit rate
- Active WebSocket connections

### Logging
- Request/response logging with request IDs
- Error logging with stack traces
- Audit logging for admin actions
- Activity logging for user actions

### Alerting Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| Latency P99 | > 2s | > 5s |
| DB connections | > 80% | > 95% |
| Memory usage | > 80% | > 95% |

---

## Support Documents

- [API Documentation](API.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Testing Guide](TESTING.md)
- [User Guide](USER_GUIDE.md)
- [Mobile App Readiness](docs/MOBILE_APP_READINESS.md)
- [Rate Limiting Audit](docs/RATE_LIMITING_AUDIT.md)
- [Backup & Recovery](docs/BACKUP_DISASTER_RECOVERY.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-19 | Initial production release |
| | | - Schema gaps addressed |
| | | - 4058 tests passing |
| | | - Delete safety implemented |
| | | - Staff management complete |
| | | - Load testing validated |
| | | - CI/CD pipeline enhanced |

---

*Generated: ${new Date().toISOString()}*
