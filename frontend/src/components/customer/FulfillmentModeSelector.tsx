'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { FulfillmentMode, FulfillmentOption } from '@/lib/engine-a/types';
import {
  Store,
  ShoppingBag,
  Truck,
  Download,
  Package,
  Wrench,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export interface FulfillmentModeSelectorProps {
  options: FulfillmentOption[];
  selectedMode?: FulfillmentMode;
  onSelectMode: (mode: FulfillmentMode) => void;
  className?: string;
  disabled?: boolean;
}

interface ModeDisplayMeta {
  labelKey: string;
  defaultLabel: string;
  descKey: string;
  defaultDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODE_META: Record<FulfillmentMode, ModeDisplayMeta> = {
  on_premise: {
    labelKey: 'fulfillmentModeOnPremise',
    defaultLabel: 'On-Premise',
    descKey: 'fulfillmentDescOnPremise',
    defaultDesc: 'Service or pickup at our physical location',
    icon: Store,
  },
  pickup: {
    labelKey: 'fulfillmentModePickup',
    defaultLabel: 'Pickup',
    descKey: 'fulfillmentDescPickup',
    defaultDesc: 'Collect your order at the designated counter',
    icon: ShoppingBag,
  },
  local_delivery: {
    labelKey: 'fulfillmentModeLocalDelivery',
    defaultLabel: 'Local Delivery',
    descKey: 'fulfillmentDescLocalDelivery',
    defaultDesc: 'Delivered directly to your local address',
    icon: Truck,
  },
  digital_delivery: {
    labelKey: 'fulfillmentModeDigitalDelivery',
    defaultLabel: 'Digital Delivery',
    descKey: 'fulfillmentDescDigitalDelivery',
    defaultDesc: 'Instant digital delivery to your account or email',
    icon: Download,
  },
  shipment: {
    labelKey: 'fulfillmentModeShipment',
    defaultLabel: 'Shipment',
    descKey: 'fulfillmentDescShipment',
    defaultDesc: 'Shipped via courier to your destination',
    icon: Package,
  },
  service_execution: {
    labelKey: 'fulfillmentModeServiceExecution',
    defaultLabel: 'Service Execution',
    descKey: 'fulfillmentDescServiceExecution',
    defaultDesc: 'Executed at designated service station or chair',
    icon: Wrench,
  },
  none: {
    labelKey: 'fulfillmentModeNone',
    defaultLabel: 'Direct Settlement (No Fulfillment)',
    descKey: 'fulfillmentDescNone',
    defaultDesc: 'Direct commercial transaction with no physical delivery',
    icon: CheckCircle2,
  },
};

/**
 * FulfillmentModeSelector — Pure Presentation Component for Canonical Engine A Modes.
 *
 * Renders available selectable fulfillment modes and non-fulfillment mode (`none`)
 * derived directly from EngineACapabilities options.
 */
export function FulfillmentModeSelector({
  options,
  selectedMode,
  onSelectMode,
  className = '',
  disabled = false,
}: FulfillmentModeSelectorProps) {
  const t = useTranslations('common');

  // If no options are declared by capability, fall back safely
  const availableModes: FulfillmentMode[] = options && options.length > 0
    ? options.map(o => o.mode)
    : ['on_premise', 'pickup'];

  return (
    <div className={`fulfillment-mode-selector space-y-3 ${className}`} data-testid="fulfillment-mode-selector">
      <label className="block text-sm font-semibold text-foreground mb-2">
        {t('selectFulfillmentMode') || 'Select Fulfillment Method'}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {availableModes.map((mode) => {
          const meta = MODE_META[mode] || {
            labelKey: mode,
            defaultLabel: mode,
            descKey: mode,
            defaultDesc: '',
            icon: HelpCircle,
          };
          const Icon = meta.icon;
          const isSelected = selectedMode === mode;

          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMode(mode)}
              data-testid={`mode-option-${mode}`}
              aria-pressed={isSelected}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 ${
                isSelected
                  ? 'border-primary-600 bg-primary-50/50 dark:bg-primary-950/20 shadow-sm ring-1 ring-primary-500/30'
                  : 'border-border/60 bg-card hover:bg-muted/40 hover:border-border'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div
                className={`p-2.5 rounded-lg shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm truncate ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-foreground'}`}>
                    {t(meta.labelKey) || meta.defaultLabel}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 ml-1" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {t(meta.descKey) || meta.defaultDesc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FulfillmentModeSelector;
