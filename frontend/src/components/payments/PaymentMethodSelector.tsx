'use client';

import React from 'react';
import { Banknote, CreditCard, Hotel, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PaymentMethodType } from '@/lib/engine-a/payment-lifecycle';

export type { PaymentMethodType };

export interface PaymentMethodOption {
  id: PaymentMethodType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

export interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  availableMethods?: PaymentMethodType[];
  disabled?: boolean;
  className?: string;
  activeBookingId?: string; // For Room Charge qualification
}

const DEFAULT_METHODS: PaymentMethodType[] = ['cash', 'card'];

export default function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  availableMethods = DEFAULT_METHODS,
  disabled = false,
  className = '',
  activeBookingId,
}: PaymentMethodSelectorProps) {
  const methodDefinitions: Record<PaymentMethodType, PaymentMethodOption> = {
    cash: {
      id: 'cash',
      title: 'Pay with Cash',
      description: 'Pay in cash at counter or on delivery',
      icon: Banknote,
      iconBg: 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    card: {
      id: 'card',
      title: 'Pay with Card',
      description: 'Credit or debit card via secure Stripe gateway',
      icon: CreditCard,
      iconBg: 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    room_charge: {
      id: 'room_charge',
      title: 'Charge to Room',
      description: activeBookingId ? 'Post charge to your verified room folio' : 'Active room check-in required',
      icon: Hotel,
      iconBg: 'bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    online: {
      id: 'online',
      title: 'Online Payment',
      description: 'Digital wallet or transfer',
      icon: CreditCard,
      iconBg: 'bg-gradient-to-br from-cyan-100 to-sky-100 dark:from-cyan-900/30 dark:to-sky-900/30',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
    },
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Select Payment Method
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        {availableMethods.map((methodKey) => {
          const item = methodDefinitions[methodKey];
          if (!item) return null;

          const isSelected = selectedMethod === methodKey;
          const isRoomChargeDisabled = methodKey === 'room_charge' && !activeBookingId;
          const isItemDisabled = disabled || isRoomChargeDisabled;

          const Icon = item.icon;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileHover={!isItemDisabled ? { scale: 1.01 } : undefined}
              whileTap={!isItemDisabled ? { scale: 0.99 } : undefined}
              onClick={() => {
                if (!isItemDisabled) {
                  onSelectMethod(item.id);
                }
              }}
              disabled={isItemDisabled}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 shadow-md shadow-primary-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/60 dark:bg-slate-900/60'
              } ${isItemDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </motion.div>
              )}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className={`font-semibold text-sm ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
