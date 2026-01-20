/**
 * Platform-Aware Stripe Payment Service
 * 
 * Handles Stripe PaymentIntent creation with support for:
 * - Apple Pay (iOS)
 * - Google Pay (Android)
 * - Web payments
 * - Environment separation (test/live)
 * - Proper metadata for mobile platforms
 * 
 * @module services/stripe-platform
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

// Platform identifiers
export type PaymentPlatform = 'ios' | 'android' | 'web';

// Environment types
export type StripeEnvironment = 'test' | 'live';

// Stripe configuration by environment
const STRIPE_CONFIG: Record<StripeEnvironment, {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}> = {
  test: {
    secretKey: process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  live: {
    secretKey: process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_LIVE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_LIVE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '',
  },
};

// Merchant info for Apple Pay / Google Pay
const MERCHANT_INFO = {
  merchantName: process.env.MERCHANT_NAME || 'V2 Resort',
  merchantCountryCode: process.env.MERCHANT_COUNTRY || 'CY',
  merchantCurrency: process.env.MERCHANT_CURRENCY || 'EUR',
  appleMerchantId: process.env.APPLE_MERCHANT_ID || 'merchant.com.v2resort',
  googleMerchantId: process.env.GOOGLE_MERCHANT_ID || '',
};

// Determine environment from key or explicit setting
function getEnvironment(): StripeEnvironment {
  const explicitEnv = process.env.STRIPE_ENVIRONMENT;
  if (explicitEnv === 'live' || explicitEnv === 'test') {
    return explicitEnv;
  }
  
  // Check if using test keys
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  return secretKey.startsWith('sk_test_') ? 'test' : 'live';
}

// Get Stripe instance for environment
function getStripeInstance(env?: StripeEnvironment): Stripe {
  const environment = env || getEnvironment();
  const config = STRIPE_CONFIG[environment];
  
  if (!config.secretKey) {
    throw new Error(`Stripe ${environment} secret key not configured`);
  }
  
  return new Stripe(config.secretKey, {
    apiVersion: '2024-06-20',
    typescript: true,
    appInfo: {
      name: 'V2 Resort',
      version: '1.0.0',
    },
  });
}

export interface CreatePaymentIntentInput {
  /** Amount in smallest currency unit (cents for EUR/USD) */
  amount: number;
  /** Currency code (defaults to EUR) */
  currency?: string;
  /** Platform making the request */
  platform: PaymentPlatform;
  /** User ID for metadata */
  userId: string;
  /** Reference type (order, booking, etc.) */
  referenceType: 'order' | 'booking' | 'pool_ticket' | 'snack_order';
  /** Reference ID */
  referenceId: string;
  /** Optional description */
  description?: string;
  /** Optional receipt email */
  receiptEmail?: string;
  /** App version for tracking */
  appVersion?: string;
  /** Device ID for tracking */
  deviceId?: string;
  /** Explicit environment override */
  environment?: StripeEnvironment;
}

export interface PaymentIntentResult {
  /** PaymentIntent ID */
  paymentIntentId: string;
  /** Client secret for SDK */
  clientSecret: string;
  /** Publishable key for this environment */
  publishableKey: string;
  /** Ephemeral key for mobile SDKs */
  ephemeralKey?: string;
  /** Customer ID if created/found */
  customerId?: string;
  /** Environment used */
  environment: StripeEnvironment;
  /** Payment methods enabled */
  paymentMethods: string[];
  /** Apple Pay configuration (iOS only) */
  applePayConfig?: {
    merchantId: string;
    merchantCountryCode: string;
    merchantName: string;
  };
  /** Google Pay configuration (Android only) */
  googlePayConfig?: {
    merchantId: string;
    merchantName: string;
    gatewayMerchantId: string;
    testMode: boolean;
  };
}

export interface RefundInput {
  paymentIntentId: string;
  /** Amount to refund (full refund if not specified) */
  amount?: number;
  reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
  metadata?: Record<string, string>;
}

/**
 * Platform-Aware Stripe Payment Service
 */
export class StripePlatformService {
  private stripe: Stripe;
  private environment: StripeEnvironment;

  constructor(environment?: StripeEnvironment) {
    this.environment = environment || getEnvironment();
    this.stripe = getStripeInstance(this.environment);
    
    logger.info(`StripePlatformService initialized`, {
      environment: this.environment,
      isTest: this.environment === 'test',
    });
  }

  /**
   * Get or create a Stripe customer for the user
   */
  private async getOrCreateCustomer(userId: string, email?: string): Promise<Stripe.Customer> {
    // Search for existing customer
    const customers = await this.stripe.customers.search({
      query: `metadata["userId"]:"${userId}"`,
      limit: 1,
    });

    if (customers.data.length > 0) {
      return customers.data[0];
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      metadata: {
        userId,
        createdAt: new Date().toISOString(),
      },
    });

