# Backend Engines

Business logic engines providing core computational and orchestration capabilities.

## Engine Inventory

| Engine | Purpose |
|--------|---------|
| `pricing-pipeline.ts` | Multi-step pricing calculation (base price → modifiers → discounts → taxes) |
| `state-machine.ts` | Generic state machine for order/booking lifecycle management |
| `feature-flags.ts` | Feature flag evaluation and management |
| `financial-ledger.ts` | Double-entry financial ledger operations |
| `discount-resolvers.ts` | Discount rule evaluation and stacking |
| `idempotency-guard.ts` | Request deduplication for payment operations |
| `observability.ts` | Structured logging and metrics collection |
| `transaction-manager.ts` | Database transaction orchestration |
| `engine-service.ts` | Engine registry and lifecycle management |
| `registry.ts` | Module/engine registration system |
| `index.ts` | Engine barrel exports |

## Subdirectory

| Directory | Purpose |
|-----------|---------|
| `definitions/` | Engine type definitions and interfaces (4 files) |
