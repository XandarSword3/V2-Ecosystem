# Rate Limiting Audit Report

## Executive Summary

The V2 Resort backend implements a comprehensive multi-layer rate limiting strategy to protect against abuse and ensure fair access to resources.

## Rate Limiting Architecture

### Layer 1: Global IP-Based Rate Limiting
**File:** `app.ts` (lines 789-795)

```typescript
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,    // Default: 1 minute
  maxRequests: config.rateLimit.maxRequests, // Default: 1000/minute
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);
```

**Configuration via ENV:**
- `RATE_LIMIT_WINDOW_MS` - Time window (default: 60000ms = 1 minute)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 1000)

### Layer 2: Authentication Endpoint Protection
**File:** `app.ts` (lines 798-815)

Protected endpoints:
- `POST /api/auth/login` - 10 requests per 15 minutes
- `POST /api/auth/register` - 10 requests per 15 minutes
- `POST /api/auth/forgot-password` - 10 requests per 15 minutes
- `POST /api/auth/refresh` - 10 requests per 15 minutes
- `POST /api/auth/reset-password` - 10 requests per 15 minutes

Features:
- Skips successful requests (won't count valid logins)
- Skips test requests (`X-Integration-Test: true` header)
- Returns standard 429 with descriptive error

### Layer 3: User-Based Rate Limiting
**File:** `middleware/userRateLimit.middleware.ts`

Provides per-user rate limiting for authenticated requests with Redis-backed distributed tracking.

**Preset Limiters:**

| Preset | Window | Max Requests | Use Case |
|--------|--------|--------------|----------|
| `standard` | 15 min | 100 | General API access |
| `expensive` | 1 hour | 10 | Reports, exports |
| `sensitive` | 1 hour | 5 | Password changes |
| `write` | 1 min | 30 | Orders, bookings |

### Layer 4: Per-Endpoint Rate Limiting

**Restaurant Orders:**
- `POST /api/restaurant/orders` - Uses `rateLimits.write`

**Chalet Bookings:**
- `POST /api/chalets/bookings` - Uses `rateLimits.write`
- `POST /api/chalets/bookings/:id/cancel` - Uses `rateLimits.write`

**Pool Tickets:**
- `POST /api/pool/tickets` - Uses `rateLimits.write`

## Public Endpoints (No Auth Required)

All public endpoints are protected by the global IP-based rate limiter (Layer 1).

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/restaurant/menu` | GET | Menu browsing |
| `/api/restaurant/menu/categories` | GET | Category list |
| `/api/restaurant/menu/items` | GET | Item list |
| `/api/chalets` | GET | Chalet list |
| `/api/chalets/:id` | GET | Chalet details |
| `/api/chalets/:id/availability` | GET | Availability check |
| `/api/pool/sessions` | GET | Session list |
| `/api/pool/availability` | GET | Availability check |
| `/api/reviews` | GET | Approved reviews |
| `/api/support/faq` | GET | FAQ list |
| `/health` | GET | Health check (no rate limit) |

## Response Headers

All rate-limited endpoints return:
```
X-RateLimit-Limit: <max_requests>
X-RateLimit-Remaining: <remaining>
X-RateLimit-Reset: <unix_timestamp>
```

On 429 response:
```
Retry-After: <seconds>
```

## Recommendations

### ✅ Current Implementation Strengths
1. Multi-layer defense (IP + User + Endpoint)
2. Distributed rate limiting via Redis
3. Graceful fallback when Redis unavailable
4. Test mode exceptions for CI/CD
5. Successful request skip for auth endpoints

### 🔄 Potential Improvements (Future)
1. **Sliding window** - Consider sliding window instead of fixed for smoother limits
2. **Dynamic limits** - Adjust based on user tier (premium vs. standard)
3. **DDoS protection** - Add CDN-level rate limiting (Cloudflare/Vercel Edge)
4. **API key limits** - Separate limits for API key vs. session auth

## Testing Rate Limits

```bash
# Test global rate limit
for i in {1..1001}; do curl -s http://localhost:3005/api/restaurant/menu > /dev/null; done

# Test auth rate limit
for i in {1..11}; do curl -X POST http://localhost:3005/api/auth/login -d '{"email":"x","password":"y"}'; done
```

## Audit Conclusion

**Status: ✅ PASSING**

The rate limiting implementation is production-ready with:
- Global protection on all API endpoints
- Enhanced protection on authentication endpoints
- User-based protection on financial operations
- Appropriate response codes and headers
- Test mode compatibility

---
*Generated: ${new Date().toISOString()}*
