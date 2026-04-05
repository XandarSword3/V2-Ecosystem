# Backend Source (`src/`)

Entry point for the Express.js backend application.

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Server bootstrap — starts HTTP server, initializes Socket.IO |
| `app.ts` | Express app setup — mounts all middleware, routes, and error handlers |
| `constants.ts` | Shared constants used across modules |

## Subdirectories

| Directory | Count | Purpose |
|-----------|-------|---------|
| `modules/` | 38 modules | Feature modules (auth, restaurant, pool, loyalty, etc.) |
| `services/` | 33 services | Cross-cutting services (email, SMS, payments, backup, etc.) |
| `middleware/` | 20 files | Request pipeline (auth, CSRF, rate-limit, security, validation) |
| `engines/` | 11 files | Business logic engines (pricing, state machine, feature flags) |
| `routes/` | 6 files | Standalone routes (terminology, translations, docs, generic, unsubscribe) |
| `database/` | 113 items | Connection management, migrations, seeds |
| `config/` | 10 files | Environment and app configuration |
| `lib/` | 95 items | Shared libraries (cache, logging, error handling) |
| `repositories/` | 11 files | Data access layer for Supabase |
| `controllers/` | 1 file | Shared controller logic |
| `scripts/` | 34 items | Utility scripts (keep-alive, maintenance) |
| `security/` | 1 file | Security utilities |
| `socket/` | 3 files | WebSocket event handlers |
| `types/` | 3 files | Shared TypeScript type definitions |
| `utils/` | 11 files | Helper utilities (logger, sentry, etc.) |
| `validation/` | 1 file | Shared validation schemas |
| `docs/` | 4 files | Internal API documentation |
