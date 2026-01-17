# Stress Test Bots

Automated testing bots that simulate real user behavior across the V2 Resort platform.

## Overview

This directory contains stress testing tools that simulate realistic usage patterns:

- **Customer Bot** - Simulates customer journeys (browsing, ordering, booking)
- **Staff Bot** - Simulates staff operations (order processing, check-ins)
- **Admin Bot** - Simulates admin activities (user management, settings)

## Why Stress Testing?

Traditional unit tests verify individual functions. Stress test bots verify:

1. **Real User Flows** - Complete journeys from login to checkout
2. **Concurrent Usage** - Multiple simultaneous users
3. **System Stability** - Performance under load
4. **Integration Points** - API, WebSocket, database together
5. **Edge Cases** - Realistic error conditions

## Directory Structure

```
stress-test/
├── README.md                           # This file
├── config.ts                           # Test configuration
├── orchestrator.ts                     # Bot coordination
├── run.ts                              # Main entry point
├── run-admin-only.ts                   # Admin-focused tests
├── run-comprehensive-admin-test.ts    # Full admin test suite
├── tsconfig.json                       # TypeScript config
├── bots/
│   ├── customer-bot.ts                # Customer behavior
│   ├── staff-bot.ts                   # Staff operations
│   └── admin-bot.ts                   # Admin activities
└── utils/
    ├── api-client.ts                  # HTTP client wrapper
    ├── socket-client.ts               # WebSocket utilities
    └── logger.ts                      # Test logging
```

## Bot Behaviors

### Customer Bot (`customer-bot.ts`)

Simulates typical customer actions:

```
1. Register new account (or login existing)
2. Browse landing page
3. View restaurant menu
4. Add items to cart
5. Proceed to checkout
6. Complete payment
7. Track order status via WebSocket
8. Leave review after completion
```

### Staff Bot (`staff-bot.ts`)

Simulates staff operations:

```
1. Login with staff credentials
2. View kitchen display / dashboard
3. Accept incoming orders
4. Update order status (preparing → ready → delivered)
5. Handle pool check-ins
6. Manage chalet arrivals/departures
```

### Admin Bot (`admin-bot.ts`)

Simulates admin activities:

```
1. Login as super admin
2. View dashboard analytics
3. Manage users (create, update, disable)
4. Configure modules
5. Update system settings
6. View audit logs
7. Generate reports
```

## Running Tests

### All Bots Concurrently

```bash
npm run stress-test
# or
cd tools/stress-test
npx ts-node run.ts
```

### Admin Tests Only

```bash
npm run stress-test:admin
# or
npx ts-node run-admin-only.ts
```

### Comprehensive Admin Suite

```bash
npx ts-node run-comprehensive-admin-test.ts
```

## Configuration

Edit `config.ts` to adjust:

```typescript
export const config = {
  // Backend URL
  apiUrl: 'http://localhost:3001/api',
  socketUrl: 'http://localhost:3001',
  
  // Concurrency
  customerBots: 10,
  staffBots: 3,
  adminBots: 1,
  
  // Timing
  actionDelayMs: 500,    // Delay between actions
  testDurationMs: 60000, // Total test duration
  
  // Credentials
  adminEmail: 'admin@v2resort.com',
  adminPassword: process.env.SEED_ADMIN_PASSWORD || 'admin123',
};
```

## Test Results

Results are saved to JSON files:

```
admin-test-results.json    # Admin bot results
stress-test-results.json   # Full test results
```

Example output:

```json
{
  "timestamp": "2026-01-14T10:30:00Z",
  "duration": 60000,
  "bots": {
    "customer": { "total": 10, "successful": 10, "failed": 0 },
    "staff": { "total": 3, "successful": 3, "failed": 0 },
    "admin": { "total": 1, "successful": 1, "failed": 0 }
  },
  "operations": {
    "ordersCreated": 45,
    "ordersProcessed": 42,
    "bookingsCreated": 15,
    "apiCalls": 1250
  },
  "performance": {
    "avgResponseTime": 120,
    "maxResponseTime": 890,
    "errorRate": 0.02
  }
}
```

## Extending Bots

### Adding New Actions

```typescript
// In bots/customer-bot.ts

async browseModules() {
  const modules = await this.api.get('/modules');
  for (const module of modules.data) {
    await this.delay(500);
    await this.api.get(`/modules/${module.id}`);
    this.log(`Viewed module: ${module.name}`);
  }
}
```

### Adding New Bot Type

1. Create `bots/new-bot.ts`
2. Extend base bot class
3. Implement action methods
4. Register in `orchestrator.ts`
5. Add config options

## Integration with CI/CD

Run stress tests in CI pipeline:

```yaml
# .github/workflows/stress-test.yml
jobs:
  stress-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose up -d
      - name: Wait for ready
        run: sleep 30
      - name: Run stress tests
        run: npm run stress-test
        timeout-minutes: 5
```

## Best Practices

1. **Realistic Timing** - Add delays between actions (humans aren't instant)
2. **Varied Data** - Use random/varied test data
3. **Error Handling** - Log and continue on non-critical errors
4. **Cleanup** - Clean up test data after runs
5. **Monitoring** - Watch server metrics during tests

---

Stress testing validates system behavior under realistic conditions that unit tests cannot capture.
