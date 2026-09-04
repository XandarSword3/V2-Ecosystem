'use client';

import React from 'react';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector';
import { PaymentDiscounts } from '@/components/customer/PaymentDiscounts';
import StripePayment from '@/components/payments/StripePayment';
import { formatCurrency } from '@/lib/utils';
import type { PaymentMethodType, PaymentStatus, PaymentLifecycleState } from '@/lib/engine-a/payment-lifecycle';
import type { PricingResult } from '@/hooks/usePricingPreview';

export interface CheckoutPaymentStepProps {
  serverPricing: PricingResult | null;
  currency: string;
  isPricingStale: boolean;
  isLoadingPricing: boolean;
  isPricingError: boolean;
  paymentState: PaymentLifecycleState;
  onSelectPaymentMethod: (method: PaymentMethodType) => void;
  availablePaymentMethods?: PaymentMethodType[];
  activeBookingId?: string;
  // Discount props
  couponCode: string | null;
  giftCardCodes: string[];
  loyaltyPoints: number;
  onCouponChange: (code: string | null) => void;
  onAddGiftCard: (code: string) => void;
  onRemoveGiftCard: (code: string) => void;
  onLoyaltyPointsChange: (points: number) => void;
  moduleId?: string;
  moduleSlug?: string;
  // Execution & lifecycle handlers
  onSubmitOrder: () => void;
  isSubmittingOrder: boolean;
  onStripePaymentSuccess: () => void;
  onStripePaymentError: (error: string) => void;
  onStripePaymentCancel: () => void;
  onRetryPayment?: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export default function CheckoutPaymentStep({
  serverPricing,
  currency,
  isPricingStale,
  isLoadingPricing,
  isPricingError,
  paymentState,
  onSelectPaymentMethod,
  availablePaymentMethods,
  activeBookingId,
  couponCode,
  giftCardCodes,
  loyaltyPoints,
  onCouponChange,
  onAddGiftCard,
  onRemoveGiftCard,
  onLoyaltyPointsChange,
  moduleId,
  moduleSlug,
  onSubmitOrder,
  isSubmittingOrder,
  onStripePaymentSuccess,
  onStripePaymentError,
  onStripePaymentCancel,
  onRetryPayment,
  onBack,
  disabled = false,
}: CheckoutPaymentStepProps) {
  // Authoritative server currency invariant: always prefer serverPricing.currency
  const activeCurrency = serverPricing?.currency || currency || 'USD';
  const isPricingBlocked = isPricingStale || isLoadingPricing || isPricingError || !serverPricing;
  const isRoomChargeBlocked = paymentState.method === 'room_charge' && !activeBookingId;
  const isActionInProgress = isSubmittingOrder || paymentState.status === 'creating_intent' || paymentState.status === 'processing';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Payment & Discounts</h2>
        <p className="text-sm text-slate-500 mt-0.5">Select your payment method and apply any discounts or rewards.</p>
      </div>

      {/* Payment Method Selector (pure capability-aware selector) */}
      <PaymentMethodSelector
        selectedMethod={paymentState.method}
        onSelectMethod={onSelectPaymentMethod}
        availableMethods={availablePaymentMethods}
        activeBookingId={activeBookingId}
        disabled={isActionInProgress || disabled}
      />

      {/* Room Charge Unavailability Warning */}
      {paymentState.method === 'room_charge' && !activeBookingId && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Room charge requires an active room reservation. Please select cash or card, or access checkout with your room booking details.
          </p>
        </div>
      )}

