# V2 Resort Production Hardening - Assumptions

## Overview
This document tracks all assumptions made during the hardening phase when requirements were unclear or external dependencies were unavailable.

---

## Hardening Phase Assumptions

| ID | Date | Area | Assumption | Rationale |
|----|------|------|------------|-----------|
| H-001 | 2026-01-24 | Chargebacks | Table schema based on Stripe dispute object | Service code references suggest Stripe integration |
| H-002 | 2026-01-24 | Webhook Failures | Max 5 retries with exponential backoff | Industry standard for webhook reliability |
| H-003 | 2026-01-24 | Currencies | EUR as default, support 8 major currencies | Existing service code shows these currencies |
| H-004 | 2026-01-24 | Email Bounces | Suppress after 3 soft bounces in 7 days | Service code defines these thresholds |
| H-005 | 2026-01-24 | Pen Test | Simulate OWASP ZAP findings based on code review | External tool unavailable, manual analysis |
| H-006 | 2026-01-24 | Test Coverage | Estimated coverage from new tests | Cannot run live coverage without server |

---

## Previous Development Assumptions

### General Assumptions

| ID | Date | Area | Assumption | Rationale |
|----|------|------|------------|-----------|
| A-001 | 2026-01-24 | Currency | Default currency is EUR (€) | European resort location |
| A-002 | 2026-01-24 | Timezone | Default timezone is UTC | Server standard, frontend converts |
| A-003 | 2026-01-24 | Language | Default language is English (en) | Existing translations support en/it/de |

---

## Sprint-Specific Assumptions

### Sprint 0: Foundation
*Will be updated during Sprint 0 execution*

### Sprint 1: Authentication & Security
*Will be updated during Sprint 1 execution*

### Sprint 2: Booking Module
*Will be updated during Sprint 2 execution*

### Sprint 3: Pool Module
*Will be updated during Sprint 3 execution*

### Sprint 4: Restaurant & Admin
*Will be updated during Sprint 4 execution*

### Sprint 5: Configuration & Polish
*Will be updated during Sprint 5 execution*

### Sprint 6: Testing & Documentation
*Will be updated during Sprint 6 execution*

### Sprint 7: Production Hardening
*Will be updated during Sprint 7 execution*

---

## Risk Assessment
Assumptions with higher risk of being incorrect are flagged for human review in the COMPLETION_REPORT.md
