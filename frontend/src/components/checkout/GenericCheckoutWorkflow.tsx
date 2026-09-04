'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ShoppingCart, User, Truck, CreditCard, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import CheckoutReviewStep from './CheckoutReviewStep';
import CheckoutCustomerStep from './CheckoutCustomerStep';
import CheckoutFulfillmentStep from './CheckoutFulfillmentStep';
import CheckoutPaymentStep from './CheckoutPaymentStep';
import CheckoutConfirmationStep from './CheckoutConfirmationStep';

import {
  CheckoutStepId,
  CheckoutCustomerData,
  CheckoutFulfillmentData,
  CheckoutValidationContext,
  canAdvanceTo,
  CHECKOUT_STEP_ORDER,
} from '@/lib/engine-a/checkout-workflow';
import { usePaymentLifecycle, PaymentMethodType } from '@/lib/engine-a/payment-lifecycle';
import type { FulfillmentMode, DestinationType, FulfillmentOption } from '@/lib/engine-a/types';
import type { ServiceLocationItem } from '@/components/customer/DestinationRequirementsEditor';
import type { PricingResult } from '@/hooks/usePricingPreview';
import type { CartItem } from '@/stores/cartStore';

export interface GenericCheckoutWorkflowProps {
  items: CartItem[];
  onAddItem: (item: CartItem) => void;
  onRemoveItem: (id: string, uniqueKey?: string) => void;
  onClearItems?: () => void;
  getAuthoritativeLinePrice: (itemId: string, index: number) => { unitPriceText: string; lineTotalText: string };

  customer: CheckoutCustomerData;
  onChangeCustomer: (patch: Partial<CheckoutCustomerData>) => void;

  fulfillment: CheckoutFulfillmentData;
  fulfillmentOptions: FulfillmentOption[];
  serviceLocations: ServiceLocationItem[];
  onChangeFulfillmentMode: (mode: FulfillmentMode) => void;
  onChangeDestination: (dest: { destinationType: DestinationType; destinationRef: string | null }) => void;

  serverPricing: PricingResult | null;
  currency: string;
  availablePaymentMethods?: PaymentMethodType[];
  activeBookingId?: string;
  isPricingStale: boolean;
  isLoadingPricing: boolean;
  isPricingError: boolean;

  couponCode: string | null;
  giftCardCodes: string[];
  loyaltyPoints: number;
  onCouponChange: (code: string | null) => void;
  onAddGiftCard: (code: string) => void;
  onRemoveGiftCard: (code: string) => void;
  onLoyaltyPointsChange: (points: number) => void;

  createOrder: (payload: any) => Promise<{ id: string; [key: string]: any }>;
  propertySlug: string;
  moduleSlug: string;
  moduleName?: string;
  moduleId?: string;
  onOrderConfirmed?: (orderId: string) => void;
  className?: string;
}

