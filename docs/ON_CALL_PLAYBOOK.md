# V2 Resort - On-Call Playbook

## Quick Reference

### Emergency Contacts

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| Primary On-Call | PagerDuty Alert | Immediate |
| Secondary On-Call | PagerDuty Escalation | 10 minutes |
| Engineering Lead | Phone/Slack | 15 minutes |
| CTO | Phone | 30 minutes (P1/P2 only) |

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P1 - Critical | Complete outage, data loss risk | 15 minutes | Database down, security breach |
| P2 - High | Major feature broken, payment issues | 30 minutes | Stripe integration down |
| P3 - Medium | Degraded performance, partial outage | 2 hours | Slow API responses |
| P4 - Low | Minor issues, cosmetic bugs | Next business day | UI glitches |

---

## 1. Receiving an Alert

### Step 1: Acknowledge
1. **Acknowledge the alert** in PagerDuty within 5 minutes
2. **Join the incident Slack channel**: `#incident-response`
3. **Start the incident timer**

### Step 2: Initial Assessment (5 minutes)

```
□ What service is affected?
□ What is the user impact?
□ When did it start?
□ Are there any obvious changes (deployments, config changes)?
□ Is this a known issue?
```

### Step 3: Communicate
Post initial update in Slack:
```
🔴 INVESTIGATING: [Service Name]
Impact: [Description of user impact]
Started: [Time]
Investigating: [Your name]
Next update: [Time + 15 mins]
```

---

## 2. Common Scenarios

### 2.1 API Errors (5xx)

**Symptoms:**
- High 500 error rate
- Timeouts
- Health check failures

**Diagnosis:**
```bash
# Check API health
curl -s https://api.v2resort.com/health | jq .

# Check recent logs
# Via logging dashboard or:
heroku logs --tail --app v2resort-api  # if Heroku
vercel logs v2resort-api               # if Vercel

# Check database connection
# Via Supabase dashboard

# Check Redis
redis-cli -h [host] ping
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Database connection exhausted | Restart API pods/instances |
| Memory leak | Rolling restart |
| Bad deployment | Rollback to previous version |
| Dependency failure | Check external services |

**Rollback Command:**
```bash
# Vercel
vercel rollback

# Or specific deployment
vercel rollback [deployment-url]

# Git-based rollback
git revert HEAD
git push origin main
```

### 2.2 Database Issues

**Symptoms:**
- Connection timeouts
- Slow queries
- "too many connections" errors

**Diagnosis:**
```bash
# Check connection count (via Supabase SQL Editor)
SELECT count(*) FROM pg_stat_activity;

# Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

# Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

**Actions:**
1. **High connections**: Restart application to release connections
2. **Locked queries**: Identify and terminate blocking query
3. **Slow queries**: Check for missing indexes, consider query optimization

**Kill Blocking Query:**
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active' AND query LIKE '%blocking_query%';
```

### 2.3 Payment Failures

**Symptoms:**
- Customers can't complete payments
- Stripe webhook errors
- Payment confirmation delays

**Diagnosis:**
```bash
# Check Stripe Dashboard
# 1. Go to https://dashboard.stripe.com
# 2. Check Webhooks section for failed deliveries
# 3. Check Events for recent errors

# Check webhook endpoint status
curl -s https://api.v2resort.com/webhooks/stripe/status
```

**Actions:**
1. **Webhook failures**: Check endpoint health, retry failed webhooks
2. **API key issues**: Verify keys haven't expired
3. **Rate limiting**: Contact Stripe support

**Manual Webhook Retry:**
```bash
# From Stripe Dashboard:
# Webhooks > [endpoint] > Attempted Events > Retry
```

### 2.4 Authentication Issues

**Symptoms:**
- Users can't log in
- "Invalid token" errors
- Session expiration issues

**Diagnosis:**
```bash
# Check Supabase Auth status
curl -s https://[project].supabase.co/auth/v1/health

# Check JWT expiration settings
# Via Supabase Dashboard > Authentication > Settings
```

**Actions:**
1. **Token validation fails**: Check JWT secret hasn't changed
2. **Mass logout**: Check if secrets were rotated
3. **Provider issues**: Check OAuth providers (Google, Apple)

### 2.5 High Latency

**Symptoms:**
- Slow page loads
- API response times > 2 seconds
- User complaints

**Diagnosis:**
```bash
# Check CDN status
curl -I https://v2resort.com | grep cf-ray

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.v2resort.com/health

