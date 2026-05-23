# Auth Fixture Architecture

This folder contains shared Playwright fixtures for authentication.

## What to import

```ts
import { test, expect } from '../../fixtures/auth.fixture';
```

## Available fixture

- `auth.loginAs(role)`
  - Logs in through UI for `customer`, `admin`, or `staff`.
  - Throws immediately if login does not stick.
- `auth.getApiToken(role)`
  - Logs in through API and returns a bearer token.
  - Tokens are cached per role for the test run.

## Why this exists

- Removes repeated login boilerplate from specs.
- Keeps role credentials centralized in one place.
- Makes auth failures explicit and easier to debug.

## Environment variables

- `FRONTEND_URL`, `API_URL`
- `PRODUCTION_FRONTEND_URL`, `PRODUCTION_API_URL` (for @production smoke)
- `E2E_CUSTOMER_EMAIL`, `E2E_CUSTOMER_PASSWORD`
- `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`
- `E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD`
