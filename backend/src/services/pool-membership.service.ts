/**
 * Pool Membership Service
 * 
 * Handles annual memberships, corporate accounts, and recurring billing.
 */

import { prisma } from '../config/database.js';
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
    const pricing = getMembershipPricing(input.type, input.billingCycle);
    
    if (!pricing) {
      return {
        success: false,
        message: 'Invalid membership type or billing cycle',
      };
    }

    // Check if user already has an active membership
    const existingMembership = await prisma.poolMembership.findFirst({
      where: {
        userId: input.userId,
        status: MembershipStatus.ACTIVE,
      },
    });

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
    const user = await prisma.users.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    let stripeCustomerId = user.stripeCustomerId;
    
    if (!stripeCustomerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: input.userId },
      });
      
      stripeCustomerId = customer.id;
      
      await prisma.users.update({
        where: { id: input.userId },
        data: { stripeCustomerId },
      });
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
    const membership = await prisma.poolMembership.create({
      data: {
        userId: input.userId,
        type: input.type,
        billingCycle: input.billingCycle,
        status: MembershipStatus.PENDING_PAYMENT,
        startDate,
        endDate,
        price: pricing.basePrice,
        stripeSubscriptionId: subscription.id,
        corporateName: input.corporateName,
        maxMembers: pricing.maxMembers,
        remainingGuestPasses: pricing.guestPasses,
        discountPercentage: pricing.discountPercentage,
      },
    });

    // Add additional members if provided
    if (input.memberEmails && input.memberEmails.length > 0) {
      for (const email of input.memberEmails) {
        await prisma.membershipMember.create({
          data: {
            membershipId: membership.id,
            email,
            status: 'PENDING_INVITATION',
          },
        });
        
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
    const membership = await prisma.poolMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      return { success: false, message: 'Membership not found' };
    }

    if (membership.userId !== userId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      return { success: false, message: 'Membership is not active' };
    }

    // Cancel Stripe subscription
    if (membership.stripeSubscriptionId) {
      await stripeClient.subscriptions.update(membership.stripeSubscriptionId, {
        cancel_at_period_end: !immediate,
      });

      if (immediate) {
        await stripeClient.subscriptions.cancel(membership.stripeSubscriptionId);
      }
    }

    // Update membership status
    await prisma.poolMembership.update({
      where: { id: membershipId },
      data: {
        status: immediate ? MembershipStatus.CANCELLED : MembershipStatus.ACTIVE,
        cancelledAt: new Date(),
        cancellationReason: reason,
        autoRenew: false,
      },
    });

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
  const membership = await prisma.poolMembership.findFirst({
    where: {
      OR: [
        { userId },
        {
          members: {
            some: { userId, status: 'ACTIVE' },
          },
        },
      ],
      status: MembershipStatus.ACTIVE,
      endDate: { gte: new Date() },
    },
    include: {
      members: true,
    },
  });

  if (!membership) {
    return { hasAccess: false };
  }

  return {
    hasAccess: true,
    membership,
    remainingGuestPasses: membership.remainingGuestPasses,
    discountPercentage: membership.discountPercentage ? Number(membership.discountPercentage) : 0,
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
  const membership = await prisma.poolMembership.findUnique({
    where: { id: membershipId },
  });

  if (!membership) {
    return { success: false, message: 'Membership not found' };
  }

  if (membership.status !== MembershipStatus.ACTIVE) {
    return { success: false, message: 'Membership is not active' };
  }

  // VIP has unlimited passes
  if (membership.type !== MembershipType.VIP && membership.remainingGuestPasses <= 0) {
    return { success: false, message: 'No guest passes remaining' };
  }

  // Record guest pass usage
  await prisma.guestPassUsage.create({
    data: {
      membershipId,
      guestName,
      guestEmail,
      usedAt: new Date(),
    },
  });

  // Decrement remaining passes (except for VIP)
  if (membership.type !== MembershipType.VIP) {
    await prisma.poolMembership.update({
      where: { id: membershipId },
      data: { remainingGuestPasses: { decrement: 1 } },
    });
  }

  return {
    success: true,
    message: 'Guest pass used successfully',
    remainingPasses: membership.type === MembershipType.VIP 
      ? -1 // Unlimited
      : membership.remainingGuestPasses - 1,
  };
}

/**
 * Process membership renewal (called by webhook)
 */
export async function processRenewal(
  subscriptionId: string
): Promise<void> {
  const membership = await prisma.poolMembership.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: true },
  });

  if (!membership) {
    logger.warn('Membership not found for renewal', { subscriptionId });
    return;
  }

  const pricing = getMembershipPricing(
    membership.type as MembershipType,
    membership.billingCycle as BillingCycle
  );

  const newEndDate = calculateEndDate(
    new Date(membership.endDate),
    membership.billingCycle as BillingCycle
  );

  await prisma.poolMembership.update({
    where: { id: membership.id },
    data: {
      endDate: newEndDate,
      remainingGuestPasses: pricing?.guestPasses || membership.remainingGuestPasses,
      renewedAt: new Date(),
    },
  });

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
  const membership = await prisma.poolMembership.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: true },
  });

  if (!membership) return;

  await prisma.poolMembership.update({
    where: { id: membership.id },
    data: { status: MembershipStatus.SUSPENDED },
  });

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
  const existingPrice = await prisma.systemSettings.findUnique({
    where: { key: `stripe.price.${priceKey}` },
  });

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
  await prisma.systemSettings.create({
    data: {
      key: `stripe.price.${priceKey}`,
      value: price.id,
      category: 'stripe',
    },
  });

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
