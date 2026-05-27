/**
 * Engine E: Platform Entitlement
 *
 * Economic Pattern: Sign-up → Trial → Activate → Renew / Dunning / Cancel
 * Commercial Entity: SaaS Subscription (B2B — operator pays V2 for platform access)
 * Examples: Starter plan, Growth plan, Enterprise plan
 *
 * This engine handles platform-level billing: a business pays V2 a monthly or
 * annual fee for access to the operator dashboard and all guest-facing modules.
 *
 * It is intentionally separate from Engine D (ongoing_entitlement) which manages
 * end-customer memberships within a tenant. Engine E exists one layer above the
 * tenant hierarchy and is only consumed by the provisioning and SaasBillingService.
 *
 * State machine: trialing → active ⇄ past_due → suspended → cancelled
 *   - Dunning is a first-class state (past_due) not a flag
 *   - Suspended is a side branch: read-only access remains, write access is blocked
 *   - Cancellation is terminal; re-activation requires a new checkout flow
 *
 * Pricing: clean recurring amounts only — no gift cards, no loyalty, no delivery,
 * no service charge. Tax applied based on billing jurisdiction (handled by Stripe Tax).
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  PlatformEntitlementStatus,
} from '../types.js';

// ============================================
// State Machine
// ============================================

export const platformEntitlementStateMachine: StateMachineDefinition<PlatformEntitlementStatus> = {
  states: ['trialing', 'active', 'past_due', 'suspended', 'cancelled'],

  initialState: 'trialing',

  terminalStates: ['cancelled'],

  transitions: [
    // trialing → active (first successful payment or trial converted)
    {
      from: 'trialing',
      to: 'active',
      action: 'activate',
      allowedActors: ['system'],
      guardDescription: 'Stripe invoice.paid received for first billing cycle, or admin manually converts trial',
    },

    // trialing → cancelled (trial abandoned, no payment method added)
    {
      from: 'trialing',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['system', 'admin'],
      guardDescription: 'Trial period expired with no payment, or operator cancels during trial',
    },

    // active → active (successful renewal)
    {
      from: 'active',
      to: 'active',
      action: 'renew',
      allowedActors: ['system'],
      guardDescription: 'Stripe invoice.paid for a renewal cycle — extends current_period_end',
    },

    // active → past_due (payment failed, grace period starts)
    {
      from: 'active',
      to: 'past_due',
      action: 'payment_failed',
      allowedActors: ['system'],
      guardDescription: 'Stripe invoice.payment_failed received — dunning period begins',
    },

    // past_due → active (payment recovered during dunning)
    {
      from: 'past_due',
      to: 'active',
      action: 'payment_recovered',
      allowedActors: ['system'],
      guardDescription: 'Stripe invoice.paid received after previous failure — dunning cleared',
    },

    // past_due → suspended (dunning exhausted, grace period elapsed)
    {
      from: 'past_due',
      to: 'suspended',
      action: 'suspend',
      allowedActors: ['system', 'admin'],
      guardDescription: 'All Stripe dunning retries exhausted (typically 3–7 days), or platform admin manual suspension',
    },

    // suspended → active (payment updated and collected)
    {
      from: 'suspended',
      to: 'active',
      action: 'reactivate',
      allowedActors: ['system', 'admin'],
      guardDescription: 'Stripe payment method updated and outstanding invoice paid, or admin manual reactivation',
    },

    // suspended → cancelled (operator gives up or admin terminates)
    {
      from: 'suspended',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['system', 'admin'],
      guardDescription: 'Stripe customer.subscription.deleted received, or platform admin hard-cancels',
    },

    // active → cancelled (voluntary cancellation)
    {
      from: 'active',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['admin'],
      guardDescription: 'Operator cancels subscription; effective at period end or immediately per Stripe config',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const platformEntitlementPricing: PricingConfig = {
  // Tax applied via Stripe Tax in billing jurisdiction — not computed by pricing pipeline
  applyTax: false,
  applyServiceCharge: false,
  applyDeliveryFee: false,
  supportsCoupons: false,
  supportsGiftCards: false,
  supportsLoyaltyRedemption: false,
  earnsLoyaltyPoints: false,
  deductsInventory: false,
  rounding: 'round',
  decimalPlaces: 2,
};

// ============================================
// Interaction Contracts
// ============================================

export const platformEntitlementInteractions: InteractionContract[] = [
  {
    name: 'provision_tenant_on_activate',
    applicableEngines: ['platform_entitlement'],
    trigger: 'on_purchase',
    guardDescription: 'Stripe checkout.session.completed or customer.subscription.created — triggers ProvisioningService',
    idempotent: true,
    failureMode: 'retry',
    compensatingAction: 'Cancel Stripe subscription if provisioning fails after max retries',
  },
  {
    name: 'send_dunning_notification',
    applicableEngines: ['platform_entitlement'],
    trigger: 'on_payment',
    guardDescription: 'invoice.payment_failed — email operator with payment update link',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
  {
    name: 'block_write_access_on_suspend',
    applicableEngines: ['platform_entitlement'],
    trigger: 'on_cancel',
    guardDescription: 'Tenant billing_status flipped to suspended — tenant middleware returns 402 on mutating requests',
    idempotent: true,
    failureMode: 'block',
    compensatingAction: 'Restore access immediately on reactivation',
  },
  {
    name: 'deprovision_on_cancel',
    applicableEngines: ['platform_entitlement'],
    trigger: 'on_cancel',
    guardDescription: 'customer.subscription.deleted — mark tenant cancelled, schedule data retention window',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
];

// ============================================
// Complete Engine Definition
// ============================================

export const platformEntitlementEngine: EngineDefinition<PlatformEntitlementStatus> = {
  type: 'platform_entitlement',
  name: 'Platform Entitlement',
  description: 'SaaS subscription lifecycle for operator access to the V2 platform. Trialing → Active ⇄ Past Due → Suspended → Cancelled.',
  commercialEntity: 'saas_subscription',
  stateMachine: platformEntitlementStateMachine,
  pricing: platformEntitlementPricing,
  interactions: platformEntitlementInteractions,
  dataExtraction: {
    mrr: {
      enabled: true,
      fields: ['amount', 'currency', 'billingInterval', 'tier'],
      description: 'Monthly Recurring Revenue by tier for the control plane dashboard',
    },
    churn: {
      enabled: true,
      fields: ['cancellationReason', 'trialConverted', 'daysActive'],
      description: 'Track trial-to-paid conversion and voluntary/involuntary churn',
    },
    dunning: {
      enabled: true,
      fields: ['failureCount', 'gracePeriodDays', 'recoveryMethod'],
      description: 'Measure dunning effectiveness and payment recovery rates',
    },
  },
};