# Check database query times
# Via Supabase Dashboard > Database > Query Performance
```

**Actions:**
1. **CDN issues**: Check Cloudflare status page
2. **Database slow**: Check for expensive queries, add indexes
3. **API slow**: Check for N+1 queries, add caching

---

## 3. Escalation Procedures

### When to Escalate

**Escalate Immediately (P1):**
- Data breach or security incident
- Complete service outage > 5 minutes
- Data loss or corruption
- Payment processing completely down

**Escalate After 30 Minutes:**
- Unable to diagnose root cause
- Fix attempt unsuccessful
- Issue affects >50% of users

### How to Escalate

1. **PagerDuty**: Use the escalation button
2. **Phone**: Call the next person in rotation
3. **Slack**: Tag @engineering-lead or @cto

**Escalation Message Template:**
```
🚨 ESCALATION NEEDED

Incident: [Description]
Duration: [Time since start]
Impact: [Number of users/transactions affected]
Attempted: [What you've tried]
Need: [What help you need]

Join: #incident-response
```

---

## 4. Post-Incident

### Immediate (Within 1 Hour)

1. **Verify resolution**: Confirm all systems normal
2. **Update status page**: Mark incident resolved
3. **Notify stakeholders**: Brief summary to team
4. **Document timeline**: Note all actions taken

### Follow-up (Within 24 Hours)

1. **Create incident ticket**: Document in issue tracker
2. **Identify action items**: What can prevent recurrence?
3. **Schedule blameless post-mortem**: For P1/P2 incidents

### Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

## Summary
Brief description of what happened.

## Timeline
- HH:MM - First alert received
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

## Root Cause
Detailed explanation of why this happened.

## Impact
- Duration: X hours Y minutes
- Users affected: N
- Revenue impact: $X (if applicable)

## What Went Well
- Quick detection
- Effective communication
- etc.

## What Could Be Improved
- Monitoring gaps
- Runbook updates needed
- etc.

## Action Items
- [ ] Action 1 (Owner, Due Date)
- [ ] Action 2 (Owner, Due Date)
```

---

## 5. Useful Commands

### Quick Health Checks

```bash
# All-in-one health check
./scripts/health-check.sh

# API status
curl -s https://api.v2resort.com/health | jq .

# Database status
# Via Supabase Dashboard

# Redis status
redis-cli -h $REDIS_HOST ping

# CDN status
curl -I https://v2resort.com 2>&1 | grep -E 'HTTP|cf-ray'
```

### Log Searching

```bash
# Search for errors in logs (Vercel)
vercel logs --since 1h | grep -i error

# Search for specific user
vercel logs --since 1h | grep "user_id_here"

# Search for specific endpoint
vercel logs --since 1h | grep "POST /api/bookings"
```

### Database Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Recent errors (if error logging enabled)
SELECT * FROM system_logs 
WHERE level = 'error' 
ORDER BY created_at DESC 
LIMIT 50;

-- Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```

### Emergency Commands

```bash
# Emergency rollback
vercel rollback

# Kill all connections (DANGER)
# Via Supabase SQL Editor:
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'postgres' AND pid <> pg_backend_pid();

# Clear Redis cache
redis-cli -h $REDIS_HOST FLUSHALL

# Rotate secrets (requires coordination)
./scripts/rotate-secrets.sh
```

---

## 6. Contact Information

### Internal
- **Slack**: `#incident-response`, `#engineering`
- **PagerDuty**: https://v2resort.pagerduty.com
- **Status Page Admin**: https://status.v2resort.com/admin

### External Services
- **Supabase Status**: https://status.supabase.com
- **Stripe Status**: https://status.stripe.com
- **Vercel Status**: https://vercel-status.com
- **Cloudflare Status**: https://cloudflarestatus.com
- **SendGrid Status**: https://status.sendgrid.com

### Support Contacts
- **Supabase**: support@supabase.com
- **Stripe**: https://support.stripe.com
- **Vercel**: support@vercel.com

---

## 7. Handoff Checklist

When your on-call shift ends:

```
□ No active incidents
□ All alerts acknowledged
□ Pending issues documented
□ Brief next on-call person
□ Update any runbooks based on learnings
```

**Handoff Message Template:**
```
On-Call Handoff 🔄

Outgoing: [Your Name]
Incoming: [Next Person]

Active Issues: [None / List]
Resolved Today: [List any incidents]
Things to Watch: [Any concerns]
Notes: [Anything unusual]
```
