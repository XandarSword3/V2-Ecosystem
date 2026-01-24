# V2 Resort - Technical Handoff Documentation

## System Handover for Development & Operations Teams

**Document Version:** 1.0  
**Created:** 2024-01-XX  
**Authors:** Development Team

---

## Executive Summary

This document provides a comprehensive handoff of the V2 Resort platform to the ongoing development and operations teams. It covers architecture decisions, operational procedures, known issues, and recommended improvements.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Infrastructure Details](#2-infrastructure-details)
3. [Codebase Guide](#3-codebase-guide)
4. [Database Schema](#4-database-schema)
5. [Third-Party Integrations](#5-third-party-integrations)
6. [Deployment Process](#6-deployment-process)
7. [Monitoring & Alerting](#7-monitoring--alerting)
8. [Security Considerations](#8-security-considerations)
9. [Known Issues & Tech Debt](#9-known-issues--tech-debt)
10. [Recommended Improvements](#10-recommended-improvements)
11. [Access & Credentials](#11-access--credentials)
12. [Support & Contacts](#12-support--contacts)

---

## 1. Architecture Overview

### High-Level Architecture

```
                                    ┌─────────────────────────────────┐
                                    │          CloudFlare             │
                                    │        (CDN / WAF)              │
                                    └───────────────┬─────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    │                               │                               │
                    ▼                               ▼                               ▼
          ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
          │    Frontend     │           │     Backend     │           │   Mobile App    │
          │  (Next.js 14)   │           │  (Express.js)   │           │ (React Native)  │
          │    Vercel       │           │    Render       │           │                 │
          └─────────────────┘           └────────┬────────┘           └────────┬────────┘
                                                 │                             │
                                                 │                             │
                    ┌────────────────────────────┼─────────────────────────────┤
                    │                            │                             │
                    ▼                            ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
          │    Supabase     │           │      Redis      │           │    SendGrid     │
          │  (PostgreSQL)   │           │    (Upstash)    │           │    (Email)      │
          └─────────────────┘           └─────────────────┘           └─────────────────┘
                    │
                    │
          ┌─────────────────┐
          │     Stripe      │
          │   (Payments)    │
          └─────────────────┘
```

### Key Architectural Decisions

#### 1. Monorepo Structure
**Decision:** Single repository with separate packages for backend, frontend, mobile, and shared code.

**Rationale:**
- Easier code sharing (shared types, utilities)
- Unified versioning
- Simplified CI/CD

**Trade-offs:**
- Larger repository size
- All teams work in same repo

#### 2. Supabase as Database
**Decision:** Using Supabase (managed PostgreSQL) instead of self-hosted database.

**Rationale:**
- Reduced operational overhead
- Built-in authentication features
- Real-time subscriptions available
- Row-level security

**Trade-offs:**
- Vendor lock-in
- Cost scales with usage
- Limited control over PostgreSQL version

#### 3. Vercel + Render Split
**Decision:** Frontend on Vercel, Backend on Render.

**Rationale:**
- Vercel optimized for Next.js
- Render provides better long-running process support
- Cost optimization

#### 4. Socket.io for Real-time
**Decision:** Socket.io instead of Supabase Realtime.

**Rationale:**
- More control over real-time logic
- Better mobile support
- Custom event handling

---

## 2. Infrastructure Details

### Environments

| Environment | Frontend URL | Backend URL | Database |
|-------------|-------------|-------------|----------|
| Production | v2resort.com | api.v2resort.com | Supabase (prod) |
| Staging | staging.v2resort.com | staging-api.v2resort.com | Supabase (staging) |
| Development | localhost:3000 | localhost:3001 | Local PostgreSQL |

### Service Specifications

#### Frontend (Vercel)
```
Plan: Pro
Region: Frankfurt (fra1)
Framework: Next.js 14
Node Version: 20.x
Build Command: npm run build
Output Directory: .next
```

#### Backend (Render)
```
Plan: Standard
Region: Frankfurt
Runtime: Node 20
Memory: 2GB
CPU: 1
Health Check: /health
Auto-deploy: On push to main
```

#### Database (Supabase)
```
Plan: Pro
Region: eu-central-1
PostgreSQL Version: 15
Connection Pooling: Enabled (port 6543)
Max Connections: 100
Backup Retention: 7 days
Point-in-time Recovery: Enabled
```

#### Redis (Upstash)
```
Plan: Pay-as-you-go
Region: eu-west-1
Max Memory: 256MB
Eviction: volatile-lru
```

### DNS Configuration

```
# CloudFlare DNS Records
v2resort.com        A      [Vercel IP]
www.v2resort.com    CNAME  cname.vercel-dns.com
api.v2resort.com    CNAME  [Render hostname]
```

---

## 3. Codebase Guide

### Repository Structure

```
v2-resort/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models (if any)
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   ├── types/          # TypeScript types
│   │   ├── app.ts          # Express app setup
│   │   └── server.ts       # Server entry point
│   ├── tests/              # Test files
│   └── package.json
│
├── frontend/               # Next.js web application
│   ├── src/
│   │   ├── app/           # Next.js 14 app router
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Library code
│   │   ├── services/      # API client services
│   │   ├── store/         # Zustand stores
│   │   ├── styles/        # Global styles
│   │   └── types/         # TypeScript types
│   ├── messages/          # i18n translations
│   ├── public/            # Static assets
│   └── package.json
│
├── mobile/                 # React Native mobile app
│   ├── app/               # Expo Router screens
│   ├── src/
│   │   ├── components/    # React Native components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API services
│   │   └── store/         # State management
│   └── package.json
│
├── shared/                 # Shared code (types, utilities)
│   └── types/
│
└── supabase/              # Database migrations
    └── migrations/
```

### Key Files Reference

| File | Purpose |
|------|---------|
| `backend/src/app.ts` | Express app configuration |
| `backend/src/routes/index.ts` | API route registration |
| `frontend/src/app/layout.tsx` | Root layout |
| `frontend/src/lib/api.ts` | API client |
| `mobile/app/_layout.tsx` | Mobile root layout |
| `supabase/migrations/` | Database schema |

### Coding Conventions

**TypeScript:**
- Strict mode enabled
- Explicit return types on public functions
- Interface over Type when possible

**React/Next.js:**
- Functional components only
- Custom hooks for shared logic
- Server components by default

**API Design:**
- RESTful conventions
- Consistent error responses
- Request validation with Zod

### Build Commands

```bash
# Backend
cd backend
npm run build        # TypeScript compilation
npm run dev          # Development with hot reload
npm run test         # Run tests
npm run lint         # ESLint

# Frontend
cd frontend
npm run build        # Production build
npm run dev          # Development server
npm run test         # Run tests
npm run lint         # ESLint

# Mobile
cd mobile
npm run start        # Expo development
npm run android      # Android build
npm run ios          # iOS build
```

---

## 4. Database Schema

### Core Tables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  users ─────────────┬───────────────────┐                                   │
│    │                │                   │                                   │
│    ▼                ▼                   ▼                                   │
│  bookings        orders            pool_tickets                             │
│    │                │                   │                                   │
│    │                ▼                   │                                   │
│    │            order_items             │                                   │
│    │                                    │                                   │
│    └──────────────▶ payments ◀──────────┘                                   │
│                                                                              │
│  rooms ──────────▶ bookings                                                  │
│                                                                              │
│  menu_items ─────▶ order_items                                              │
│                                                                              │
│  categories ─────▶ menu_items                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Important Tables

**users:**
- Primary user table
- Links to all user activities
- Contains auth metadata

**bookings:**
- Room reservations
- Status workflow: pending → confirmed → checked_in → checked_out → cancelled

**orders:**
- Food/beverage orders
- Status workflow: pending → preparing → ready → delivered → cancelled

**payments:**
- All payment records
- Links to Stripe payment intents

### Row Level Security (RLS)

All tables have RLS enabled:
- Users can only see their own data
- Staff roles have elevated access
- Admin has full access

### Migration Process

```bash
# Create new migration
supabase migration new <name>

# Apply migrations
supabase db push

# Reset database (CAUTION: destroys data)
supabase db reset
```

---

## 5. Third-Party Integrations

### Stripe (Payments)

**Dashboard:** https://dashboard.stripe.com

**Webhooks configured:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

**Test Cards:**
```
Success: 4242424242424242
Decline: 4000000000000002
3DS Required: 4000000000003220
```

### SendGrid (Email)

**Dashboard:** https://app.sendgrid.com

**Templates configured:**
- Booking confirmation
- Order confirmation
- Password reset
- Welcome email

**Important:** Sender authentication configured for v2resort.com

### Supabase (Database & Auth)

**Dashboard:** https://app.supabase.com

**Auth providers enabled:**
- Email/password
- Google OAuth
- Apple OAuth

### Sentry (Error Tracking)

**Dashboard:** https://sentry.io

**Projects:**
- v2-resort-frontend
- v2-resort-backend
- v2-resort-mobile

---

## 6. Deployment Process

### Automated Deployments

**Frontend (Vercel):**
```
Push to main → Vercel build → Deploy to production
Push to develop → Vercel build → Deploy to staging
```

**Backend (Render):**
```
Push to main → Render build → Deploy to production
```

### Manual Deployment

```bash
# Frontend (if needed)
cd frontend
vercel --prod

# Backend (via Render dashboard)
# Trigger deploy from Render dashboard
```

### Database Migrations

```bash
# 1. Test migration on staging
supabase db push --db-url=$STAGING_DATABASE_URL

# 2. Verify staging works

# 3. Apply to production
supabase db push --db-url=$PRODUCTION_DATABASE_URL
```

### Rollback Procedures

**Frontend:**
1. Go to Vercel dashboard
2. Find previous deployment
3. Promote to production

**Backend:**
1. Go to Render dashboard
2. Find previous deploy
3. Manual deploy previous commit

**Database:**
- Use Supabase PITR (point-in-time recovery)
- Contact Supabase support for restoration

---

## 7. Monitoring & Alerting

### Uptime Monitoring

**Tool:** Better Uptime / UptimeRobot

**Endpoints monitored:**
- `https://v2resort.com` (5 min interval)
- `https://api.v2resort.com/health` (1 min interval)

### Error Tracking

**Tool:** Sentry

**Alert rules:**
- P1: Error spike > 100/hour → PagerDuty
- P2: New error type → Slack #alerts
- P3: High error rate → Daily digest

### Performance Monitoring

**Tool:** Vercel Analytics (frontend), Custom metrics (backend)

**Key metrics:**
- Page load time
- API response time
- Database query time

### Log Access

**Frontend logs:** Vercel dashboard → Logs
**Backend logs:** Render dashboard → Logs
**Database logs:** Supabase dashboard → Logs

---

## 8. Security Considerations

### Authentication

- JWT tokens with 1-hour expiry
- Refresh tokens stored in httpOnly cookies
- Session invalidation on password change

### API Security

- Rate limiting: 100 req/min per IP
- CORS restricted to known domains
- Input validation on all endpoints
- SQL injection protection via Supabase

### Data Protection

- PII encrypted at rest (Supabase default)
- HTTPS enforced everywhere
- GDPR compliance features implemented

### Secret Management

- Production secrets in environment variables
- No secrets in code repository
- Secrets rotated quarterly

### Vulnerability Scanning

- Dependabot enabled for dependency updates
- Regular npm audit checks

---

## 9. Known Issues & Tech Debt

### Critical

| Issue | Description | Workaround | Priority |
|-------|-------------|------------|----------|
| - | No critical issues at launch | - | - |

### High Priority

| Issue | Description | Workaround | Effort |
|-------|-------------|------------|--------|
| N+1 queries in orders list | Loading order items causes multiple queries | Use with limit, implement pagination | Medium |
| Socket reconnection on mobile | Occasional disconnect on network switch | Auto-reconnect logic exists but not optimal | Medium |

### Tech Debt

| Item | Description | Recommended Action |
|------|-------------|-------------------|
| Test coverage | Backend at 70%, should be 80%+ | Add more integration tests |
| Component documentation | Many components lack JSDoc | Add Storybook documentation |
| API versioning | No versioning in place | Implement /v1/ prefix |
| Logging standardization | Inconsistent log formats | Implement structured logging |

### Future Considerations

1. **Caching strategy** - Consider Redis caching for menu, rooms
2. **Search** - Consider Algolia/Elasticsearch for search functionality
3. **CDN for images** - Currently using Supabase storage, consider Cloudinary
4. **Queue system** - Consider BullMQ for background jobs

---

## 10. Recommended Improvements

### Short-term (1-3 months)

1. **Implement API rate limiting per user**
   - Currently only IP-based
   - Prevents abuse by authenticated users

2. **Add comprehensive logging**
   - Structured JSON logs
   - Request tracing IDs
   - Log aggregation (Datadog/LogDNA)

3. **Improve error messages**
   - User-friendly error messages
   - Error codes for debugging

### Medium-term (3-6 months)

1. **GraphQL API**
   - Mobile app would benefit
   - Reduces over-fetching

2. **Admin dashboard improvements**
   - Real-time updates
   - Better reporting
   - Bulk operations

3. **Performance optimization**
   - Database query optimization
   - Implement caching layer
   - Image optimization

### Long-term (6-12 months)

1. **Multi-property support**
   - Schema changes needed
   - Tenant isolation

2. **Advanced analytics**
   - Business intelligence
   - Revenue forecasting

3. **Mobile app native features**
   - Push notifications
   - Offline mode

---

## 11. Access & Credentials

### Development Accounts

**Note:** All credentials should be stored in a secure password manager (e.g., 1Password, Bitwarden)

| Service | Access Level | Stored In |
|---------|-------------|-----------|
| Vercel | Admin | Password Manager |
| Render | Admin | Password Manager |
| Supabase | Owner | Password Manager |
| Stripe | Admin | Password Manager |
| SendGrid | Admin | Password Manager |
| Sentry | Admin | Password Manager |
| CloudFlare | Admin | Password Manager |
| GitHub | Admin | Password Manager |

### API Keys Location

All production API keys are stored as environment variables in:
- Vercel (frontend)
- Render (backend)

**Never** store API keys in:
- Code repository
- Shared documents
- Chat messages

### Rotating Credentials

Schedule for credential rotation:
- API keys: Every 90 days
- Service accounts: Every 90 days
- User passwords: Per policy

---

## 12. Support & Contacts

### Development Team

| Role | Name | Email | Availability |
|------|------|-------|--------------|
| Lead Developer | TBD | | |
| Backend Developer | TBD | | |
| Frontend Developer | TBD | | |
| Mobile Developer | TBD | | |

### Vendor Support

| Service | Support Channel | SLA |
|---------|----------------|-----|
| Vercel | support@vercel.com | 24hr response |
| Render | support@render.com | 24hr response |
| Supabase | support@supabase.io | Priority support |
| Stripe | dashboard support | 24hr response |
| SendGrid | support@sendgrid.com | 24hr response |

### Escalation Path

```
Developer → Tech Lead → CTO → Vendor Support
```

---

## Appendix A: Environment Variables

### Backend

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# Auth
JWT_SECRET=xxx
JWT_EXPIRES_IN=1h

# Redis
REDIS_URL=redis://...

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# SendGrid
SENDGRID_API_KEY=SG.xxx

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Frontend

```env
NEXT_PUBLIC_API_URL=https://api.v2resort.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Appendix B: Useful Commands

```bash
# Check service health
curl https://api.v2resort.com/health

# View backend logs (Render CLI)
render logs -s v2-resort-backend

# Database CLI
supabase db remote commit
supabase migration list

# Run tests
cd backend && npm test
cd frontend && npm test

# Generate types from database
supabase gen types typescript --local > shared/types/database.ts
```

---

## Document Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Outgoing Lead | | | |
| Incoming Lead | | | |
| CTO | | | |

---

*This document should be kept up to date as the system evolves. Last review: [Date]*
