/**
 * Engine D: Ongoing Entitlement
 * 
 * Economic Pattern: Subscribe → Activate → Use → Renew/Cancel
 * Commercial Entity: Subscription/Membership
 * Examples: Pool Membership, Gym Membership, VIP Club, Season Pass
 * 
 * This engine handles:
 *   - Subscription plans with billing cycles (monthly, quarterly, annual)
 *   - Tier-based pricing with feature unlocks
 *   - Auto-renewal via Stripe recurring billing
 *   - Usage tracking (visits, sessions consumed)
 *   - Grace periods for expired subscriptions
 *   - Pause/resume capability
 * 
 * NOTE: This engine is currently PLANNED. The existing pool-membership.service.ts
 * has hardcoded pricing and no state machine. This definition formalizes what
 * the subscription engine should become.
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  OngoingEntitlementStatus,
} from '../types.js';

// ============================================
// State Machine
// ============================================

export const ongoingEntitlementStateMachine: StateMachineDefinition<OngoingEntitlementStatus> = {
  states: ['pending', 'active', 'paused', 'expired', 'cancelled'],

  initialState: 'pending',

  terminalStates: ['cancelled'],

  transitions: [
    // Activation
    {
      from: 'pending',
      to: 'active',
      action: 'activate',
      allowedActors: ['system', 'staff'],
      guardDescription: 'Initial payment received and verified',
    },

    // Renewal (active remains active)
    {
      from: 'active',
      to: 'active',
      action: 'renew',
      allowedActors: ['system'],
      guardDescription: 'Recurring payment succeeded; extends end_date',
    },

    // Pause
    {
      from: 'active',
      to: 'paused',
      action: 'pause',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Pause count within policy limit; remaining days frozen',
    },

    // Resume
    {
      from: 'paused',
      to: 'active',
      action: 'resume',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Pause period ended or customer requests early resume',
    },

    // Expiration
    {
      from: 'active',
      to: 'expired',
      action: 'expire',
      allowedActors: ['system'],
      guardDescription: 'End date passed and auto-renewal failed or is disabled',
    },
    {
      from: 'paused',
      to: 'expired',
      action: 'expire',
      allowedActors: ['system'],
      guardDescription: 'Max pause duration exceeded without resume',
    },

    // Re-activation from expired (within grace period)
    {
      from: 'expired',
      to: 'active',
      action: 'reactivate',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Within grace period; payment received',
    },

    // Cancellation
    {
      from: 'active',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Customer requests cancellation; effective at end of current period or immediate',
    },
    {
      from: 'paused',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Customer cancels while paused',
    },
    {
      from: 'pending',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Subscription cancelled before activation',
    },
    {
      from: 'expired',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['staff', 'admin', 'system'],
      guardDescription: 'Grace period passed without reactivation',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const ongoingEntitlementPricing: PricingConfig = {
  applyTax: true,
  applyServiceCharge: false,
  applyDeliveryFee: false,
  supportsCoupons: true,    // Promo codes for subscription discounts
  supportsGiftCards: false,  // Gift cards typically not used for recurring
  supportsLoyaltyRedemption: false, // Loyalty points not redeemable against subscriptions
  earnsLoyaltyPoints: true,  // Subscriptions earn loyalty points per billing cycle
  deductsInventory: false,
  rounding: 'round',
  decimalPlaces: 2,
};

// ============================================
// Interaction Contracts
// ============================================

export const ongoingEntitlementInteractions: InteractionContract[] = [
  {
    name: 'earn_loyalty_per_billing_cycle',
    applicableEngines: ['ongoing_entitlement'],
    trigger: 'on_payment',
    guardDescription: 'Recurring payment succeeded; customer has loyalty membership',
    idempotent: true,
    failureMode: 'log_and_continue',
    compensatingAction: 'No reversal — loyalty is earned per paid period',
  },
  {
    name: 'grant_facility_access_on_activate',
    applicableEngines: ['ongoing_entitlement'],
    trigger: 'on_check_in',
    guardDescription: 'Subscription is active and not expired; facility access gates check membership',
    idempotent: true,
    failureMode: 'block',
  },
  {
    name: 'setup_recurring_billing',
    applicableEngines: ['ongoing_entitlement'],
    trigger: 'on_purchase',
    guardDescription: 'Stripe subscription created with selected plan/billing cycle',
    idempotent: true,
    failureMode: 'block',
    compensatingAction: 'Cancel Stripe subscription if activation fails',
  },
];

// ============================================
// Complete Engine Definition
// ============================================

export const ongoingEntitlementEngine: EngineDefinition<OngoingEntitlementStatus> = {
  type: 'ongoing_entitlement',
  name: 'Ongoing Entitlement',
  description: 'Subscribe → Activate → Use → Renew/Cancel. Recurring subscription-based access.',
  commercialEntity: 'subscription',
  stateMachine: ongoingEntitlementStateMachine,
  pricing: ongoingEntitlementPricing,
  interactions: ongoingEntitlementInteractions,
};
