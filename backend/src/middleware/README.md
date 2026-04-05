# Backend Middleware

20 middleware files forming the Express request pipeline.

## Middleware Inventory

| Middleware | Purpose |
|------------|---------|
| `api-security.middleware.ts` | API security headers and protections |
| `async-handler.ts` | Async error wrapper for Express route handlers |
| `auth.middleware.ts` | JWT authentication and `authorize()` role check |
| `correlation-id.middleware.ts` | Request correlation ID propagation |
| `csrf.middleware.ts` | CSRF protection for state-changing requests |
| `deviceAuth.middleware.ts` | Device-specific authentication |
| `legacy-routes.middleware.ts` | Legacy route redirects |
| `moduleGuard.middleware.ts` | Module-level access control |
| `monitoring.middleware.ts` | Request/response monitoring and metrics |
| `normalizeBody.middleware.ts` | Request body normalization |
| `permission.middleware.ts` | Fine-grained permission checking |
| `propertyAccess.middleware.ts` | Multi-property access control |
| `rateLimit.middleware.ts` | Express rate limiting wrapper |
| `requestId.middleware.ts` | Unique request ID generation |
| `requestLogger.middleware.ts` | Structured request logging |
| `roleGuard.middleware.ts` | Role-based access guard |
| `security-headers.middleware.ts` | Security response headers (CSP, HSTS, etc.) |
| `security.middleware.ts` | XSS sanitization and input security |
| `userRateLimit.middleware.ts` | Per-user rate limiting |
| `validation.middleware.ts` | Zod-based request validation |

## Applied in app.ts

The following middleware is applied globally (in order):
1. Sentry request handler
2. Helmet (security headers)
3. CORS
4. Compression
5. Cookie parser
6. JSON/URL body parsers (10mb limit)
7. CSRF protection
8. Morgan logging (non-test only)