    logger.info(`Created Stripe customer`, { customerId: customer.id, userId });
    return customer;
  }

  /**
   * Create an ephemeral key for mobile SDK
   */
  private async createEphemeralKey(customerId: string): Promise<string> {
    const ephemeralKey = await this.stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2024-06-20' }
    );
    return JSON.stringify(ephemeralKey);
  }

  /**
   * Get payment methods based on platform
   */
  private getPaymentMethodsForPlatform(platform: PaymentPlatform): string[] {
    const baseMethods = ['card'];
    
    switch (platform) {
      case 'ios':
        return [...baseMethods, 'apple_pay'];
      case 'android':
        return [...baseMethods, 'google_pay'];
      case 'web':
        return [...baseMethods, 'apple_pay', 'google_pay'];
      default:
        return baseMethods;
    }
  }

  /**
   * Create a PaymentIntent with platform-specific configuration
   */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const {
      amount,
      currency = MERCHANT_INFO.merchantCurrency,
      platform,
      userId,
      referenceType,
      referenceId,
      description,
      receiptEmail,
      appVersion,
      deviceId,
      environment,
    } = input;

    // Validate amount
    if (amount < 50) {
      throw new Error('Amount must be at least 50 cents');
    }

    // Use specific environment if provided
    const env = environment || this.environment;
    const stripe = environment ? getStripeInstance(environment) : this.stripe;

    // Get or create customer
    const customer = await this.getOrCreateCustomer(userId, receiptEmail);

    // Create PaymentIntent with platform-specific metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      customer: customer.id,
      receipt_email: receiptEmail,
      description: description || `${referenceType} payment`,
      payment_method_types: ['card'],
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never', // Mobile apps can't handle redirects
      },
      metadata: {
        // V2 Resort metadata
        userId,
        referenceType,
        referenceId,
        platform,
        environment: env,
        
        // Tracking metadata
        appVersion: appVersion || 'unknown',
        deviceId: deviceId || 'unknown',
        createdAt: new Date().toISOString(),
        
        // For reconciliation
        source: `v2_resort_${platform}`,
      },
      // Capture method - can be changed to 'manual' for auth-then-capture flow
      capture_method: 'automatic',
    });

    logger.info(`PaymentIntent created`, {
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      platform,
      userId,
      referenceType,
      referenceId,
      environment: env,
    });

    // Create ephemeral key for mobile platforms
    let ephemeralKey: string | undefined;
    if (platform === 'ios' || platform === 'android') {
      ephemeralKey = await this.createEphemeralKey(customer.id);
    }

    const config = STRIPE_CONFIG[env];

    const result: PaymentIntentResult = {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      publishableKey: config.publishableKey,
      ephemeralKey,
      customerId: customer.id,
      environment: env,
      paymentMethods: this.getPaymentMethodsForPlatform(platform),
    };

    // Add platform-specific configuration
    if (platform === 'ios') {
      result.applePayConfig = {
        merchantId: MERCHANT_INFO.appleMerchantId,
        merchantCountryCode: MERCHANT_INFO.merchantCountryCode,
        merchantName: MERCHANT_INFO.merchantName,
      };
    }

    if (platform === 'android') {
      result.googlePayConfig = {
        merchantId: MERCHANT_INFO.googleMerchantId,
        merchantName: MERCHANT_INFO.merchantName,
        gatewayMerchantId: config.publishableKey,
        testMode: env === 'test',
      };
    }

    return result;
  }

  /**
   * Retrieve PaymentIntent status
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Confirm PaymentIntent (for server-side confirmation if needed)
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });
  }

  /**
   * Cancel PaymentIntent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * Create a refund
   */
  async createRefund(input: RefundInput): Promise<Stripe.Refund> {
    const { paymentIntentId, amount, reason, metadata } = input;

    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason,
      metadata: {
        ...metadata,
        refundedAt: new Date().toISOString(),
      },
    });

    logger.info(`Refund created`, {
      refundId: refund.id,
      paymentIntentId,
      amount: refund.amount,
      status: refund.status,
    });

    return refund;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    const config = STRIPE_CONFIG[this.environment];
    
    if (!config.webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, config.webhookSecret);
  }

  /**
   * Get configuration for mobile SDK initialization
   */
  getMobileConfig(platform: PaymentPlatform): {
    publishableKey: string;
    merchantIdentifier?: string;
    environment: StripeEnvironment;
    merchantCountryCode: string;
    merchantName: string;
  } {
    const config = STRIPE_CONFIG[this.environment];

    return {
      publishableKey: config.publishableKey,
      merchantIdentifier: platform === 'ios' ? MERCHANT_INFO.appleMerchantId : undefined,
      environment: this.environment,
      merchantCountryCode: MERCHANT_INFO.merchantCountryCode,
      merchantName: MERCHANT_INFO.merchantName,
    };
  }

  /**
   * Create setup intent for saving payment methods
   */
  async createSetupIntent(userId: string, email?: string): Promise<{
    setupIntentId: string;
    clientSecret: string;
    customerId: string;
    ephemeralKey: string;
  }> {
    const customer = await this.getOrCreateCustomer(userId, email);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        userId,
        createdAt: new Date().toISOString(),
      },
    });

    const ephemeralKey = await this.createEphemeralKey(customer.id);

    return {
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret!,
      customerId: customer.id,
      ephemeralKey,
    };
  }

  /**
   * List saved payment methods for a customer
   */
  async listPaymentMethods(userId: string): Promise<Stripe.PaymentMethod[]> {
    const customers = await this.stripe.customers.search({
      query: `metadata["userId"]:"${userId}"`,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return [];
    }

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customers.data[0].id,
      type: 'card',
    });

    return paymentMethods.data;
  }

  /**
   * Delete a saved payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(paymentMethodId);
    logger.info(`Payment method deleted`, { paymentMethodId });
  }
}

// Singleton instance
let stripePlatformService: StripePlatformService | null = null;

export function getStripePlatformService(): StripePlatformService {
  if (!stripePlatformService) {
    stripePlatformService = new StripePlatformService();
  }
  return stripePlatformService;
}

export default StripePlatformService;
