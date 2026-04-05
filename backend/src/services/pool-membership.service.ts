/**
 * Pool Membership Service
 * 
 * Handles annual memberships, corporate accounts, and recurring billing.
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { stripeClient } from '../config/stripe.js';
import { emailService } from './email.service.js';
import Stripe from 'stripe';

export enum MembershipType {
  INDIVIDUAL = 'INDIVIDUAL',
  FAMILY = 'FAMILY',
  CORPORATE = 'CORPORATE',
  VIP = 'VIP',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

interface MembershipPricing {
  type: MembershipType;
  billingCycle: BillingCycle;
  basePrice: number;
  maxMembers: number;
  dailyAccessLimit: number; // 0 = unlimited
  guestPasses: number;
  discountPercentage: number;
}

// Default membership pricing
const MEMBERSHIP_PRICING: MembershipPricing[] = [
  {
    type: MembershipType.INDIVIDUAL,
    billingCycle: BillingCycle.MONTHLY,
    basePrice: 49.99,
    maxMembers: 1,
    dailyAccessLimit: 1,
    guestPasses: 2,
    discountPercentage: 10,
  },
  {
    type: MembershipType.INDIVIDUAL,
    billingCycle: BillingCycle.ANNUALLY,
    basePrice: 449.99,
    maxMembers: 1,
    dailyAccessLimit: 1,
    guestPasses: 24,
    discountPercentage: 15,
  },
  {
    type: MembershipType.FAMILY,
    billingCycle: BillingCycle.MONTHLY,
    basePrice: 99.99,
    maxMembers: 5,
    dailyAccessLimit: 0,
    guestPasses: 4,
    discountPercentage: 15,
  },
  {
    type: MembershipType.FAMILY,
    billingCycle: BillingCycle.ANNUALLY,
    basePrice: 899.99,
    maxMembers: 5,
    dailyAccessLimit: 0,
    guestPasses: 48,
    discountPercentage: 20,
  },
  {
    type: MembershipType.CORPORATE,
    billingCycle: BillingCycle.ANNUALLY,
    basePrice: 2499.99,
    maxMembers: 20,
    dailyAccessLimit: 0,
    guestPasses: 100,
    discountPercentage: 25,
  },
  {
    type: MembershipType.VIP,
    billingCycle: BillingCycle.ANNUALLY,
    basePrice: 999.99,
    maxMembers: 2,
    dailyAccessLimit: 0,
    guestPasses: 0, // Unlimited
    discountPercentage: 30,
  },
];

interface CreateMembershipInput {
  userId: string;
  type: MembershipType;
  billingCycle: BillingCycle;
  memberEmails?: string[];
  corporateName?: string;
  paymentMethodId?: string;
}

interface MembershipResult {
  success: boolean;
  message: string;
  membership?: any;
  subscriptionId?: string;
  clientSecret?: string;
  statusCode?: number;
  code?: string;
}

function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim());
}

function isStripeAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const stripeError = error as { type?: string; message?: string };
  return (
    stripeError.type === 'StripeAuthenticationError' ||
    (typeof stripeError.message === 'string' && /api key|authentication/i.test(stripeError.message))
  );
}

function billingUnavailableResult(message = 'Membership billing is currently unavailable. Please try again later.'): MembershipResult {
  return {
    success: false,
    message,
    statusCode: 503,
    code: 'BILLING_UNAVAILABLE',
  };
}

/**
 * Get membership pricing
 */
export function getMembershipPricing(
  type: MembershipType,
  billingCycle: BillingCycle
): MembershipPricing | null {
  return MEMBERSHIP_PRICING.find(
    p => p.type === type && p.billingCycle === billingCycle
  ) || null;
}

/**
 * Get all available membership plans
 */
export function getAllMembershipPlans(): MembershipPricing[] {
  return MEMBERSHIP_PRICING;
}

/**
 * Create a new membership
 */
