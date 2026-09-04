import { useState, useCallback, useRef } from 'react';
import { paymentsApi } from '@/lib/api';

export type PaymentStatus =
  | 'idle'
  | 'creating_intent'
  | 'awaiting_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type PaymentMethodType = 'cash' | 'card' | 'room_charge' | 'online';

export interface PaymentTarget {
  referenceType: 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access' | 'ongoing_entitlement';
  referenceId: string;
  amount: number;
  currency: string;
  method: PaymentMethodType;
  notes?: string;
  roomChargeBookingId?: string;
}

export interface PaymentLifecycleState {
  status: PaymentStatus;
  method: PaymentMethodType;
  target: PaymentTarget | null;
  clientSecret: string | null;
  paymentIntentId: string | null;
  error: string | null;
}

/**
 * Strict legal transition graph for the canonical payment state machine.
 */
export const LEGAL_PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  idle: ['creating_intent', 'processing', 'failed'],
  creating_intent: ['awaiting_action', 'failed', 'cancelled'],
  awaiting_action: ['processing', 'failed', 'cancelled'],
  processing: ['succeeded', 'failed', 'cancelled'],
  succeeded: ['idle'],
  failed: ['idle', 'creating_intent', 'processing'],
  cancelled: ['idle', 'creating_intent', 'processing'],
} as const;

export function isLegalPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return (LEGAL_PAYMENT_TRANSITIONS[from] as readonly string[])?.includes(to) ?? false;
}

export interface UsePaymentLifecycleOptions {
  recordCashOnServer?: boolean;
  onSuccess?: (target: PaymentTarget) => void;
  onError?: (error: string, target?: PaymentTarget | null) => void;
  onCancel?: (target?: PaymentTarget | null) => void;
}

export function usePaymentLifecycle(options: UsePaymentLifecycleOptions = {}) {
  const [state, setState] = useState<PaymentLifecycleState>({
    status: 'idle',
    method: 'cash',
    target: null,
    clientSecret: null,
    paymentIntentId: null,
    error: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const transitionTo = useCallback((nextStatus: PaymentStatus, patch: Partial<PaymentLifecycleState> = {}) => {
    const current = stateRef.current.status;
    if (!isLegalPaymentTransition(current, nextStatus)) {
      const err = `Illegal payment state transition from '${current}' to '${nextStatus}'`;
      console.error(`[PaymentLifecycle] ${err}`);
      throw new Error(err);
    }
    const updated: PaymentLifecycleState = {
      ...stateRef.current,
      ...patch,
      status: nextStatus,
    };
    stateRef.current = updated;
    setState(updated);
  }, []);

  /** Change selected payment method while idle or failed/cancelled */
  const selectMethod = useCallback((method: PaymentMethodType) => {
    setState((prev) => ({
      ...prev,
      method,
      error: null,
    }));
  }, []);

  /** Execute payment lifecycle for a confirmed order/booking target */
  const startPayment = useCallback(async (target: PaymentTarget) => {
    selectMethod(target.method);

    if (target.method === 'cash') {
      transitionTo('processing', { target, error: null });
      try {
        if (options.recordCashOnServer ?? true) {
          await paymentsApi.recordCashPayment({
            referenceType: target.referenceType,
            referenceId: target.referenceId,
            amount: target.amount,
            notes: target.notes,
          });
        }
        transitionTo('succeeded', { error: null });
        options.onSuccess?.(target);
      } catch (err: any) {
        const errorMsg = err.response?.data?.error || err.message || 'Cash payment recording failed';
        transitionTo('failed', { error: errorMsg });
        options.onError?.(errorMsg, target);
      }
      return;
    }

    if (target.method === 'room_charge') {
      if (!target.roomChargeBookingId) {
        const errorMsg = 'Room charge requires a valid active booking ID';
        transitionTo('failed', { target, error: errorMsg });
        options.onError?.(errorMsg, target);
        return;
      }
      transitionTo('processing', { target, error: null });
      try {
        await paymentsApi.postRoomCharge({
          orderId: target.referenceId,
          bookingId: target.roomChargeBookingId,
        });
        transitionTo('succeeded', { error: null });
        options.onSuccess?.(target);
      } catch (err: any) {
        const errorMsg = err.response?.data?.error || err.message || 'Room charge failed';
        transitionTo('failed', { error: errorMsg });
        options.onError?.(errorMsg, target);
      }
      return;
    }

    // Card / Online: create PaymentIntent on backend
    transitionTo('creating_intent', { target, error: null });
    try {
      // Structural Invariant (F6): Do NOT send client money to backend.
      // Backend resolves amount & currency directly from authoritative DB record.
      const response = await paymentsApi.createPaymentIntent({
        referenceType: target.referenceType,
        referenceId: target.referenceId,
      });

      if (response.data?.success && response.data?.data?.clientSecret) {
        const { clientSecret, paymentIntentId, amount: authAmount, currency: authCurrency } = response.data.data;
        transitionTo('awaiting_action', {
          clientSecret,
          paymentIntentId,
          target: {
            ...target,
            amount: authAmount !== undefined ? authAmount : target.amount,
            currency: authCurrency || target.currency,
          },
          error: null,
        });
      } else {
        throw new Error(response.data?.error || 'Failed to create payment intent');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to initialize card payment';
      transitionTo('failed', { error: errorMsg });
      options.onError?.(errorMsg, target);
    }
  }, [transitionTo, selectMethod, options]);

  /** Called when Stripe Elements confirmation begins processing */
  const markProcessing = useCallback(() => {
    transitionTo('processing', { error: null });
  }, [transitionTo]);

  /** Called when Stripe Elements payment succeeds */
  const markSucceeded = useCallback(() => {
    const target = stateRef.current.target;
    transitionTo('succeeded', { error: null });
    if (target) {
      options.onSuccess?.(target);
    }
  }, [transitionTo, options]);

  /** Called when Stripe Elements or payment execution fails */
  const markFailed = useCallback((error: string) => {
    transitionTo('failed', { error });
    options.onError?.(error, stateRef.current.target);
  }, [transitionTo, options]);

  /**
   * User cancelled or closed the Stripe payment modal.
   * INVARIANT: payment cancelled != order confirmed.
   * The order remains in pending state so the user can re-attempt payment.
   */
  const markCancelled = useCallback(() => {
    transitionTo('cancelled', { error: null, clientSecret: null });
    options.onCancel?.(stateRef.current.target);
  }, [transitionTo, options]);

  /** Reset lifecycle state back to idle */
  const reset = useCallback(() => {
    transitionTo('idle', {
      target: null,
      clientSecret: null,
      paymentIntentId: null,
      error: null,
    });
  }, [transitionTo]);

  return {
    state,
    status: state.status,
    method: state.method,
    target: state.target,
    clientSecret: state.clientSecret,
    error: state.error,
    isIdle: state.status === 'idle',
    isCreatingIntent: state.status === 'creating_intent',
    isAwaitingAction: state.status === 'awaiting_action',
    isProcessing: state.status === 'processing',
    isSucceeded: state.status === 'succeeded',
    isFailed: state.status === 'failed',
    isCancelled: state.status === 'cancelled',
    selectMethod,
    startPayment,
    markProcessing,
    markSucceeded,
    markFailed,
    markCancelled,
    reset,
  };
}
