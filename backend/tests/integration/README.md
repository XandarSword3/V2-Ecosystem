# Backend Integration Tests

Integration tests validate API behavior with real dependency wiring.

## Runner

1. Command: npm run test:integration
2. Config file: backend/vitest.integration.config.ts
3. Setup file: backend/tests/integration/setup.ts

## Required Environment Variables

1. DATABASE_URL
2. SUPABASE_URL
3. SUPABASE_SERVICE_KEY
4. SUPABASE_ANON_KEY
5. JWT_SECRET

## Dependency Expectations

By default, integration setup expects:

1. PostgreSQL at port 5433 (v2ecosystem_test database profile)
2. Redis at port 6380
3. Reachable test API URL (defaults to `http://localhost:3006/api/v1`)

## Local Dependency Bootstrap

```bash
# From backend/
docker-compose -f docker-compose.test.yml up -d
npm run test:integration
docker-compose -f docker-compose.test.yml down -v
```

## CI Dependency Bootstrap

CI now provisions explicit service containers in the backend-integration job:

1. Postgres 15 (postgres:15-alpine)
2. Redis 7 (redis:7-alpine)

with ports aligned to setup defaults:

1. 5433:5432 for Postgres
2. 6380:6379 for Redis

## Notes

1. setup.ts performs lifecycle coordination, optional migration/seed, and cleanup.
2. setup.ts now filters only known non-actionable warning noise while preserving real failures.
