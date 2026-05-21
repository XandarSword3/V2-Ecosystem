# Stress Test Framework

Custom load testing tool that simulates concurrent users interacting with the V2 Ecosystem API.

## Contents (38 files)

Configuration, user simulators, and test scenarios for:
- Customer flows (browsing, ordering, booking)
- Staff operations (order management, housekeeping)
- Admin activities (dashboard, settings)
- Concurrent session handling

## Commands

```bash
# From v2-ecosystem root:
npm run stress-test              # Full test
npm run stress-test:quick        # 5 customers, 60s
npm run stress-test:medium       # 25 customers, 300s

# Direct invocation with custom params:
npx ts-node tools/stress-test/run.ts --customers 50 --staff 15 --trainees 5 --admins 3 --duration 600
```

## Status

Stress tests require a running backend instance. Not run during this audit session — status is **UNTESTED**.
