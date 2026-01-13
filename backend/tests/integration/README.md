# Integration Tests

End-to-end integration tests for the V2 Resort backend API.

## Overview

These tests exercise real API endpoints against a test database, validating complete user flows:

| Scenario | Description |
|----------|-------------|
| **Order Lifecycle** | Customer orders → Staff processes → Complete |
| **Auth Flow** | Register → Login → Refresh → Password change → Logout |
| **Booking Cycle** | Check availability → Book → Check-in → Check-out |
| **Pool Tickets** | Browse → Purchase → Staff validates → Use |
| **Admin Operations** | Dashboard → User management → Reports |

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Backend dependencies installed (`npm install`)

## Quick Start

```bash
# 1. Start test database
npm run test:integration:setup

# 2. Run integration tests
npm run test:integration

# 3. Cleanup
npm run test:integration:teardown
```

## Test Database

Integration tests use an isolated PostgreSQL instance:

| Setting | Value |
|---------|-------|
| Host | localhost |
| Port | **5433** (not 5432!) |
| User | v2resort_test |
| Password | v2resort_test_secret |
| Database | v2resort_test |

Redis test instance runs on port **6380**.

### Manual Docker Commands

```bash
# Start services
docker-compose -f docker-compose.test.yml up -d

# Check status
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs -f

# Stop and remove volumes
docker-compose -f docker-compose.test.yml down -v
```

## Test Structure

```
tests/integration/
├── config.ts           # Environment configuration
├── setup.ts            # Database seeding, cleanup
├── api-client.ts       # HTTP client with auth handling
├── assertions.ts       # Common assertion helpers
├── index.ts            # Re-exports all utilities
└── scenarios/
    ├── order-lifecycle.test.ts
    ├── auth-flow.test.ts
    ├── booking-cycle.test.ts
    ├── pool-tickets.test.ts
    └── admin-operations.test.ts
```

## Configuration

Integration tests are controlled by environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RUN_INTEGRATION_TESTS` | `false` | Enable integration tests |
| `TEST_DB_HOST` | `localhost` | Test database host |
| `TEST_DB_PORT` | `5433` | Test database port |
| `TEST_API_URL` | `http://localhost:3001/api` | Backend API URL |

## Writing New Tests

### Create a new scenario

```typescript
// tests/integration/scenarios/my-feature.test.ts
import { describe, it, beforeAll } from 'vitest';
import { createGuestClient, createStaffClient } from '../api-client';
import { assertSuccess, assertHasData } from '../assertions';
import { waitForServices, resetTestContext } from '../setup';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIf = runIntegration ? describe : describe.skip;

describeIf('My Feature Integration', () => {
  let client;

  beforeAll(async () => {
    const services = await waitForServices();
    if (!services.database) return;
    
    resetTestContext();
    client = createGuestClient();
  });

  it('should do something', async () => {
    const response = await client.someEndpoint();
    assertSuccess(response);
    assertHasData(response, (data) => {
      expect(data.field).toBeDefined();
    });
  });
});
```

### Available Clients

| Client | Usage |
|--------|-------|
| `createGuestClient()` | Unauthenticated requests |
| `createCustomerClient()` | Customer role |
| `createStaffClient()` | Staff role |
| `createAdminClient()` | Admin role |

### Available Assertions

| Assertion | Description |
|-----------|-------------|
| `assertSuccess(response)` | Response is 2xx |
| `assertFailure(response, status?)` | Response is error |
| `assertHasData(response, validator?)` | Has data with optional validation |
| `assertUnauthorized(response)` | Is 401 |
| `assertForbidden(response)` | Is 403 |
| `assertNotFound(response)` | Is 404 |
| `waitFor(condition, options)` | Poll until condition |

## CI/CD Integration

GitHub Actions example:

```yaml
integration-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15-alpine
      env:
        POSTGRES_USER: v2resort_test
        POSTGRES_PASSWORD: v2resort_test_secret
        POSTGRES_DB: v2resort_test
      ports:
        - 5433:5432
    redis:
      image: redis:7-alpine
      ports:
        - 6380:6379
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npm ci
    - run: npm run test:integration
      env:
        RUN_INTEGRATION_TESTS: true
```

## Troubleshooting

### Tests skip immediately
- Check `RUN_INTEGRATION_TESTS=true` is set
- Verify Docker containers are running

### Database connection errors
- Ensure port 5433 is available
- Check `docker-compose -f docker-compose.test.yml ps`

### Tests timeout
- Increase `testTimeout` in `vitest.integration.config.ts`
- Check API server is running on port 3001

### Cleanup issues
- Run `npm run test:integration:teardown`
- Manually: `docker-compose -f docker-compose.test.yml down -v`
