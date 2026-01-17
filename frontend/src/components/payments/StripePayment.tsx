'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { paymentsApi } from '@/lib/api';

// Initialize Stripe with the publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  amount: number;
  currency?: string;
}

function PaymentForm({ clientSecret, onSuccess, onError, onCancel, amount, currency = 'USD' }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message || 'An error occurred during payment');
      onError(error.message || 'Payment failed');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    } else {
      setMessage('Payment processing...');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Amount to pay</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
          </p>
        </div>
      </div>

      <PaymentElement 
        options={{
          layout: 'tabs',
        }}
      />

      {message && (
        <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          {message}
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            `Pay ${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}`
          )}
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        <svg className="inline-block w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        Secured by Stripe. Your payment information is encrypted.
      </p>
    </form>
  );
}

interface StripePaymentProps {
  amount: number;
  currency?: string;
  referenceType: 'restaurant_order' | 'snack_order' | 'chalet_booking' | 'pool_ticket';
  referenceId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

export default function StripePayment({
  amount,
  currency = 'USD',
  referenceType,
  referenceId,
  onSuccess,
  onError,
  onCancel,
}: StripePaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function createIntent() {
      try {
        setLoading(true);
        setError(null);
        const response = await paymentsApi.createPaymentIntent({
          amount,
          referenceType,
          referenceId,
        });

        if (response.data?.success && response.data?.data?.clientSecret) {
          setClientSecret(response.data.data.clientSecret);
        } else {
          throw new Error('Failed to create payment intent');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
        setError(errorMessage);
        onError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    createIntent();
  }, [amount, referenceType, referenceId, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="text-center p-8">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Failed to initialize payment'}</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2563eb',
            borderRadius: '8px',
          },
        },
      }}
    >
      <PaymentForm
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
        amount={amount}
        currency={currency}
      />
    </Elements>
  );
}
