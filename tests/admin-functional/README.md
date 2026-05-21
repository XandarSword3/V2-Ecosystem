## Admin functional tests

These specs are meant to **prove end-to-end functionality** for admin pages:
- UI renders meaningful output
- actions call the expected endpoints
- mutations have verifiable data effects

They use:
- `tests/fixtures/auth.fixture.ts` for stable login/session
- `tests/admin-functional/harness.ts` for CSRF + authenticated API calls

Run locally (example):

```bash
cd v2-ecosystem
npx playwright test -c playwright.all.config.ts tests/admin-functional --project=chromium
```