export async function createMembership(
  input: CreateMembershipInput
): Promise<MembershipResult> {
  try {
    if (!isStripeConfigured()) {
      logger.warn('Membership creation blocked: Stripe secret key is not configured');
      return billingUnavailableResult();
    }

    const pricing = getMembershipPricing(input.type, input.billingCycle);
    
    if (!pricing) {
      return {
        success: false,
        message: 'Invalid membership type or billing cycle',
      };
    }

    // Check if user already has an active membership
    const supabase = getSupabase();
    const { data: existingMembership, error: existingError } = await supabase
      .from('pool_memberships')
      .select('id')
      .eq('user_id', input.userId)
      .eq('status', MembershipStatus.ACTIVE)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingMembership) {
      return {
        success: false,
        message: 'User already has an active membership',
      };
    }

    // Validate member count for family/corporate
    if (input.memberEmails && input.memberEmails.length > pricing.maxMembers - 1) {
      return {
        success: false,
        message: `Maximum ${pricing.maxMembers} members allowed for this plan`,
      };
    }

    // Get or create Stripe customer
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', input.userId)
      .maybeSingle();
    if (userError) throw userError;

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    let stripeCustomerId = user.stripe_customer_id;
    
    if (!stripeCustomerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        metadata: { userId: input.userId },
      });
      
      stripeCustomerId = customer.id;
      
      const { error: updateUserError } = await supabase
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', input.userId);
      if (updateUserError) throw updateUserError;
    }

    // Create or get Stripe price
    const stripePriceId = await getOrCreateStripePrice(pricing);

    // Create Stripe subscription
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomerId,
      items: [{ price: stripePriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    };

    if (input.paymentMethodId) {
      subscriptionParams.default_payment_method = input.paymentMethodId;
    }

    const subscription = await stripeClient.subscriptions.create(subscriptionParams);

    // Calculate membership dates
    const startDate = new Date();
    const endDate = calculateEndDate(startDate, input.billingCycle);

    // Create membership in database
    const { data: membership, error: membershipError } = await supabase
      .from('pool_memberships')
      .insert({
        user_id: input.userId,
        type: input.type,
        billing_cycle: input.billingCycle,
        status: MembershipStatus.PENDING_PAYMENT,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        price: pricing.basePrice,
        stripe_subscription_id: subscription.id,
        corporate_name: input.corporateName,
        max_members: pricing.maxMembers,
        remaining_guest_passes: pricing.guestPasses,
        discount_percentage: pricing.discountPercentage,
      })
      .select()
      .single();
    if (membershipError) throw membershipError;

    // Add additional members if provided
    if (input.memberEmails && input.memberEmails.length > 0) {
      for (const email of input.memberEmails) {
        const { error: memberError } = await supabase
          .from('membership_members')
          .insert({
            membership_id: membership.id,
            email,
            status: 'PENDING_INVITATION',
          });
        if (memberError) throw memberError;
        
        // Send invitation email
        await sendMemberInvitation(email, membership, user);
      }
    }

    // Get client secret for payment
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    logger.info('Pool membership created', {
      userId: input.userId,
      membershipId: membership.id,
      type: input.type,
    });

    return {
      success: true,
      message: 'Membership created. Please complete payment.',
      membership,
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret || undefined,
    };
  } catch (error: any) {
    if (isStripeAuthError(error)) {
      logger.error('Failed to create membership due to Stripe authentication error', {
        error: error?.message,
      });
      return billingUnavailableResult();
    }

    logger.error('Failed to create membership', { error: error.message });
    throw error;
  }
}

/**
 * Cancel membership
 */
export async function cancelMembership(
  membershipId: string,
  userId: string,
  reason?: string,
  immediate: boolean = false
): Promise<MembershipResult> {
  try {
    const supabase = getSupabase();
    const { data: membership, error: membershipError } = await supabase
      .from('pool_memberships')
      .select('*')
      .eq('id', membershipId)
      .maybeSingle();
    if (membershipError) throw membershipError;

    if (!membership) {
      return { success: false, message: 'Membership not found' };
    }

    if (membership.user_id !== userId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      return { success: false, message: 'Membership is not active' };
    }

    // Cancel Stripe subscription
    if (membership.stripe_subscription_id) {
      if (!isStripeConfigured()) {
        logger.warn('Membership cancellation blocked: Stripe secret key is not configured', {
          membershipId,
          userId,
        });
        return billingUnavailableResult('Membership billing is currently unavailable. Unable to cancel subscription right now.');
      }

      await stripeClient.subscriptions.update(membership.stripe_subscription_id, {
        cancel_at_period_end: !immediate,
      });

      if (immediate) {
        await stripeClient.subscriptions.cancel(membership.stripe_subscription_id);
      }
    }

    // Update membership status
    const { error: updateError } = await supabase
      .from('pool_memberships')
      .update({
        status: immediate ? MembershipStatus.CANCELLED : MembershipStatus.ACTIVE,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        auto_renew: false,
      })
      .eq('id', membershipId);
    if (updateError) throw updateError;

    logger.info('Pool membership cancelled', {
      membershipId,
      userId,
      immediate,
    });

    return {
      success: true,
      message: immediate 
        ? 'Membership cancelled immediately' 
        : 'Membership will be cancelled at the end of the billing period',
    };
  } catch (error: any) {
    if (isStripeAuthError(error)) {
      logger.error('Failed to cancel membership due to Stripe authentication error', {
        membershipId,
        userId,
        error: error?.message,
      });
      return billingUnavailableResult('Membership billing is currently unavailable. Unable to cancel subscription right now.');
    }

    logger.error('Failed to cancel membership', { error: error.message });
    throw error;
  }
}

