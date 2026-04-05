/**
 * Engine B: Time-Exclusive Reservation
 * 
 * Economic Pattern: Reserve → Confirm → Check-In → Occupy → Check-Out
 * Commercial Entity: Booking
 * Examples: Chalets, Hotel Rooms, Villas, Private Cabanas
 * 
 * This engine handles:
 *   - Bookable units (chalets, rooms) with capacity, amenities, images
 *   - Night-by-night pricing with weekend/holiday/seasonal rules
 *   - Add-ons (per-night or one-time): BBQ, extra bedding, etc.
 *   - Deposit collection (fixed or percentage)
 *   - Availability checking with conflict prevention
 *   - Housekeeping integration (on check-out)
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  TimeExclusiveReservationStatus,
} from '../types.js';

// ============================================
// State Machine
// ============================================

export const timeExclusiveReservationStateMachine: StateMachineDefinition<TimeExclusiveReservationStatus> = {
  states: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],

  initialState: 'pending',

  terminalStates: ['checked_out', 'cancelled', 'no_show'],

  transitions: [
    // Happy path
    {
      from: 'pending',
      to: 'confirmed',
      action: 'confirm',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Payment/deposit received or manual confirmation by staff',
    },
    {
      from: 'confirmed',
      to: 'checked_in',
      action: 'check_in',
      allowedActors: ['staff'],
      guardDescription: 'Check-in date has arrived; unit is clean and ready',
    },
    {
      from: 'pending',
      to: 'checked_in',
      action: 'check_in',
      allowedActors: ['staff', 'admin'],
      guardDescription: 'Walk-in or direct check-in without prior confirmation',
    },
    {
      from: 'checked_in',
      to: 'checked_out',
      action: 'check_out',
      allowedActors: ['staff'],
      guardDescription: 'Guest has vacated the unit; balance is settled',
    },

    // Cancellation
    {
      from: 'pending',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Free cancellation if within cancellation policy window',
    },
    {
      from: 'confirmed',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'May incur cancellation fee depending on policy and timing',
    },

    // No-show
    {
      from: 'pending',
      to: 'no_show',
      action: 'mark_no_show',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Check-in date has passed without arrival',
    },
    {
      from: 'confirmed',
      to: 'no_show',
      action: 'mark_no_show',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Check-in date has passed without arrival (auto-detected or manual)',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const timeExclusiveReservationPricing: PricingConfig = {
  applyTax: true,
  applyServiceCharge: false,
  applyDeliveryFee: false,
  supportsCoupons: true,
  supportsGiftCards: true,
  supportsLoyaltyRedemption: true,
  earnsLoyaltyPoints: true,
  deductsInventory: false, // Availability is checked, not inventory
  rounding: 'round',
  decimalPlaces: 2,
};

// ============================================
// Interaction Contracts
// ============================================

export const timeExclusiveReservationInteractions: InteractionContract[] = [
  {
    name: 'earn_loyalty_on_payment',
    applicableEngines: ['time_exclusive_reservation'],
    trigger: 'on_payment',
    guardDescription: 'Customer has loyalty membership; full payment or deposit is received',
    idempotent: true,
    failureMode: 'log_and_continue',
    compensatingAction: 'Reverse loyalty points if booking is cancelled and refunded',
  },
  {
    name: 'trigger_housekeeping_on_checkout',
    applicableEngines: ['time_exclusive_reservation'],
    trigger: 'on_check_out',
    guardDescription: 'Unit has housekeeping integration enabled',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
  {
    name: 'block_availability_on_confirm',
    applicableEngines: ['time_exclusive_reservation'],
    trigger: 'on_purchase',
    guardDescription: 'Unit must be available for the requested dates (no overlapping bookings)',
    idempotent: true,
    failureMode: 'block',
  },
  {
    name: 'release_availability_on_cancel',
    applicableEngines: ['time_exclusive_reservation'],
    trigger: 'on_cancel',
    guardDescription: 'Booking dates become available again',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
];

// ============================================
// Complete Engine Definition
// ============================================

export const timeExclusiveReservationEngine: EngineDefinition<TimeExclusiveReservationStatus> = {
  type: 'time_exclusive_reservation',
  name: 'Time-Exclusive Reservation',
  description: 'Reserve → Confirm → Check-In → Occupy → Check-Out. Night-based exclusive booking.',
  commercialEntity: 'booking',
  stateMachine: timeExclusiveReservationStateMachine,
  pricing: timeExclusiveReservationPricing,
  interactions: timeExclusiveReservationInteractions,
};
