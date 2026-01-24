# V2 Resort - Launch Day Runbook

## Launch Execution Guide

**Document Version:** 1.0  
**Last Updated:** 2024-01-XX  
**Target Launch:** Production Release

---

## Pre-Launch Timeline

### T-7 Days: Final Preparation Week

#### Monday (T-7)
- [ ] **10:00** - Launch readiness review meeting
- [ ] **11:00** - Review LAUNCH_CHECKLIST.md scores
- [ ] **14:00** - Identify and assign blockers
- [ ] **EOD** - All critical bugs fixed or documented

#### Tuesday (T-6)
- [ ] **10:00** - Security review sign-off
- [ ] **14:00** - Performance testing final run
- [ ] **16:00** - Review test results

#### Wednesday (T-5)
- [ ] **10:00** - Staging environment final deployment
- [ ] **All day** - Full regression testing on staging
- [ ] **EOD** - Test report generated

#### Thursday (T-4)
- [ ] **10:00** - UAT sign-off from stakeholders
- [ ] **14:00** - Documentation review
- [ ] **16:00** - Go/No-Go decision meeting

#### Friday (T-3)
- [ ] **10:00** - Prepare production deployment package
- [ ] **14:00** - Review rollback procedures
- [ ] **16:00** - Team briefing on launch procedures
- [ ] No deployments to staging after 16:00

#### Weekend (T-2, T-1)
- [ ] Code freeze in effect
- [ ] On-call team monitoring staging
- [ ] Final preparations complete

---

## Launch Day (T-0) Timeline

### Pre-Launch (06:00 - 09:00)

#### 06:00 - Team Assembly
```
Attendees:
- Lead Developer (Required)
- Backend Developer (Required)  
- DevOps Engineer (Required)
- Product Owner (Optional, remote)

Communication Channel: #v2-launch-war-room (Slack)
```

#### 06:15 - Health Check
- [ ] Verify staging still working
- [ ] Check all monitoring dashboards
- [ ] Confirm backup completed last night
- [ ] Review overnight alerts (if any)

#### 06:30 - Pre-deployment Verification
```bash
# Verify current production state
curl -s https://api.v2resort.com/health | jq

# Check database connectivity
# (via Supabase dashboard or admin tools)

# Verify CDN status
curl -I https://v2resort.com | head -20
```

#### 07:00 - Maintenance Mode
- [ ] Enable maintenance page
- [ ] Notify monitoring to expect downtime
- [ ] Confirm maintenance page shows

```bash
# Verify maintenance page
curl -s https://v2resort.com | grep -i "maintenance"
```

### Deployment (09:00 - 11:00)

#### 09:00 - Database Migrations
- [ ] Take final backup before migration
- [ ] Run pending migrations
- [ ] Verify migration success

```sql
-- Check migration status in Supabase
SELECT * FROM _migrations ORDER BY id DESC LIMIT 5;
```

#### 09:30 - Backend Deployment
```bash
# Vercel/Render deployment
# Using platform-specific deployment commands

# Verify deployment
curl -s https://api.v2resort.com/health
```

Expected output:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-XX-XXTXX:XX:XXZ"
}
```

#### 10:00 - Frontend Deployment
```bash
# Vercel deployment (typically automatic)
# Verify deployment at Vercel dashboard

# Test frontend loads
curl -s -o /dev/null -w "%{http_code}" https://v2resort.com
# Expected: 200
```

#### 10:30 - Cache & CDN
- [ ] Purge CDN caches
- [ ] Warm critical caches
- [ ] Verify static assets loading

```bash
# Test critical assets
curl -I https://v2resort.com/images/logo.png
# Check for CF-Cache-Status header
```

### Post-Deployment Verification (11:00 - 13:00)

#### 11:00 - Smoke Tests

**Critical Path 1: User Registration**
1. Navigate to /register
2. Complete registration form
3. Check email received
4. Click verification link
5. Login successfully

**Critical Path 2: Booking Flow**
1. Search available rooms
2. Select room and dates
3. Add guest details
4. Complete payment (test card: 4242424242424242)
5. Receive confirmation email
6. Verify booking in system

**Critical Path 3: Food Ordering**
1. Login as guest
2. Browse menu
3. Add items to cart
4. Place order
5. Verify order appears in kitchen display

**Critical Path 4: Pool Access**
1. Purchase pool ticket
2. Receive QR code
3. Verify ticket in admin panel

#### 11:30 - Integration Checks

```bash
# Verify Stripe webhooks
# Check Stripe dashboard for recent webhook deliveries

# Verify email delivery
# Check SendGrid dashboard for recent emails

# Verify real-time features
# Open two browsers, test Socket.io communication
```

#### 12:00 - Performance Check
- [ ] Page load times acceptable (< 3s)
- [ ] API response times acceptable (< 500ms)
- [ ] No error spikes in Sentry

```bash
# Quick performance test
curl -s -o /dev/null -w "Time: %{time_total}s\n" https://v2resort.com
curl -s -o /dev/null -w "Time: %{time_total}s\n" https://api.v2resort.com/api/menu
```

#### 12:30 - Disable Maintenance Mode
- [ ] Remove maintenance page
- [ ] Verify site accessible
- [ ] Test from mobile device
- [ ] Test from different network

### Launch Announcement (13:00)

#### 13:00 - Internal Announcement
```
To: All Staff
Subject: V2 Resort Platform - Now Live!

