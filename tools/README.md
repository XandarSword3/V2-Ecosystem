# Tools Directory

Development and testing utilities for the V2 Resort platform.

## Structure

```
tools/
├── stress-test/              # Automated stress testing bots
│   ├── bots/                 # Bot implementations
│   ├── utils/                # Shared utilities
│   ├── run.ts                # Main entry point
│   └── README.md             # Stress test documentation
├── translation-audit.js      # Translation coverage checker
└── translation-audit-results.json
```

## Stress Test Bots

Simulate realistic user behavior for load testing:

| Bot Type | Count | Actions |
|----------|-------|---------|
| Customer | 50 | Browse menus, place orders, book chalets, buy pool tickets |
| Staff | 20 | Update order status, check-in guests, validate tickets |
| Admin | 2 | Generate reports, manage users, update settings |

**Total: 72 concurrent simulated users**

```bash
# Run all bots (72 users)
npm run stress-test

# Quick test (5 customers, 3 staff, 60s)
npm run stress-test:quick

# Medium test (25 customers, 10 staff, 5 min)
npm run stress-test:medium
```

See [stress-test/README.md](stress-test/README.md) for detailed documentation.

## Translation Audit

Checks for missing translations across all language files:

```bash
node tools/translation-audit.js
```

### Output

```json
{
  "missing": {
    "ar": ["common.newFeature", "admin.report"],
    "fr": ["common.newFeature"]
  },
  "coverage": {
    "en": "100%",
    "ar": "98.5%",
    "fr": "99.2%"
  }
}
```

## Adding New Tools

1. Create directory or file in `tools/`
2. Add documentation (README or comments)
3. Update this file with tool description
4. Add npm script if frequently used

---

Development tools should not be included in production builds.
