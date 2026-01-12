# V2 Resort Stress Test Framework

A comprehensive behavioral stress testing system for the V2 Resort platform with realistic customer, staff, and admin bots.

## Overview

This stress test framework simulates realistic user behavior across all roles:

| Role | Initial Count | Additional | Total |
|------|---------------|------------|-------|
| 🧑‍💻 Customers | 50 | - | 50 |
| 👷 Staff | 15 | 5 (trainees) | 20 |
| 🔧 Admins | 2 | - | 2 |

**Total: 72 concurrent bots**

## Bot Capabilities

### Customer Bot Actions
- Browse restaurant/snack menus
- View menu item details
- Add/update/remove cart items
- Place restaurant orders
- Place snack bar orders
- Track order status
- Book chalets
- Check availability
- Buy pool tickets
- Submit reviews
- Contact support
- Manage profile

### Staff Bot Actions
- View live orders (restaurant/snack)
- Update order status
- Mark orders complete
- Check-in/check-out chalet guests
- Record chalet payments
- Validate pool tickets
- Record pool entries/exits
- View today's bookings
- View capacity stats
- Manage tables

### Admin Bot Actions
- View dashboard statistics
- View revenue stats
- Generate reports
- View/create/update users
- Hire trainees (creates new staff bots!)
- Manage modules
- Update site settings
- Approve/reject reviews
- View audit logs
- Create backups
- Manage menu categories/items
- Manage chalets
- Manage pool sessions

## Running the Stress Test

### Quick Start

```bash
# From the v2-resort directory
npm run stress-test
```

### Options

```bash
# Quick test (5 customers, 3 staff, 60s)
npm run stress-test:quick

# Medium test (25 customers, 10 staff, 5 minutes)
npm run stress-test:medium

# Full test (50 customers, 15 staff, unlimited)
npm run stress-test:full
```

### Custom Configuration

```bash
npx ts-node tools/stress-test/run.ts \
  --url http://localhost:3000 \
  --customers 20 \
  --staff 10 \
  --trainees 5 \
  --admins 2 \
  --duration 300
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | Base URL for the API | http://localhost:3000 |
| `--customers <n>` | Number of customer bots | 50 |
| `--staff <n>` | Number of initial staff bots | 15 |
| `--trainees <n>` | Trainees to hire during test | 5 |
| `--admins <n>` | Number of admin bots | 2 |
| `--duration <s>` | Test duration in seconds (0 = infinite) | 0 |

## Architecture

```
tools/stress-test/
├── run.ts                # Entry point & CLI
├── config.ts             # Configuration & probabilities
├── orchestrator.ts       # Bot lifecycle manager
├── bots/
│   ├── customer-bot.ts   # Customer behavior simulation
│   ├── staff-bot.ts      # Staff operations simulation  
│   └── admin-bot.ts      # Admin actions simulation
└── utils/
    ├── api-client.ts     # Full API client
    ├── logger.ts         # Colored logging & metrics
    └── helpers.ts        # Random generators & utilities
```

## Metrics

The stress test outputs real-time metrics:

- **Total Requests**: All API calls made
- **Success Rate**: Percentage of successful requests
- **Average Latency**: Mean response time in ms
- **Requests/Second**: Current throughput
- **Error Count**: Total failed requests
- **Action Distribution**: Count per action type

## Trainee System

The admin bots will hire trainees during the test:

1. Admin creates a new user with staff role
2. Orchestrator receives callback
3. New StaffBot spawns with trainee credentials
4. Trainee bot starts working immediately

This simulates real-world scenarios where staff grows over time.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STRESS_TEST_URL` | Override base URL |
| `STRESS_TEST_ADMIN_EMAIL` | Admin email for auth |
| `STRESS_TEST_ADMIN_PASS` | Admin password |

## Graceful Shutdown

Press `Ctrl+C` to stop the test gracefully. This will:

1. Stop all bots
2. Print final report with metrics
3. Show action distribution
4. List any errors encountered

## Example Output

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         V2 RESORT STRESS TEST                                 ║
║                                                                               ║
║   🧑‍💻 Customer Bots: 50       👷 Staff Bots: 20        🔧 Admin Bots: 2      ║
║                                                                               ║
║   Target: http://localhost:3000                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

🔧 Phase 1: Starting 2 Admin bots...
✅ Admin Bot #1 started
✅ Admin Bot #2 started

👷 Phase 2: Starting 15 Staff bots...
✅ Staff Bot #1 started
...

🧑‍💻 Phase 3: Starting 50 Customer bots in waves...
Wave 1/5: Starting customers 1-10...
...

────────────────────────────────────────────────────────────────────────────────
📊 METRICS | Uptime: 60s | Bots: 72
   Total Requests: 3,245 | Success Rate: 98.7%
   Avg Latency: 45ms | Req/s: 54.08
   Errors: 42 | Trainees Hired: 3/5
────────────────────────────────────────────────────────────────────────────────
```
