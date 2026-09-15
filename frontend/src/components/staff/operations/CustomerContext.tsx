'use client';

import React from 'react';
import { User, Phone, MapPin, Crown, Award, UserCheck } from 'lucide-react';

export interface CustomerContextProps {
  customerName?: string;
  customerPhone?: string;
  loyaltyTier?: string;
  isVip?: boolean;
  tableNumber?: string | number;
  tableName?: string;
  roomNumber?: string;
  staffName?: string;
  className?: string;
}

/**
 * CustomerContext — Standard Customer & Location Context for Operations (Plan F8).
 *
 * Renders actor metadata, customer identity, loyalty status, and service
 * locations across all Engine A operational cards.
 */
export function CustomerContext({
  customerName,
  customerPhone,
  loyaltyTier,
  isVip = false,
  tableNumber,
  tableName,
  roomNumber,
  staffName,
  className = '',
}: CustomerContextProps) {
  const hasCustomer = Boolean(customerName || customerPhone || isVip || loyaltyTier);
  const formattedTable = tableNumber
    ? String(tableNumber).toLowerCase().startsWith('table')
      ? String(tableNumber)
      : `Table ${tableNumber}`
    : null;
  const locationLabel = tableName || formattedTable || (roomNumber ? `Room ${roomNumber}` : null);

  return (
    <div className={`space-y-1 text-xs ${className}`} data-testid="operations-customer-context">
      {/* Top Row: Location & VIP / Tier */}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        {locationLabel ? (
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 shrink-0" />
            <span>{locationLabel}</span>
          </div>
        ) : (
          <span className="text-muted-foreground italic text-[11px]">No table assigned</span>
        )}

        {/* Badges: VIP / Loyalty */}
        <div className="flex items-center gap-1">
          {isVip && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-[10px]"
              data-testid="vip-badge"
            >
              <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              VIP
            </span>
          )}
          {loyaltyTier && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 font-semibold text-[10px]">
              <Award className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              {loyaltyTier}
            </span>
          )}
        </div>
      </div>

      {/* Customer Name & Phone */}
      {hasCustomer && (
        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
          {customerName && (
            <span className="font-medium text-foreground flex items-center gap-1">
              <User className="w-3 h-3 text-muted-foreground shrink-0" />
              {customerName}
            </span>
          )}
          {customerPhone && (
            <span className="flex items-center gap-0.5 font-mono text-[10px]">
              <Phone className="w-2.5 h-2.5 shrink-0" />
              {customerPhone}
            </span>
          )}
        </div>
      )}

      {/* Assigned Staff */}
      {staffName && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
          <UserCheck className="w-3 h-3 text-primary-500 shrink-0" />
          <span>Server: <strong className="text-foreground">{staffName}</strong></span>
        </div>
      )}
    </div>
  );
}

export default CustomerContext;
