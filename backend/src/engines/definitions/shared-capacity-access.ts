/**
 * Engine C: Shared Capacity Access
 * 
 * Economic Pattern: Purchase → Validate → Enter → Exit
 * Commercial Entity: Ticket
 * Examples: Pool, Gym, Spa, Waterpark, Game Room, Cinema
 * 
 * This engine handles:
 *   - Sessions with time slots, capacity limits, and pricing
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
      guardDescription: 'Ticket is for today; session time has started; capacity not exceeded',
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

    // Expiration
    {
      from: 'valid',
      to: 'expired',
      action: 'expire',
      allowedActors: ['system'],
      guardDescription: 'Ticket date has passed without entry (auto-expired by cron)',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const sharedCapacityAccessPricing: PricingConfig = {
  applyTax: true,
  applyServiceCharge: false,
  applyDeliveryFee: false,
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
];

// ============================================
// Complete Engine Definition
// ============================================

export const sharedCapacityAccessEngine: EngineDefinition<SharedCapacityAccessStatus> = {
  type: 'shared_capacity_access',
  name: 'Shared Capacity Access',
  description: 'Purchase → Validate → Enter → Exit. Session-based shared facility access.',
  commercialEntity: 'ticket',
  stateMachine: sharedCapacityAccessStateMachine,
  pricing: sharedCapacityAccessPricing,
  interactions: sharedCapacityAccessInteractions,
};
