# Backend Tests — Speculative / Pending Design Reference Notes

> [!WARNING]
> **DO NOT WIRE THESE FILES INTO THE TEST RUNNER OR REFACTOR CODE TO PASS THEM.**
> The files in this directory (`tests/_pending/`) are speculative architecture drafts and design references from earlier exploration sessions.
>
> They assume an unadopted repository/service-layer architecture (referencing nonexistent `src/lib/services/` and `src/lib/repositories/`).
>
> In accordance with **ARCHITECTURE LAW** and `CONTEXT.MD`, the production architecture of V2 Ecosystem uses:
> - The 5 unified engines (`instant_transaction`, `time_exclusive_reservation`, `shared_capacity_access`, `ongoing_entitlement`, `platform_entitlement`)
> - The unified `transactions` database table
> - The Express router & controller pattern (`dynamic-module.router.ts`, module controllers)

### Useful Feature Reference:
- `waitlist.service.test.ts`: Contains 1,220+ lines of detailed domain logic and edge cases for table matching, guest entry states, and waitlist lifecycle. Treat this file as a specification and reference document when implementing the official waitlist feature within the engine framework, NOT as a runnable test suite.
