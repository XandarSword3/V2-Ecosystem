# V2 Resort Deployment Guide

## Overview

This guide covers deploying the V2 Resort Management System to production environments. The system consists of:

- **Frontend**: Next.js 14 application (Vercel recommended)
- **Backend**: Express.js API server (Render, Railway, or AWS)
- **Database**: PostgreSQL via Supabase
- **Mobile**: React Native (Expo EAS Build)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Deployment](#database-deployment)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Mobile App Deployment](#mobile-app-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring Setup](#monitoring-setup)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- [ ] Supabase account (database)
- [ ] Vercel account (frontend hosting)
- [ ] Render/Railway account (backend hosting)
- [ ] Stripe account (payments)
- [ ] SendGrid/AWS SES account (emails)
- [ ] Sentry account (error tracking)
- [ ] Apple Developer account (iOS deployment)
- [ ] Google Play Console account (Android deployment)

### Required Tools
```bash
# Node.js 20+
node --version  # v20.x.x

# npm or pnpm
npm --version   # 10.x.x

# Supabase CLI
npm install -g supabase
supabase --version

# Vercel CLI
npm install -g vercel
vercel --version

# EAS CLI (for mobile)
npm install -g eas-cli
eas --version
```

---

## Environment Setup

### 1. Create Environment Files

**Backend `.env.production`:**
```env
# Server
NODE_ENV=production
PORT=3001
API_URL=https://api.yourdomain.com

# Database
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# JWT
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-token-secret-min-32-chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here
QR_SIGNING_KEY=your-qr-signing-key-here

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com

# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Redis (optional, for session store)
REDIS_URL=redis://xxx

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

**Frontend `.env.production`:**
```env
# API
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# Analytics
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```

---

## Database Deployment

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down:
   - Project URL
   - Anon Key
   - Service Role Key
   - Database connection string

### 2. Run Migrations

```bash
cd v2-resort/supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push

# Verify migrations
supabase db status
```

### 3. Seed Initial Data (Optional)

```bash
# Run seed file
supabase db execute -f ./seed_staff.sql
```

### 4. Configure Row Level Security

Ensure RLS is enabled on all tables:

```sql
-- Enable RLS on all tables (should be done by migrations)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalet_bookings ENABLE ROW LEVEL SECURITY;
-- ... etc
```

### 5. Set Up Database Backups

In Supabase Dashboard:
1. Go to Project Settings → Database
2. Enable Point-in-time Recovery (PITR)
3. Configure backup retention period

---

## Backend Deployment

### Option A: Render

1. **Create Render Account** and connect GitHub repository

2. **Create Web Service**
   - Environment: Docker or Node
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start:prod`
   - Health Check Path: `/health`

3. **Configure Environment Variables**
   - Add all variables from `.env.production`

4. **render.yaml** (Infrastructure as Code):
```yaml
services:
  - type: web
    name: v2-resort-api
    env: node
    plan: standard
    buildCommand: npm ci && npm run build
    startCommand: npm run start:prod
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: v2-resort-db
          property: connectionString
      # Add other env vars...
    autoDeploy: true

databases:
  - name: v2-resort-db
    plan: standard
    databaseName: v2resort
    user: v2resort
```

### Option B: Railway

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   ```

2. **Deploy**
   ```bash
   cd v2-resort/backend
   railway up
   ```

3. **Configure Environment**
   - Use Railway dashboard to add environment variables
   - Set up custom domain

### Option C: Docker (AWS ECS/Kubernetes)

1. **Build Docker Image**
   ```bash
   cd v2-resort/backend
   docker build -t v2-resort-api:latest .
   ```

2. **Push to Registry**
   ```bash
   # AWS ECR
   aws ecr get-login-password | docker login --username AWS --password-stdin xxx.dkr.ecr.region.amazonaws.com
   docker tag v2-resort-api:latest xxx.dkr.ecr.region.amazonaws.com/v2-resort-api:latest
   docker push xxx.dkr.ecr.region.amazonaws.com/v2-resort-api:latest
   ```

3. **Deploy to ECS/EKS**
   - Use AWS Console or Terraform
   - Configure ALB for load balancing
   - Set up auto-scaling

---

## Frontend Deployment

### Vercel Deployment (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login and Link**
   ```bash
   cd v2-resort/frontend
   vercel login
   vercel link
   ```

3. **Configure Project**
   
   **vercel.json:**
   ```json
   {
     "framework": "nextjs",
     "buildCommand": "npm run build",
     "outputDirectory": ".next",
     "regions": ["iad1"],
     "env": {
       "NEXT_PUBLIC_API_URL": "@api_url",
       "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
       "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
       "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "@stripe_pk"
     }
   }
   ```

4. **Add Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_API_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   # ... add all variables
   ```

5. **Deploy**
   ```bash
   # Preview deployment
   vercel
   
   # Production deployment
   vercel --prod
   ```

6. **Configure Custom Domain**
   - Go to Vercel Dashboard → Project → Settings → Domains
   - Add your domain
   - Update DNS records

### Alternative: Self-Hosted

1. **Build**
   ```bash
   cd v2-resort/frontend
   npm ci
   npm run build
   ```

2. **Run with PM2**
   ```bash
   pm2 start npm --name "v2-frontend" -- start
   pm2 save
   ```

3. **Nginx Configuration**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## Mobile App Deployment

### 1. Configure EAS Build

**eas.json:**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "credentialsSource": "remote"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

### 2. Build for Production

```bash
cd v2-resort/mobile

# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production
```

### 3. Submit to Stores

```bash
# Submit to App Store
eas submit --platform ios --profile production

# Submit to Google Play
eas submit --platform android --profile production
```

### 4. Configure Push Notifications

**Android (Firebase):**
1. Create Firebase project
2. Add `google-services.json` to `mobile/android/app/`
3. Configure FCM in Firebase Console

**iOS (APNs):**
1. Configure in Apple Developer Portal
2. Create APNs key
3. Add to EAS credentials

---

## Post-Deployment Verification

### 1. Health Check Script

```bash
#!/bin/bash

API_URL="https://api.yourdomain.com"
FRONTEND_URL="https://yourdomain.com"

echo "Checking API health..."
curl -s "$API_URL/health" | jq .

echo "Checking frontend..."
curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL"

echo "Checking database connection..."
curl -s "$API_URL/health/db" | jq .
```

### 2. Deployment Checklist

- [ ] API health endpoint returns 200
- [ ] Frontend loads without errors
- [ ] Database connections working
- [ ] Stripe webhooks configured
- [ ] Email sending working
- [ ] File uploads working (Supabase Storage)
- [ ] WebSocket connections working
- [ ] SSL certificates valid
- [ ] DNS propagated
- [ ] Error tracking receiving events
- [ ] Analytics tracking

### 3. Smoke Tests

```bash
# Run E2E tests against production
cd v2-resort
PLAYWRIGHT_BASE_URL=https://yourdomain.com npm run test:e2e:smoke
```

---

## Monitoring Setup

### 1. Sentry Error Tracking

Already configured via environment variables. Verify in Sentry dashboard that:
- Errors are being captured
- Source maps are uploaded
- Release tracking is working

### 2. Uptime Monitoring

Use UptimeRobot, Pingdom, or Better Uptime:
- Monitor: `https://api.yourdomain.com/health`
- Monitor: `https://yourdomain.com`
- Alert via email/Slack/SMS

### 3. Application Performance Monitoring

**Sentry Performance:**
```typescript
// Already configured in backend
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.2,
});
```

### 4. Log Management

**Recommended: Logtail/Better Stack**

```typescript
// backend/src/utils/logger.ts
import { Logtail } from '@logtail/node';

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

export const logger = {
  info: (msg: string, meta?: object) => logtail.info(msg, meta),
  error: (msg: string, meta?: object) => logtail.error(msg, meta),
  warn: (msg: string, meta?: object) => logtail.warn(msg, meta),
};
```

### 5. Database Monitoring

In Supabase Dashboard:
- Enable Query Performance Insights
- Set up slow query alerts
- Monitor connection pool usage

---

## Troubleshooting

### Common Issues

#### 1. CORS Errors
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:** Verify CORS configuration in backend:
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(','),
  credentials: true,
}));
```

#### 2. Database Connection Timeout
```
Error: Connection terminated unexpectedly
```

**Solution:** 
- Check DATABASE_URL is correct
- Verify IP is whitelisted in Supabase
- Check connection pool limits

#### 3. Stripe Webhook Failures
```
No signatures found matching the expected signature
```

**Solution:**
- Verify STRIPE_WEBHOOK_SECRET matches
- Ensure raw body is passed to Stripe verification
- Check webhook URL is correct in Stripe Dashboard

#### 4. JWT Token Errors
```
JsonWebTokenError: invalid signature
```

**Solution:**
- Ensure JWT_SECRET is identical across all instances
- Check token hasn't expired
- Verify token format

#### 5. File Upload Failures
```
Error: Storage bucket not found
```

**Solution:**
- Create bucket in Supabase Storage
- Configure bucket policies
- Verify service role key has access

### Emergency Rollback

```bash
# Vercel rollback
vercel rollback

# Render rollback
# Use Render Dashboard → Deploys → Select previous deploy → Rollback

# Database rollback
supabase db reset  # CAUTION: Drops all data
# Or restore from backup in Supabase Dashboard
```

---

## Security Checklist

Before going live:

- [ ] All secrets are in environment variables, not code
- [ ] HTTPS enforced everywhere
- [ ] Database RLS policies verified
- [ ] Rate limiting configured
- [ ] CORS restricted to production domains
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Input validation on all endpoints
- [ ] SQL injection protection verified
- [ ] XSS protection verified
- [ ] File upload validation (type, size)
- [ ] Admin routes properly protected
- [ ] Stripe webhook signatures verified
- [ ] Logs don't contain sensitive data

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error rates in Sentry
- Check uptime status

**Weekly:**
- Review slow query logs
- Check disk usage
- Review security audit logs

**Monthly:**
- Update dependencies
- Review and rotate secrets
- Test backup restoration
- Performance review

### Update Process

```bash
# Backend update
git pull origin main
npm ci
npm run build
npm run test
# Deploy via CI/CD

# Frontend update
git pull origin main
npm ci
npm run build
npm run test
vercel --prod
```

---

*Last updated: January 2025*
