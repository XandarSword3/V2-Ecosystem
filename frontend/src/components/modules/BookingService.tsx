'use client';

import { useQuery } from '@tanstack/react-query';
import { chaletsApi as chaletApi } from '@/lib/api';
import { Loader2, AlertCircle, Calendar, Users, Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContentTranslation } from '@/lib/translate';
import { motion } from 'framer-motion';
import { Module } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface BookingServiceProps {
  module: Module;
}

export function BookingService({ module }: BookingServiceProps) {
  const t = useTranslations('chalets');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);

  const { data, isLoading, error } = useQuery({
    queryKey: ['chalets', module.id],
    queryFn: () => chaletApi.getChalets(module.id),
  });

  const units = data?.data?.data || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p>{tCommon('error')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-800 pt-24 pb-20">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              {module.name}
            </h1>
            <p className="text-white/90 text-lg max-w-2xl mx-auto">
              {module.description}
            </p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {units.map((unit: any) => (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col md:flex-row"
            >
              <div className="md:w-1/2 h-64 md:h-auto relative">
                {unit.images && unit.images[0] ? (
                  <img 
                    src={unit.images[0]} 
                    alt={translateContent(unit, 'name')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <Home className="w-12 h-12 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="p-6 md:w-1/2 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {translateContent(unit, 'name')}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
                    {translateContent(unit, 'description')}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-6">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{unit.capacity} Guests</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Home className="w-4 h-4" />
                      <span>{unit.bedroom_count} Beds</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                  <div>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(unit.base_price, currency)}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">/ night</span>
                  </div>
                  <button className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors">
                    {t('bookNow')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
