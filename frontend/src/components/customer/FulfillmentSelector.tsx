'use client';

import React, { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { FulfillmentMode, DestinationType, FulfillmentOption } from '@/lib/engine-a/types';
import { FulfillmentModeSelector } from './FulfillmentModeSelector';
import { DestinationSelector, type ServiceLocationItem } from './DestinationSelector';
import { FulfillmentSummary } from './FulfillmentSummary';

export interface FulfillmentSelectorProps {
  options: FulfillmentOption[];
  selectedMode: FulfillmentMode;
  destinationType: DestinationType;
  destinationRef: string | null;
  onSelectMode: (mode: FulfillmentMode) => void;
  onChangeDestination: (type: DestinationType, ref: string | null) => void;
  serviceLocations?: ServiceLocationItem[];
  loadingLocations?: boolean;
  disabled?: boolean;
  loading?: boolean;
  showSummary?: boolean;
  className?: string;
}

/**
 * Resolves the primary default destination type for a given fulfillment mode.
 */
function defaultDestinationForMode(mode: FulfillmentMode, options: FulfillmentOption[]): DestinationType {
  const opt = options.find((o) => o.mode === mode);
  if (opt && opt.destinations.length > 0) {
    return opt.destinations[0] as DestinationType;
  }
  switch (mode) {
    case 'pickup':
      return 'pickup_location';
    case 'on_premise':
      return 'on_premise_location';
    case 'local_delivery':
    case 'shipment':
      return 'address';
    case 'digital_delivery':
      return 'digital_account';
    case 'service_execution':
      return 'service_location';
    case 'none':
    default:
      return 'none';
  }
}

/**
 * FulfillmentSelector — Top-level Customer Fulfillment Selection Component (Plan F7).
 *
 * Exposes capability-driven fulfillment selection to the customer.
 * Coordinates FulfillmentModeSelector and DestinationSelector, strictly
 * adhering to the engine capability contract:
 *   - Never assumes vertical defaults;
 *   - Fails closed if capability options are empty;
 *   - Automatically synchronizes destination type on mode transitions.
 */
export function FulfillmentSelector({
  options,
  selectedMode,
  destinationType,
  destinationRef,
  onSelectMode,
  onChangeDestination,
  serviceLocations = [],
  loadingLocations = false,
  disabled = false,
  loading = false,
  showSummary = false,
  className = '',
}: FulfillmentSelectorProps) {
  const t = useTranslations('checkout');

  const handleModeChange = useCallback(
    (newMode: FulfillmentMode) => {
      if (newMode === selectedMode) return;
      onSelectMode(newMode);
      const defaultDest = defaultDestinationForMode(newMode, options);
      // Clear destination reference when switching modes
      onChangeDestination(defaultDest, null);
    },
    [selectedMode, onSelectMode, onChangeDestination, options]
  );

  return (
    <div className={`fulfillment-selector space-y-6 ${className}`} data-testid="fulfillment-selector">
      {/* 1. Mode Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground block">
          {t('chooseDeliveryMode') || 'Select Fulfillment Method'}
        </label>
        <FulfillmentModeSelector
          options={options}
          selectedMode={selectedMode}
          onSelectMode={handleModeChange}
          disabled={disabled}
          loading={loading}
        />
      </div>

      {/* 2. Destination Input */}
      {selectedMode && (
        <div className="pt-2 border-t border-border/50">
          <DestinationSelector
            mode={selectedMode}
            destinationType={destinationType}
            destinationRef={destinationRef}
            onChange={onChangeDestination}
            serviceLocations={serviceLocations}
            loadingLocations={loadingLocations}
            disabled={disabled}
          />
        </div>
      )}

      {/* 3. Optional Summary */}
      {showSummary && selectedMode && (
        <div className="pt-2">
          <FulfillmentSummary
            mode={selectedMode}
            destinationType={destinationType}
            destinationRef={destinationRef}
            compact
          />
        </div>
      )}
    </div>
  );
}

export default FulfillmentSelector;
