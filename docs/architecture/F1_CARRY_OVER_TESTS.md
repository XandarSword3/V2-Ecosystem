# F1 Carry-Over Certification Items

These items were identified during F1 but are **genuinely outside F1 scope**.
They are recorded here so they are not silently treated as passed.

## Status: OPEN — to be addressed during F19 (Hospitality Productization) or F22 (E2E Certification)

---

### 1. Catalog Lifecycle Browser E2E

**What:** Full browser E2E test for catalog item lifecycle:
`draft → active → temporarily unavailable → sold out → archived`

**Why outside F1:** F1 is frontend domain layer + authorization architecture.
The catalog lifecycle is an admin operations surface (F4/F11) that requires
the backend catalog service to be fully stable first.

**Backend dependency:** Main Phase 8 (Catalog/product lifecycle)

**Test scenario:**
- Admin creates a catalog item in draft state
- Activates it — verify it appears in customer-facing catalog
- Marks as temporarily unavailable — verify it disappears from catalog
- Marks as sold out — verify different UX
- Archives it — verify it no longer appears anywhere
- Verify pricing snapshots are immutable after activation
- Verify inventory linkage survives status transitions

---

### 2. Full Customer → Staff Workflow (Quick Order)

**What:** End-to-end browser E2E for the staff-assisted order workflow:
staff lookup → customer selection → product selection → customization →
pricing → fulfillment → payment → receipt

**Why outside F1:** F2 builds the authorization layer. The actual workflow
E2E depends on F2 being in place (so the staff member's permissions gate
the right UI affordances), PLUS it requires the full payment + pricing
pipeline to be stable.

**Backend dependency:** Main Phases 7, 12–16 (Pricing, Cart, Checkout, Payment)

**Test scenario:**
- Staff logs in with staff-scoped account
- Searches for existing customer
- Creates order on customer's behalf
- Applies customization/modifiers
- Verifies server-side pricing (no frontend price calculation)
- Selects fulfillment mode
- Processes payment (card/cash)
- Verifies receipt/fiscal document
- Verifies loyalty earned
- Verifies order appears in customer's order history

---

### 3. Fulfillment Mode Selection (Customer-Facing)

**What:** Browser E2E for customer fulfillment mode selection:
`on_premise ↔ pickup ↔ local_delivery ↔ digital_delivery ↔ shipment`

**Why outside F1:** Depends on F7 (Fulfillment selection + customer tracking)
which requires Main Phase 22 (Fulfillment adapters) to be stable.

**Backend dependency:** Main Phase 22 (Fulfillment adapters)

**Test scenario:**
- Customer adds item to cart
- Frontend displays fulfillment options from `EngineACapabilities.fulfillment.options`
- Customer selects different modes
- Verify destination selector updates per mode
- Verify pricing refreshes per mode (delivery fee, etc.)
- Verify checkout completes with selected mode
- Verify fulfillment row is created with correct mode and initial state

---

### 4. Multi-Tenant Isolation Certification (Frontend)

**What:** Verify that the frontend never leaks data across tenant boundaries:
admin switching property doesn't affect public storefront; staff in Tenant A
can't see Tenant B orders.

**Why outside F1:** This is a security certification item (Main Phase 35/41)
that requires both frontend and backend isolation to be fully in place.

**Backend dependency:** Main Phase 35 (Database integrity), Phase 41 (Concurrency)

**Test scenario:**
- Two browser tabs: one admin, one public storefront
- Admin switches active property → verify public storefront doesn't change
- Staff user with Tenant A scope navigates to Tenant B admin URL → verify 403
- Admin with Tenant A scope tries to access Tenant B property → verify blocked
- Verify all API calls carry correct tenant/property headers
- Verify RLS prevents cross-tenant reads

---

### 5. Offline/Resilience Staff Queue

**What:** Verify that staff operations survive network degradation:
order creation during brief disconnect, KDS queue preservation on reconnect.

**Why outside F1:** Depends on F17 (Resilience/offline/conflict UX) which
requires Main Phase 40–41 (Failure injection, Concurrency).

**Backend dependency:** Main Phase 40–41

**Test scenario:**
- Staff creates order while network is stable
- Network drops for 5 seconds
- Staff creates another order (queued offline)
- Network restores — verify offline queue drains
- Verify no duplicate orders
- Verify KDS state reconciles correctly

---

### 6. Loyalty Earn/Redeem/Reverse E2E

**What:** Full loyalty lifecycle E2E: earn on purchase → redeem in cart →
reverse on refund → verify balance reconciliation.

**Why outside F1:** Depends on Main Phase 24 (Loyalty) being fully stable.

**Backend dependency:** Main Phase 24 (Loyalty)

**Test scenario:**
- Customer with loyalty membership places order
- Verify points earned (exact-once)
- Customer places another order, redeems points
- Verify discount applied
- Admin refunds first order
- Verify loyalty points reversed (exact-once)
- Verify balance reconciliation

---

### 7. Fiscal Document Generation E2E

**What:** Verify fiscal documents (invoice, receipt, credit note) are
generated from authoritative transaction facts, not recalculated.

**Why outside F1:** Depends on Main Phase 17–18 (Fiscal/compliance + Tax engine).

**Backend dependency:** Main Phase 17–18

**Test scenario:**
- Complete a transaction
- Verify invoice generated with correct:
  - Line items from immutable snapshot
  - Tax breakdown from tax engine
  - Fee breakdown from CMS configuration
  - Controlled document number
- Issue a credit note for partial refund
- Verify credit note references original invoice
- Verify fiscal document numbers are sequential/gapless per jurisdiction policy

---

## Summary

| # | Item | Depends On | Target Phase |
|---|------|-----------|--------------|
| 1 | Catalog lifecycle E2E | Main Phase 8 | F4/F11 |
| 2 | Customer → staff workflow | Main Phase 7, 12–16 | F9 |
| 3 | Fulfillment mode selection | Main Phase 22 | F7 |
| 4 | Multi-tenant isolation (FE) | Main Phase 35, 41 | F22 |
| 5 | Offline staff queue | Main Phase 40–41 | F17 |
| 6 | Loyalty earn/redeem/reverse | Main Phase 24 | F10 |
| 7 | Fiscal document generation | Main Phase 17–18 | F14 |

None of these are F1 failures. They are **deferred certification items**
that require later main phases to be stable before they can be meaningfully
tested.