Team,

I'm pleased to announce that the V2 Resort platform is now live at:
https://v2resort.com

Key features available:
- Online room booking
- Restaurant ordering
- Pool access tickets

Please report any issues to #v2-support

Thank you!
```

#### 13:30 - External Announcement (if applicable)
- [ ] Social media posts scheduled
- [ ] Website banner updated
- [ ] Email to existing customers (if applicable)

### Monitoring Period (13:00 - 18:00)

#### Continuous Monitoring
Every 30 minutes, check:
- [ ] Error rates in Sentry
- [ ] Response times in monitoring
- [ ] Server resource usage
- [ ] Active user count

#### Issue Response Protocol
```
If error rate > 1%:
1. Investigate immediately
2. If critical: Consider rollback
3. If minor: Document and continue monitoring

If response time > 2s (p95):
1. Check server resources
2. Check database performance
3. Consider scaling up
```

### End of Launch Day (18:00)

#### 18:00 - Launch Retrospective
- [ ] Gather metrics from the day
- [ ] Document issues encountered
- [ ] Note any workarounds applied
- [ ] Update runbook with lessons learned

#### Handoff to On-Call
```
On-call Engineer: [Name]
Contact: [Phone/Slack]

Known Issues:
1. [List any known issues]

Monitoring Focus:
1. Watch error rates
2. Watch response times
3. [Any specific areas]

Escalation:
- P1: Call immediately
- P2: Slack + wait 15 min
- P3: Morning is fine
```

---

## Rollback Procedures

### When to Rollback
- Error rate > 5% for more than 10 minutes
- Payment processing completely failing
- Data corruption detected
- Security vulnerability discovered

### Quick Rollback (< 5 minutes)

#### Frontend Rollback (Vercel)
1. Go to Vercel dashboard
2. Navigate to Deployments
3. Find previous production deployment
4. Click "..." menu → "Promote to Production"

#### Backend Rollback (Render/Vercel)
1. Access deployment platform
2. Navigate to deploy history
3. Promote previous version

### Database Rollback (If Needed)

**WARNING: Only if migration caused data issues**

```sql
-- Check last migration
SELECT * FROM _migrations ORDER BY id DESC LIMIT 1;

-- Supabase point-in-time recovery
-- Contact Supabase support or use dashboard
-- Restore to timestamp before migration
```

### Post-Rollback
1. Notify team immediately
2. Disable new deployments
3. Begin root cause analysis
4. Document the issue
5. Plan fix and re-launch

---

## Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Lead Developer | TBD | | @lead-dev |
| DevOps Engineer | TBD | | @devops |
| Product Owner | TBD | | @product |
| Supabase Support | | | support@supabase.io |
| Stripe Support | | | Stripe Dashboard |
| Vercel Support | | | support@vercel.com |

---

## Useful Commands

### Health Checks
```bash
# Full system health
curl https://api.v2resort.com/health | jq

# Database check (via health endpoint)
curl https://api.v2resort.com/health/db | jq

# Redis check
curl https://api.v2resort.com/health/redis | jq
```

### Log Access
```bash
# Vercel logs
vercel logs --follow

# Check recent errors
# Via Sentry dashboard
```

### Quick Database Queries
```sql
-- Recent bookings
SELECT id, user_id, status, created_at 
FROM bookings 
ORDER BY created_at DESC 
LIMIT 10;

-- Recent orders
SELECT id, user_id, status, total, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- Active sessions
SELECT COUNT(*) FROM user_sessions 
WHERE expires_at > NOW();
```

---

## Post-Launch Week

### Day 1 (T+1)
- [ ] Review overnight metrics
- [ ] Check error rates
- [ ] Address any reported issues
- [ ] Daily standup focused on launch feedback

### Day 2-3 (T+2, T+3)
- [ ] Continue monitoring
- [ ] Address non-critical issues
- [ ] Gather user feedback
- [ ] Performance optimization if needed

### Day 7 (T+7)
- [ ] Launch retrospective meeting
- [ ] Document lessons learned
- [ ] Update procedures based on experience
- [ ] Plan any immediate improvements

---

## Appendix: Checklists

### Pre-Flight Checklist
```
[ ] All tests passing
[ ] No critical Sentry errors in staging
[ ] Performance benchmarks met
[ ] Security scan completed
[ ] Backups verified
[ ] Team briefed
[ ] Rollback tested
[ ] Monitoring configured
```

### Go-Live Checklist
```
[ ] Maintenance mode enabled
[ ] Database backed up
[ ] Migrations run
[ ] Backend deployed
[ ] Frontend deployed
[ ] Caches purged
[ ] Smoke tests passed
[ ] Maintenance mode disabled
[ ] Team notified
```

### Post-Launch Checklist
```
[ ] All smoke tests passing
[ ] Error rates normal
[ ] Response times acceptable
[ ] Users can register
[ ] Users can book
[ ] Payments processing
[ ] Emails sending
[ ] Real-time working
[ ] Mobile working
```
