/**
 * Engine C: Shared Capacity Access
 * 
 * Economic Pattern: Purchase → Validate → Enter → Exit
 * Commercial Entity: Ticket
 * Examples: Pool, Fitness Center, Spa, Waterpark, Game Room, Cinema
 * 
 * This engine handles:
 *   - Sessions with TIMESTAMPTZ time slots — midnight-spanning supported (24h day pass, etc.)
 *   - personal_duration_minutes: when set on a session, each ticket-holder gets that many
 *     minutes from their own check-in time rather than the shared session ends_at
 *   - Ticket purchase with adult/child pricing
 *   - QR code generation for ticket validation
 *   - Entry/exit tracking with real-time capacity management
 *   - Bracelet/wristband assignment (optional equipment tracking)
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  SharedCapacityAccessStatus,
} from '../types.js';

// ============================================
// State Machine
// ============================================

export const sharedCapacityAccessStateMachine: StateMachineDefinition<SharedCapacityAccessStatus> = {
  states: ['valid', 'active', 'used', 'expired', 'cancelled'],

  initialState: 'valid',

  terminalStates: ['used', 'expired', 'cancelled'],

  transitions: [
    // Happy path
    {
      from: 'valid',
      to: 'active',
      action: 'validate_entry',
      allowedActors: ['staff', 'system'],
      guardDescription: 'NOW() is between starts_at and ends_at; capacity not exceeded; if personal_duration_minutes is set on the session, personal_expires_at = NOW() + personal_duration_minutes is stored in transaction metadata at this point',
    },
    {
      from: 'active',
      to: 'used',
      action: 'record_exit',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Guest is currently inside (active status confirmed); capacity count decremented',
    },

    // Cancellation
    {
      from: 'valid',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Ticket date is in the future (no same-day cancellation unless policy allows)',
    },

    // Expiration — no entry before session ended
    {
      from: 'valid',
      to: 'expired',
      action: 'expire',
      allowedActors: ['system'],
      guardDescription: 'NOW() > ends_at and ticket never validated; auto-expired by cron',
    },

    // Personal duration expiry — guest is inside but their personal timer ran out
    {
      from: 'active',
      to: 'expired',
      action: 'expire_personal',
      allowedActors: ['system'],
      guardDescription: 'personal_duration_minutes was set on session; NOW() > personal_expires_at stored in transaction metadata at check-in; auto-expired by cron',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const sharedCapacityAccessPricing: PricingConfig = {
  applyTax: true,
  applyFees: false,
  supportsCoupons: true,
  supportsGiftCards: true,
  supportsLoyaltyRedemption: true,
  earnsLoyaltyPoints: true,
  deductsInventory: false, // Capacity is checked, not inventory
  rounding: 'round',
  decimalPlaces: 2,
};

// ============================================
// Interaction Contracts
// ============================================

export const sharedCapacityAccessInteractions: InteractionContract[] = [
  {
    name: 'earn_loyalty_on_purchase',
    applicableEngines: ['shared_capacity_access'],
    trigger: 'on_purchase',
    guardDescription: 'Customer has loyalty membership; ticket purchase is successful',
    idempotent: true,
    failureMode: 'log_and_continue',
    compensatingAction: 'Reverse loyalty points if ticket is cancelled and refunded',
  },
  {
    name: 'check_capacity_on_entry',
    applicableEngines: ['shared_capacity_access'],
    trigger: 'on_check_in',
    guardDescription: 'Current occupancy + ticket guests <= max capacity for session',
    idempotent: true,
    failureMode: 'block',
  },
  {
    name: 'decrement_capacity_on_exit',
    applicableEngines: ['shared_capacity_access'],
    trigger: 'on_check_out',
    guardDescription: 'Guest count is decremented; current_count cannot go below 0',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
  {
    name: 'set_personal_expiry_on_entry',
    applicableEngines: ['shared_capacity_access'],
    trigger: 'on_check_in',
    guardDescription: 'Session has personal_duration_minutes set; stores personal_expires_at = NOW() + personal_duration_minutes as TIMESTAMPTZ in transaction metadata; cron uses this to fire expire_personal',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
];

// ============================================
// Complete Engine Definition
// ============================================

export const sharedCapacityAccessEngine: EngineDefinition<SharedCapacityAccessStatus> = {
  type: 'shared_capacity_access',
  name: 'Shared Capacity Access',
  description: 'Purchase → Validate → Enter → Exit. Session-based shared facility access. Sessions use TIMESTAMPTZ (midnight-spanning supported). personal_duration_minutes enables per-holder timed access from check-in.',
  commercialEntity: 'ticket',
  stateMachine: sharedCapacityAccessStateMachine,
  pricing: sharedCapacityAccessPricing,
  interactions: sharedCapacityAccessInteractions,
  // Economics data extraction capabilities
  dataExtraction: {
    capacityUtilization: {
      enabled: true,
      fields: ['sessionTime', 'occupancyRate', 'turnawayCount'],
      description: 'Measure peak hours and capacity limits'
    },
    cancellationTracking: {
      enabled: true,
      fields: ['cancellationReason', 'refundAmount', 'noShow'],
      description: 'Track ticket cancellations and no-shows'
    },
    salesPatterns: {
      enabled: true,
      fields: ['walkInVsPrebooked', 'groupSize', 'addonsPurchased'],
      description: 'Analyze ticket purchasing behavior'
    }
  }
};