/**
 * Validate membership access
 */
export async function validateMembershipAccess(
  userId: string
): Promise<{
  hasAccess: boolean;
  membership?: any;
  remainingGuestPasses?: number;
  discountPercentage?: number;
}> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  // Check direct membership
  const { data: directMembership, error: directError } = await supabase
    .from('pool_memberships')
    .select('*, members:membership_members(*)')
    .eq('user_id', userId)
    .eq('status', MembershipStatus.ACTIVE)
    .gte('end_date', now)
    .limit(1)
    .maybeSingle();
  if (directError) throw directError;

  let membership = directMembership;

  // If no direct membership, check via membership_members
  if (!membership) {
    const { data: memberRecord, error: memberError } = await supabase
      .from('membership_members')
      .select('membership_id')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();
    if (memberError) throw memberError;

    if (memberRecord) {
      const { data: parentMembership, error: parentError } = await supabase
        .from('pool_memberships')
        .select('*, members:membership_members(*)')
        .eq('id', memberRecord.membership_id)
        .eq('status', MembershipStatus.ACTIVE)
        .gte('end_date', now)
        .maybeSingle();
      if (parentError) throw parentError;
      membership = parentMembership;
    }
  }

  if (!membership) {
    return { hasAccess: false };
  }

  return {
    hasAccess: true,
    membership,
    remainingGuestPasses: membership.remaining_guest_passes,
    discountPercentage: membership.discount_percentage ? Number(membership.discount_percentage) : 0,
  };
}

/**
 * Use a guest pass
 */
export async function useGuestPass(
  membershipId: string,
  guestName: string,
  guestEmail?: string
): Promise<{ success: boolean; message: string; remainingPasses?: number }> {
  const supabase = getSupabase();
  const { data: membership, error: membershipError } = await supabase
    .from('pool_memberships')
    .select('*')
    .eq('id', membershipId)
    .maybeSingle();
  if (membershipError) throw membershipError;

  if (!membership) {
    return { success: false, message: 'Membership not found' };
  }

  if (membership.status !== MembershipStatus.ACTIVE) {
    return { success: false, message: 'Membership is not active' };
  }

  // VIP has unlimited passes
  if (membership.type !== MembershipType.VIP && membership.remaining_guest_passes <= 0) {
    return { success: false, message: 'No guest passes remaining' };
  }

  // Record guest pass usage
  const { error: usageError } = await supabase
    .from('guest_pass_usage')
    .insert({
      membership_id: membershipId,
      guest_name: guestName,
      guest_email: guestEmail,
      used_at: new Date().toISOString(),
    });
  if (usageError) throw usageError;

  // Decrement remaining passes (except for VIP)
  if (membership.type !== MembershipType.VIP) {
    const { error: updateError } = await supabase
      .from('pool_memberships')
      .update({ remaining_guest_passes: membership.remaining_guest_passes - 1 })
      .eq('id', membershipId);
    if (updateError) throw updateError;
  }

  return {
    success: true,
    message: 'Guest pass used successfully',
    remainingPasses: membership.type === MembershipType.VIP 
      ? -1 // Unlimited
      : membership.remaining_guest_passes - 1,
  };
}

/**
 * Process membership renewal (called by webhook)
 */
