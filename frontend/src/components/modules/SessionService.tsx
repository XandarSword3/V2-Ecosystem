'use client';

import { useQuery } from '@tanstack/react-query';
import { poolApi } from '@/lib/api';
import { Loader2, AlertCircle, Clock, Users, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContentTranslation } from '@/lib/translate';
import { motion } from 'framer-motion';
import { Module } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface SessionServiceProps {
  module: Module;
}

export function SessionService({ module }: SessionServiceProps) {
  const t = useTranslations('pool');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pool-sessions', module.id],
    queryFn: () => poolApi.getSessions(module.id),
  });

  const sessions = data?.data?.data || [];

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

  // Get module-specific colors or use defaults
  const headerColor = module.settings?.header_color || '#0891b2';
  const accentColor = module.settings?.accent_color || '#1d4ed8';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div 
        className="relative overflow-hidden pt-24 pb-20"
        style={{ background: `linear-gradient(to right, ${headerColor}, ${accentColor})` }}
      >
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session: any) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-100 dark:border-slate-700"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {translateContent(session, 'name')}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    session.gender === 'mixed' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      : session.gender === 'female'
                      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {t(`gender.${session.gender}`)}
                  </span>
                </div>

                <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
                  {translateContent(session, 'description')}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-slate-600 dark:text-slate-400">
                    <Clock className="w-4 h-4 mr-3 text-primary-600" />
                    <span className="text-sm">
                      {session.start_time} - {session.end_time}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-600 dark:text-slate-400">
                    <Users className="w-4 h-4 mr-3 text-primary-600" />
                    <span className="text-sm">
                      Max {session.capacity} {t('guests')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-2xl font-bold text-primary-600">
                    {formatCurrency(session.price, currency)}
                  </span>
                  <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors text-sm">
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
