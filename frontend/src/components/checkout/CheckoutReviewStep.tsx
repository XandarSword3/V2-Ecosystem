'use client';

import React from 'react';
import { Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { CartItem } from '@/stores/cartStore';

export interface CheckoutReviewStepProps {
  items: CartItem[];
  onAddItem: (item: CartItem) => void;
  onRemoveItem: (id: string, uniqueKey?: string) => void;
  onClearItems?: () => void;
  getAuthoritativeLinePrice: (itemId: string, index: number) => { unitPriceText: string; lineTotalText: string };
  moduleName?: string;
  onContinue: () => void;
  disabled?: boolean;
}

export default function CheckoutReviewStep({
  items,
  onAddItem,
  onRemoveItem,
  onClearItems,
  getAuthoritativeLinePrice,
  moduleName = 'Order',
  onContinue,
  disabled = false,
}: CheckoutReviewStepProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-slate-500 dark:text-slate-400">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Review Your Cart</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {items.length} {items.length === 1 ? 'item' : 'items'} in {moduleName}
          </p>
        </div>
        {onClearItems && (
          <Button variant="ghost" className="text-red-500 hover:text-red-600 text-sm" onClick={onClearItems}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((item, index) => {
          const linePricing = getAuthoritativeLinePrice(item.id, index);
          return (
            <div key={item.uniqueKey || item.id} className="py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white text-base truncate">{item.name}</h3>
                <p className="text-sm text-slate-500">{linePricing.unitPriceText}</p>
                {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.selectedModifiers.map((mod, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          mod.modifierType === 'remove'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : mod.modifierType === 'swap'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {mod.modifierType === 'remove' ? 'No ' : mod.modifierType === 'swap' ? 'Swap: ' : '+'}
                        {mod.optionName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-white/50 dark:bg-slate-800/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onRemoveItem(item.id, item.uniqueKey)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onAddItem(item)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <span className="font-bold w-24 text-right text-slate-900 dark:text-white">
                  {linePricing.lineTotalText}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 flex justify-end">
        <Button onClick={onContinue} disabled={disabled || items.length === 0} className="px-6">
          Continue to Customer Details
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
