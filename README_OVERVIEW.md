# V2 Resort — Project Layout

Top-level directory for the V2 Resort management platform monorepo.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `backend/` | Express.js REST API (38 modules, 33 services) |
| `frontend/` | Next.js web app (23 route groups) |
| `shared/` | Shared TypeScript types (87 files) |
| `supabase/` | Database migrations (101 SQL files) |
| `tests/` | Playwright E2E tests (42+ specs) |
| `tools/` | Stress testing framework |
| `mobile/` | React Native mobile app |
| `nginx/` | Reverse proxy configuration |
| `docs/` | Project documentation |
| `scripts/` | Build and deployment scripts |
| `reports/` | Generated report files |
| `infrastructure/` | Infrastructure configuration |
| `archive/` | Archived temp/debug files from development |

## Commands

```bash
npm run dev              # Start backend + frontend
npm run dev:backend      # Express on port 3001
npm run dev:frontend     # Next.js on port 3000
npm run build            # Build both
npm run test             # Run all tests
npm run test:backend     # Backend vitest
npm run test:frontend    # Frontend vitest
npm run stress-test      # Load testing
```

See [README.md](README.md) for full documentation.
