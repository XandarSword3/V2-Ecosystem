'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { FulfillmentMode, DestinationType } from '@/lib/engine-a/types';
import { MapPin, AlertCircle, CheckCircle2, Clock, Mail, Truck, Info } from 'lucide-react';

export interface ServiceLocationItem {
  id: string;
  name: string;
  is_active: boolean;
  is_occupied?: boolean;
}

export interface DestinationRequirementsEditorProps {
  mode: FulfillmentMode;
  destinationType: DestinationType;
  destinationRef: string | null;
  onChange: (destinationType: DestinationType, destinationRef: string | null) => void;
  serviceLocations?: ServiceLocationItem[];
  loadingLocations?: boolean;
  className?: string;
}

/**
 * DestinationRequirementsEditor — Pure Presentation Component for Destination Requirements.
 *
 * Dynamically mounts mode-specific destination inputs depending on the selected canonical fulfillment mode.
 */
export function DestinationRequirementsEditor({
  mode,
  destinationType,
  destinationRef,
  onChange,
  serviceLocations = [],
  loadingLocations = false,
  className = '',
}: DestinationRequirementsEditorProps) {
  const t = useTranslations('common');

  if (mode === 'none') {
    return (
      <div className={`p-4 rounded-xl bg-muted/40 border border-border/40 text-sm text-muted-foreground flex items-center gap-3 ${className}`}>
        <Info className="w-5 h-5 text-primary-500 shrink-0" />
        <span>{t('fulfillmentNoneNotice') || 'This transaction settles directly with no physical fulfillment required.'}</span>
      </div>
    );
  }

  if (mode === 'on_premise') {
    const activeLocations = serviceLocations.filter(loc => loc.is_active !== false);

    return (
      <div className={`space-y-3 ${className}`} data-testid="destination-editor-on-premise">
        <label className="block text-sm font-semibold text-foreground">
          {t('selectLocationOrTable') || 'Select Table / Location'}
          <span className="text-destructive ml-1">*</span>
        </label>
        
        {loadingLocations ? (
          <div className="py-4 text-xs text-muted-foreground animate-pulse">
            {t('loadingLocations') || 'Loading available locations...'}
          </div>
        ) : activeLocations.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {activeLocations.map((loc) => {
              const isSelected = destinationRef === loc.id || destinationRef === loc.name;
              const isOccupied = loc.is_occupied;

              return (
                <button
                  key={loc.id}
                  type="button"
                  disabled={isOccupied}
                  onClick={() => onChange('on_premise_location', loc.id)}
                  data-testid={`location-option-${loc.id}`}
                  className={`p-3 rounded-lg border text-center transition-all duration-150 flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 ring-2 ring-primary-500 text-primary-900 dark:text-primary-100 font-bold'
                      : isOccupied
                      ? 'border-border/40 bg-muted/30 opacity-50 cursor-not-allowed text-muted-foreground'
                      : 'border-border bg-card hover:bg-muted/40 text-foreground cursor-pointer'
                  }`}
                >
                  <span className="text-sm font-medium">{loc.name}</span>
                  {isOccupied ? (
                    <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider">
                      {t('occupied') || 'Occupied'}
                    </span>
                  ) : isSelected ? (
                    <span className="text-[10px] text-primary-600 font-semibold uppercase tracking-wider">
                      {t('selected') || 'Selected'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">
                      {t('available') || 'Available'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={destinationRef || ''}
              onChange={(e) => onChange('on_premise_location', e.target.value)}
              placeholder={t('enterTableNumberPlaceholder') || 'e.g. Table 5, Poolside Lounger 12'}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}
      </div>
    );
  }

  if (mode === 'pickup') {
    return (
      <div className={`space-y-3 ${className}`} data-testid="destination-editor-pickup">
        <label className="block text-sm font-semibold text-foreground">
          {t('pickupNotes') || 'Pickup Instructions (Optional)'}
        </label>
        <input
          type="text"
          value={destinationRef || ''}
          onChange={(e) => onChange('pickup_location', e.target.value)}
          placeholder={t('pickupNotesPlaceholder') || 'e.g. Will pick up in 20 minutes'}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    );
  }

  if (mode === 'local_delivery' || mode === 'shipment') {
    return (
      <div className={`space-y-3 ${className}`} data-testid="destination-editor-delivery">
        <label className="block text-sm font-semibold text-foreground">
          {mode === 'shipment' ? (t('shippingAddress') || 'Shipping Address') : (t('deliveryAddress') || 'Delivery Address')}
          <span className="text-destructive ml-1">*</span>
        </label>
        <textarea
          rows={3}
          value={destinationRef || ''}
          onChange={(e) => onChange('address', e.target.value)}
          placeholder={t('addressPlaceholder') || 'Street address, building/suite, city, postal code, special delivery directions'}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>
    );
  }

  if (mode === 'digital_delivery') {
    return (
      <div className={`space-y-3 ${className}`} data-testid="destination-editor-digital">
        <label className="block text-sm font-semibold text-foreground">
          {t('digitalDeliveryHandle') || 'Recipient Email or Digital Account'}
          <span className="text-destructive ml-1">*</span>
        </label>
        <input
          type="text"
          value={destinationRef || ''}
          onChange={(e) => onChange('digital_account', e.target.value)}
          placeholder={t('digitalAccountPlaceholder') || 'e.g. user@example.com'}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    );
  }

  if (mode === 'service_execution') {
    return (
      <div className={`space-y-3 ${className}`} data-testid="destination-editor-service">
        <label className="block text-sm font-semibold text-foreground">
          {t('serviceStationRef') || 'Service Station / Room Identifier'}
          <span className="text-destructive ml-1">*</span>
        </label>
        <input
          type="text"
          value={destinationRef || ''}
          onChange={(e) => onChange('service_location', e.target.value)}
          placeholder={t('serviceStationPlaceholder') || 'e.g. Spa Treatment Room 3, Station B'}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    );
  }

  return null;
}

export default DestinationRequirementsEditor;
