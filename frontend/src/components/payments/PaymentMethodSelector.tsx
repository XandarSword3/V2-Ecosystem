'use client';

import { useState } from 'react';
import StripePayment from './StripePayment';

export type PaymentMethodType = 'cash' | 'card' | 'online';

interface PaymentMethodSelectorProps {
  amount: number;
  currency?: string;
  referenceType: 'restaurant_order' | 'snack_order' | 'chalet_booking' | 'pool_ticket';
  referenceId: string;
  onPaymentComplete: (method: PaymentMethodType) => void;
  onCancel?: () => void;
  showCashOption?: boolean;
  showCardOption?: boolean;
  defaultMethod?: PaymentMethodType;
}

export default function PaymentMethodSelector({
  amount,
  currency = 'USD',
  referenceType,
  referenceId,
  onPaymentComplete,
  onCancel,
  showCashOption = true,
  showCardOption = true,
  defaultMethod = 'card',
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>(defaultMethod);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleMethodSelect = (method: PaymentMethodType) => {
    setSelectedMethod(method);
    setPaymentError(null);
    
    if (method === 'cash') {
      // For cash, immediately complete (payment on delivery/pickup)
      setShowStripePayment(false);
    } else if (method === 'card' || method === 'online') {
      // For card/online, show Stripe payment form
      setShowStripePayment(true);
    }
  };

  const handleCashConfirm = () => {
    onPaymentComplete('cash');
  };

  const handleStripeSuccess = () => {
    setPaymentSuccess(true);
    onPaymentComplete('online');
  };

  const handleStripeError = (error: string) => {
    setPaymentError(error);
  };

  if (paymentSuccess) {
    return (
      <div className="text-center p-8">
        <div className="text-green-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Payment Successful!
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Your payment has been processed successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      {!showStripePayment && (
        <>
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Payment Method
            </p>
            
            <div className="grid gap-3">
              {showCardOption && (
                <button
                  onClick={() => handleMethodSelect('card')}
                  className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                    selectedMethod === 'card' || selectedMethod === 'online'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Pay with Card</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Secure payment via Stripe
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <img src="/visa.svg" alt="Visa" className="h-6" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <img src="/mastercard.svg" alt="Mastercard" className="h-6" onError={(e) => e.currentTarget.style.display = 'none'} />
                  </div>
                </button>
              )}

              {showCashOption && (
                <button
                  onClick={() => handleMethodSelect('cash')}
                  className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                    selectedMethod === 'cash'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                  }`}
                >
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Pay with Cash</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Pay upon pickup or delivery
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {paymentError && (
            <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {paymentError}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            )}
            
            {selectedMethod === 'cash' && (
              <button
                onClick={handleCashConfirm}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Confirm Cash Payment
              </button>
            )}
            
            {(selectedMethod === 'card' || selectedMethod === 'online') && (
              <button
                onClick={() => setShowStripePayment(true)}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Continue to Payment
              </button>
            )}
          </div>
        </>
      )}

      {/* Stripe Payment Form */}
      {showStripePayment && (
        <div>
          <button
            onClick={() => setShowStripePayment(false)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Change payment method
          </button>
          
          <StripePayment
            amount={amount}
            currency={currency}
            referenceType={referenceType}
            referenceId={referenceId}
            onSuccess={handleStripeSuccess}
            onError={handleStripeError}
            onCancel={() => setShowStripePayment(false)}
          />
        </div>
      )}
    </div>
  );
}