      {/* Discounts Section */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-base">Promotions & Rewards</h3>
        <PaymentDiscounts
          couponCode={couponCode}
          giftCardCodes={giftCardCodes}
          loyaltyPointsToRedeem={loyaltyPoints}
          onCouponChange={onCouponChange}
          onAddGiftCard={onAddGiftCard}
          onRemoveGiftCard={onRemoveGiftCard}
          onLoyaltyPointsChange={onLoyaltyPointsChange}
          pricingDiscounts={serverPricing?.discounts}
          isPricingStale={isPricingStale}
          isLoadingPricing={isLoadingPricing}
          currency={activeCurrency}
          moduleId={moduleId}
          moduleSlug={moduleSlug}
        />
      </div>

      {/* Authoritative Server Pricing Breakdown */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-base">Order Total</h3>
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2.5">
          {isLoadingPricing || isPricingStale ? (
            <div className="py-4 text-center text-sm text-slate-400 italic animate-pulse">
              Calculating authoritative pricing...
            </div>
          ) : isPricingError || !serverPricing ? (
            <div className="py-2 text-center text-sm text-red-500">
              Pricing unavailable. Please try again.
            </div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatCurrency(serverPricing.subtotal, activeCurrency)}
                </span>
              </div>

              {/* Server Tax Lines */}
              {(serverPricing.taxBreakdown || []).map((taxLine, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{taxLine.name} ({taxLine.rate}%)</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatCurrency(taxLine.amount, activeCurrency)}
                  </span>
                </div>
              ))}

              {/* Server Fee Lines */}
              {(serverPricing.feeBreakdown || []).map((feeLine, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{feeLine.name}</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatCurrency(feeLine.amount, activeCurrency)}
                  </span>
                </div>
              ))}

              {/* Server Discounts */}
              {(serverPricing.discounts || []).map((discount, i) => (
                <div key={i} className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>{discount.name || 'Discount'}</span>
                  <span>-{formatCurrency(discount.amount, activeCurrency)}</span>
                </div>
              ))}

              <div className="flex justify-between font-bold pt-3 border-t border-slate-200 dark:border-slate-700 text-base">
                <span className="text-slate-900 dark:text-white">Total Amount</span>
                <div className="text-right">
                  {serverPricing.totalDiscount > 0 &&
                    serverPricing.preDiscountTotal !== undefined &&
                    serverPricing.preDiscountTotal > serverPricing.totalAmount && (
                      <span className="text-xs text-slate-400 line-through mr-2 font-normal">
                        {formatCurrency(serverPricing.preDiscountTotal, activeCurrency)}
                      </span>
                    )}
                  <span className="text-primary-600 dark:text-primary-400 text-lg">
                    {formatCurrency(serverPricing.totalAmount, activeCurrency)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Failure Feedback */}
      {paymentState.status === 'failed' && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Payment Failed</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-300">
            {paymentState.error || 'An unexpected error occurred during payment processing.'}
          </p>
          {onRetryPayment && (
            <Button size="sm" variant="outline" onClick={onRetryPayment} className="mt-2 text-red-600 dark:text-red-400">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry Payment
            </Button>
          )}
        </div>
      )}

      {/* Payment Cancelled Feedback */}
      {paymentState.status === 'cancelled' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Payment was cancelled. Your order details are saved — please click below to complete your payment.
          </p>
        </div>
      )}

      {/* Navigation & Submission Controls */}
      <div className="pt-4 flex justify-between items-center">
        <Button variant="outline" onClick={onBack} disabled={isActionInProgress || disabled}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Fulfillment
        </Button>

        <Button
          onClick={onSubmitOrder}
          disabled={disabled || isPricingBlocked || isActionInProgress || isRoomChargeBlocked}
          className="px-8 py-3 text-base font-semibold"
        >
          {isActionInProgress ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {paymentState.status === 'creating_intent'
                ? 'Initializing Gateway...'
                : paymentState.status === 'processing'
                ? 'Processing Payment...'
                : 'Placing Order...'}
            </>
          ) : isPricingStale || isLoadingPricing ? (
            'Recalculating...'
          ) : (
            `Place Order • ${serverPricing ? formatCurrency(serverPricing.totalAmount, activeCurrency) : '—'}`
          )}
        </Button>
      </div>

      {/* Stripe Payment Modal Integration (Active when awaiting action or processing card) */}
      {(paymentState.status === 'awaiting_action' || (paymentState.status === 'processing' && paymentState.clientSecret)) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <StripePayment
              amount={serverPricing?.totalAmount || 0}
              currency={activeCurrency}
              clientSecret={paymentState.clientSecret}
              onSuccess={onStripePaymentSuccess}
              onError={onStripePaymentError}
              onCancel={onStripePaymentCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
