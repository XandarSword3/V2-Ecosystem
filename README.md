# V2 Resort Management Platform

V2 Resort is a monorepo with an Express backend, Next.js frontend, shared TypeScript types, and Supabase migrations.

## Core Structure

```text
v2-resort/
├── backend/      Express API and services
├── frontend/     Next.js web application
├── shared/       Shared TypeScript types
├── supabase/     SQL migrations and local Supabase config
├── tests/        Playwright E2E suites
├── tools/        Operational scripts
├── mobile/       React Native app
└── docs/         Project documentation
```

## Documentation Index

- Architecture: `docs/architecture/ARCHITECTURE.md`
- API: `docs/api/API.md`
- Development Setup: `docs/guides/DEVELOPMENT_SETUP.md`
- Testing Guide: `docs/guides/TESTING.md`
- User Guide: `docs/guides/USER_GUIDE.md`
- E2E Specification: `docs/guides/E2E_TEST_SPECIFICATION.md`
- Historical reports and one-off SQL references: `docs/archive/`

## Quick Start

```bash
# install dependencies from the workspace root
npm install

# run local development
npm run dev
```

For full environment setup and troubleshooting, use `docs/guides/DEVELOPMENT_SETUP.md`.
