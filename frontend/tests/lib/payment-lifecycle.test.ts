import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePaymentLifecycle,
  isLegalPaymentTransition,
  PaymentTarget,
  LEGAL_PAYMENT_TRANSITIONS,
} from '@/lib/engine-a/payment-lifecycle';
import { paymentsApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  paymentsApi: {
    createPaymentIntent: vi.fn(),
    recordCashPayment: vi.fn(),
    postRoomCharge: vi.fn(),
  },
}));

describe('PaymentLifecycle State Machine (F6 Invariant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTarget: PaymentTarget = {
    referenceType: 'instant_transaction',
    referenceId: 'order-123',
    amount: 50.0,
    currency: 'USD',
    method: 'card',
  };

  it('validates transition graph: legal vs illegal transitions', () => {
    expect(isLegalPaymentTransition('idle', 'creating_intent')).toBe(true);
    expect(isLegalPaymentTransition('idle', 'processing')).toBe(true);
    expect(isLegalPaymentTransition('idle', 'succeeded')).toBe(false); // cannot jump to success

    expect(isLegalPaymentTransition('creating_intent', 'awaiting_action')).toBe(true);
    expect(isLegalPaymentTransition('creating_intent', 'failed')).toBe(true);
    expect(isLegalPaymentTransition('creating_intent', 'succeeded')).toBe(false);

    expect(isLegalPaymentTransition('awaiting_action', 'processing')).toBe(true);
    expect(isLegalPaymentTransition('awaiting_action', 'cancelled')).toBe(true);
    expect(isLegalPaymentTransition('awaiting_action', 'succeeded')).toBe(false);

    expect(isLegalPaymentTransition('processing', 'succeeded')).toBe(true);
    expect(isLegalPaymentTransition('processing', 'failed')).toBe(true);
  });

  it('starts in idle status with cash default', () => {
    const { result } = renderHook(() => usePaymentLifecycle());
    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.method).toBe('cash');
    expect(result.current.clientSecret).toBeNull();
  });

  it('allows updating payment method in idle state', () => {
    const { result } = renderHook(() => usePaymentLifecycle());
    act(() => {
      result.current.selectMethod('card');
    });
    expect(result.current.method).toBe('card');
  });

  it('executes cash payment flow: idle -> processing -> succeeded', async () => {
    const onSuccess = vi.fn();
    (paymentsApi.recordCashPayment as any).mockResolvedValueOnce({ data: { success: true } });

    const { result } = renderHook(() => usePaymentLifecycle({ onSuccess }));

    const cashTarget: PaymentTarget = { ...mockTarget, method: 'cash' };

    await act(async () => {
      await result.current.startPayment(cashTarget);
    });

    expect(paymentsApi.recordCashPayment).toHaveBeenCalledWith({
      referenceType: 'instant_transaction',
      referenceId: 'order-123',
      amount: 50.0,
      notes: undefined,
    });
    expect(result.current.status).toBe('succeeded');
    expect(result.current.isSucceeded).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(cashTarget);
  });

  it('executes card payment flow: idle -> creating_intent -> awaiting_action -> processing -> succeeded', async () => {
    const onSuccess = vi.fn();
    (paymentsApi.createPaymentIntent as any).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          clientSecret: 'sec_test_secret_123',
          paymentIntentId: 'pi_test_123',
        },
      },
    });

    const { result } = renderHook(() => usePaymentLifecycle({ onSuccess }));

    await act(async () => {
      await result.current.startPayment(mockTarget);
    });

    expect(paymentsApi.createPaymentIntent).toHaveBeenCalledWith({
      amount: 50.0,
      currency: 'USD',
      referenceType: 'instant_transaction',
      referenceId: 'order-123',
    });
    expect(result.current.status).toBe('awaiting_action');
    expect(result.current.clientSecret).toBe('sec_test_secret_123');

    // Customer confirms card payment via Stripe Elements
    act(() => {
      result.current.markProcessing();
    });
    expect(result.current.status).toBe('processing');

    act(() => {
      result.current.markSucceeded();
    });
    expect(result.current.status).toBe('succeeded');
    expect(result.current.isSucceeded).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(mockTarget);
  });

  it('handles intent creation failure: idle -> creating_intent -> failed', async () => {
    const onError = vi.fn();
    (paymentsApi.createPaymentIntent as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePaymentLifecycle({ onError }));

    await act(async () => {
      await result.current.startPayment(mockTarget);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.isFailed).toBe(true);
    expect(result.current.error).toBe('Network error');
    expect(onError).toHaveBeenCalledWith('Network error', mockTarget);
  });

  it('handles card processing failure: processing -> failed', async () => {
    (paymentsApi.createPaymentIntent as any).mockResolvedValueOnce({
      data: { success: true, data: { clientSecret: 'sec_123' } },
    });

    const { result } = renderHook(() => usePaymentLifecycle());

    await act(async () => {
      await result.current.startPayment(mockTarget);
    });
    expect(result.current.status).toBe('awaiting_action');

    act(() => {
      result.current.markProcessing();
    });
    expect(result.current.status).toBe('processing');

    act(() => {
      result.current.markFailed('Your card was declined.');
    });
    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Your card was declined.');
  });

  it('invariant: payment cancellation does NOT confirm order and leaves order pending for retry', async () => {
    const onCancel = vi.fn();
    (paymentsApi.createPaymentIntent as any).mockResolvedValueOnce({
      data: { success: true, data: { clientSecret: 'sec_123' } },
    });

    const { result } = renderHook(() => usePaymentLifecycle({ onCancel }));

    await act(async () => {
      await result.current.startPayment(mockTarget);
    });
    expect(result.current.status).toBe('awaiting_action');

    // Customer closes/cancels Stripe modal
    act(() => {
      result.current.markCancelled();
    });

    expect(result.current.status).toBe('cancelled');
    expect(result.current.isCancelled).toBe(true);
    expect(result.current.isSucceeded).toBe(false); // CRITICAL: payment cancelled != order confirmed
    expect(onCancel).toHaveBeenCalledWith(mockTarget);

    // Customer can retry payment from cancelled state
    (paymentsApi.createPaymentIntent as any).mockResolvedValueOnce({
      data: { success: true, data: { clientSecret: 'sec_retry_456' } },
    });

    await act(async () => {
      await result.current.startPayment(mockTarget);
    });
    expect(result.current.status).toBe('awaiting_action');
    expect(result.current.clientSecret).toBe('sec_retry_456');
  });

  it('throws on illegal state transitions', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePaymentLifecycle());

    expect(() => {
      act(() => {
        result.current.markSucceeded(); // cannot jump from idle directly to succeeded
      });
    }).toThrow(/Illegal payment state transition/);

    consoleSpy.mockRestore();
  });
});
