# Archived 2026-08-07 — duplicate staff page tree

This was `app/[property]/staff/[slug]/`, a duplicate of
`app/[property]/staff/modules/[slug]/`. Both implemented the same
engine_type switch (instant_transaction / shared_capacity_access /
time_exclusive_reservation / ongoing_entitlement) and rendered the same
components. `staff/modules/[slug]` is the one actually linked from live
navigation (`staff/page.tsx`, `staff/layout.tsx` sidebar) — this tree was
only reachable via a single stale `Link` in `staff/manager/page.tsx`,
which has been repointed to `staff/modules/[slug]`.

Before archiving, `MultiDayBookingDashboard.tsx` here (this copy) had a
"Deposit Status" field the surviving copy lacked, and the surviving copy
had offline-support code this one lacked. The Deposit Status field was
ported over to `staff/modules/[slug]/components/MultiDayBookingDashboard.tsx`
before this archive — nothing was lost.

The `sessions/`, `tickets/`, and `capacity/` subpages here were not
linked from anywhere reachable in the app — `staff/modules/[slug]/page.tsx`
renders `SessionAccessDashboard` directly instead of routing to subpages.

`_archived` is a Next.js private-folder prefix, so this tree is excluded
from routing automatically — it doesn't need to be deleted for the
duplicate routes to stop resolving. Kept for reference/rollback per
explicit instruction not to delete.
