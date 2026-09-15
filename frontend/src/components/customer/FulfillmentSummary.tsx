'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { FulfillmentMode, DestinationType } from '@/lib/engine-a/types';
import { getModeStateConfig } from '@/lib/engine-a/types';
import {
  Store,
  ShoppingBag,
  Truck,
  Download,
  Package,
  Wrench,
  MapPin,
  Clock,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export interface FulfillmentSummaryProps {
  mode: FulfillmentMode;
  destinationType?: DestinationType;
  destinationRef?: string | null;
  fulfillmentStatus?: string | null;
  estimatedReadyTime?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  serviceLocationName?: string | null;
  compact?: boolean;
  className?: string;
}

const MODE_ICON_MAP: Record<FulfillmentMode, React.ComponentType<{ className?: string }>> = {
  on_premise: Store,
  pickup: ShoppingBag,
  local_delivery: Truck,
  digital_delivery: Download,
  shipment: Package,
  service_execution: Wrench,
  none: CheckCircle2,
};

function formatModeLabel(mode: FulfillmentMode): string {
  switch (mode) {
    case 'on_premise':
      return 'On-Premise / Dine-In';
    case 'pickup':
      return 'Store Pickup';
    case 'local_delivery':
      return 'Local Delivery';
    case 'digital_delivery':
      return 'Digital Delivery';
    case 'shipment':
      return 'Courier Shipment';
    case 'service_execution':
      return 'Service Execution';
    case 'none':
      return 'Direct Settlement';
    default:
      return (mode as string).replace('_', ' ');
  }
}

function formatDestination(
  mode: FulfillmentMode,
  destinationType?: DestinationType,
  destinationRef?: string | null,
  serviceLocationName?: string | null
): string | null {
  if (serviceLocationName) {
    return serviceLocationName;
  }
  if (!destinationRef) {
    return null;
  }
  if (destinationType === 'on_premise_location') {
    return `Table / Location: ${destinationRef}`;
  }
  if (destinationType === 'room') {
    return `Room ${destinationRef}`;
  }
  if (destinationType === 'pickup_location') {
    return `Pickup Instructions: ${destinationRef}`;
  }
  if (destinationType === 'digital_account') {
    return `Account: ${destinationRef}`;
  }
  if (destinationType === 'service_location') {
    return `Service Station: ${destinationRef}`;
  }
  return destinationRef;
}

/**
 * FulfillmentSummary — Standard Presentation Component for Order Fulfillment Details (Plan F7).
 *
 * Renders mode badge, destination details, canonical fulfillment status, and
 * tracking info consistently across Cart, Checkout, Confirmation, and Account views.
 */
export function FulfillmentSummary({
  mode,
  destinationType,
  destinationRef,
  fulfillmentStatus,
  estimatedReadyTime,
  carrierName,
  trackingNumber,
  trackingUrl,
  serviceLocationName,
  compact = false,
  className = '',
}: FulfillmentSummaryProps) {
  const t = useTranslations('checkout');
  const Icon = MODE_ICON_MAP[mode] || HelpCircle;
  const modeLabel = formatModeLabel(mode);
  const destinationText = formatDestination(mode, destinationType, destinationRef, serviceLocationName);

  // Derive status badge styling from canonical mode state config
  const modeConfig = getModeStateConfig(mode);
  const stateMeta =
    fulfillmentStatus && modeConfig
      ? (modeConfig.metadata as Record<string, any>)[fulfillmentStatus]
      : null;

  if (compact) {
    return (
      <div
        className={`flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs ${className}`}
        data-testid="fulfillment-summary-compact"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{modeLabel}</p>
            {destinationText && (
              <p className="text-slate-500 dark:text-slate-400 truncate text-[11px]">{destinationText}</p>
            )}
          </div>
        </div>

        {fulfillmentStatus && (
          <span
            className={`ml-2 px-2 py-0.5 rounded-full font-medium text-[11px] shrink-0 ${
              stateMeta
                ? `${stateMeta.bg} ${stateMeta.text} ${stateMeta.border} border`
                : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
            }`}
          >
            {stateMeta ? stateMeta.label : fulfillmentStatus.replace('_', ' ').toUpperCase()}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3.5 ${className}`}
      data-testid="fulfillment-summary-full"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t('fulfillmentDetails') || 'Fulfillment'}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{modeLabel}</p>
          </div>
        </div>

        {fulfillmentStatus && (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              stateMeta
                ? `${stateMeta.bg} ${stateMeta.text} ${stateMeta.border} border`
                : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
            }`}
            data-testid="fulfillment-status-badge"
          >
            {stateMeta ? stateMeta.label : fulfillmentStatus.replace('_', ' ').toUpperCase()}
          </span>
        )}
      </div>

      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-700/60">
        {destinationText && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-primary-500 mt-0.5 shrink-0" />
            <span className="font-medium break-words">{destinationText}</span>
          </div>
        )}

        {estimatedReadyTime && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Estimated Ready: <strong className="text-slate-700 dark:text-slate-200">{estimatedReadyTime}</strong></span>
          </div>
        )}

        {(carrierName || trackingNumber) && (
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-1">
            <span>
              {carrierName ? `${carrierName}: ` : 'Tracking: '}
              <strong className="font-mono text-slate-800 dark:text-slate-200">{trackingNumber}</strong>
            </span>
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
              >
                Track Carrier <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FulfillmentSummary;
