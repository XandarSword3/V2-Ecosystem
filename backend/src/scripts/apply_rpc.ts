/**
 * DEPRECATED — do not run.
 *
 * This script previously created a `create_chalet_booking_safe` RPC that wrote
 * directly to the legacy `chalets` and `chalet_bookings` tables. Both tables have
 * been superseded by `bookable_units` and `transactions` under the engine-based
 * architecture. Atomic reservation logic is now handled by the
 * `reserve_unit_exclusive` RPC defined in migration
 * 20260523100002_reserve_unit_exclusive_atomic.sql.
 *
 * This file is intentionally left as a no-op to preserve git history.
 */

export {};
