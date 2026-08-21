/**
 * Engine A clean test gate (plan Stage 6 fix #4).
 *
 * The full unit suite carries 169 pre-existing failures across 23 files
 * (loyalty, promotions, inventory, auth, …) — business-module debt that is
 * NOT Engine A. This gate exists so the Engine A surface can never hide
 * behind that baseline: it runs exactly the deterministic, green Engine A
 * unit surface and FAILS THE BUILD on any failure.
 *
 *   npm run test:engine-a
 *
 * Coverage: the engine core (state machines, pricing pipeline, capability
 * contract, layered states, workflow integration, money/currency, ledger),
 * fulfillment persistence, payment/POS on orders, staff payment, fiscal
 * document readiness, and business configuration/metrics.
 *
 * Rules for adding a file here: it must be Engine A relevant AND green in
 * isolation. A file that fails belongs in the remediation backlog, not in
 * the gate — the gate's whole point is that zero failures is the only
 * acceptable evidence for this branch.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    deps: { interopDefault: true },
    typecheck: { tsconfig: './tsconfig.spec.json' },
    include: [
      // Engine core — state machines, pricing, capabilities, layered states
      'tests/unit/engines/**/*.test.ts',
      // Fulfillment persistence
      'tests/unit/fulfillment/**/*.test.ts',
      // Money / payment / POS on Engine A orders
      'tests/unit/payment.module.test.ts',
      'tests/unit/modules/staff/module-staff-payment.test.ts',
      'tests/unit/currency.service.test.ts',
      // Fiscal readiness
      'tests/unit/modules/fiscal/fiscal-profile.test.ts',
      // Business configuration / metrics
      'tests/unit/services/business-config.service.test.ts',
      'tests/unit/services/business-metrics.service.test.ts',
    ],
    env: { NODE_ENV: 'test' },
  },
});
