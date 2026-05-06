/**
 * Reference Type Adapter - Step 8 Safety Layer
 * 
 * CRITICAL: Stripe webhooks and external systems may send OLD reference_type values.
 * This adapter maps legacy reference types to new engine-based types.
 * 
 * DO NOT REMOVE until all external integrations have migrated.
 */

import { logger } from '../../utils/logger.js';

// Legacy → New mapping
const LEGACY_TO_ENGINE: Record<string, string> = {
  // Old module-based names
  'restaurant_order': 'instant_transaction',
  'snack_order': 'instant_transaction',
  'chalet_booking': 'time_exclusive_reservation',
  'pool_ticket': 'shared_capacity_access',
  
  // Intermediate values (if any systems were partially migrated)
  'order': 'instant_transaction',
  'booking': 'time_exclusive_reservation',
  
  // Already new values (pass through)
  'instant_transaction': 'instant_transaction',
  'time_exclusive_reservation': 'time_exclusive_reservation',
  'shared_capacity_access': 'shared_capacity_access',
  'ongoing_entitlement': 'ongoing_entitlement',
};

/**
 * Normalize any reference type (legacy or new) to engine type.
 * Logs warnings for legacy values to track migration progress.
 */
export function normalizeReferenceType(input: string | undefined | null): string {
  if (!input) {
    logger.warn('Reference type adapter received empty value, defaulting to instant_transaction');
    return 'instant_transaction';
  }
  
  const normalized = input.toLowerCase().trim();
  
  // Check if it's already a valid engine type
  if (LEGACY_TO_ENGINE[normalized] === normalized) {
    return normalized;
  }
  
  // Check if it's a legacy value
  if (LEGACY_TO_ENGINE[normalized]) {
    logger.warn(`Legacy reference_type '${input}' detected in payment flow - mapped to '${LEGACY_TO_ENGINE[normalized]}'. Update external integration!`);
    return LEGACY_TO_ENGINE[normalized];
  }
  
  // Unknown value - log error but don't fail
  logger.error(`Unknown reference_type '${input}' received - defaulting to instant_transaction. Investigate immediately!`);
  return 'instant_transaction';
}

/**
 * Strict validation for NEW internal code.
 * Throws on legacy values - use only for internal APIs after full migration.
 */
export function requireEngineType(input: string): string {
  const validTypes = ['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement'];
  
  if (!validTypes.includes(input)) {
    throw new Error(`Invalid engine_type '${input}'. Must be one of: ${validTypes.join(', ')}`);
  }
  
  return input;
}

/**
 * Check if value is legacy format (for telemetry)
 */
export function isLegacyReferenceType(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  return normalized in LEGACY_TO_ENGINE && LEGACY_TO_ENGINE[normalized] !== normalized;
}
