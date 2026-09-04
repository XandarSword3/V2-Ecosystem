import type { FulfillmentMode, DestinationType } from '@/lib/engine-a/types';
import type { PaymentStatus } from '@/lib/engine-a/payment-lifecycle';

export type CheckoutStepId = 'review' | 'customer' | 'fulfillment' | 'payment' | 'confirmation';

export interface CheckoutCustomerData {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface CheckoutFulfillmentData {
  mode: FulfillmentMode;
  destinationType: DestinationType;
  destinationRef: string | null;
  serviceLocations?: Array<{ id: string; name: string; is_active?: boolean }>;
}

export interface CheckoutValidationContext {
  itemCount: number;
  customer: CheckoutCustomerData;
  fulfillment: CheckoutFulfillmentData;
  isPricingStale: boolean;
  isLoadingPricing: boolean;
  isPricingError: boolean;
  hasServerPricing: boolean;
  paymentStatus: PaymentStatus;
}

export const CHECKOUT_STEP_ORDER: readonly CheckoutStepId[] = [
  'review',
  'customer',
  'fulfillment',
  'payment',
  'confirmation',
] as const;

export function isReviewValid(itemCount: number): boolean {
  return itemCount > 0;
}

export function isCustomerValid(customer: CheckoutCustomerData): boolean {
  return Boolean(customer.name && customer.name.trim().length > 0 && customer.phone && customer.phone.trim().length > 0);
}

export function isFulfillmentValid(fulfillment: CheckoutFulfillmentData): boolean {
  const { mode, destinationRef, serviceLocations } = fulfillment;

  if (mode === 'on_premise') {
    if (!destinationRef) return false;
    if (serviceLocations && serviceLocations.length > 0) {
      return serviceLocations.some((loc) => loc.id === destinationRef && loc.is_active !== false);
    }
    return destinationRef.trim().length > 0;
  }

  if (mode === 'local_delivery' || mode === 'shipment') {
    return Boolean(destinationRef && destinationRef.trim().length > 0);
  }

  if (mode === 'digital_delivery') {
    return Boolean(destinationRef && destinationRef.trim().length > 0);
  }

  if (mode === 'service_execution') {
    return Boolean(destinationRef && destinationRef.trim().length > 0);
  }

  // mode === 'pickup' or 'none' requires no destination reference
  return true;
}

export function isPricingAuthoritative(context: {
  hasServerPricing: boolean;
  isPricingStale: boolean;
  isLoadingPricing: boolean;
  isPricingError: boolean;
}): boolean {
  return context.hasServerPricing && !context.isPricingStale && !context.isLoadingPricing && !context.isPricingError;
}

/**
 * Evaluates whether navigation to targetStep is permitted given the current context.
 * Gating rule: All prerequisite steps must be valid, and pricing must be authoritative to advance to payment.
 */
export function canAdvanceTo(
  targetStep: CheckoutStepId,
  context: CheckoutValidationContext,
): { allowed: boolean; reason?: string } {
  const targetIndex = CHECKOUT_STEP_ORDER.indexOf(targetStep);

  // Check 1: Review must be valid to leave review
  if (targetIndex >= 1 && !isReviewValid(context.itemCount)) {
    return { allowed: false, reason: 'Cart is empty. Add items before proceeding.' };
  }

  // Check 2: Customer must be valid to pass customer step
  if (targetIndex >= 2 && !isCustomerValid(context.customer)) {
    return { allowed: false, reason: 'Please enter your name and phone number.' };
  }

  // Check 3: Fulfillment must be valid to pass fulfillment step
  if (targetIndex >= 3 && !isFulfillmentValid(context.fulfillment)) {
    return { allowed: false, reason: 'Please select a valid fulfillment destination.' };
  }

  // Check 4: Pricing must be authoritative to enter or execute payment
  if (targetIndex >= 3 && !isPricingAuthoritative(context)) {
    if (context.isPricingStale || context.isLoadingPricing) {
      return { allowed: false, reason: 'Pricing is calculating. Please wait for authoritative pricing.' };
    }
    return { allowed: false, reason: 'Pricing calculation error. Please try again.' };
  }

  // Check 5: Confirmation can only be reached if payment has succeeded
  if (targetStep === 'confirmation' && context.paymentStatus !== 'succeeded') {
    return { allowed: false, reason: 'Payment must succeed before reaching confirmation.' };
  }

  return { allowed: true };
}
