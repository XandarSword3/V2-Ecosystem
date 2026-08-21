/**
 * Engine D: Ongoing Entitlement
 * 
 * Economic Pattern: Subscribe → Activate → Use → Renew/Cancel
 * Commercial Entity: Subscription/Membership
 * Examples: Pool Membership, Facility Membership, VIP Club, Season Pass
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

    // active -> active (plan change)
    {
      from: 'active',
      to: 'active',
      action: 'change_plan',
      allowedActors: ['admin', 'staff'],
      guardDescription: 'Plan tier changed mid-cycle; Stripe proration applied via create_prorations',
    },

    // expired -> pending (customer resubscribes — new billing cycle, same membership record)
    {
      from: 'expired',
      to: 'pending',
      action: 'resubscribe',
      allowedActors: ['customer', 'system'],
      guardDescription: 'Customer initiates a new subscription on an expired membership; new Stripe billing cycle begins; setup_recurring_billing fires to recreate the Stripe subscription',
    },

  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const ongoingEntitlementPricing: PricingConfig = {
  applyTax: true,
  applyFees: false,
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
  {
    name: 'prorate_plan_change',
    applicableEngines: ['ongoing_entitlement'],
    trigger: 'on_plan_change',
    guardDescription: 'Retrieve current Stripe subscription; call stripe.subscriptions.update with new price and proration_behavior: create_prorations',
    idempotent: true,
    failureMode: 'block',
    compensatingAction: 'Revert to previous plan tier if Stripe update fails',
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
  capabilities: {
    transactionModel: {
      supportsDraft: false,
      autoComplete: false,
      states: ['pending', 'active', 'paused', 'expired', 'cancelled'],
    },
    commitment: {
      type: 'none',
    },
    fulfillment: {
      required: false,
      options: [
        { mode: 'service_execution', destinations: ['service_location'] },
      ],
      groups: false,
      tracking: false,
      handoff: false,
    },
    execution: {
      enabled: true,
      workCenters: false,
      operators: false,
      states: ['active', 'paused', 'expired'],
      notificationTrigger: 'on_confirm',
    },
    economics: {
      multiTender: false,
      refunds: true,
      voids: true,
      ledger: true,
      loyalty: 'earn',
      coupons: false,
      giftCards: false,
      pos: false,
      currencyRequired: true,
    },
    customer: {
      guests: false,
      accounts: true,
      staffAssisted: true,
      reviews: true,
      serviceRecovery: true,
    },
    fiscal: {
      documents: ['invoice', 'receipt', 'credit_note'],
      eInvoicing: false,
      controlledNumbering: true,
    },
    returns: {
      refund: 'full',
      physicalReturn: false,
      exchange: false,
      replacement: false,
      cancellation: true,
    },
  },
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
