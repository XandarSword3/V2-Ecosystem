/**
 * Engine-refit helpers for integration tests.
 * @see ARCHITECTURE_LAW.md — all financial/access events live in `transactions`.
 */

import { trackResource } from './setup';

/** Dead per ARCHITECTURE_LAW — must never appear in cleanup tracking or queries. */
export const DEAD_LEGACY_TABLES = new Set([
  'restaurant_orders',
  'pool_tickets',
  'chalet_bookings',
  'snack_orders',
  'tickets',
  'bookings',
  'orders',
]);

export const EngineType = {
  INSTANT_TRANSACTION: 'instant_transaction',
  TIME_EXCLUSIVE_RESERVATION: 'time_exclusive_reservation',
  SHARED_CAPACITY_ACCESS: 'shared_capacity_access',
  ONGOING_ENTITLEMENT: 'ongoing_entitlement',
} as const;

export const ModuleSlug = {
  RESTAURANT: 'restaurant',
  CHALETS: 'chalets',
  POOL: 'pool',
  SNACK_BAR: 'snack-bar',
} as const;

/** Register a created engine record for teardown (always `transactions`). */
export function trackTransaction(id: string): void {
  if (!id) return;
  trackResource('transactions', id);
}

export function assertNotDeadTable(tableName: string): void {
  if (DEAD_LEGACY_TABLES.has(tableName)) {
    throw new Error(
      `ARCHITECTURE_LAW violation: "${tableName}" must not be used. Query \`transactions\` with the correct engine_type filter instead.`,
    );
  }
}
