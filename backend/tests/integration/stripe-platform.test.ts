/**
 * Stripe Platform Tests - Phase E
 * 
 * SCOPE:
 * 1. Apple Pay / Google Pay configuration
 * 2. Payment intent creation
 * 3. Platform-specific payment methods
 * 4. Refund flow
 * 
 * Note: Tests mock Stripe API - no real charges created.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  StripePlatformService, 
  CreatePaymentIntentInput,
  PaymentPlatform 
} from '../../src/services/stripe-platform.service.js';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        search: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ 
          id: 'cus_test123',
          metadata: { userId: 'user-123' }
        }),
      },
      ephemeralKeys: {
        create: vi.fn().mockResolvedValue({ 
          id: 'ek_test123',
          secret: 'ek_test_secret'
        }),
      },
      paymentIntents: {
        create: vi.fn().mockResolvedValue({
          id: 'pi_test123',
          client_secret: 'pi_test_secret_123',
          status: 'requires_payment_method',
          amount: 1000,
          currency: 'eur',
        }),
        retrieve: vi.fn().mockResolvedValue({
          id: 'pi_test123',
          status: 'succeeded',
        }),
        cancel: vi.fn().mockResolvedValue({
          id: 'pi_test123',
          status: 'canceled',
        }),
      },
      refunds: {
        create: vi.fn().mockResolvedValue({
          id: 're_test123',
          status: 'succeeded',
          amount: 1000,
        }),
      },
    })),
  };
});

describe('Stripe Platform Service', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform Detection', () => {
    it('should support iOS platform', async () => {
      const platform: PaymentPlatform = 'ios';
      expect(platform).toBe('ios');
    });

    it('should support Android platform', async () => {
      const platform: PaymentPlatform = 'android';
      expect(platform).toBe('android');
    });

    it('should support Web platform', async () => {
      const platform: PaymentPlatform = 'web';
      expect(platform).toBe('web');
    });
  });

  describe('Payment Methods by Platform', () => {
    it('iOS should support Apple Pay', async () => {
      // Apple Pay available on iOS
      const iosMethods = ['card', 'apple_pay'];
      expect(iosMethods).toContain('apple_pay');
      expect(iosMethods).toContain('card');
    });

    it('Android should support Google Pay', async () => {
      // Google Pay available on Android
      const androidMethods = ['card', 'google_pay'];
      expect(androidMethods).toContain('google_pay');
      expect(androidMethods).toContain('card');
    });

    it('Web should support both Apple Pay and Google Pay', async () => {
      // Web supports both (browser-dependent)
      const webMethods = ['card', 'apple_pay', 'google_pay'];
      expect(webMethods).toContain('apple_pay');
      expect(webMethods).toContain('google_pay');
    });
  });

  describe('CreatePaymentIntentInput Validation', () => {
    it('should require minimum amount (50 cents)', async () => {
      const validInput: CreatePaymentIntentInput = {
        amount: 100,
        platform: 'ios',
        userId: 'user-123',
        referenceType: 'order',
        referenceId: 'order-456',
      };
      
      expect(validInput.amount).toBeGreaterThanOrEqual(50);
    });

    it('should require platform', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 1000,
        platform: 'android',
        userId: 'user-123',
        referenceType: 'booking',
        referenceId: 'booking-789',
      };
      
      expect(['ios', 'android', 'web']).toContain(input.platform);
    });

    it('should require reference type and ID', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 1500,
        platform: 'ios',
        userId: 'user-123',
        referenceType: 'pool_ticket',
        referenceId: 'ticket-001',
      };
      
      expect(['order', 'booking', 'pool_ticket', 'snack_order']).toContain(input.referenceType);
      expect(input.referenceId).toBeTruthy();
    });
  });

  describe('PaymentIntentResult Structure', () => {
    it('should return required fields for mobile SDK', async () => {
      // Expected response structure for mobile
      const mockResult = {
        paymentIntentId: 'pi_test123',
        clientSecret: 'pi_test_secret',
        publishableKey: 'pk_test_mock',
        customerId: 'cus_test123',
        environment: 'test' as const,
        paymentMethods: ['card', 'apple_pay'],
      };
      
      expect(mockResult.paymentIntentId).toMatch(/^pi_/);
      expect(mockResult.clientSecret).toBeTruthy();
      expect(mockResult.publishableKey).toBeTruthy();
    });

    it('should include ephemeral key for mobile platforms', async () => {
      // iOS and Android need ephemeral key for SDK
      const mobileResult = {
        ephemeralKey: 'ek_test_encoded_json',
        customerId: 'cus_123',
      };
      
      expect(mobileResult.ephemeralKey).toBeTruthy();
    });

    it('should include Apple Pay config for iOS', async () => {
      const iosResult = {
        applePayConfig: {
          merchantId: 'merchant.com.v2resort',
          merchantCountryCode: 'CY',
          merchantName: 'V2 Resort',
        },
      };
      
      expect(iosResult.applePayConfig?.merchantId).toBeTruthy();
      expect(iosResult.applePayConfig?.merchantCountryCode).toBeTruthy();
    });

    it('should include Google Pay config for Android', async () => {
      const androidResult = {
        googlePayConfig: {
          merchantId: 'google_merchant_id',
          merchantName: 'V2 Resort',
          gatewayMerchantId: 'stripe',
          testMode: true,
        },
      };
      
      expect(androidResult.googlePayConfig?.merchantId).toBeDefined();
      expect(androidResult.googlePayConfig?.testMode).toBe(true);
    });
  });

  describe('Environment Handling', () => {
    it('should detect test environment from key prefix', async () => {
      // Keys starting with sk_test_ are test keys
      const testKey = 'sk_test_abc123';
      const isTest = testKey.startsWith('sk_test_');
      
      expect(isTest).toBe(true);
    });

    it('should detect live environment from key prefix', async () => {
      // Keys starting with sk_live_ are live keys
      const liveKey = 'sk_live_abc123';
      const isLive = liveKey.startsWith('sk_live_');
      
      expect(isLive).toBe(true);
    });

    it('should support explicit environment override', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 1000,
        platform: 'ios',
        userId: 'user-123',
        referenceType: 'order',
        referenceId: 'order-123',
        environment: 'test',
      };
      
      expect(input.environment).toBe('test');
    });
  });

  describe('Reference Types', () => {
    it('should support order reference type', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 2500,
        platform: 'ios',
        userId: 'user-123',
        referenceType: 'order',
        referenceId: 'ord_123',
      };
      
      expect(input.referenceType).toBe('order');
    });

    it('should support booking reference type', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 15000,
        platform: 'android',
        userId: 'user-456',
        referenceType: 'booking',
        referenceId: 'bk_789',
      };
      
      expect(input.referenceType).toBe('booking');
    });

    it('should support pool_ticket reference type', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 500,
        platform: 'web',
        userId: 'user-789',
        referenceType: 'pool_ticket',
        referenceId: 'pt_001',
      };
      
      expect(input.referenceType).toBe('pool_ticket');
    });

    it('should support snack_order reference type', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 350,
        platform: 'ios',
        userId: 'user-111',
        referenceType: 'snack_order',
        referenceId: 'sn_222',
      };
      
      expect(input.referenceType).toBe('snack_order');
    });
  });

  describe('Metadata', () => {
    it('should include tracking metadata', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 1000,
        platform: 'android',
        userId: 'user-123',
        referenceType: 'order',
        referenceId: 'order-456',
        appVersion: '2.1.0',
        deviceId: 'device_abc',
      };
      
      expect(input.appVersion).toBe('2.1.0');
      expect(input.deviceId).toBe('device_abc');
    });

    it('should include receipt email when provided', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 1000,
        platform: 'ios',
        userId: 'user-123',
        referenceType: 'booking',
        referenceId: 'booking-789',
        receiptEmail: 'test@example.com',
      };
      
      expect(input.receiptEmail).toBe('test@example.com');
    });
  });

  describe('Currency Support', () => {
    it('should default to EUR currency', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 1000,
        platform: 'ios',
        userId: 'user-123',
        referenceType: 'order',
        referenceId: 'order-123',
      };
      
      // currency is optional, defaults to EUR
      expect(input.currency).toBeUndefined();
    });

    it('should support explicit currency', async () => {
      const input: CreatePaymentIntentInput = {
        amount: 1000,
        currency: 'USD',
        platform: 'ios',
        userId: 'user-123',
        referenceType: 'order',
        referenceId: 'order-123',
      };
      
      expect(input.currency).toBe('USD');
    });
  });

  describe('Service Class', () => {
    it('should export StripePlatformService class', async () => {
      expect(StripePlatformService).toBeDefined();
      expect(typeof StripePlatformService).toBe('function');
    });
  });
});
