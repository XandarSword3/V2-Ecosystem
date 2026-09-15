'use client';

import React from 'react';
import type { FulfillmentMode } from '@/lib/engine-a/types';
import {
  Store,
  ShoppingBag,
  Truck,
  Package,
  Download,
  Wrench,
  MapPin,
  FileText,
  User,
  CheckCircle2,
} from 'lucide-react';

export interface FulfillmentDetailsProps {
  mode: FulfillmentMode;
  destinationType?: string | null;
  destinationRef?: string | null;
  deliveryAddress?: string | null;
  driverName?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  className?: string;
}

const MODE_META: Record<FulfillmentMode, { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; text: string }> = {
  on_premise: {
    label: 'Dine-In / On-Premise',
    icon: Store,
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  pickup: {
    label: 'Pickup / Takeaway',
    icon: ShoppingBag,
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
  },
  local_delivery: {
    label: 'Local Delivery',
    icon: Truck,
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
  },
  shipment: {
    label: 'Shipment',
    icon: Package,
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
  },
  digital_delivery: {
    label: 'Digital Delivery',
    icon: Download,
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
  },
  service_execution: {
    label: 'Service Execution',
    icon: Wrench,
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  none: {
    label: 'Direct Settlement',
    icon: CheckCircle2,
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    text: 'text-slate-700 dark:text-slate-300',
  },
};

/**
 * FulfillmentDetails — Operational Fulfillment Metadata Display (Plan F8).
 *
 * Renders mode-appropriate details (courier info, addresses, pickup instructions)
 * on operational cards.
 */
export function FulfillmentDetails({
  mode,
  destinationType,
  destinationRef,
  deliveryAddress,
  driverName,
  trackingNumber,
  notes,
  className = '',
}: FulfillmentDetailsProps) {
  const meta = MODE_META[mode] || MODE_META.on_premise;
  const Icon = meta.icon;
  const address = deliveryAddress || (destinationType === 'address' ? destinationRef : null);

  return (
    <div className={`space-y-1.5 text-xs ${className}`} data-testid="operations-fulfillment-details">
      {/* Mode Tag */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.bg} ${meta.text}`}
          data-testid={`mode-tag-${mode}`}
        >
          <Icon className="w-3 h-3 shrink-0" />
          <span>{meta.label}</span>
        </span>

        {trackingNumber && (
          <span className="font-mono text-[10px] text-muted-foreground">
            Ref: {trackingNumber}
          </span>
        )}
      </div>

      {/* Address / Destination */}
      {address && (
        <div className="flex items-start gap-1 text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded-md">
          <MapPin className="w-3 h-3 text-primary-500 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{address}</span>
        </div>
      )}

      {/* Assigned Driver */}
      {driverName && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <User className="w-3 h-3 text-blue-500 shrink-0" />
          <span>Driver: <strong className="text-foreground">{driverName}</strong></span>
        </div>
      )}

      {/* Notes / Special Instructions */}
      {notes && (
        <div className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-md border border-amber-200/60 dark:border-amber-900/60">
          <FileText className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{notes}</span>
        </div>
      )}
    </div>
  );
}

export default FulfillmentDetails;
