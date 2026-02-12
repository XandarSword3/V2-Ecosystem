# Iteration 25 — Analysis

## Date: 2026-02-08

## Special Iteration
Iteration 25 is a **special iteration** requiring:
- 3 regular code improvements
- E2E test as **Customer** (every 5 iterations)
- E2E test as **Staff** (every 5 iterations)
- **Scenario Transformation** (every 25 iterations)

## Target File: `app/staff/pool/page.tsx`

### Current State
- **Lines:** 673 (pre-changes)
- **Problem:** 30+ hardcoded English strings despite existing i18n keys in `staff.pool` namespace
- **NO `useTranslations` import or hooks** — entire page was bypassing the i18n system
- **Affected areas:** Header, tabs, scan mode, stats cards, ticket cards, empty state, detail modal

### i18n Key Audit
The `messages/en.json` file already had a `staff.pool` namespace with keys like:
- `title`, `subtitle`, `scanning`, `scanModeF2`, `refresh`
- `tabs.tickets`, `tabs.maintenance`
- `scanMode.title`, `scanMode.description`, `scanMode.exit`
- `stats.totalToday`, `stats.pending`, `stats.inPoolNow`, `stats.completed`
- `capacityWarning`

**Missing keys needed:** 17 new keys for ticket card and detail modal strings

### Changes Planned
1. **IMPROVE-25A:** Add `useTranslations` imports + hooks, refactor `ticketTypeConfig` to split pattern
2. **IMPROVE-25B:** Replace header, stats, ticket card, and empty state strings
3. **IMPROVE-25C:** Replace all 13 modal strings with i18n calls, add 17 new keys to 4 locale files

## Other Files Examined But Deferred
- `app/staff/layout.tsx` — Notification panel has hardcoded strings + missing AbortController (deferred to Iter 26)
- `app/giftcards/page.tsx` — Purchase flow skips payment step (deferred)