export default function GenericCheckoutWorkflow({
  items,
  onAddItem,
  onRemoveItem,
  onClearItems,
  getAuthoritativeLinePrice,
  customer,
  onChangeCustomer,
  fulfillment,
  fulfillmentOptions,
  serviceLocations,
  onChangeFulfillmentMode,
  onChangeDestination,
  serverPricing,
  currency,
  availablePaymentMethods,
  activeBookingId,
  isPricingStale,
  isLoadingPricing,
  isPricingError,
  couponCode,
  giftCardCodes,
  loyaltyPoints,
  onCouponChange,
  onAddGiftCard,
  onRemoveGiftCard,
  onLoyaltyPointsChange,
  createOrder,
  propertySlug,
  moduleSlug,
  moduleName = 'Store',
  moduleId,
  onOrderConfirmed,
  className = '',
}: GenericCheckoutWorkflowProps) {
  const [activeStep, setActiveStep] = useState<CheckoutStepId>('review');
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Authoritative server currency invariant: always prefer serverPricing.currency
  const authoritativeCurrency = serverPricing?.currency || currency || 'USD';

  // Canonical payment state machine (F6 Invariant)
  const paymentLifecycle = usePaymentLifecycle({
    recordCashOnServer: false,
    onSuccess: (target) => {
      setConfirmedOrderId(target.referenceId);
      setActiveStep('confirmation');
      onOrderConfirmed?.(target.referenceId);
      toast.success('Payment completed successfully!');
    },
    onError: (error) => {
      toast.error(`Payment failed: ${error}`);
    },
    onCancel: () => {
      toast.info('Payment cancelled. Your order details are saved.');
    },
  });

  // Validation context for state machine gates
  const validationContext: CheckoutValidationContext = useMemo(
    () => ({
      itemCount: items.length,
      customer,
      fulfillment,
      isPricingStale,
      isLoadingPricing,
      isPricingError,
      hasServerPricing: Boolean(serverPricing),
      paymentStatus: paymentLifecycle.status,
    }),
    [items.length, customer, fulfillment, isPricingStale, isLoadingPricing, isPricingError, serverPricing, paymentLifecycle.status]
  );

  // Step transition with strict validation gating
  const navigateToStep = useCallback(
    (targetStep: CheckoutStepId) => {
      const check = canAdvanceTo(targetStep, validationContext);
      if (!check.allowed) {
        toast.error(check.reason || 'Cannot navigate to this step yet.');
        return;
      }
      setActiveStep(targetStep);
    },
    [validationContext]
  );

  // Order submission orchestrator
  const handleSubmitOrder = useCallback(async () => {
    // 1. Guard against stale or invalid pricing
    if (isPricingStale || isLoadingPricing) {
      toast.info('Pricing is recalculating. Please wait for authoritative pricing.');
      return;
    }
    if (isPricingError || !serverPricing) {
      toast.error('Unable to verify order pricing. Please try again.');
      return;
    }

    // 2. Double-submission and in-progress guard
    if (isSubmittingOrder || paymentLifecycle.isCreatingIntent || paymentLifecycle.isProcessing) {
      return;
    }

    setIsSubmittingOrder(true);
    const idempotencyKey = `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

    try {
      const loyaltyDiscount = serverPricing.discounts?.find((d) => d.type === 'loyalty');
      const giftCardDiscounts = serverPricing.discounts?.filter((d) => d.type === 'gift_card') || [];

      // 3. Create the authoritative business transaction/order target on backend
      const orderResult = await createOrder({
        idempotencyKey,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        customerEmail: customer.email?.trim() || undefined,
        notes: customer.notes?.trim() || undefined,
        paymentMethod: paymentLifecycle.method,
        fulfillmentSelection: {
          mode: fulfillment.mode,
          destinationType: fulfillment.destinationType,
          destinationRef: fulfillment.destinationRef,
        },
        items: items.map((item) => ({
          catalog_item_id: item.id,
          menuItemId: item.id,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          metadata: item.selectedModifiers && item.selectedModifiers.length > 0
            ? { selectedModifiers: item.selectedModifiers }
            : undefined,
        })),
        moduleId,
        couponCode: couponCode || undefined,
        giftCardCodes: giftCardCodes.length > 0 ? giftCardCodes : undefined,
        giftCardRedemptions: giftCardCodes.length > 0
          ? giftCardCodes.map((code) => ({
              code,
              amount: giftCardDiscounts.find((g: any) => g.code === code)?.amount || 0,
            }))
          : undefined,
        loyaltyPointsToRedeem: loyaltyPoints > 0 ? loyaltyPoints : undefined,
        loyaltyPointsDollarValue: loyaltyDiscount?.amount,
        previewTotal: serverPricing.totalAmount,
      });

      const orderId = orderResult?.id || '';
      if (!orderId) {
        throw new Error('Order creation did not return a valid order ID');
      }

      // 4. Delegate to canonical payment lifecycle for execution
      await paymentLifecycle.startPayment({
        referenceType: 'instant_transaction',
        referenceId: orderId,
        amount: serverPricing.totalAmount,
        currency: authoritativeCurrency,
        method: paymentLifecycle.method,
        roomChargeBookingId: activeBookingId,
        notes: customer.notes?.trim() || undefined,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to place order';
      toast.error(errMsg);
    } finally {
      setIsSubmittingOrder(false);
    }
  }, [
    isPricingStale,
    isLoadingPricing,
    isPricingError,
    serverPricing,
    isSubmittingOrder,
    paymentLifecycle,
    createOrder,
    customer,
    fulfillment,
    items,
    moduleId,
    couponCode,
    giftCardCodes,
    loyaltyPoints,
    authoritativeCurrency,
    activeBookingId,
  ]);

  const stepDefinitions = [
    { id: 'review' as CheckoutStepId, title: 'Review Order', icon: ShoppingCart },
    { id: 'customer' as CheckoutStepId, title: 'Your Details', icon: User },
    { id: 'fulfillment' as CheckoutStepId, title: 'Fulfillment', icon: Truck },
    { id: 'payment' as CheckoutStepId, title: 'Payment', icon: CreditCard },
    { id: 'confirmation' as CheckoutStepId, title: 'Confirmation', icon: CheckCircle2 },
  ];

  const currentStepIndex = CHECKOUT_STEP_ORDER.indexOf(activeStep);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 5-Step Indicator Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        {stepDefinitions.map((step, index) => {
          const isPassed = currentStepIndex > index;
          const isCurrent = activeStep === step.id;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => navigateToStep(step.id)}
                disabled={activeStep === 'confirmation'}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0 ${
                  isCurrent
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                    : isPassed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isPassed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <span>{step.title}</span>
              </button>
              {index < stepDefinitions.length - 1 && (
                <div
                  className={`w-6 h-0.5 flex-shrink-0 ${
                    currentStepIndex > index ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Main Step Render Container */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-white/50 dark:border-slate-800/50">
        <AnimatePresence mode="wait">
          {activeStep === 'review' && (
            <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CheckoutReviewStep
                items={items}
                onAddItem={onAddItem}
                onRemoveItem={onRemoveItem}
                onClearItems={onClearItems}
                getAuthoritativeLinePrice={getAuthoritativeLinePrice}
                moduleName={moduleName}
                onContinue={() => navigateToStep('customer')}
              />
            </motion.div>
          )}

          {activeStep === 'customer' && (
            <motion.div key="customer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CheckoutCustomerStep
                customer={customer}
                onChangeCustomer={onChangeCustomer}
                onBack={() => setActiveStep('review')}
                onContinue={() => navigateToStep('fulfillment')}
              />
            </motion.div>
          )}

          {activeStep === 'fulfillment' && (
            <motion.div key="fulfillment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CheckoutFulfillmentStep
                fulfillment={fulfillment}
                fulfillmentOptions={fulfillmentOptions}
                serviceLocations={serviceLocations}
                onChangeMode={onChangeFulfillmentMode}
                onChangeDestination={(destType, destRef) =>
                  onChangeDestination({ destinationType: destType, destinationRef: destRef })
                }
                isPricingStale={isPricingStale}
                isLoadingPricing={isLoadingPricing}
                isPricingError={isPricingError}
                onBack={() => setActiveStep('customer')}
                onContinue={() => navigateToStep('payment')}
              />
            </motion.div>
          )}

          {activeStep === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CheckoutPaymentStep
                serverPricing={serverPricing}
                currency={authoritativeCurrency}
                activeBookingId={activeBookingId}
                availablePaymentMethods={availablePaymentMethods}
                isPricingStale={isPricingStale}
                isLoadingPricing={isLoadingPricing}
                isPricingError={isPricingError}
                paymentState={paymentLifecycle.state}
                onSelectPaymentMethod={paymentLifecycle.selectMethod}
                couponCode={couponCode}
                giftCardCodes={giftCardCodes}
                loyaltyPoints={loyaltyPoints}
                onCouponChange={onCouponChange}
                onAddGiftCard={onAddGiftCard}
                onRemoveGiftCard={onRemoveGiftCard}
                onLoyaltyPointsChange={onLoyaltyPointsChange}
                moduleId={moduleId}
                moduleSlug={moduleSlug}
                onSubmitOrder={handleSubmitOrder}
                isSubmittingOrder={isSubmittingOrder}
                onStripePaymentSuccess={paymentLifecycle.markSucceeded}
                onStripePaymentError={paymentLifecycle.markFailed}
                onStripePaymentCancel={paymentLifecycle.markCancelled}
                onRetryPayment={handleSubmitOrder}
                onBack={() => setActiveStep('fulfillment')}
              />
            </motion.div>
          )}

          {activeStep === 'confirmation' && confirmedOrderId && (
            <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <CheckoutConfirmationStep
                orderId={confirmedOrderId}
                customer={customer}
                fulfillment={fulfillment}
                serverPricing={serverPricing}
                currency={authoritativeCurrency}
                propertySlug={propertySlug}
                moduleSlug={moduleSlug}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
