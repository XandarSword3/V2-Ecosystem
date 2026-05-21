# Tools

Utility tools for development and testing.

## Contents

| File/Directory | Purpose |
|---------------|---------|
| `apply-sql.js` | Execute raw SQL against Supabase |
| `apply-sql.ts` | TypeScript version of SQL executor |
| `translation-audit.js` | Audit translation files for completeness |
| `translation-audit-results.json` | Cached translation audit results |
| `stress-test/` | Load testing framework (38 files) |

## Stress Test Suite

Located in `stress-test/`, this is a custom load testing framework that simulates concurrent users interacting with the API.

### Running Stress Tests

```bash
# From v2-ecosystem root:
npm run stress-test              # Full stress test
npm run stress-test:quick        # Quick run (5 customers, 60s)
npm run stress-test:medium       # Medium run (25 customers, 300s)
```

Configuration is done via CLI flags: `--customers`, `--staff`, `--trainees`, `--admins`, `--duration`.
