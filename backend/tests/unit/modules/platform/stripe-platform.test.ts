/**
 * Stripe Platform Service Tests
 * 
 * Verifies real behavior of StripePlatformService:
 * - Payment intent creation with platform metadata (ios, android, web)
 * - Customer search and creation
 * - Mobile ephemeral key generation
 * - Apple Pay and Google Pay payload configurations
 * - Refund creation and webhook signature validation
 * - Payment method listing and detachment
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockCustomerSearch = vi.fn();
const mockCustomerCreate = vi.fn();
const mockEphemeralKeyCreate = vi.fn();
const mockPaymentIntentCreate = vi.fn();
const mockPaymentIntentRetrieve = vi.fn();
const mockPaymentIntentConfirm = vi.fn();
const mockPaymentIntentCancel = vi.fn();
const mockRefundCreate = vi.fn();
const mockWebhookConstructEvent = vi.fn();
const mockSetupIntentCreate = vi.fn();
const mockPaymentMethodList = vi.fn();
const mockPaymentMethodDetach = vi.fn();

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      customers = {
        search: mockCustomerSearch,
        create: mockCustomerCreate,
      };
      ephemeralKeys = {
        create: mockEphemeralKeyCreate,
      };
      paymentIntents = {
        create: mockPaymentIntentCreate,
        retrieve: mockPaymentIntentRetrieve,
        confirm: mockPaymentIntentConfirm,
        cancel: mockPaymentIntentCancel,
      };
      refunds = {
        create: mockRefundCreate,
      };
      webhooks = {
        constructEvent: mockWebhookConstructEvent,
      };
      setupIntents = {
        create: mockSetupIntentCreate,
      };
      paymentMethods = {
        list: mockPaymentMethodList,
        detach: mockPaymentMethodDetach,
      };
    },
  };
});

import {
  StripePlatformService,
  getStripePlatformService,
  CreatePaymentIntentInput,
} from '../../../../src/services/stripe-platform.service';

describe('StripePlatformService (Real Logic & Branches)', () => {
  let service: StripePlatformService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_123';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_123';
    delete process.env.STRIPE_ENVIRONMENT;

    mockCustomerSearch.mockResolvedValue({ data: [] });
    mockCustomerCreate.mockResolvedValue({ id: 'cus_new_123', metadata: { userId: 'usr-1' } });
    mockEphemeralKeyCreate.mockResolvedValue({ id: 'ek_123', secret: 'ek_sec_123' });
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_secret_123',
      status: 'requires_payment_method',
    });
    mockPaymentIntentRetrieve.mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' });
    mockPaymentIntentConfirm.mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' });
    mockPaymentIntentCancel.mockResolvedValue({ id: 'pi_test_123', status: 'canceled' });
    mockRefundCreate.mockResolvedValue({ id: 're_123', status: 'succeeded', amount: 1000 });
    mockSetupIntentCreate.mockResolvedValue({ id: 'seti_123', client_secret: 'seti_sec_123' });

    service = new StripePlatformService('test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization and Environment Resolution', () => {
    it('throws if secret key is missing', () => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_TEST_SECRET_KEY;
      expect(() => new StripePlatformService('test')).toThrow(/secret key not configured/);
    });

    it('infers test environment from sk_test_ prefix', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_sample';
      const svc = new StripePlatformService();
      expect(svc.getMobileConfig('ios').environment).toBe('test');
    });

    it('infers live environment from non-test prefix', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_sample';
      process.env.STRIPE_LIVE_SECRET_KEY = 'sk_live_sample';
      process.env.STRIPE_LIVE_PUBLISHABLE_KEY = 'pk_live_sample';
      const svc = new StripePlatformService();
      expect(svc.getMobileConfig('web').environment).toBe('live');
    });

    it('returns singleton from getStripePlatformService', () => {
      const s1 = getStripePlatformService();
      const s2 = getStripePlatformService();
      expect(s1).toBe(s2);
    });
  });

  describe('createPaymentIntent', () => {
    const baseInput: CreatePaymentIntentInput = {
      amount: 1500,
      currency: 'EUR',
      platform: 'ios',
      userId: 'usr-1',
      referenceType: 'instant_transaction',
      referenceId: 'ord-123',
      description: 'Room Service Order',
      receiptEmail: 'guest@example.com',
      appVersion: '1.2.0',
      deviceId: 'dev-ios-1',
    };

    it('rejects amount less than 50 cents', async () => {
      await expect(service.createPaymentIntent({ ...baseInput, amount: 49 })).rejects.toThrow(
        'Amount must be at least 50 cents'
      );
    });

    it('creates customer if none found, creates ephemeral key, and configures Apple Pay for iOS', async () => {
      mockCustomerSearch.mockResolvedValueOnce({ data: [] });

      const result = await service.createPaymentIntent(baseInput);

      expect(mockCustomerSearch).toHaveBeenCalledWith({
        query: 'metadata["userId"]:"usr-1"',
        limit: 1,
      });
      expect(mockCustomerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'guest@example.com',
          metadata: expect.objectContaining({ userId: 'usr-1' }),
        })
      );
      expect(mockEphemeralKeyCreate).toHaveBeenCalledWith(
        { customer: 'cus_new_123' },
        { apiVersion: '2024-06-20' }
      );
      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1500,
          currency: 'eur',
          customer: 'cus_new_123',
          receipt_email: 'guest@example.com',
          metadata: expect.objectContaining({
            userId: 'usr-1',
            referenceType: 'instant_transaction',
            referenceId: 'ord-123',
            platform: 'ios',
            source: 'v2_resort_ios',
          }),
        }),
        expect.objectContaining({
          idempotencyKey: 'pi_instant_transaction_ord-123',
        })
      );

      expect(result.paymentIntentId).toBe('pi_test_123');
      expect(result.clientSecret).toBe('pi_test_secret_123');
      expect(result.paymentMethods).toContain('apple_pay');
      expect(result.applePayConfig?.merchantId).toBeDefined();
    });

    it('reuses existing customer and configures Google Pay for Android', async () => {
      mockCustomerSearch.mockResolvedValueOnce({
        data: [{ id: 'cus_existing_456', metadata: { userId: 'usr-1' } }],
      });

      const androidInput: CreatePaymentIntentInput = {
        ...baseInput,
        platform: 'android',
      };

      const result = await service.createPaymentIntent(androidInput);

      expect(mockCustomerCreate).not.toHaveBeenCalled();
      expect(mockEphemeralKeyCreate).toHaveBeenCalledWith(
        { customer: 'cus_existing_456' },
        { apiVersion: '2024-06-20' }
      );
      expect(result.paymentMethods).toContain('google_pay');
      expect(result.googlePayConfig?.testMode).toBe(true);
      expect(result.applePayConfig).toBeUndefined();
    });

    it('does not create ephemeral key for web platform', async () => {
      mockCustomerSearch.mockResolvedValueOnce({
        data: [{ id: 'cus_existing_web' }],
      });

      const webInput: CreatePaymentIntentInput = {
        ...baseInput,
        platform: 'web',
      };

      const result = await service.createPaymentIntent(webInput);

      expect(mockEphemeralKeyCreate).not.toHaveBeenCalled();
      expect(result.ephemeralKey).toBeUndefined();
      expect(result.paymentMethods).toEqual(['card', 'apple_pay', 'google_pay']);
    });
  });

  describe('PaymentIntent Management (get, confirm, cancel)', () => {
    it('retrieves PaymentIntent', async () => {
      const pi = await service.getPaymentIntent('pi_123');
      expect(mockPaymentIntentRetrieve).toHaveBeenCalledWith('pi_123');
      expect(pi.id).toBe('pi_test_123');
    });

    it('confirms PaymentIntent with payment method', async () => {
      const pi = await service.confirmPaymentIntent('pi_123', 'pm_card_visa');
      expect(mockPaymentIntentConfirm).toHaveBeenCalledWith('pi_123', {
        payment_method: 'pm_card_visa',
      });
      expect(pi.status).toBe('succeeded');
    });

    it('cancels PaymentIntent', async () => {
      const pi = await service.cancelPaymentIntent('pi_123');
      expect(mockPaymentIntentCancel).toHaveBeenCalledWith('pi_123');
      expect(pi.status).toBe('canceled');
    });
  });

  describe('Refunds and Webhook Verification', () => {
    it('creates a refund with timestamp metadata', async () => {
      const refund = await service.createRefund({
        paymentIntentId: 'pi_123',
        amount: 500,
        reason: 'requested_by_customer',
        metadata: { orderId: 'ord-123' },
      });

      expect(mockRefundCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_123',
          amount: 500,
          reason: 'requested_by_customer',
          metadata: expect.objectContaining({
            orderId: 'ord-123',
            refundedAt: expect.any(String),
          }),
        })
      );
      expect(refund.id).toBe('re_123');
    });

    it('verifies webhook signature against configured secret', () => {
      const mockEvent = { id: 'evt_1', type: 'payment_intent.succeeded' };
      mockWebhookConstructEvent.mockReturnValueOnce(mockEvent);

      const event = service.verifyWebhookSignature('payload-string', 'sig-header');

      expect(mockWebhookConstructEvent).toHaveBeenCalledWith(
        'payload-string',
        'sig-header',
        'whsec_test_mock_123'
      );
      expect(event).toBe(mockEvent);
    });
  });

  describe('SetupIntents and Saved Payment Methods', () => {
    it('creates SetupIntent with ephemeral key', async () => {
      mockCustomerSearch.mockResolvedValueOnce({
        data: [{ id: 'cus_setup_1' }],
      });

      const res = await service.createSetupIntent('usr-1', 'setup@example.com');

      expect(mockSetupIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_setup_1',
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        })
      );
      expect(res.setupIntentId).toBe('seti_123');
      expect(res.clientSecret).toBe('seti_sec_123');
    });

    it('lists customer payment methods if customer found', async () => {
      mockCustomerSearch.mockResolvedValueOnce({
        data: [{ id: 'cus_pm_1' }],
      });
      mockPaymentMethodList.mockResolvedValueOnce({
        data: [{ id: 'pm_1', card: { brand: 'visa', last4: '4242' } }],
      });

      const list = await service.listPaymentMethods('usr-1');
      expect(mockPaymentMethodList).toHaveBeenCalledWith({
        customer: 'cus_pm_1',
        type: 'card',
      });
      expect(list).toHaveLength(1);
    });

    it('returns empty array if customer not found', async () => {
      mockCustomerSearch.mockResolvedValueOnce({ data: [] });
      const list = await service.listPaymentMethods('usr-nonexistent');
      expect(list).toEqual([]);
      expect(mockPaymentMethodList).not.toHaveBeenCalled();
    });

    it('detaches payment method', async () => {
      await service.deletePaymentMethod('pm_delete_1');
      expect(mockPaymentMethodDetach).toHaveBeenCalledWith('pm_delete_1');
    });
  });
});
