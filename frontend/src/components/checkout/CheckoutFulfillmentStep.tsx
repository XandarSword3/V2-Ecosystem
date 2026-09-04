'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FulfillmentModeSelector } from '@/components/customer/FulfillmentModeSelector';
import { DestinationRequirementsEditor, type ServiceLocationItem } from '@/components/customer/DestinationRequirementsEditor';
import type { FulfillmentMode, DestinationType, FulfillmentOption } from '@/lib/engine-a/types';
import type { CheckoutFulfillmentData } from '@/lib/engine-a/checkout-workflow';
import { isFulfillmentValid } from '@/lib/engine-a/checkout-workflow';

export interface CheckoutFulfillmentStepProps {
  fulfillment: CheckoutFulfillmentData;
  fulfillmentOptions: FulfillmentOption[];
  serviceLocations: ServiceLocationItem[];
  onChangeMode: (mode: FulfillmentMode) => void;
  onChangeDestination: (destinationType: DestinationType, destinationRef: string | null) => void;
  isPricingStale: boolean;
  isLoadingPricing: boolean;
  isPricingError?: boolean;
  onBack: () => void;
  onContinue: () => void;
  disabled?: boolean;
}

export default function CheckoutFulfillmentStep({
  fulfillment,
  fulfillmentOptions,
  serviceLocations,
  onChangeMode,
  onChangeDestination,
  isPricingStale,
  isLoadingPricing,
  isPricingError = false,
  onBack,
  onContinue,
  disabled = false,
}: CheckoutFulfillmentStepProps) {
  const isValid = isFulfillmentValid(fulfillment);
  const isPricingBlocked = isPricingStale || isLoadingPricing || isPricingError;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Fulfillment Selection</h2>
        <p className="text-sm text-slate-500 mt-0.5">Select how you want to receive your order.</p>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
          Choose Delivery Mode
        </label>
        <FulfillmentModeSelector
          options={fulfillmentOptions}
          selectedMode={fulfillment.mode}
          onSelectMode={onChangeMode}
        />

        <div className="pt-2">
          <DestinationRequirementsEditor
            mode={fulfillment.mode}
            destinationType={fulfillment.destinationType}
            destinationRef={fulfillment.destinationRef}
            serviceLocations={serviceLocations}
            onChange={onChangeDestination}
          />
        </div>
      </div>

      {isPricingStale && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800 text-sm">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Updating delivery pricing based on your fulfillment selection...</span>
        </div>
      )}

      {isPricingError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Pricing calculation failed for this destination. Please verify the destination details.</span>
        </div>
      )}

      <div className="pt-4 flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customer Details
        </Button>
        <Button
          onClick={onContinue}
          disabled={disabled || !isValid || isPricingBlocked}
          className="px-6"
        >
          {isPricingStale || isLoadingPricing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Recalculating Pricing...
            </>
          ) : isPricingError ? (
            'Pricing Error'
          ) : (
            <>
              Continue to Payment
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
