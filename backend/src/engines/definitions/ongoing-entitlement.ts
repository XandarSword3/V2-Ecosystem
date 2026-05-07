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
 * This definition is live and used by EngineService.
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
    // pending -> active
    {
      from: 'pending',
      to: 'active',
      action: 'activate',
      allowedActors: ['system', 'admin', 'staff'],
      guardDescription: 'Initial payment verified or manually activated by staff/admin',
    },

    // active -> paused
    {
      from: 'active',
      to: 'paused',
      action: 'pause',
      allowedActors: ['admin', 'staff'],
      guardDescription: 'Membership paused by staff/admin action',
    },

    // paused -> active
    {
      from: 'paused',
      to: 'active',
      action: 'resume',
      allowedActors: ['admin', 'staff'],
      guardDescription: 'Membership resumed by staff/admin action',
    },

    // active/paused -> cancelled
    {
      from: 'active',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Cancellation while active',
    },
    {
      from: 'paused',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Cancellation while paused',
    },

    // active -> expired
    {
      from: 'active',
      to: 'expired',
      action: 'expire',
      allowedActors: ['system'],
      guardDescription: 'Expiration via renewal failure/cron',
    },

    // active -> active
    {
      from: 'active',
      to: 'active',
      action: 'renew',
      allowedActors: ['system'],
      guardDescription: 'Successful renewal extends end_date',
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
  supportsCoupons: false,
  supportsGiftCards: false,
  supportsLoyaltyRedemption: false,
  earnsLoyaltyPoints: true,
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
  // Economics data extraction capabilities
  dataExtraction: {
    churnTracking: {
      enabled: true,
      fields: ['churnReason', 'activeMonths', 'lifetimeValue'],
      description: 'Track subscription cancellations and customer retention'
    },
    renewalPatterns: {
      enabled: true,
      fields: ['autoRenewing', 'renewalCount', 'billingCycle'],
      description: 'Analyze subscription term lengths'
    },
    engagementTracking: {
      enabled: true,
      fields: ['usageFrequency', 'lastActiveDate'],
      description: 'Measure member engagement with their entitlement'
    }
  }
};
