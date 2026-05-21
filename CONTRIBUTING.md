# Contributing to V2 Ecosystem

Thank you for your interest in contributing. This document outlines the process for reporting issues, proposing features, and submitting pull requests.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Report a Bug](#how-to-report-a-bug)
- [How to Request a Feature](#how-to-request-a-feature)
- [Development Workflow](#development-workflow)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Commit Message Convention](#commit-message-convention)
- [Code Style](#code-style)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Please report unacceptable behaviour to [alessandro.abisafi@gmail.com](mailto:alessandro.abisafi@gmail.com).

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker** (for local Supabase)
- **Supabase CLI** `>=1.200.0`

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/XandarSword3/V2-Ecosystem.git
cd V2-Ecosystem

# 2. Install all workspace dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd mobile && npm install && cd ..

# 3. Start local Supabase
supabase start

# 4. Apply migrations
supabase db push

# 5. Start backend and frontend (separate terminals)
cd backend && npm run dev
cd frontend && npm run dev
```

Environment variables are documented in `backend/README.md` and `frontend/README.md`.

---

## How to Report a Bug

1. **Search existing issues** to avoid duplicates.
2. Use the **Bug Report** issue template.
3. Include:
   - Steps to reproduce (minimal, reproducible case)
   - Expected vs. actual behaviour
   - Environment (OS, Node version, browser if frontend)
   - Relevant logs or screenshots

Security vulnerabilities must **not** be filed as public issues. See [SECURITY.md](SECURITY.md).

---

## How to Request a Feature

1. Search existing issues and discussions first.
2. Use the **Feature Request** issue template.
3. Describe the problem you are solving, not just the solution.
4. If the feature touches multiple workspaces (backend/frontend/mobile), note that.

---

## Development Workflow

This is a monorepo with four workspaces:

| Workspace | Path | Stack |
|-----------|------|-------|
| Backend | `backend/` | Node.js, TypeScript, Express, Supabase |
| Frontend | `frontend/` | Next.js 16, Tailwind CSS, next-intl |
| Mobile | `mobile/` | Expo 55, React Native, NativeWind |
| Shared | `shared/` | TypeScript types shared across all workspaces |

**Branch naming:**

```
feat/<short-description>      # new features
fix/<short-description>       # bug fixes
chore/<short-description>     # tooling, deps, refactors
docs/<short-description>      # documentation only
```

**Never commit directly to `main`.** Open a PR.

---

## Pull Request Guidelines

- Keep PRs focused — one concern per PR.
- All PRs require at least one review before merging.
- CI must pass (lint + tests + build) before merge.
- Update relevant documentation if your change affects behaviour.
- Add or update tests for any logic changes in `backend/` or `frontend/`.
- If your PR resolves an issue, reference it: `Closes #123`.

### PR Checklist

Before marking a PR as ready for review:

- [ ] Tests pass locally (`npm test` in affected workspace)
- [ ] Linting passes (`npm run lint` in affected workspace)
- [ ] No new `console.log` statements left in production code
- [ ] Environment variables documented if new ones are added
- [ ] Migration files included if schema changes are made
- [ ] `shared/types` updated if API contracts changed

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

**Scopes:** `backend`, `frontend`, `mobile`, `shared`, `infra`, `migrations`

**Examples:**

```
feat(backend): add cancellation pattern analysis endpoint
fix(frontend): remove hardcoded resort name fallback
chore(mobile): update expo to 55.0.24 for security patches
docs: add CONTRIBUTING and SECURITY guides
```

---

## Code Style

- **TypeScript** is required in all workspaces — no plain `.js` files in `src/`.
- **ESLint** configs live at `eslint-backend.json` and `eslint-frontend.json` — run before pushing.
- **Prettier** formatting is enforced via the ESLint config.
- Avoid `any` types. Use proper interfaces defined in `shared/types/` where applicable.
- Backend controllers must use the `asyncHandler` wrapper — see `backend/src/utils/`.
- All new API endpoints must be documented in `backend/docs/`.
