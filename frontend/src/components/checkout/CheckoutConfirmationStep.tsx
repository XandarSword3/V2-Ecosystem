'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Receipt, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import type { CheckoutFulfillmentData, CheckoutCustomerData } from '@/lib/engine-a/checkout-workflow';
import type { PricingResult } from '@/hooks/usePricingPreview';

export interface CheckoutConfirmationStepProps {
  orderId: string;
  customer: CheckoutCustomerData;
  fulfillment: CheckoutFulfillmentData;
  serverPricing: PricingResult | null;
  currency: string;
  propertySlug: string;
  moduleSlug: string;
  onViewOrder?: () => void;
}

export default function CheckoutConfirmationStep({
  orderId,
  customer,
  fulfillment,
  serverPricing,
  currency,
  propertySlug,
  moduleSlug,
  onViewOrder,
}: CheckoutConfirmationStepProps) {
  const confirmationUrl = `/${propertySlug}/${moduleSlug}/confirmation?type=order&id=${orderId}`;

  return (
    <div className="space-y-6 text-center py-6">
      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/10">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Order Confirmed!</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Thank you, <span className="font-semibold text-slate-900 dark:text-white">{customer.name}</span>. Your order has been placed.
        </p>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Reference ID: {orderId}
        </p>
      </div>

      {/* Fulfillment Summary Card */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-6 text-left max-w-lg mx-auto space-y-3 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
          <MapPin className="w-4 h-4 text-primary-500" />
          <span>Fulfillment Details</span>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
          <p>
            <span className="text-slate-400">Mode:</span>{' '}
            <span className="capitalize font-medium">{fulfillment.mode.replace('_', ' ')}</span>
          </p>
          {fulfillment.destinationRef && (
            <p>
              <span className="text-slate-400">Destination:</span>{' '}
              <span className="font-medium">{fulfillment.destinationRef}</span>
            </p>
          )}
          <p>
            <span className="text-slate-400">Phone:</span>{' '}
            <span className="font-medium">{customer.phone}</span>
          </p>
        </div>

        {serverPricing && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-bold">
            <span className="text-slate-700 dark:text-slate-300">Total Paid</span>
            <span className="text-primary-600 dark:text-primary-400 text-base">
              {formatCurrency(serverPricing.totalAmount, currency)}
            </span>
          </div>
        )}
      </div>

      <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
        <Link href={confirmationUrl} className="w-full sm:w-auto flex-1">
          <Button className="w-full" onClick={onViewOrder}>
            <Receipt className="w-4 h-4 mr-2" />
            View Order Receipt & Tracking
          </Button>
        </Link>
        <Link href={`/${propertySlug}/${moduleSlug}`} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full">
            Back to Store
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
