'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { CheckoutCustomerData } from '@/lib/engine-a/checkout-workflow';
import { isCustomerValid } from '@/lib/engine-a/checkout-workflow';

export interface CheckoutCustomerStepProps {
  customer: CheckoutCustomerData;
  onChangeCustomer: (patch: Partial<CheckoutCustomerData>) => void;
  onBack: () => void;
  onContinue: () => void;
  disabled?: boolean;
}

export default function CheckoutCustomerStep({
  customer,
  onChangeCustomer,
  onBack,
  onContinue,
  disabled = false,
}: CheckoutCustomerStepProps) {
  const t = useTranslations('checkout');
  const isValid = isCustomerValid(customer);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('customerDetails')}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{t('customerSubtitle')}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('yourName')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={customer.name}
            onChange={(e) => onChangeCustomer({ name: e.target.value })}
            placeholder={t('namePlaceholder')}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('phoneNumber')} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={customer.phone}
            onChange={(e) => onChangeCustomer({ phone: e.target.value })}
            placeholder={t('phonePlaceholder')}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('emailAddress')} <span className="text-slate-400 text-xs">{t('emailOptional')}</span>
        </label>
        <input
          type="email"
          value={customer.email || ''}
          onChange={(e) => onChangeCustomer({ email: e.target.value })}
          placeholder={t('emailPlaceholder')}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('specialNotes')}
        </label>
        <textarea
          value={customer.notes || ''}
          onChange={(e) => onChangeCustomer({ notes: e.target.value })}
          placeholder={t('notesPlaceholder')}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
        />
      </div>

      <div className="pt-4 flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToReview')}
        </Button>
        <Button onClick={onContinue} disabled={disabled || !isValid} className="px-6">
          {t('continueToFulfillment')}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