export async function processRenewal(
  subscriptionId: string
): Promise<void> {
  const supabase = getSupabase();
  const { data: membership, error: membershipError } = await supabase
    .from('pool_memberships')
    .select('*, user:users(*)')
    .eq('stripe_subscription_id', subscriptionId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;

  if (!membership) {
    logger.warn('Membership not found for renewal', { subscriptionId });
    return;
  }

  const pricing = getMembershipPricing(
    membership.type as MembershipType,
    membership.billing_cycle as BillingCycle
  );

  const newEndDate = calculateEndDate(
    new Date(membership.end_date || new Date()),
    membership.billing_cycle as BillingCycle
  );

  const { error: updateError } = await supabase
    .from('pool_memberships')
    .update({
      end_date: newEndDate.toISOString(),
      remaining_guest_passes: pricing?.guestPasses || membership.remaining_guest_passes,
      renewed_at: new Date().toISOString(),
    })
    .eq('id', membership.id);
  if (updateError) throw updateError;

  // Send renewal confirmation
  await emailService.sendEmail({
    to: membership.user.email,
    subject: 'Pool Membership Renewed',
    html: `
      <h2>Membership Renewal Confirmation</h2>
      <p>Your ${membership.type} pool membership has been renewed.</p>
      <p><strong>New expiration date:</strong> ${newEndDate.toLocaleDateString()}</p>
      <p><strong>Guest passes refreshed:</strong> ${pricing?.guestPasses || 0}</p>
    `,
  });

  logger.info('Membership renewed', { membershipId: membership.id, newEndDate });
}

/**
 * Handle failed payment (called by webhook)
 */
export async function handleFailedPayment(
  subscriptionId: string
): Promise<void> {
  const supabase = getSupabase();
  const { data: membership, error: membershipError } = await supabase
    .from('pool_memberships')
    .select('*, user:users(*)')
    .eq('stripe_subscription_id', subscriptionId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;

  if (!membership) return;

  const { error: updateError } = await supabase
    .from('pool_memberships')
    .update({ status: MembershipStatus.SUSPENDED })
    .eq('id', membership.id);
  if (updateError) throw updateError;

  // Send notification
  await emailService.sendEmail({
    to: membership.user.email,
    subject: 'Pool Membership Payment Failed',
    html: `
      <h2>Payment Failed</h2>
      <p>We were unable to process your membership payment.</p>
      <p>Your membership has been suspended. Please update your payment method to restore access.</p>
    `,
  });

  logger.warn('Membership suspended due to failed payment', {
    membershipId: membership.id,
  });
}

// Helper functions
function calculateEndDate(startDate: Date, billingCycle: BillingCycle): Date {
  const endDate = new Date(startDate);
  
  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case BillingCycle.ANNUALLY:
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }
  
  return endDate;
}

async function getOrCreateStripePrice(pricing: MembershipPricing): Promise<string> {
  const priceKey = `pool_${pricing.type.toLowerCase()}_${pricing.billingCycle.toLowerCase()}`;
  
  // Check if price exists in settings
  const supabase = getSupabase();
  const { data: existingPrice, error: priceError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', `stripe.price.${priceKey}`)
    .maybeSingle();
  if (priceError) throw priceError;

  if (existingPrice) {
    return existingPrice.value;
  }

  // Create Stripe product and price
  const product = await stripeClient.products.create({
    name: `Pool Membership - ${pricing.type}`,
    metadata: { type: pricing.type, billingCycle: pricing.billingCycle },
  });

  const intervalMap: Record<BillingCycle, Stripe.PriceCreateParams.Recurring.Interval> = {
    [BillingCycle.MONTHLY]: 'month',
    [BillingCycle.QUARTERLY]: 'month',
    [BillingCycle.ANNUALLY]: 'year',
  };

  const price = await stripeClient.prices.create({
    product: product.id,
    unit_amount: Math.round(pricing.basePrice * 100),
    currency: 'usd',
    recurring: {
      interval: intervalMap[pricing.billingCycle],
      interval_count: pricing.billingCycle === BillingCycle.QUARTERLY ? 3 : 1,
    },
  });

  // Store price ID
  const { error: storeError } = await supabase
    .from('system_settings')
    .insert({
      key: `stripe.price.${priceKey}`,
      value: price.id,
      category: 'stripe',
    });
  if (storeError) throw storeError;

  return price.id;
}

async function sendMemberInvitation(
  email: string,
  membership: any,
  owner: any
): Promise<void> {
  await emailService.sendEmail({
    to: email,
    subject: 'Pool Membership Invitation',
    html: `
      <h2>You've Been Invited!</h2>
      <p>${owner.firstName} ${owner.lastName} has added you to their ${membership.type} pool membership.</p>
      <p>Click the link below to activate your membership access.</p>
      <a href="${process.env.FRONTEND_URL}/membership/accept?token=${membership.id}">
        Activate Membership
      </a>
    `,
  });
}

export default {
  getMembershipPricing,
  getAllMembershipPlans,
  createMembership,
  cancelMembership,
  validateMembershipAccess,
  useGuestPass,
  processRenewal,
  handleFailedPayment,
  MembershipType,
  MembershipStatus,
  BillingCycle,
};
